from contextlib import asynccontextmanager
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
import os
import threading
import time
from typing import Annotated
from uuid import UUID

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from psycopg import Connection
from psycopg_pool import ConnectionPool

from .db import get_conn
from .rules import calculate_run_rewards
from .schemas import (
    AdminGrantRequest,
    FeedbackCreate,
    FeedbackUpdate,
    ForgotPasswordRequest,
    LoginRequest,
    PlayerSessionRequest,
    PlayerUpdate,
    ProgressRequest,
    RegisterRequest,
    ResetPasswordRequest,
    RunRequest,
    SettingsRequest,
    SkinCreate,
    SkinUpdate,
)
from .security import (
    SESSION_COOKIE,
    clear_session_cookie,
    create_session,
    current_player,
    hash_password,
    hash_reset_token,
    hash_token,
    new_reset_token,
    reset_url,
    require_admin,
    send_reset_email,
    token_expired,
    verify_password,
)

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required. Configure a local PostgreSQL database before starting the API.")
    pool = ConnectionPool(
        conninfo=database_url,
        min_size=1,
        max_size=10,
        timeout=5,
        open=False,
    )
    pool.open(wait=True)
    app.state.db_pool = pool
    try:
        yield
    finally:
        pool.close()


app = FastAPI(
    title="Math Rush 3D API",
    version="1.1.0",
    description=(
        "Player accounts, game progress, scores, feedback, leaderboard and role-protected administration. "
        "Browser sessions use the httpOnly math_rush_session cookie. Android requests can use the bearer "
        "sessionToken returned at sign-in. The forgot-password message does not disclose whether an account exists."
    ),
    servers=[{"url": "http://localhost:3001", "description": "Local FastAPI service"}],
    lifespan=lifespan,
)

allowed_origins = [
    origin.strip()
    for origin in os.environ.get("CLIENT_ORIGIN", "http://localhost:5173").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Math-Rush-Client"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    response.headers["Cache-Control"] = "no-store"
    if os.environ.get("NODE_ENV") == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


def custom_openapi() -> dict:
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        servers=app.servers,
    )
    schema.setdefault("components", {}).setdefault("securitySchemes", {}).update({
        "cookieAuth": {
            "type": "apiKey",
            "in": "cookie",
            "name": SESSION_COOKIE,
            "description": "Browser session cookie set by registration or login.",
        },
        "bearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "Session token",
            "description": "Android clients use the sessionToken returned by registration or login.",
        },
    })
    schema["tags"] = [
        {"name": "Health", "description": "API and PostgreSQL connectivity."},
        {"name": "Authentication", "description": "Account registration, login, password recovery and sessions."},
        {"name": "Players", "description": "Player profiles, preferences, progression and owned cosmetics."},
        {"name": "Runs", "description": "Validated, idempotent completed-run submission."},
        {"name": "Leaderboard", "description": "Public ranked scores."},
        {"name": "Store", "description": "Public cosmetic catalogue and player feedback submission."},
        {"name": "Administration", "description": "Role-protected player, run, skin, feedback and audit management."},
    ]
    for path, path_item in schema.get("paths", {}).items():
        if path == "/api/health":
            tag = "Health"
        elif path.startswith("/api/auth/"):
            tag = "Authentication"
        elif path.startswith("/api/players/"):
            tag = "Players"
        elif path == "/api/runs":
            tag = "Runs"
        elif path == "/api/leaderboard":
            tag = "Leaderboard"
        elif path in {"/api/skins", "/api/feedback"}:
            tag = "Store"
        else:
            tag = "Administration"
        for method, operation in path_item.items():
            if method in {"get", "post", "put", "patch", "delete"}:
                operation["tags"] = [tag]
        protected = (
            path.startswith("/api/admin/")
            or path.startswith("/api/players/") and path != "/api/players/session"
            or path == "/api/runs"
            or path == "/api/auth/me"
        )
        if protected:
            for method, operation in path_item.items():
                if method in {"get", "post", "put", "patch", "delete"}:
                    operation["security"] = [{"cookieAuth": []}, {"bearerAuth": []}]
    app.openapi_schema = schema
    return schema


app.openapi = custom_openapi

_rate_limits: dict[str, deque[float]] = defaultdict(deque)
_rate_lock = threading.Lock()


def rate_limit(bucket: str, maximum: int, window_seconds: int = 900):
    def check(request: Request) -> None:
        remote = request.client.host if request.client else "unknown"
        key = f"{bucket}:{remote}"
        now = time.monotonic()
        with _rate_lock:
            events = _rate_limits[key]
            while events and events[0] <= now - window_seconds:
                events.popleft()
            if len(events) >= maximum:
                raise HTTPException(429, "Too many attempts. Please try again shortly.")
            events.append(now)
    return check


auth_limit = rate_limit("auth", 30)
reset_limit = rate_limit("reset", 5)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, error: RequestValidationError):
    issues = [
        {"path": item.get("loc", []), "message": item.get("msg", "Invalid value"), "code": item.get("type", "value_error")}
        for item in error.errors()
    ]
    return JSONResponse(status_code=400, content={"error": "Invalid request", "issues": issues})


def auth_player(request: Request, conn: Annotated[Connection, Depends(get_conn)]) -> str:
    return current_player(request, conn)


def admin_player(
    request: Request,
    conn: Annotated[Connection, Depends(get_conn)],
    player_id: Annotated[str, Depends(auth_player)],
) -> str:
    require_admin(conn, player_id)
    return player_id


def read_profile(conn: Connection, player_id: str) -> dict | None:
    row = conn.execute(
        """
        SELECT p.id, p.display_name, p.selected_skin,
          progress.coins, progress.best_score, progress.selected_difficulty,
          progress.selected_level, progress.easy_levels_completed,
          progress.medium_levels_completed, progress.hard_levels_completed,
          progress.expert_levels_completed, progress.games_played,
          progress.games_won, progress.total_stars, progress.total_score,
          progress.highest_multiplier, progress.total_math_gain,
          s.music, s.sound_effects, s.vibration, s.notifications, s.reduced_effects,
          COALESCE(array_agg(ps.skin_id) FILTER (WHERE ps.skin_id IS NOT NULL), ARRAY[]::text[]) AS owned_skins
        FROM players p
        JOIN player_progress progress ON progress.player_id = p.id
        JOIN player_settings s ON s.player_id = p.id
        LEFT JOIN player_skins ps ON ps.player_id = p.id
        WHERE p.id = %s
        GROUP BY p.id, progress.player_id, s.player_id
        """,
        (player_id,),
    ).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "displayName": row["display_name"],
        "coins": row["coins"],
        "bestScore": row["best_score"],
        "selectedSkin": row["selected_skin"],
        "selectedDifficulty": row["selected_difficulty"],
        "selectedLevel": row["selected_level"],
        "levelProgress": {
            "easy": row["easy_levels_completed"],
            "medium": row["medium_levels_completed"],
            "hard": row["hard_levels_completed"],
            "expert": row["expert_levels_completed"],
        },
        "ownedSkins": row["owned_skins"],
        "settings": {
            "music": row["music"],
            "soundEffects": row["sound_effects"],
            "vibration": row["vibration"],
            "notifications": row["notifications"],
            "reducedEffects": row["reduced_effects"],
        },
        "stats": {
            "gamesPlayed": row["games_played"],
            "gamesWon": row["games_won"],
            "totalStars": row["total_stars"],
            "totalScore": int(row["total_score"]),
            "highestMultiplier": row["highest_multiplier"],
            "totalMathGain": int(row["total_math_gain"]),
        },
    }


def set_session_response(request: Request, response: Response, token: str) -> dict:
    if request.headers.get("x-math-rush-client", "").lower() == "android":
        return {"sessionToken": token}
    return {}


def add_audit(
    conn: Connection,
    actor_player_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str | None,
    details: dict | None = None,
) -> None:
    import json

    conn.execute(
        "INSERT INTO audit_log (actor_player_id, action, entity_type, entity_id, details) VALUES (%s, %s, %s, %s, %s::jsonb)",
        (actor_player_id, action, entity_type, entity_id, json.dumps(details or {})),
    )


def prevent_last_admin_deactivation(conn: Connection, player_id: str) -> None:
    has_admin_role = conn.execute(
        "SELECT 1 FROM player_roles WHERE player_id=%s AND role_key='admin'",
        (player_id,),
    ).fetchone()
    if not has_admin_role:
        return
    active_admins = conn.execute(
        """SELECT COUNT(*)::int AS count FROM player_roles r
          JOIN player_accounts a ON a.player_id=r.player_id
          WHERE r.role_key='admin' AND a.is_active=true"""
    ).fetchone()["count"]
    if active_admins <= 1:
        raise HTTPException(409, "The final active administrator account cannot be disabled")


def parse_time(value: str | datetime) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00")) if isinstance(value, str) else value
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def skin_result(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "primary": row["primary_color"],
        "secondary": row["secondary_color"],
        "accent": row["accent_color"],
        "head": row["head_color"],
        "glow": row["glow_color"],
        "price": row["price"],
        "rarity": row["rarity"],
        "sortOrder": row["sort_order"],
        "isAvailable": row["is_available"],
    }


SKIN_COLUMNS = {
    "name": "name",
    "primary_color": "primary_color",
    "secondary_color": "secondary_color",
    "accent_color": "accent_color",
    "head_color": "head_color",
    "glow_color": "glow_color",
    "price": "price",
    "rarity": "rarity",
    "sort_order": "sort_order",
    "is_available": "is_available",
}


@app.get("/api/health")
def health(conn: Annotated[Connection, Depends(get_conn)]):
    row = conn.execute("SELECT now() AS database_time").fetchone()
    return {"status": "ok", "databaseTime": row["database_time"]}


@app.post("/api/auth/register", status_code=201, dependencies=[Depends(auth_limit)])
def register(
    request: Request,
    response: Response,
    body: RegisterRequest,
    conn: Annotated[Connection, Depends(get_conn)],
):
    with conn.transaction():
        if conn.execute("SELECT 1 FROM player_accounts WHERE lower(email) = lower(%s)", (body.email,)).fetchone():
            raise HTTPException(409, "An account already exists for this email")
        player = conn.execute(
            """
            INSERT INTO players (device_id, display_name) VALUES (%s, %s)
            ON CONFLICT (device_id) DO UPDATE SET display_name = EXCLUDED.display_name, last_seen_at = now()
            RETURNING id
            """,
            (body.device_id, body.display_name),
        ).fetchone()
        player_id = str(player["id"])
        if conn.execute("SELECT 1 FROM player_accounts WHERE player_id = %s", (player_id,)).fetchone():
            raise HTTPException(409, "This device is already linked to an account. Please sign in.")
        conn.execute("INSERT INTO player_progress (player_id) VALUES (%s) ON CONFLICT DO NOTHING", (player_id,))
        conn.execute("INSERT INTO player_settings (player_id) VALUES (%s) ON CONFLICT DO NOTHING", (player_id,))
        conn.execute("INSERT INTO player_skins (player_id, skin_id) VALUES (%s, 'default') ON CONFLICT DO NOTHING", (player_id,))
        conn.execute(
            "INSERT INTO player_accounts (player_id, email, password_hash) VALUES (%s, %s, %s)",
            (player_id, body.email, hash_password(body.password)),
        )
        conn.execute("INSERT INTO player_roles (player_id, role_key) VALUES (%s, 'player') ON CONFLICT DO NOTHING", (player_id,))
        token = create_session(conn, player_id, response)
        profile = read_profile(conn, player_id)
    return {"profile": profile, **set_session_response(request, response, token)}


@app.post("/api/auth/login", dependencies=[Depends(auth_limit)])
def login(
    request: Request,
    response: Response,
    body: LoginRequest,
    conn: Annotated[Connection, Depends(get_conn)],
):
    account = conn.execute(
        "SELECT player_id, password_hash, is_active FROM player_accounts WHERE lower(email) = lower(%s)",
        (body.email,),
    ).fetchone()
    if not account or not account["is_active"] or not verify_password(body.password, account["password_hash"]):
        raise HTTPException(401, "Email or password is incorrect")
    player_id = str(account["player_id"])
    with conn.transaction():
        conn.execute("UPDATE players SET last_seen_at = now() WHERE id = %s", (player_id,))
        token = create_session(conn, player_id, response)
        profile = read_profile(conn, player_id)
    return {"profile": profile, **set_session_response(request, response, token)}


@app.post("/api/auth/forgot-password", dependencies=[Depends(reset_limit)])
def forgot_password(body: ForgotPasswordRequest, conn: Annotated[Connection, Depends(get_conn)]):
    message = "If that email is registered, a password reset link has been prepared."
    account = conn.execute(
        "SELECT player_id, email FROM player_accounts WHERE lower(email) = lower(%s) AND is_active = true",
        (body.email,),
    ).fetchone()
    if not account:
        return {"message": message}
    token = new_reset_token()
    link = reset_url(token)
    with conn.transaction():
        conn.execute(
            "DELETE FROM password_reset_tokens WHERE player_id = %s OR expires_at <= now()",
            (account["player_id"],),
        )
        conn.execute(
            "INSERT INTO password_reset_tokens (player_id, token_hash, expires_at) VALUES (%s, %s, now() + interval '15 minutes')",
            (account["player_id"], hash_reset_token(token)),
        )
    try:
        send_reset_email(account["email"], link)
    except Exception:
        print("[password-reset] email delivery failed")
    result = {"message": message}
    if os.environ.get("NODE_ENV") != "production":
        result["resetUrl"] = link
    return result


@app.post("/api/auth/reset-password", dependencies=[Depends(reset_limit)])
def reset_password(
    body: ResetPasswordRequest,
    response: Response,
    conn: Annotated[Connection, Depends(get_conn)],
):
    with conn.transaction():
        token_row = conn.execute(
            "SELECT id, player_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = %s FOR UPDATE",
            (hash_reset_token(body.token),),
        ).fetchone()
        if not token_row or token_row["used_at"] or token_expired(token_row["expires_at"]):
            raise HTTPException(400, "This reset link is invalid or has expired")
        conn.execute(
            "UPDATE player_accounts SET password_hash = %s, updated_at = now() WHERE player_id = %s",
            (hash_password(body.password), token_row["player_id"]),
        )
        conn.execute("UPDATE password_reset_tokens SET used_at = now() WHERE id = %s", (token_row["id"],))
        conn.execute("DELETE FROM auth_sessions WHERE player_id = %s", (token_row["player_id"],))
    clear_session_cookie(response)
    return {"message": "Password updated. You can now log in with the new password."}


@app.get("/api/auth/me")
def get_me(
    conn: Annotated[Connection, Depends(get_conn)],
    player_id: Annotated[str, Depends(auth_player)],
):
    profile = read_profile(conn, player_id)
    if not profile:
        raise HTTPException(404, "Player not found")
    return {"profile": profile}


@app.post("/api/auth/logout", status_code=204)
def logout(request: Request, response: Response, conn: Annotated[Connection, Depends(get_conn)]):
    authorization = request.headers.get("authorization", "")
    token = request.cookies.get(SESSION_COOKIE)
    if authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if token:
        conn.execute("DELETE FROM auth_sessions WHERE token_hash = %s", (hash_token(token),))
    clear_session_cookie(response)
    response.status_code = 204
    response.body = b""
    return response


@app.post("/api/players/session")
def create_or_resume_guest(body: PlayerSessionRequest, conn: Annotated[Connection, Depends(get_conn)]):
    with conn.transaction():
        player = conn.execute(
            """
            INSERT INTO players (device_id, display_name) VALUES (%s, COALESCE(%s, 'Math Runner'))
            ON CONFLICT (device_id) DO UPDATE SET last_seen_at = now(),
              display_name = COALESCE(%s, players.display_name)
            RETURNING id
            """,
            (body.device_id, body.display_name, body.display_name),
        ).fetchone()
        player_id = str(player["id"])
        conn.execute("INSERT INTO player_progress (player_id) VALUES (%s) ON CONFLICT DO NOTHING", (player_id,))
        conn.execute("INSERT INTO player_settings (player_id) VALUES (%s) ON CONFLICT DO NOTHING", (player_id,))
        conn.execute("INSERT INTO player_skins (player_id, skin_id) VALUES (%s, 'default') ON CONFLICT DO NOTHING", (player_id,))
        profile = read_profile(conn, player_id)
    return {"profile": profile}


@app.get("/api/players/{player_id}/stats")
def player_stats(
    player_id: UUID,
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(auth_player)],
):
    if actor != str(player_id):
        raise HTTPException(403, "You cannot change another player account")
    profile = read_profile(conn, str(player_id))
    if not profile:
        raise HTTPException(404, "Player not found")
    recent = conn.execute(
        "SELECT id, difficulty, level, status, score, distance, multiplier, stars, ended_at FROM game_runs WHERE player_id = %s ORDER BY ended_at DESC LIMIT 10",
        (str(player_id),),
    ).fetchall()
    return {"profile": profile, "recentRuns": recent}


@app.patch("/api/players/{player_id}/settings")
def update_player_settings(
    player_id: UUID,
    body: SettingsRequest,
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(auth_player)],
):
    if actor != str(player_id):
        raise HTTPException(403, "You cannot change another player account")
    values = body.model_dump()
    row = conn.execute(
        """
        UPDATE player_settings SET music = COALESCE(%s, music), sound_effects = COALESCE(%s, sound_effects),
          vibration = COALESCE(%s, vibration), notifications = COALESCE(%s, notifications),
          reduced_effects = COALESCE(%s, reduced_effects)
        WHERE player_id = %s
        RETURNING music, sound_effects, vibration, notifications, reduced_effects
        """,
        (values["music"], values["sound_effects"], values["vibration"], values["notifications"], values["reduced_effects"], str(player_id)),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Player not found")
    return {"settings": row}


@app.patch("/api/players/{player_id}/progress")
def update_player_progress(
    player_id: UUID,
    body: ProgressRequest,
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(auth_player)],
):
    if actor != str(player_id):
        raise HTTPException(403, "You cannot change another player account")
    row = conn.execute(
        "UPDATE player_progress SET selected_difficulty = %s, selected_level = COALESCE(%s, selected_level) WHERE player_id = %s RETURNING selected_difficulty, selected_level",
        (body.selected_difficulty, body.selected_level, str(player_id)),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Player not found")
    return {"selectedDifficulty": row["selected_difficulty"], "selectedLevel": row["selected_level"]}


@app.post("/api/players/{player_id}/skins/{skin_id}/purchase")
def purchase_skin(
    player_id: UUID,
    skin_id: str,
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(auth_player)],
):
    if actor != str(player_id):
        raise HTTPException(403, "You cannot purchase for another player")
    with conn.transaction():
        skin = conn.execute("SELECT id, price FROM skins WHERE id = %s AND is_available = true", (skin_id,)).fetchone()
        if not skin:
            raise HTTPException(404, "Skin not found")
        owned = conn.execute("SELECT 1 FROM player_skins WHERE player_id = %s AND skin_id = %s", (str(player_id), skin_id)).fetchone()
        if not owned:
            charged = conn.execute(
                "UPDATE player_progress SET coins = coins - %s WHERE player_id = %s AND coins >= %s RETURNING coins",
                (skin["price"], str(player_id), skin["price"]),
            ).fetchone()
            if not charged:
                raise HTTPException(409, "Not enough coins")
            conn.execute("INSERT INTO player_skins (player_id, skin_id) VALUES (%s, %s)", (str(player_id), skin_id))
        updated = conn.execute("UPDATE players SET selected_skin = %s WHERE id = %s RETURNING selected_skin", (skin_id, str(player_id))).fetchone()
        progress = conn.execute("SELECT coins FROM player_progress WHERE player_id = %s", (str(player_id),)).fetchone()
    return {"coins": progress["coins"], "selectedSkin": updated["selected_skin"]}


@app.post("/api/runs", status_code=201)
def submit_run(
    body: RunRequest,
    response: Response,
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(auth_player)],
):
    if actor != str(body.player_id):
        raise HTTPException(403, "You cannot submit a run for another player")
    rewards = calculate_run_rewards(
        actual_math_gain=body.math_gain,
        distance=body.distance,
        multiplier=body.multiplier,
        stars=body.stars,
        won=body.status == "won",
        bonus_points=body.bonus_points,
    )
    started_at = parse_time(body.started_at)
    ended_at = parse_time(body.ended_at)
    duration_ms = max(0, min(3_600_000, int((ended_at - started_at).total_seconds() * 1000)))
    with conn.transaction():
        duplicate = conn.execute("SELECT id, score, coins_earned FROM game_runs WHERE client_run_id = %s", (body.client_run_id,)).fetchone()
        if duplicate:
            response.status_code = 200
            return {"run": duplicate, "duplicate": True}
        inserted = conn.execute(
            """
            INSERT INTO game_runs (
              client_run_id, player_id, difficulty, level, status, started_at, ended_at,
              duration_ms, score, distance, starting_crowd, crowd_at_boss, ending_crowd,
              boss_health, multiplier, stars, coins_earned, bonus_points, math_gain,
              max_math_gain, client_version
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id, score, coins_earned
            """,
            (body.client_run_id, str(body.player_id), body.difficulty, body.level, body.status,
             started_at, ended_at, duration_ms, rewards["score"], body.distance,
             body.starting_crowd, body.crowd_at_boss, body.ending_crowd, body.boss_health,
             body.multiplier, body.stars, rewards["coins"], body.bonus_points, body.math_gain,
             body.max_math_gain, body.client_version),
        ).fetchone()
        run_id = inserted["id"]
        for event in body.gate_events:
            conn.execute(
                """INSERT INTO gate_choices (run_id, gate_index, world_z, left_expression, right_expression,
                   chosen_side, chosen_delta, optimal_delta, crowd_before, crowd_after)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (run_id, event.gate_index, event.world_z, event.left_expression, event.right_expression,
                 event.chosen_side, event.chosen_delta, event.optimal_delta, event.crowd_before, event.crowd_after),
            )
        for event in body.obstacle_events:
            conn.execute(
                """INSERT INTO obstacle_events (run_id, obstacle_index, world_z, obstacle_type, outcome,
                   crowd_before, crowd_after, damage) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                (run_id, event.obstacle_index, event.world_z, event.obstacle_type, event.outcome,
                 event.crowd_before, event.crowd_after, event.damage),
            )
        stats = conn.execute(
            """
            UPDATE player_progress SET
              coins = coins + %s, best_score = GREATEST(best_score, %s),
              total_stars = total_stars + %s, games_played = games_played + 1,
              games_won = games_won + %s, total_score = total_score + %s,
              highest_multiplier = GREATEST(highest_multiplier, %s),
              total_math_gain = total_math_gain + %s,
              easy_levels_completed = CASE WHEN %s = 'won' AND %s = 'easy' THEN GREATEST(easy_levels_completed, %s) ELSE easy_levels_completed END,
              medium_levels_completed = CASE WHEN %s = 'won' AND %s = 'medium' THEN GREATEST(medium_levels_completed, %s) ELSE medium_levels_completed END,
              hard_levels_completed = CASE WHEN %s = 'won' AND %s = 'hard' THEN GREATEST(hard_levels_completed, %s) ELSE hard_levels_completed END,
              expert_levels_completed = CASE WHEN %s = 'won' AND %s = 'expert' THEN GREATEST(expert_levels_completed, %s) ELSE expert_levels_completed END
            WHERE player_id = %s
            RETURNING coins, best_score, games_played, games_won, total_stars, total_score,
              highest_multiplier, total_math_gain, selected_level, easy_levels_completed,
              medium_levels_completed, hard_levels_completed, expert_levels_completed
            """,
            (rewards["coins"], rewards["score"], body.stars, int(body.status == "won"), rewards["score"],
             body.multiplier, max(0, body.math_gain), body.status, body.difficulty, body.level,
             body.status, body.difficulty, body.level, body.status, body.difficulty, body.level,
             body.status, body.difficulty, body.level, str(body.player_id)),
        ).fetchone()
        if not stats:
            raise HTTPException(404, "Player not found")
        conn.execute("UPDATE players SET last_seen_at = now() WHERE id = %s", (str(body.player_id),))
        conn.execute(
            """
            INSERT INTO player_achievements (player_id, achievement_id, progress, unlocked_at)
            SELECT p.id, a.id,
              CASE a.id WHEN 'first_win' THEN pr.games_won
                WHEN 'math_1000' THEN LEAST(pr.total_math_gain, 2147483647)::int
                WHEN 'multiplier_10' THEN pr.highest_multiplier
                WHEN 'veteran_50' THEN pr.games_played ELSE 0 END,
              CASE WHEN CASE a.id WHEN 'first_win' THEN pr.games_won
                WHEN 'math_1000' THEN LEAST(pr.total_math_gain, 2147483647)::int
                WHEN 'multiplier_10' THEN pr.highest_multiplier
                WHEN 'veteran_50' THEN pr.games_played ELSE 0 END >= a.target_value
              THEN now() ELSE NULL END
            FROM players p JOIN player_progress pr ON pr.player_id = p.id CROSS JOIN achievements a
            WHERE p.id = %s
            ON CONFLICT (player_id, achievement_id) DO UPDATE SET
              progress = EXCLUDED.progress,
              unlocked_at = COALESCE(player_achievements.unlocked_at, EXCLUDED.unlocked_at)
            """,
            (str(body.player_id),),
        )
    return {
        "run": inserted,
        "player": {
            "coins": stats["coins"],
            "bestScore": stats["best_score"],
            "selectedLevel": stats["selected_level"],
            "levelProgress": {
                "easy": stats["easy_levels_completed"], "medium": stats["medium_levels_completed"],
                "hard": stats["hard_levels_completed"], "expert": stats["expert_levels_completed"],
            },
            "stats": {
                "gamesPlayed": stats["games_played"], "gamesWon": stats["games_won"],
                "totalStars": stats["total_stars"], "totalScore": int(stats["total_score"]),
                "highestMultiplier": stats["highest_multiplier"], "totalMathGain": int(stats["total_math_gain"]),
            },
        },
    }


@app.get("/api/leaderboard")
def leaderboard(
    conn: Annotated[Connection, Depends(get_conn)],
    difficulty: str | None = None,
):
    if difficulty not in (None, "easy", "medium", "hard", "expert"):
        raise HTTPException(400, "Invalid difficulty")
    if difficulty:
        rows = conn.execute(
            """SELECT p.id AS player_id, p.display_name, MAX(r.score)::int AS best_score,
              pr.highest_multiplier, pr.games_won, p.selected_skin
              FROM game_runs r JOIN players p ON p.id = r.player_id
              JOIN player_progress pr ON pr.player_id = p.id
              WHERE r.status = 'won' AND r.difficulty = %s
              GROUP BY p.id, pr.player_id ORDER BY best_score DESC, pr.updated_at ASC LIMIT 10""",
            (difficulty,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT player_id, display_name, best_score, highest_multiplier, games_won, selected_skin FROM leaderboard ORDER BY best_score DESC, updated_at ASC LIMIT 10"
        ).fetchall()
    return {"entries": [
        {"rank": index + 1, "playerId": row["player_id"], "displayName": row["display_name"],
         "score": row["best_score"], "highestMultiplier": row["highest_multiplier"],
         "gamesWon": row["games_won"], "selectedSkin": row["selected_skin"]}
        for index, row in enumerate(rows)
    ]}


@app.get("/api/skins")
def public_skins(conn: Annotated[Connection, Depends(get_conn)]):
    rows = conn.execute("SELECT * FROM skins WHERE is_available = true ORDER BY sort_order, id").fetchall()
    return {"skins": [skin_result(row) for row in rows]}


@app.post("/api/feedback", status_code=201)
def submit_feedback(
    body: FeedbackCreate,
    conn: Annotated[Connection, Depends(get_conn)],
    player_id: Annotated[str, Depends(auth_player)],
):
    row = conn.execute(
        "INSERT INTO player_feedback (player_id, category, message) VALUES (%s,%s,%s) RETURNING id, category, message, status, created_at",
        (player_id, body.category, body.message),
    ).fetchone()
    return {"feedback": row}


@app.get("/api/admin/summary")
def admin_summary(
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(admin_player)],
):
    counts = {}
    for key, query in {
        "players": "SELECT COUNT(*)::int AS count FROM players",
        "accounts": "SELECT COUNT(*)::int AS count FROM player_accounts",
        "gameRuns": "SELECT COUNT(*)::int AS count FROM game_runs",
        "activeSessions": "SELECT COUNT(*)::int AS count FROM auth_sessions WHERE expires_at > now()",
        "activeResetTokens": "SELECT COUNT(*)::int AS count FROM password_reset_tokens WHERE used_at IS NULL AND expires_at > now()",
        "leaderboardEntries": "SELECT COUNT(*)::int AS count FROM leaderboard",
        "feedback": "SELECT COUNT(*)::int AS count FROM player_feedback",
    }.items():
        counts[key] = conn.execute(query).fetchone()["count"]
    recent = conn.execute("SELECT difficulty, level, status, score, stars, ended_at FROM game_runs ORDER BY ended_at DESC LIMIT 5").fetchall()
    return {"counts": counts, "recentRuns": recent}


@app.get("/api/admin/players")
def admin_list_players(
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(admin_player)],
    search: str = Query(default="", max_length=100),
    active: bool | None = None,
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    rows = conn.execute(
        """SELECT p.id, p.display_name, p.created_at, p.last_seen_at, a.email, a.is_active,
          COALESCE(pr.games_played,0) AS games_played, COALESCE(pr.games_won,0) AS games_won,
          COALESCE(pr.best_score,0) AS best_score,
          EXISTS(SELECT 1 FROM player_roles r WHERE r.player_id=p.id AND r.role_key='admin') AS is_admin
          FROM players p LEFT JOIN player_accounts a ON a.player_id=p.id
          LEFT JOIN player_progress pr ON pr.player_id=p.id
          WHERE (%s = '' OR p.display_name ILIKE %s OR a.email ILIKE %s OR p.id::text ILIKE %s)
            AND (%s::boolean IS NULL OR a.is_active = %s)
          ORDER BY p.created_at DESC LIMIT %s OFFSET %s""",
        (search, f"%{search}%", f"%{search}%", f"%{search}%", active, active, limit, offset),
    ).fetchall()
    return {"players": [{
        "id": row["id"], "displayName": row["display_name"], "createdAt": row["created_at"],
        "lastSeenAt": row["last_seen_at"], "email": row["email"], "isActive": row["is_active"],
        "gamesPlayed": row["games_played"], "gamesWon": row["games_won"],
        "bestScore": row["best_score"], "isAdmin": row["is_admin"],
    } for row in rows], "limit": limit, "offset": offset}


@app.patch("/api/admin/players/{target_id}")
def admin_update_player(
    target_id: UUID,
    body: PlayerUpdate,
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(admin_player)],
):
    values = body.model_dump(exclude_unset=True)
    if not values:
        raise HTTPException(400, "Provide a display name or active status to update")
    with conn.transaction():
        if "display_name" in values:
            updated = conn.execute("UPDATE players SET display_name = %s WHERE id = %s RETURNING id", (values["display_name"], str(target_id))).fetchone()
            if not updated:
                raise HTTPException(404, "Player not found")
        if "is_active" in values:
            if not values["is_active"]:
                prevent_last_admin_deactivation(conn, str(target_id))
            account = conn.execute("UPDATE player_accounts SET is_active = %s, updated_at = now() WHERE player_id = %s RETURNING player_id", (values["is_active"], str(target_id))).fetchone()
            if not account:
                raise HTTPException(404, "Registered account not found")
            if not values["is_active"]:
                conn.execute("DELETE FROM auth_sessions WHERE player_id = %s", (str(target_id),))
        add_audit(conn, actor, "player.update", "player", str(target_id), {"fields": sorted(values)})
        result = conn.execute(
            "SELECT p.id, p.display_name, a.email, a.is_active FROM players p LEFT JOIN player_accounts a ON a.player_id=p.id WHERE p.id=%s",
            (str(target_id),),
        ).fetchone()
    return {"player": {
        "id": result["id"], "displayName": result["display_name"],
        "email": result["email"], "isActive": result["is_active"],
    }}


@app.delete("/api/admin/players/{target_id}", status_code=204)
def admin_deactivate_player(
    target_id: UUID,
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(admin_player)],
):
    with conn.transaction():
        prevent_last_admin_deactivation(conn, str(target_id))
        result = conn.execute("UPDATE player_accounts SET is_active=false, updated_at=now() WHERE player_id=%s RETURNING player_id", (str(target_id),)).fetchone()
        if not result:
            raise HTTPException(404, "Registered account not found")
        conn.execute("DELETE FROM auth_sessions WHERE player_id=%s", (str(target_id),))
        add_audit(conn, actor, "player.deactivate", "player", str(target_id))
    return Response(status_code=204)


@app.get("/api/admin/runs")
def admin_list_runs(
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(admin_player)],
    search: str = Query(default="", max_length=100),
    difficulty: str | None = None,
    run_status: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    if difficulty not in (None, "easy", "medium", "hard", "expert") or run_status not in (None, "won", "lost"):
        raise HTTPException(400, "Invalid run filter")
    rows = conn.execute(
        """SELECT r.id, r.client_run_id, r.player_id, p.display_name, r.difficulty, r.level,
          r.status, r.score, r.stars, r.coins_earned, r.ended_at
          FROM game_runs r JOIN players p ON p.id=r.player_id
          WHERE (%s='' OR p.display_name ILIKE %s OR p.id::text ILIKE %s OR r.id::text ILIKE %s)
            AND (%s::text IS NULL OR r.difficulty=%s) AND (%s::text IS NULL OR r.status=%s)
          ORDER BY r.ended_at DESC LIMIT %s OFFSET %s""",
        (search, f"%{search}%", f"%{search}%", f"%{search}%", difficulty, difficulty,
         run_status, run_status, limit, offset),
    ).fetchall()
    return {"runs": [{
        "id": row["id"], "clientRunId": row["client_run_id"], "playerId": row["player_id"],
        "displayName": row["display_name"], "difficulty": row["difficulty"],
        "level": row["level"], "status": row["status"], "score": row["score"],
        "stars": row["stars"], "coinsEarned": row["coins_earned"], "endedAt": row["ended_at"],
    } for row in rows], "limit": limit, "offset": offset}


@app.get("/api/admin/skins")
def admin_list_skins(
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(admin_player)],
    search: str = Query(default="", max_length=100),
    available: bool | None = None,
):
    rows = conn.execute(
        "SELECT * FROM skins WHERE (%s='' OR name ILIKE %s OR id ILIKE %s) AND (%s::boolean IS NULL OR is_available=%s) ORDER BY sort_order,id",
        (search, f"%{search}%", f"%{search}%", available, available),
    ).fetchall()
    return {"skins": [skin_result(row) for row in rows]}


@app.post("/api/admin/skins", status_code=201)
def admin_create_skin(
    body: SkinCreate,
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(admin_player)],
):
    try:
        with conn.transaction():
            row = conn.execute(
                """INSERT INTO skins (id,name,color,price,sort_order,is_available,primary_color,
                  secondary_color,accent_color,head_color,glow_color,rarity)
                  VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                (body.id, body.name, body.primary_color, body.price, body.sort_order, body.is_available,
                 body.primary_color, body.secondary_color, body.accent_color, body.head_color, body.glow_color, body.rarity),
            ).fetchone()
            add_audit(conn, actor, "skin.create", "skin", body.id, {"name": body.name})
    except Exception as error:
        if getattr(error, "sqlstate", None) == "23505":
            raise HTTPException(409, "A skin with that ID already exists") from error
        raise
    return {"skin": skin_result(row)}


@app.patch("/api/admin/skins/{skin_id}")
def admin_update_skin(
    skin_id: str,
    body: SkinUpdate,
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(admin_player)],
):
    values = body.model_dump(exclude_unset=True)
    if not values:
        raise HTTPException(400, "Provide at least one skin property to update")
    sets = []
    params = []
    for field, value in values.items():
        column = SKIN_COLUMNS[field]
        sets.append(f"{column} = %s")
        params.append(value)
        if field == "primary_color":
            sets.append("color = %s")
            params.append(value)
    params.append(skin_id)
    with conn.transaction():
        row = conn.execute(f"UPDATE skins SET {', '.join(sets)} WHERE id=%s RETURNING *", tuple(params)).fetchone()
        if not row:
            raise HTTPException(404, "Skin not found")
        add_audit(conn, actor, "skin.update", "skin", skin_id, {"fields": sorted(values)})
    return {"skin": skin_result(row)}


@app.delete("/api/admin/skins/{skin_id}")
def admin_archive_skin(
    skin_id: str,
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(admin_player)],
):
    if skin_id == "default":
        raise HTTPException(409, "The starter skin cannot be archived")
    with conn.transaction():
        row = conn.execute("UPDATE skins SET is_available=false WHERE id=%s RETURNING *", (skin_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Skin not found")
        add_audit(conn, actor, "skin.archive", "skin", skin_id)
    return {"skin": skin_result(row), "archived": True}


@app.get("/api/admin/feedback")
def admin_list_feedback(
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(admin_player)],
    search: str = Query(default="", max_length=100),
    category: str | None = None,
    feedback_status: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    if category not in (None, "bug", "idea", "other") or feedback_status not in (None, "new", "reviewing", "accepted", "declined", "resolved"):
        raise HTTPException(400, "Invalid feedback filter")
    rows = conn.execute(
        """SELECT f.id, f.player_id, p.display_name, f.category, f.message, f.status,
          f.admin_note, f.created_at, f.updated_at FROM player_feedback f
          LEFT JOIN players p ON p.id=f.player_id
          WHERE (%s='' OR f.message ILIKE %s OR p.display_name ILIKE %s)
            AND (%s::text IS NULL OR f.category=%s) AND (%s::text IS NULL OR f.status=%s)
          ORDER BY f.created_at DESC LIMIT %s OFFSET %s""",
        (search, f"%{search}%", f"%{search}%", category, category, feedback_status,
         feedback_status, limit, offset),
    ).fetchall()
    return {"feedback": [{
        "id": row["id"], "playerId": row["player_id"], "displayName": row["display_name"],
        "category": row["category"], "message": row["message"], "status": row["status"],
        "adminNote": row["admin_note"], "createdAt": row["created_at"], "updatedAt": row["updated_at"],
    } for row in rows], "limit": limit, "offset": offset}


@app.patch("/api/admin/feedback/{feedback_id}")
def admin_update_feedback(
    feedback_id: UUID,
    body: FeedbackUpdate,
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(admin_player)],
):
    values = body.model_dump(exclude_unset=True)
    if not values:
        raise HTTPException(400, "Provide a status or note to update")
    fields = []
    params = []
    for key, value in values.items():
        fields.append(f"{('admin_note' if key == 'admin_note' else 'status')}=%s")
        params.append(value)
    params.append(str(feedback_id))
    with conn.transaction():
        row = conn.execute(f"UPDATE player_feedback SET {', '.join(fields)} WHERE id=%s RETURNING id, category, message, status, admin_note, created_at, updated_at", tuple(params)).fetchone()
        if not row:
            raise HTTPException(404, "Feedback not found")
        add_audit(conn, actor, "feedback.update", "feedback", str(feedback_id), {"fields": sorted(values)})
    return {"feedback": {
        "id": row["id"], "category": row["category"], "message": row["message"],
        "status": row["status"], "adminNote": row["admin_note"],
        "createdAt": row["created_at"], "updatedAt": row["updated_at"],
    }}


@app.delete("/api/admin/feedback/{feedback_id}", status_code=204)
def admin_delete_feedback(
    feedback_id: UUID,
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(admin_player)],
):
    with conn.transaction():
        row = conn.execute("DELETE FROM player_feedback WHERE id=%s RETURNING id", (str(feedback_id),)).fetchone()
        if not row:
            raise HTTPException(404, "Feedback not found")
        add_audit(conn, actor, "feedback.delete", "feedback", str(feedback_id))
    return Response(status_code=204)


@app.get("/api/admin/audit")
def admin_audit(
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(admin_player)],
    search: str = Query(default="", max_length=100),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    rows = conn.execute(
        """SELECT l.id, l.actor_player_id, p.display_name AS actor_name, l.action,
          l.entity_type, l.entity_id, l.details, l.created_at FROM audit_log l
          LEFT JOIN players p ON p.id=l.actor_player_id
          WHERE (%s='' OR l.action ILIKE %s OR l.entity_type ILIKE %s OR l.entity_id ILIKE %s)
          ORDER BY l.created_at DESC LIMIT %s OFFSET %s""",
        (search, f"%{search}%", f"%{search}%", f"%{search}%", limit, offset),
    ).fetchall()
    return {"events": [{
        "id": row["id"], "actorPlayerId": row["actor_player_id"], "actorName": row["actor_name"],
        "action": row["action"], "entityType": row["entity_type"], "entityId": row["entity_id"],
        "details": row["details"], "createdAt": row["created_at"],
    } for row in rows], "limit": limit, "offset": offset}


@app.put("/api/admin/players/{target_id}/roles/admin")
def grant_admin_role(
    target_id: UUID,
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(admin_player)],
):
    with conn.transaction():
        if not conn.execute("SELECT 1 FROM player_accounts WHERE player_id=%s AND is_active=true", (str(target_id),)).fetchone():
            raise HTTPException(404, "Active registered account not found")
        conn.execute("INSERT INTO player_roles (player_id,role_key) VALUES (%s,'admin') ON CONFLICT DO NOTHING", (str(target_id),))
        add_audit(conn, actor, "role.grant", "player", str(target_id), {"role": "admin"})
    return {"playerId": str(target_id), "role": "admin"}


@app.delete("/api/admin/players/{target_id}/roles/admin")
def revoke_admin_role(
    target_id: UUID,
    conn: Annotated[Connection, Depends(get_conn)],
    actor: Annotated[str, Depends(admin_player)],
):
    with conn.transaction():
        count = conn.execute("SELECT COUNT(*)::int AS count FROM player_roles WHERE role_key='admin'").fetchone()["count"]
        if count <= 1 and str(target_id) == actor:
            raise HTTPException(409, "The final administrator role cannot be removed")
        row = conn.execute("DELETE FROM player_roles WHERE player_id=%s AND role_key='admin' RETURNING player_id", (str(target_id),)).fetchone()
        if not row:
            raise HTTPException(404, "Administrator role not found")
        add_audit(conn, actor, "role.revoke", "player", str(target_id), {"role": "admin"})
    return {"playerId": str(target_id), "role": "player"}

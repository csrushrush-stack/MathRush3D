import hashlib
import os
import secrets
from datetime import datetime, timezone

import bcrypt
from fastapi import HTTPException, Request, Response, status
from psycopg import Connection

SESSION_COOKIE = "math_rush_session"
SESSION_DAYS = 30


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))
    except (ValueError, TypeError):
        return False


def create_session(conn: Connection, player_id: str, response: Response) -> str:
    token = secrets.token_urlsafe(48)
    conn.execute(
        "INSERT INTO auth_sessions (player_id, token_hash, expires_at) VALUES (%s, %s, now() + interval '30 days')",
        (player_id, hash_token(token)),
    )
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        secure=(os.environ.get("NODE_ENV") == "production"),
        samesite="lax",
        max_age=SESSION_DAYS * 24 * 60 * 60,
        path="/",
    )
    return token


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="lax")


def current_player(request: Request, conn: Connection) -> str:
    authorization = request.headers.get("authorization", "")
    token = request.cookies.get(SESSION_COOKIE)
    if authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Please sign in to continue")
    row = conn.execute(
        """
        UPDATE auth_sessions s SET last_used_at = now()
        FROM player_accounts a
        WHERE s.token_hash = %s AND s.expires_at > now()
          AND a.player_id = s.player_id AND a.is_active = true
        RETURNING s.player_id
        """,
        (hash_token(token),),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Please sign in to continue")
    return str(row["player_id"])


def require_admin(conn: Connection, player_id: str) -> None:
    row = conn.execute(
        "SELECT 1 FROM player_roles WHERE player_id = %s AND role_key = 'admin'",
        (player_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=403, detail="Administrator access is required")


def hash_reset_token(token: str) -> str:
    return hash_token(token)


def new_reset_token() -> str:
    return secrets.token_hex(32)


def send_reset_email(email: str, reset_url: str) -> bool:
    import json
    import os
    from urllib.request import Request as UrlRequest, urlopen

    api_key = os.environ.get("RESEND_API_KEY")
    sender = os.environ.get("PASSWORD_RESET_FROM_EMAIL")
    if not api_key or not sender:
        return False
    body = json.dumps({
        "from": sender,
        "to": [email],
        "subject": "Reset your Math Rush 3D password",
        "html": f"<p>A password reset was requested.</p><p><a href=\"{reset_url}\">Reset password</a></p><p>This link expires in 15 minutes. If this was not you, ignore this email.</p>",
        "text": f"Reset your Math Rush 3D password: {reset_url}\n\nThis link expires in 15 minutes. If this was not you, ignore this email.",
    }).encode("utf-8")
    request = UrlRequest(
        "https://api.resend.com/emails",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Idempotency-Key": f"password-reset-{hash_reset_token(reset_url)}",
        },
        method="POST",
    )
    with urlopen(request, timeout=15) as response:
        if response.status < 200 or response.status >= 300:
            raise RuntimeError(f"Password-reset email provider returned {response.status}")
    return True


def reset_url(token: str) -> str:
    import os
    from urllib.parse import urlencode

    origin = (
        os.environ.get("PUBLIC_APP_URL")
        or os.environ.get("CLIENT_ORIGIN", "http://localhost:5173").split(",")[0].strip()
    ).rstrip("/")
    return f"{origin}/reset-password?{urlencode({'token': token})}"


def token_expired(value: datetime) -> bool:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value <= datetime.now(timezone.utc)

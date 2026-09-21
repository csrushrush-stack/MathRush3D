import os
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app


@pytest.fixture
def api_client(monkeypatch):
    database_url = os.environ.get("MATHRUSH_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("Set MATHRUSH_TEST_DATABASE_URL to an isolated disposable PostgreSQL database")
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("NODE_ENV", "test")
    with TestClient(app) as client:
        yield client


def register(client: TestClient, label: str):
    suffix = uuid4().hex[:12]
    response = client.post("/api/auth/register", json={
        "displayName": f"{label} Player",
        "email": f"{label}-{suffix}@example.test",
        "password": "Test-Password-42",
        "deviceId": f"device_{uuid4()}",
    })
    assert response.status_code == 201, response.text
    return response.json()["profile"], f"{label}-{suffix}@example.test"


def test_player_account_and_run_flow_with_idempotent_submission(api_client):
    profile, _email = register(api_client, "runner")
    assert api_client.get("/api/auth/me").status_code == 200
    run_id = str(uuid4())
    payload = {
        "clientRunId": run_id,
        "playerId": profile["id"],
        "difficulty": "easy",
        "level": 1,
        "status": "won",
        "startedAt": "2026-09-21T08:00:00Z",
        "endedAt": "2026-09-21T08:01:00Z",
        "distance": 100,
        "startingCrowd": 1,
        "crowdAtBoss": 8,
        "endingCrowd": 4,
        "bossHealth": 0,
        "multiplier": 2,
        "stars": 1,
        "mathGain": 9,
        "maxMathGain": 10,
        "bonusPoints": 15,
        "clientVersion": "test",
        "gateEvents": [{
            "gateIndex": 0, "worldZ": -20, "leftExpression": "+2", "rightExpression": "×2",
            "chosenSide": "left", "chosenDelta": 2, "optimalDelta": 2,
            "crowdBefore": 1, "crowdAfter": 3,
        }],
        "obstacleEvents": [{
            "obstacleIndex": 0, "worldZ": -40, "obstacleType": "wall", "outcome": "hit",
            "crowdBefore": 3, "crowdAfter": 2, "damage": 1,
        }],
    }
    first = api_client.post("/api/runs", json=payload)
    assert first.status_code == 201, first.text
    assert first.json()["player"]["stats"]["gamesPlayed"] == 1
    duplicate = api_client.post("/api/runs", json=payload)
    assert duplicate.status_code == 200
    assert duplicate.json()["duplicate"] is True
    assert api_client.get("/api/leaderboard?difficulty=easy").status_code == 200


def test_admin_rbac_feedback_skin_crud_search_and_audit(api_client):
    admin_profile, admin_email = register(api_client, "admin")
    player_profile, player_email = register(api_client, "learner")
    database_url = os.environ["MATHRUSH_TEST_DATABASE_URL"]
    with psycopg.connect(database_url) as conn:
        # Keep this assertion independent from administrator records left by
        # earlier runs of the same explicitly disposable test database.
        conn.execute("DELETE FROM player_roles WHERE role_key='admin'")
        conn.execute(
            "INSERT INTO player_roles (player_id,role_key) VALUES (%s,'admin')",
            (admin_profile["id"],),
        )

    admin_client = TestClient(api_client.app)
    admin_login = admin_client.post("/api/auth/login", json={"email": admin_email, "password": "Test-Password-42"})
    assert admin_login.status_code == 200
    player_client = TestClient(api_client.app)
    player_login = player_client.post("/api/auth/login", json={"email": player_email, "password": "Test-Password-42"})
    assert player_login.status_code == 200
    assert player_client.get("/api/admin/summary").status_code == 403

    feedback = player_client.post("/api/feedback", json={"category": "idea", "message": "Please add a science practice mode."})
    assert feedback.status_code == 201, feedback.text
    feedback_id = feedback.json()["feedback"]["id"]
    feedback_list = admin_client.get("/api/admin/feedback?search=science&status=new")
    assert feedback_list.status_code == 200
    assert any(str(item["id"]) == feedback_id for item in feedback_list.json()["feedback"])
    updated_feedback = admin_client.patch(f"/api/admin/feedback/{feedback_id}", json={"status": "reviewing", "adminNote": "Added to review queue."})
    assert updated_feedback.status_code == 200
    assert updated_feedback.json()["feedback"]["status"] == "reviewing"

    skin_id = f"test_{uuid4().hex[:8]}"
    skin_body = {
        "id": skin_id, "name": "Test Spark", "primaryColor": "#11aaee",
        "secondaryColor": "#223344", "accentColor": "#aabbcc", "headColor": "#ddeeff",
        "glowColor": "#224466", "price": 125, "rarity": "Rare", "sortOrder": 50,
    }
    created_skin = admin_client.post("/api/admin/skins", json=skin_body)
    assert created_skin.status_code == 201, created_skin.text
    assert created_skin.json()["skin"]["primary"] == "#11aaee"
    assert any(item["id"] == skin_id for item in admin_client.get("/api/skins").json()["skins"])
    changed_skin = admin_client.patch(f"/api/admin/skins/{skin_id}", json={"price": 250, "name": "Test Spark Plus"})
    assert changed_skin.status_code == 200
    assert changed_skin.json()["skin"]["price"] == 250
    archived = admin_client.delete(f"/api/admin/skins/{skin_id}")
    assert archived.status_code == 200
    assert all(item["id"] != skin_id for item in admin_client.get("/api/skins").json()["skins"])

    player_update = admin_client.patch(f"/api/admin/players/{player_profile['id']}", json={"displayName": "Learner Updated"})
    assert player_update.status_code == 200
    assert player_update.json()["player"]["displayName"] == "Learner Updated"
    assert admin_client.get("/api/admin/players?search=Learner%20Updated").json()["players"]
    assert admin_client.get("/api/admin/audit?search=skin").json()["events"]
    last_admin = admin_client.delete(f"/api/admin/players/{admin_profile['id']}")
    assert last_admin.status_code == 409


def test_request_validation_is_readable_and_admin_endpoint_is_not_public(api_client):
    invalid = api_client.post("/api/auth/register", json={"displayName": "x", "email": "bad", "password": "x", "deviceId": "x"})
    assert invalid.status_code == 400
    assert invalid.json()["error"] == "Invalid request"
    assert api_client.get("/api/admin/summary").status_code == 401


def test_api_responses_include_security_headers(api_client):
    response = api_client.get("/api/health")
    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["cache-control"] == "no-store"


def test_password_reset_is_single_use_revokes_sessions_and_accepts_new_password(api_client):
    _profile, email = register(api_client, "reset")
    reset_request = api_client.post("/api/auth/forgot-password", json={"email": email})
    assert reset_request.status_code == 200
    assert reset_request.json()["message"] == "If that email is registered, a password reset link has been prepared."
    reset_link = reset_request.json()["resetUrl"]
    token = parse_qs(urlparse(reset_link).query)["token"][0]
    changed = api_client.post("/api/auth/reset-password", json={"token": token, "password": "New-Password-56"})
    assert changed.status_code == 200
    assert api_client.get("/api/auth/me").status_code == 401
    assert api_client.post("/api/auth/reset-password", json={"token": token, "password": "Other-Password-78"}).status_code == 400
    fresh_client = TestClient(api_client.app)
    assert fresh_client.post("/api/auth/login", json={"email": email, "password": "Test-Password-42"}).status_code == 401
    assert fresh_client.post("/api/auth/login", json={"email": email, "password": "New-Password-56"}).status_code == 200

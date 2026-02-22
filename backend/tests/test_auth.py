# backend/tests/test_auth.py
"""
Tests for /api/v1/auth/* endpoints.

Coverage:
  POST /auth/register  – success, duplicate email, default-category seeding
  POST /auth/login     – valid credentials, wrong password, unknown user
  GET  /auth/me        – valid token, no token, invalid token
"""

# ── register ─────────────────────────────────────────────────────────────────


def test_register_returns_user_data(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "alice@example.com", "password": "password123", "name": "Alice"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "alice@example.com"
    assert body["name"] == "Alice"
    assert body["is_active"] is True
    assert "id" in body
    assert "hashed_password" not in body  # password must not be leaked


def test_register_seeds_17_default_categories(client):
    """Registration must automatically create 7 income + 10 expense defaults."""
    client.post(
        "/api/v1/auth/register",
        json={"email": "alice@example.com", "password": "password123", "name": "Alice"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@example.com", "password": "password123"},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    cats = client.get("/api/v1/categories/", headers=headers).json()

    assert len(cats) == 17
    assert all(c["is_default"] for c in cats)
    income_count = sum(1 for c in cats if c["type"] == "income")
    expense_count = sum(1 for c in cats if c["type"] == "expense")
    assert income_count == 7
    assert expense_count == 10


def test_register_duplicate_email_returns_400(client, registered_user):
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": registered_user["email"],
            "password": "different123",
            "name": "Duplicate",
        },
    )
    assert resp.status_code == 400
    assert "already registered" in resp.json()["detail"]


# ── login ─────────────────────────────────────────────────────────────────────


def test_login_returns_bearer_token(client, registered_user):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password_returns_401(client, registered_user):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": "wrongpass"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid credentials"


def test_login_unknown_email_returns_401(client):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "password123"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid credentials"


# ── /me ───────────────────────────────────────────────────────────────────────


def test_get_me_returns_current_user(client, registered_user, auth_headers):
    resp = client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == registered_user["email"]
    assert resp.json()["name"] == registered_user["name"]


def test_get_me_without_token_returns_403(client):
    """HTTPBearer raises 403 when the Authorization header is absent."""
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 403


def test_get_me_with_invalid_token_returns_401(client):
    resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer this.is.not.a.valid.jwt"},
    )
    assert resp.status_code == 401
    assert "Invalid or expired token" in resp.json()["detail"]

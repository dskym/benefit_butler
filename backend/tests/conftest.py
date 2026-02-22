# backend/tests/conftest.py
#
# Environment variables MUST be set before any app import so that
# pydantic-settings picks up the test database URL instead of the one in .env.
import os

os.environ["DATABASE_URL"] = (
    "postgresql://benefit:benefit@localhost:5432/benefit_butler_test"
)
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-for-hs256")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import Base, engine  # engine already uses the test URL

# ── Database lifecycle ────────────────────────────────────────────────────────


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create all tables once before the test session; drop them afterwards."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def clean_tables():
    """Delete every row in every table after each test for isolation."""
    yield
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


# ── HTTP client ───────────────────────────────────────────────────────────────


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


# ── Auth helpers ──────────────────────────────────────────────────────────────

USER_PAYLOAD = {
    "email": "user@example.com",
    "password": "password123",
    "name": "Test User",
}


@pytest.fixture
def registered_user(client):
    """Register the default test user and return their credentials."""
    resp = client.post("/api/v1/auth/register", json=USER_PAYLOAD)
    assert resp.status_code == 201, resp.text
    return USER_PAYLOAD


@pytest.fixture
def auth_headers(client, registered_user):
    """Log in as the default test user and return the Authorization header."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def register_and_login(client, email: str, password: str = "password123", name: str = "Other User") -> dict:
    """Helper: register a fresh user and return their auth headers."""
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "name": name},
    )
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}

# backend/tests/conftest.py
#
# Testcontainers approach: a throw-away PostgreSQL container is started before
# the test session and stopped when the process exits.  No pre-created database
# is required – the only prerequisite is a running Docker daemon.
import atexit
import os
from pathlib import Path

import pytest

# ── Docker socket auto-detection ──────────────────────────────────────────────
# macOS Docker Desktop exposes the socket at a non-standard path.
# If DOCKER_HOST isn't already set, try to locate the socket automatically.
if not os.getenv("DOCKER_HOST"):
    _candidates = [
        Path.home() / ".docker" / "run" / "docker.sock",  # Docker Desktop 4.13+
        Path("/var/run/docker.sock"),                       # Linux / older macOS
    ]
    for _sock in _candidates:
        if _sock.exists():
            os.environ["DOCKER_HOST"] = f"unix://{_sock}"
            break

# Disable the Ryuk resource-reaper container; it can fail to start in
# local Docker Desktop environments.
os.environ.setdefault("TESTCONTAINERS_RYUK_DISABLED", "true")

# ── Start PostgreSQL container ────────────────────────────────────────────────
# The container must be running BEFORE we import the FastAPI app so that
# pydantic-settings can read DATABASE_URL from the environment at import time.
from testcontainers.postgres import PostgresContainer  # noqa: E402

_pg = PostgresContainer("postgres:16-alpine")
_pg.start()

os.environ["DATABASE_URL"] = _pg.get_connection_url()
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-for-hs256")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")

atexit.register(_pg.stop)

# ── App import (after DATABASE_URL is in the environment) ─────────────────────
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.core.database import Base, engine  # noqa: E402

# ── Database lifecycle ────────────────────────────────────────────────────────


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create all tables once before the session; drop them when it ends."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def clean_tables():
    """Truncate every table after each test to guarantee isolation."""
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
    """Log in and return the Authorization header dict."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def register_and_login(
    client,
    email: str,
    password: str = "password123",
    name: str = "Other User",
) -> dict:
    """Helper used by isolation tests: register a second user and return their headers."""
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "name": name},
    )
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}

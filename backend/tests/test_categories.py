# backend/tests/test_categories.py
"""
Tests for /api/v1/categories/* endpoints.

Coverage:
  GET    /categories/           – lists user categories (incl. defaults)
  POST   /categories/           – create, category limit (30)
  GET    /categories/{id}       – found, not found, other-user isolation
  PUT    /categories/{id}       – update, forbidden on default
  DELETE /categories/{id}       – delete, forbidden on default
"""

from tests.conftest import register_and_login

# ── helpers ───────────────────────────────────────────────────────────────────

CATEGORY_PAYLOAD = {"name": "테스트지출", "type": "expense", "color": "#FF5733"}


def create_category(client, headers, payload=None):
    resp = client.post("/api/v1/categories/", headers=headers, json=payload or CATEGORY_PAYLOAD)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── list ──────────────────────────────────────────────────────────────────────


def test_list_categories_returns_defaults_after_register(client, auth_headers):
    resp = client.get("/api/v1/categories/", headers=auth_headers)
    assert resp.status_code == 200
    categories = resp.json()
    # 17 defaults seeded on registration
    assert len(categories) == 17


def test_list_categories_default_categories_appear_first(client, auth_headers):
    """Default categories must be sorted before user-created ones."""
    create_category(client, auth_headers)
    resp = client.get("/api/v1/categories/", headers=auth_headers)
    categories = resp.json()
    first_non_default = next((i for i, c in enumerate(categories) if not c["is_default"]), None)
    last_default = max((i for i, c in enumerate(categories) if c["is_default"]), default=-1)
    assert last_default < first_non_default  # all defaults come before user categories


def test_list_categories_only_returns_own_categories(client, auth_headers):
    """A second user must not see the first user's categories."""
    headers2 = register_and_login(client, "user2@example.com")
    resp = client.get("/api/v1/categories/", headers=headers2)
    # user2 only sees their own 17 seeded defaults
    assert len(resp.json()) == 17


# ── create ────────────────────────────────────────────────────────────────────


def test_create_category_returns_201_with_data(client, auth_headers):
    resp = client.post("/api/v1/categories/", headers=auth_headers, json=CATEGORY_PAYLOAD)
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == CATEGORY_PAYLOAD["name"]
    assert body["type"] == CATEGORY_PAYLOAD["type"]
    assert body["color"] == CATEGORY_PAYLOAD["color"]
    assert body["is_default"] is False


def test_create_category_without_color(client, auth_headers):
    resp = client.post(
        "/api/v1/categories/",
        headers=auth_headers,
        json={"name": "기타", "type": "income"},
    )
    assert resp.status_code == 201
    assert resp.json()["color"] is None


def test_create_category_at_limit_returns_400(client, auth_headers):
    """30 expense categories already exist after seeding (10 defaults).
    Create 20 more to reach 30, then verify the 31st is rejected."""
    for i in range(20):
        resp = client.post(
            "/api/v1/categories/",
            headers=auth_headers,
            json={"name": f"지출{i}", "type": "expense"},
        )
        assert resp.status_code == 201

    resp = client.post(
        "/api/v1/categories/",
        headers=auth_headers,
        json={"name": "초과지출", "type": "expense"},
    )
    assert resp.status_code == 400
    assert "30" in resp.json()["detail"]


# ── get ───────────────────────────────────────────────────────────────────────


def test_get_category_by_id(client, auth_headers):
    created = create_category(client, auth_headers)
    resp = client.get(f"/api/v1/categories/{created['id']}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_get_category_not_found_returns_404(client, auth_headers):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = client.get(f"/api/v1/categories/{fake_id}", headers=auth_headers)
    assert resp.status_code == 404


def test_get_category_other_user_returns_404(client, auth_headers):
    """User 2 must not be able to read User 1's category."""
    created = create_category(client, auth_headers)
    headers2 = register_and_login(client, "user2@example.com")
    resp = client.get(f"/api/v1/categories/{created['id']}", headers=headers2)
    assert resp.status_code == 404


# ── update ────────────────────────────────────────────────────────────────────


def test_update_category_name_and_color(client, auth_headers):
    created = create_category(client, auth_headers)
    resp = client.put(
        f"/api/v1/categories/{created['id']}",
        headers=auth_headers,
        json={"name": "변경된이름", "color": "#000000"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "변경된이름"
    assert resp.json()["color"] == "#000000"


def test_update_default_category_returns_403(client, auth_headers):
    """Default categories must be immutable."""
    categories = client.get("/api/v1/categories/", headers=auth_headers).json()
    default = next(c for c in categories if c["is_default"])
    resp = client.put(
        f"/api/v1/categories/{default['id']}",
        headers=auth_headers,
        json={"name": "수정불가"},
    )
    assert resp.status_code == 403
    assert "수정" in resp.json()["detail"]


# ── delete ────────────────────────────────────────────────────────────────────


def test_delete_category_returns_204(client, auth_headers):
    created = create_category(client, auth_headers)
    resp = client.delete(f"/api/v1/categories/{created['id']}", headers=auth_headers)
    assert resp.status_code == 204
    # Verify it's gone
    resp2 = client.get(f"/api/v1/categories/{created['id']}", headers=auth_headers)
    assert resp2.status_code == 404


def test_delete_default_category_returns_403(client, auth_headers):
    """Default categories must not be deletable."""
    categories = client.get("/api/v1/categories/", headers=auth_headers).json()
    default = next(c for c in categories if c["is_default"])
    resp = client.delete(f"/api/v1/categories/{default['id']}", headers=auth_headers)
    assert resp.status_code == 403
    assert "삭제" in resp.json()["detail"]

"""Backend API tests for Benita ERP - root, status, ai/insights."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://7bf1a137-2088-48b1-b00c-f71e85d1e26a.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- root endpoint ---
def test_root(client):
    r = client.get(f"{API}/", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert "message" in data
    assert data.get("status") == "ok"


# --- status endpoints ---
def test_status_create_and_list(client):
    payload = {"client_name": "TEST_pytest_client"}
    r = client.post(f"{API}/status", json=payload, timeout=20)
    assert r.status_code == 200
    obj = r.json()
    assert obj["client_name"] == "TEST_pytest_client"
    assert "id" in obj and "timestamp" in obj

    r2 = client.get(f"{API}/status", timeout=20)
    assert r2.status_code == 200
    rows = r2.json()
    assert isinstance(rows, list)
    assert any(x.get("client_name") == "TEST_pytest_client" for x in rows)
    # ensure no mongo _id leakage
    for row in rows:
        assert "_id" not in row


# --- ai insights ---
def test_ai_insights_default(client):
    payload = {"tenantName": "Demo School", "stats": {"students": 540, "attendance": 92}, "locale": "en"}
    r = client.post(f"{API}/ai/insights", json=payload, timeout=90)
    assert r.status_code == 200
    data = r.json()
    assert "insights" in data
    assert isinstance(data["insights"], list)
    assert len(data["insights"]) == 3
    assert all(isinstance(x, str) and len(x) > 0 for x in data["insights"])
    assert "generated" in data and isinstance(data["generated"], bool)


def test_ai_insights_telugu_locale(client):
    payload = {"tenantName": "Demo School", "stats": {"students": 100}, "locale": "te"}
    r = client.post(f"{API}/ai/insights", json=payload, timeout=90)
    assert r.status_code == 200
    data = r.json()
    assert len(data["insights"]) == 3


def test_ai_insights_empty_payload(client):
    r = client.post(f"{API}/ai/insights", json={}, timeout=90)
    assert r.status_code == 200
    data = r.json()
    assert len(data["insights"]) == 3

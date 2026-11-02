from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.calc import xirr
from app.config import settings
from app.main import app
from app.security import totp_now

c = TestClient(app)


def login_demo():
    r = c.post("/api/v1/auth/login", json={"email": "demo@pf360.dev", "password": "Demo@12345"})
    assert r.status_code == 200 and r.json()["mfa_required"]
    r = c.post("/api/v1/auth/mfa/verify", json={"mfa_token": r.json()["mfa_token"],
                                                 "code": totp_now(settings.demo_totp_secret)})
    assert r.status_code == 200, r.text
    return r.json()


def auth(t):
    return {"Authorization": f"Bearer {t['access_token']}"}


def test_xirr_known_values():
    # 10,000 invested, 11,000 back exactly one year (365 days) later -> 10%
    assert xirr([(date(2025, 1, 1), -10000), (date(2026, 1, 1), 11000)]) == pytest.approx(0.10, abs=1e-6)
    # Losses work too
    assert xirr([(date(2025, 1, 1), -10000), (date(2026, 1, 1), 9000)]) == pytest.approx(-0.10, abs=1e-6)


def test_wrong_password_and_mfa():
    assert c.post("/api/v1/auth/login", json={"email": "demo@pf360.dev", "password": "nope"}).status_code == 401
    r = c.post("/api/v1/auth/login", json={"email": "demo@pf360.dev", "password": "Demo@12345"})
    bad = c.post("/api/v1/auth/mfa/verify", json={"mfa_token": r.json()["mfa_token"], "code": "000000"})
    assert bad.status_code == 401 and bad.json()["error"]["code"] == "invalid_mfa_code"


def test_protected_requires_token():
    assert c.get("/api/v1/dashboard").status_code == 401


def test_dashboard_is_demo_and_consistent():
    t = login_demo()
    d = c.get("/api/v1/dashboard", headers=auth(t)).json()
    assert d["is_demo"] is True
    tot = d["data"]["totals"]
    assets = tot["bank"] + tot["demat"] + tot["mutual_funds"] + tot["fixed_deposits"] + tot["retirement"]
    assert d["data"]["net_worth"] == pytest.approx(assets - tot["liabilities"], abs=0.05)
    assert c.get("/api/v1/investments/mutual-funds", headers=auth(t)).json()["data"]["totals"]["xirr_pct"] > 0


def test_refresh_rotation_and_reuse_detection():
    t = login_demo()
    r1 = c.post("/api/v1/auth/refresh", json={"refresh_token": t["refresh_token"]})
    assert r1.status_code == 200
    new = r1.json()
    assert new["refresh_token"] != t["refresh_token"]
    # replaying the old token revokes the session
    r2 = c.post("/api/v1/auth/refresh", json={"refresh_token": t["refresh_token"]})
    assert r2.status_code == 401 and r2.json()["error"]["code"] == "refresh_token_reused"
    assert c.get("/api/v1/me", headers=auth(new)).status_code == 401


def test_logout_revokes():
    t = login_demo()
    assert c.post("/api/v1/auth/logout", json={"refresh_token": t["refresh_token"]}).status_code == 204
    assert c.get("/api/v1/me", headers=auth(t)).status_code == 401


def test_register_new_user_gets_empty_data():
    r = c.post("/api/v1/auth/register", json={"full_name": "Test User", "email": "t1@example.com",
                                               "phone": "+919876543210", "password": "Str0ng!Passw0rd"})
    assert r.status_code == 201
    secret = r.json()["mfa_setup"]["secret"]
    r = c.post("/api/v1/auth/login", json={"email": "t1@example.com", "password": "Str0ng!Passw0rd"})
    t = c.post("/api/v1/auth/mfa/verify", json={"mfa_token": r.json()["mfa_token"], "code": totp_now(secret)}).json()
    d = c.get("/api/v1/dashboard", headers=auth(t)).json()
    assert d["is_demo"] is False and d["data"]["net_worth"] == 0
    assert c.get("/api/v1/banks/accounts", headers=auth(t)).json()["data"] == []


def test_pan_validation_and_masking():
    t = login_demo()
    assert c.put("/api/v1/me/pan", headers=auth(t), json={"pan": "BAD"}).status_code == 422
    r = c.put("/api/v1/me/pan", headers=auth(t), json={"pan": "abcde9876f"})
    assert r.json()["pan_masked"] == "XXXXX9876F"


def test_consent_lifecycle():
    t = login_demo()
    cs = c.get("/api/v1/aa/consents", headers=auth(t)).json()["data"]
    cid = cs[0]["id"]
    assert c.post(f"/api/v1/aa/consents/{cid}/pause", headers=auth(t)).json()["status"] == "PAUSED"
    assert c.post(f"/api/v1/aa/consents/{cid}/resume", headers=auth(t)).json()["status"] == "ACTIVE"


def test_reports():
    t = login_demo()
    m = c.get("/api/v1/reports/monthly?month=2026-10", headers=auth(t)).json()["data"]
    assert m["income_total"] > 0 and m["expense_total"] > 0
    a = c.get("/api/v1/reports/annual?year=2026", headers=auth(t)).json()["data"]
    assert len(a["months"]) == 12


def test_password_reset_flow():
    c.post("/api/v1/auth/register", json={"full_name": "Reset User", "email": "r1@example.com",
                                          "phone": "+919876543211", "password": "Str0ng!Passw0rd"})
    code = c.post("/api/v1/auth/password/forgot", json={"email": "r1@example.com"}).json()["dev_reset_code"]
    r = c.post("/api/v1/auth/password/reset", json={"email": "r1@example.com", "code": code, "new_password": "N3w!Passw0rd!"})
    assert r.status_code == 200
    assert c.post("/api/v1/auth/login", json={"email": "r1@example.com", "password": "N3w!Passw0rd!"}).status_code == 200

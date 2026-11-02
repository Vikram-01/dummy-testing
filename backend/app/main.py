"""
Personal Finance 360 — reference FastAPI backend (API v1).

This is a working reference implementation of the contract in docs/API.md. It handles real
authentication (scrypt passwords, TOTP MFA, short-lived JWT access tokens, rotating refresh
tokens with reuse detection) but serves FINANCIAL DATA FROM A DEMO FIXTURE. It is not connected
to any Account Aggregator, bank, depository, AMC/RTA, EPFO, NPS CRA or insurer. Every financial
response carries "is_demo": true. New users get empty data so empty states can be tested.

Storage is in memory: restart = data reset. Replace the stores with a database before real use.
"""
from __future__ import annotations

import base64
import json
import logging
import re
import secrets
import time
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Annotated, Literal

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.config import settings
from app.security import (SessionStore, create_access_token, create_mfa_token, decode_access_token,
                          decode_mfa_token, hash_password, verify_password, verify_totp)

log = logging.getLogger("pf360")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

FIXTURE = json.loads((Path(__file__).parent / "demo" / "demo_fixture.json").read_text())
PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")

app = FastAPI(title="Personal Finance 360 API", version="1.0.0",
              description="Reference backend. Financial data is DEMO data.")


# ================================================================ stores (in memory)
class User(BaseModel):
    id: str
    full_name: str
    email: str
    phone: str
    password_hash: str
    totp_secret: str
    pan_last5: str | None = None   # only the visible part of the masked PAN is kept in this reference
    is_demo: bool = False
    created_at: str


USERS: dict[str, User] = {}
EMAIL_INDEX: dict[str, str] = {}
SESSIONS = SessionStore()
RESET_CODES: dict[str, tuple[str, float]] = {}
LOGIN_FAILS: dict[str, list[float]] = {}
NOTIF: dict[str, dict] = {}
PRIVACY: dict[str, dict] = {}
CONSENTS: dict[str, list[dict]] = {}
SYNC: dict[str, dict] = {}
PUSH_TOKENS: dict[str, set[str]] = {}

DEFAULT_NOTIF = {"policy_renewals": True, "emi_due": True, "card_due": True, "sync_failures": True,
                 "maturity_alerts": True, "weekly_summary": False}
DEFAULT_PRIVACY = {"hide_balances_on_launch": False, "analytics_opt_in": False, "crash_reports_opt_in": True}


def _new_user(full_name: str, email: str, phone: str, password: str, is_demo=False, totp: str | None = None) -> User:
    u = User(id="usr_" + uuid.uuid4().hex[:12], full_name=full_name, email=email.lower(), phone=phone,
             password_hash=hash_password(password),
             totp_secret=totp or base64.b32encode(secrets.token_bytes(10)).decode().rstrip("="),
             is_demo=is_demo, created_at=datetime.now(timezone.utc).isoformat())
    USERS[u.id] = u
    EMAIL_INDEX[u.email] = u.id
    NOTIF[u.id] = dict(DEFAULT_NOTIF)
    PRIVACY[u.id] = dict(DEFAULT_PRIVACY)
    CONSENTS[u.id] = [dict(c) for c in FIXTURE["consents"]] if is_demo else []
    SYNC[u.id] = dict(FIXTURE["dashboard"]["sync"]) if is_demo else {
        "status": "never", "last_synced_at": None, "institutions_ok": 0, "institutions_failed": 0, "items": []}
    return u


if settings.demo_enabled:
    demo = _new_user("Demo User", "demo@pf360.dev", "+910000004321", "Demo@12345", is_demo=True,
                     totp=settings.demo_totp_secret)
    demo.pan_last5 = "1234X"


# ================================================================ helpers
def err(status: int, code: str, message: str):
    raise HTTPException(status_code=status, detail={"code": code, "message": message})


@app.exception_handler(HTTPException)
async def http_exc(_: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "error", "message": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content={"error": detail}, headers=exc.headers)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    start = time.time()
    resp = await call_next(request)
    resp.headers["Cache-Control"] = "no-store"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # Log path + status only. Never log bodies, tokens or query strings (may contain account ids).
    log.info("%s %s %s %.0fms", request.method, request.url.path, resp.status_code, (time.time() - start) * 1000)
    return resp


def current_user(authorization: Annotated[str | None, Header()] = None) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        err(401, "unauthenticated", "Missing bearer token")
    try:
        data = decode_access_token(authorization[7:])
    except jwt.ExpiredSignatureError:
        err(401, "token_expired", "Access token expired")
    except jwt.InvalidTokenError:
        err(401, "invalid_token", "Invalid access token")
    if data.get("typ") != "access" or not SESSIONS.is_active(data["sid"]):
        err(401, "session_revoked", "Session is no longer active")
    u = USERS.get(data["sub"])
    if not u:
        err(401, "invalid_token", "Unknown user")
    u.__dict__["_sid"] = data["sid"]
    return u


CurrentUser = Annotated[User, Depends(current_user)]


def demo_or_empty(u: User, key: str, empty):
    data = FIXTURE[key] if u.is_demo else empty
    return data


def wrap(u: User, payload) -> dict:
    return {"is_demo": u.is_demo, "as_of": FIXTURE["as_of"] if u.is_demo else date.today().isoformat(), "data": payload}


def token_pair(u: User, device_name: str) -> dict:
    s, refresh = SESSIONS.create(u.id, device_name)
    return {"token_type": "Bearer", "access_token": create_access_token(u.id, s.id),
            "expires_in": settings.access_ttl_seconds, "refresh_token": refresh,
            "refresh_expires_in": settings.refresh_ttl_seconds, "session_id": s.id}


def mask_pan(last5: str | None) -> str | None:
    return ("XXXXX" + last5) if last5 else None


# ================================================================ schemas
class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    phone: str = Field(pattern=r"^\+91[6-9]\d{9}$")
    password: str = Field(min_length=10, max_length=128)

    @field_validator("password")
    @classmethod
    def strong(cls, v: str) -> str:
        if not (re.search(r"[A-Z]", v) and re.search(r"[a-z]", v) and re.search(r"\d", v) and re.search(r"[^\w\s]", v)):
            raise ValueError("Password needs upper, lower, digit and symbol")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str
    device_name: str = "Android device"


class MfaIn(BaseModel):
    mfa_token: str
    code: str = Field(pattern=r"^\d{6}$")
    device_name: str = "Android device"


class RefreshIn(BaseModel):
    refresh_token: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")
    new_password: str = Field(min_length=10, max_length=128)


class PanIn(BaseModel):
    pan: str

    @field_validator("pan")
    @classmethod
    def valid(cls, v: str) -> str:
        v = v.strip().upper()
        if not PAN_RE.match(v):
            raise ValueError("Invalid PAN format")
        return v


class PushIn(BaseModel):
    token: str = Field(max_length=300)
    platform: Literal["android"] = "android"


class DeleteIn(BaseModel):
    confirm: Literal["DELETE"]
    password: str


class ConsentRequestIn(BaseModel):
    fi_types: list[Literal["DEPOSIT", "TERM_DEPOSIT", "RECURRING_DEPOSIT", "EQUITIES", "MUTUAL_FUNDS",
                           "INSURANCE_POLICIES", "NPS", "EPF", "PPF"]]
    aa_handle: str = Field(pattern=r"^[\w.\-]+@[\w\-]+$")


# ================================================================ health
@app.get("/health")
def health():
    return {"status": "ok", "env": settings.env, "demo": settings.demo_enabled}


# ================================================================ auth
@app.post("/api/v1/auth/register", status_code=201)
def register(body: RegisterIn):
    if body.email.lower() in EMAIL_INDEX:
        err(409, "email_taken", "An account with this email already exists")
    u = _new_user(body.full_name, body.email, body.phone, body.password)
    uri = f"otpauth://totp/PersonalFinance360:{u.email}?secret={u.totp_secret}&issuer=PersonalFinance360"
    return {"user_id": u.id, "mfa_setup": {"type": "totp", "secret": u.totp_secret, "otpauth_uri": uri},
            "message": "Add the secret to an authenticator app, then sign in."}


@app.post("/api/v1/auth/login")
def login(body: LoginIn):
    key = body.email.lower()
    fails = [t for t in LOGIN_FAILS.get(key, []) if t > time.time() - 900]
    if len(fails) >= 5:
        err(429, "too_many_attempts", "Too many failed attempts. Try again in 15 minutes.")
    uid = EMAIL_INDEX.get(key)
    u = USERS.get(uid) if uid else None
    if not u or not verify_password(body.password, u.password_hash):
        LOGIN_FAILS[key] = fails + [time.time()]
        err(401, "invalid_credentials", "Email or password is incorrect")
    LOGIN_FAILS.pop(key, None)
    return {"mfa_required": True, "mfa_token": create_mfa_token(u.id), "methods": ["totp"]}


@app.post("/api/v1/auth/mfa/verify")
def mfa_verify(body: MfaIn):
    try:
        uid = decode_mfa_token(body.mfa_token)
    except jwt.InvalidTokenError:
        err(401, "mfa_expired", "MFA step expired. Sign in again.")
    u = USERS[uid]
    if not verify_totp(u.totp_secret, body.code):
        err(401, "invalid_mfa_code", "That code is not valid")
    return token_pair(u, body.device_name)


@app.post("/api/v1/auth/refresh")
def refresh(body: RefreshIn):
    try:
        s, new_refresh = SESSIONS.rotate(body.refresh_token)
    except PermissionError as e:
        err(401, str(e), "Please sign in again")
    return {"token_type": "Bearer", "access_token": create_access_token(s.user_id, s.id),
            "expires_in": settings.access_ttl_seconds, "refresh_token": new_refresh,
            "refresh_expires_in": int(s.expires_at - time.time()), "session_id": s.id}


@app.post("/api/v1/auth/logout", status_code=204)
def logout(body: RefreshIn):
    SESSIONS.revoke_token(body.refresh_token)


@app.post("/api/v1/auth/password/forgot", status_code=202)
def forgot(body: ForgotIn):
    out = {"message": "If an account exists, a 6-digit reset code has been sent to the registered email."}
    uid = EMAIL_INDEX.get(body.email.lower())
    if uid:
        code = f"{secrets.randbelow(10**6):06d}"
        RESET_CODES[body.email.lower()] = (code, time.time() + 600)
        # TODO production: send via transactional email provider. Never log the code.
        if settings.env == "development":
            out["dev_reset_code"] = code
    return out


@app.post("/api/v1/auth/password/reset")
def reset(body: ResetIn):
    entry = RESET_CODES.get(body.email.lower())
    if not entry or entry[1] < time.time() or not secrets.compare_digest(entry[0], body.code):
        err(400, "invalid_reset_code", "Reset code is invalid or expired")
    RegisterIn.strong(body.new_password)
    u = USERS[EMAIL_INDEX[body.email.lower()]]
    u.password_hash = hash_password(body.new_password)
    RESET_CODES.pop(body.email.lower(), None)
    for s in SESSIONS.for_user(u.id):
        s.revoked = True
    return {"message": "Password updated. Sign in with your new password."}


@app.get("/api/v1/auth/sessions")
def sessions(u: CurrentUser):
    cur = u.__dict__.get("_sid")
    return {"data": [{"id": s.id, "device_name": s.device_name, "current": s.id == cur,
                      "created_at": datetime.fromtimestamp(s.created_at, timezone.utc).isoformat(),
                      "last_used_at": datetime.fromtimestamp(s.last_used_at, timezone.utc).isoformat()}
                     for s in SESSIONS.for_user(u.id)]}


@app.delete("/api/v1/auth/sessions/{sid}", status_code=204)
def revoke_session(sid: str, u: CurrentUser):
    s = SESSIONS.sessions.get(sid)
    if not s or s.user_id != u.id:
        err(404, "not_found", "Session not found")
    s.revoked = True


# ================================================================ profile
@app.get("/api/v1/me")
def me(u: CurrentUser):
    phone = u.phone[:3] + " XXXXX X" + u.phone[-4:]
    return {"id": u.id, "full_name": u.full_name, "email": u.email, "phone_masked": phone,
            "pan_masked": mask_pan(u.pan_last5), "is_demo": u.is_demo}


@app.put("/api/v1/me/pan")
def set_pan(body: PanIn, u: CurrentUser):
    # Production: encrypt the full PAN with a KMS-managed key; this reference keeps only the masked tail.
    u.pan_last5 = body.pan[-5:]
    return {"pan_masked": mask_pan(u.pan_last5)}


@app.post("/api/v1/me/export", status_code=202)
def export(u: CurrentUser):
    return {"job_id": "exp_" + uuid.uuid4().hex[:10],
            "message": "Your data export is being prepared. A secure download link will be emailed to you."}


@app.post("/api/v1/me/delete")
def delete_account(body: DeleteIn, u: CurrentUser):
    if not verify_password(body.password, u.password_hash):
        err(403, "invalid_credentials", "Password is incorrect")
    if u.is_demo:
        return {"message": "Demo account cannot be deleted (demo mode)."}
    for s in SESSIONS.for_user(u.id):
        s.revoked = True
    EMAIL_INDEX.pop(u.email, None)
    USERS.pop(u.id, None)
    return {"message": "Account and data scheduled for deletion."}


@app.post("/api/v1/devices/push-token", status_code=204)
def push_token(body: PushIn, u: CurrentUser):
    PUSH_TOKENS.setdefault(u.id, set()).add(body.token)


# ================================================================ dashboard + finance data
EMPTY_TOTALS = {"bank": 0, "demat": 0, "mutual_funds": 0, "fixed_deposits": 0, "retirement": 0, "liabilities": 0}


@app.get("/api/v1/dashboard")
def dashboard(u: CurrentUser):
    d = dict(FIXTURE["dashboard"]) if u.is_demo else {
        "as_of": date.today().isoformat(), "net_worth": 0, "total_assets": 0, "totals": EMPTY_TOTALS,
        "net_worth_change_1m": 0, "net_worth_history": []}
    d["sync"] = SYNC[u.id]
    return wrap(u, d)


@app.get("/api/v1/banks/accounts")
def bank_accounts(u: CurrentUser):
    return wrap(u, demo_or_empty(u, "bank_accounts", []))


@app.get("/api/v1/banks/transactions")
def transactions(u: CurrentUser, account_id: str | None = None, category: str | None = None,
                 month: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"),
                 page: int = Query(1, ge=1), page_size: int = Query(30, ge=1, le=100)):
    rows = demo_or_empty(u, "transactions", [])
    if account_id:
        rows = [r for r in rows if r["account_id"] == account_id]
    if category:
        rows = [r for r in rows if r["category"] == category]
    if month:
        rows = [r for r in rows if r["date"].startswith(month)]
    start = (page - 1) * page_size
    items = rows[start:start + page_size]
    return {**wrap(u, items), "page": page, "next_page": page + 1 if start + page_size < len(rows) else None,
            "total": len(rows)}


def _month_summary(rows: list[dict], month: str) -> dict:
    inc: dict[str, float] = {}
    exp: dict[str, float] = {}
    for r in rows:
        if not r["date"].startswith(month):
            continue
        tgt = inc if r["direction"] == "credit" else exp
        tgt[r["category"]] = round(tgt.get(r["category"], 0) + r["amount"], 2)
    ti, te = round(sum(inc.values()), 2), round(sum(exp.values()), 2)
    return {"month": month, "income_total": ti, "expense_total": te, "net_savings": round(ti - te, 2),
            "savings_rate_pct": round((ti - te) / ti * 100, 1) if ti else 0,
            "income": sorted([{"category": k, "amount": v} for k, v in inc.items()], key=lambda x: -x["amount"]),
            "expense": sorted([{"category": k, "amount": v} for k, v in exp.items()], key=lambda x: -x["amount"])}


@app.get("/api/v1/banks/categories")
def categories(u: CurrentUser, month: str = Query(..., pattern=r"^\d{4}-\d{2}$")):
    return wrap(u, _month_summary(demo_or_empty(u, "transactions", []), month))


@app.get("/api/v1/investments/demat")
def demat(u: CurrentUser):
    return wrap(u, demo_or_empty(u, "demat", {"accounts": [], "holdings": [],
                                               "totals": {"invested": 0, "market_value": 0, "pnl": 0, "pnl_pct": 0}}))


@app.get("/api/v1/investments/mutual-funds")
def mutual_funds(u: CurrentUser):
    return wrap(u, demo_or_empty(u, "mutual_funds", {"holdings": [], "totals": {
        "invested": 0, "current_value": 0, "absolute_return_pct": 0, "xirr_pct": 0}}))


@app.get("/api/v1/investments/sips")
def sips(u: CurrentUser):
    return wrap(u, demo_or_empty(u, "sips", []))


@app.get("/api/v1/investments/performance")
def performance(u: CurrentUser, range: Literal["6M", "1Y", "2Y"] = "1Y"):
    pts = demo_or_empty(u, "performance", [])
    n = {"6M": 7, "1Y": 13, "2Y": 25}[range]
    return wrap(u, pts[-n:])


@app.get("/api/v1/savings")
def savings(u: CurrentUser):
    return wrap(u, demo_or_empty(u, "savings", {"deposits": [], "retirement": {"ppf": None, "epf": None, "nps": None},
                                                 "totals": {"deposits": 0, "retirement": 0}}))


@app.get("/api/v1/insurance")
def insurance(u: CurrentUser):
    return wrap(u, demo_or_empty(u, "insurance", []))


@app.get("/api/v1/liabilities")
def liabilities(u: CurrentUser):
    return wrap(u, demo_or_empty(u, "liabilities", {"loans": [], "cards": [], "totals": {
        "loan_outstanding": 0, "card_outstanding": 0, "total": 0, "monthly_emi": 0, "credit_limit": 0, "utilisation_pct": 0}}))


# ================================================================ reports
@app.get("/api/v1/reports/monthly")
def report_monthly(u: CurrentUser, month: str = Query(..., pattern=r"^\d{4}-\d{2}$")):
    s = _month_summary(demo_or_empty(u, "transactions", []), month)
    hist = {h["month"]: h for h in demo_or_empty(u, "net_worth_history", [])}
    y, m = map(int, month.split("-"))
    prev = f"{y - 1}-12" if m == 1 else f"{y}-{m - 1:02d}"
    s["net_worth_end"] = hist.get(month, {}).get("net_worth")
    s["net_worth_change"] = (round(hist[month]["net_worth"] - hist[prev]["net_worth"], 2)
                             if month in hist and prev in hist else None)
    return wrap(u, s)


@app.get("/api/v1/reports/annual")
def report_annual(u: CurrentUser, year: int = Query(..., ge=2000, le=2100)):
    rows = demo_or_empty(u, "transactions", [])
    months = [_month_summary(rows, f"{year}-{m:02d}") for m in range(1, 13)]
    months = [{k: v for k, v in m.items() if k in ("month", "income_total", "expense_total", "net_savings")} for m in months]
    ti = round(sum(m["income_total"] for m in months), 2)
    te = round(sum(m["expense_total"] for m in months), 2)
    cats: dict[str, float] = {}
    for r in rows:
        if r["date"].startswith(str(year)) and r["direction"] == "debit":
            cats[r["category"]] = round(cats.get(r["category"], 0) + r["amount"], 2)
    return wrap(u, {"year": year, "months": months, "income_total": ti, "expense_total": te,
                    "net_savings": round(ti - te, 2), "savings_rate_pct": round((ti - te) / ti * 100, 1) if ti else 0,
                    "expense_by_category": sorted([{"category": k, "amount": v} for k, v in cats.items()], key=lambda x: -x["amount"])})


@app.get("/api/v1/reports/allocation")
def report_allocation(u: CurrentUser):
    if not u.is_demo:
        return wrap(u, {"assets": [], "liabilities": []})
    t = FIXTURE["dashboard"]["totals"]
    lt = FIXTURE["liabilities"]
    return wrap(u, {
        "assets": [{"class": "Bank balances", "value": t["bank"]}, {"class": "Stocks (demat)", "value": t["demat"]},
                   {"class": "Mutual funds", "value": t["mutual_funds"]}, {"class": "FD / RD", "value": t["fixed_deposits"]},
                   {"class": "PPF / EPF / NPS", "value": t["retirement"]}],
        "liabilities": [{"type": l["type"], "value": l["outstanding"]} for l in lt["loans"]] +
                       [{"type": "Credit cards", "value": lt["totals"]["card_outstanding"]}]})


@app.get("/api/v1/reports/net-worth-history")
def report_nw(u: CurrentUser, range: Literal["1Y", "2Y"] = "1Y"):
    h = demo_or_empty(u, "net_worth_history", [])
    return wrap(u, h[-(13 if range == "1Y" else 25):])


# ================================================================ institutions, consents, sync
@app.get("/api/v1/institutions")
def institutions(u: CurrentUser):
    return wrap(u, demo_or_empty(u, "institutions", []))


@app.get("/api/v1/aa/consents")
def consents(u: CurrentUser):
    return wrap(u, CONSENTS[u.id])


@app.post("/api/v1/aa/consents", status_code=201)
def create_consent(body: ConsentRequestIn, u: CurrentUser):
    # Production: call your licensed AA's consent API and return its redirect URL. The user approves
    # the consent and enters any OTP inside the AA's own interface — PF360 never sees it.
    c = {"id": "cn_" + uuid.uuid4().hex[:8], "aa_handle": body.aa_handle, "aa_name": "Not connected (reference backend)",
         "fip_names": [], "fi_types": body.fi_types, "purpose": "Personal finance management", "status": "PENDING",
         "created_at": date.today().isoformat(), "valid_till": None, "fetch_frequency": "1 per day", "data_range_months": 12}
    CONSENTS[u.id].append(c)
    return {"consent": c, "redirect_url": None,
            "message": "No Account Aggregator is configured on this server. Consent recorded as PENDING."}


@app.post("/api/v1/aa/consents/{cid}/{action}")
def consent_action(cid: str, action: Literal["pause", "resume", "revoke"], u: CurrentUser):
    for c in CONSENTS[u.id]:
        if c["id"] == cid:
            if c["status"] == "REVOKED":
                err(409, "consent_revoked", "Consent already revoked")
            c["status"] = {"pause": "PAUSED", "resume": "ACTIVE", "revoke": "REVOKED"}[action]
            return c
    err(404, "not_found", "Consent not found")


@app.post("/api/v1/sync", status_code=202)
def start_sync(u: CurrentUser):
    s = SYNC[u.id]
    s.update({"status": "running", "started_at": time.time()})
    return {"status": "running", "message": "Sync started"}


@app.get("/api/v1/sync/status")
def sync_status(u: CurrentUser):
    s = SYNC[u.id]
    if s.get("status") == "running" and time.time() - s.get("started_at", 0) > 3:
        s["status"] = "partial" if u.is_demo else "never"
        s["last_synced_at"] = datetime.now(timezone.utc).isoformat() if u.is_demo else None
    return wrap(u, {k: v for k, v in s.items() if k != "started_at"})


# ================================================================ settings
@app.get("/api/v1/settings/notifications")
def get_notif(u: CurrentUser):
    return NOTIF[u.id]


@app.put("/api/v1/settings/notifications")
def put_notif(body: dict[str, bool], u: CurrentUser):
    NOTIF[u.id].update({k: v for k, v in body.items() if k in DEFAULT_NOTIF})
    return NOTIF[u.id]


@app.get("/api/v1/settings/privacy")
def get_privacy(u: CurrentUser):
    return PRIVACY[u.id]


@app.put("/api/v1/settings/privacy")
def put_privacy(body: dict[str, bool], u: CurrentUser):
    PRIVACY[u.id].update({k: v for k, v in body.items() if k in DEFAULT_PRIVACY})
    return PRIVACY[u.id]

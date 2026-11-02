"""Password hashing, JWT access tokens, rotating refresh tokens and TOTP MFA (stdlib + PyJWT)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import struct
import time
import uuid
from dataclasses import dataclass, field

import jwt

from app.config import settings


# ---------------------------------------------------------------- passwords (scrypt)
def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(dk).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        _, s, h = stored.split("$")
        salt, expected = base64.b64decode(s), base64.b64decode(h)
    except ValueError:
        return False
    dk = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return hmac.compare_digest(dk, expected)


# ---------------------------------------------------------------- TOTP (RFC 6238) for the PF360 account itself
def totp_now(secret_b32: str, at: float | None = None, step: int = 30, digits: int = 6) -> str:
    key = base64.b32decode(secret_b32.upper() + "=" * (-len(secret_b32) % 8))
    counter = int((at or time.time()) // step)
    mac = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    o = mac[-1] & 0x0F
    code = (struct.unpack(">I", mac[o:o + 4])[0] & 0x7FFFFFFF) % (10 ** digits)
    return str(code).zfill(digits)


def verify_totp(secret_b32: str, code: str, window: int = 1) -> bool:
    now = time.time()
    return any(hmac.compare_digest(totp_now(secret_b32, now + w * 30), code) for w in range(-window, window + 1))


# ---------------------------------------------------------------- JWT access tokens
def create_access_token(user_id: str, session_id: str) -> str:
    now = int(time.time())
    payload = {"sub": user_id, "sid": session_id, "iat": now, "exp": now + settings.access_ttl_seconds,
               "iss": settings.issuer, "typ": "access"}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"], issuer=settings.issuer,
                      options={"require": ["exp", "sub", "sid"]})


def create_mfa_token(user_id: str) -> str:
    now = int(time.time())
    return jwt.encode({"sub": user_id, "typ": "mfa", "iat": now, "exp": now + 300, "iss": settings.issuer},
                      settings.jwt_secret, algorithm="HS256")


def decode_mfa_token(token: str) -> str:
    data = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"], issuer=settings.issuer)
    if data.get("typ") != "mfa":
        raise jwt.InvalidTokenError("wrong token type")
    return data["sub"]


# ---------------------------------------------------------------- refresh tokens with rotation + reuse detection
def _digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@dataclass
class Session:
    id: str
    user_id: str
    device_name: str
    created_at: float
    last_used_at: float
    expires_at: float
    current_hash: str
    used_hashes: set[str] = field(default_factory=set)
    revoked: bool = False


class SessionStore:
    """In-memory. Replace with a database table in production."""

    def __init__(self) -> None:
        self.sessions: dict[str, Session] = {}
        self.by_hash: dict[str, str] = {}

    def create(self, user_id: str, device_name: str) -> tuple[Session, str]:
        token = secrets.token_urlsafe(48)
        now = time.time()
        s = Session(id="ses_" + uuid.uuid4().hex[:12], user_id=user_id, device_name=device_name[:80],
                    created_at=now, last_used_at=now, expires_at=now + settings.refresh_ttl_seconds,
                    current_hash=_digest(token))
        self.sessions[s.id] = s
        self.by_hash[s.current_hash] = s.id
        return s, token

    def rotate(self, token: str) -> tuple[Session, str]:
        """Returns (session, new_refresh_token). Reusing an old token revokes the whole session."""
        h = _digest(token)
        sid = self.by_hash.get(h)
        if not sid:
            raise PermissionError("invalid_refresh_token")
        s = self.sessions[sid]
        if s.revoked or s.expires_at < time.time():
            raise PermissionError("session_expired")
        if h != s.current_hash:  # an already-rotated token was presented: assume theft
            s.revoked = True
            raise PermissionError("refresh_token_reused")
        new = secrets.token_urlsafe(48)
        s.used_hashes.add(h)
        s.current_hash = _digest(new)
        s.last_used_at = time.time()
        self.by_hash[s.current_hash] = s.id
        return s, new

    def revoke_token(self, token: str) -> None:
        sid = self.by_hash.get(_digest(token))
        if sid:
            self.sessions[sid].revoked = True

    def is_active(self, sid: str) -> bool:
        s = self.sessions.get(sid)
        return bool(s and not s.revoked and s.expires_at > time.time())

    def for_user(self, user_id: str) -> list[Session]:
        return [s for s in self.sessions.values() if s.user_id == user_id and not s.revoked and s.expires_at > time.time()]

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    env: str = os.getenv("PF360_ENV", "development")
    jwt_secret: str = os.getenv("PF360_JWT_SECRET", "")
    issuer: str = os.getenv("PF360_ISSUER", "pf360-api")
    access_ttl_seconds: int = int(os.getenv("PF360_ACCESS_TTL", "900"))          # 15 min
    refresh_ttl_seconds: int = int(os.getenv("PF360_REFRESH_TTL", str(30 * 86400)))  # 30 days
    demo_enabled: bool = os.getenv("PF360_DEMO", "true").lower() == "true"
    demo_totp_secret: str = os.getenv("PF360_DEMO_TOTP_SECRET", "JBSWY3DPEHPK3PXP")
    allowed_origins: str = os.getenv("PF360_CORS", "")


settings = Settings()

if not settings.jwt_secret:
    if settings.env == "production":
        raise RuntimeError("PF360_JWT_SECRET must be set in production")
    object.__setattr__(settings, "jwt_secret", "dev-only-secret-change-me-" + "x" * 16)

# API v1 — integration contract

Base: `https://<host>/api/v1`. HTTPS only (the app refuses `http://`). JSON in and out.
The reference server in `backend/` implements every endpoint below; the app's on-device mode
(`mobile/src/local/handler.ts`) answers the same paths from the encrypted local vault, so screens
are identical in both modes.

## Conventions

- **Auth:** `Authorization: Bearer <access_token>`. Access tokens are JWT (HS256), 15 min, kept in app memory only.
- **Refresh:** opaque, 30 days, stored in Android Keystore-backed SecureStore. **Rotated on every use.**
  Presenting an already-used refresh token revokes the whole session (`refresh_token_reused`).
- **Envelope** for financial reads: `{ "is_demo": bool, "as_of": "YYYY-MM-DD", "data": … }`.
  Clients must show a DEMO banner whenever `is_demo` is true.
- **Errors:** `{ "error": { "code": "invalid_mfa_code", "message": "…" } }` with a matching HTTP status.
  422 from validation uses FastAPI's `detail` array.
- **Amounts:** INR as JSON numbers (rupees, 2 dp). **Dates:** ISO 8601.
- **Identifiers** are always returned masked (`XXXX1234`, `XXXXX1234F`). Full PAN, account, card, policy,
  UAN or PRAN numbers are never returned.
- Responses carry `Cache-Control: no-store` and HSTS. Server logs contain method, path, status and latency only.
- Client timeout: 15 s. On 401 the app refreshes once and retries; on refresh failure it signs out.

## Authentication

| Method & path | Body | Response |
|---|---|---|
| `POST /auth/register` | `{full_name, email, phone:"+91XXXXXXXXXX", password}` (10+ chars, upper/lower/digit/symbol) | `201 {user_id, mfa_setup:{type:"totp", secret, otpauth_uri}}` |
| `POST /auth/login` | `{email, password, device_name}` | `{mfa_required:true, mfa_token, methods:["totp"]}` — 5 failures / 15 min → 429 |
| `POST /auth/mfa/verify` | `{mfa_token, code, device_name}` | token pair |
| `POST /auth/refresh` | `{refresh_token}` | new token pair (rotated) |
| `POST /auth/logout` | `{refresh_token}` | 204 |
| `POST /auth/password/forgot` | `{email}` | 202 (always, no account enumeration) |
| `POST /auth/password/reset` | `{email, code, new_password}` | revokes all sessions |
| `GET /auth/sessions` · `DELETE /auth/sessions/{id}` | | list / revoke devices |

Token pair: `{token_type:"Bearer", access_token, expires_in, refresh_token, refresh_expires_in, session_id}`.
MFA is TOTP for the Personal Finance 360 account itself — never a bank OTP.

## Profile, devices, data rights

`GET /me` · `PUT /me/pan {pan}` → `{pan_masked}` · `POST /devices/push-token {token, platform:"android"}` ·
`POST /me/export` → 202 · `POST /me/delete {confirm:"DELETE", password}`

## Financial data (all return the envelope)

| Path | `data` |
|---|---|
| `GET /dashboard` | `{net_worth, total_assets, totals:{bank, demat, mutual_funds, fixed_deposits, retirement, liabilities}, net_worth_change_1m, net_worth_history:[{month, net_worth, assets, liabilities}], sync}` |
| `GET /banks/accounts` | `[{id, bank_name, account_type, account_masked, available_balance, current_balance, last_synced_at}]` |
| `GET /banks/transactions?account_id&category&month=YYYY-MM&page&page_size≤100` | page of `{id, account_id, date, description, amount, direction:credit/debit, category}` + `page, next_page, total` |
| `GET /banks/categories?month=YYYY-MM` | `{income_total, expense_total, net_savings, savings_rate_pct, income:[{category, amount}], expense:[…]}` |
| `GET /investments/demat` | `{accounts, holdings:[{symbol, name, exchange, quantity, avg_price, ltp, invested, market_value, pnl, pnl_pct, day_change_pct}], totals}` |
| `GET /investments/mutual-funds` | `{holdings:[{scheme_code, scheme_name, amc, category, folio_masked, units, nav, nav_date, invested, current_value, absolute_return_pct, xirr_pct}], totals:{…, xirr_pct}}` |
| `GET /investments/sips` | `[{id, scheme_name, amc, amount, frequency, sip_day, next_date, installments_done, start_date, status}]` |
| `GET /investments/performance?range=6M\|1Y\|2Y` | `[{date, invested, value}]` |
| `GET /savings` | `{deposits:[FD/RD…], retirement:{ppf, epf, nps}, totals}` |
| `GET /insurance` | `[{id, type:life/health/motor, insurer, plan, policy_masked, sum_assured, premium, frequency, renewal_date, status, days_to_renewal}]` |
| `GET /liabilities` | `{loans:[…emi, next_emi_date…], cards:[…last4, credit_limit, outstanding, min_due, due_date…], totals:{…, utilisation_pct}}` |
| `GET /reports/monthly?month=` · `/reports/annual?year=` · `/reports/allocation` · `/reports/net-worth-history?range=1Y\|2Y` | report data |

XIRR is annualised from dated cash flows (Newton–Raphson with bisection fallback; `backend/app/calc.py`,
mirrored in `mobile/src/lib/calc.ts`).

## Connections & sync

| Path | Notes |
|---|---|
| `GET /institutions` | linked institutions and status |
| `GET /aa/consents` · `POST /aa/consents {aa_handle, fi_types[]}` · `POST /aa/consents/{id}/pause\|resume\|revoke` | Production: return the AA's `redirect_url`; the user approves (and enters any OTP) inside the AA — never in this app |
| `POST /sync` → 202 · `GET /sync/status` | server-side fetch from AA/FIPs |
| `GET/PUT /settings/notifications` · `GET/PUT /settings/privacy` | preferences |

## Running the reference backend

```bash
cd backend && pip install -r requirements.txt
PF360_ENV=development uvicorn app.main:app --port 8000
# demo login: demo@pf360.dev / Demo@12345, TOTP secret JBSWY3DPEHPK3PXP
python -m pytest -q
```

The app only talks HTTPS, so expose it via a TLS host (Render, Fly.io, Railway, a VPS with Caddy) or a tunnel
(`cloudflared tunnel --url http://localhost:8000`), then enter that address in the debug build's server field.
Storage is in memory; put a database behind it before real use.

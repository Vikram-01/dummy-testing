# Personal Finance 360 — Android

A private personal-finance app for India: net worth, bank accounts, stocks, mutual funds (incl. UTI MF),
SIPs, FD/RD, PPF/EPF/NPS, insurance, loans and credit cards, with reports and PDF/CSV export.

| Folder | What it is |
|---|---|
| `mobile/` | Android app — Expo SDK 58, React Native 0.88, TypeScript, Expo Router, TanStack Query, React Hook Form + Zod |
| `backend/` | Reference FastAPI backend (API v1). Real auth, **demo financial data** |
| `docs/` | Build, signing, API, testing and limitations |
| `.github/workflows/android.yml` | Builds the debug and release APKs on GitHub and publishes them as a pre-release |

## Two ways the app runs

**On-device mode (default).** No server needed. Everything is stored in an AES-256-GCM encrypted vault on
the phone; the key is protected by Android Keystore. Unlock with a 6-digit passcode or fingerprint. You enter
balances, holdings, policies and loans yourself; the app computes net worth, P&L, XIRR, utilisation, reports
and history.

**Server mode.** Sign in to a Personal Finance 360 backend (password + TOTP two-step verification, rotating
refresh tokens). This is the mode that can receive automatic bank/demat data — but only once the server is
connected to a licensed Account Aggregator, which this repository does **not** do.

## Get the APK

Open the **Releases** page of this repository (or the latest *Android APK* workflow run) and download
`PersonalFinance360-debug.apk`. On the phone: allow "Install unknown apps" for your browser, open the file,
install. See [docs/BUILD.md](docs/BUILD.md).

## Quick facts

- Application ID `com.personalfinance360.app` (debug variant: `com.personalfinance360.app.debug`)
- minSdk 26, targetSdk 36 (compileSdk 37), ABIs `arm64-v8a` + `x86_64` (64-bit only)
- No analytics or crash-reporting SDKs. No SMS, contacts, location or storage permissions.
- Never collects bank OTPs, UPI/ATM/trading PINs, CVV, or bank/broker passwords.

More: [Build](docs/BUILD.md) · [Signing](docs/SIGNING.md) · [API](docs/API.md) · [Tests](docs/TESTING.md) · [Limitations](docs/LIMITATIONS.md)

# Known limitations

Stated plainly so nothing is mistaken for a working financial integration.

## Financial integrations — not connected

- **No live bank, demat, AMC/RTA, EPFO, NPS CRA or insurer data.** Nothing has been connected to or tested
  against any authorised provider or sandbox. Account Aggregator linking requires a business licensed /
  partnered with an RBI-regulated AA (e.g. as an FIU) and server-side integration; this repository contains the
  client flow and API contract only.
- The reference backend serves **fictional demo data** for the demo user and empty data for new users. Every
  response says `is_demo`.
- Stock prices and NAVs are whatever the user (on-device) or server provides; there is no market-data feed.

## On-device mode

- Data is entered manually. Due dates for EMIs and cards roll forward monthly; insurance renewals by frequency.
- **XIRR for manually entered funds is an estimate** built from total invested + first date + optional SIP
  amount, not from the real transaction history.
- Net-worth history builds up one snapshot per month from the day you start; there is no back-fill.
- A forgotten passcode can only be reset with fingerprint unlock; otherwise the vault must be erased.
- The JSON backup is **not encrypted** — the user is told to store it privately. Restoring a backup isn't built yet.
- Uninstalling the app deletes the vault (Android backups are disabled on purpose).

## Server mode / backend

- In-memory storage; a restart wipes users and sessions. Needs a database, KMS-encrypted PAN storage, email
  delivery for reset codes, and rate limiting at the edge before production.
- Remote push needs FCM credentials (`google-services.json`) and an EAS project id. Without them, reminders are
  scheduled locally on the phone (which works in both modes).
- No certificate pinning: TLS uses Android's system trust store with cleartext disabled. Pinning can be added
  with a network-security-config plugin once the production certificate chain is fixed.

## Platform

- Background refresh runs only when Android's WorkManager allows (battery/Doze dependent); it is a best effort.
- Root detection is a heuristic warning (`expo-device`), easily bypassed; it never blocks use.
- Screenshot blocking (FLAG_SECURE) is applied on all signed-in screens; rooted devices can defeat it.
- Release APK is unsigned until a signing key is added (see SIGNING.md).
- Tested by automated checks in CI (see TESTING.md). **Not yet tested by me on a real Android device** — that
  step needs a human with a phone; a checklist is in TESTING.md.

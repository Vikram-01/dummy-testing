# Test results

All automated suites run in CI on every push (`test` job of `.github/workflows/android.yml`) and were also
run locally on 2 Nov 2026. Everything below uses **mock / fictional data only**.

## Automated — passing

| Suite | Command | Result |
|---|---|---|
| TypeScript strict typecheck (whole app) | `npm run typecheck` | 0 errors |
| Unit: XIRR (gain, loss, SIP, undefined), P&L, utilisation, allocation rounding, INR lakh/crore format, PAN masking | `npm test` | 9 / 9 |
| On-device engine (end-to-end with stubbed Keystore/filesystem) | `npm run test:engine` | 19 / 19 |
| Backend API (auth, MFA, rotation + reuse detection, logout, register → empty data, PAN, consents, reports, password reset, XIRR) | `pytest` | 11 / 11 |
| JS bundle compiles for Android (Hermes bytecode), release & debug | `expo export --platform android` | both OK; release bundle contains **no** sample data |
| Native project generation | `expo prebuild` | minSdk 26, targetSdk 36, compileSdk 37, ABIs arm64-v8a + x86_64, cleartext off, backup off, SMS/contacts/location/storage permissions removed, release signing from env only |
| Gradle APK build + `aapt2` / `apksigner` inspection | CI `build` job | see the workflow run log |

### On-device engine checks (19)

Vault file is encrypted (owner name not visible in ciphertext) · wrong passcode rejected · right passcode
accepted · empty vault → net worth 0, not demo · full card number rejected (last 4 only) · net worth = bank +
MF − card · MF XIRR estimated · card due date rolls forward · utilisation 20 % · monthly report income /
expense / savings rate · PAN masked with prefix discarded · PAN prefix absent from stored data · sample data
loads flagged DEMO with 13 months history · every GET endpoint answers · PPF/EPF/NPS present · removing sample
data keeps user rows · data survives lock/unlock · lockout after 5 wrong passcodes · erase removes vault.

## Not yet tested — needs a real phone

These require a person with an Android device. Suggested checklist (debug APK):

- [ ] Install from the release page; app opens to the welcome screen
- [ ] Create vault (name + passcode) → empty dashboard → "Add accounts"
- [ ] Add a bank account, a transaction, a fund, a card; dashboard and charts update
- [ ] Profile → My accounts & data → Add sample data → DEMO banner everywhere → Remove sample data
- [ ] Lock now → passcode unlock; enable fingerprint → fingerprint unlock; 5 wrong passcodes → cooldown
- [ ] Send app to background > 2 min → it locks
- [ ] Screenshot attempt on dashboard is blocked; recent-apps preview is blank
- [ ] Reports → Export PDF and CSV → share sheet opens; PDF shows DEMO watermark when sample data present
- [ ] Notifications permission prompt; a reminder appears for an item due soon (content shows no amounts)
- [ ] Light / dark / system theme switch; "hide amounts" eye toggle
- [ ] Airplane mode → app still works (on-device)
- [ ] Server mode against a hosted backend: login, MFA, session expiry, logout, sync
- [ ] Rooted device / emulator shows the optional warning

Financial-provider integrations (banks, AA, depositories, AMCs, EPFO, NPS, insurers) are **not** tested —
none are connected. See LIMITATIONS.md.

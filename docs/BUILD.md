# Building the APKs

## Option A — GitHub Actions (no computer needed)

Every push to the `pf360-app` branch that touches `mobile/`, `backend/` or the workflow runs
`.github/workflows/android.yml`:

1. **test** — TypeScript typecheck, unit tests (XIRR, P&L, formatting, PAN masking), the on-device engine
   test (vault encryption, passcode lockout, every local endpoint), and the backend pytest suite.
2. **build** (debug + release in parallel) — `expo prebuild` → `./gradlew :app:assembleRelease` on Ubuntu
   with JDK 17 and the preinstalled Android SDK. Then `aapt2` and `apksigner` print package, SDK levels,
   ABIs and signature.
3. **publish** — creates a GitHub **pre-release** `pf360-build-N` with the APKs and SHA-256 files attached.

To rebuild without code changes: GitHub → Actions → *Android APK* → *Run workflow* (requires the workflow
on the default branch) or push any change under `mobile/`.

Optional repository **variable** `PF360_API_BASE_URL` (Settings → Secrets and variables → Actions →
Variables) bakes a server address into the build for server mode. Must be `https://`.

### Variants

| File | Package | Name on phone | Signing | Contents |
|---|---|---|---|---|
| `PersonalFinance360-debug.apk` | `com.personalfinance360.app.debug` | PF360 Debug | Android debug key | Full app + optional sample data, debug server-address field |
| `PersonalFinance360-release.apk` | `com.personalfinance360.app` | Personal Finance 360 | Your release key | Minified (R8), no sample data compiled in |
| `…-release-PENDING-SIGNING.apk` | same | same | **unsigned** — will not install | produced when signing secrets are absent |

Both "debug" and "release" are standalone builds with the JavaScript bundled; neither needs a dev server.
They install side by side.

## Option B — your own computer

Requirements: Node 22, JDK 17, Android SDK (Android Studio), ~10 GB free.

```bash
cd mobile
npm ci
APP_VARIANT=debug EXPO_PUBLIC_DEMO_MODE=1 npx expo prebuild --platform android --clean
cd android && ./gradlew :app:assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk
```

For the release variant use `APP_VARIANT=release` and export the four `PF360_*` signing variables first
(see SIGNING.md). Windows: use `set VAR=value` or PowerShell `$env:VAR="value"`.

## Option C — Expo EAS cloud build

`eas.json` defines `development-apk`, `release-apk` (APK) and `production` (AAB). With an Expo account:

```bash
npm i -g eas-cli && cd mobile && eas login && eas init
EAS_PROJECT_ID=<id> eas build -p android --profile development-apk
EAS_PROJECT_ID=<id> eas build -p android --profile release-apk   # EAS can generate & hold the keystore
```

EAS builds use Expo's own signing config, not `plugins/withReleaseSigning.js`.

## Installing on a phone

1. Download the APK from the release page in Chrome.
2. Tap it. Android asks to allow *Install unknown apps* for Chrome — allow it once.
3. Play Protect may warn about an unknown developer: tap *More details → Install anyway*. This happens for
   any app not from the Play Store.

## Environment variables

See `mobile/.env.example` and `backend/.env.example`.

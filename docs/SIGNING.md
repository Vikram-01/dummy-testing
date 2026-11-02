# Release signing

The release APK must be signed with **your** private key. The key and its passwords are never committed:
`.gitignore` blocks `*.jks`, `*.keystore`, `credentials.json` and `.env*`.

`mobile/plugins/withReleaseSigning.js` makes the release build sign only when these environment variables
exist at build time, and otherwise produce an **unsigned** APK (it never falls back to the public debug key):

| Variable | Meaning |
|---|---|
| `PF360_KEYSTORE_PATH` | path to the keystore file (CI writes it from the base64 secret) |
| `PF360_KEYSTORE_PASSWORD` | keystore password |
| `PF360_KEY_ALIAS` | key alias |
| `PF360_KEY_PASSWORD` | key password |

## 1. Create a key (once)

On any machine with Java:

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore pf360-release.keystore \
  -alias pf360 -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=Personal Finance 360, O=<you>, C=IN"
base64 -w0 pf360-release.keystore > pf360-release.keystore.b64   # macOS: base64 -i ... -o ...
```

**Back the keystore and passwords up somewhere safe.** If you lose them you can never ship an update to the
same installed app (or Play Store listing).

## 2. Add GitHub secrets (works from a phone browser)

Repository → Settings → Secrets and variables → Actions → *New repository secret*:

- `PF360_KEYSTORE_BASE64` — contents of `pf360-release.keystore.b64`
- `PF360_KEYSTORE_PASSWORD`
- `PF360_KEY_ALIAS` — `pf360`
- `PF360_KEY_PASSWORD`

The next workflow run produces `PersonalFinance360-release.apk`, and the log shows `apksigner verify` output
with your certificate.

## 3. Signing an already-built unsigned APK (alternative)

```bash
zipalign -p -f 4 PersonalFinance360-release-PENDING-SIGNING.apk aligned.apk
apksigner sign --ks pf360-release.keystore --ks-key-alias pf360 --out PersonalFinance360-release.apk aligned.apk
apksigner verify --print-certs PersonalFinance360-release.apk
```

## Google Play

Play needs an `.aab` (`eas build --profile production`, or `./gradlew :app:bundleRelease`) and Play App
Signing. Use the key above as the *upload key*.

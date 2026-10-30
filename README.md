# Vigil — Security News and CVE Intelligence for Android

Vigil collects cybersecurity news from 22 publishers and vulnerability intelligence from NVD, CISA KEV, GitHub Security Advisories, CVE.org and OSV.dev, stores it in an on-device SQLite database, and refreshes it automatically every hour. Everything synced in the last 5 days stays readable offline.

## What it does

| Area | Details |
|---|---|
| News | 22 official RSS/Atom feeds (The Hacker News, BleepingComputer, Krebs, Dark Reading, SecurityWeek, CyberScoop, Infosecurity Magazine, SC Media, Project Zero, Talos, Unit 42, Mandiant, SANS ISC, PortSwigger, OWASP, ProjectDiscovery, Sonatype, Snyk, AWS Security, Wiz, Sysdig, Aqua). Full text is shown in-app when the publisher includes it in the feed; otherwise the feed summary plus a restricted in-app browser. |
| CVEs | NVD API 2.0 (authoritative description, CVSS, CWE, CPE products, references), CISA KEV (verified exploitation, ransomware use, required action, due date), GitHub advisories (packages, patched versions), CVE.org CNA records (vendor/product/version ranges, solutions), OSV.dev (ecosystem ranges, fixed versions). |
| Verified vs unverified | "Exploited" is shown only for CVEs in CISA KEV. NVD references tagged "Exploit" are labelled "unverified". Affected versions come only from the source that published them and are labelled by source. Nothing is inferred. |
| Categories | 17 categories assigned by weighted keyword rules (no AI). |
| Navigation | Overview, Latest News, Latest CVEs, Critical, CISA KEV, Threat Intelligence, Security Research, Application Security, Cloud Security, Supply Chain Security, Bookmarks (with reading history), Search (with saved searches), Sync History, Settings. |
| Search and filters | Global search across news and CVEs; filters for source, date range, category, severity, CVSS score, vendor, product, CVE ID and exploited status; sort by date, severity, score or modification. |

## Synchronization

- Runs every 60 minutes by default (configurable 15 minutes to 12 hours). Android wakes the background task every 15 minutes; a policy check runs a sync only when the configured interval has elapsed, so the cadence stays close to the setting. A sync also runs at launch and on return to the foreground when one is overdue.
- Incremental: conditional GET (ETag/Last-Modified) for feeds and KEV; NVD `lastModStartDate` from a saved cursor (first run pulls the last 5 days by publish date); GitHub `modified>=` with cursor pagination.
- Rate limits: NVD paced at 5 requests/30 s (50 with a key); GitHub capped at 8 pages per run unauthenticated; retries with exponential backoff and `Retry-After`.
- One source failing never stops the others and never deletes its stored data. The NVD cursor only advances after every page succeeds. A truncated KEV catalog is rejected.
- A database lock plus an in-process guard prevent overlapping runs. Runs killed by the OS are marked "interrupted" on next launch.
- Every run and every source writes to Sync History with timing and errors.

## Data retention (5 days)

After each sync, articles, CVEs and sync logs older than the retention window (default 5 days, adjustable 1–30 in Settings) are removed.

- The window counts back from the last successful sync, not the clock, so a phone that has been offline keeps its last 5 days of data.
- Bookmarked articles and CVEs are never removed.
- The CISA KEV catalog is kept in full as reference data; the KEV screen defaults to entries added in the last 5 days.

## Security

- API keys (optional NVD key, GitHub token) are stored only in the Android Keystore via SecureStore. They are never bundled, logged or written to SQLite.
- All SQL uses bound parameters; search text has LIKE wildcards escaped.
- Feed HTML passes an allow-list sanitizer (scripts, handlers, styles, iframes, forms and non-http URLs removed) and renders in a WebView with JavaScript off, no file access and a strict Content-Security-Policy. Link taps open the in-app browser.
- The in-app browser allows only https navigation, blocks every other scheme, has no file or content access, no pop-ups, no mixed content, incognito storage and no bridge into the app.
- XML entity declarations are rejected (XXE / entity-expansion guard). Responses are size-capped. HTTP is upgraded to HTTPS.
- Android backups of app data are disabled; storage, camera and microphone permissions are blocked.
- Vigil only reads publishers' own RSS/Atom feeds and public APIs with an identifying User-Agent; it does not crawl article pages.

## Install and run

Requirements: Node 20+ and npm. For the APK you also need a free Expo account (cloud build) or Android Studio (local build).

```bash
npm install
npm test                 # 48 unit + integration tests on real SQLite
npm run typecheck
npm run verify:live      # full sync against the real sources (needs internet)
```

### Build the installable APK

Cloud build (no Android SDK needed):

```bash
npx eas-cli@latest login
npm run build:apk        # EAS "preview" profile -> downloadable .apk
```

When it finishes, EAS prints a link and QR code; open it on the phone to install. Allow "Install unknown apps" for your browser when Android asks.

Local build (Android Studio and JDK 17 installed):

```bash
npm run build:apk:local  # output: android/app/build/outputs/apk/release/app-release.apk
```

For Google Play use `npm run build:aab`.

### Development

```bash
npx expo run:android     # development build on a connected device or emulator
```

Expo Go cannot run Vigil because it uses native modules (SQLite, background tasks, secure storage, WebView).

## First launch

1. Open Vigil. The first sync starts automatically and pulls 5 days of news, CVEs and the KEV catalog. Without an NVD key the CVE part takes a few minutes.
2. In Settings, optionally add an NVD API key (free) to make CVE syncs about 10 times faster, and allow KEV notifications.
3. On some phones (Xiaomi, Oppo, Vivo, Samsung "deep sleep"), set battery usage for Vigil to "Unrestricted" so the hourly background sync is not suspended.

## Project layout

```
src/app/              Expo Router screens (drawer sections, article, CVE detail, browser)
src/lib/config/       Source catalog and categorization rules
src/lib/db/           SQLite schema migrations and the expo-sqlite adapter
src/lib/parse/        RSS/Atom parser and HTML sanitizer
src/lib/net/          HTTPS client with retries, backoff, timeouts and size caps
src/lib/repo/         Queries for articles, CVEs, bookmarks, searches, settings, stats
src/lib/sync/         News, NVD, KEV, GHSA, CVE.org/OSV enrichment, engine, retention
src/lib/background/   Hourly background task and run policy
src/ui/               Theme, components, shared screens
tests/                Unit and integration tests (real SQLite via better-sqlite3)
scripts/              Live verification and icon generation
```

## Tests

`npm test` covers: parsing (RSS 2.0, Atom, CDATA, malformed and hostile XML), sanitization and XSS, URL normalization, categorization, NVD/GHSA/CVE.org/OSV/KEV mapping, HTTP retries/backoff/timeouts, full sync across all 27 sources, ETag and incremental NVD windows, NVD pagination, duplicate prevention, source outages and total offline runs, KEV change detection, 5-day retention with bookmark exemption and offline anchoring, persistence across restart, recovery of a killed run, overlapping-run prevention, 24 simulated hourly runs, and search/filter correctness including injection attempts.

`npm run verify:live` repeats the end-to-end checks against the live internet and prints a per-source report.

## Notes

- Some feeds publish summaries only; those articles open in the in-app browser.
- Background timing on Android is managed by the OS (WorkManager). Vigil cannot guarantee an exact minute, but it never runs more often than the interval and catches up on launch.
- NVD and CISA data are US-government public domain; GitHub advisories are CC-BY 4.0; OSV data is CC-BY 4.0. Article text belongs to its publishers and is shown only as their feeds provide it.

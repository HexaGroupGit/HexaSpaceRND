# Android release runbook — Hexa Space member app

App id `au.com.hexaspace.member` · Capacitor shell over the member app (`src/app/`).
No Android device or Android Studio needed: build the signed bundle on this
machine, upload to Play Console, and Google's pre-launch report runs it on
real cloud devices (screenshots + videos in the console).

## One-time setup (already done, 6 Jul 2026)

- Headless toolchain in `%LOCALAPPDATA%\HexaAndroidBuild` (JDK 21 + Android SDK 36).
  `android/local.properties` points at it (gitignored).
- Upload keystore: `android/keystore/upload-keystore.jks` + `key.properties`
  (gitignored). **Back both files up now** — password manager + a copy off this
  machine. With Play App Signing, Google holds the real app key, so a lost
  upload key is recoverable via Play support, but it's a slow nuisance.

## Build a release

```powershell
npm run app:sync                       # rebuild web assets + sync into android/
cd android
$env:JAVA_HOME = "$env:LOCALAPPDATA\HexaAndroidBuild\jdk"
.\gradlew.bat bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

Before each new upload, bump in `android/app/build.gradle`:
- `versionCode` — +1 every upload (Play rejects reused codes)
- `versionName` — what users see, e.g. "1.1"

## Play Console — first upload

1. play.google.com/console → **Create app** → name "Hexa Space", App/Free.
2. Accept Play App Signing (default) — Google manages the app signing key;
   our keystore is only the upload key.
3. **Testing → Internal testing → Create release** → upload the `.aab` →
   add your email to the tester list → roll out.
4. Install on any tester's Android via the opt-in link — or rely on the
   **pre-launch report** (Testing → Pre-launch report) which runs the build
   on ~10 real cloud devices and reports crashes, screenshots and video.
5. Before production: complete the console questionnaires (App content,
   Data safety, target audience) and the store listing (screenshots can come
   from the pre-launch report; privacy policy URL required — needs the
   public page on hexaspace.com.au).
6. Note: organisation accounts can go straight to production; *personal*
   accounts created after Nov 2023 must run a closed test with 12 testers
   for 14 days first.

## What the native shell does differently from the web

- Boots straight into the member app (no /app path needed).
- API calls hit `https://portal.hexaspace.com.au` absolutely (CORS enabled
  on the six endpoints the app uses — see `api/_cors.js`).
- Stripe Checkout / card setup open in a Chrome Custom Tab; on return the
  app refreshes so webhook results (paid invoice, placed order) appear.

## Next phase (per docs/mobile-app-plan.md)

Push notifications: Firebase project (free) → FCM, `push_tokens` table,
`api/push/send.js`, hooks into mail register / overdue cron / bookings /
messages. Then deep links (`portal.hexaspace.com.au/app/*` → app) to smooth
the Stripe return trip.

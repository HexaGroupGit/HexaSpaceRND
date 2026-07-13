# iOS app — build & submit (Hexa Space member app)

The member app (`/app`) is a Capacitor wrapper around the web build. Android is
already set up; this covers iOS. **Apple only allows iOS builds on macOS + Xcode**,
so the Windows machine handles everything up to `cap add ios`; the actual compile,
sign and App Store upload happen on a Mac (or a cloud-Mac / CI service — see bottom).

App identity (already set in `capacitor.config.json`):
- **Bundle ID:** `au.com.hexaspace.member`
- **Display name:** Hexa Space
- Icon/splash sources live in [`assets/`](../assets) (icon-only.png, icon-foreground/background, splash.png, splash-dark.png).

## Already done on Windows (committed)
- `@capacitor/ios@^8.4.1` added to dependencies.
- `capacitor.config.json` has the `ios` section + `iosScheme`.
- npm scripts: `app:sync:ios`, `app:open:ios`, `app:assets`.

## On the Mac — one-time setup
1. Install **Xcode** (Mac App Store) and open it once to accept the licence + install components.
2. Install **CocoaPods**: `sudo gem install cocoapods` (or `brew install cocoapods`).
3. Clone the repo and install deps:
   ```sh
   git clone <repo> && cd Hexa-Space-RND
   npm install
   ```
4. Add the iOS platform (scaffolds `ios/`, runs `pod install`):
   ```sh
   npx cap add ios
   ```
5. Generate the app icon + splash for iOS from `assets/`:
   ```sh
   npx capacitor-assets generate --ios
   ```
6. Build the web app and copy it in:
   ```sh
   npm run app:sync:ios
   ```
7. Open in Xcode:
   ```sh
   npm run app:open:ios
   ```
8. **Commit the `ios/` folder** to the repo (like `android/` is) so future syncs are reproducible.

## In Xcode — signing & release
1. Select the **App** target → **Signing & Capabilities**:
   - Team: your Apple Developer account.
   - Bundle Identifier: `au.com.hexaspace.member` (must match the App Store Connect record).
   - "Automatically manage signing" ✓.
2. General → set **Display Name** = Hexa Space, **Version** (e.g. 1.0.0) and **Build** (1).
3. Test: pick a Simulator or a connected iPhone → ▶︎ Run.
4. Release: **Product → Archive** → **Distribute App → App Store Connect → Upload**.

## App Store Connect
1. Create the app record (same bundle ID `au.com.hexaspace.member`).
2. Fill metadata: name, subtitle, description, keywords, support URL, **privacy policy URL**, category.
3. Upload screenshots (6.7", 6.5", 5.5" — the Simulator can screenshot each).
4. App Privacy questionnaire (the app collects account info, booking data — declare accordingly).
5. Once the archive is processed, add it to **TestFlight** (internal testers first), then **Submit for Review**.

**Repeat build:** after any web change → `npm run app:sync:ios` → Xcode → Archive → Upload. Bump the Build number each upload.

## No Mac? Cloud build options
- **Codemagic** — free tier, first-class Capacitor support; connects to the repo, builds + signs iOS in the cloud, uploads to TestFlight. Easiest no-Mac path.
- **Ionic Appflow** — Capacitor's own CI (paid) — native iOS builds without a local Mac.
- **GitHub Actions** with `macos-latest` runners — free minutes, more manual signing setup (upload your certs/profiles as secrets).
- **MacinCloud / rented Mac mini** — a real remote Mac desktop if you'd rather do it by hand.

## Review-rejection watch-out
Apple's Guideline **4.2 (minimum functionality)** rejects thin website wrappers. The
Hexa app has genuine app-level features (bookings, digital key/door unlock, invoices,
mail, printing), so it should pass — but adding **push notifications** and/or
**Face ID login** materially strengthens the case if a reviewer pushes back.

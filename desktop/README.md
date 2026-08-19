# Hexa Space Admin — desktop shell

A thin Electron window around the live admin portal, so office staff get a
taskbar/dock icon and their own window instead of a browser tab.

**It does not bundle the app.** `main.js` loads `https://portal.hexaspace.com.au`
at runtime, so the portal keeps updating on every Vercel deploy and nobody has
to reinstall. You only re-issue installers when this shell changes — the menu,
the download behaviour, the update feed.

## What it adds over a browser tab

- Own window, own icon, no address bar to lose the tab behind.
- Downloads (invoices, agreements, the Maxa fob order form, directory-board
  PNGs) save to Downloads and reveal themselves in Explorer/Finder.
- `Cmd/Ctrl+P` prints the current page through the OS print dialog.
- Links that leave the portal — Xero, Stripe, a member's website — open in the
  real browser rather than trapping staff in a chromeless window.
- Window size and position are remembered.
- Sessions persist, so staff log in once rather than every morning.

## Run it locally

```sh
cd desktop
npm install
npm start                                  # points at production
PORTAL_URL=http://localhost:5173 npm start # points at a local vite dev server
```

## Build installers

```sh
npm run dist:win   # → release/Hexa Space Admin Setup <version>.exe   (~95 MB)
npm run dist:mac   # → release/Hexa Space Admin-<version>-arm64.dmg, -x64.dmg
```

`dist:mac` **must run on a Mac.** Use the `Desktop installers` GitHub Actions
workflow (Actions tab → Run workflow) — it builds both platforms and attaches
the installers as artifacts. Push a `desktop-v*` tag to cut a versioned build.

## Signing — read before handing these to staff

Unsigned builds work, but they look alarming:

- **macOS** refuses to open the app: *"Hexa Space Admin can't be opened because
  Apple cannot check it for malicious software."* The workaround is right-click
  → Open → Open, once per machine.
- **Windows** shows a blue SmartScreen panel: *"Windows protected your PC"* →
  More info → Run anyway.

To get rid of both, add the repo secrets listed at the top of
`.github/workflows/desktop.yml`. macOS needs a **Developer ID Application**
certificate from the same Apple Developer account used for the member app
(note: that's a different certificate from the App Store one, from the same
$99/yr membership) plus an app-specific password for notarization. Windows
needs a code-signing certificate — an OV certificate still trips SmartScreen
until it builds reputation; an EV certificate does not.

## Auto-update

`main.js` calls `electron-updater` on launch, but it is a no-op until a publish
feed is configured in `electron-builder.yml`. Until then, a new version means
staff download and run the installer again. Wire this up once you've settled
where the installers are hosted.

## Versioning

Bump `version` in `package.json` before cutting a build — it's what shows in the
installer filename, the Windows "Apps & features" list, and the About dialog.

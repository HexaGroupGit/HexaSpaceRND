# Hexa Space Member App — Plan (Google Play + App Store)

Goal: ship the member portal as an installable app on both stores, with push
notifications as the headline win (mail/parcel arrivals, invoices, booking
confirmations) — the portal already has the features members need.

## Recommendation: wrap the existing portal with Capacitor

The portal is React + Vite. **Capacitor** (from the Ionic team) wraps that
exact codebase in a native iOS/Android shell — one codebase keeps serving
web + both apps, and native plugins give us the things a website can't do:
**push notifications**, app icon/splash, biometric unlock, deep links.

| Option | Play Store | App Store | Effort | Verdict |
|---|---|---|---|---|
| PWA / TWA (Trusted Web Activity) | ✓ | ✗ (Apple doesn't accept) | days | Android-only — not enough |
| **Capacitor wrapper (recommended)** | ✓ | ✓ | ~3–6 weeks to launch | Reuses the portal 1:1, native push |
| React Native / Expo rewrite | ✓ | ✓ | 2–3 months + second codebase forever | Only worth it if we outgrow the wrapper |

Apple-review note: pure "website in a box" apps risk rejection under
guideline 4.2 (minimum functionality). We mitigate by shipping bundled
assets (not a remote URL shell), push notifications, persistent native
login, and native splash/safe-area — the standard recipe coworking member
apps use to pass review.

Payments note: memberships, room hire and function bookings are real-world
services, so Apple's in-app-purchase cut does NOT apply (guideline 3.1.3(e))
— the existing Stripe Checkout flow is fine, opened in the in-app browser.

## Architecture

- **App shell**: Capacitor project in `mobile/` wrapping the built portal
  bundle (`npm run build` output). Same Supabase + Vercel APIs — zero
  backend changes for phase 1.
- **Updates**: web-asset releases ship with store updates initially; add a
  live-update service (Capgo / Appflow) later if release cadence hurts.
- **Auth**: Supabase session stored via Capacitor Preferences (survives app
  restarts); the set-password invite email deep-links into the app via
  universal links (`https://portal.hexaspace.com.au/*` → app).
- **Push**: Capacitor Push Notifications plugin → APNs (iOS) + FCM
  (Android). New `push_tokens` table keyed by member email; a small
  `api/push/send.js` helper the existing flows call:
  - 📬 mail/parcel logged (Mail & Deliveries register — already built)
  - invoice issued / overdue reminder / card charged receipt
  - booking + function-booking confirmations
  - new admin message in Messages
  Notification preferences toggle per category in Portal → Account.
- **Key access**: Salto stays its own app/mobile key for now; when Salto
  goes live we link out (or embed their SDK in a later phase).

## Phases

1. **Prep (~1 week, web-side)** — mobile-responsiveness audit of every
   portal page (safe-area insets, tap targets), app icon + splash from the
   Hexa brand, a public privacy-policy page on hexaspace.com.au, universal
   link routes.
2. **Wrap (1–2 weeks)** — Capacitor project, iOS + Android builds running,
   session persistence, in-app browser for Stripe/PDF links, TestFlight +
   Play internal testing with the team.
3. **Push (1–2 weeks)** — token registry, send helper, hooks into the mail
   register / overdue cron / booking flows, per-category preferences.
4. **Store launch (1–2 weeks incl. review)** — listings, screenshots,
   App Privacy questionnaire, submission; budget one Apple rejection
   round-trip.
5. **Later** — biometric unlock, offline caching of invoices/guides,
   Salto mobile-key integration, home-screen widgets (next booking).

## Costs & prerequisites

- Apple Developer Program: **US$99/yr** (company enrolment needs a D-U-N-S
  number for Hexa Space Pty Ltd — free, ~1–2 weeks lead time; start early).
- Google Play Console: **US$25 one-off**.
- iOS builds need a Mac + Xcode, or a cloud build service (Codemagic /
  Appflow, free tiers exist).
- Firebase project (free) for FCM.

## Why not now-now

Phase 1's real work is making every portal page feel native on a phone —
worth doing regardless (half the members already open the portal on
mobile). Start there while the D-U-N-S / dev accounts process in the
background.

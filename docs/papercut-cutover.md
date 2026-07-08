# PaperCut cutover runbook — OfficeRnD → Hexa connector

Migrates print provisioning, auth, and billing from the OfficeRnD PaperCut agent to the Hexa
connector (`scripts/papercut-connector/`). Runs on the Box Hill PaperCut server (PaperCut MF
22.0.9, internal Derby DB, XML-RPC API on `127.0.0.1`).

**No secrets in this file.** The Web Services auth token, Supabase keys, `PAPERCUT_SYNC_TOKEN`,
and any passwords live only in the gitignored `.env` / `providers/hexa/hexa-config.json` on the
server — never here.

## The charge model (what we're implementing)
- Each member gets **$30/month** print credit. Rates: **A4 $0.30 b/w / $0.60 colour · A3 $0.60 /
  $1.20**.
- Accounts are **restricted** (so the balance is tracked) **with overdraft enabled** (so members
  are **never blocked** — they print past $30 into a negative balance).
- **Month-end** (`index.mjs`, before the native quota allocation): bill `abs(negative balance)` as
  fees → the bill run folds it onto the invoice → **reset billed members to $30**. The native
  monthly quota tops up everyone else, capped at $30 (MaxAccumulation = 30), so no double credit.

## Hard gates (do not start Phase 3/5 until true)
1. **Overdraft enabled globally** before anyone is set restricted (else restricting blocks at $0).
2. **Members have portal passwords** before the auth switch (Phase 5) — anyone without one can't
   print after it. Depends on the portal migration.
3. **Elevated shell** for `server.properties`, the config ACL tighten, service changes, and the
   admin-console settings.
4. **Stop the OfficeRnD prune (Phase 1) before any live provision** — its nightly ~21:32
   `deleteExistingUser` removes non-OfficeRnD users, so provisioned accounts vanish within hours.

## Pre-flight (read-only)
- Confirm elevated.
- `server.properties`: current `auth.source.custom-program` (should be OfficeRnD's
  `papercutauth.exe`), web-services enabled, allowed-hosts.
- Connector files present in the checkout: `provision-members.mjs`, `sync-pins.mjs`,
  `sync-print-jobs.mjs`, `index.mjs`, `hexa-auth.cmd`, `auth-provider.mjs`, `hexa-config.json`,
  `.env`. Confirm `index.mjs` is the version with the $30 reset (`git pull` first).
- Snapshot for rollback: total user count; a few users' `restricted` + `balance`; the current
  `auth.source.custom-program`.

## Phase 1 — stop the nightly prune (reversible)
- `Stop-Service PaperCutCA; Set-Service PaperCutCA -StartupType Disabled`
- Verify stopped + disabled. Note: OfficeRnD no longer provisions new members, so the connector
  must take over (Phase 2).
- **Rollback:** `Set-Service PaperCutCA -StartupType Automatic; Start-Service PaperCutCA`

## Phase 2 — connector takes over provisioning
- Dry-run: `node provision-members.mjs` (APPLY unset) → review CREATE/ASSIGN/KEEP counts.
- Live: `PAPERCUT_PROVISION_APPLY=1 node provision-members.mjs` — creates users + auto-generates a
  PIN (primary-card-number) at creation; backfills a PIN for any existing member missing one.
- Verify: a newly-created member persists (no prune now), has a card, and appears in `member_pins`
  after `node sync-pins.mjs`.
- Schedule a nightly Task running `provision-members.mjs` so new signups get accounts.

## Phase 3 — restricted + overdraft + $30 quota (no cap) — GATED
Hard pre-steps (verify first):
1. **Enable overdraft** globally (Options → General → restricted-user overdraft) with a
   high/effectively-unlimited limit. Confirm it's set (default is currently empty = off).
2. **Confirm A3 b/w page cost = $0.60** in the admin console (A4 $0.30/$0.60 + A3 colour $1.20
   verified from print logs; A3 b/w inferred).
3. Confirm `index.mjs` is the pulled version with the reset; `PAPERCUT_DRY_RUN=1 node index.mjs`
   runs clean.

Test 2 members: set `restricted=TRUE` (overdraft on) → confirm they hold ~$30 and a forced
negative is allowed (not blocked). **Pause for sign-off.**

Bulk (after go): set active members restricted + in the $30 quota group; ensure each holds the
current month's $30. Verify sample balances = $30, not capped; run `sync-pins.mjs`.

## Phase 4 — schedule the syncs
Windows Task Scheduler:
- `sync-pins.mjs` — daily (PINs + balances → portal dashboard).
- `sync-print-jobs.mjs` — daily (job history → portal Printing tab).
- `index.mjs` — monthly, **month-end BEFORE the native quota allocation** and before the bill run
  (its reset assumes it reads the true negative balance).
Run each once manually first.

## Phase 5 — switch print login to portal credentials — GATED on portal passwords
- Copy `hexa-auth.cmd` + `auth-provider.mjs` + `hexa-config.json` to
  `C:\Program Files\PaperCut MF\providers\hexa\`.
- Add that dir to `security.custom-executable.allowed-directory-list`.
- Set `auth.source.custom-program` → `…\hexa\hexa-auth.cmd`; `auth.source.env-vars` →
  `HEXA_AUTH_CONFIG=…\hexa\hexa-config.json`.
- Restart the PaperCut app server.
- Verify: a member logs in with their **portal** password through the real PaperCut path; a member
  with **no** portal password is correctly refused.
- **Rollback:** point `auth.source.custom-program` back to `papercutauth.exe`, restart. Keep
  `papercutauth.exe` in place until confident.
- (Known cosmetic: `auth-provider.mjs` prints a libuv teardown assertion on exit; stdout is
  flushed first and PaperCut ignores the exit code. Harden later by draining stdin before exit.)

## Phase 6 — lockdown + post-cutover watch
- Tighten the ACL on `providers\config.json` (holds cleartext OfficeRnD + API secrets) to
  Administrators + SYSTEM only.
- That night ~21:32: confirm **no prune** ran (PaperCutCA disabled).
- Confirm a fresh test signup gets a PaperCut account from the nightly provision task.
- After a soak period, retire the OfficeRnD agent.

## Validation status (as of go-live prep)
- ✅ PIN auto-created at provisioning · PIN + balance → `member_pins` → dashboard · restricted +
  $30 produces a real balance · portal-credential login (positive + negative) · `index.mjs` reset
  loop present and dry-run clean.
- ⏳ Overdraft enablement · bulk restrict · auth switch (needs portal passwords) · scheduling.

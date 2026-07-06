# PaperCut Integration — Investigation

Status: **BUILD** (not yet started). Scoped here for the "PaperCut print billing → invoices"
item in [officernd-audit.md](officernd-audit.md) (§Integrations, last in order: Xero → Salto → PaperCut).

Goal: pull per-member print usage/charges out of PaperCut and land them as **PaperCut**-type
rows in the Fees table, which the bill run already folds onto each company's month-end invoice.

---

## 1. What "the PaperCut API" actually is

PaperCut NG/MF exposes an **XML Web Services API over XML-RPC** (there is no separate
"API v3" product — the versioned thing is the PaperCut server release, currently the NG/MF
line). Key facts, confirmed from PaperCut docs:

- **Endpoint:** `http://<server>:9191/rpc/api/xmlrpc` (TLS on `:9192`).
- **Auth:** an `authToken` string is the **first argument of every call**. It's set in
  PaperCut under *Options → Advanced → "Web Services API auth token"*.
- **Network lockdown (the load-bearing constraint):** the API is **restricted to
  `127.0.0.1` by default**. Remote callers must be explicitly allow-listed on the PaperCut
  server (`Options → Advanced → allowed IP addresses for Web Services`). A cloud host can't
  just dial in.

Relevant methods (names confirmed against the manual; property strings from PaperCut's
documented set — verify against the exact server version before coding):

| Need | Method |
|------|--------|
| Read a user's balance | `api.getUserAccountBalance(auth, user)` |
| Read usage counters | `api.getUserProperty(auth, user, prop)` — props incl. `balance`, `print-stats.page-count`, `print-stats.job-count` |
| Reset/adjust after billing | `api.adjustUserAccountBalance(auth, user, adjustment, comment)` |
| List users to iterate | `api.listUserAccounts(auth, offset, limit)` |
| Per-company (shared) accounts | `api.getSharedAccountAccountBalance`, `api.getSharedAccountProperty` |

There is **no REST endpoint** for pulling a transaction log in the classic on-prem product.
The documented paths for third-party billing are (a) the XML-RPC balance/property calls
above, (b) **scheduled CSV report export**, or (c) the **External Database / print-log
integration** (direct read of `printer_usage_log`).

> If Hexa is actually on **PaperCut Hive/Pocket** (cloud, serverless — plausible given
> `print.hexaspace.com.au` + "install the PaperCut client" + tap-to-release), the XML-RPC
> API does **not** apply and the integration story is different/thinner. **First open
> question to resolve: which PaperCut product and version is running at Box Hill?**

---

## 2. The architecture problem

Hexa's backend is **Vercel serverless functions** (`api/*.js`) talking to **Supabase**.
The PaperCut server is **on-prem at 402/830 Whitehorse Rd** with a localhost-bound API.
A Vercel function **cannot reach** that API directly. So the design choice is:

- **A. On-prem connector (push) — recommended.** A small scheduled script runs on/near the
  PaperCut server, calls XML-RPC (localhost, no firewall change), computes each member's
  charges for the period, and POSTs them to a new `POST /api/papercut/sync` endpoint that
  writes Fees rows to Supabase. Keeps the sensitive API on the LAN; mirrors how our other
  integrations stay server-side.
- **B. Expose XML-RPC + pull.** Reverse-proxy/VPN the PaperCut port and IP-allowlist Vercel
  egress, then have a cron function pull. **Not recommended** — exposes a print-admin API
  (it can adjust balances) to the internet for little gain.
- **C. Scheduled CSV drop.** PaperCut emails/writes a "User printing – summary" report on a
  schedule; ingest the CSV. Lowest-tech, no live API, but delayed and format-fragile. Good
  **interim** step (it's effectively what [scripts/align-july-to-xero.mjs](../scripts/align-july-to-xero.mjs)
  did by hand for June 2026 — "PaperCut printing fees — June 2026" line items).

---

## 3. Proposed build (path A), mirroring the Salto scaffold

Follow the existing env-gated **mock-then-live** pattern from
[api/salto/provision.js](../api/salto/provision.js):

1. **`api/papercut/sync.js`** — `POST`. Accepts `{ period, usage: [{ email, pages, jobs, amount }] }`
   from the on-prem connector (shared secret in `PAPERCUT_SYNC_TOKEN`). For each row:
   match member by email → upsert a Fee `{ type: 'PaperCut', name: 'PaperCut printing — <period>',
   memberId, companyId, date, price: amount, status: 'Not Paid' }`. Idempotent per
   `(memberId, period)` so re-runs don't double-charge. Mock mode when the token is unset.
2. **On-prem connector** (Node or PowerShell; the shop is Windows) — reads the auth token
   from env, iterates users via `api.listUserAccounts`, reads charges, POSTs to `/api/papercut/sync`.
   Ship it in `scripts/papercut-connector/`.
3. **Fees model** already supports this — `'PaperCut'` is a first-class type in
   [src/components/Fees.jsx](../src/components/Fees.jsx#L6) and `addFee` writes to the `fees`
   table ([src/store/useStore.js:1231](../src/store/useStore.js#L1231)). No schema change: a
   synced fee is just an `addFee` with `type: 'PaperCut'` and `status: 'Not Paid'`.
4. **Bill run needs no change** — the month-end run already folds unbilled, company-linked,
   priced, non-{Paid,Waived,Invoiced} fees onto the first invoice per company and flips them
   to `Invoiced` ([src/store/useStore.js:966-1057](../src/store/useStore.js#L966-L1057)). A
   synced PaperCut fee flows through automatically.

### Charge model — RESOLVED (confirmed 6 Jul 2026)
Hexa gives each member a **$30/month print allowance** (auto top-up), drawn down at
PaperCut's configured rates (**$0.30 mono / $0.60 colour**). A member's balance only goes
**negative** once they print past $30, and **that negative amount is exactly what Hexa bills**.
At month-end the balance resets to $30.

So the connector bills `abs(balance)` **only for users with a negative balance** — PaperCut
has already computed the mono/colour cost, so no page split is needed. `print-stats.*` counts
are **lifetime**, not per-period, so they are NOT used for billing.

**TIMING IS LOAD-BEARING:** the connector must run at **month-end, BEFORE the reset to $30**.
Run it after the reset and every balance reads +$30 → nothing bills. A dry run mid-month
correctly shows ~zero overage (few members have exhausted $30 yet).

Verified in dry run: reading `balance` off the wrong assumption (bill everyone's balance)
produced $10,214.30 of bogus charges across 343 users all showing +$30 (their untouched
allowance). Corrected to negative-balance-only.

---

## 3a. Confirmed on-network diagnosis (6 Jul 2026)

Probed the live server from a LAN box (`172.16.200.73`):

- Server: **`172.16.200.14`**, XML-RPC ports **9191 (http) / 9192 (https) both reachable**.
- **XML Web Services API is enabled** — `POST /rpc/api/xmlrpc` returned a proper
  `methodResponse` fault, not a 404/refusal.
- The API is gated by **IP allow-list only** — a call from `172.16.200.73` returned
  *"Access denied. Your IP address is not allowed to access the Web Services API."*
  (It rejected on IP, not on the token → a real token from an allowed IP will work.)

**Consequence — connector placement:**
- **Run the connector ON `172.16.200.14`** → calls `localhost:9191`, allowed by the default
  `127.0.0.1` entry, **no allow-list change, token stays on the server**. Preferred.
- Run it elsewhere → add that host's IP to *Options → Advanced → allowed Web Services IPs*
  (`auth.webservices.allowed-addresses`) and set `PAPERCUT_SERVER=http://172.16.200.14:9191`.

Still needed: the **auth token** (Options → Advanced) as `PAPERCUT_AUTH_TOKEN` on the box.

## 3b. Member print-PIN display (built 6 Jul 2026)

Members forget their PaperCut PIN, so show each member **their own** PIN in the app and
portal. A PIN is a credential, so this is built owner-only:

- **Data source:** `api.getUserProperty(user, 'pin')` (confirmed field is `pin`).
- **Why not on the members row:** the app ([useMemberData.js](../src/app/lib/useMemberData.js))
  and portal ([PortalApp.jsx](../src/portal/PortalApp.jsx)) fetch the **whole members table
  into the browser**, and every project table grants `anon`/`authenticated` full read
  (`using (true)` — see any `*-schema.sql`). Anything on a member row is readable by every
  logged-in member. So a PIN there would leak to everyone.
- **Storage:** separate **`member_pins`** table ([member-pins-schema.sql](../member-pins-schema.sql))
  with RLS on and **no** anon/authenticated policy → client reads denied; only the service
  role touches it.
- **Write path:** [scripts/papercut-connector/sync-pins.mjs](../scripts/papercut-connector/sync-pins.mjs)
  → `POST /api/papercut/pins` (sync-token auth) → `member_pins`. Never logs a PIN.
- **Read path (owner-only):** `GET /api/portal/print-pin` verifies the caller's Supabase JWT
  server-side (`auth.getUser`) and returns **only that verified email's** PIN — the email
  comes from the signed token, not a query param, so no one can request another's PIN.
- **Display:** app [Printer.jsx](../src/app/screens/Printer.jsx) and portal
  [PortalGuides.jsx](../src/portal/PortalGuides.jsx), each fetching the authed endpoint.

> Side note surfaced during this work: the project's blanket `using (true)` RLS means the
> public anon key can read all business tables from any browser. Out of scope for PaperCut,
> but worth a dedicated security pass.

## 3c. Member provisioning — OfficeRnD model (built 6 Jul 2026)

Chosen approach (matches how OfficeRnD's PaperCut integration works): an on-prem tool
provisions **Hexa members → PaperCut users**, companies → **groups**, with a generated
**PIN** as the printer identity. **No password is copied** from Hexa/Supabase — members
authenticate at the device with their PIN. Unified experience comes from auto-provisioning,
not password mirroring.

- **Roster:** `GET /api/papercut/members` (sync-token auth) returns active members
  `{ email, fullName, companyId, companyName }` + `usedPins` (so the provisioner avoids PIN
  collisions). Active = has email and `portalAccess !== false`.
- **Provisioner:** [scripts/papercut-connector/provision-members.mjs](../scripts/papercut-connector/provision-members.mjs).
  **DRY-RUN by default; writes only with `PAPERCUT_PROVISION_APPLY=1`.** For each member:
  `api.isUserExists` → if absent `api.addNewInternalUser(user, pw, fullName, email, '', pin)`
  (random pw never used for login), else refresh `full-name`/`email`; `api.addNewGroup` +
  `api.addUserToGroup` for the company. **Existing users' PINs are never overwritten.**
- **Login number read-back for display:** run [sync-pins.mjs](../scripts/papercut-connector/sync-pins.mjs)
  after provisioning. Reads **`primary-card-number`** → member_pins → shown in app/portal ([[3b]]).

**IMPORTANT — the "PIN" is the Primary Card/Identity number (`primary-card-number`).** On this
MF version the properties `pin` and `card-pin` are **not valid** (the API rejects the names),
which silently returned 0 in early runs. The number members type at the copier is
`primary-card-number` (e.g. `5927`). Provisioning **keeps** any existing number and **generates
+ sets** one (unique, 4-digit) for members who have none — created users get it via
`addNewInternalUser`'s 6th arg (cardId), existing users via `setUserProperty(user,
'primary-card-number', n)`.

Confirmed API signatures (PaperCut reference proxy): `addNewInternalUser(auth, username,
password, fullName, email, cardId, pin)`, `isUserExists(auth, username)`, `setUserProperty
(auth, username, prop, value)`, `addUserToGroup(auth, username, group)`, `addNewGroup(auth,
group)`.

### Full end-to-end flow (target state)
1. Member invited to Hexa portal → sets password (Supabase). ✅ exists
2–4. Nightly/on-demand `provision-members.mjs` creates their PaperCut user + group + PIN. 🔨 built, needs live run
5. Member installs PaperCut client. ✅ guide
6. Auth at printer = **PIN** (not Supabase password). ✅ via provisioning
7. PIN shown in app + portal. ✅ built
8. Print → hold/release at device via PIN. ✅ native PaperCut config
9. Month-end: negative balance → fee → invoice. ✅ built
10. Balance resets; show live balance + payable on portal. 🟡 live-balance display still to build

## 4. Open questions (resolve before coding)

1. **Which PaperCut product + version?** MF/NG (on-prem, XML-RPC) vs Hive/Pocket (cloud).
   This gates everything above.
2. **Where can a connector run?** Is there a reachable box on the Box Hill LAN we can schedule?
3. **Account structure** — personal vs shared accounts per company.
4. **At-cost vs marked-up** print billing.
5. Interim: is a **monthly CSV export** acceptable for the first cutover, with live sync later?

## Sources
- [The XML Web Services API — PaperCut](https://www.papercut.com/help/manuals/ng-mf/common/tools-web-services/)
- [XML Web Services — tips and tricks — PaperCut](https://www.papercut.com/help/manuals/ng-mf/common/tools-web-services-tips/)
- [External System and Integration APIs — PaperCut](https://www.papercut.com/kb/Main/ExternalDataSourceAPI)

# PaperCut MF connector

Pushes monthly print charges from the **on-prem PaperCut MF server** at Box Hill into
Hexa's Fees, where the bill run folds them onto each company's invoice.

**Why a connector and not a Vercel function:** PaperCut MF's XML-RPC API is bound to
`127.0.0.1` and its auth token is print-admin-grade (it can adjust balances). This script
runs on the LAN so that API never faces the internet. Full rationale + alternatives:
[docs/papercut-integration.md](../../docs/papercut-integration.md).

## One-time setup (on the Box Hill box)

1. **Enable the API** in PaperCut: *Options → Advanced → Enable XML Web Services*, copy the
   **auth token**. If the script runs on a different host than the PaperCut server, also add
   that host's IP to the allowed-addresses list.
2. Install Node 18+ and this folder's dep:
   ```
   cd scripts/papercut-connector
   npm i xmlrpc
   ```
3. Set env (Task Scheduler action, or a local `.env` you load):
   | var | value |
   |-----|-------|
   | `PAPERCUT_SERVER` | `http://localhost:9191` (or `https://…:9192`) |
   | `PAPERCUT_AUTH_TOKEN` | the Web Services auth token |
   | `HEXA_SYNC_URL` | `https://portal.hexaspace.com.au/api/papercut/sync` |
   | `PAPERCUT_SYNC_TOKEN` | shared secret — **must match** the same var set on Vercel |

## Run

```
# preview only — no POST, prints the payload:
PAPERCUT_DRY_RUN=1 node index.mjs --period 2026-07

# live (defaults to the previous calendar month if --period omitted):
node index.mjs --period 2026-07
```

Schedule it monthly, a day or two **before** the bill run, so charges are `Not Paid` in
time to be folded onto the month-end invoices.

## Before go-live — decide the charge model

The script defaults to reading each user's **personal-account balance** as the amount.
Confirm this matches how members actually pay for printing (personal credit vs per-company
shared accounts) and whether to bill **at cost or with markup** — see the open questions in
[docs/papercut-integration.md](../../docs/papercut-integration.md#4-open-questions-resolve-before-coding).
Method/property names are from PaperCut's documented set; verify against your exact MF
version. Test with `PAPERCUT_DRY_RUN=1`, then a single-user live run, before the first full month.

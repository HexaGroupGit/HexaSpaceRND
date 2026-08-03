---
slug: xero-sync
title: How Xero sync works and what to do when it errors
category: billing
audience: [ops, admin]
route: /settings
relatedCode:
  - api/xero/sync.js
  - api/xero/status.js
  - api/xero/_client.js
  - src/components/InvoiceDetail.jsx
relatedSops: [create-a-one-off-invoice, record-a-bank-payment, monthly-bill-run]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Understand what reaches Xero, what comes back, and what to do when an invoice isn't where you expect it.

## When to do this

An invoice is missing from Xero, a payment isn't reflected on the platform, or the connection has dropped.

## How it works

The sync runs **hourly at :45 past** and goes both ways:

- **Push** — platform invoices and credit notes out to Xero.
- **Pull** — payment status back from Xero, so an invoice reconciled in Xero marks itself paid here.

Two gates control what gets pushed:

1. **Enable Xero sync** must be on in Settings → Integrations. Without it, pushes are refused — but a **dry run** still works and shows what *would* go.
2. **`syncFrom`** — a cut-off date (default `2026-09-01`). Migrated history from before it stays out of Xero deliberately.

Each line's **revenue account** decides its Xero account code, including whether it codes to Level 2 or Levels 4&5.

## Steps — check an invoice

1. Open the invoice in **Billing**.
2. Read the badge in the header: **Synced to Xero** (linked, payments pull back automatically) or **Not synced** (will go on the next push, if it's inside the window).

## Steps — check the connection

1. Open **Settings** → Integrations → Xero.
2. Confirm it shows connected, with the organisation name and the last push and pull times.
3. If the last push is hours old, something is wrong.

## Steps — preview without sending

Run a **dry run**. It reports exactly what would be pushed, writes nothing to Xero or the platform, and works even while sync is switched off.

## What happens automatically

- Payment status pulls back from Xero, so **you often don't need to record a bank payment by hand** — check Xero before doing it manually, or you'll double-record.
- The push **adopts an existing same-numbered Xero invoice** rather than overwriting it, which is what stopped it clobbering Xero twins (fixed 16 July 2026).
- Credit notes, including bond refunds, push as Xero credit notes.
- Reconnecting no longer clobbers the stored token — a bug fixed 9 July 2026.
- Invoices dated before the `syncFrom` cut-off are skipped by design. Their absence from Xero is not a fault.

## Common mistakes

- **Recording a bank payment by hand without checking Xero.** The pull may already have done it; you'll over-pay the invoice.
- **Reading "Not synced" as broken.** It may simply be waiting for the next hourly push, or be outside the sync window.
- **Expecting migrated history in Xero.** Pre-cut-off invoices are deliberately excluded.
- **Turning sync on to "test it".** Use a dry run — that's what it's for.
- **Fixing a Xero coding problem in Xero only.** The next push may re-assert the platform's version. Fix the revenue account on the invoice too.

## If something goes wrong

- **"Xero sync is switched OFF in Settings…"** — expected while it's off. Dry-run instead, or turn it on deliberately.
- **The connection has dropped** — reconnect from Settings → Integrations. The token-clobber bug is fixed, so reconnecting is safe.
- **An invoice won't push** — check its date against `syncFrom`, then run a dry run to see whether it's listed and why.
- **Amounts disagree between systems** — do not "fix" one side. Escalate to Eric; Xero is the source of truth for anything pre-July 2026.

## Related

- [Create a one-off invoice](create-a-one-off-invoice.md)
- [Record a bank transfer payment](record-a-bank-payment.md)
- [How the monthly bill run works](monthly-bill-run.md)

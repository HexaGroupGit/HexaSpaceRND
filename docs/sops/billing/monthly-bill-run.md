---
slug: monthly-bill-run
title: How the monthly bill run works and what to check
category: billing
audience: [ops, admin]
route: /billing
relatedCode:
  - api/auto-billing.js
  - src/lib/billingEngine.js
  - src/components/Billing.jsx
  - api/reconcile.js
relatedSops: [create-a-one-off-invoice, xero-sync, nightly-reconcile]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Understand the automatic monthly invoicing so you can confirm it ran correctly — and spot the month it didn't.

## When to do this

Every month, on the **2nd**. See below for why it isn't the 1st.

## When it actually runs

The cron is `30 21 1 * *` — 21:30 UTC on the 1st. In Melbourne that is **7:30am on the 2nd** (8:30am during daylight saving). Invoices are still *dated* the 1st, because the issue date comes from the billing period, not the run time.

It must run **after** the nightly reconcile (20:30 UTC, ~6:30am Melbourne), which is what rolls an auto-renewing contract forward. Billing used to run at 00:00 UTC on the 1st — about 20 hours *before* that roll — so a contract ending on the last day of a month looked already-ended and was skipped entirely. That silently lost $2,100 ex GST of Canwealth office rent in August 2026. **If either cron is ever moved, billing must stay later than reconcile.**

## Steps — the monthly check

1. Open your inbox on the 2nd and find the **Auto Bill Run** admin summary (sent to info@). It lists invoices created, skipped, and errored.
2. Open **Billing** → **Invoices** and confirm the new invoices are there, dated the 1st.
3. Read the **skipped** list in the email. Every skip carries a reason — see the table below. Anything you don't recognise is worth investigating.
4. Check **errors**. These are real failures, not skips.
5. Spot-check one invoice: open it and confirm the period, the amount and the space are right.

## Steps — run it manually

1. Open **Billing** → **Invoices**.
2. Click **⚡ Auto Bill Run** to run the full server-side job (creates invoices *and* emails tenants), or **Bill Run** to generate invoices in-app without emailing.
3. Confirm the dialog and read the result panel.

## What happens automatically

- Every **active** contract is priced through the shared billing engine, so the in-app Bill Run and the cron can never disagree.
- Pricing comes from the contract's payment schedule: step pricing, discounts already netted off, office and parking split onto separate lines, and proration for partial months.
- **Skip reasons**, all of them deliberate:

  | Reason | Meaning |
  |---|---|
  | `already billed` | An invoice for that month key already exists |
  | `not started` / `ended` | Outside the contract's billable window |
  | `rent free` | The schedule marks that month $0 |
  | `prepaid` | A migrated prepayment covers the month |
  | `zero amount` | Nothing to charge |
  | `no dates` | The contract has no start date |

- Billing is **capped by notice**. A served notice or scheduled termination caps invoicing at the vacate date and prorates the final month to it, even while the contract still reads active.
- Each invoice is emailed to the billing contact with a **Pay this invoice online** link and the bank details from Settings.
- Dedup is on the **month key**, not an exact date — so a prorated invoice landing mid-month still blocks a re-bill.
- Invoice numbers are allocated read-max-plus-one and re-read immediately before each insert. There is a small residual race if the in-app Bill Run is used at the same time as the cron.

## Common mistakes

- **Checking on the 1st and panicking.** It runs the morning of the 2nd, Melbourne time.
- **Running the in-app Bill Run while the cron is running.** Both allocate numbers the same way; running them together risks duplicate numbers. Don't touch it on the morning of the 2nd until the summary email arrives.
- **Reading "skipped" as "broken".** Most skips are correct. Read the reason.
- **Assuming a $0 or rent-free month is a bug.** Check the contract's payment schedule first.
- **Missing a whole month because a contract lapsed.** This is the failure mode that cost real money. If a company you expect to see isn't in the created list, check their contract's end date.

## If something goes wrong

- **A company was skipped and shouldn't have been** — open their contract and check the end date, notice fields and status. Then raise the invoice manually.
- **Errors in the summary** — usually a contract with no company attached. Fix the link and re-run.
- **Duplicate invoices for one month** — void one. Check whether both the cron and the in-app run fired.
- **No summary email at all** — the run may not have fired. Trigger it manually with **⚡ Auto Bill Run** and tell Eric.

## Related

- [Create a one-off invoice](create-a-one-off-invoice.md)
- [What the nightly reconcile does](nightly-reconcile.md)
- [How Xero sync works](xero-sync.md)

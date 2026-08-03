---
slug: cron-jobs
title: All cron jobs — what runs when, and how to tell if one failed
category: system-administration
audience: [ops, admin]
route: /
relatedCode:
  - vercel.json
  - api/reconcile.js
  - api/auto-billing.js
  - api/overdue-reminders.js
relatedSops: [nightly-reconcile, monthly-bill-run, escalation]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Know everything that runs on a schedule, when it runs in Melbourne time, and how you'd know if it stopped.

## The nine jobs

Times are **AEST (UTC+10)**; during daylight saving add an hour.

| Melbourne time | Job | What it does | How you'd know it ran |
|---|---|---|---|
| **Hourly, :45 past** | Xero sync | Pushes invoices, pulls payment status | Settings → Integrations shows last push/pull |
| **Hourly, :15 past** | Room access | Grants and reconciles meeting-room door access | Members get into booked rooms |
| **6:30am daily** | **Reconcile** | Onboarding, expiries, renewals, overdue warnings, card chasers, door sweep, directory refresh | **Daily reconcile digest email** |
| **9:00am daily** | Overdue reminders | Marks invoices overdue, sends reminders, auto-charges cards, enforces door suspension | Reminder emails; **Reminded** badges on invoices |
| **7:30am on the 2nd** | **Monthly bill run** | Creates and emails every membership invoice | **Auto Bill Run summary email** |
| **8:00am daily** | Event reminders | Reminds event registrants | Registrants receive them |
| **7:00pm daily** | Lead nurture | Follow-up emails at 2/5/9 days, Lost at 14 | Leads move; follow-ups sent |
| **7:00am daily** | Function reminders | Reminds function clients | Clients receive them |
| **7:00pm daily** | Function nurture | Nurtures function enquiries | Enquiries followed up |

## The one ordering rule

**The bill run must stay later than the reconcile.**

Reconcile rolls an auto-renewing contract forward; the bill run then bills the new period. Billing used to run about 20 hours *before* that roll, so a contract ending on the last day of a month looked already-ended and was skipped — silently losing $2,100 ex GST of Canwealth office rent in August 2026.

Currently reconcile is 6:30am and billing 7:30am on the 2nd. **If either is ever moved, preserve that order.**

## Note the dates

- The bill run cron is set for the **1st**, but runs at **7:30am Melbourne on the 2nd**. Invoices are still dated the 1st, because the issue date comes from the billing period, not the run time.
- The daily jobs scheduled at 20:30–23:00 UTC land the **following morning** Melbourne time.

## Steps — check they're running

1. **Every morning**: the daily reconcile digest. No digest and nothing happening means it didn't run.
2. **The 2nd of each month**: the Auto Bill Run summary.
3. **Settings → Integrations**: Xero's last push and pull times. Hours old means something's wrong.
4. Reconcile and the bill run can both be triggered by hand — reconcile from a company's cancellation approval, the bill run from **⚡ Auto Bill Run** on the Billing page.

## What happens automatically

- Reconcile emails its digest **only when something happened**. A quiet day legitimately produces nothing.
- The bill run always emails its summary.
- Cron endpoints are protected by a shared secret. **If that secret isn't configured they still run, flagged as unguarded** — so the jobs work before it's set, but the protection isn't active.
- Several jobs are idempotent by stamping their work, so a manual re-run won't double-send.

## Common mistakes

- **Panicking on the 1st that billing hasn't run.** It runs the morning of the 2nd.
- **Reading no digest as failure.** It only sends when there was something to report.
- **Running the in-app Bill Run on the morning of the 2nd** while the cron may be running. Wait for the summary.
- **Moving a cron without checking the ordering rule.**
- **Assuming a cron did the whole job.** Parts of offboarding wait for an admin to load the app.

## If something goes wrong

- **No digest and no bill run** — trigger the bill run manually from Billing and tell Eric.
- **The same error in the digest every morning** — it's failing nightly. Escalate.
- **Xero's last push is stale** — reconnect from Settings → Integrations.
- **A job ran twice** — check for duplicate invoices or emails before assuming it's harmless.

## Related

- [What the nightly reconcile does](../billing/nightly-reconcile.md)
- [How the monthly bill run works](../billing/monthly-bill-run.md)
- [Escalation](escalation.md)

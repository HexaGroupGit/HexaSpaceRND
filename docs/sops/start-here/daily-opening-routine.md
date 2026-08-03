---
slug: daily-opening-routine
title: Daily opening routine
category: start-here
audience: [reception, ops, admin]
route: /
relatedCode:
  - src/components/Dashboard.jsx
  - api/reconcile.js
relatedSops: [platform-overview, nightly-reconcile, overdue-ladder]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Catch overnight events, and start the offboarding work that waits for someone to open the app.

## When to do this

First thing, every morning. It takes about ten minutes.

## Why it matters

Parts of the platform genuinely wait for an admin to load the app. The nightly reconcile flags contracts as expired, but freeing the space, raising the bond refund and revoking portal access run **in the browser**, when an admin next opens it. **Nobody opening the admin app means those never happen.**

## Steps

### 1. Read the daily reconcile digest

In your inbox — subject **Daily reconcile — <date>**. It only arrives if something happened. Act on:

- **🖐 cancellations AWAITING YOUR APPROVAL** — a company past 90 days overdue needs a decision.
- **⚠ bond refund(s) overdue** — past 45 days on a 60-day promise.
- **✗ errors** — real failures.
- **🔑 door access revocations** — look for *NO WEBHOOK, remove manually in KS*.

### 2. Open the Dashboard

This is also what triggers the pending offboarding work. Check the two alert panels:

- **N contracts awaiting your countersignature** — a client has signed and is waiting on us. Nothing progresses until you countersign. Click **Review & countersign →**.
- **Door access suspended** — companies whose team has lost access over overdue invoices.

Then glance at the KPI row: **Occupancy**, **MRR**, **Collected This Month**, **Overdue Amount**.

### 3. Bookings and Calendar

Today's meeting rooms and function bookings. Check for anything needing setup, and any drop-in arrivals.

### 4. Mail & Deliveries and Food Orders

Parcels to log or release, and today's café orders.

### 5. Maintenance and Messages

New tickets, and unread member messages. Both show unread counts in the sidebar.

## Monthly additions

- **On the 2nd** — the bill run has just fired. Check the **Auto Bill Run** summary email and the new invoices. See [How the monthly bill run works](../billing/monthly-bill-run.md).
- **Weekly** — check **Renewals** for contracts expiring within 60 days, and **Contracts** for anything stuck on **Out For Signature**. Neither has an automatic chaser.

## What happens automatically

- The reconcile has already run at about 6:30am Melbourne: onboarding, expiries, renewals, overdue warnings, card chasers, door sweeps and directory refreshes.
- Overdue reminders have gone out at about 9am.
- Xero has synced on the hour.
- **The offboarding cascade has not run** — that waits for you.

## Common mistakes

- **Skipping the Dashboard because "nothing looks urgent".** Loading it is what runs the pending offboarding work.
- **Only reading the digest.** The countersignature panel is on the Dashboard, not in the email.
- **Leaving a countersignature overnight.** Nothing moves for that client until it's done — no invoices, no access, no welcome pack.
- **Assuming unsigned contracts will chase themselves.** They won't. That's the weekly check.

## If something goes wrong

- **No digest arrived** — either nothing happened, or the reconcile didn't run. If renewals and expiries also look stale, tell Eric.
- **The digest lists errors repeating daily** — it's failing every night. Escalate.
- **A space still shows occupied for a departed client** — load the Dashboard, then re-check. If it persists, escalate.

## Related

- [What the nightly reconcile does](../billing/nightly-reconcile.md)
- [Countersign and send the getting-started pack](../contracts/countersign-a-contract.md)
- [The overdue ladder](../billing/overdue-ladder.md)

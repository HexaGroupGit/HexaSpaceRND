---
slug: nightly-reconcile
title: What the nightly reconcile does
category: billing
audience: [ops, admin]
route: /
relatedCode:
  - api/reconcile.js
relatedSops: [monthly-bill-run, overdue-ladder, renew-a-contract]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Understand the one job that quietly runs the whole lifecycle overnight — so you can read its digest and know what it did.

## When to do this

Every morning, when the **Daily reconcile** digest lands. Read it before anything else.

## When it runs

`30 20 * * *` — 20:30 UTC, which is about **6:30am Melbourne** the next morning (7:30am during daylight saving). The monthly bill run deliberately runs an hour later, so contracts roll forward before they are billed.

## What it does, in order

1. **Commencement flips** — a paid-up contract whose start date has arrived flips its space from reserved to occupied.
2. **Onboarding catch-up** — contracts that cleared the paid gate while nobody had the app open get their welcome email and portal invite. Someone who moved in long ago is stamped, not emailed.
3. **Card-on-file chaser** — signed card-required memberships with no card yet get a *One step left* email: first after 24 hours, then every 2 days, up to 5.
4. **Vacate-date expiry** — contracts whose served notice date has passed are expired and flagged for offboarding.
5. **Term-end expiry** — contracts explicitly *not* renewing whose term has ended are expired. Renewing contracts are deliberately left alone.
6. **Bond-refund SLA** — approved refunds unpaid after 45 days are flagged.
7. **Overdue cancellation** — warnings at 60/76/87 days, final notice and approval request at 90. Never terminates on its own.
8. **Auto-renew roll-forward** — active contracts past their end date roll forward by their own term length, and once approved the client gets a renewal confirmation.
9. **Salto sweep** — anyone still holding door access whose company has no live contract gets it revoked.
10. **Directory boards** — auto-sync boards regenerate from live occupancy.

## Steps — read the digest

1. Open the **Daily reconcile** email (to eric@ and info@). It only arrives when something happened.
2. Work down the sections. The ones that need you:
   - **🖐 cancellations AWAITING YOUR APPROVAL** — a decision is required. See [Approve a cancellation](approve-overdue-cancellation.md).
   - **⚠ bond refund(s) overdue** — past 45 days on a 60-day promise.
   - **✗ errors** — real failures.
   - **🔑 door access revocations** — check for *NO WEBHOOK, remove manually in KS*.
3. The rest is information: spaces occupied, members onboarded, leases expired or auto-renewed, card reminders, directory refreshes.

## What happens automatically

- Onboarding is stamped **before** the emails send, so a crash can't double-send tomorrow.
- A contract activated more than a day ago is treated as an existing tenant, so a suite move doesn't re-onboard them (the Azura case, 30 July 2026).
- Auto-renew runs **after** overdue cancellation, so a company being cancelled for non-payment is never renewed at the same time.
- A signed renewal supersedes its predecessor: the old contract expires quietly with no offboarding, because the tenant is staying.
- Offboarding side-effects that need the browser — freeing spaces, raising bond refunds — are flagged here and run when an admin next loads the app.
- A **dry run** is available that reports everything it *would* do without writing or emailing.

## Common mistakes

- **Ignoring the digest.** It is the only place several of these events are ever surfaced.
- **Assuming everything finished overnight.** Parts of offboarding wait for an admin to open the app. Open it each morning.
- **Reading "expired" as "offboarded".** Expiry is the flag; the cascade follows.
- **Thinking it cancels overdue accounts.** It never does.
- **Expecting instant door revocation.** It happens on the next run, not immediately.

## If something goes wrong

- **No digest at all** — either nothing happened, or the job didn't run. If invoices and renewals also look stale, tell Eric.
- **The same error every morning** — it is retrying and failing. Escalate.
- **A member was onboarded who shouldn't have been** — check the contract's activation date; the suppression rule keys off it.

> **TODO(verify):** reconcile computes `todayISO` from UTC, not Melbourne time. Between 10am and midnight Melbourne, "today" server-side is still yesterday. Confirm whether this shifts any date-boundary behaviour (vacate-date expiry, overdue day counts) by a day — it was noted as a known rough edge on 31 July 2026 and may still be open.

## Related

- [How the monthly bill run works](monthly-bill-run.md)
- [The overdue ladder](overdue-ladder.md)
- [Renew a contract](../contracts/renew-a-contract.md)

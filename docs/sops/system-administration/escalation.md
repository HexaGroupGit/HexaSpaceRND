---
slug: escalation
title: Escalation — what to handle yourself, what goes to Eric
category: system-administration
audience: [reception, ops, admin]
route: /
relatedCode:
  - api/reconcile.js
  - src/components/TenantProfile.jsx
relatedSops: [daily-opening-routine, approve-overdue-cancellation, review-the-access-log]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Know what's yours to fix, what needs a second pair of eyes, and what stops until Eric decides.

## Handle it yourself

Routine work with a clear path back if it goes wrong:

- Logging enquiries, booking tours, taking bookings
- Mail, parcels, food orders, maintenance tickets
- Creating and sending invoices, recording payments
- Adding companies, members, contracts (before signing)
- Answering member messages, posting announcements
- Issuing and returning fobs
- Fixing your own typos before anything is sent

## Get it approved first

Someone else has to agree before you act:

| Situation | Who |
|---|---|
| Any rate below list | A pricing manager, via a pricing request — never yourself |
| Cancelling a membership for non-payment | Eric only |
| Waiving a fee or deposit | Eric |
| Anything contractual the client hasn't seen | Eric |

## Stop and escalate immediately

Irreversible, financial, or a security matter:

- **You terminated the wrong contract** — invoices may be raised and the space released
- **You approved the wrong cancellation** — every membership ends and access is revoked
- **A payment was recorded wrongly** — there's no delete on a payment row
- **An invoice was deleted** — Super Admin only, and permanent
- **A company was deleted with history** — its invoices are now orphaned
- **A price-list import went wrong** — no undo, many records
- **An ex-member still has door access** after a day, or the Access Log shows an unlock after their end date
- **A lost fob** — deactivate it in Salto KS the same day; nothing does it for you
- **Two contracts on one space**
- **Figures that disagree with Xero** — never "fix" one side
- **Anyone locked out who shouldn't be**

## The rule for irreversible actions

Several things in this platform have **no undo**: terminating a contract, approving a cancellation, voiding an invoice, deleting a company, importing prices, marking a fob lost.

Before any of them, ask: *if this is wrong, what does it take to put right?* If the answer isn't obvious, that's the moment to ask.

## What's already automated (don't duplicate it)

- **Overdue clients are already being chased** — reminders every 3 days, capped at 6. Check the **Reminded** badge before phoning.
- **Leads in a new stage are being nurtured** — check before following up.
- **Cancellation never happens automatically.** It always waits for an admin.
- **The daily digest** surfaces what needs a decision. Read it before acting on yesterday's problems.

## Common mistakes

- **Fixing something irreversible quietly**, hoping it goes unnoticed. It surfaces at month end, worse.
- **Escalating everything.** Routine work is routine — the lists above are the line.
- **Waiting until the end of the day** on a security matter.
- **Assuming someone else read the digest.**
- **Working around a gate** — an unapproved rate, an unauthorised card charge — because the client is waiting. The gate is the control.

## If you're not sure

Say so, and ask. On this platform the cost of a question is a few minutes; the cost of an irreversible mistake is somebody's tenancy, access or money.

## Related

- [Daily opening routine](../start-here/daily-opening-routine.md)
- [Approve a cancellation for non-payment](../billing/approve-overdue-cancellation.md)
- [All cron jobs](cron-jobs.md)

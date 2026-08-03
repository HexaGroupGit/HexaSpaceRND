---
slug: terminate-a-contract
title: Terminate a contract early
category: contracts
audience: [ops, admin]
route: /leases
relatedCode:
  - src/components/TerminateModal.jsx
  - src/components/Leases.jsx
  - src/lib/onboarding.js
  - api/reconcile.js
relatedSops: [member-gives-notice, renew-a-contract]
version: 1
reviewDue: 2027-02-01
---

## Purpose

End a contract before its term expires — by agreement, for breach, or at the end of a notice period.

## When to do this

A membership needs to end and it is not a straightforward notice-and-serve-out. If the member simply gave notice, use [Process a member giving notice](member-gives-notice.md) instead.

## Before you start

Decide the **termination date**, because it changes what happens:

| Date you enter | Effect |
|---|---|
| **Today or earlier** | Ends now — spaces freed, billing stops, offboarding runs immediately |
| **A future date** | Scheduled — stays active until then, never billed past it, ends itself on the day |

## Steps

1. Open **Contracts**, click the gear icon next to the contract number, and choose **Terminate**.
2. Set the **Termination Date \***. Read the blue or grey line beneath it — it spells out exactly what will happen for the date you chose.
3. Choose a **Reason**: Office Move - Client request move, Business Closure, Non-Payment, Lease Breach, End of Term, Mutual Agreement, Upgrade / Downgrade, or Other.
4. Add **Comments**.
5. Decide on **Charge the $350 + GST exit fee (cleaning & restoration)**. It is ticked by default for private office contracts and unticked for everything else.
6. Decide on **Enrol in the 3-month Virtual Office (clause 13(b))**, shown for office contracts only and ticked by default. Untick to waive.
7. Click **Terminate** (or **Schedule termination** for a future date).

## What happens automatically

- **The exit fee** raises a pending one-off invoice immediately, described as *Exit fee — cleaning & restoration · [unit]*, due by the Settings → Invoicing due days. For a scheduled termination it falls due on the later of the normal due date and the termination date.
- **Immediate termination** sets the contract to expired straight away, which triggers the offboarding cascade: spaces released, bond refund raised for approval, portal access handled.
- **Scheduled termination** records the vacate date and leaves the membership active. The billing engine caps invoicing at that date and prorates the final month to it. The nightly reconcile ends and offboards it on the day.
- **Clause 13(b)** — leaving it ticked creates a 3-month Virtual Office membership at the prevailing list price, starting the day after the office contract ends, deducted from the security deposit before it is refunded.
- **Door access** is revoked by the same nightly reconcile sweep, for any member whose company no longer holds a live contract. It is not instant.
- **Bond refunds are tracked.** An approved refund still unpaid after 45 days is flagged in the daily digest — the T&Cs promise refund within 60 days.

## Common mistakes

- **Terminating instead of recording notice.** If the member gave proper notice, this route can end them early and cost us the rest of their committed term. Use the notice flow.
- **Deleting rather than terminating.** Signed contracts and contracts with live invoices cannot be deleted, and shouldn't be — the record needs to survive.
- **Leaving clause 13(b) ticked when the client didn't agree to it.** It creates a real, billable 3-month membership deducted from their bond. Untick it if it wasn't part of the conversation.
- **Charging the exit fee on a virtual office or desk.** The default is off for those for a reason — the House Rules fee applies to Private Office members.
- **Assuming access ends immediately.** It ends on the next reconcile run, roughly 6:30am the following morning. If someone must lose access *now*, that is a manual removal in Salto KS.

## If something goes wrong

- **You terminated the wrong contract** — nothing here is reversible from the UI. Escalate to Eric immediately: invoices may have been raised and the space released.
- **The exit fee shouldn't have been charged** — void the invoice under Billing.
- **The space still shows occupied** — the offboarding cascade runs when an admin next loads the app. Load the admin app and re-check; if it persists, escalate.
- **A terminated member still has door access after a day** — check the daily reconcile digest for *NO WEBHOOK, remove manually in KS* and remove them by hand.

## Related

- [Process a member giving notice](member-gives-notice.md)
- [Renew a contract](renew-a-contract.md)

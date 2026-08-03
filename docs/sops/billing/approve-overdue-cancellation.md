---
slug: approve-overdue-cancellation
title: Approve a cancellation for non-payment
category: billing
audience: [admin]
route: /companies
relatedCode:
  - api/reconcile.js
  - src/components/TenantProfile.jsx
relatedSops: [overdue-ladder, terminate-a-contract, offboard-a-member]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Decide whether to end a company's memberships because they haven't paid. This is the most destructive routine action in the platform.

## When to do this

A company's oldest unpaid invoice has passed 90 days overdue, they have had their final notice, and the system is waiting on a decision. You'll know because:

- the daily reconcile digest lists them under **cancellations AWAITING YOUR APPROVAL**, and
- an *Approval needed* email arrives, and
- their company profile shows a red **Cancellation awaiting approval** banner.

This is an **admin decision**, not a reception one. In practice, Eric's.

## Before you start

- Confirm the debt is real. Check the invoices; check Xero.
- Confirm nobody has agreed a payment plan.
- Confirm the amount is worth the consequence — this ends every membership they hold.

## Steps — the three options

1. Open **Companies** and click the company. The red banner is at the top of the profile, dated from when they passed the cut-off.

**To cancel:**
2. Click **Approve cancellation**.
3. Confirm — the dialog states it cancels **all** their memberships and revokes door access, and runs the full offboarding.
4. You'll see either *Cancellation executed — memberships terminated, client notified, offboarding queued* or *Approval recorded — the overnight run will execute the cancellation.* Both mean the decision is made.

**To keep them:**
2. Click **Keep membership**.
3. Confirm — this exempts them from the overdue-cancellation process permanently. **The debt remains payable**; only the automated cancellation stops.

**To do neither:** leave it. They stay listed in the daily digest until someone decides or the balance is paid.

## What happens automatically

- **Nothing is cancelled until you click.** The system reaches the cut-off, sends the client their final notice, asks you, and stops.
- On approval: every active and pending contract is set **terminated** and flagged for offboarding; the client is emailed a cancellation notice with admins bcc'd; door access is revoked in the same run.
- The full offboarding cascade — spaces freed, bond refund raised, portal access revoked — runs when an admin next loads the app.
- **Paying off clears everything**, including a pending approval. A settled account is never cancelled, even if approval was already requested.
- **Keep membership** sets a permanent exemption. They will never enter this process again unless someone clears the flag.
- Only debts from **1 July 2026 onward** count toward the cut-off.

## Common mistakes

- **Approving without checking Xero.** Migrated balances are unreliable as recorded here — Xero is the truth for anything pre-July 2026.
- **Approving to "see what happens".** It terminates every membership and revokes access. There is no undo.
- **Using Keep membership as a "not now".** It is a permanent exemption, not a snooze. To defer, just leave it — it stays in the digest.
- **Cancelling a client who has agreed a payment plan.** Check with whoever agreed it first.
- **Assuming the client was warned.** They were — at 60, 76, 87 and 90 days — but confirm the emails went to a real address before ending a tenancy.

## If something goes wrong

- **You approved by mistake** — stop and call Eric immediately. If the overnight run hasn't executed yet there may be a window; once contracts are terminated, restoring them is manual.
- **They pay right after approval** — the system won't un-cancel. Escalate.
- **The banner won't clear** — paying clears it on the next nightly run. If it persists, check whether the invoices are actually marked paid.

## Related

- [The overdue ladder](overdue-ladder.md)
- [Terminate a contract early](../contracts/terminate-a-contract.md)
- [Offboard a member](../companies-members/offboard-a-member.md)

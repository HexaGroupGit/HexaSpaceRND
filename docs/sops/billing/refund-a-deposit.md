---
slug: refund-a-deposit
title: Refund a security deposit
category: billing
audience: [ops, admin]
route: /billing
relatedCode:
  - api/refunds/deposit.js
  - api/refund-bank-details.js
  - src/components/Billing.jsx
  - src/store/useStore.js
relatedSops: [issue-a-credit-note, terminate-a-contract, nightly-reconcile]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Return a departing client's security deposit, by the same rail they paid it on.

## When to do this

A contract has ended and a bond refund is sitting on the Billing page. The T&Cs promise the deposit back **within 60 days**.

## Before you start

You don't create the refund — the offboarding cascade does, when the contract ends. Your job is to approve it and pay it out. Deduct anything owing (damage, exit fee, clause 13(b) virtual office) **before** approving.

## Steps — approve

1. Open **Billing** → **Invoices**. The amber **Bond refunds pending approval (n)** panel is at the top.
2. Check the amount and the company.
3. Click **Approve & notify**.

## Steps — pay it out

1. The refund moves to the blue **Bond refunds awaiting payout (n)** panel.
2. Click **Refund deposit**. The system works out the rail from how the deposit was originally paid:
   - **Paid by card** → refunded through Stripe against the original payment there and then. You'll see *Refunded $X to the original card.* Nothing else to do.
   - **Paid by bank transfer, details on file** → you get the account details to transfer to. Make the transfer, then click **Mark refunded** and enter the bank reference.
   - **Paid by bank transfer, no details** → you're offered to email the client a secure link to enter them. Confirm, and they appear here once submitted.
3. For a manual transfer, click **Mark refunded** and record the reference.

## What happens automatically

- The refund credit note is raised by the **offboarding cascade** when the contract ends, already net of any clause 13(b) virtual-office deduction.
- **Approve & notify** emails the client that the refund is approved, naming the credit note and amount.
- A card refund stamps the credit note paid and records a negative payment — it drops out of the queue by itself.
- The credit note pushes to Xero on the next sync.
- **The 60-day promise is tracked.** An approved refund with no payout recorded after **45 days** is flagged red as **Refund overdue** on the Billing page and listed in the daily reconcile digest.
- The bank-details link is token-gated and collects the account without it ever passing through email.

## Common mistakes

- **Approving before deducting.** Approve is what tells the client the amount. Sort deductions first.
- **Choosing the rail yourself.** Don't. Click **Refund deposit** and let it decide from how the deposit was actually paid — guessing can send money to the wrong place.
- **Marking refunded before the transfer clears.** It stops the tracking. Only mark it once the money has actually gone.
- **Asking the client for bank details by email.** Use the secure link. Account details in an inbox are a real risk.
- **Missing the 45-day flag.** It exists because the 60-day promise is contractual. Treat red as urgent.
- **Building a bond refund by hand** as a credit note. It skips approval and SLA tracking entirely.

## If something goes wrong

- **"Approve the refund before paying it out."** — do the approval step first.
- **"This refund has already been paid out."** — it's done; check the payments on the credit note.
- **Stripe refuses the refund** — the original payment may be too old or already refunded. Fall back to a bank transfer and tell Eric.
- **The client never submits their bank details** — chase by phone. The refund clock keeps running regardless.
- **Refund overdue is showing** — this is past 45 days on a 60-day promise. Escalate to Eric the same day.

## Related

- [Issue a credit note](issue-a-credit-note.md)
- [Terminate a contract early](../contracts/terminate-a-contract.md)
- [What the nightly reconcile does](nightly-reconcile.md)

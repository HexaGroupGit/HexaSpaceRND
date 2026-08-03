---
slug: record-a-bank-payment
title: Record a bank transfer payment
category: billing
audience: [reception, ops, admin]
route: /billing
relatedCode:
  - src/components/InvoiceDetail.jsx
  - src/components/Billing.jsx
  - api/xero/sync.js
relatedSops: [charge-a-saved-card, xero-sync, overdue-ladder]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Mark an invoice paid when money has arrived by bank transfer, so the client stops being chased.

## When to do this

A payment lands in the bank account, or Xero shows it paid and the platform doesn't.

## Before you start

Match the payment to the invoice — the invoice number is the payment reference on every invoice email. Part-payments are fine; record the actual amount received, not the invoice total.

## Steps — one invoice

1. Open **Billing** → **Invoices** and click the invoice.
2. Scroll to the payments section and click **Add manual payment**.
3. Check the **Amount (AUD)** — it pre-fills with the balance owing. Change it for a part-payment.
4. Set the **Date** the money actually arrived, not today.
5. Set the **Method**: **Bank Transfer**, **Credit Card**, **Cash** or **Other**.
6. Click **Record**.
7. Optionally click **Receipt** on the payment row to email the client a receipt.

## Steps — quick mark-paid

On the Invoices list, a **pending** invoice shows a **Mark Paid** button. It records the full balance as a Bank Transfer dated today, noted *Marked paid*. Use it only when both of those are true.

## Steps — several at once

1. Tick the invoices.
2. Click **Mark Paid** in the blue bulk bar and confirm.
3. Each gets a full-balance Bank Transfer payment dated today and is set to paid.

## What happens automatically

- Recording a payment reduces the amount due; once it reaches zero the invoice reads **paid**.
- A paid invoice drops out of the overdue reminder ladder and out of any auto-charge queue.
- Payments carry a method and an optional reference, and appear on the client's portal.
- **Xero payment status pulls back automatically** for invoices linked to Xero — so a payment reconciled in Xero can mark the platform invoice paid without you touching it. Check Xero before recording by hand.
- The invoice header shows **Synced to Xero** or **Not synced**.

## Common mistakes

- **Recording today's date for money that arrived last week.** The date drives reporting and the client's statement.
- **Using Mark Paid for a part-payment.** It records the whole balance. Use **Add manual payment** with the real figure.
- **Double-recording.** If Xero already pulled the payment back, adding it again over-pays the invoice. Check the payments list first.
- **Recording a payment on the wrong invoice** when a client pays several at once. Split it properly — one payment per invoice.
- **Forgetting the receipt.** Not required, but for a large transfer it saves a phone call.

## If something goes wrong

- **You recorded the wrong amount** — there is no delete on a payment row in the admin UI. Escalate to Eric.
- **The invoice shows overpaid** — usually a double-record with Xero. Escalate before refunding anything.
- **The client says they paid but nothing shows** — get the date and reference, check the bank, then record it. Their reference may not have matched the invoice number.

> **TODO(verify):** confirm whether a recorded payment can be removed or edited anywhere in the admin UI. I could not find a delete control on payment rows in `InvoiceDetail.jsx` — if there genuinely isn't one, the recovery path here needs to say so explicitly.

## Related

- [Take a payment on a saved card](charge-a-saved-card.md)
- [How Xero sync works](xero-sync.md)
- [The overdue ladder](overdue-ladder.md)

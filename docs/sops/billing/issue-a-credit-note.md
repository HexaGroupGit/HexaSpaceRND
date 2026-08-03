---
slug: issue-a-credit-note
title: Issue a credit note
category: billing
audience: [ops, admin]
route: /billing
relatedCode:
  - src/components/InvoiceDetail.jsx
  - src/components/Billing.jsx
  - api/xero/sync.js
relatedSops: [create-a-one-off-invoice, refund-a-deposit]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Reverse a charge on an invoice the client has already been sent or has paid.

## When to do this

An invoice was wrong and the client has it. If it was wrong and they have *not* paid and it hasn't gone to Xero, **voiding** is usually cleaner.

## Void or credit?

| Situation | Do this |
|---|---|
| Wrong, unpaid, not yet in Xero | **Void** it and reissue |
| Wrong, already paid | **Credit note** |
| Wrong, already pushed to Xero | **Credit note** — Xero needs the paper trail |
| Partial reduction (goodwill, disputed line) | **Credit note**, then edit the lines |

## Steps

1. Open **Billing** → **Invoices** and click the invoice.
2. Click **Credit Note**.
3. Confirm *Create a credit note for INV-####?*
4. A new pending invoice is created with every line copied at a **negative** unit price, referenced *Credit note for INV-####*, and linked back to the original.
5. To credit only part of the invoice, open the credit note and edit or remove lines so only the amount being credited remains.
6. Send it to the client the same way as any invoice.

## Steps — void instead

1. Open the invoice and click **Void**.
2. Confirm *Void invoice INV-####? This cannot be undone.*

## What happens automatically

- The credit note copies **every** line at negative value, carries the original's period, payment method, discount and GST setting, and records which invoice it credits.
- It is created **pending** and **not sent** — it is a document, not a refund. Money moving is separate.
- Voiding leaves the invoice visible under the **Voided** filter with an amount due of zero. It is excluded from statements, from the overdue ladder and from the deposit-held figure.
- Credit notes push to Xero as credit notes on the hourly sync, subject to the same window rules as invoices.
- A **bond refund** is a special kind of credit note with its own approval and payout flow — do not hand-build one. See [Refund a deposit](refund-a-deposit.md).

## Common mistakes

- **Crediting the whole invoice when only one line was wrong.** Edit the credit note down first.
- **Expecting a credit note to move money.** It doesn't. If the client has paid and is owed cash back, the refund is a separate step.
- **Voiding an invoice that is already in Xero.** Xero keeps its copy; your books then disagree. Credit it instead.
- **Voiding a paid invoice.** The payment stays recorded against a voided document. Escalate rather than improvise.
- **Building a bond refund by hand.** It bypasses the approval gate and the 60-day SLA tracking.

## If something goes wrong

- **You voided the wrong invoice** — it cannot be undone. Recreate it with the same details and tell Eric; the number will differ.
- **The credit note is wrong** — void the credit note and issue a fresh one.
- **The client's balance still looks wrong** — check whether the credit note was actually sent, and whether it reached Xero.

## Related

- [Create a one-off invoice](create-a-one-off-invoice.md)
- [Refund a deposit](refund-a-deposit.md)
- [How Xero sync works](xero-sync.md)

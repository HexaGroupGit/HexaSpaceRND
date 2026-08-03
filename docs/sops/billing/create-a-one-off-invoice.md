---
slug: create-a-one-off-invoice
title: Create a one-off invoice
category: billing
audience: [reception, ops, admin]
route: /billing
relatedCode:
  - src/components/InvoiceForm.jsx
  - src/components/InvoiceDetail.jsx
  - src/components/Billing.jsx
relatedSops: [add-a-recurring-fee, send-a-pay-link, issue-a-credit-note]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Bill a client for something the monthly run doesn't cover — a deposit, a damage charge, an ad-hoc service.

## When to do this

Anything outside the normal membership cycle. If it is a booking overage or a standard chargeable, use a **fee** instead — it sweeps onto the next invoice on its own. See [Add a recurring fee](add-a-recurring-fee.md).

## Before you start

Confirm the company exists and check whether a fee already covers this — double-billing an overage that the bill run would have swept is an easy mistake.

## Steps

1. Open **Billing** → **Invoices** and click **Add Invoice**. (From a company profile, use **Add Invoice** in the Invoices section — the company is pre-filled, and any uninvoiced deposits are pre-loaded as line items.)
2. Choose the company.
3. Set the **Issue Date** and **Due Date**. Default terms are 14 days from Settings → Invoicing.
4. Add line items: description, revenue account, unit price (ex GST) and quantity.
5. Check GST. It applies by default — **except a security deposit, which is not a taxable supply** and must be GST-exempt.
6. Save.
7. Open the invoice and click **Send** to email it, then confirm the recipient in the dialog.

## What happens automatically

- The invoice number is allocated as the highest existing number plus one, using the template in Settings → Invoicing (default `INV-####`).
- It is created **pending** and **not sent** — creating is not sending.
- Sending mints a **pay token** the first time and emails a public **Pay this invoice online** link. Re-sends keep the same link.
- The invoice appears on the client's portal Billing page immediately, whether or not you emailed it.
- Once the due date passes, the nightly overdue job flips it to **overdue** and starts the reminder ladder.
- It is pushed to Xero by the hourly sync — **if** it falls inside the sync window. See [How Xero sync works](xero-sync.md).
- The revenue account on each line decides which Xero account it lands in, and whether it is coded to Level 2 or Levels 4&5.

## Common mistakes

- **Leaving GST on a security deposit.** A bond held as security is not a taxable supply; it only becomes taxable if forfeited. The signing flow gets this right automatically — a hand-built deposit invoice will not.
- **Creating and forgetting to send.** The status column shows **Not Sent** — check it.
- **Using an invoice where a fee belongs.** Fees sweep onto the next bill-run invoice automatically; a separate invoice for a $30 overage annoys the client and clutters Xero.
- **Getting the revenue account wrong.** It drives the Xero coding. If in doubt, copy the wording from a comparable existing invoice.
- **Setting a due date in the past.** It goes overdue immediately and starts chasing the client.

## If something goes wrong

- **Wrong amount, already sent** — void it and issue a corrected one, or issue a credit note if the client has already paid. Don't edit a sent invoice's numbers silently.
- **Duplicate number** — two invoices were created at the same moment. Void one and tell Eric.
- **The client says they never got it** — check **Sent** on the invoice, then re-send. The pay link stays the same.
- Editing is blocked once an invoice is paid or voided. That is deliberate.

## Related

- [Add a recurring fee](add-a-recurring-fee.md)
- [Send a pay link](send-a-pay-link.md)
- [Issue a credit note](issue-a-credit-note.md)

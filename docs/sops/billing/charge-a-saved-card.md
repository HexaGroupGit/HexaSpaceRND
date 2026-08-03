---
slug: charge-a-saved-card
title: Take a payment on a saved card
category: billing
audience: [ops, admin]
route: /billing
relatedCode:
  - src/components/InvoiceDetail.jsx
  - src/components/Billing.jsx
  - api/overdue-reminders.js
  - src/lib/cardAuthority.js
relatedSops: [record-card-authority, overdue-ladder, send-a-pay-link]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Collect an outstanding invoice from a card the client has already stored with Stripe.

## When to do this

An invoice is due or overdue, the company has a saved card, and they have given charge authority.

## Before you start

**Check the authority.** Open **Billing** → **Saved Cards** and read the **Authority** column. A card marked *Not authorised* must not be charged unattended — see [Record card payment authority](../companies-members/record-card-authority.md).

Also check the notice. Clause 7(i) commits us to at least **2 business days' written notice by email** before charging for an overdue invoice.

## Steps — charge one invoice manually

1. Open **Billing** → **Saved Cards** to see who has a card and what they owe, then click **Charge / view →**. Or open the invoice directly from the Invoices tab.
2. Click **Charge saved card (VISA •••• 4242)** — the button names the actual card.
3. Confirm the dialog, which shows the amount and the card.
4. Wait for *Charged $X — invoice paid.*

## Steps — let the automation collect

Automatic collection only runs when **Settings → Stripe → auto-charge overdue** is on. It then works through a strict sequence per invoice:

1. The invoice goes overdue.
2. A **grace period** passes — default 7 days after the due date.
3. The client is emailed an **Upcoming payment** notice naming the card, the invoice and the earliest charge date.
4. At least **2 business days** later, the card is charged.
5. The client gets a **Payment receipt** email.

## What happens automatically

- A successful charge marks the invoice **paid** and records the payment against it.
- The automation **only ever charges companies with `cardAuthorityAccepted` recorded**. A member who merely saved a card on a pre-authority contract is never auto-charged.
- **One attempt per invoice per day.** A failure is stamped with the error and retried tomorrow.
- A charged invoice drops out of the reminder list, so the client isn't chased for money already taken.
- The notice-period calculation excludes weekends but **not public holidays** — so the window can be a day short around a Victorian public holiday.
- Charging manually from the invoice bypasses the grace period and the notice. That is your judgement to exercise, not the system's.

## Common mistakes

- **Charging without authority.** Check the Saved Cards **Authority** column every time.
- **Charging manually without notice.** The 2-business-day notice is contractual. If the automation hasn't sent it, you are skipping a commitment the client signed up to — do it deliberately, having spoken to them.
- **Charging an invoice the client has already paid by bank transfer.** Check payments on the invoice first; bank transfers are recorded by hand and may lag.
- **Re-clicking after a failure.** The error is recorded. Read it — a declined card needs the client, not another attempt.
- **Charging a deposit refund.** Refunds go out through a different flow entirely.

## If something goes wrong

- **"Card charge failed: …"** — read the reason. Expired or declined cards need the client to update the card in the portal.
- **Charged the wrong invoice** — refund through Stripe and tell Eric. There is no undo in the admin app.
- **The client disputes a charge** — the receipt email and the advance notice are both on record. Escalate to Eric before refunding.
- **A card is about to expire** — the Saved Cards tab shows the expiry. Ask the client to replace it in the portal.

## Related

- [Record card payment authority](../companies-members/record-card-authority.md)
- [The overdue ladder](overdue-ladder.md)
- [Send a pay link](send-a-pay-link.md)

---
slug: send-a-pay-link
title: Send a pay link
category: billing
audience: [reception, ops, admin]
route: /billing
relatedCode:
  - api/pay-invoice.js
  - src/components/PayInvoicePage.jsx
  - src/lib/sendEmail.js
  - src/components/Billing.jsx
relatedSops: [create-a-one-off-invoice, record-a-bank-payment, charge-a-saved-card]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Let a client pay an invoice by card from an email, without logging in.

## When to do this

Any time you send or chase an invoice. It is included automatically — this SOP is mostly about knowing it's there and how to re-send it.

## Before you start

Nothing. The link is minted for you the first time an invoice or reminder is emailed.

## Steps — send an invoice with its pay link

1. Open **Billing** → **Invoices** and click the invoice.
2. Click **Send** and confirm the recipient.
3. The email includes a **Pay this invoice online** button plus the bank details from Settings.

## Steps — send several at once

1. Tick the invoices in the list.
2. Click **Send All** in the blue bulk bar.

## Steps — chase overdue invoices with pay links

1. Switch to the **Overdue** filter.
2. Click **Send Reminders (n)** to email every company with an overdue invoice shown — **one email per company**, listing all their overdue invoices, each with its own pay link.
3. Confirm the dialog, which names how many companies and invoices are covered and lists anyone skipped for having no email.

## What happens automatically

- The pay token is minted **once per invoice** and stored. Every later send reuses the same link, so an older email keeps working.
- The link is `portal.hexaspace.com.au/pay/<invoice id>?t=<token>` — **public and unauthenticated**. The token is the only secret, and it is compared in constant time.
- The page shows the invoice total including GST and opens a Stripe Checkout session. Stripe's webhook marks the invoice paid.
- The bill run and the nightly overdue reminders both attach pay links without any action from you.
- Sending stamps the invoice **Sent**; reminders stamp a **Reminded dd/MM** badge with a count.

## Common mistakes

- **Forwarding a pay link to the wrong client.** The token is the only protection — anyone holding the link can view and pay that invoice. Treat it as confidential.
- **Assuming the client needs a portal login.** They don't. That's the point.
- **Sending reminders from the All tab.** Only genuinely overdue invoices with money owing qualify; you'll get *Nothing to remind about*.
- **Chasing a company with no email on file.** They are skipped and listed in the confirmation — read it.
- **Double-chasing.** The nightly automation already sends reminders. Check the **Reminded** badge before adding a manual one.

## If something goes wrong

- **The client says the link doesn't work** — confirm the invoice isn't already paid or voided. Re-send; the link is unchanged.
- **They paid but the invoice still shows unpaid** — Stripe's webhook marks it paid; give it a few minutes, then check the payments list on the invoice.
- **A link went to the wrong person** — there is no revoke. Escalate to Eric; the invoice may need voiding and reissuing to mint a new token.

## Related

- [Create a one-off invoice](create-a-one-off-invoice.md)
- [Record a bank transfer payment](record-a-bank-payment.md)
- [The overdue ladder](overdue-ladder.md)

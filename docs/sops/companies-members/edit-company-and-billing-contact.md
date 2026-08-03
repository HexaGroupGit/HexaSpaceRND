---
slug: edit-company-and-billing-contact
title: Edit a company and set the billing contact
category: companies-members
audience: [reception, ops, admin]
route: /companies
relatedCode:
  - src/components/Tenants.jsx
  - src/components/TenantProfile.jsx
  - src/lib/credits.js
relatedSops: [create-a-company, add-a-member, record-card-authority]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Keep a company's details current, and make sure invoices and contracts reach the right person.

## When to do this

A client changes their contact, their ABN, their billing email, or asks for their details to be corrected on an invoice.

## Before you start

Understand that "who gets the email" is decided in two different places:

- **The company's Email field** — used for the portal invite and as a fallback recipient.
- **A member flagged Billing Person** — the preferred recipient for invoices and billing emails.

The billing email is resolved by preference: the flagged **Billing Person** first, then the company email, then other members. Changing only one of the two often doesn't change where the email actually lands.

## Steps — company details

1. Open **Companies** and click the company name.
2. Click **Edit Details**.
3. Use the **General**, **Address** and **Billing** tabs. On **Billing**, the **Business Name** is the registered entity name that prints on invoices — set it if it differs from the trading name.
4. Click **Save**.

## Steps — set the billing contact

1. Open the company profile and scroll to **Members**.
2. Click the pencil icon on the person who should receive invoices.
3. Tick **Billing Person** — *Receives invoices by email*.
4. Tick **Contact Person** as well if they should also be able to pay by card and add members in the portal.
5. Click **Save**.

## Steps — adjust booking credits

1. On the company profile, find **Booking Credits**.
2. **Monthly allowance** auto-computes from active memberships (Flexible Desk 4 · Dedicated Desk 8 · Private Office 5 per person). Change it only to record something genuinely negotiated.
3. **Remaining this month** is the live balance bookings draw on. Adjust it to correct a mistake or apply a goodwill top-up.
4. Click **Save**, or **Reset to plan** to drop the override and return to the computed figure.

## What happens automatically

- **Changing the Status field marks it as manual.** From then on that status wins over the derived one, permanently — even if the company later takes a contract.
- Credits **reset on the 1st** of each month to the allowance. A company with no active membership has a spendable balance of **0** regardless of what the stored number says.
- Booking overage beyond the credit pool is billed as a fee on the month-end invoice.
- The company profile's stats bar (MRR, Active Contracts, Total Invoices, Deposit Held) is all derived — nothing there is editable.
- **Deposit Held counts only *unpaid* deposit invoices.** A paid deposit drops out of that figure.

## Common mistakes

- **Changing the company email and assuming invoices follow.** If a member is flagged Billing Person, they still get them.
- **Flagging two people as Billing Person.** Only one is used, and which one is not something you control. Flag exactly one.
- **Touching the Status dropdown "just to check".** Saving with a changed status locks it as manual forever.
- **Editing the credit allowance instead of Remaining.** Allowance is the monthly entitlement; Remaining is this month's balance. A goodwill top-up belongs in Remaining.
- **Correcting an invoice by editing the company.** Already-issued invoices keep the details they were issued with. Fix the invoice itself.

## If something goes wrong

- **A client says invoices go to the wrong address** — check the Members list for a Billing Person flag first, then the company email.
- **Credits look wrong** — click **Reset to plan** to see the computed figure, then decide whether an override is genuinely warranted.
- **A company shows Former but is clearly active** — it has no active contract. That is usually a contract problem, not a company problem.

## Related

- [Create a company](create-a-company.md)
- [Add a member to a company](add-a-member.md)
- [Record card payment authority](record-card-authority.md)

---
slug: add-a-recurring-fee
title: Add a fee or charge
category: billing
audience: [reception, ops, admin]
route: /fees
relatedCode:
  - src/components/Fees.jsx
  - src/components/TenantProfile.jsx
  - src/components/MemberProfile.jsx
relatedSops: [create-a-one-off-invoice, monthly-bill-run]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Record something chargeable — a booking overage, a replacement fob, print costs, damage — so it lands on the client's next invoice without anyone remembering to do it.

## When to do this

Any ad-hoc charge. Fees are the default; a standalone invoice is the exception.

## Before you start

Know the amount **ex GST** and which company it belongs to. A fee with no company attached can never be invoiced.

## Steps — from the Fees page

1. Open **Fees** and click to add a fee.
2. Enter the **name** — this becomes the invoice line description, so write it for the client, not for you.
3. Choose the **type**: **Booking Fee**, **Fob Key Order**, **PaperCut** or **One-Off**.
4. Choose the member and/or company. Picking a member fills the company from their record.
5. Enter the **date** and the **price** (ex GST).
6. Leave **status** on **Not Paid**.
7. Save.

## Steps — from a company or member profile

1. Open the company profile → **Fees & Charges**, or a member profile → **One-off Fees** → **Add fee**.
2. Fill in name, amount ex GST, type and date.
3. Save. A member-level fee is attached to their company so it is still billable.

## Steps — bill it immediately

1. Find the fee on **Fees**, the company profile or the member profile.
2. Click **Invoice now**.
3. Confirm the dialog, which shows the company, the fee name and the amount + GST.

## What happens automatically

- **Un-invoiced fees are swept onto the company's next bill-run invoice.** You do not need to do anything — that is the whole point.
- **Invoice now** raises a pending invoice immediately and flips the fee to **Invoiced**, which takes it out of the sweep. The same guard works both ways, so a fee can't be billed twice.
- Fees are coded to *Meeting Room & Booking Fees* as their revenue account.
- Booking overage beyond a company's credit pool is created as a fee automatically.
- Statuses: **Not Paid**, **Paid**, **Waived**, **Invoiced**, **Awaiting Approval**. Only Not Paid (and Awaiting Approval) fees are billable — Paid, Waived and Invoiced are all excluded.

## Common mistakes

- **Creating an invoice instead of a fee.** The sweep exists so small charges ride along with the monthly invoice. A separate invoice for $30 is worse for everyone.
- **Leaving the company blank.** *This fee has no company attached — add one first.* It will never be billed.
- **Entering the price including GST.** Everything here is ex GST; GST is added on the invoice.
- **Writing an internal note as the fee name.** It prints on the client's invoice.
- **Using Invoice now by default.** Only do it when the client needs the bill immediately — otherwise let the sweep handle it.
- **Marking a fee Waived to cancel it after invoicing.** Once it is Invoiced, the invoice is what needs crediting, not the fee.

## If something goes wrong

- **A fee was invoiced by mistake** — void or credit the invoice. Changing the fee's status alone does nothing to the invoice.
- **A fee never appeared on an invoice** — check its status. Anything other than Not Paid is excluded from the sweep.
- **The client disputes a charge** — set it to **Waived** if it hasn't been invoiced. If it has, issue a credit note.

## Related

- [Create a one-off invoice](create-a-one-off-invoice.md)
- [How the monthly bill run works](monthly-bill-run.md)
- [Issue a credit note](issue-a-credit-note.md)

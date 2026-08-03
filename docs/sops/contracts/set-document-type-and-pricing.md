---
slug: set-document-type-and-pricing
title: Set the document type and pricing
category: contracts
audience: [reception, ops, admin]
route: /leases
relatedCode:
  - src/components/ContractForm.jsx
  - src/lib/leasePricing.js
  - src/lib/paymentSchedule.js
relatedSops: [create-a-contract, raise-a-pricing-request, rent-free-months]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Get the agreement type, the rent, and any discount right, so the document, the payment schedule and the bill run all charge the same number.

## When to do this

While creating or editing a contract, at the **Duration** and **Items** sections.

## Before you start

Know the list rate for the space (shown under Spaces) and whether anything below list has been **approved**.

## Steps

1. Choose the **Document Type** in **Duration**. It controls which spaces you may book and whether a card is required by default:

   | Document Type | Spaces it may book | Card on file by default |
   |---|---|---|
   | License Agreement | Private offices | No |
   | Virtual Office Membership Agreement | Virtual offices | Yes |
   | Membership Agreement Month-to-month | Desks (flexible or dedicated) | Yes |
   | Service Agreement | Any | No |

2. In **Items**, pick the space. **List Price** auto-fills from the space's monthly rate. A virtual office with no rate on its record defaults to **$150**.
3. Enter the **List Price** as the RRP, ex GST, per month. Never discount by typing a lower list price — the agreement is supposed to show *list → discount → net*.
4. Set the **Discount** using the dropdown:
   - **No disc.** — charge list
   - **%** — a percentage off, e.g. `10%`
   - **$** — a fixed dollar amount off per month, e.g. `$200`
5. Confirm the green line underneath reads the price you agreed: *After 10% discount: A$1,350.00/mo*.
6. To change the rent partway through a term, click **Add Step** on the last step and set the new period's dates and price. The button is disabled once the last step already covers the full duration — move the contract's End Date back first.
7. Check the deposit. It auto-fills to two months of the space's rate; Month-to-month contracts default to $0.

## What happens automatically

- The contract stores **both** numbers: `listPrice` (the RRP) and `monthlyRent` (list less discount). The bill run, the payment schedule on the agreement and the contract's Value column all use the **discounted** figure.
- A multi-space contract sums every line item's opening step into the contract-level monthly rent, list price and deposit — not just the first row.
- The PAYMENT SCHEDULE table on the generated PDF is built month by month from the steps, prorating any partial month (on by default in Settings → Billing Rules).
- A Month-to-month contract prints only the first month plus one *Each month thereafter — ongoing* row instead of a year-long table, and its Value shows **N/A** rather than a term total.

## Common mistakes

- **Typing the discounted rent into List Price.** The discount then shows as none, the agreement loses the *list → net* story, and any later CPI renewal uplift compounds off the wrong base.
- **Using a $0 list price to model a free period.** See [Apply rent-free months](rent-free-months.md) — it never expires and rolls into the renewal.
- **A percentage discount over 100.** The field caps at 100, but a `$` discount larger than the list price silently floors the charge at $0 — which creates exactly the never-expiring $0 contract problem.
- **Adding a step that starts after the contract's End Date.** The step is silently not added; nothing tells you why. Move the End Date back first.
- **Assuming the deposit follows the discount.** It doesn't — it is two months of the *space's* rate, not two months of the discounted rent. Adjust it by hand if that isn't what was agreed.

## If something goes wrong

- **The Value column shows a number you don't recognise** — it is the whole-of-term total ex GST (every month, every line item), not the monthly or annual rent.
- **The payment schedule on the PDF doesn't match what you quoted** — check each step's dates. A step with no end date runs to the end of the contract, which will swallow later steps.
- Pricing below list that hasn't been approved: stop and raise a pricing request instead.

> **TODO(verify):** `membershipType` appears on leases throughout the codebase (it drives the exit-fee default, clause 13(b) and the card-on-file fallback) but is not a field on the contract form. Confirm where it is set — likely the Memberships board — and document that path here.

## Related

- [Create a contract](create-a-contract.md)
- [Raise a pricing request](raise-a-pricing-request.md)
- [Apply rent-free months](rent-free-months.md)

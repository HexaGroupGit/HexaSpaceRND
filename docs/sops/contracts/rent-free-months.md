---
slug: rent-free-months
title: Apply rent-free months (and why you never enter $0 rent)
category: contracts
audience: [ops, admin]
route: /leases
relatedCode:
  - src/lib/paymentSchedule.js
  - src/lib/leasePricing.js
  - src/lib/pricingApproval.js
relatedSops: [set-document-type-and-pricing, raise-a-pricing-request, renew-a-contract]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Give a client free months as an incentive without creating a contract that never expires and quietly renews itself forever.

## When to do this

A new-member offer, or a concession approved through a pricing request, that includes one or more months at no rent.

## Before you start

Know how many months are free and that the concession has been approved.

## The rule

**Never enter $0 as the rent.** Use a rent-free month count.

A contract carrying `rentFreeMonths` keeps its real rent, prints *(rent-free)* against the affected months on the agreement, and resumes billing normally afterwards. A contract with `monthlyRent: 0` looks free forever: it never trips the expiry checks, it auto-renews silently, and the zero rolls into the renewal. This has already happened here — Canwealth (CON-171), fixed 29 July 2026.

## Steps

1. Confirm the number of free months on the approved pricing request (**Rent-free months** on that form).
2. Create the contract with the **real** list price and any percentage or dollar discount, exactly as normal.
3. Set the rent-free month count on the contract.

   > **TODO(verify):** `rentFreeMonths` is read by the payment schedule and honoured by the bill run, and it is captured on the pricing-request form, but there is no field for it on the contract form (`ContractForm.jsx`). Confirm how it reaches a contract today — via the proposal flow, or does it need adding to the contract form?

4. Open the contract and click **Template View**. Check the PAYMENT SCHEDULE shows the free months at $0.00 with **(rent-free)** beside them, and the footnote *New-member offer — rent-free months are applied to the end of the term as shown above.*

## What happens automatically

- The **final N months** of the term are zeroed and flagged — not the first ones. This matches the wording used on proposals.
- The zeroing is **skipped entirely** if the contract's pricing steps already contain a $0 period, so a hand-stepped contract is rendered as-is rather than being zeroed twice.
- The bill run skips invoicing any month the schedule marks as $0, including the opening month at signing.
- The contract's whole-of-term **Value** excludes the free months, so the figure on the Contracts list is the real revenue.

## Common mistakes

- **Entering $0 in List Price.** The contract never expires, auto-renews without anyone seeing it, and carries the zero into the next term.
- **Entering a `$` discount equal to or larger than the list price.** The charge floors at $0 — the same problem by a different route.
- **Expecting the free months at the start.** They are applied to the *end* of the term. If the client was promised the first month free, that is a different structure — model it as a prorated or stepped opening period, and say so on the agreement.
- **Adding rent-free months to a renewal by copying the old contract.** The renewal inherits the offer; strip it unless it was re-negotiated.

## If something goes wrong

- **A contract shows $0 rent** — check whether it is a genuine rent-free structure or a $0 entered by mistake. Lau Wen Qiu is a known open case still sitting at $0.
- **The free months are in the wrong place on the schedule** — the count always applies to the end. Anything else has to be built as explicit pricing steps.
- Anything involving a client who has been billed for a month they were promised free: escalate to Eric and fix the invoice, not just the contract.

## Related

- [Set the document type and pricing](set-document-type-and-pricing.md)
- [Raise a pricing request](raise-a-pricing-request.md)

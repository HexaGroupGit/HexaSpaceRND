---
slug: send-a-proposal
title: Build and send a proposal
category: growth
audience: [ops, admin]
route: /crm
relatedCode:
  - src/components/LeadDetail.jsx
  - src/lib/proposalPdf.js
  - api/proposal.js
  - api/_proposal.js
relatedSops: [accepted-proposal, send-a-brochure, raise-a-pricing-request]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Make a formal, acceptable offer of specific space at a specific price.

## When to do this

A prospect has toured, knows which suite they want, and is ready to see numbers they can act on.

## Before you start

- Confirm the suite is genuinely available — **reserved is not available**.
- If the rate is below list, **get it approved first**. See [Raise a pricing request](../contracts/raise-a-pricing-request.md).
- Decide the term and any rent-free months. Model free months as a **count**, never as $0 rent.

## Steps

1. Open the lead in **CRM** → **Proposal** tab.
2. Select the **office(s)** you're offering.
3. Add any **parking bays** as an optional add-on — only unleased bays are offered.
4. Set the pricing and term.
5. Add a **cover message**.
6. Download the proposal PDF and read it before sending.
7. Send it.

## What happens automatically

- The prospect gets a link to their own **proposal page** where they can review and accept.
- **Proposals expire.** An expired link can't be accepted — check the expiry before chasing.
- Accepting sets off a substantial chain — see [Process an accepted proposal](accepted-proposal.md). It creates a client, a contract, reserves the space and sends the agreement for signature.
- The proposal is recorded against the lead, so you can see what was offered and when.

## Common mistakes

- **Offering a reserved suite.** Someone else is part-way through taking it.
- **Sending below-list pricing without approval.** Once it's in writing it's very hard to walk back.
- **Modelling rent-free months as $0 rent.** It creates a contract that never expires and auto-renews. Use the rent-free count.
- **Not reading the PDF before sending.** It's a formal offer with your pricing on it.
- **Sending a proposal when a brochure was wanted.** A proposal is acceptable — they can turn it into a contract with one click.
- **Forgetting the expiry.** A prospect who takes three weeks may find a dead link.

## If something goes wrong

- **They can't open the link** — it has probably expired. Send a fresh proposal.
- **The price was wrong** — send a corrected proposal immediately and tell them to ignore the first. If they've already accepted, that's a contract to unwind — escalate to Eric.
- **They accepted a suite that's since been taken** — escalate. Two contracts on one space is a real problem.

## Related

- [Process an accepted proposal into a client](accepted-proposal.md)
- [Send a brochure or info pack](send-a-brochure.md)
- [Raise a pricing request](../contracts/raise-a-pricing-request.md)

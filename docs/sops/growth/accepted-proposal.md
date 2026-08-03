---
slug: accepted-proposal
title: Process an accepted proposal into a client
category: growth
audience: [ops, admin]
route: /crm
relatedCode:
  - api/proposal-accept.js
  - src/components/ProposalAccept.jsx
relatedSops: [send-a-proposal, countersign-a-contract, create-a-contract]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Know what happened when a prospect clicked accept — because most of it has already been done for you.

## When to do this

A proposal is accepted. You'll know from the admin notification.

## What the client does

On their proposal page they fill in their company details — business name, ABN, address, contact name, email, phone — pick their start date, and confirm which offices and parking they're taking.

## What happens automatically

All of this fires on their click, without you:

1. **The client is created** — company record plus a primary contact member.
2. **A contract is created** from the chosen offices and the proposal's pricing.
3. **Those offices are reserved.**
4. **An e-signature request is raised** and the licence agreement is emailed to them to sign.
5. **The admins are notified.**

So by the time you look, there's a company, a contract, held space and a signing link already with the client.

## Steps — what you do

1. Open the new **contract** and check it end to end: company, spaces, dates, pricing, deposit, document type, and whether a card on file is required.
2. Check the **company record** — the details came from a web form, so ABN and address are worth a look.
3. Confirm the **e-sign link** went to the right person.
4. When they sign, **countersign** — see [Countersign and send the getting-started pack](../contracts/countersign-a-contract.md).

## Common mistakes

- **Assuming you need to create the contract.** It already exists. Creating a second one double-books the space.
- **Not checking the contract.** It was assembled from a proposal and a web form, not by a person.
- **Missing the card-on-file requirement.** Desk and virtual-office agreements need one; the client is prompted after signing.
- **Leaving the countersignature.** Nothing moves — no invoices, no access, no welcome — until it's done.
- **Treating the reserved space as still sellable.** It's held for this client.

## If something goes wrong

- **The contract looks wrong** — edit it before they sign. After signing, an amendment is a re-paper.
- **The company details are wrong** — correct them on the company record; the contract reads from it for future documents.
- **Two contracts exist for one proposal** — someone created a duplicate by hand. Delete the unsigned, uninvoiced one and escalate.
- **They accepted but no contract appeared** — check the lead and the proposal token, then escalate to Eric.

## Related

- [Build and send a proposal](send-a-proposal.md)
- [Countersign and send the getting-started pack](../contracts/countersign-a-contract.md)
- [Create a contract](../contracts/create-a-contract.md)

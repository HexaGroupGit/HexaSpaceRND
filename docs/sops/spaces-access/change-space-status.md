---
slug: change-space-status
title: Change a space's status
category: spaces-access
audience: [ops, admin]
route: /spaces
relatedCode:
  - src/lib/onboarding.js
  - src/store/useStore.js
  - src/components/spaces/shared.jsx
  - api/reconcile.js
relatedSops: [add-or-edit-a-space, create-a-contract, terminate-a-contract]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Understand why a space shows the status it does — and why setting it by hand is almost always the wrong fix.

## When to do this

A space looks wrong: occupied when the client has gone, vacant when someone is in it, or stuck on reserved.

## The rule

**Status is driven by contracts, not by you.** In nearly every case the right fix is to the contract, not the space.

| Status | Meaning |
|---|---|
| **vacant** (shown as *Available*) | No live contract |
| **reserved** | A contract exists but the access gate isn't met, or the start date hasn't arrived |
| **occupied** | Paid up and commenced |
| **vacating** | On its way out |

## The access gate

A space goes **reserved → occupied** only when **all** of these are true:

1. The contract is signed, and
2. the security deposit invoice is paid (if there is one), and
3. the first membership invoice is paid, and
4. any required card is on file, and
5. the start date has arrived.

Until then it stays reserved. That is the system working, not a fault.

Simple quick-assignments — a desk, park or virtual office dropped straight onto a member with no signature, deposit or line items — skip the gate entirely and occupy immediately.

## Steps — diagnose before you touch anything

1. Open **Spaces** and find the unit.
2. Open the company's contract for it and check, in order:
   - Signature status — signed?
   - The deposit invoice — paid?
   - The first membership invoice — paid?
   - Card on file, if the membership requires one?
   - Start date — reached?
3. Whichever is outstanding is your answer. Fix that, not the status.
4. Load the **Dashboard**. Space flips and the offboarding cascade run in the browser when an admin opens the app.

## What happens automatically

- Creating a contract sets **every** space on it to reserved — all line items, not just the first.
- Once the gate is met and the start date arrives, the nightly reconcile flips reserved → occupied. It **never demotes** a space.
- Occupied offices are tagged with the occupying company, which is what the floor plan, directory boards and availability checks read.
- Ending a contract frees the space and clears the occupant — unless another live contract still holds it, which is what makes office moves safe.
- Deleting a contract releases its spaces immediately.
- If a space was already occupied before the gate cleared, onboarding is stamped rather than re-sent — so a suite move doesn't re-welcome an existing tenant.

## Common mistakes

- **Editing the status by hand to "fix" it.** The next reconcile or app load recomputes it from contracts, and you've hidden the real problem.
- **Expecting occupied the moment a contract is signed.** Signed is not paid. Reserved is correct until the money lands.
- **Assuming a departed client frees their space overnight.** The reconcile flags it; the cascade runs when an admin next opens the app.
- **Forgetting the occupant tag.** A space can read vacant while still tagged to a company if something went wrong — check the floor plan too.
- **Panicking about reserved.** It usually just means an unpaid deposit.

## If something goes wrong

- **Occupied but the client has left** — check for another live contract on that space. If there is none, open the Dashboard to run the cascade, then re-check.
- **Reserved and everything looks paid** — check the card-on-file requirement. That is the condition people forget.
- **Vacant but someone is sitting in it** — there is no live contract. That's a contract problem and possibly a billing one.
- **Two companies appear to hold one space** — escalate to Eric.

## Related

- [Add or edit a space](add-or-edit-a-space.md)
- [Create a contract](../contracts/create-a-contract.md)
- [What the nightly reconcile does](../billing/nightly-reconcile.md)

---
slug: amend-a-contract
title: Amend a contract mid-term
category: contracts
audience: [ops, admin]
route: /leases
relatedCode:
  - src/components/Leases.jsx
  - src/components/ContractForm.jsx
  - src/store/useStore.js
relatedSops: [create-a-contract, set-document-type-and-pricing, renew-a-contract]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Change the rent, dates, spaces or terms of a contract that is already running.

## When to do this

A client upsizes or downsizes, a rate changes partway through a term, a date was entered wrongly, or an extra space is being added.

## Before you start

Decide which of the three routes fits:

| Situation | Route |
|---|---|
| Fixing a typo, adding an inclusion, correcting a note | **Edit** the contract in place |
| A rent change from a set date | **Edit** and add a pricing **step** |
| A materially different deal the client must re-sign | **Duplicate** as a new contract, terminate the old one |

## Steps — edit in place

1. Open **Contracts**, click the contract row, then click **Edit**.
2. Make the change. The header confirms **Edit Contract · CON-###**.
3. Click **Save Changes**.

## Steps — a rent change from a set date

1. Open the contract and click **Edit**.
2. In **Items**, set the current step's **End Date** to the day before the new rate starts.
3. Click **Add Step**, then set the new step's **Start Date**, **End Date** and **List Price** (and **Discount** if any).
4. Click **Save Changes**.
5. Reopen the contract, click **Template View**, and check the PAYMENT SCHEDULE shows the change in the right month.

## Steps — re-paper as a new contract

1. On the Contracts list, click the gear icon next to the contract number and choose **Duplicate**.
2. Adjust everything that changed, then click **Create**.
3. Send the new contract for e-signature.
4. Once the new one is signed, terminate the old one — see [Terminate a contract early](terminate-a-contract.md).

## What happens automatically

- **Editing does not re-open signing.** A signed contract stays signed with its original signature images, even if you change the rent. The signed PDF is regenerated from current data, so a downloaded "signed copy" will show the *new* numbers against the *old* signatures.
- Editing writes an audit-log entry naming which fields changed.
- **Duplicate** clears everything per-contract: signatures, e-sign links, onboarding stamps, notice and termination fields, card reminders, and payments. It keeps the company, spaces, dates and pricing, and takes the next `CON-###`.
- Changing the **Signature Status** to a signed value on a contract that was not previously signed triggers the deposit and first membership invoice, exactly as countersigning does.
- Contract-level `monthlyRent` is recalculated from every line item's **opening** step. Adding a later step does not change it — the bill run reads the schedule, but anything displaying `monthlyRent` still shows the opening figure.

## Common mistakes

- **Editing a signed contract's rent and treating it as agreed.** The client signed the old figure. Anything material needs a re-paper, not an edit.
- **Adding a step without capping the previous one.** A step with no end date runs to the end of the contract and will overlap the new one, double-charging that period.
- **Duplicating instead of renewing.** Duplicate does not link back to the original, so the renewal chain and the "superseded by signed renewal" handling won't apply. Use **Renew** for a renewal.
- **Deleting the old contract after re-papering.** Signed contracts can't be deleted, and contracts with live invoices can't either. Terminate instead.
- **Forgetting the deposit.** Changing the space re-fills the deposit to two months of the new space's rate, overwriting what was there.

## If something goes wrong

- **"Cannot delete CON-###"** — the contract is signed or has non-voided invoices. That is correct behaviour; terminate it.
- **The payment schedule looks doubled** — two steps overlap. Fix the earlier step's End Date.
- **You edited the wrong contract** — the audit log records what changed and when; use it to reverse the edit, and tell Eric if money was involved.

## Related

- [Create a contract](create-a-contract.md)
- [Set the document type and pricing](set-document-type-and-pricing.md)
- [Terminate a contract early](terminate-a-contract.md)

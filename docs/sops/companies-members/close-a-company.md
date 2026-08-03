---
slug: close-a-company
title: Archive or close a company
category: companies-members
audience: [ops, admin]
route: /companies
relatedCode:
  - src/components/Tenants.jsx
  - src/components/TenantProfile.jsx
  - api/reconcile.js
relatedSops: [offboard-a-member, terminate-a-contract]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Close out a company that has left, so the lists stay honest and nothing keeps billing.

## When to do this

The last contract has ended and everything is settled — or a lead or duplicate needs clearing out.

## Before you start

Work through the company profile and confirm each of these:

- **Active Contracts** is empty
- **Invoices** — nothing outstanding, or it is with collections
- **Deposit Held** is zero, or a bond refund has been raised and approved
- **Members** — devices returned, access removed
- **Fees & Charges** — nothing un-invoiced you meant to bill

## Steps — close a departed company

1. Confirm every contract is terminated or expired. See [Terminate a contract early](../contracts/terminate-a-contract.md).
2. Open the company and check the four stats: **MRR**, **Active Contracts**, **Total Invoices**, **Deposit Held**.
3. Offboard the people — see [Offboard a member](offboard-a-member.md).
4. Click **Edit Details** and set **Status** to **Former**, then **Save**.
5. Confirm the company now appears under the **Former** tab on the Companies list.

## Steps — delete a company that was never real

Only for a lead, a test record or a duplicate with **no contracts and no invoices**.

1. Open **Companies** and click the bin icon on the row.
2. Confirm *Delete this company? Any associated contracts will remain.*

## Steps — a company being cancelled for non-payment

Do not close it manually. The overdue process owns this — see the red **Cancellation awaiting approval** banner on the company profile, with **Approve cancellation** and **Keep membership**. Covered in the Billing category.

## What happens automatically

- **Status is mostly derived.** Once the last active contract ends, the company reads **Former** on its own — setting it manually is belt-and-braces, and it locks the status permanently.
- Ending the contracts, not editing the company, is what actually frees spaces, revokes access and raises the bond refund.
- **Deleting a company does not delete its contracts or invoices** — they are left orphaned, attached to a company ID that no longer exists. The confirmation says so.
- The nightly reconcile keeps sweeping door access for anyone whose company holds no live contract, whether or not you closed the record.
- A closed company stays fully readable: invoices, contracts, statements and documents all remain.

## Common mistakes

- **Deleting instead of setting Former.** Deletion orphans financial records. Former is almost always right.
- **Closing before the bond is refunded.** The refund SLA is tracked from approval and flagged after 45 days — the T&Cs promise 60. Closing the record doesn't stop the clock, but it does make it easy to forget.
- **Closing while invoices are outstanding.** The debt remains payable and collections still needs the record findable.
- **Setting Status to Former while a contract is still active.** The manual status sticks, so the company reads Former while still billing — exactly the kind of inconsistency the July 2026 reconciliation had to clean up.
- **Forgetting the directory board.** A departed company can linger on the printed board; the digital ones refresh themselves overnight.

## If something goes wrong

- **A closed company is still being invoiced** — a contract is still active. Check Contracts on the profile; billing follows contracts, not company status.
- **You deleted a company with history** — escalate to Eric immediately. The invoices still exist but no longer resolve to a company.
- **They come back** — set Status back to Active (or just give them a contract, which derives it), and re-invite the people. Logins are banned, not deleted, so accounts can be restored.

## Related

- [Offboard a member](offboard-a-member.md)
- [Terminate a contract early](../contracts/terminate-a-contract.md)

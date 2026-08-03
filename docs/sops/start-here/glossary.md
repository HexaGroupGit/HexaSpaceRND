---
slug: glossary
title: Glossary
category: start-here
audience: [reception, ops, admin]
route: /
relatedCode:
  - src/store/useStore.js
  - src/lib/credits.js
  - src/components/TenantProfile.jsx
relatedSops: [platform-overview, create-a-company, create-a-contract]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Settle the words that get confused, so instructions in every other SOP mean one thing.

## When to do this

Read once. Come back when something doesn't behave as you expect.

## The core five

**Company** — the client business. Everything hangs off it: contracts, invoices, members, bookings, credits, the saved card. Called *tenant* in some older parts of the app; same thing.

**Member** — an individual person working under a company. Members get portal logins, door access and fobs. **A member is not a company** — they don't hold contracts or receive invoices in their own right.

**Contract** — the signed licence agreement (`CON-###`). It sets the space, the term, the rent, the notice period and the deposit. **This is what drives billing** — not the membership record.

**Membership** — the plan a company is enrolled on: Flexible Desk, Dedicated Desk, Private Office, Virtual Office. It determines credits and some behaviour like the exit fee. Signing an office contract creates a membership automatically; a membership can also be added directly for simple month-to-month plans.

**Fee** — an ad-hoc charge (booking overage, replacement fob, print costs, damage). Fees are **swept onto the company's next invoice automatically**. They are not invoices.

**Credit** — meeting-room booking allowance. **1 credit = $40 of room bookings.** The pool is per **company**, not per person, resets on the 1st, and auto-computes from active memberships: Flexible Desk 4, Dedicated Desk 8, Private Office 5 per person. Overage becomes a fee.

## Statuses that are calculated, not stored

Several statuses are **derived** and won't behave like fields you set:

| Thing | How its status is decided |
|---|---|
| **Company** | **Active** if it has any active contract, otherwise **Former** — unless an admin explicitly changed it in the edit modal, which then wins permanently |
| **Member** | **Active** only if there's an active contract tied to them or their company; **Auto** means "derive it" |
| **Space** | **vacant** → **reserved** (contract exists, awaiting payment) → **occupied** (paid and commenced) |
| **Invoice** | Flips to **overdue** by itself once the due date passes |

## Money words

**Deposit / bond** — security held against a contract, usually two months' rent. **Not a taxable supply** — no GST — unless forfeited. Returned via a bond refund credit note.

**List price vs monthly rent** — `listPrice` is the RRP; `monthlyRent` is what we actually charge after the step discount. Documents show both.

**Rent-free months** — a count of free months, applied to the **end** of the term. Never model this as $0 rent — see [Apply rent-free months](../contracts/rent-free-months.md).

**Credit note** — a negative invoice reversing a charge. A **bond refund** is a special credit note with its own approval and payout flow.

**Payment authority** — recorded consent to charge a stored card for overdue amounts. Separate from having a card on file, and required before any automatic charge.

## Contract lifecycle words

**Out for signature** — sent to the client, not yet signed.
**Countersign** — our signature, after the client's. This is what activates the contract and raises the first invoices.
**The access gate** — signed, deposit paid, first invoice paid, and any required card on file. Until all of it is true, the space stays **reserved** and no access is granted.
**Notice** — the client says they're leaving. They stay active until their last day.
**Vacate date** — that last day. Billing is capped here and the contract ends itself on it.
**Offboarding** — the cascade after a contract ends: spaces freed, access revoked, bond refund raised.
**Auto-renew** — an untouched contract rolls its term forward automatically rather than lapsing.

## Words that mean different things here

- **Tenant** = company (legacy naming).
- **Lease** = contract (legacy naming, still used throughout the code).
- **Resource** = a bookable or leasable space.
- **Licensee** = the client. **Licensor** = Hexa Space.
- **Drop-in** = someone with no active contract who pays per booking, on the spot.

## Common mistakes

- **"Member" when you mean the company.** The commonest confusion in this business. Invoices go to companies.
- **Expecting a membership to bill.** Contracts drive billing.
- **Treating credits as per-person.** They're a company pool.
- **Setting a status that is derived** and wondering why it reverts — or, worse, sticking permanently.
- **Saying "expired" when you mean "finished".** An expired contract may have auto-renewed and still be billing.

## Related

- [Platform overview](platform-overview.md)
- [Create a company](../companies-members/create-a-company.md)
- [Create a contract](../contracts/create-a-contract.md)

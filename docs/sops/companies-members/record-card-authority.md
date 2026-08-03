---
slug: record-card-authority
title: Record card payment authority
category: companies-members
audience: [ops, admin]
route: /billing
relatedCode:
  - src/lib/cardAuthority.js
  - src/portal/PortalBilling.jsx
  - src/components/Billing.jsx
  - api/overdue-reminders.js
relatedSops: [edit-company-and-billing-contact, send-contract-for-e-signature]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Make sure a stored card can legally be charged for overdue amounts — and know which companies' cards can't.

## When to do this

- A member asks how to save a card.
- You are about to charge a saved card for an overdue invoice.
- You are auditing which companies are chargeable.

## The rule

**A saved card is not the same as permission to charge it.** Two separate things must both be true:

1. The company has a card stored with Stripe, and
2. `cardAuthorityAccepted` is recorded on the company.

The overdue auto-charge only ever charges companies where **both** hold. A member tapping **Pay** themselves is their own authorisation and doesn't need it.

Why the split: existing members' agreements pre-date the payment-authority clause, so for them consent has to be **opt-in**. New contracts contain the clause, and their card setup ticks through the same flow, so everyone converges on the same record.

## Steps — the member gives authority (the only way it is captured)

Authority is captured **in the member portal, by the member** — there is no admin button that records it on their behalf.

1. Direct the member to **portal.hexaspace.com.au → Billing → Payment**.
2. Under **Saved card**, they tick the authority statement. It reads, in full:

   > I authorise Hexa Space Pty Ltd to charge this card for amounts owing under my membership or booking agreement — including overdue invoices after the grace period, with at least 2 business days' prior written notice by email before any such charge — until I remove the card or withdraw this authority in writing.

3. They click **Add payment method** and complete Stripe's secure card page.

The tick-box only appears when authority is not already on file. Once accepted, replacing a card doesn't ask again.

## Steps — check who is authorised

1. Open **Billing** and find the saved-cards table.
2. Read the **Authority** column: **Authorised** (green) or **Not authorised** (grey).
3. A company's own profile shows the same thing under **Payment Details**: *Charge authority on file* or *No charge authority yet*.

## What happens automatically

- Accepting the authority stamps four fields on the company: that it was accepted, when, the **version of the wording** they agreed to (currently `v2-2026-07`), and the email it was accepted under.
- The version matters — if the wording changes, existing consents remain tied to the text those members actually saw.
- Contracts requiring a card on file drive the client through Stripe as part of signing, so new members arrive with both the card and the authority.
- Before any automated charge, the client gets at least **2 business days' written notice by email**, per clause 7(i) of the T&Cs.

## Common mistakes

- **Assuming a saved card means you can charge it.** Check the Authority column every time before charging.
- **Trying to tick it for the member.** There is no admin path. Asking them to do it in the portal is the process.
- **Charging a card without the notice period.** The 2-business-day notice is a contractual commitment, not a courtesy.
- **Treating a member-initiated payment as authority.** It authorises that one payment, nothing more.

## If something goes wrong

- **A company has a card but no authority** — email the billing contact and ask them to confirm it in the portal. Do not charge until they have.
- **A member wants to withdraw authority** — the wording says "in writing". Record it and escalate to Eric; there is no self-serve withdrawal button.
- **A shared card across two companies** — a known hazard (Azlan / NEXUS). Escalate before charging; you may be charging the wrong client.

> **TODO(verify):** `scripts/mark-card-authority.mjs` exists and appears to set the authority fields directly. Confirm what it was used for (a backfill for members who consented on paper?) and whether it should ever be run again — if so it needs its own SOP; if not, it should be documented as historical.

## Related

- [Edit a company and set the billing contact](edit-company-and-billing-contact.md)
- [Send a contract for e-signature](../contracts/send-contract-for-e-signature.md)

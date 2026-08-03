---
slug: add-a-member
title: Add a member to a company
category: companies-members
audience: [reception, ops, admin]
route: /members
relatedCode:
  - src/components/Members.jsx
  - src/components/TenantProfile.jsx
  - src/components/MemberProfile.jsx
relatedSops: [create-a-company, invite-a-member-to-the-portal, offboard-a-member]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Add a person who works under a company, so they can get portal access, door access, bookings and their own record.

## When to do this

A client adds a staff member, or you are filling in the people behind an existing company.

## Before you start

Decide which route. Both create the same record:

| Route | Use when |
|---|---|
| Company profile → **Members** → **Add member** | Adding people to a company you're already looking at. Company is pre-filled. |
| **Members** page → **Add Member** | Adding one person, or you need the extra Address / Billing / E-Invoicing tabs. |

## Steps — from the company profile

1. Open **Companies**, click the company, scroll to **Members**.
2. Click **Add member**.
3. Enter the **Name \*** (required), **Email** and **Phone**. The **Company** field is fixed and greyed out.
4. Tick the roles that apply:
   - **Contact Person** — *Can pay by card and add members into the portal.*
   - **Billing Person** — *Receives invoices by email.*
5. Leave **Status** on **Auto** unless you need to force it. Auto derives from their memberships.
6. Click **Add member**.

## Steps — from the Members page

1. Open **Members** and click **Add Member**.
2. On **General**: **Name \*** (required), **Company**, **Email**, **Phone**, **Start Date \***, **Status** and **Booking Credits**.
3. Under **Access**, tick **Contact Person**, **Billing Person** and/or **Member Portal User** as appropriate.
4. Use **Address**, **Billing Details** and **E-Invoicing** only if this person is billed separately from their company.
5. Click **Add**.

## What happens automatically

- **Nothing is emailed.** Adding a member does not invite them to the portal, even with **Member Portal User** ticked — that tick-box only sets a flag on the record. See [Invite a member to the portal](invite-a-member-to-the-portal.md).
- **Status is derived** unless you override it. A member reads **Active** only when there is an active contract tied to them directly or to their company; otherwise **Former**. An explicit Drop In / Pending / Former label is respected.
- Adding a member does **not** create a membership or a charge. To bill them, add a membership on the company profile or put them on a contract.
- Booking credits live on the **company** pool, not the person — the member's Credits tab shows the company's balance.
- Members whose client type is `function` (drop-in event bookers) are hidden from the Members page entirely.

## Common mistakes

- **Adding a member and expecting them to get portal access.** Two separate steps. This is the single most common gap.
- **Not setting a Billing Person.** Invoices then fall back to the company email, which may be an office inbox nobody reads.
- **Forcing Status to Active.** It hides the fact that they have no membership. Leave it on Auto.
- **Adding the same person twice** under two companies when they move — edit the existing record's Company instead, so their history follows.
- **Using the member's Billing Details tab by default.** Billing normally happens at company level; filling these in for everyone creates confusion later.

## If something goes wrong

- **The member doesn't appear on the company profile** — the Company field on their record is wrong or blank. Edit it from the Members page.
- **They show as Former immediately** — correct, if the company has no active contract.
- **A duplicate person exists** — merge by hand: move any flags to the record you're keeping, then delete the other. If either has bookings or fees, escalate to Eric.

## Related

- [Invite a member to the portal](invite-a-member-to-the-portal.md)
- [Offboard a member](offboard-a-member.md)
- [Edit a company and set the billing contact](edit-company-and-billing-contact.md)

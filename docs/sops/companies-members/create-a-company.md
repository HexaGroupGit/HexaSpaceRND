---
slug: create-a-company
title: Create a company
category: companies-members
audience: [reception, ops, admin]
route: /companies
relatedCode:
  - src/components/Tenants.jsx
  - src/components/SignupWizard.jsx
relatedSops: [add-a-member, edit-company-and-billing-contact, create-a-contract]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Create the company record everything else hangs off — contracts, invoices, members, bookings and credits.

## When to do this

A new client is signing up, or an enquiry has converted and you need somewhere to put them.

## Before you start

Search **Companies** first. Duplicate companies split a client's contracts and invoices across two records and are painful to merge.

Then pick your route:

| Situation | Route |
|---|---|
| A client is signing up now, with a contract | **Sign up company** — the guided wizard |
| You just need the record (a lead, a placeholder, a drop-in) | **Add Company** |

## Steps — Add Company (record only)

1. Open **Companies** and click **Add Company**.
2. On the **General** tab, enter the **Name** (required). Enter the **Email**, **Contact Name**, **Phone**, **Start Date** (defaults to today), **Status** and **Industry**.
3. On the **Address** tab, enter the client's own business address — this is *their* address, not their Hexa Space suite.
4. On the **Billing** tab, enter the registered **Business Name**, **ABN**, **Tax Rate** (GST 10%), **Payment Method** and **Billing Period Start Date**.
5. Click **Add**.

## Steps — Sign up company (guided, end to end)

1. Open **Companies** and click **Sign up company**.
2. **Company** — enter the company name (required) plus ABN, email, phone, industry, address and billing settings. Click **Next: Contact →**. The company record is created at this point.
3. **Contact** — enter the **Full name** and **Email** (both required). Both drive signing, invoices and the portal invite. **Contact Person**, **Billing Person** and portal access are pre-ticked. Click **Next: Contract →**.
4. **Contract** — the standard contract form, with the company locked in. Fill it in and save. See [Create a contract](../contracts/create-a-contract.md).
5. **Review & bill** — check the summary, then click **Raise deposit invoice** if a deposit applies.
6. Click **Finish & send for signing →** to jump straight to the contract, or **Finish** to stop here.

## What happens automatically

- **Records are created step by step, not at the end.** Clicking **Next** on the Company step creates the company immediately; **Next** on the Contact step creates the member. If you abandon the wizard halfway, those records still exist.
- The contact's name is mirrored onto the company as its **Contact Name** so the contract form's Member dropdown can find them.
- **The company's Status is mostly derived, not stored.** A company with an active contract always shows **Active**. Without one it shows **Former** — unless an admin explicitly changed the status in the edit modal, in which case that choice wins.
- The deposit invoice raised by the wizard is **pending**, due in 14 days, and carries GST. (The deposit invoice raised at signing does *not* carry GST — see Common mistakes.)
- The first monthly invoice is **not** raised here. It comes from the signing flow or the monthly bill run.

## Common mistakes

- **Creating a duplicate.** Search first. Lydian needed a manual merge because of this.
- **Putting the Hexa Space suite in the Address tab.** That field is the client's own registered address, used on invoices.
- **Leaving the contact email blank in the wizard.** It is blocked for a reason — that address drives signing, invoices and the portal invite.
- **Expecting Status to stick.** Setting a company to Active without a contract will read as **Former** on the list; only an explicit change in the edit modal overrides the derived value.
- **Abandoning the wizard and starting again.** You will have created an orphan company and member. Search before you restart.
- The **Members** column on the Companies list is not a real count — it shows 1 if the company has a contact name or email, and 0 otherwise. Open the company to see actual members.

## If something goes wrong

- **You created a duplicate** — do not delete blindly. If either record has contracts or invoices, escalate to Eric; merging is a scripted job.
- **Delete a company** — the confirmation warns *Any associated contracts will remain*, which means orphaned contracts. Only delete a company that has nothing attached.
- **The wizard errored mid-way** — check Companies and Members for the partial records before retrying.

## Related

- [Edit a company and set the billing contact](edit-company-and-billing-contact.md)
- [Add a member to a company](add-a-member.md)
- [Create a contract](../contracts/create-a-contract.md)

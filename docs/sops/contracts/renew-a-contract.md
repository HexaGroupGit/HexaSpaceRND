---
slug: renew-a-contract
title: Renew a contract, and how auto-renew works
category: contracts
audience: [ops, admin]
route: /renewals
relatedCode:
  - src/components/Renewals.jsx
  - src/components/Leases.jsx
  - api/reconcile.js
  - src/lib/esign.js
relatedSops: [create-a-contract, member-gives-notice, amend-a-contract]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Continue a membership past its term end — either by papering a new contract, or by letting it roll and confirming the roll.

## When to do this

A contract appears under **Renewals**, or a client asks to extend.

## Before you start

Open **Renewals** and read which section the contract is in:

| Section | Meaning |
|---|---|
| **Expiring Within 60 Days** | Still running, needs a decision |
| **Overdue / Not Renewed** | Already past its end date |
| **Auto-Renewed — Pending Approval** | Rolled forward automatically, waiting on you |
| **Notice Given — Leaving Soon** | Not a renewal — they are leaving |

## Steps — remind the client

1. Open **Renewals** and find the contract.
2. Click **Email Tenant**. A renewal notice goes to the company's billing email stating the expiry date, the current monthly fee, and that it renews automatically unless they give notice.
3. Confirm the *Renewal email sent to …* alert.

## Steps — paper a new contract

1. From **Renewals**, click **Renew** on the row. The form opens pre-filled with the same spaces, the same term length, starting the day after the current term ends.
2. From the **Contracts** list instead, click the gear icon and choose **Renew** — that route starts the new term on the **1st of the month after** the current one ends.
3. Check the pricing. It has already been uplifted (see below).
4. Click **Create**.

## Steps — approve an auto-renewal

1. Open **Renewals** → **Auto-Renewed — Pending Approval**.
2. Click **Approve renewal** to confirm, or **Decline & end** to end it. Declining asks you to confirm and warns that the space and parking are released, Salto access revoked, and a bond refund raised.

## What happens automatically

- **CPI uplift on renewal.** Every price the renewal inherits — monthly rent, list price, every step — is increased by Settings → Billing Rules → renewal CPI percentage (default **4%**). The same percentage fills the CPI clause in the agreement. You can edit the prefilled prices before sending.
- **A renewal contract goes out for e-signature the moment you click Create.** You do not click Send. If the client's email is wrong, they get it anyway.
- **Renewals raise no deposit and no opening-month invoice.** The bond is already held under the prior contract and the ongoing membership is billed by the monthly bill run.
- **Renewing from the Renewals tab expires the old contract immediately** on save. Renewing from the Contracts gear menu does not — the old contract expires later, quietly, once its term ends and the signed successor is active.
- **Untouched contracts roll themselves forward.** The nightly reconcile takes any active contract past its end date that hasn't been declined, noticed or superseded, and extends it by its own original term length. It sets **pending approval** unless Settings → Billing Rules → auto-approve renewals is on.
- **Once a rolled renewal is approved, the client is emailed a confirmation** with the new end date, the monthly rent, and a self-serve *give notice* link.
- Reconcile runs at 20:30 UTC — about **6:30am Melbourne** next morning (7:30am during daylight saving). Auto-renew runs *after* the overdue auto-cancellation step, so a company being cancelled for non-payment is not renewed.

## Common mistakes

- **Editing a renewal after clicking Create, expecting to send it later.** It has already gone to the client.
- **Not checking the CPI uplift.** 4% is applied silently to every price. If the client was promised a held rate, correct it in the form before saving.
- **Using the wrong Renew button.** Renewals tab = contiguous, expires the old one now. Contracts gear = starts the 1st of the following month. Pick deliberately.
- **Using Duplicate instead of Renew.** Duplicate breaks the link to the previous contract, so the supersede handling won't fire and you can end up with two live contracts on one space.
- **Assuming a lapsed contract has stopped.** It hasn't — it rolls forward and keeps billing. That is deliberate, so no invoices are missed, but it means "expired" in the list rarely means "finished".

## If something goes wrong

- **Two active contracts on one space** — the newer one should carry the previous contract's link. If it doesn't, terminate the old one manually and tell Eric.
- **A renewal went out with the wrong price** — the client has the e-sign link already. Send a corrected contract, tell them to ignore the first, and terminate the wrong one before it can be signed.
- **Auto-approve is on and you didn't expect it** — the green banner at the top of Renewals says so. It is a Settings → Billing Rules switch.

## Related

- [Process a member giving notice](member-gives-notice.md)
- [Terminate a contract early](terminate-a-contract.md)
- [Amend a contract mid-term](amend-a-contract.md)

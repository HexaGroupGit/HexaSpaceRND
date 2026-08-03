---
slug: member-gives-notice
title: Process a member giving notice
category: contracts
audience: [reception, ops, admin]
route: /leases
relatedCode:
  - api/renewal-notice.js
  - src/components/GiveNoticePage.jsx
  - src/components/ContractDetail.jsx
  - api/reconcile.js
relatedSops: [renew-a-contract, terminate-a-contract]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Record that a member is leaving, on the correct last day, so billing stops at the right point and offboarding runs itself.

## When to do this

A member tells you they are leaving — by email, in person, or by clicking the give-notice link in a renewal email.

## Before you start

Check whether they have already given notice themselves. Open **Renewals** → **Notice Given — Leaving Soon**. The **Source** column shows **Tenant (self-serve)** or **Admin**.

## The last day is not negotiable by default

The vacate date is the **later** of:

- the end of their committed term, and
- today plus their notice period in months (default 2).

A fixed-term member serves out their term. A month-to-month member leaves after their notice period. If a renewal had just auto-rolled and was awaiting approval, giving notice rolls it back to the previously committed end date first.

## Steps — the member told you directly

1. Open **Contracts** and click the contract row.
2. Click **...** in the top bar, then **Serve Notice to Vacate**.
3. Set the **Notice Date** (defaults to today).
4. Set the **Expected Vacate Date** using the rule above — the platform does **not** calculate it for you on this form.
5. Add **Notes** — reason for vacating, condition notes.
6. Leave **Bond / security deposit has been refunded** unticked unless it genuinely has been.
7. Click **Save Notice**. An orange **Notice to Vacate Served** banner appears on the contract with an **Edit** button.

There is also a **Serve Notice** action on the Contracts gear menu. It records **today** as the notice date and nothing else — no vacate date, so nothing will end automatically. Use the full modal instead.

## Steps — the member used the self-serve link

Nothing to do. Check the details are right:

1. Open **Renewals** → **Notice Given — Leaving Soon** and confirm the **Last Day**.
2. If it is wrong, open the contract and use **Edit** on the orange banner to correct the vacate date.

## What happens automatically

- **Billing stops at the vacate date.** The engine prorates the final month to it and never bills past it.
- **On the vacate date, the nightly reconcile ends the contract** — status expired, flagged for offboarding. The offboarding cascade (spaces freed, parking released, bond refund raised for approval, portal access handled) runs when an admin next loads the app; the same reconcile run revokes Salto door access for anyone whose company no longer holds a live contract.
- The contract drops out of the renewal nag lists as soon as notice is recorded, so it stops showing as "expiring, action required".
- **Self-serve notice emails the admins** (eric@ and info@) immediately with the business, contract, space, last day and reason — so a departure can't go unseen.
- The member's page is deliberately two-step: they see their computed last day and must confirm. A mis-click or an email link-preview bot cannot end a membership.

## Common mistakes

- **Using the gear-menu Serve Notice and assuming it's done.** It records the notice date only. Without a vacate date nothing ends and billing continues.
- **Setting the vacate date to the day they say they're leaving.** If that is before their committed term end or their notice period, we are giving away rent they owe. Apply the rule.
- **Ticking Bond refunded when it hasn't been.** The banner then reads *Bond refunded: Yes* and nobody chases it.
- **Recording notice twice** — once by them, once by you. Check Renewals first; a contract that already has notice on file shows the member *Notice already on file*.
- **Forgetting that notice ≠ termination.** They stay active, with access, until their last day.

## If something goes wrong

- **The member says the link isn't valid** — the contract has already ended, or the token was regenerated. Record the notice yourself from the contract.
- **The last day is wrong** — edit it via the orange banner before the date passes. Once reconcile has expired the contract, it needs to be reversed by hand; escalate to Eric.
- **They change their mind** — the member page tells them to email info@. Clear the notice fields on the contract and confirm with Eric that billing has resumed.

## Related

- [Renew a contract](renew-a-contract.md)
- [Terminate a contract early](terminate-a-contract.md)

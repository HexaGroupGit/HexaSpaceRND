---
slug: issue-a-fob
title: Issue a fob or remote
category: spaces-access
audience: [reception, ops, admin]
route: /fobs
relatedCode:
  - src/components/Fobs.jsx
  - src/lib/fobs.js
  - src/components/FobOrderTab.jsx
relatedSops: [replace-a-lost-fob, provision-salto-access, refund-a-deposit]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Hand a physical access device to a member and take the refundable deposit for it.

## When to do this

A member needs a fob or a car-park remote, or a portal request is waiting.

## Before you start

Know the deposits — they are **refundable** and invoiced on issue:

| Device | Deposit |
|---|---|
| Fob | $100 |
| Remote | $200 |

## Steps — add a device to inventory

1. Open **Fobs & Remotes**.
2. Add the device: **Serial number**, **Type** (fob or remote), **Location**, and any notes.
3. Save with **Add device**.

Serials are normalised — uppercased with spaces stripped — so `80 7a pd` and `807APD` are the same device. If it already exists you're told so and blocked.

## Steps — issue it

1. Find the device with status **Available** and click **Issue**. Or, if a member has requested one, click **Issue** on their pending request.
2. Pick the **Member** — required.
3. Set an **Expected return** date if it's temporary.
4. Add **Issue notes**.
5. Click **Issue device**.

## Steps — take it back

1. Find the device (status **Issued**) and click **Return**.
2. Tick **Refund the $X deposit** to raise a refund credit note. Leave it unticked to waive.
3. Add return notes and click **Mark returned**.

## What happens automatically

- Issuing creates an assignment record, flips the device to **Issued**, and **raises a refundable deposit invoice to the member's company** — no GST, due immediately, described as *Refundable fob deposit — <serial>*.
- Any matching pending portal request is resolved automatically.
- Returning frees the device back to **Available** and, if you ticked refund, raises a **bond refund credit note** that lands in Billing's approval queue — the same queue as security deposits. It is not paid until approved and paid out.
- Deposit status on the badge is reconciled against the **actual invoice**, not a cached flag — so *Deposit held* means the invoice really is paid.
- Devices a member holds show on their member profile under **Fobs & Remotes**, with deposit status.

## Common mistakes

- **Issuing a device without a member.** The button stays disabled — the assignment must have a holder.
- **Assuming issuing grants door access.** It does not. Salto access is separate — see [Provision Salto access](provision-salto-access.md).
- **Ticking refund when the deposit was never paid.** The refund only raises if the deposit invoice is actually paid; otherwise it's marked waived.
- **Handing over the device before the deposit is invoiced.** It's raised automatically on issue, but it is not *paid* — chase it like any invoice.
- **Adding a duplicate serial.** Blocked, but it's a sign the device is already issued to someone. Use **Issue** on the existing record.

## If something goes wrong

- **"Could not issue the device — the assignment didn't save."** — usually an admin permission problem. Check you're signed in as an admin, then retry.
- **"The assignment saved, but the device status didn't update."** — the member holds the device but inventory shows it available. Fix the device record and tell Eric.
- **A returned device still shows issued** — the return didn't save. Redo it.
- **A member has a device with no record** — issue it retrospectively so the deposit and history exist.

## Related

- [Replace a lost fob](replace-a-lost-fob.md)
- [Provision Salto access on move-in](provision-salto-access.md)
- [Refund a security deposit](../billing/refund-a-deposit.md)

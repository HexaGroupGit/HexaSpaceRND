---
slug: replace-a-lost-fob
title: Replace a lost fob or remote
category: spaces-access
audience: [reception, ops, admin]
route: /fobs
relatedCode:
  - src/components/Fobs.jsx
  - src/lib/fobs.js
relatedSops: [issue-a-fob, revoke-salto-access]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Write off a lost device, forfeit its deposit, and get the member back into the building.

## When to do this

A member reports a device lost or stolen.

## Before you start

Understand the money: **the deposit is forfeited**, kept to cover the lost device. A replacement takes a **fresh** deposit — $100 for a fob, $200 for a remote. Say so before you process it, so it isn't a surprise on their next invoice.

## Steps

1. Open **Fobs & Remotes** and find the device (status **Issued**).
2. Click **Lost**.
3. Read the warning — it states the deposit is forfeited and that a replacement takes a fresh deposit.
4. Add **Notes** — when and where it was lost, and whether it may have been stolen.
5. Confirm.
6. Issue a replacement as a **separate** action — see [Issue a fob or remote](issue-a-fob.md).

## What happens automatically

- The assignment is closed as lost, and the deposit is marked **Forfeited**.
- The device is set to **Lost** in inventory and detached from the member and company. It never returns to the available pool.
- **No refund credit note is raised** — that's what forfeiting means.
- Issuing the replacement raises a **new** deposit invoice.

## What does NOT happen automatically

- **The lost device is not deactivated in Salto KS.** Nothing in this flow tells the door system to stop honouring it. Whoever finds it can still use it.

Until that is confirmed otherwise, treat deactivating the lost credential in the Salto KS portal as a **required manual step**, done the same day.

> **TODO(verify):** confirm whether marking a device lost should also trigger a Salto KS deactivation, and whether any zap covers it. From `Fobs.jsx`, `markLost` only writes the assignment and inventory records — there is no access-system call. If a manual KS step is required, it needs to be a numbered step above, with the exact KS path.

## Common mistakes

- **Marking lost when the member has just mislaid it at home.** Forfeiting is irreversible. Wait a day where it's reasonable.
- **Forgetting the KS deactivation.** A lost fob that still opens doors is a security problem, not an admin one.
- **Not warning the member about the double cost.** They lose the old deposit *and* pay a new one.
- **Using Return instead of Lost** to be kind. Return puts a device that no longer exists back into available inventory.
- **Issuing the replacement inside the same conversation and forgetting the deposit invoice.** It's raised automatically — make sure they expect it.

## If something goes wrong

- **It turns up later** — the device is Lost in inventory and its deposit forfeited. Re-adding it to circulation and reversing the forfeit is a manual fix; ask Eric.
- **A device was marked lost by mistake** — same. There is no undo.
- **The member disputes the forfeit** — that's a commercial call, not a system one. Escalate.

## Related

- [Issue a fob or remote](issue-a-fob.md)
- [Revoke Salto access on move-out](revoke-salto-access.md)

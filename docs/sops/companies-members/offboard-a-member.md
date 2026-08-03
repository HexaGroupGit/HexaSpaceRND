---
slug: offboard-a-member
title: Offboard a member
category: companies-members
audience: [ops, admin]
route: /members
relatedCode:
  - src/store/useStore.js
  - api/auth/revoke.js
  - api/portal/remove-teammate.js
  - api/reconcile.js
relatedSops: [invite-a-member-to-the-portal, terminate-a-contract, member-gives-notice]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Remove a person's access — portal login, door access and devices — when they leave.

## When to do this

An individual leaves a company that is staying, or a whole company departs.

## Before you start

Work out which case you are in, because they behave completely differently:

| Case | What handles it |
|---|---|
| **One person leaves, company stays** | Manual — see below. Nothing is automatic. |
| **The whole company leaves** | The contract-end cascade does most of it |
| **A client removes their own teammate** | The portal does it all in one call |

## The trap

**The Portal Access toggle on a member's profile does not revoke their login.** It flips a flag on the record. Their Supabase account still exists and they can still sign in. Revoking a login for real happens only through the contract-end cascade or the portal's remove-teammate flow.

There is currently no admin button that bans one individual's login while their company stays.

> **TODO(verify):** confirm the intended process for offboarding one individual from a continuing company. Right now the only reliable routes are (a) ask the client's contact person to remove them in the portal, or (b) have someone run the revoke endpoint. Should the member profile get a proper "Revoke portal access" button?

## Steps — one person leaves, company stays

1. Open **Members** and click the person.
2. Set **Status** to **Former** (via **Edit Details**).
3. Turn **Portal Access** off. *Understand this does not disable their login* — see above.
4. Ask the company's **Contact Person** or **Billing Person** to remove them from the portal's team screen. That is the only self-service path that actually bans the login and revokes door access.
5. Check **Fobs & Remotes** in their sidebar and collect any devices listed.
6. If they had door access, confirm removal in Salto KS by hand.

## Steps — the client removes their own teammate

Nothing for you to do. For reference, the portal enforces:

- Only the company's **contact person** or **billing person** may remove teammates.
- Nobody can remove themselves.
- The **billing person can only be removed by us** — so a company can't orphan its own billing contact. They are told to email info@.

## Steps — the whole company leaves

Terminate or expire the contract; the cascade runs. See [Terminate a contract early](../contracts/terminate-a-contract.md).

## What happens automatically

When a **contract ends** (terminated, or expired by the nightly reconcile):

- Every space the contract held is released — status and occupant both cleared — unless another live contract still holds it.
- **Salto access is revoked for every member of the company.** If the company keeps another space, only the vacated door's access group is stripped; a full departure deletes the KS user.
- **Portal access is revoked only when the company has no other live contract.** Offboarding one office during a move must not lock out a client who is staying. Where it does apply, each member's login is banned as well as flagged.
- A **bond refund** is raised for approval, net of any clause 13(b) virtual-office deduction.
- The nightly reconcile sweeps for stragglers: anyone still flagged with door access whose company holds no live contract, or who is Former/archived, gets a revoke fired and the flag cleared.

When a **member removes a teammate** in the portal: the record is set Former with portal access off, their login is banned, and Salto access is revoked — or, if the door webhook isn't wired, an ops task email is sent to info@ so it never silently drops.

Logins are **banned, not deleted** (about ten years), so history survives and the account can be restored if they come back.

## Common mistakes

- **Trusting the Portal Access toggle.** It is a flag, not a revocation. This is the most dangerous misunderstanding in this SOP.
- **Assuming door access ends immediately.** It ends on the next reconcile, roughly 6:30am the next morning. If it must be now, remove them in Salto KS by hand.
- **Forgetting the fobs.** Devices they hold are listed on their profile under **Fobs & Remotes**, with a deposit status. Collect them or charge for them.
- **Deleting the member record.** You lose their bookings, fees and history. Set them Former instead.
- **Offboarding during an office move.** The cascade is deliberately careful here — don't "help" it by manually revoking a client who is staying.

## If something goes wrong

- **An ex-member still has door access after a day** — check the daily reconcile digest for *NO WEBHOOK, remove manually in KS* and remove them by hand.
- **An ex-member can still sign in** — their login was never banned. Escalate to Eric.
- **A staying client got locked out** — the cascade thought they had no live contract. Check their contracts, re-invite, and tell Eric.

## Related

- [Terminate a contract early](../contracts/terminate-a-contract.md)
- [Process a member giving notice](../contracts/member-gives-notice.md)
- [Invite a member to the portal](invite-a-member-to-the-portal.md)

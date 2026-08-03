---
slug: provision-salto-access
title: Provision Salto access on move-in
category: spaces-access
audience: [ops, admin]
route: /members
relatedCode:
  - api/salto/provision.js
  - api/salto/_groups.js
  - src/lib/onboarding.js
relatedSops: [revoke-salto-access, meeting-room-door-access, countersign-a-contract]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Get a new member's door access working — automatically where possible, by hand where it isn't.

## When to do this

A contract clears the access gate and the member is moving in. It is normally triggered for you by onboarding.

## Before you start

Know which mode we're in, because it changes everything:

| Mode | What happens | How to tell |
|---|---|---|
| **Zapier** | The access group is granted automatically | Nothing arrives in the ops inbox |
| **Ops task** (default) | An email lands in the ops inbox with the exact KS steps to follow | You get the email |

Salto quoted $2,445 for direct API access, so we use their Zapier connector instead. Until that's live, provisioning is a **manual step in the Salto KS portal**, tracked by an emailed task — about two minutes per member.

## How the access group is chosen

The group name is resolved in this order:

1. The space's explicit **Salto doors** field, if set — this always wins.
2. Derived from the unit number — *Office 15*, *Suite 12*.
3. From the membership type — *Dedicated Desk*, *Flexible Access*.
4. Default: **Flexible Access**.

**Virtual Office members get no door access at all.** Creating a KS user for them wastes a seat, so provisioning is deliberately skipped — unless the space carries an explicit Salto doors override, which is the escape hatch if a particular VO member ever needs, say, mail-room access.

## Steps

1. Onboarding fires provisioning automatically once the contract's access gate is met.
2. **If an ops-task email arrives**, follow the KS steps in it: open the Salto KS portal, add the user, assign the named access group.
3. Confirm the member appears in the right group in KS.
4. The member receives their mobile-key invite from **Salto KS directly**, not from us.

## What happens automatically

- Provisioning is triggered by the onboarding flow when the gate clears — signed, deposit paid, first invoice paid, card on file if required, start date reached.
- The zap is idempotent: adding a user who already exists is handled, not duplicated.
- Group names are mapped to KS group IDs via a settings map, so adding a new group needs no code change.
- **No door-access link appears in the welcome email** in either current mode — the email omits that section when there's no link, and KS sends its own invite.
- Provisioning is admin-only at the API level; it can never be driven by an unauthenticated request.

## Common mistakes

- **Assuming access is live because the contract is signed.** It waits for the paid gate.
- **Ignoring the ops-task email.** In the default mode, that email *is* the provisioning step. Unactioned, the member has no access.
- **Expecting a Virtual Office member to get door access.** They deliberately don't.
- **Assuming a fob grants access.** The device and the KS group are separate; a member needs both.
- **Setting Salto doors on a space unnecessarily.** It overrides the derived group. Only set it where the KS group genuinely differs.

## If something goes wrong

- **The member has no access on day one** — check for an unactioned ops-task email, then check they're in the right KS group.
- **They're in the wrong group** — check the space's unit number and Salto doors field, since that's what the resolver reads.
- **A shared group looks wrong** — Dedicated Desk, Flexible Access and Virtual Office are shared across many companies. A room lock must never be added to those. See [Meeting-room door access](meeting-room-door-access.md).
- Anything involving someone having access they shouldn't: treat as urgent and escalate.

## Related

- [Revoke Salto access on move-out](revoke-salto-access.md)
- [How meeting-room door access is granted](meeting-room-door-access.md)
- [Countersign and send the getting-started pack](../contracts/countersign-a-contract.md)

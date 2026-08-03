---
slug: revoke-salto-access
title: Revoke Salto access on move-out
category: spaces-access
audience: [ops, admin]
route: /members
relatedCode:
  - api/salto/revoke.js
  - api/reconcile.js
  - src/store/useStore.js
  - api/portal/remove-teammate.js
relatedSops: [provision-salto-access, offboard-a-member, terminate-a-contract]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Make sure someone who has left can no longer open doors.

## When to do this

A contract ends, a member is removed, or you're checking that a past departure actually took effect.

## Two modes of revocation

| Mode | When it's used | What it does |
|---|---|---|
| **Remove from group** | The company keeps another space (office move, downsizing) | Strips only the vacated space's access group |
| **Remove user** (default) | Full departure | Deletes the KS user entirely |

The system picks between them on its own, based on whether the company still holds another live, non-parking contract.

## Steps — normal departure

1. End the contract — see [Terminate a contract early](../contracts/terminate-a-contract.md) or record their notice.
2. Revocation fires as part of the offboarding cascade, for every member of the company on every freed door.
3. **The next morning**, read the daily reconcile digest and check the door-access section.
4. If any line says **NO WEBHOOK, remove manually in KS**, remove those people in the Salto KS portal by hand.

## Steps — a client removes their own teammate

Nothing for you to do. The portal flow bans the login and revokes door access in one call — or, if the webhook isn't wired, emails an ops task to info@ so it can't silently drop.

## Steps — verify

1. Open the Salto KS portal and confirm the user or group membership is gone.
2. Check the **Access Log** for any unlock by that person after their end date.

## What happens automatically

- Offboarding revokes access for **every** member of the company, on **every** freed door.
- **The nightly reconcile is the safety net.** It sweeps for anyone still flagged with door access whose company holds no live contract — or who is Former or archived — re-fires the revoke, and clears the flag. That catches failed zaps and departures nobody processed.
- With no webhook configured, people are **listed for manual removal** in the digest rather than silently skipped.
- Revocation is admin-only at the API level.
- **Access does not end instantly.** It ends on the next reconcile run, about 6:30am Melbourne.

## Common mistakes

- **Assuming access ended the moment the contract did.** It ends on the next nightly run. If someone must lose access *now* — a dismissal, a security concern — remove them in Salto KS by hand immediately.
- **Not reading the digest.** *NO WEBHOOK, remove manually in KS* is the one line that means an ex-member still has access.
- **Manually removing someone during an office move.** The system deliberately strips only the vacated group so a staying client isn't locked out. Don't override it.
- **Forgetting the fob.** Revoking KS access is not the same as collecting the physical device — do both.
- **Trusting the member record's access flag.** It reflects what we *asked* for, not necessarily what KS did.

## If something goes wrong

- **An ex-member still has access after a day** — check the digest, then remove them in KS by hand. Then tell Eric, because the automation didn't do its job.
- **A current client lost access** — the cascade thought they had no live contract. Check their contracts, re-provision, and escalate.
- **The Access Log shows an unlock after someone's end date** — treat as a security incident: revoke in KS immediately and tell Eric the same day.

## Related

- [Provision Salto access on move-in](provision-salto-access.md)
- [Offboard a member](../companies-members/offboard-a-member.md)
- [Review the access log](review-the-access-log.md)

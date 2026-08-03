---
slug: incidents-and-lockouts
title: Incidents, lockouts and after-hours problems
category: operations
audience: [reception, ops, admin]
route: /access-log
relatedCode: []
relatedSops: [review-the-access-log, revoke-salto-access, escalation]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Deal with someone locked out, something damaged, or something going wrong when nobody senior is in the building.

## Lockouts

Members have 24/7 access, so lockouts happen at all hours.

### Steps

1. **Identify them.** Name, company, and check they're a current member in **Members**. Don't let someone in on confidence.
2. **Let them in** if they check out. Sorting the cause comes second.
3. **Find out why**, in this order:
   - Contract still active? An ended contract revokes access on the nightly sweep.
   - Overdue account? Door access is suspended automatically once an invoice is more than 14 days past due — with a $100 re-activation fee. Check **Billing → Overdue**.
   - Fob lost or not working? See [Replace a lost fob](../spaces-access/replace-a-lost-fob.md).
   - Access never provisioned? Common for new members if the ops-task email wasn't actioned.
4. **Fix the cause**, don't just keep letting them in.
5. **Log it** under Maintenance or as a note on the member, so a pattern is visible.

### If it's an overdue suspension

Do not quietly restore access. It was suspended deliberately and restores itself when the balance clears. Escalate to Eric — it's a commercial decision, not a door problem.

## Damage

6. **Make it safe first.** Cordon it, or take the space out of use.
7. **Photograph it** before anything is moved or cleaned.
8. **Log it under Maintenance** with the photos and where.
9. If a member caused it, note who and what — recharging is a decision for Eric, and evidence taken at the time is what makes it possible.

## Security concerns

10. **Someone in the building who shouldn't be** — do not confront alone. Building security or 000 as appropriate.
    > **NEEDS INPUT:** building security contact and after-hours number.
11. **Theft reported** — take details, check the **Access Log** for remote unlocks around the time, and escalate the same day. Remember the log only covers app unlocks, not fob taps — the full picture is in Salto KS.
12. **An ex-member with working access** — treat as urgent, revoke in Salto KS immediately, and tell Eric. See [Revoke Salto access](../spaces-access/revoke-salto-access.md).

## Emergencies

> **NEEDS INPUT — this section needs your real information, and it's the most important one on the page.**
>
> - Fire evacuation: assembly point, warden, alarm procedure
> - First aid kit location, and who is trained
> - Defibrillator, if there is one
> - Building management after-hours number
> - After-hours contact order for Hexa staff
> - Power failure / water leak / lift entrapment procedure

Until that's filled in, **000 first, then Eric**.

## What goes to Eric immediately

- Any injury
- Any theft or suspected theft
- An ex-member with working access
- Anything that could end up in a legal or insurance claim
- Anyone in the building who shouldn't be

## Common mistakes

- **Letting someone in without identifying them.** The whole access system is worth nothing if reception waves people through.
- **Restoring suspended access to be helpful.** It was suspended on purpose.
- **Cleaning up damage before photographing it.** The evidence goes with the mess.
- **Handling it and not logging it.** Patterns are invisible without records.
- **Waiting until morning** on a security matter.

## Related

- [Review the access log](../spaces-access/review-the-access-log.md)
- [Revoke Salto access](../spaces-access/revoke-salto-access.md)
- [Escalation](../system-administration/escalation.md)

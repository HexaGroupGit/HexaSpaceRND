---
slug: meeting-room-door-access
title: How meeting-room door access is granted
category: spaces-access
audience: [ops, admin]
route: /bookings
relatedCode:
  - api/salto/room-access.js
  - api/salto/_groups.js
relatedSops: [provision-salto-access, review-the-access-log]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Understand how a booked meeting room unlocks for the right people at the right time — and why it works two different ways.

## When to do this

A member can't get into a room they've booked, or you're asked how room access works.

## The two shapes

Access is granted differently depending on the member's plan, because of how Salto KS groups are structured:

| Company type | Shape | What happens |
|---|---|---|
| **Private office / suite** | **Lock-centric** | The company already has its own exclusive access group. The **booked room's lock** is added to that group for the booking window, then removed. |
| **Dedicated desk / flexible desk / virtual office** | **User-centric** | Those groups are **shared across many companies**, so adding a room lock would leak that room building-wide. Instead each teammate is added to the umbrella *Meeting Room* group, then removed. |

The lock-centric route costs about one add and one remove per booking regardless of team size, which is why it's used wherever it's safe.

**A room lock must never be added to a shared group.** That would grant the room to every company on that group.

## Timing

- **Grant** is pre-scheduled precisely — the automation waits until the booking's access-from time, then adds.
- **Removal is not scheduled.** A sweep runs hourly and only removes a grant once it sees that **no currently-active booking still needs it**.

That asymmetry is deliberate. It kills the back-to-back race where two consecutive bookings of the same room by the same company would otherwise have the first booking's removal strip access mid-meeting. The cost is that removal is only accurate to the hour — a group keeps room access until the sweep after the last booking ends. That's harmless.

## Steps — when a member can't get in

1. Check the booking is **Confirmed**. Access is only granted for confirmed bookings.
2. Check the booking's start time against now. Access activates shortly before the booking starts, not on booking.
3. Check the company type. A desk or virtual-office member needs to be in the *Meeting Room* group; an office company needs the room's lock in their own group.
4. Check the **Access Log** for a failed unlock attempt.
5. If it's urgent, let them in and sort the cause afterwards.

## What happens automatically

- The hourly cron grants access for confirmed bookings and reconciles grants away afterwards.
- Bookings are stamped when access is added and when it is removed, so nothing double-fires.
- Cancelled bookings drop out of the grant set.
- Delays cost nothing in the automation; only the add and remove actions are billed — which is why the design minimises them.

## Common mistakes

- **Expecting access the moment a room is booked.** It activates near the start time.
- **Adding a room lock to a shared group** to "fix" a desk member's access. That grants the room to every company in that group. Never do it.
- **Assuming removal is immediate.** It happens on the sweep after the last booking ends.
- **Treating an unconfirmed booking as bookable access.** Only confirmed bookings are granted.
- **Debugging a specific member when the whole company can't get in** — that's a group problem, not a person problem.

## If something goes wrong

- **Nobody from one company can get into any booked room** — their access group is likely wrong. Check the company type and their group.
- **One person can't, but their colleagues can** — user-centric shape, and they're missing from the umbrella group.
- **Access persisted after a booking** — expected until the next hourly sweep. If it lasts a day, escalate.
- **A room opened for someone with no booking** — treat as a security issue and escalate the same day.

## Related

- [Provision Salto access on move-in](provision-salto-access.md)
- [Review the access log](review-the-access-log.md)

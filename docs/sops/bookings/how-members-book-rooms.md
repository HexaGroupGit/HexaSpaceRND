---
slug: how-members-book-rooms
title: How members book rooms — credits, perks and overage
category: bookings
audience: [reception, ops, admin]
route: /bookings
relatedCode:
  - src/lib/credits.js
  - src/lib/dropIn.js
  - src/portal/PortalRooms.jsx
relatedSops: [book-on-behalf, drop-in-booking, meeting-room-door-access]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Understand what a member pays for a room, so you can answer "why was I charged for that?"

## When to do this

A member queries a booking charge, or asks what their plan includes.

## The three layers, in order

A booking is priced by working down this list. Only when one runs out does the next apply.

### 1. Perk rooms — free

Certain rooms are **free** for members, up to hour caps. Defaults:

| Membership | Free rooms | Max per booking | Max per day |
|---|---|---|---|
| Private Office | Sky, Earth, Sun, Moon | 2h | 4h |
| Dedicated Desk | Sky, Earth, Sun, Moon | 2h | 4h |
| Flexible Desk | Sky, Earth, Sun, Moon | 2h | 4h |
| Virtual Office | Sky, Earth | 2h | 2h |

Caps are **per company**, shared across the team — not per person. A company with several memberships gets the most generous tier it qualifies for. Editable in Settings → Room Perks.

### 2. Credits — the monthly pool

**1 credit = A$40 of bookings.** The pool is per **company**, resets monthly, and auto-computes from active memberships:

| Membership | Credits/month |
|---|---|
| Flexible Desk | 4 |
| Dedicated Desk | 8 |
| Private Office | 5 **× pax** |
| Virtual Office | 0 |

### 3. Overage — billed as a fee

Beyond the credits, the cost becomes a **Booking Fee** which sweeps onto the company's month-end invoice. The line reads *(over allowance)* when credits part-covered it.

## Member rate

A 30% member discount off the listed hourly rate exists in the code but is **currently switched off** — the app and portal charge the list rate to everyone. It's a single switch, flipped in one place when the rate is agreed.

> **TODO(verify):** confirm whether the member room rate should be live. `MEMBER_RATE_DISCOUNTED` is `false` in `dropIn.js`, so members pay list, while `memberRoomRate()` in `credits.js` defaults `isMember` to `true`. Two nearby switches with opposite defaults is worth a second look before anyone quotes a discount.

## After-hours

Booking windows differ by membership and by resource type — studios and podcast rooms have their own window. Set in Settings → After-hours.

## What happens automatically

- **Credits fail closed.** A company with no active membership has a spendable balance of **0**, whatever the stored number says — so a lapsed member's leftover credits can't discount a booking.
- Perk hours already used today are counted per company across the whole team.
- Overage creates a fee that sweeps onto the next invoice — nobody has to raise it.
- Credits reset on the 1st.

## Common mistakes

- **Treating credits as per-person.** One shared company pool.
- **Forgetting perk rooms are free first.** A member booking Sky for 2 hours normally spends nothing.
- **Quoting a member discount.** Not currently live — everyone pays list.
- **Topping up the allowance instead of the remaining balance.** Allowance is the monthly entitlement; Remaining is this month's.
- **Explaining an overage charge as an error.** It's the designed behaviour once credits run out.

## If something goes wrong

- **A member says they had credits and was charged** — check whether their membership is still active. No active membership means zero spendable credits.
- **A perk booking was charged** — check the room is in their tier's list and they were within the caps for that day.
- **The pool looks wrong** — open the company profile and click **Reset to plan** to see the computed figure.

## Related

- [Book a room on a member's behalf](book-on-behalf.md)
- [Take a drop-in booking](drop-in-booking.md)
- [How meeting-room door access is granted](../spaces-access/meeting-room-door-access.md)

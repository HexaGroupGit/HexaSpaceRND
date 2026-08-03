---
slug: book-on-behalf
title: Book a room on a member's behalf
category: bookings
audience: [reception, ops, admin]
route: /bookings
relatedCode:
  - src/components/Bookings.jsx
  - src/components/Calendar.jsx
  - src/lib/dropIn.js
relatedSops: [how-members-book-rooms, cancel-or-move-a-booking, function-space-pipeline]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Create a booking for a member who has phoned, emailed or walked up to reception.

## When to do this

A member can't or won't use the portal, or you're holding a room while something is arranged.

## Before you start

Check whether they're a **member** or a **drop-in**. Anyone with no active membership is a drop-in and **must pay before the booking exists** — see [Take a drop-in booking](drop-in-booking.md).

## Steps

1. Open **Bookings** and start a new booking. (**Calendar** gives the same result with a visual view of the day.)
2. Choose the **resource** — the room.
3. Choose the **member**, which fills their company.
4. Set the **date**, **start time** and **end time**.
5. Leave **status** on **Confirmed** unless you're pencilling something in.
6. **Source** records as **Admin** — that's how the booking is attributed to you rather than the portal or the website.
7. Save.

## What happens automatically

- The booking is priced through the same engine as the portal: perk rooms first, then credits, then overage as a fee. Booking on someone's behalf does not change what they pay.
- **Door access** is granted for confirmed bookings by the hourly job, near the start time — see [How meeting-room door access is granted](../spaces-access/meeting-room-door-access.md).
- The booking appears on the company profile and the member's profile.
- Bookings show a **source** badge — Admin, Portal or Website — so you can see where each came from.

## Common mistakes

- **Booking for a drop-in as if they were a member.** They must pay up front; creating an unpaid booking gives the room away.
- **Leaving status as Pending.** Door access is only granted for **Confirmed** bookings, so a pending booking won't open the door.
- **Booking the Function Space without realising what it blocks.** It occupies North, South and West as well — see [Why booking one Function Space room blocks the others](function-room-conflicts.md).
- **Booking a room the company gets free and assuming they're charged.** Perk rooms cost nothing within the caps.
- **Using Bookings when a function is what's wanted.** A paid event with catering and an agreement is a function booking, not a meeting-room booking.

## If something goes wrong

- **The room shows unavailable and you can't see why** — check whether the Function Space (or one of its component rooms) is booked at that time.
- **The member can't get in** — check the booking is Confirmed and the start time has arrived.
- **The charge was wrong** — check whether they had credits, whether it was a perk room, and whether their membership is active.

## Related

- [How members book rooms](how-members-book-rooms.md)
- [Take a drop-in booking](drop-in-booking.md)
- [Cancel or move a booking](cancel-or-move-a-booking.md)

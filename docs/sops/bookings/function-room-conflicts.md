---
slug: function-room-conflicts
title: Why booking one Function Space room blocks the others
category: bookings
audience: [reception, ops, admin]
route: /bookings
relatedCode:
  - src/lib/roomConflicts.js
  - src/lib/functionBooking.js
relatedSops: [function-space-pipeline, book-on-behalf]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Understand why a room shows as unavailable when nothing appears to be booked in it.

## When to do this

A room looks free but won't book, or you're checking availability for a function.

## The physical fact

**The Hexa Function Space is the North, South and West meeting rooms combined.** It's one physical space with movable walls, sold two ways.

So:

- Booking the **Function Space** makes **North, South and West** unbookable for that window.
- Booking **any one of** North, South or West makes the **Function Space** unbookable.

North, South and West don't block *each other* — they're genuinely separate when the space is divided.

## How it works

Rather than writing duplicate holds onto every sibling room, a booking on any of these rooms is treated as **also occupying** the others **whenever availability is checked**. It's resolved at read time.

That means there's nothing to keep in sync and no duplicate bookings to clean up — but it also means the calendar may not show an obvious blocking entry in the room you're looking at.

## Steps — when a room won't book

1. Check the **Function Space** for a booking at that time.
2. If you're trying to book the Function Space, check **North**, **South** and **West** individually.
3. Remember the **30-minute buffer** each side of a function — the block extends beyond the event times.
4. If nothing explains it, check for a multi-session function series with a session on that date.

## What happens automatically

- Component rooms are matched **by name** — North, South, West — so it works regardless of the underlying record ids.
- The Function Space is identified by its type, its id, or "function" in its name.
- Availability checks, function-space clash detection and series clash checks all use the same rule, so they agree.

## Common mistakes

- **Booking North while a function is running.** The check will stop you, but don't promise the room first.
- **Renaming a component room.** Matching is **by name** — renaming North to something else silently breaks the conflict detection and lets the room double-book. Don't rename them without raising it.
- **Assuming an empty calendar column means available.** The blocking booking sits in a different room.
- **Forgetting the buffer** when quoting a tight turnaround.
- **Explaining it to a client as a system error.** It's the rooms being the same floor space.

## If something goes wrong

- **A room double-booked across the split** — that shouldn't be possible. Check whether a room was renamed, then escalate to Eric.
- **The Function Space shows free but a component is booked** — reload; if it persists, escalate.
- **A client is standing in a room booked to someone else** — sort the people first, the record second.

## Related

- [Function space — enquiry to confirmed](function-space-pipeline.md)
- [Book a room on a member's behalf](book-on-behalf.md)

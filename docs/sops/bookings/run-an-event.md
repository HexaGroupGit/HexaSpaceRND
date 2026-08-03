---
slug: run-an-event
title: Run an event — create, registrations, reminders
category: bookings
audience: [reception, ops, admin]
route: /events
relatedCode:
  - src/components/EventsHub.jsx
  - src/components/Events.jsx
  - src/components/EventRegistrations.jsx
  - api/event-reminders.js
relatedSops: [event-booking-agreements, post-an-announcement]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Put on a community event and manage who's coming.

## When to do this

A member social, a workshop, a networking morning — anything we host for the community.

## Before you start

Book the room. An event doesn't hold a space by itself — if it's in a meeting room or the Function Space, make the booking too.

## Steps

1. Open **Events**. Two tabs: **Events** and **Registrations** (the Registrations tab shows an unread count).
2. Create the event with its name, date, time and details.
3. Publish it so members see it in the portal and app.
4. Watch **Registrations** — new ones show as unread.
5. Reminders go out automatically before the event.
6. After the event, check the registration list against who actually came if it matters for capacity planning.

## What happens automatically

- **Event reminders run daily** at 22:00 UTC — about **8am Melbourne** (9am during daylight saving).
- Registrations arriving from the portal or the public page appear in the Registrations tab and increment the unread badge.
- Members see published events in the portal and the mobile app.

## Common mistakes

- **Creating the event but not booking the room.** The event exists; the space is still bookable by someone else.
- **Not publishing.** An unpublished event is invisible to members.
- **Ignoring the unread badge.** It's the only signal that someone registered.
- **Confusing an event with a function booking.** An event is ours, free or community; a function is a paid hire with an agreement — see [Function space — enquiry to confirmed](function-space-pipeline.md).
- **Assuming registration equals attendance.** No check-in step is enforced.

## If something goes wrong

- **Registrations aren't appearing** — check the event is published and the public page is reachable.
- **Reminders didn't go** — check safe mode first, then whether the cron ran.
- **The room was double-booked** — the event didn't reserve it. Book it properly and sort the clash.

> **TODO(verify):** confirm the exact controls on the Events tab — I documented the flow from `EventsHub.jsx` and the reminder cron, but did not read `Events.jsx` in full, so the create/publish button labels here are described rather than quoted. Walk the UI and pin the exact wording.

## Related

- [Event booking agreements and insurance](event-booking-agreements.md)
- [Function space — enquiry to confirmed](function-space-pipeline.md)

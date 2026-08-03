---
slug: function-series
title: Multi-session function series
category: bookings
audience: [ops, admin]
route: /function-bookings
relatedCode:
  - src/lib/functionBooking.js
  - src/components/FunctionBookings.jsx
relatedSops: [function-space-pipeline, function-room-conflicts]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Quote and book a function that runs across several dates as one booking.

## When to do this

A recurring class, a training course, a weekly meet-up — anything using the space on more than one date under one agreement.

## Before you start

Have every date and time. A series is priced as a whole, so adding a session later re-prices the booking.

## Steps

1. Create the function booking as normal — see [Function space — enquiry to confirmed](function-space-pipeline.md).
2. Enter the **sessions**: each with its own date, start time and end time.
3. Check the computed quote. Each session is priced on **its own date** — a series spanning weekdays and weekends mixes $250 and $325 hourly rates.
4. Confirm the label reads correctly: a single date shows as `25/07/2026`; a series shows as `6 sessions · 25/07 – 30/08/2026`.
5. Check for clashes across **every** session before sending the agreement.

## What happens automatically

- **Every session is priced individually and summed** — hours, venue hire and staff costs are totalled across the series.
- Weekday and weekend rates are applied per session, from each session's own date.
- The **30-minute buffer** applies to each session.
- Clash checking covers **all** sessions — both against other function bookings and against the calendar, including the component-room conflicts.
- The whole series is one agreement, one deposit and one invoice.

## The bug that was here

The portal used to quote **only the first session** of a series — so a six-session booking was quoted as one. Fixed and deployed 28 July 2026. If you see an old quote that looks too cheap for the number of sessions, that's why.

## Common mistakes

- **Quoting one session and multiplying by hand.** The engine already totals the series, including the weekday/weekend mix.
- **Adding a session after the agreement is signed.** The price changes; the signed agreement doesn't. Re-paper it.
- **Checking only the first date for clashes.** Every session needs to be free.
- **Forgetting the buffer on each session.** Six sessions means six blocked windows, each an hour longer than the event.
- **Assuming one fee per session.** Cleaning and late fees apply to the booking, not per session — check the quote breakdown rather than assuming either way.

## If something goes wrong

- **The total looks wrong** — check the session list first: a missing or duplicated date is the usual cause.
- **One session clashes** — the whole series is blocked on that date. Move that session or the clashing booking.
- **The client wants to drop a session** — that re-prices the booking. Handle it before the balance is due.

> **TODO(verify):** confirm whether the cleaning fee, late fee and security deposit apply once per **booking** or once per **session** in a series. The engine sums per-session rental and staff explicitly, but I could not establish the treatment of the flat fees from the code alone. This changes what a six-session client is quoted, so it should be nailed down.

## Related

- [Function space — enquiry to confirmed](function-space-pipeline.md)
- [Why booking one Function Space room blocks the others](function-room-conflicts.md)

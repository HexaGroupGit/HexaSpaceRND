---
slug: cancel-or-move-a-booking
title: Cancel or move a booking
category: bookings
audience: [reception, ops, admin]
route: /bookings
relatedCode:
  - src/lib/dropIn.js
  - src/components/Bookings.jsx
  - src/app/lib/bookingActions.js
relatedSops: [how-members-book-rooms, drop-in-booking, book-on-behalf]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Free a slot someone no longer needs, and know whether their money comes back.

## When to do this

A member cancels or wants a different time.

## The rule

**Cancelling is always allowed** — freeing the slot helps everyone. What's gated is the **refund**.

A booking that has been *used* is charged whether or not it's later marked cancelled. "Used" means either:

- the **door was opened** for it (the member remote-unlocked from the app), **or**
- the **booked window has started** — whether or not they turned up, because the slot was held and nobody else could book it.

So a member cancelling five minutes into their slot is charged. A member cancelling the day before is not.

## Steps — admin

1. Open **Bookings** (or **Calendar**) and find the booking.
2. Cancel it, or delete and rebook for a different time.
3. If a refund is due and money changed hands, handle it through Billing.

## Steps — the member, in the app

Members can cancel or change the time themselves **before the booking starts**. Once it starts, those controls disappear.

## What happens automatically

- Cancelled bookings drop out of the door-access grant set, so access won't be given.
- If access was already granted, the hourly sweep removes it once no active booking needs it — accurate to the hour, not the minute.
- A cancelled booking still shows on the company and member profiles, marked cancelled.
- **Door-open detection only sees remote unlocks from the app.** A member who taps in with a physical fob leaves no trace here — which is why the window-started test carries the rest of the "was it used" judgement.

## Common mistakes

- **Refunding a booking whose window has started.** They had the room; nobody else could book it.
- **Assuming no door-open record means they never used it.** Fob entries aren't visible to us.
- **Cancelling instead of moving.** For a member with credits it's usually equivalent, but for a drop-in who paid up front a cancel-and-rebook may mean a second charge.
- **Cancelling a Function Space booking and expecting the component rooms to free instantly** — they do, but check the calendar rather than assuming.
- **Deleting rather than cancelling.** Deleting loses the record of what happened.

## If something goes wrong

- **A member says they cancelled but were charged** — check the start time and any door-open stamp. If the window had started, the charge is correct.
- **A slot still shows busy after cancelling** — reload. If it persists, check for a conflicting Function Space booking.
- **A drop-in cancelled and wants their money back** — same rule. If the window hadn't started, refund through Billing; that's a manual step.

> **TODO(verify):** confirm whether a drop-in's up-front payment is refunded automatically on a qualifying cancellation, or whether it needs a manual Stripe refund. `refundableOnCancel()` decides eligibility, but I couldn't find the path that actually returns the money.

## Related

- [How members book rooms](how-members-book-rooms.md)
- [Take a drop-in booking](drop-in-booking.md)
- [How meeting-room door access is granted](../spaces-access/meeting-room-door-access.md)

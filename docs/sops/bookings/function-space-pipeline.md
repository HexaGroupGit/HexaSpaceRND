---
slug: function-space-pipeline
title: Function space — enquiry to confirmed
category: bookings
audience: [ops, admin]
route: /function-bookings
relatedCode:
  - src/components/FunctionBookings.jsx
  - src/lib/functionBooking.js
  - src/lib/functionActions.js
relatedSops: [function-series, function-room-conflicts, drop-in-booking]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Take a function-space enquiry through to a confirmed, paid booking.

## When to do this

An enquiry arrives from the website, by phone, or from a member.

## The stages

The booking moves through these, shown as a badge on every row:

**Enquiry** → **Quoted** → **Booking Requested** → **Invited to Portal** → **Agreement Sent** → **Awaiting Approval** → **Signed** → **Deposit Due** → **Confirmed** → **Completed** → **Deposit Refunded**

Plus **Cancelled** and **Declined**.

## The pricing

All ex GST:

| Item | Amount |
|---|---|
| Venue hire — weekday | $250/hr |
| Venue hire — weekend | $325/hr |
| Cleaning fee (mandatory) | $200 |
| Security deposit (refundable, no GST) | $300 |
| Late booking fee (within 7 days of the event) | $250 |
| F&B and AV staff | $40/hr, **only for functions over 80 guests** |

- **Deposit to confirm = 50% of venue hire**, non-refundable.
- **Balance due 14 days before the event.**
- A **30-minute turnover buffer** is applied each side of the event — the room is blocked for longer than the event itself.
- Weekday vs weekend is decided by the **event date**.

Rates are editable in **Function Bookings → ⚙ Pricing**, and a per-booking override beats both.

## Steps

1. Open **Function Bookings**. Tabs: **Active**, **All**, **Enquiries**, **Confirmed**, **Completed**, **Cancelled**, **⚙ Pricing**.
2. Open the enquiry and check the date, times and guest count.
3. Send the **brochure** if they need information first.
4. Review the computed quote. Apply a price override only if something was genuinely negotiated.
5. **Approve** the booking to move it forward and send the agreement.
6. The client signs via their own link.
7. **Confirm the deposit** once it's paid. This is what moves it to **Confirmed**.
8. Request **building access** for the event when needed.
9. After the event, **resolve the deposit** — record damage, refund, or overflow charges.

## What happens automatically

- The same pricing engine drives the website, the agreement and the invoice — the client sees one number everywhere.
- Confirming the deposit is what creates the calendar hold and moves the booking to Confirmed.
- Reminders and nurture emails run on their own crons (9am and 7am Melbourne).
- Booking the Function Space blocks North, South and West for the same window — see [Why booking one Function Space room blocks the others](function-room-conflicts.md).

## ⚠ Open security issue

The function-bookings notify endpoint is an **unauthenticated email relay**. It should not be treated as safe until fixed. Don't build anything new on it, and raise it with Eric if it comes up.

Also still open: the admin function form lacks a company/member picker, so a function booked by an existing member isn't linked to their company record.

## Common mistakes

- **Quoting the hire without the cleaning fee.** It's mandatory, every time.
- **Forgetting the 30-minute buffer.** The room is unavailable longer than the event — don't book something into the gap.
- **Missing the late fee.** Bookings inside 7 days carry $250.
- **Charging staff costs under 80 guests.** Only over 80.
- **Treating the security deposit as revenue.** It's refundable and carries no GST.
- **Confirming before the deposit lands.** The deposit is what confirms.

## If something goes wrong

- **The quote doesn't match what was promised** — check for a per-booking override, then the Pricing tab.
- **The client can't sign** — reissue their link from the booking.
- **The deposit was paid but the booking isn't confirmed** — use **Confirm deposit paid** explicitly.
- **A date clash appears late** — check the component rooms, not just the Function Space.

## Related

- [Multi-session function series](function-series.md)
- [Why booking one Function Space room blocks the others](function-room-conflicts.md)

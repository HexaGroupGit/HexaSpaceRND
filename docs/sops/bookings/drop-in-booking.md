---
slug: drop-in-booking
title: Take a drop-in booking (pay on the spot)
category: bookings
audience: [reception, ops, admin]
route: /bookings
relatedCode:
  - src/lib/dropIn.js
  - src/lib/credits.js
  - api/bookings/pay-and-book.js
relatedSops: [how-members-book-rooms, book-on-behalf, cancel-or-move-a-booking]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Take a room booking from someone with no membership — and get paid before they have the room.

## When to do this

A walk-in, a former member, or anyone whose company holds no active contract.

## Why it works this way

A booking fee on the month-end bill only collects from someone who *gets* a month-end bill. A drop-in has no membership and no bill run, so the charge either sat unpaid or — with no company record at all — was never raised, and the room went out free.

**A drop-in now adds a card and is charged before the booking exists.**

## The rule

| Who | What happens |
|---|---|
| **Active membership** | Books normally. Overage becomes a month-end fee. Never blocked mid-booking. |
| **No active membership** (drop-in) | Must pay the full room hire up front. No credits apply. |

Drop-ins pay the **list rate**. The member discount is a membership benefit, not a walk-in price.

## Steps

1. Confirm they have no active membership — a company with no active contract is a drop-in, however their record looks.
2. Take the booking through the normal flow.
3. The system requires payment before the booking is created. Card details are handled by Stripe.
4. Confirm the booking exists afterwards. **No payment, no booking** — there's no half-state to clean up.

## What happens automatically

- **Credits fail closed.** A drop-in has zero spendable credits no matter what the stored pool says — a stale balance from a lapsed membership can't discount a walk-in.
- Only true drop-ins are gated. A member who overruns their allowance keeps the month-end fee, so nobody with a membership is stopped mid-booking.
- Perk rooms don't apply to drop-ins.
- Once paid, the booking behaves like any other: door access near the start time, visible on the calendar.

## Common mistakes

- **Creating the booking first and chasing payment later.** That's exactly the hole this closed.
- **Assuming a company record means membership.** A former member with an expired contract is a drop-in.
- **Quoting the member rate.** Drop-ins pay list.
- **Manually adding credits to a drop-in's company** to cover a booking. It won't work — the credit check keys off active membership, not the stored balance.
- **Treating a lapsed member as a member "just this once".** If it's a commercial call, make it deliberately with Eric, not by working around the gate.

## If something goes wrong

- **The payment failed and they're standing there** — the booking doesn't exist. Take another card or take payment another way and create it manually, deliberately.
- **They're a member but being asked to pay** — their contract is not active. That's a contract problem worth checking properly; it also means they aren't being billed.
- **They paid but no booking appeared** — check Bookings for the slot before taking a second payment, then escalate.

## Related

- [How members book rooms](how-members-book-rooms.md)
- [Book a room on a member's behalf](book-on-behalf.md)
- [Cancel or move a booking](cancel-or-move-a-booking.md)

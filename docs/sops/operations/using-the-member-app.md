---
slug: using-the-member-app
title: How to use the member app (and support a member on it)
category: operations
audience: [reception, ops]
route: /members
relatedCode:
  - src/app/MobileApp.jsx
  - src/app/tabs/More.jsx
  - src/app/screens/Key.jsx
  - src/app/screens/Printer.jsx
relatedSops: [printer-setup-for-members, invite-a-member-to-the-portal, how-members-book-rooms]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Know what's in the member app so you can walk someone through it at the desk, rather than guessing alongside them.

## When to do this

Induction, or any "how do I…" question about the app.

## Getting them into it

The app lives at **portal.hexaspace.com.au/app**, and there are native iOS and Android builds.

Members are told to add it to their home screen so it opens like an app:

- **iPhone** — open in Safari, tap **Share**, then **Add to Home Screen**
- **Android** — open in Chrome, tap the **⋮** menu, then **Add to Home screen**

That instruction is already in the getting-started email, so most members have had it. They need a portal login first — see [Invite a member to the portal](../companies-members/invite-a-member-to-the-portal.md).

## The four tabs

| Tab | What's there |
|---|---|
| **Home** | Their day — bookings, what's on |
| **Book** | Meeting rooms and spaces |
| **Food** | Café and bakery ordering |
| **More** | Everything else (below) |

### Under More

| Item | What it does |
|---|---|
| **Billing & invoices** | Invoices, membership, saved card |
| **Events** | What's on at Hexa Space |
| **Messages** | Talk to the Hexa team |
| **Printing** | Their print ID and balance |
| **Guides** | Wi-Fi, printing, access, amenities |
| **Members directory** | The community |
| **Account** | Their details and payment method |

## My Key — the one people ask about

Tap-to-unlock for the doors a member may open **right now**. Three kinds of tile:

- **Your office** — from their active contract
- **Building entry** — for their floor
- **Open now — your booking** — a meeting room, live only during its window

The **server** decides which doors appear and authorises every open — the app only draws the tiles and fires the request. So if a door isn't showing, it's an access or booking question, not an app fault.

Every unlock is recorded — see [Review the access log](../spaces-access/review-the-access-log.md).

## Bookings from the app

A member can cancel or change the time of a booking **before it starts**. Once the window opens, those controls disappear — and the booking is chargeable whether or not they showed up. See [Cancel or move a booking](../bookings/cancel-or-move-a-booking.md).

## Common questions at the desk

- **"My office isn't in My Key"** — check their contract is active and access has been provisioned. See [Provision Salto access](../spaces-access/provision-salto-access.md).
- **"The meeting room won't unlock"** — access activates near the start time, and only for **confirmed** bookings.
- **"I can't see invoices"** — only the billing or contact person can. Flag them properly on their member record rather than explaining a workaround.
- **"Where's my print PIN?"** — More → Printing.
- **"I can't log in"** — their set-password link expires in 24 hours and is single use. Send a fresh invite, or point them at **Forgot password?**.

## Common mistakes

- **Telling a member to reinstall the app** for an access problem. The doors come from the server.
- **Assuming every member sees billing.** Only billing and contact people do.
- **Walking them through the portal when they're asking about the app.** Same login, different layouts.
- **Promising an instant unlock for a booking that hasn't started.**

## If something goes wrong

- **The app is blank after login** — they may have no active membership; check their contract.
- **Nothing unlocks at all** — check the Access Log for failed attempts, then their Salto group.
- **Repeated login failures** — escalate rather than sending invite after invite.

> **TODO(verify):** I documented the app from its code — tabs, More items and the My Key tiles are quoted from the source. But I have not walked it on a phone, so anything about *feel* (gestures, where a member's eye lands) is unverified. Worth ten minutes with a real handset before this is used for induction.

## Related

- [Set a member up for printing](printer-setup-for-members.md)
- [Invite a member to the portal](../companies-members/invite-a-member-to-the-portal.md)
- [How members book rooms](../bookings/how-members-book-rooms.md)

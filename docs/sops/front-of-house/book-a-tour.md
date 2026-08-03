---
slug: book-a-tour
title: Book a tour
category: front-of-house
audience: [reception, ops, admin]
route: /crm
relatedCode:
  - src/components/TourBookingModal.jsx
  - src/lib/tourInvite.js
  - api/book-tour.js
relatedSops: [log-an-enquiry, run-a-tour, safe-mode]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Get a prospect booked in for a viewing, with a real calendar invitation they can accept.

## When to do this

An enquiry comes in by phone and they're willing to come and look.

## Before you start

Have their name, email, the date and the time. The tour defaults to **30 minutes** unless you change it.

## Steps

1. Open **CRM** and find the lead, or create one first.
2. Open **Book a tour**.
3. Fill in **Contact name \***, **Business name**, **Email**, **Phone** and what they're **Interested in**.
4. Set the **Date \***, **Time \*** and **Duration**.
5. Set **Who's showing them around** — optional, and it appears on the invite.
6. Add a **Personal note** if you want something in their email, and **Internal notes** for the CRM and the team email only.
7. Check the two tick-boxes:
   - **Email them the confirmation + calendar invitation**
   - **Put it in the leasing team's calendars**
8. Click **Book tour & send invite**.

## Rescheduling

Open the same modal on a lead that already has a tour. It warns you the lead already has one and that saving will **move it and update their calendar**. The button becomes **Reschedule & re-send invite**.

## What happens automatically

- A real **.ics calendar invitation** is generated and emailed, so it lands in their calendar rather than as plain text.
- The email carries the **address**, **arrival instructions** and **parking options** — all editable under **Settings → Tours**, so reception can reword them without a deploy.
- Add-to-calendar links are included for **Google**, **Outlook.com** and **Outlook (work)**.
- The leasing team is notified — eric@, brittany@, scarlett@ and info@.
- The lead is created or updated in the CRM with the tour date.
- Email wording comes from **Templates → Emails → "Tour — Booking confirmed"**.

## ⚠ Check safe mode first

Tour invites were shipped on 31 July 2026 with **safe mode still on**, so this has not been tested against a real recipient. Before booking a tour for a real prospect, confirm safe mode is off — otherwise the invitation goes to the test inbox and your prospect gets nothing. See [Safe mode](../start-here/safe-mode.md).

## Common mistakes

- **Booking without checking safe mode.** The prospect silently gets nothing.
- **Leaving the email box unticked.** No invitation is sent.
- **Putting internal notes in the personal note.** The personal note goes to the client.
- **Booking a duplicate instead of rescheduling.** Use the same modal on the existing lead — it moves the tour and updates their calendar.
- **Assuming the default duration suits.** Thirty minutes is tight for a large group.

## If something goes wrong

- **They didn't get the invite** — check safe mode, then the email address, then re-send by rescheduling to the same slot.
- **The address or parking details are wrong** — fix them in Settings → Tours; they apply to every future invite.
- **The team didn't get it** — the notify list is fixed in code. If someone new needs to be on it, that's a code change.

## Related

- [Log a walk-in or phone enquiry](log-an-enquiry.md)
- [Run a tour and convert it](run-a-tour.md)
- [Safe mode](../start-here/safe-mode.md)

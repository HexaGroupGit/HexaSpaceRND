---
slug: log-an-enquiry
title: Log a walk-in or phone enquiry
category: front-of-house
audience: [reception, ops, admin]
route: /crm
relatedCode:
  - src/components/Crm.jsx
  - src/components/EnquiriesInbox.jsx
  - src/components/LeadsBoard.jsx
relatedSops: [book-a-tour, run-a-tour]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Capture someone who's interested, so they end up in the pipeline instead of on a sticky note.

## When to do this

Someone walks in, phones, or emails asking about space.

## Before you start

Get the essentials while they're in front of you: name, business, email, phone, and what they're after. Email matters most — everything downstream runs on it.

## Steps

1. Open **CRM**. Four tabs: **Leads**, **Enquiries**, **Function Enquiries**, **Referrals**.
2. **Enquiries** is the inbox — website enquiries land here and show as unread.
3. For a walk-in or phone enquiry, create the lead yourself with their details.
4. Set the **source** so the pipeline reflects reality: **walk-in**, **phone**, **email**, **website**, **referral** or **book-tour** — each shows as its own coloured badge.
5. Record what they're interested in and which space, if they named one.
6. If they're ready, book them a tour straight away — see [Book a tour](book-a-tour.md).

## What happens automatically

- Opening an enquiry **marks it read**, which clears the unread count. Only open one when you're actually going to deal with it.
- Website enquiries arrive in the Enquiries inbox on their own.
- Leads sit on the **Leads** board by pipeline stage.
- **Nurture emails run daily at 9am UTC** — that's about **7pm Melbourne**. A lead left alone will be emailed automatically.
- Converting a lead creates the company record.

## Common mistakes

- **Opening enquiries to "have a look".** It clears the unread flag and the next person assumes it's handled.
- **Not recording the source.** It's how you learn what actually brings people in.
- **Taking a name and no email.** Nearly everything downstream — brochure, tour invite, proposal — needs one.
- **Leaving a hot lead on the board with no next action.** The nurture sequence is a safety net, not a substitute for calling them.
- **Logging a function enquiry as a space lead.** Function Enquiries is a separate tab with its own pipeline.

## If something goes wrong

- **A lead was deleted by mistake** — there's no undo. Recreate it from whatever you have.
- **A duplicate lead** — merge by hand: keep the one with the history, delete the other.
- **The unread count looks wrong** — it counts genuinely unread leads. Someone has probably been browsing.

## Related

- [Book a tour](book-a-tour.md)
- [Run a tour and convert it](run-a-tour.md)

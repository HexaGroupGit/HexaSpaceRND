---
slug: nurture-sequences
title: How the nurture sequences work and how to stop one
category: growth
audience: [reception, ops, admin]
route: /crm
relatedCode:
  - api/lead-nurture.js
  - api/function-nurture.js
  - api/_leads.js
relatedSops: [work-the-leads-board, website-enquiries, safe-mode]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Know what the system is emailing your leads, so you don't contradict it — and know how to switch it off.

## When to do this

Before phoning a lead, and any time someone asks "have we followed up?"

## The lead sequence

Runs **daily at 9am UTC — about 7pm Melbourne**. Timed from the enquiry date:

| Day | What happens |
|---|---|
| **2** | Follow-up email |
| **5** | Second follow-up |
| **9** | Final follow-up |
| **14** | Moved to the **Lost** stage, sequence ends |

Each step sends once. Wording comes from **Templates → Emails** — *Lead — Follow-up (no reply)* and *Lead — Final follow-up*.

There's a **separate function-enquiry sequence** on its own daily schedule for function bookings.

## How to stop it

The sequence stops on its own when any of these becomes true:

- **The lead is moved out of a "new" stage.** Dragging a card forward on the board is the normal off-switch.
- **A tour is booked**, or the lead came in via the book-a-tour route.
- The lead reaches 14 days and goes to Lost.
- The lead has no email address.

So: to stop nurture on a lead you're handling personally, **move it along the board**.

## What happens automatically

- Nurture only runs while a lead sits **untouched in a new stage**. Any forward movement ends it.
- Progress is tracked per lead, so a step is never sent twice.
- With **safe mode on**, none of these reach the lead — they go to the test inbox.
- A lead with no email is skipped entirely and stays where it is.

## Common mistakes

- **Phoning a lead without checking what they were sent.** They may have had a "final follow-up" this morning.
- **Dragging cards to tidy the board** and silently ending nurture on leads that were being worked automatically.
- **Expecting nurture to chase a lead you've moved to "contacted".** It stopped the moment you moved it.
- **Assuming Lost means rejected.** At 14 days it's automatic — it may just mean nobody got to them.
- **Editing the follow-up templates without reading them.** They're already in prospects' inboxes.

## If something goes wrong

- **A lead got a follow-up after they'd already signed** — they were left in a new stage. Move won leads out promptly.
- **Nurture isn't sending** — check safe mode, then whether the lead has an email and is still in a new stage.
- **A lead went to Lost too early** — move them back; the sequence is done but the lead is live again.
- **A prospect complains about too many emails** — add them to the unsubscribe list in Settings → Emails, which suppresses every send.

## Related

- [Work the leads board](work-the-leads-board.md)
- [How website enquiries arrive](website-enquiries.md)
- [Safe mode](../start-here/safe-mode.md)

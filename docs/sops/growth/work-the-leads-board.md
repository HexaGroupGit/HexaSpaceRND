---
slug: work-the-leads-board
title: Work the leads board
category: growth
audience: [reception, ops, admin]
route: /crm
relatedCode:
  - src/components/LeadsBoard.jsx
  - src/components/LeadDetail.jsx
relatedSops: [website-enquiries, nurture-sequences, send-a-proposal]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Keep every live opportunity visible and moving.

## When to do this

Daily. It's the sales pipeline — if it's not current, it's not useful.

## Steps

1. Open **CRM** → **Leads**. Columns are your pipeline stages, in order.
2. Each card shows the lead and **how many days it has sat in that stage**. That number is the thing to watch.
3. **Drag a card** to a new column to move it along. Dropping it updates the stage and restarts the day counter.
4. Click a lead to open the detail view — notes, tour booking, brochures, proposal.
5. Add a lead by hand for a walk-in or phone enquiry, choosing the stage.

## What happens automatically

- **Moving a lead out of a "new" stage stops the nurture sequence.** That's the intended off-switch — see [How the nurture sequences work](nurture-sequences.md).
- A lead untouched for **14 days** is moved to **Lost** automatically.
- Booking a tour also stops nurture.
- The days-in-stage counter resets whenever the stage changes.

## Common mistakes

- **Dragging a card to tidy the board.** Moving it out of a new stage silently switches off the nurture emails.
- **Ignoring the days-in-stage number.** It's the only ageing signal on the board.
- **Leaving a won lead on the board.** Convert it — otherwise it looks live.
- **Using stages inconsistently.** The board is only as good as the shared meaning of each column.
- **Working the board without opening leads.** The detail view holds the notes that make a follow-up worth anything.

## If something goes wrong

- **A lead vanished** — check the **Lost** column; it may have aged out at 14 days.
- **Nurture emails stopped unexpectedly** — someone moved the lead out of a new stage.
- **A lead is in the wrong stage** — drag it back; only the counter is affected.
- **The board is cluttered with dead leads** — move them to Lost rather than deleting, so the history survives.

## Related

- [How the nurture sequences work](nurture-sequences.md)
- [Build and send a proposal](send-a-proposal.md)
- [Run a tour and convert it](../front-of-house/run-a-tour.md)

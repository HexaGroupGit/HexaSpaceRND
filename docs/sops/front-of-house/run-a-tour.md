---
slug: run-a-tour
title: Run a tour and convert it
category: front-of-house
audience: [reception, ops, admin]
route: /crm
relatedCode:
  - src/components/LeadDetail.jsx
  - src/components/LeadsBoard.jsx
  - src/lib/proposalPdf.js
relatedSops: [book-a-tour, send-a-proposal, create-a-company]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Show someone the space and move them toward signing.

## When to do this

A booked tour is happening today.

## Before you start

- Check **Spaces → Locations** for what's genuinely available. **Reserved (amber) is not available** — someone is part-way through taking it.
- Read the lead's notes: what they're after, headcount, budget, timing.
- Check the tour is in the CRM with the right time and host.

## Steps — the tour

1. Meet them at reception on Level 4.
2. Show the spaces that fit their brief, plus one alternative.
3. Note anything that changes the picture: headcount, start date, budget, what they compared us against.

## Steps — straight after

1. Open the lead in **CRM** and update the notes while it's fresh.
2. Move them along the pipeline stage.
3. Decide the next action:
   - **Ready to commit** → send a proposal
   - **Interested, needs numbers** → send a brochure or info pack
   - **Not now** → leave them on the board; the nurture sequence keeps in touch

## Steps — converting

1. When they accept, convert the lead to a company.
2. Create the contract — see [Create a contract](../contracts/create-a-contract.md).
3. If the rate is below list, get it approved **first** — see [Raise a pricing request](../contracts/raise-a-pricing-request.md).

## What happens automatically

- **Nurture emails run daily** at 9am UTC — about **7pm Melbourne**. A lead that goes quiet gets followed up and then a final email without anyone doing anything.
- Converting a lead creates the company record and links the history.
- An accepted proposal can carry straight through to a client and contract.

## Common mistakes

- **Showing a reserved suite.** Amber means someone else is mid-way through taking it. Awkward to walk back.
- **Not writing notes up straight after.** By tomorrow the useful detail is gone.
- **Quoting below list on the spot.** Get it approved first — a rate you've said out loud is hard to retract.
- **Leaving the stage unchanged.** The board is how anyone else knows where this stands.
- **Letting the nurture sequence do the follow-up** for a lead who's ready to sign. Call them.

## If something goes wrong

- **They want a space that's reserved** — check whether the reserving contract is actually progressing. If it's stalled, that's a conversation with Eric, not a promise to the prospect.
- **They ask about a rate you can't approve** — say you'll come back to them, and raise a pricing request.
- **The tour was a no-show** — note it, reschedule from the same modal, and leave them on the board.

## Related

- [Book a tour](book-a-tour.md)
- [Create a contract](../contracts/create-a-contract.md)
- [Raise a pricing request](../contracts/raise-a-pricing-request.md)

---
slug: send-a-brochure
title: Send a brochure or info pack
category: growth
audience: [reception, ops, admin]
route: /crm
relatedCode:
  - src/components/LeadDetail.jsx
  - src/lib/proposalPdf.js
relatedSops: [send-a-proposal, work-the-leads-board]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Send a prospect something to read when they're not ready for a formal proposal.

## When to do this

They've enquired or toured and want information and pricing, but haven't settled on a specific space.

## Which document

| Document | For |
|---|---|
| **Overview brochure** | Leads who aren't sure what they want — all products and pricing, no space selection |
| **Desk brochure** | Flexible or Dedicated Desk, at a quoted monthly price |
| **Virtual Office brochure** | Virtual Office, at a quoted monthly price |
| **Proposal** | Private Office — there is no office brochure; a suite offer goes out as a full proposal |

## Steps

1. Open the lead in **CRM** and go to the **Proposal** tab.
2. For a **desk or virtual office**: choose the membership type and enter the **monthly price**. A price above zero is required.
3. Add a **cover message** if you want something personal at the top.
4. Download the brochure to check it, or send it directly.
5. For a lead who's undecided, send the **overview brochure** instead — no pricing decisions needed.

## What happens automatically

- The **overview brochure is an information send only** — it creates **no proposal record**, so nothing is tracked as an offer and there's nothing for the client to accept.
- Desk and virtual brochures carry the price you entered.
- Private Office enquiries route to the proposal flow instead — see [Build and send a proposal](send-a-proposal.md).
- Sending is recorded against the lead.

## Common mistakes

- **Expecting the overview brochure to be acceptable.** It's information, not an offer — there's no accept link.
- **Sending a desk brochure with no price.** It's blocked, but check the figure is the one you meant.
- **Looking for an office brochure.** There isn't one; offices go out as proposals.
- **Sending a brochure to someone ready to sign.** Send a proposal — it converts.
- **Putting internal notes in the cover message.** The client reads it.

## If something goes wrong

- **The PDF won't generate** — check a price is entered for a membership brochure.
- **The wrong price went out** — send a corrected brochure and say so plainly.
- **They didn't receive it** — check safe mode, then their address.

> **TODO(verify):** confirm the exact button labels on the Proposal tab for each brochure type, and whether brochures are emailed from here or downloaded and attached manually. `LeadDetail.jsx` has both download and send paths and I could not cleanly separate which control does which.

## Related

- [Build and send a proposal](send-a-proposal.md)
- [Work the leads board](work-the-leads-board.md)

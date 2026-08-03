---
slug: log-a-maintenance-ticket
title: Log a maintenance ticket and close it
category: front-of-house
audience: [reception, ops, admin]
route: /maintenance
relatedCode:
  - src/components/Maintenance.jsx
relatedSops: [reply-to-a-member-message, daily-opening-routine]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Record something that needs fixing and track it to done.

## When to do this

A member reports a fault, or you spot one. Log it even if you're about to fix it yourself — the record matters.

## The statuses

**open** → **in-progress** → **resolved**

## Steps — log it

1. Open **Maintenance**.
2. Create the issue with what's wrong, where, and who reported it.
3. Set the status to **open**.

## Steps — work it

1. Set it to **in-progress** when someone picks it up.
2. Update it with what's been done and what's outstanding.
3. Set it to **resolved** when it's genuinely fixed.

## What happens automatically

- Tickets raised by members from the portal appear here.
- The Maintenance section shows in the sidebar with the rest of the day's work.

## Common mistakes

- **Fixing without logging.** No record means no pattern — three reports of the same fault look like one-offs.
- **Resolving optimistically.** Resolved means fixed, not "the contractor's been booked".
- **Not saying who reported it.** You can't tell them it's done.
- **Leaving tickets open indefinitely.** An old open ticket makes the whole list untrustworthy.
- **Using maintenance for a member complaint.** A complaint is a message; a broken thing is a ticket.

## If something goes wrong

- **A member says nothing happened** — check the ticket status and tell them plainly where it is.
- **The same fault keeps recurring** — that's worth escalating rather than reopening a fourth time.
- **Something urgent** — a safety issue or a lockout is a phone call first, a ticket second.

> **TODO(verify):** confirm whether logging or resolving a ticket notifies the member who reported it. `Maintenance.jsx` shows the status workflow but I found no send in it — if members aren't told when their issue is fixed, that's worth knowing (and probably worth adding).

## Related

- [Reply to a member message](reply-to-a-member-message.md)
- [Daily opening routine](../start-here/daily-opening-routine.md)

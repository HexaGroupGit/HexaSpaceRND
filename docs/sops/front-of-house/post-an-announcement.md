---
slug: post-an-announcement
title: Post an announcement
category: front-of-house
audience: [reception, ops, admin]
route: /announcements
relatedCode:
  - src/components/Announcements.jsx
  - api/announcements.js
  - api/announcements-draft.js
relatedSops: [reply-to-a-member-message, run-an-event, safe-mode]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Tell members something — a closure, an event, a change to the building.

## When to do this

Anything the whole community (or a segment of it) needs to know. One-to-one goes through Messages instead.

## Before you start

Decide who it's for. The audience is chosen by **member status**, and each option shows a live count so you can see how many people you're about to email.

## Steps

1. Open **Announcements** and start a new message.
2. Under **To**, tick the member groups. Each shows its count.
3. Write the **Subject**.
4. Write the **Message**.
5. Check the recipient count once more.
6. Send.

## What happens automatically

- The announcement goes to every member in the selected groups.
- **Unsubscribed addresses are silently dropped** — anyone on the Settings → Emails unsubscribe list never receives it, and won't appear as a failure.
- Members also see announcements in the portal and app.
- With **safe mode on, nothing reaches members** — it all goes to the test inbox. Check before sending anything time-sensitive.

## Common mistakes

- **Sending to everyone when it affects one floor.** Use the status groups.
- **Not checking the count.** It's the only sanity check on how many people you're about to email.
- **Sending without checking safe mode.** Nobody gets it and you don't find out.
- **Using an announcement for one member.** Use Messages.
- **Writing it as an internal note.** Members read this exactly as written.

## If something goes wrong

- **It went to the wrong group** — you can't unsend. A short, plain correction is better than pretending.
- **A member says they didn't get it** — check the unsubscribe list first, then safe mode, then their address.
- **A typo in something important** — send a brief correction rather than a second full announcement.

> **TODO(verify):** confirm the exact audience group labels and the send-button wording. I read the **To** / **Subject** / **Message** structure from `Announcements.jsx` but the group labels come from a variable I didn't resolve. Also confirm what `announcements-draft.js` does — it looks like AI-assisted drafting, which would be worth documenting as a step.

## Related

- [Reply to a member message](reply-to-a-member-message.md)
- [Run an event](../bookings/run-an-event.md)
- [Safe mode](../start-here/safe-mode.md)

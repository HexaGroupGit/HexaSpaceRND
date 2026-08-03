---
slug: reply-to-a-member-message
title: Reply to a member message
category: front-of-house
audience: [reception, ops, admin]
route: /messages
relatedCode:
  - src/components/AdminMessages.jsx
  - src/components/TenantProfile.jsx
  - api/portal/notify-message.js
relatedSops: [post-an-announcement, log-a-maintenance-ticket]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Answer a member who's messaged from the portal or app.

## When to do this

Whenever the Messages badge shows unread. Same day is the standard.

## Steps

1. Open **Messages**. Companies with unread messages are flagged.
2. Click the company to open the thread.
3. Read the history — the whole conversation is there, not just the latest.
4. Type your reply and send.

You can also reply from a company's profile, under **Portal Messages** — same thread, same result. Useful when you're already looking at their record.

## What happens automatically

- **Opening a thread marks its messages read.** The badge clears whether or not you reply.
- The list **refreshes every few seconds**, so new messages appear without reloading.
- Your reply appears in the member's portal and app immediately.
- Threads are per **company**, not per person — anyone at that company with portal access sees the conversation.

## Common mistakes

- **Opening a thread and not replying.** It's now marked read and nobody else knows it's outstanding.
- **Treating it as private to one person.** The thread is company-wide — anyone at that company with access can read it.
- **Answering a maintenance issue in chat and leaving it there.** Log the ticket too.
- **Using Messages for something everyone needs to know.** That's an announcement.
- **Writing informally about money.** Billing conversations in chat become the record.

## If something goes wrong

- **A message needs someone else** — reply acknowledging it, then hand it on. Don't leave it read and silent.
- **A member says they replied and you can't see it** — the thread refreshes every few seconds; reload. If it's still missing, escalate.
- **Something sensitive arrives in chat** — a complaint, a dispute — acknowledge, then take it to email or a call.

## Related

- [Post an announcement](post-an-announcement.md)
- [Log a maintenance ticket](log-a-maintenance-ticket.md)

---
slug: receive-and-release-mail
title: Receive and release mail or a parcel
category: front-of-house
audience: [reception, ops, admin]
route: /mail
relatedCode:
  - src/components/MailRegister.jsx
relatedSops: [log-an-enquiry, set-directory-name]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Log an item that's arrived, tell the recipient, and record when they collect it.

## When to do this

Every time mail or a parcel arrives at reception. Log it as it arrives, not in a batch later.

## Steps — log it

1. Open **Mail & Deliveries** and click **Log item**.
2. Set **Addressed to \*** — either a **company** or a **specific member**. Both are in the same list.
3. Choose the **Type**: mail or parcel.
4. Add **Notes (sender, size…)** — enough for them to recognise it.
5. Leave the notify option on so they're emailed.
6. Save.

## Steps — release it

1. Open **Mail & Deliveries**. The **Awaiting pickup** filter is the default view, with a count in the description.
2. Find the item and click **Collected**.
3. It moves to **Collected** with today's date.

## What happens automatically

- **The addressee is emailed immediately** — "mail is waiting for you" or "a parcel is waiting for you", with the type, your notes, when it arrived, and where to collect it.
- The email tells them to collect from **Reception · Level 4, 402/830 Whitehorse Rd**, and links into the member app.
- The item shows on their portal and app until you mark it collected.
- A **Notified** badge appears on the row once the email has gone.
- The email notes that parcels left over 48 hours may incur a storage charge, per the House Rules.

## Common mistakes

- **Logging to the company when it's addressed to a person.** The wrong people get notified. Pick the member where the name is on the parcel.
- **Not marking it collected.** It sits on their portal saying it's still waiting, and the awaiting count is wrong for everyone.
- **Vague notes.** "Box" doesn't help someone expecting three deliveries. Note the sender.
- **Batch-logging at the end of the day.** The value is the notification arriving when the item does.
- **Handing over without recording it.** The register is the only proof it was collected.

## If something goes wrong

- **They say they never got the email** — check the **Notified** badge, then safe mode, then the address on their record.
- **An item was logged to the wrong person** — delete it and log it correctly; the wrong person has already been emailed, so a quick note to them is worth it.
- **A parcel has been sitting for weeks** — check they're still a member, then chase directly. The House Rules storage charge is a conversation, not an automatic fee.
- **Something arrives for a company that's left** — don't log it. Return to sender or contact them directly.

## Related

- [Set or correct a directory name](../companies-members/set-directory-name.md)
- [Safe mode](../start-here/safe-mode.md)

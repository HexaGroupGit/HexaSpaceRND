---
slug: website-enquiries
title: How website enquiries arrive
category: growth
audience: [reception, ops, admin]
route: /crm
relatedCode:
  - api/form-submit.js
  - api/_leads.js
  - src/components/EnquiriesInbox.jsx
relatedSops: [work-the-leads-board, nurture-sequences, log-an-enquiry]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Understand what happens between someone filling in the website form and a lead appearing in the CRM.

## When to do this

An enquiry is missing, a client says they filled the form and heard nothing, or you're wondering why leads arrive already answered.

## The path

1. Someone submits the enquiry form on hexaspace.com.au.
2. The public endpoint creates a **lead** in the CRM.
3. The **leasing team is emailed** a notification.
4. The enquirer gets an **automatic reply**, chosen by what they enquired about.
5. Function enquiries additionally get the **function brochure**.
6. The lead lands in **CRM → Enquiries** as unread, and on the **Leads** board.

## What happens automatically

- The form requires an **email or a phone number** — one or the other, not both.
- A hidden **honeypot** field catches bots. If it's filled, the request returns success and nothing is created — so a bot never sees a failure to retry against.
- The **source** is recorded, including a referral code when the visitor came through a referrer's link.
- The auto-reply uses the email template matching the enquiry type — desk, office, and so on — from **Templates → Emails**.
- The nurture sequence starts from here. See [How the nurture sequences work](nurture-sequences.md).
- The endpoint writes with elevated privileges because it's public and unauthenticated — that's why it's tightly scoped to creating a lead.

## Common mistakes

- **Replying manually to an enquiry that already got an auto-reply**, repeating the same information. Read the template first.
- **Assuming a missing lead means the form is broken.** Check the honeypot logic hasn't been tripped by an autofill extension, then check spam.
- **Editing the auto-reply template without checking which type it is.** There's one per enquiry type.
- **Treating a function enquiry as a space enquiry.** They get a different reply and belong in a different pipeline.

## If something goes wrong

- **A client says they submitted and heard nothing** — check CRM → Enquiries for their name or email. If the lead exists, the auto-reply may have failed: check safe mode.
- **No lead at all** — the form may not have reached us. Take their details by hand and create the lead.
- **Duplicate leads** — someone submitted twice. Keep the one with the history.
- **A spike of junk leads** — the honeypot handles ordinary bots; a targeted flood is one for Eric.

## Related

- [Work the leads board](work-the-leads-board.md)
- [How the nurture sequences work](nurture-sequences.md)
- [Log a walk-in or phone enquiry](../front-of-house/log-an-enquiry.md)

---
slug: email-not-arriving
title: What to do when an email doesn't arrive
category: system-administration
audience: [reception, ops, admin]
route: /settings
relatedCode:
  - api/_email.js
  - src/components/Settings.jsx
  - src/components/Reports.jsx
relatedSops: [safe-mode, edit-an-email-template, run-and-read-a-report]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Work out why a client didn't get an email, in the right order — most of the time it's the first check.

## When to do this

Any "I never received it".

## Work down this list

### 1. Is safe mode on?

**Settings → Emails & Notifications**, top panel.

- **● Blocking** → nothing reaches clients. Everything goes to the test inbox. **This is the answer most of the time.**
- **● Live** → carry on down the list.

### 2. Is the address on the unsubscribe list?

Same page, **Unsubscribed addresses**. Anyone listed is **silently dropped from every send**, including as cc or bcc. No error, no trace.

### 3. Was it sent at all?

**Reports → Email Activity Log**, filtered by type. If it isn't there, it was never sent — which is a different problem from a delivery failure.

### 4. Did it go to the right address?

Recipients are resolved automatically, not chosen by you. For billing emails the order is: **billing person → company email → other members**. For contract signing: **company email → billing person → contact person → any member**.

Check who is actually flagged as billing person on the company.

### 5. Their spam folder

Worth asking before escalating.

## The failure mode nobody sees

Several flows **update the record before sending, and swallow the send error**. The clearest example: sending a contract for e-signature flips the status to **Out For Signature** and logs any email failure only to the browser console.

**So a green status does not prove an email was delivered.** If it matters, use the Email Activity Log.

## What happens automatically

- Every email goes through one central guard, so safe mode and the unsubscribe list can't be bypassed by an individual feature.
- **It fails safe** — if the safe-mode setting can't be read, everything is blocked except the default address.
- The safe-mode setting is cached about 20 seconds, so a change takes a moment.
- Unsubscribed addresses are dropped silently, by design.

## Common mistakes

- **Debugging a feature that's working** and being redirected by safe mode.
- **Re-sending repeatedly** without checking safe mode. Each attempt goes to the same test inbox.
- **Assuming a status change means delivery.**
- **Adding someone to the unsubscribe list to stop one email type.** It stops all of them.
- **Forgetting known-untested flows.** Tour invites and the deposit refund flow have never been sent to a real recipient — they were built with safe mode on. Treat their first live send as a test.

## If something goes wrong

- **Safe mode is on and it should be live** — turn it off and save, then confirm the status line reads Live.
- **The email was sent but never arrived** — check the address, then spam, then ask Eric to check the delivery provider.
- **A whole category of emails is missing** — check the template exists for that type, and that the cron behind it ran.
- **A client asks to stop receiving emails** — add them to Unsubscribed addresses.

## Related

- [Safe mode](../start-here/safe-mode.md)
- [Edit an email template](edit-an-email-template.md)
- [Run and read a report](run-and-read-a-report.md)

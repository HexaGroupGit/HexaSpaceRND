---
slug: safe-mode
title: Safe mode — the outbound email block
category: start-here
audience: [ops, admin]
route: /settings
relatedCode:
  - api/_email.js
  - src/components/Settings.jsx
relatedSops: [platform-overview, email-not-arriving]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Know whether the platform is actually emailing clients — or quietly redirecting everything to one test inbox.

## When to do this

**Before you believe any email was sent.** Especially when testing, and any time a client says they didn't receive something.

## What it is

Safe mode redirects **every** outbound email — invoices, reminders, contract signing links, welcome packs, announcements, lead nurture, everything — to a single test address. No client, member or lead receives anything while it is on.

It is **ON by default**. The block only lifts when it is explicitly turned off.

## Steps — check whether it's on

1. Open **Settings** → **Emails & Notifications**.
2. Look at the amber **Safe mode — block outbound email** panel at the top.
3. Read the status line:
   - **● Blocking — only <address> will receive email** → safe mode is ON. Nothing reaches clients.
   - **● Live — emails send to real recipients.** → safe mode is OFF.

## Steps — turn it off

1. In the same panel, switch the toggle off.
2. Click **Save**. The panel warns you to — the toggle alone changes nothing until saved.
3. Re-read the status line and confirm it says **Live**.

## Steps — change the test recipient

Set **Test recipient** in the same panel. It defaults to eric@hexaspace.com.au.

## What happens automatically

- Every email in the app is funnelled through one central guard, so the block can't be bypassed by an individual feature.
- **It fails safe.** If the setting can't be read, everything is blocked except the default address. A database problem can never cause an accidental client email.
- The setting is cached for about 20 seconds, so a change takes a moment to take effect.
- **Unsubscribed addresses** are separate and always apply, whether safe mode is on or off. Addresses listed under **Unsubscribed addresses** are silently dropped from every send, including as cc or bcc.
- Emails are still *composed* and logged normally — only the recipient changes.

## Common mistakes

- **Testing a flow, seeing "sent", and assuming the client got it.** Check the panel first. This is the single most common source of "the email didn't arrive".
- **Toggling without saving.** The panel says *Remember to Save* for a reason.
- **Turning it off to test one thing and leaving it off.** Everything queued then goes to real clients.
- **Turning it on to stop one person being emailed.** That's what **Unsubscribed addresses** is for.
- **Debugging a "broken" email feature** that is working perfectly and being redirected.

## If something goes wrong

- **A client didn't receive an email** — check safe mode first, then check whether their address is on the unsubscribed list, then check the address itself.
- **You turned safe mode off by mistake** — turn it back on and save. Anything already sent has gone; check what fired.
- **The status line disagrees with what you expect** — you may not have saved. Reload the page.

Several features are still known to be **untested against a real recipient** because safe mode has been on — including the tour booking invite and the deposit refund flow. Treat their first live send as a test.

## Related

- [Platform overview](platform-overview.md)
- [What to do when an email doesn't arrive](../system-administration/email-not-arriving.md)

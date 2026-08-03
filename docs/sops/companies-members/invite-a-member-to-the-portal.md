---
slug: invite-a-member-to-the-portal
title: Invite a member to the portal
category: companies-members
audience: [reception, ops, admin]
route: /members
relatedCode:
  - src/components/MemberProfile.jsx
  - src/components/TenantProfile.jsx
  - api/auth/invite.js
relatedSops: [add-a-member, bulk-invite-members, offboard-a-member]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Give a person a login for portal.hexaspace.com.au, where their invoices, bookings, team and card live.

## When to do this

After adding a member, or when someone says they never got their login, or their link expired.

## Before you start

Check where they actually are. The member profile shows one of three states:

| State | Meaning |
|---|---|
| **● Portal active — signed up** | Done. They have signed in. Nothing to send. |
| **Resend portal invite** | Invited, but has never signed in. |
| **Send portal invite** | Never invited. |

## Steps — one member

1. Open **Members** and click the person's name.
2. In the left sidebar under **Member Apps**, click **Send portal invite** (or **Resend portal invite**).
3. Wait for the confirmation: *Portal invite sent to <email>. The set-password link expires in 24 hours.*

## Steps — a company's main contact

1. Open the company profile.
2. Click **Invite to portal** in the header, or use the **Portal Access** section further down (**Invite to Portal** / **Resend Invite**).
3. The button settles on **Invite sent** or **On portal**.

## What happens automatically

- A Supabase login is created for that email and a branded **set-your-password** email is sent.
- **The link expires in 24 hours and is single use.** Anyone who misses it needs a fresh one — resending is normal, not a failure.
- A successful invite sets **Portal Access** on the member record. A failure sets an invite-failed flag, which shows as a red **Invite failed** badge next to their name on the Members list.
- The redirect target is fixed server-side, so an invite can never be pointed somewhere else.
- Inviting is **admin-only**. When a member adds their own teammate from the portal, that goes through a different, member-facing path with its own permission rules.

## Common mistakes

- **Toggling Portal Access on the member record instead of sending an invite.** The toggle only flips a flag — it creates no login and sends no email. This is the biggest trap on this page.
- **Re-inviting someone who is already active.** If it says *Portal active — signed up*, the problem is a forgotten password, not a missing invite. Point them at **Forgot password?** on the portal.
- **Inviting a member with no email.** You get *This member has no email address.* Add one first.
- **Assuming the invite arrived.** Check the badge on the Members list — **Invite failed** means it didn't.
- **Sending an invite the client won't use for days.** It expires in 24 hours. Send it when they're ready.

## If something goes wrong

- **"Could not send the invite: …"** — the member is flagged invite-failed. Check the email address for typos, then retry.
- **They say the link doesn't work** — almost always expired or already used. Send a fresh one.
- **They can't find the email** — it may be in spam. As a fallback, they can use **Forgot password?** on the portal with the same address, which works once the login exists.
- Repeated failures for one address: escalate to Eric.

## Related

- [Add a member to a company](add-a-member.md)
- [Bulk-invite members to the portal](bulk-invite-members.md)
- [Offboard a member](offboard-a-member.md)

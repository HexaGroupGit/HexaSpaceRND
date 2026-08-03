---
slug: who-can-do-what
title: Who can do what
category: start-here
audience: [ops, admin]
route: /settings
relatedCode:
  - src/App.jsx
  - api/_auth.js
  - migrations/phase4_admin_auth.sql
  - src/components/Settings.jsx
  - src/lib/billingAccess.js
relatedSops: [platform-overview, invite-a-member-to-the-portal]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Understand how someone becomes an admin, what members can do, and why the Admin Users screen is not the whole story.

## When to do this

Onboarding a new staff member, or working out why someone can't see something.

## How the app decides who you are

There is **one sign-in**. After you authenticate, the app asks the database whether your email is an admin:

- **Yes** → the admin app.
- **No** → the member portal.

The check is a database allow-list — an `admins` table, enforced at the database level, not a client-side setting. There is also a hardcoded fallback for the core team (admin@, eric@ and info@hexaspace.com.au) so nobody can be locked out by a misconfiguration.

## ⚠ The Admin Users screen may not grant access

**Settings → Admin Users** manages a list stored in the settings record, and inviting from there sends a set-password email and adds the person to that list. But the actual admin decision reads the **`admins` database table**, which was seeded from the settings list once during a migration.

So adding someone in Settings → Admin Users may leave them able to sign in — as a **member** — while not being an admin at all.

> **TODO(verify):** confirm whether adding a user via Settings → Admin Users also writes a row to the `admins` table. From the code it does not — `AdminUsersSection` only calls `updateSettings({ adminUsers })` and the invite endpoint. If that's right, granting admin access needs a database insert, and this SOP must say so with the exact steps. **Do not onboard a new admin from this document until this is answered.**

## What a member can do in the portal

| Anyone at the company | Billing or contact person only |
|---|---|
| View their bookings | View and pay invoices |
| Book rooms with company credits | Add and replace the saved card |
| Message the Hexa Space team | Give card payment authority |
| See announcements and events | Add and remove teammates |
| Use their door access | |

Two extra rules protect companies from themselves: **nobody can remove themselves**, and **the billing person can only be removed by us**.

These limits are enforced on the server as well as hidden in the UI, so they can't be bypassed.

## Roles inside the admin app

- **Admin** — standard access.
- **Super Admin** — additionally can permanently delete invoices. Everything else is the same.

## How the API protects itself

Every server endpoint runs with full database privileges, so each one verifies the caller first:

- **Member endpoints** verify the signed-in user and resolve their company — an id in the request body is never trusted.
- **Admin endpoints** require an email on the admin allow-list.
- **Cron endpoints** require a shared secret. If that secret isn't configured they still run, but flagged as unguarded.

## Common mistakes

- **Assuming Settings → Admin Users grants admin access.** See the warning above.
- **Telling a member to "just log in at the admin URL".** The URL doesn't decide anything — their email does.
- **Expecting a regular teammate to see invoices.** Only the billing or contact person can. Flag them properly instead of explaining the workaround.
- **Removing someone from Admin Users and assuming they're locked out.** Their login still exists; only the allow-list entry matters.

## If something goes wrong

- **A new admin lands in the member portal** — they aren't on the database allow-list. Resolve the TODO above, then add them properly.
- **Someone is locked out entirely** — the core-team fallback means eric@ and info@ can always get in. Use one of those to fix it.
- **A member can't see billing** — flag them as billing or contact person on their member record.

## Related

- [Platform overview](platform-overview.md)
- [Invite a member to the portal](../companies-members/invite-a-member-to-the-portal.md)
- [Safe mode](safe-mode.md)

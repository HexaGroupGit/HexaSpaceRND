---
slug: manage-admin-users
title: Add or remove an admin user
category: system-administration
audience: [admin]
route: /settings
relatedCode:
  - src/components/Settings.jsx
  - api/_auth.js
  - migrations/phase4_admin_auth.sql
  - src/App.jsx
relatedSops: [who-can-do-what, escalation]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Give a colleague access to the admin app, or take it away.

## ⚠ Read this before using the Admin Users screen

**Settings → Admin Users may not actually grant admin access.**

The screen maintains a list stored in the settings record, and inviting from it sends a set-password email. But the app decides admin-vs-member by checking the **`admins` database table**, which was populated from that settings list **once**, during a migration.

From the code, `AdminUsersSection` only updates the settings list and calls the invite endpoint — it does not write to the `admins` table. If that's right, someone added here can sign in, but lands in the **member portal**.

> **TODO(verify):** confirm whether adding a user via Settings → Admin Users writes a row to the `admins` table. If it doesn't, granting admin access requires a database insert, and the real steps belong here. **Do not onboard a new admin from this document until this is answered.** Escalate to Eric.

## Steps — what the screen does

1. Open **Settings** → **Admin Users**.
2. **Current Users** lists name, email and role, with a **Remove** action on each row.
3. To invite: enter their name and email, choose the role, and send. They get a set-password email.
4. To change a role: use the dropdown on their row — **Admin** or **Super Admin**.

## The two roles

| Role | Access |
|---|---|
| **Admin** | Standard access |
| **Super Admin** | Also able to permanently delete invoices |

## What happens automatically

- The invite creates a login and emails a set-password link, **valid 24 hours, single use**.
- Removing someone from the list does **not** delete or disable their login.
- The core team — admin@, eric@ and info@hexaspace.com.au — is hardcoded as a fallback, so nobody can be locked out by a misconfiguration.
- Server endpoints check the **database allow-list**, not this settings list, so hiding the UI is never the only gate.

## Common mistakes

- **Assuming this screen grants access.** See the warning above.
- **Removing a leaver from the list and stopping there.** Their login still works — it needs to be revoked properly.
- **Handing out Super Admin.** The difference is permanent invoice deletion. Keep it to people who need it.
- **Inviting someone who won't act on it that day.** The link expires in 24 hours.

## If something goes wrong

- **A new admin lands in the member portal** — they're not on the database allow-list. Escalate to Eric.
- **Someone is locked out** — sign in as eric@ or info@ (the hardcoded fallback) and fix it.
- **A leaver still has access** — treat it as urgent and escalate.

## Related

- [Who can do what](../start-here/who-can-do-what.md)
- [Escalation](escalation.md)

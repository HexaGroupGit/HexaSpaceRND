---
slug: read-the-activity-log
title: Read the activity / audit log
category: system-administration
audience: [ops, admin]
route: /activity
relatedCode:
  - src/components/ActivityLog.jsx
  - src/components/Reports.jsx
  - src/lib/audit.js
relatedSops: [run-and-read-a-report, escalation]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Find out who changed a record, and when.

## When to do this

Something changed and nobody knows who did it — a price, a status, a deleted record.

## ⚠ Use Reports → Audit Log, not the Activity Log page

There are two views of the same data, and **only one of them displays it properly**.

The audit entries are written with the fields `action`, `entityType`, `entityId`, `entityName`, `userEmail` and `timestamp`.

- **Reports → Audit Log** reads exactly those fields. It shows the action, entity type, entity name and the user's email correctly.
- **The Activity Log page** (sidebar → Activity Log) looks for `user`/`actor`/`by`, `collection`/`entity`/`resource` and `target`/`summary`/`name` — **none of which are written**. So every row shows **User: System**, **Collection: —** and a **blank Target**, regardless of who actually did it.

Only the **Operation** column and the date are correct on that page.

**So: for any real question about who changed what, use Reports → Audit Log.**

> **TODO(verify):** this looks like a straightforward field-name mismatch in `ActivityLog.jsx` versus what `lib/audit.js` writes — `lib/audit.js` is the only writer to that table. Confirm and fix the reader, rather than working around it in a procedure. Until then, the sidebar page is misleading rather than merely incomplete.

## Steps

1. Open **Reports** → **Audit Log**.
2. Find the entity — the name is shown, falling back to its id.
3. Read the **action** (create, update, delete, send, sign, void), the **entity type**, and the **user's email**.
4. For contracts, the entry names which fields changed.

## What happens automatically

- Audit entries are written as a side-effect of actions in the admin app.
- **A failed audit write never blocks the action.** The log is very good, not guaranteed complete.
- The sidebar Activity Log shows the 200 most recent entries; the Reports audit view reads up to 300.
- Server-side jobs — the nightly reconcile, the bill run — do their work without writing here. Their record is the **daily digest email**, not this log.

## Common mistakes

- **Trusting the Activity Log page's User column.** It says System for everything.
- **Concluding "nobody did it" from a missing entry.** It may have been a cron job — check the digest emails.
- **Using it as a security audit.** For door access, use the Access Log and Salto KS.
- **Expecting a full history.** Both views are capped at recent entries.

## If something goes wrong

- **No entry for a change you can see** — check whether a cron did it, then escalate.
- **You need history beyond the cap** — ask Eric for a fuller extract.
- **Something was deleted and you need to know by whom** — Reports → Audit Log records delete actions with the user's email.

## Related

- [Run and read a report](run-and-read-a-report.md)
- [Review the access log](../spaces-access/review-the-access-log.md)
- [Escalation](escalation.md)

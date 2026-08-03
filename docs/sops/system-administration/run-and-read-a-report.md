---
slug: run-and-read-a-report
title: Run and read a report
category: system-administration
audience: [ops, admin]
route: /reports
relatedCode:
  - src/components/Reports.jsx
relatedSops: [read-the-activity-log, monthly-bill-run, xero-sync]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Get the financial picture, check what emails went out, and see who changed what.

## When to do this

Month end, a board or accountant question, or chasing down an email or a change.

## The three tabs

**Reports** has **Financial Report**, **Email Activity Log** and **Audit Log**.

### Financial Report

Three summary cards — **Total Invoiced (12 mo)**, **Total Collected (12 mo)** and **Total Outstanding** — over a **Monthly Breakdown — Last 12 Months** table showing invoice count, invoiced, collected and outstanding per month, with a totals row.

**Export CSV** gives you the monthly breakdown. There's also a tenant-outstanding CSV export for chasing debt.

### Email Activity Log

Every email the platform sent, typed as **Invoice**, **Reminder**, **Receipt**, **Renewal**, **eSign** or **General**. This is where you check whether something actually went.

### Audit Log

Who changed what: the action, the entity type, the entity name and the user's email. **This is the readable audit view** — use it in preference to the sidebar Activity Log page, which has a display problem (see [Read the activity log](read-the-activity-log.md)).

## Steps

1. Open **Reports** and choose the tab.
2. For financials, read the summary cards first, then the monthly table for the trend.
3. Export CSV if it's going to an accountant or a spreadsheet.
4. For "did we send it?", use **Email Activity Log** and filter by type.
5. For "who changed this?", use **Audit Log**.

## What happens automatically

- Figures are computed live from invoices — invoiced, collected (from recorded payments) and outstanding.
- The email log records sends as they happen.
- The audit log is written as a side-effect of actions and **never blocks the action** — if the audit write fails, the operation still succeeds. So the log is very good but not a guarantee.

## Common mistakes

- **Reading Collected as cash banked.** It reflects payments *recorded* in the platform. A bank transfer nobody recorded won't appear — check Xero too.
- **Treating this as the accounting system.** **Xero is the source of truth**, especially for anything before July 2026.
- **Assuming an email in the log was delivered.** It records the send, not the receipt — and with safe mode on it went to the test inbox.
- **Using outstanding here for a formal debtors list** without cross-checking Xero.

## If something goes wrong

- **Figures disagree with Xero** — Xero wins. Don't "fix" one side; find out why, and escalate.
- **An email isn't in the log** — it was never sent. See [What to do when an email doesn't arrive](email-not-arriving.md).
- **A change has no audit entry** — possible if the audit write failed, or it was made by a server job rather than a person.

## Related

- [Read the activity log](read-the-activity-log.md)
- [How Xero sync works](../billing/xero-sync.md)
- [What to do when an email doesn't arrive](email-not-arriving.md)

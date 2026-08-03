---
slug: platform-overview
title: Platform overview
category: start-here
audience: [reception, ops, admin]
route: /
relatedCode:
  - src/components/Layout.jsx
  - src/AdminApp.jsx
  - src/App.jsx
relatedSops: [who-can-do-what, glossary, daily-opening-routine]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Know what every section of the admin app is for, so you can find things without guessing.

## When to do this

Your first day. Read it once, then use it as a map.

## The three apps

One sign-in, three different experiences — decided by **who you are**, not which URL you use.

| App | Who sees it | Where |
|---|---|---|
| **Admin app** | Anyone on the admin allow-list | Sign in normally |
| **Member portal** | Everyone else | portal.hexaspace.com.au |
| **Member mobile app** | Members, on a phone | `/app`, plus the iOS/Android app |

There are also **public pages** clients reach by emailed link, with no login at all: contract signing, function booking, proposals, giving notice, paying an invoice, confirming a directory name, and the lobby directory screens.

## The sidebar, section by section

**Dashboard** — occupancy, MRR, money collected and overdue, plus alert panels for contracts awaiting your countersignature and companies whose door access is suspended.

### Operations
| Section | What it's for |
|---|---|
| **Companies** | The client businesses. Everything hangs off these records. |
| **Members** | The individual people who work under those companies. |
| **Contracts** | Licence agreements — the legal and billing backbone. |
| **Memberships** | Plan-level view of what each company is enrolled on. |
| **Fees** | Ad-hoc charges that sweep onto the next invoice. |
| **Fobs & Remotes** | Physical device tracker, with deposits. |
| **Bookings** | Meeting-room and space bookings. |
| **Calendar** | The same bookings, laid out by day. |
| **Activity Log** | Audit trail of who changed what. |
| **Access Log** | Door openings. |

### Workspace
| Section | What it's for |
|---|---|
| **Spaces** | Inventory of every unit, with status and floor plans. |
| **Pricing Requests** | Below-list rates awaiting a manager's approval. |
| **Billing** | Invoices, saved cards, discounts, the bill run. |
| **Renewals** | Contracts expiring, expired, auto-renewed or leaving. |

### Growth
| Section | What it's for |
|---|---|
| **CRM** | Leads, enquiries, tours, the pipeline. |
| **Marketing** | Ads, keyword research, AI content tools. |
| **Events** | Community events and registrations. |
| **Function Space Bookings** | Paid function-room hire, quote to signed agreement. |

### More
| Section | What it's for |
|---|---|
| **Announcements** | Broadcasts to members. |
| **Messages** | Two-way threads with individual members. |
| **Mail & Deliveries** | Parcel and mail register. |
| **Directory** | The lobby TV boards. |
| **Food Orders** | Café and bakery orders. |
| **Maintenance** | Tickets and jobs. |
| **Reports** | Exports and summaries. |
| **Templates** | Contract documents and email templates. |

**Settings** — company and billing details, admin users, emails (including safe mode), contract defaults, billing rules, integrations.

## What runs on its own

Nine scheduled jobs run without anyone clicking. The two you must know:

- **Nightly reconcile**, ~6:30am Melbourne — the whole lifecycle: onboarding, expiries, renewals, overdue warnings, door-access sweeps. Sends a daily digest.
- **Monthly bill run**, ~7:30am Melbourne **on the 2nd** — creates and emails every membership invoice.

The rest: hourly Xero sync, hourly room access, daily overdue reminders, event reminders, lead nurture, function reminders and nurture. See [All cron jobs](../system-administration/cron-jobs.md).

## Common mistakes

- **Looking for a client under Members.** Companies hold the contracts and invoices; Members are the people inside them.
- **Confusing Contracts with Memberships.** A contract is the signed agreement; a membership is the plan enrolment. A signed office contract creates both.
- **Editing a record and expecting an email.** Almost nothing emails on save — sending is nearly always a separate, deliberate click.
- **Assuming nothing happens overnight.** A great deal does. Read the daily digest.

## Related

- [Who can do what](who-can-do-what.md)
- [Glossary](glossary.md)
- [Daily opening routine](daily-opening-routine.md)

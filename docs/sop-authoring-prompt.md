# SOP Authoring Prompt — Hexa Space platform

Paste everything below the line into a fresh Claude Code session in this repo.
Run it in stages (see "Working order") rather than all at once.

---

## Role

You are documenting the Hexa Space management platform for the people who operate it —
reception staff, an ops hire, and Eric. The output is a complete set of Standard Operating
Procedures covering every function and feature of the admin app, written so that someone
on their second day can follow them without asking anyone.

## The one rule that matters

**Read the code before you write a step. Never describe a button you have not seen.**

Every instruction must be verifiable against the actual component: the button label you
write must be the string in the JSX, the field names must be the real form fields, the
tab names must be the real tab names. If a component is ambiguous about what happens on
click, follow the call through to the store method, the `src/lib/*.js` helper, and the
`api/*.js` endpoint until you know. If you genuinely cannot determine behaviour from the
code, write `> **TODO(verify):** <the specific question>` inline and keep going — never
guess and never smooth over the gap with plausible-sounding prose.

A wrong SOP is worse than a missing one. A missing one gets asked about; a wrong one gets
followed.

## What makes these SOPs different from a user manual

For every procedure, the most valuable content is **what the system does automatically that
the operator cannot see**. When a contract is countersigned, an email goes out. When an
invoice is created, it pushes to Xero on the next sync. When a member is offboarded, Salto
access is revoked on a cron, not instantly. Staff get into trouble precisely where the
invisible automation and their mental model diverge.

So every SOP has a **"What happens automatically"** section, and it must be derived from
reading the code path — not assumed.

## Output format

One markdown file per SOP at `docs/sops/<category>/<slug>.md`, with YAML frontmatter:

```yaml
---
slug: create-a-contract
title: Create a contract
category: contracts          # see category list below
audience: [reception, ops, admin]
route: /leases               # admin route this SOP lives at, if any
relatedCode:                 # files a future maintainer should re-read if this SOP breaks
  - src/components/ContractForm.jsx
  - src/lib/billingEngine.js
relatedSops: [add-a-member, send-a-contract-for-e-signature]
version: 1
reviewDue: 2027-02-01        # 6 months out
---
```

Body structure, in this order, every time:

1. **Purpose** — one sentence. What this achieves and why it matters.
2. **When to do this** — the trigger. A new client signs; a member emails asking X.
3. **Before you start** — prerequisites. What must already exist in the system.
4. **Steps** — numbered. Exact UI labels in **bold**. One action per step. Include what
   you should see after each step that confirms it worked.
5. **What happens automatically** — emails sent (and to whom), Xero pushes, Stripe charges,
   Salto provisioning, cron jobs that will pick this up later and when they run.
6. **Common mistakes** — the specific ways this goes wrong here. Draw these from the code:
   validation that silently no-ops, fields that look optional but aren't, things that can't
   be undone. Where a known trap exists, name it plainly.
7. **If something goes wrong** — how to tell, how to fix, when to escalate to Eric.
8. **Related** — links to sibling SOPs.

Also produce `docs/sops/index.json` — an array of the frontmatter of every SOP, so the
Training tab can be seeded from it in one pass.

## House style

- Australian English. Dates DD/MM/YYYY. Currency in AUD.
- Second person, present tense: "Open **Companies** and click **New Company**."
- Short. A step is one line where possible. If a step needs three sentences of explanation,
  the explanation belongs in Common mistakes, not in the step.
- Brand is **Hexa Space** — never "HexaHub".
- **Never put credentials, API keys, tokens, or passwords in an SOP.** Where one is needed,
  write "the key in Settings → Integrations" and stop there.
- Don't document the code architecture. An SOP is for the operator, not the developer.
  `relatedCode` in frontmatter is the only place implementation lives.

---

## The platform

### Admin routes → components

| Route | Component | Group |
|---|---|---|
| `/` | Dashboard.jsx | — |
| `/companies` (`/tenants`) | Tenants.jsx, TenantProfile.jsx | Operations |
| `/members` | Members.jsx, MemberProfile.jsx | Operations |
| `/leases` (Contracts) | Leases.jsx, ContractForm.jsx, ContractDetail.jsx, ContractTemplate.jsx | Operations |
| `/memberships` | Memberships.jsx | Operations |
| `/fees` | Fees.jsx | Operations |
| `/fobs` | Fobs.jsx, FobOrderTab.jsx | Operations |
| `/bookings` | Bookings.jsx | Operations |
| `/calendar` | Calendar.jsx | Operations |
| `/activity` | ActivityLog.jsx | Operations |
| `/access-log` | AccessLog.jsx | Operations |
| `/spaces` | Spaces.jsx, FloorPlan.jsx, InteractiveFloorPlan.jsx, SitePlanViewer.jsx | Workspace |
| `/pricing-requests` | PricingRequests.jsx | Workspace |
| `/billing` | Billing.jsx, InvoiceForm.jsx, InvoiceDetail.jsx | Workspace |
| `/renewals` | Renewals.jsx, TerminateModal.jsx | Workspace |
| `/crm` | Crm.jsx, LeadsBoard.jsx, LeadDetail.jsx, EnquiriesInbox.jsx, TourBookingModal.jsx | Growth |
| `/marketing` | Marketing.jsx, AdsWorkbench.jsx, KeywordResearch.jsx, AiStudio.jsx | Growth |
| `/events` | EventsHub.jsx, Events.jsx, EventBookings.jsx, EventRegistrations.jsx | Growth |
| `/function-bookings` | FunctionBookings.jsx, FunctionEnquiries.jsx | Growth |
| `/announcements` | Announcements.jsx | More |
| `/messages` | AdminMessages.jsx | More |
| `/mail` | MailRegister.jsx | More |
| `/directory` | Directory.jsx, DirectoryDisplay.jsx | More |
| `/food-orders` | FoodOrders.jsx | More |
| `/maintenance` | Maintenance.jsx | More |
| `/reports` | Reports.jsx | More |
| `/templates` | Templates.jsx, RichTextEditor.jsx | More |
| `/settings` | Settings.jsx, MigrationPanel.jsx, PriceListImport.jsx, BulkPhotos.jsx | — |

Nav grouping is defined in `src/components/Layout.jsx`. Routes in `src/AdminApp.jsx`.

### Business logic to read before documenting anything financial

`src/lib/` — `billingEngine.js`, `billing.js`, `billingAccess.js`, `paymentSchedule.js`,
`leasePricing.js`, `pricelist.js`, `pricingApproval.js`, `credits.js`, `dropIn.js`,
`xero.js`, `cardAuthority.js`, `onboarding.js`, `esign.js`, `roomConflicts.js`,
`functionBooking.js`, `tourInvite.js`, `directoryAuto.js`, `fobs.js`, `sendEmail.js`.

### Cron jobs (from `vercel.json`, all UTC)

| Schedule (UTC) | Endpoint | What it does |
|---|---|---|
| `45 * * * *` | `/api/xero/sync` | Hourly Xero pull + push |
| `15 * * * *` | `/api/salto/room-access` | Hourly room access add/remove |
| `30 20 * * *` | `/api/reconcile` | Nightly lease/renewal reconcile |
| `0 23 * * *` | `/api/overdue-reminders` | Nightly overdue ladder |
| `30 21 1 * *` | `/api/auto-billing` | Monthly bill run, 1st of month |
| `0 22 * * *` | `/api/event-reminders` | Event reminders |
| `0 9 * * *` | `/api/lead-nurture` | Lead nurture sequence |
| `0 21 * * *` | `/api/function-reminders` | Function booking reminders |
| `0 9 * * *` | `/api/function-nurture` | Function nurture sequence |

Convert every schedule to **Melbourne time** in the SOPs — staff do not think in UTC.
Note the ordering dependency between reconcile and auto-billing where it matters.

### Public token pages (what the client sees)

`/sign/<token>`, `/sign/event/<token>`, `/book/function/<token>`, `/book-function`,
`/proposal/<token>`, `/refer/<token>`, `/give-notice/<token>`, `/pay/<id>?t=<token>`,
`/directory-name/<token>`, `/refund-details/<token>`, `/directory/2` and `/directory/4`.

Defined in `src/App.jsx`. Where an SOP sends one of these links, describe what the
recipient actually sees and what comes back when they complete it.

### Other surfaces

- Member portal: `src/portal/` (portal.hexaspace.com.au)
- Member mobile app: `src/app/` (`/app`, plus the Capacitor iOS/Android build)
- 114 serverless endpoints in `api/` — read the ones each procedure touches

---

## SOP coverage checklist

Write all of these. Tick them off as you go and report anything you deliberately skipped.

### 00 · Start here
- Platform overview — what each nav section is for, one line each
- Who can do what — admin vs member, and how admin access is granted
- Safe mode — what it is, how to tell if it's on, what it suppresses
- Daily opening routine — the five screens to check each morning
- Glossary — company vs member vs contract vs membership vs fee vs credit

### 01 · Companies & members
- Create a company
- Edit a company profile and set the billing contact
- Record card authority consent
- Add a member to a company
- Invite a member to the portal
- Bulk-invite a company's members
- Set or correct a directory name
- Offboard a member (revoke portal, fobs, Salto)
- Archive or close a company

### 02 · Contracts
- Create a contract
- Choose the membership type and set pricing
- Raise a pricing request and get it approved
- Send a contract for e-signature
- Chase an unsigned contract
- Countersign and trigger the getting-started pack
- Amend a contract mid-term
- Apply rent-free months (**and why you never enter $0 rent**)
- Renew a contract / how auto-renew works
- Process a member giving notice
- Terminate a contract early
- Update the T&C template and version

### 03 · Billing
- How the monthly bill run works and what to check on the 1st
- Create a one-off invoice
- Add a recurring fee
- Take a payment on a saved card
- Send a pay link
- Record a bank transfer payment
- Issue a credit note
- Refund a deposit (Stripe vs bank path)
- The overdue ladder — 60 / 76 / 87 / 90 days
- Approve a membership cancellation for non-payment
- How Xero sync works and what to do when it errors
- What the nightly reconcile does

### 04 · Spaces & access
- Add or edit a space
- Change a space's status
- Read the floor plan / site plan
- Issue a fob or remote
- Replace a lost fob
- Provision Salto access on move-in
- Revoke Salto access on move-out
- How meeting-room door access is granted
- Review the access log after an incident

### 05 · Bookings
- How members book rooms (credits vs paid)
- Book a room on a member's behalf
- Take a drop-in booking (pay on the spot)
- Cancel or move a booking
- Function space enquiry → quote → agreement → deposit → confirmed
- Multi-session function series
- Why booking one Function Space room blocks the others
- Run an event: create, registrations, reminders
- Event booking agreements and insurance documents

### 06 · Front of house
- Log a walk-in or phone enquiry
- Book a tour
- Run a tour and convert it
- Receive and release mail or a parcel
- Handle a food order
- Log a maintenance ticket and close it
- Post an announcement
- Reply to a member message
- Update the lobby directory screens

### 07 · Growth
- How website enquiries arrive
- Work the leads board
- Send a brochure or info pack
- Build and send a proposal
- Process an accepted proposal into a client
- How the nurture sequences work and how to stop one
- Referrals and the referrer dashboard
- Marketing and ads workbench

### 08 · System administration
- Add or remove an admin user
- Edit an email template and use placeholders
- Import a price list
- Bulk photo upload
- Run and read a report
- Read the activity / audit log
- All cron jobs — what runs when (Melbourne time) and how to tell if one failed
- What to do when an email doesn't arrive
- Escalation: what to handle yourself vs what goes to Eric

---

## Working order

Do **not** attempt all eight categories in one pass. Work one category at a time:

1. Read every component, lib and endpoint in that category's scope.
2. Write the SOPs for that category.
3. Report back: what you wrote, what you marked TODO(verify), what surprised you.

Start with **02 · Contracts**, then **01 · Companies & members**, then **03 · Billing** —
those three are the spine of the business and everything else references them. Then
00 (which is easier to write once you've seen the rest), then the remainder in any order.

## Acceptance criteria

An SOP is done when:

- Every UI label in it appears verbatim in the component source.
- The "What happens automatically" section traces a real code path, not an assumption.
- A person who has never used the platform could follow it without asking a question.
- No credentials appear anywhere in it.
- Any uncertainty is marked `TODO(verify)` rather than papered over.

## Non-goals

- Do not modify any application code. This task produces documentation only.
- Do not build the Training tab UI in this pass — that's separate work.
- Do not document the member portal or mobile app from the member's side beyond what
  staff need in order to support them.

---
slug: referrals
title: Referrals and the referrer dashboard
category: growth
audience: [ops, admin]
route: /crm
relatedCode:
  - src/components/ReferralsPanel.jsx
  - src/components/ReferrerDashboard.jsx
  - api/referral-signup.js
  - api/referrer-dashboard.js
relatedSops: [work-the-leads-board, website-enquiries]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Set up a referral partner, track what they send us, and pay their commission.

## When to do this

An agent, a member or a partner wants to refer business.

## Steps — add a referrer

1. Open **CRM** → **Referrals** and add a referrer.
2. Enter their **name**, **email** and **phone**.
3. Set the **commission rate** — it defaults to **5%**.
4. Save.

## Steps — give them their links

Each referrer gets three, all copyable from their row:

| Link | What it's for |
|---|---|
| **Tenant link** | The website with their referral code attached — for prospects looking for space |
| **Seller link** | The list-your-property page with their code — for property owners |
| **Dashboard link** | Their own private page showing their referrals and commissions |

The dashboard link is token-based: they open it without a login. Treat it as private to that referrer.

## Steps — track and pay

1. Expand a referrer to see the leads they've sent and their pipeline stages.
2. Commissions move through **pending** → **approved** → **paid**.
3. The panel totals what's outstanding and what's been paid.
4. Update a commission's status as it progresses.

## What happens automatically

- A visitor arriving through a referral link carries the code into the enquiry, so the lead is attributed on creation.
- Referred leads appear on the normal leads board **and** under their referrer.
- The referrer's dashboard updates from the same data — they see stages as they change.

## Common mistakes

- **Sharing a dashboard link.** It's that referrer's private view, gated only by the token.
- **Giving out the wrong link.** Tenant and seller links go to different pages for different audiences.
- **Changing a commission rate after leads have come in.** Check what was agreed for existing referrals first.
- **Marking a commission paid before it's paid.** The totals are what you'll reconcile against.
- **Assuming attribution is automatic without the link.** A referrer who tells someone to "just search for us" gets no code and no credit.

## If something goes wrong

- **A referral isn't attributed** — the prospect probably came direct. Set the referrer on the lead by hand if it's genuine.
- **The referrer says their dashboard is empty** — check they have leads attributed, and that they're using the dashboard link rather than a referral link.
- **A commission dispute** — the panel shows the leads and stages behind the number. Take it to Eric with that evidence.

> **TODO(verify):** confirm how and when a commission record is **created** — from the panel I can see statuses and totals, but not whether commissions are raised automatically when a referred lead converts, or added by hand. That changes whether anyone needs to remember to create them.

## Related

- [Work the leads board](work-the-leads-board.md)
- [How website enquiries arrive](website-enquiries.md)

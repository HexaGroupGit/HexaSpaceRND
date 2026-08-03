---
slug: overdue-ladder
title: The overdue ladder
category: billing
audience: [ops, admin]
route: /billing
relatedCode:
  - api/overdue-reminders.js
  - api/reconcile.js
  - src/components/Billing.jsx
relatedSops: [approve-overdue-cancellation, charge-a-saved-card, send-a-pay-link]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Know what the system is already doing about an overdue account, so you don't duplicate it or contradict it.

## When to do this

Before phoning a client about money, and whenever you're asked "what have we sent them?"

## The two ladders

There are **two independent escalations** running against an overdue account. Both matter.

### Ladder 1 — payment reminders (daily, 9am Melbourne)

| Stage | What happens |
|---|---|
| Due date passes | Invoice flips to **overdue** |
| Same day | Reminder email to the billing contact, listing **all** their overdue invoices with pay links |
| Every 3 days | Another reminder |
| After 6 reminders | Reminders stop for that invoice |

Plus, if enabled in Settings:

- **Auto-charge** (Stripe): after a **7-day grace period**, a *2 business days' notice* email, then the saved card is charged. Only for companies with recorded card authority.
- **Door access suspension** (clause 7(d)): once an invoice is more than **14 days** past due, every member's Salto access is blocked and a suspension notice is emailed. It restores automatically — with another email — as soon as no overdue invoices remain. A $100 re-activation fee may apply.

### Ladder 2 — cancellation warnings (nightly reconcile, ~6:30am Melbourne)

Driven by the **oldest unpaid past-due invoice**, and off unless enabled in Settings → Billing Rules.

| Days overdue | What happens |
|---|---|
| **60** | First cancellation warning to the client, admins bcc'd |
| **76** | Second warning |
| **87** | Third warning |
| **90** | **Final notice** to the client + an approval request to admins. Nothing is cancelled. |
| After 90 | Waits — listed in the daily digest — until an admin approves, exempts, or the client pays |

**It never auto-terminates.** Cancellation always requires an admin to click. See [Approve a cancellation for non-payment](approve-overdue-cancellation.md).

## Steps — check where a client sits

1. Open **Billing** → **Overdue**. The **Contact** column appears here with the billing contact's name, phone and email.
2. Read the **Reminded dd/MM ×n** badge on each invoice — that's the automated ladder.
3. Open the company profile. A red **Cancellation awaiting approval** banner means they have passed the 90-day cut-off.

## Steps — chase manually

1. On the **Overdue** filter, click **Send Reminders (n)** to email every listed company — one email each, all their overdue invoices, each with a pay link.
2. Or open a single invoice and click **Send Reminder**.

## What happens automatically

- Reminders are **per company, not per invoice** — a client three invoices behind gets one email listing all three.
- The whole set shares one reminder cycle, so their caps count down together.
- A newly-overdue invoice restarts the cycle for that company.
- Only debts from **1 July 2026 onward** drive cancellation warnings. Migrated pre-July balances are a manual collections matter — Xero is the truth for those.
- Companies with **no live membership** are never warned or final-noticed. Former members with old debts are collections, not cancellation.
- Paying off **clears the warning state entirely**, including a pending cancellation.
- A tenant can be marked exempt to stop the process for them permanently.

## Common mistakes

- **Manually chasing someone the system chased this morning.** Check the **Reminded** badge first.
- **Promising "nothing will happen"** without checking whether door-access suspension is on. At 14 days past due, their team can lose access.
- **Assuming the ladder cancels people.** It never does — it stops and waits for an admin.
- **Chasing a pre-July-2026 balance through this process.** It won't escalate, by design.
- **Reading "no warnings sent" as "not overdue".** A company with no live membership never enters the cancellation ladder however much they owe.

## If something goes wrong

- **A client got a warning they shouldn't have** — check their invoices; something is genuinely past due. If it's a data error, fix the invoice and the state clears on the next run.
- **Access was suspended unfairly** — clearing the balance restores it automatically on the next run. If it must be immediate, that's a manual Salto KS change.
- **Reminders have stopped but they still owe** — they've hit the 6-reminder cap. It's a phone call now.
- Anything heading toward cancellation: Eric decides.

## Related

- [Approve a cancellation for non-payment](approve-overdue-cancellation.md)
- [Take a payment on a saved card](charge-a-saved-card.md)
- [Send a pay link](send-a-pay-link.md)

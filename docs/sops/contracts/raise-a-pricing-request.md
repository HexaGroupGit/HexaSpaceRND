---
slug: raise-a-pricing-request
title: Raise a pricing request and get it approved
category: contracts
audience: [reception, ops, admin]
route: /pricing-requests
relatedCode:
  - src/components/PricingRequests.jsx
  - src/lib/pricingApproval.js
relatedSops: [set-document-type-and-pricing, create-a-contract]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Get a manager's recorded sign-off before quoting a rate below list, so months later you can see who approved what and why.

## When to do this

Any time a client needs a rate below the space's list rate, or rent-free months, or another incentive. Quote list first — only raise a request if they need something under it.

## Before you start

Know the list rate, the term the client will commit to, and what you are trying to win (a competing offer, a longer term, a space that has sat vacant).

## Steps — raising a request

1. Open **Pricing Requests** and click **New pricing request**. (From Spaces you can also deep-link straight into a primed form.)
2. Read the **Before you raise this** panel.
3. Choose the **Space \***. The **List rent (ex GST/mo)** fills from the space record.
4. Enter the **Company / prospect \*** name.
5. Enter the **Contact email** (optional).
6. Enter the **Proposed rent (ex GST/mo) \*** — monthly, ex GST, the same basis as a contract.
7. Set the **Term (months)** and any **Rent-free months**.
8. List anything else you are giving away under **Other incentives** (fit-out contribution, parking included).
9. Write the **Justification \*** — this is what the manager approves against.
10. Check the summary line: *Discount X% · concession over the term $Y ex GST*.
11. Click **Send for approval**. The request appears under **pending** with a `PR-######` reference.

## Steps — approving a request

1. Open **Pricing Requests** and click the row.
2. Read the **What to check** guide, the justification, and the amber **Total concession over the term** banner.
3. Type your **Reasoning** — it is required. If you are declining, say what rate or term *would* be acceptable so it comes back once, not three times.
4. Click **Approve** or **Decline**.

## What happens automatically

- One approval closes the request as **approved** (configurable in Settings → pricingApproval). A single decline closes it as **declined** immediately.
- The decision is stored with who decided, when, and their reasoning, and shown permanently on the request.
- **Nothing flows into a contract.** An approved request does not create or change a contract — you still enter the rate by hand under Items.

## Common mistakes

- **Approving your own request.** Blocked: *You raised this request — it needs a different manager to sign off.* This is the entire point of the gate.
- **Modelling rent-free months as $0 rent** on the resulting contract instead of as a rent-free count. Called out explicitly in the approver's checklist.
- **Entering rent including GST.** Everything here is ex GST, per month.
- **Raising the request after the contract is out for signature.** The approval is then decoration; raise it before you quote.
- Only spaces of type office, warehouse, desk or popup appear in the **Space \*** dropdown.

## If something goes wrong

- **You can't approve** — the panel tells you why: not a pricing manager, you raised it, you already decided, or it is already closed. Approvers are listed at the top of the page.
- **The wrong rate was approved** — the requester can **Withdraw this request** while it is still pending. Once approved or declined it is closed; raise a fresh one.
- Anything commercially contentious: Eric.

## Related

- [Set the document type and pricing](set-document-type-and-pricing.md)
- [Create a contract](create-a-contract.md)

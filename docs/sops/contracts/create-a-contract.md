---
slug: create-a-contract
title: Create a contract
category: contracts
audience: [reception, ops, admin]
route: /leases
relatedCode:
  - src/components/Leases.jsx
  - src/components/ContractForm.jsx
  - src/lib/leasePricing.js
  - src/store/useStore.js
relatedSops: [set-document-type-and-pricing, send-contract-for-e-signature, rent-free-months]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Create the licence agreement that links a company to a space, at an agreed rent, for an agreed term.

## When to do this

A client has accepted a proposal or verbally agreed to take a space, and you are ready to send them something to sign.

## Before you start

- The **company** exists under Companies. If it doesn't, create it first.
- The **space** exists under Spaces and is vacant (or is a virtual office).
- The rent is either at list, or you have an **approved** pricing request.

## Steps

1. Open **Contracts** and click **Add Contract**.
2. Under **Company Information**, choose the **Company**. If the company already holds a deposit on another active contract, a blue **Deposit held: A$…** badge appears — read it before setting a new deposit.
3. Choose the **Member** (optional). The list shows that company's members, billing person first, tagged **· billing person**.
4. Under **Duration**, choose the **Document Type**. This restricts which spaces you can pick in Items:
   - **License Agreement** → private offices only
   - **Virtual Office Membership Agreement** → virtual offices only
   - **Membership Agreement Month-to-month** → desks only
   - **Service Agreement** → unrestricted
5. Check the **Require payment card on file** tick-box. It is ticked by default for Virtual Office and desk document types, unticked for License Agreement. Untick it only for a trusted payer — see Common mistakes.
6. Choose the **Contract Type**: New, Renewal, Transfer, Amendment or Month-to-month.
7. Leave **Signature Status** on **Not Signed** — the e-sign flow sets this for you.
8. Leave **Number** as generated (the next `CON-###`). Only override it if you are matching a legacy number.
9. Set the **Start Date**. The **End Date** auto-fills to one year less a day (1 Jul 2026 → 30 Jun 2027) for every contract type except Month-to-month.
10. Adjust the **End Date** if the term isn't 12 months. For Month-to-month, leave it blank — it runs open-ended until notice is given.
11. Set the **Notice Period** in **Months** (defaults to 2).
12. Leave **Status** on **Active** for a contract starting now, or **Pending** for one that hasn't commenced.
13. Under **Items**, choose the space from **Select Resource**. The **Deposit** auto-fills to two months' rent (zero for Month-to-month) and the step's **List Price** auto-fills from the space's monthly rate.
14. Adjust the **Deposit** if it was negotiated differently.
15. In the **Steps** row, check **Start Date** and **End Date**, set the **List Price** (the RRP, ex GST), and set a **Discount** if one applies — choose **%** or **$** from the dropdown, then enter the number. The effective price shows underneath as *After X discount: A$…/mo*.
16. To add a second space to the same contract, click **+ Add Space** and repeat. Every line item's opening step is summed into the contract's monthly rent and deposit.
17. Under **Terms & Conditions**, confirm the right documents are attached. Click **+ Attach** on any template listed under **Available templates**; attached ones show **✓ Attached**.
18. Add **Inclusions** — one per line. Each becomes a row in the INCLUSIONS table on the agreement (e.g. `2 × car parks included`).
19. Add internal **Notes** if needed. These never appear on the agreement.
20. Click **Create**. You land back on the Contracts list with the new contract at its number.

## What happens automatically

- Every space on the contract is set to **reserved** (not occupied). It only flips to **occupied** once the deposit and first invoice are paid *and* the start date arrives.
- If any of those spaces was published to the website, the listing re-syncs so its public status becomes *leased*.
- An audit-log entry is written against the contract number.
- **Nothing is invoiced yet.** The security deposit and first (prorated) membership invoice are raised the moment the contract's signature status becomes signed — not when it is created.
- If you set **Contract Type** to **Renewal**, the contract is sent for e-signature immediately on save, without you clicking anything. See [Renew a contract](renew-a-contract.md).

## Common mistakes

- **Entering $0 rent for a rent-free period.** A $0 contract never expires and auto-renews silently. Use rent-free months instead — see [Apply rent-free months](rent-free-months.md).
- **Leaving the End Date blank on a non-Month-to-month contract.** The form blocks this with *End date is required*, but changing Contract Type to Month-to-month after the fact leaves an open-ended contract you may not have intended.
- **Picking the wrong Document Type first.** The space list is filtered by document type, so if the space you want isn't in **Select Resource**, the document type is usually why.
- **Forgetting the deposit auto-fill is two months.** It recalculates every time you change the space, overwriting anything you typed.
- **Unticking Require payment card on file on a desk or virtual office.** Those memberships bill monthly with no bond behind them; the stored card is how overdue amounts get recovered.
- Private offices already leased or assigned won't appear in **Select Resource** at all. Virtual offices always appear, even when in use.

## If something goes wrong

- **The space isn't in the dropdown** — check the Document Type first, then check under Spaces whether the unit is vacant and has no other active or pending contract.
- **The contract number looks wrong** — numbering takes the highest clean `CON-###` and adds one. Compound legacy numbers like `CON-140-OFFICE11` are ignored, so a gap is normal.
- **You created it against the wrong company** — delete it and start again while it is still unsigned and uninvoiced. Once signed, deletion is blocked; use Terminate instead.
- Anything you can't resolve in five minutes: escalate to Eric before sending it to the client.

## Related

- [Set the document type and pricing](set-document-type-and-pricing.md)
- [Raise a pricing request](raise-a-pricing-request.md)
- [Send a contract for e-signature](send-contract-for-e-signature.md)
- [Apply rent-free months](rent-free-months.md)

---
slug: countersign-a-contract
title: Countersign and send the getting-started pack
category: contracts
audience: [ops, admin]
route: /leases
relatedCode:
  - src/components/ContractDetail.jsx
  - src/lib/onboarding.js
  - src/store/useStore.js
relatedSops: [send-contract-for-e-signature, chase-an-unsigned-contract]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Execute the agreement on Hexa Space's side. This is the single busiest moment in the platform — it activates the contract, raises the first invoices, and sends the client three separate emails.

## When to do this

As soon as the contract shows the orange **⚠ Tenant has signed** banner. Don't leave it overnight — nothing moves until you sign.

## Before you start

- Read the client's signature and signed date in the orange banner.
- Have the licensor name right: it defaults to the company name from Settings.

## Steps

1. Open **Contracts** and click the contract row.
2. In the left panel, click **Countersign Now →**.
3. Check the **Licensor name** in the **Countersign as Licensor** dialog.
4. Draw the signature in the **Signature** box. **Clear** resets it.
5. Click **Sign & Execute** and wait — it builds a PDF and sends emails before it closes.
6. Confirm the status now reads **E Signed** and the top bar shows **Signed PDF**, **Send Signed Copy** and **Getting Started**.

## What happens automatically

All of this fires from that one click:

1. **The contract is activated** — signature status **E Signed**, status **Active**, activation timestamped.
2. **The security deposit invoice and the first (prorated) membership invoice are raised**, both pending, due by the Settings → Invoicing due days (default 14). The deposit carries **no GST**; the membership invoice does. Both are dedup-guarded so the monthly bill run won't double-bill. *Renewals are skipped* — no fresh deposit, no opening-month invoice.
3. **The fully signed PDF is emailed with the signed copy attached** to: whoever the signing link went to, the contract's primary contact, the company email, and the admin addresses (eric@ and info@).
4. **A portal-signup welcome is sent** — but only if nobody at that company already has portal access. It contains the set-password link and the add-to-home-screen instructions.
5. **The getting-started pack is sent** to the client: registered business address, a token-gated directory-listing link, Wi-Fi details from Settings, and the phone-app guide.
6. Audit-log entries are written for the countersignature and each email.

What does **not** happen yet: the space stays **reserved**, not occupied. It only flips to **occupied** once the deposit and first invoice are paid, any required card is on file, and the start date has arrived. That flip — and the welcome/onboarding email and portal invite — happen either when an admin loads the app after payment, or on the nightly reconcile.

## Common mistakes

- **Closing the tab while it says "Signing…".** The signature and activation save first, but the emails may not have gone. Check the top bar for **Send Signed Copy** and re-send if unsure.
- **Countersigning a contract you haven't checked.** This raises real invoices to a real client. Read the numbers first.
- **Expecting the client to have access straight away.** They will not until the money lands.
- **Re-sending the getting-started pack unnecessarily.** It is sent once automatically; the **Getting Started** button force-sends it again. Hover it to see when it last went.
- **Signing on behalf of the client.** The licensee signature comes from the client's own signing page. If they wet-signed, use **Mark as Signed** instead and file the paper copy.

## If something goes wrong

- **"Error: …" on Sign & Execute** — nothing was executed. Try again; if it repeats, escalate to Eric.
- **The client says no signed copy arrived** — click **Send Signed Copy**. It lists the recipients and asks you to confirm before sending.
- **The signed PDF looks wrong** — click **Signed PDF** to download exactly what was sent, then escalate. The document is generated fresh each time from the contract's current data.
- **No portal welcome arrived** — check whether someone at that company already has portal access; the welcome is deliberately skipped in that case. Invite the individual from the Members page instead.

## Related

- [Send a contract for e-signature](send-contract-for-e-signature.md)
- [Chase an unsigned contract](chase-an-unsigned-contract.md)
- [Create a contract](create-a-contract.md)

---
slug: send-contract-for-e-signature
title: Send a contract for e-signature
category: contracts
audience: [reception, ops, admin]
route: /leases
relatedCode:
  - src/components/ContractDetail.jsx
  - src/lib/esign.js
  - src/components/SignPage.jsx
  - src/lib/credits.js
relatedSops: [create-a-contract, chase-an-unsigned-contract, countersign-a-contract]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Send the client a link to read and sign the agreement online, and record that it went out.

## When to do this

As soon as the contract is created and you have checked the numbers.

## Before you start

- Check the agreement itself: open the contract, click **Template View**, and read the licence fee details, payment schedule and inclusions.
- Confirm there is an email address to send to — the company email, the billing person, the contact person, or any member.

## Steps

1. Open **Contracts** and click the contract row.
2. Click **Template View** and check the document reads correctly. Use **Generate PDF** if you want a copy on file first.
3. Click **Sign** in the top bar, then **Send for eSign**.
4. Confirm the left panel now shows **Out For Signature** and, under **🔗 eSign Links:**, the sent timestamp.
5. If you need to give the link out another way, click **Copy Member Link** (the client's link) or **Copy Admin Link** (opens the same page in admin mode). A green *Member link copied* toast confirms it.

## What happens automatically

- A signing request is created with a fresh unguessable token, and the contract's **Signature Status** flips to **Out For Signature**.
- The client is emailed a signing link at `portal.hexaspace.com.au/sign/<token>`. The recipient is resolved in order: company email → billing person → contact person → any member. Whoever it actually went to is recorded on the contract.
- The email uses **Templates → Emails → E-signature request** if one exists, otherwise a built-in fallback.
- The client's page walks them through in order: **Agreement** → **Terms & Conditions** → **House Rules** → **Sign**. Later steps stay locked until they have paged through the earlier ones. The documents shown are the ones attached to this contract, falling back to the global versions.
- On submit they enter full name, title and date, draw a signature, and tick a confirmation that they are authorised to sign.
- If the membership requires a card on file, the client is taken straight to a Stripe card-verification step after signing. Their signature is recorded either way — the card step is separate.
- **If the email fails to send, the contract still shows Out For Signature.** The status update happens before the email, and a send failure is only logged to the browser console.

## Common mistakes

- **Sending before checking Template View.** The client reads the agreement in the same page they sign on; a wrong rate or date is visible to them.
- **Assuming the email reached the client.** The status flips regardless. If nothing arrives, use **Copy Member Link** and send it yourself.
- **Sending to the wrong person.** The recipient is picked automatically, not chosen by you. If the company has no email on file, it falls through to a member — check the company record first if it matters who receives it.
- **Marking a contract as signed to skip the flow.** **Mark as Signed** records a manual signature with no document, no client signature image and no countersignature. Use it only when you hold a wet-signed copy.
- Once signed, the contract can no longer be deleted.

## If something goes wrong

- **"Could not send for signing: …"** — the signing request could not be created. Nothing was sent; try again, then escalate to Eric.
- **The client says the link is invalid or expired** — send a fresh one with **Send for eSign** again; a new token is minted each time.
- **The client signed but nothing shows** — reload the contract. The tenant-signed banner only appears once the signing record is read back.

## Related

- [Create a contract](create-a-contract.md)
- [Chase an unsigned contract](chase-an-unsigned-contract.md)
- [Countersign and send the getting-started pack](countersign-a-contract.md)

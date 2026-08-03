---
slug: chase-an-unsigned-contract
title: Chase an unsigned contract
category: contracts
audience: [reception, ops, admin]
route: /leases
relatedCode:
  - src/components/ContractDetail.jsx
  - src/lib/esign.js
  - api/reconcile.js
relatedSops: [send-contract-for-e-signature, countersign-a-contract]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Move a contract that is sitting unsigned — or signed but without the required payment card — before it delays a move-in.

## When to do this

- The contract has shown **Out For Signature** for more than a few days.
- The start date is approaching and nothing has been signed.
- The client signed but the membership still shows no card on file.

## Before you start

Open the contract and read the left panel. It tells you exactly where things are stuck:

| What you see | What it means |
|---|---|
| **Out For Signature** with no orange banner | The client hasn't opened or completed the signing page |
| Orange **⚠ Tenant has signed** banner | The client has signed; **we** are the hold-up — countersign |
| **💳 No card on file yet** | The membership needs a Stripe card that hasn't been saved |
| **Not Signed** | Nothing was ever sent, or it was reset |

## Steps

1. Open **Contracts** and click the contract row.
2. Check **eSign Links** for the sent timestamp — confirm how long it has actually been.
3. Click **Copy Member Link** and send it to the client directly with a short note, or phone them.
4. If the link is old or the recipient was wrong, click **Sign → Send for eSign** again to issue a fresh link and email.
5. If the orange **⚠ Tenant has signed** banner is showing, stop chasing the client — click **Countersign Now →** instead.
6. If the client says they have signed but the page still shows the card step, they can reopen the same link and finish it — signing is already recorded.

## What happens automatically

- **There is no automatic chaser for an unsigned contract.** Nothing reminds the client and nothing reminds you. This is a manual follow-up.
- **There is an automatic chaser for a missing card.** For card-required memberships where the client has signed but no card is on file, the nightly reconcile emails them a *One step left — register your card* message: first 24 hours after signing, then every 2 days, up to 5 reminders. The link takes them back to their signing page, which shows the card step until Stripe confirms a card.
- Onboarding is **held** while that card is missing — no welcome email, no portal invite, no access — even though the agreement is fully signed.
- Reconcile runs daily at 20:30 UTC, i.e. about **6:30am Melbourne** the following morning (7:30am during daylight saving).

## Common mistakes

- **Waiting for a system reminder that doesn't exist.** Unsigned contracts sit indefinitely. Check the Contracts list for **Out For Signature** as part of your weekly routine.
- **Re-sending when the client has already signed.** The orange banner means it is our turn. Re-sending confuses the client and looks careless.
- **Treating "fully signed" as "moved in".** A card-required membership is not onboarded until the card lands.
- **Chasing a card reminder past five sends.** The chaser stops at five; after that it needs a phone call.

## If something goes wrong

- **The client insists they never got the email** — send the member link yourself. The original email failure is only visible in the browser console, so you will not see an error.
- **The card step won't complete** — the client should try a different card or browser; the page is Stripe's, not ours. If it still fails, escalate to Eric.
- **A contract has been unsigned past its start date** — raise it with Eric. It is neither billing nor granting access, and the space is being held as reserved.

## Related

- [Send a contract for e-signature](send-contract-for-e-signature.md)
- [Countersign and send the getting-started pack](countersign-a-contract.md)

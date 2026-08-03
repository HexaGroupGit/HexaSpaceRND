---
slug: set-directory-name
title: Set or correct a directory name
category: companies-members
audience: [reception, ops, admin]
route: /directory
relatedCode:
  - api/directory-name.js
  - src/components/DirectoryNamePage.jsx
  - src/lib/directoryAuto.js
  - api/reconcile.js
relatedSops: [countersign-a-contract, create-a-company]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Control exactly how a business appears on the lobby digital directory boards.

## When to do this

A new member wants their listing set up, an existing one asks for a change, or a name is showing wrongly on a board.

## Before you start

Know how the name is normally captured: the getting-started email sent at countersign contains a **Confirm your directory listing** button, token-gated to that contract. The member sets their own name there — usually you don't have to do anything.

The listing allows **1 or 2 lines**, up to 80 characters each. The second line is typically a Chinese name.

## Steps — the member sets it (normal path)

1. Confirm the getting-started pack went out — the contract's **Getting Started** button shows when it last sent.
2. The member clicks **Confirm your directory listing** and enters their name.
3. You will get an email confirming what they chose.

## Steps — resend the link

1. Open the contract and click **Getting Started** in the top bar.
2. Confirm the send. The pack, including the directory link, goes to the primary contact.

## Steps — correcting a name yourself

> **TODO(verify):** the member-facing token page writes `tenant.directoryName`, and the boards prefer it over the auto-generated name — but I could not find an admin field that edits `directoryName` directly. Confirm whether the Directory admin page can override it, or whether resending the member's link is the only route.

## What happens automatically

- Saving writes the confirmed name and a confirmation timestamp onto the company record.
- **Ops is emailed** at info@ and eric@ with exactly what the member chose.
- **The digital boards follow automatically.** Boards with auto-sync ticked regenerate on the nightly reconcile — offices from occupancy, community from virtual-office and desk memberships. Hand-edited display text survives while the occupant is unchanged.
- **The printed board does not.** The ops email says so explicitly: the digital boards update themselves, a human updates the printed one.
- Boards are polled by the lobby TVs, so a refreshed board reaches the screens without anyone touching them.
- Reconcile runs at 20:30 UTC — about **6:30am Melbourne** the next morning. A name confirmed during the day appears the following morning, not instantly.

## Common mistakes

- **Promising a same-day change.** Auto-synced boards refresh overnight.
- **Forgetting the printed board.** It is the only part with no automation.
- **Expecting more than 2 lines.** Anything beyond two lines is dropped, and each line is cut at 80 characters, silently.
- **Resending the getting-started pack just for the directory link.** It also re-sends the address, Wi-Fi and app guide — tell the member to expect the whole email.
- **Assuming a blank listing means the board is broken.** A member who never clicked the link has no confirmed name, and the board falls back to the auto-generated one.

## If something goes wrong

- **The member says the link isn't valid** — tokens are per-contract. If the contract changed, resend from the current one.
- **The board shows an old name** — check whether the board has auto-sync ticked; a manual board never refreshes itself.
- **A name is wrong on the screens right now** and can't wait: that's a Directory admin change, not a member-side one.

## Related

- [Countersign and send the getting-started pack](../contracts/countersign-a-contract.md)
- [Create a company](create-a-company.md)

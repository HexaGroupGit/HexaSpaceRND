---
slug: add-or-edit-a-space
title: Add or edit a space
category: spaces-access
audience: [ops, admin]
route: /spaces
relatedCode:
  - src/components/Spaces.jsx
  - src/components/spaces/PrivateOfficesTab.jsx
  - src/components/spaces/shared.jsx
  - src/components/spaces/AssignableResourceTab.jsx
relatedSops: [change-space-status, provision-salto-access, create-a-contract]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Add a new unit to the inventory, or correct an existing one, so it can be leased, booked and priced.

## When to do this

A new suite comes online, a room is repurposed, or a rate or attribute is wrong.

## Before you start

Know which **type** it is — the Spaces page is split into tabs, and type determines nearly everything downstream:

| Tab | Type | Used for |
|---|---|---|
| **Locations** | — | Buildings and floors |
| **Meeting Rooms** | meeting | Bookable rooms |
| **Private Offices** | office | Leased suites |
| **Media Studios** | studio | Hourly bookable |
| **Podcast Room** | podcast | Hourly bookable |
| **Parking** | parking | Monthly parking slots |
| **Virtual Office** | virtual | Address-only memberships |
| **Dedicated Desks** | desk | Monthly desks |

## Steps — add a private office

1. Open **Spaces** → **Private Offices**.
2. Click to add a new office. The suite number is pre-filled with the next available on that floor.
3. Set the **floor** — Level 2 and Levels 4&5 bill to **different Xero accounts**, so this is a financial field, not a label.
4. Set the **placement** (internal or external) and **pax**. The monthly rate auto-computes from floor × placement × pax.
5. Override the rate only if it was genuinely negotiated differently.
6. Set **Salto doors** if this office's KS access group name differs from the default derived from its number. See [Provision Salto access](provision-salto-access.md).
7. Add any **attributes**.
8. Save. New offices are created **vacant**.

## Steps — add a bookable or assignable resource

1. Open the matching tab.
2. Add the resource. Names auto-increment from the tab's prefix — *Media Studio 1*, *P1*, *Dedicated Desk 1*, *Suite 403* for virtual offices.
3. Set the rate — hourly for studios and podcast rooms, monthly for parking, desks and virtual offices.
4. Save. **Adding a Virtual Office creates the next suite and immediately prompts you to assign a member.**

## Steps — bulk price update

Click **Import price list** on the Spaces page to update rates from a file rather than one at a time.

## What happens automatically

- Office rates recompute whenever floor, placement or pax changes — including on an existing office. Check the rate after any of those edits.
- The floor drives Xero revenue coding: Level 2 memberships and parking code to their own accounts.
- A space's **type** decides which contract document types may book it. A Licence Agreement only sees offices; a Virtual Office agreement only sees virtual offices.
- Private offices already leased or assigned are hidden from the contract form's resource picker; virtual offices always appear.
- **Sync Hexa layout** re-syncs the standard building layout. **Load sample data** replaces data with samples — see the warning below.

## Common mistakes

- **Setting the wrong floor.** It silently changes both the rate and the Xero account.
- **Editing pax or placement on an occupied office.** The rate recomputes underneath you; the existing contract keeps its agreed figure, but the space's list rate changes for the next one.
- **Clicking Load sample data on the live system.** It is next to the other buttons and sounds harmless. Do not touch it.
- **Creating a virtual office without assigning it.** The prompt appears for a reason — an unassigned suite looks vacant.
- **Adding a space with the wrong type** to "fix it later". Type drives contracts, bookings, Salto groups and Xero coding.

## If something goes wrong

- **The rate keeps changing** — it recomputes from floor × placement × pax. Set those first, then override the rate last.
- **A new office won't appear on a contract** — check its status is vacant and it has no active or pending contract.
- **You clicked Load sample data** — stop and call Eric immediately.

> **TODO(verify):** confirm exactly what **Sync Hexa layout** and **Load sample data** do to live data. Both are single-click buttons with no confirmation dialog visible in `Spaces.jsx`, sitting next to routine controls. If either is destructive, they need a confirmation step — and this SOP needs to say precisely what they overwrite.

## Related

- [Change a space's status](change-space-status.md)
- [Provision Salto access on move-in](provision-salto-access.md)
- [Create a contract](../contracts/create-a-contract.md)

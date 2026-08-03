---
slug: read-the-floor-plan
title: Read the floor plan and site plan
category: spaces-access
audience: [reception, ops, admin]
route: /spaces
relatedCode:
  - src/components/FloorPlan.jsx
  - src/components/InteractiveFloorPlan.jsx
  - src/components/SitePlanViewer.jsx
  - src/components/spaces/LocationsTab.jsx
relatedSops: [change-space-status, add-or-edit-a-space]
version: 1
reviewDue: 2027-02-01
---

## Purpose

See at a glance which suites are occupied, reserved and available — for a tour, a plan, or a quick answer on the phone.

## When to do this

A prospect asks what's free, you're preparing a tour, or you want to sanity-check occupancy.

## Steps

1. Open **Spaces** → **Locations**.
2. Choose the floor.
3. Read the colour coding, which uses the same statuses as everywhere else:
   - **Occupied** — dark
   - **Available / vacant** — green
   - **Reserved** — amber
   - **Vacating** — yellow
4. Click a suite to see its detail and the occupying company.

## What happens automatically

- The plan is drawn from live space records — status and occupant come straight from contracts. There is nothing separate to keep in sync.
- The occupant tag comes from the contract that occupies the space, or an explicit occupant set on the space record, which wins if present.
- Amber (reserved) means a contract exists but the access gate isn't met — signed but not fully paid, or not yet commenced. **Those are not available to sell.**

## Common mistakes

- **Quoting an amber suite as available.** Reserved means someone is part-way through taking it.
- **Trusting the plan over the contract.** If they disagree, the contract is the truth — see [Change a space's status](change-space-status.md).
- **Forgetting Level 2.** Offices exist on more than one floor and bill to different accounts. Check the right one.
- **Reading a vacant tile as immediately available.** Check for a pending contract that hasn't reserved it yet.

## If something goes wrong

- **A suite shows the wrong occupant** — an explicit occupant on the space record overrides the lease-derived one. Check both.
- **The plan doesn't match Spaces** — reload; the plan reads the same data.
- **A space is missing from the plan** — it may have no floor set, or a type that isn't drawn.

> **TODO(verify):** confirm the exact click-path to each viewer — `FloorPlan.jsx`, `InteractiveFloorPlan.jsx` and `SitePlanViewer.jsx` are three separate components and I could not establish from `LocationsTab.jsx` alone which is reached from where, or whether any is only used in the portal. Walk the UI and pin the steps to the real navigation.

## Related

- [Change a space's status](change-space-status.md)
- [Add or edit a space](add-or-edit-a-space.md)

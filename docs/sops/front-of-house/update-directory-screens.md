---
slug: update-directory-screens
title: Update the lobby directory screens
category: front-of-house
audience: [reception, ops, admin]
route: /directory
relatedCode:
  - src/components/Directory.jsx
  - src/lib/directoryAuto.js
  - src/components/DirectoryDisplay.jsx
  - api/reconcile.js
relatedSops: [set-directory-name, create-a-company]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Keep the lobby TV boards showing the right businesses.

## When to do this

A company moves in or out, a name is wrong, or a screen looks stale.

## Before you start

Know which board. There is one per level — **Level 4** and **Level 2** — each edited separately.

## Steps — edit a board

1. Open **Directory** and choose the level.
2. Edit the **suites** list: add, remove, reorder with the up/down controls, and set the display name against each suite number.
3. Save.

## Steps — check what the TV shows

1. Copy the board's public link from the Directory page.
2. Open it in a browser to preview.

The TVs use a **plain-HTML page** rather than the React app, because the older Samsung/Tizen browsers white-screen on the app bundle. The React route still works for previewing on a normal computer.

## Steps — let it build itself

Boards can **auto-sync** from live data — suites from office occupancy, community entries from virtual-office and desk memberships. Turn auto-sync on for a board and it regenerates nightly.

## What happens automatically

- **Auto-sync boards regenerate on the nightly reconcile**, about **6:30am Melbourne**. A change made during the day appears the next morning, not immediately.
- **Hand-edited display text survives** while the occupant is unchanged — so a name you've corrected isn't overwritten by the sync.
- A member's own confirmed **directory name** (from the getting-started link) is preferred over the auto-generated one. See [Set or correct a directory name](../companies-members/set-directory-name.md).
- The TVs poll the board, so a saved change reaches the screens without touching them.
- **The printed board is not automatic.** Nothing updates it.

## Common mistakes

- **Expecting an instant change on an auto-sync board.** It refreshes overnight.
- **Hand-editing a board and assuming it's permanent.** Your text survives while the occupant is unchanged — if the suite changes hands, the sync rewrites it.
- **Forgetting the printed board.** It's the only part with no automation at all.
- **Editing the wrong level.** Level 4 and Level 2 are separate boards.
- **Testing on the React route and assuming the TV works.** The TVs use the plain-HTML page — preview that one.

## If something goes wrong

- **A screen is blank or frozen** — open the plain-HTML link on a computer. If that renders, it's the TV; reboot it.
- **A name is wrong** — check whether the member confirmed their own directory name, since that's preferred over anything generated.
- **A departed company is still showing** — on an auto-sync board it clears overnight once their contract has ended. If their contract is still active, that's the real problem.

## Related

- [Set or correct a directory name](../companies-members/set-directory-name.md)
- [What the nightly reconcile does](../billing/nightly-reconcile.md)

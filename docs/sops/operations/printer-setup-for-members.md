---
slug: printer-setup-for-members
title: Set a member up for printing
category: operations
audience: [reception, ops]
route: /fees
relatedCode:
  - src/portal/PortalGuides.jsx
  - src/app/screens/Printer.jsx
  - src/portal/usePrintPin.js
  - public/downloads
relatedSops: [using-the-member-app, invite-a-member-to-the-portal, add-a-recurring-fee]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Get a new member printing from their laptop and phone, and make sure they can release jobs at the machine.

## When to do this

During induction, or whenever someone says they can't print.

## Before you start

Know which system they need — **there are two, and they are unrelated**:

| System | Where | How they're identified |
|---|---|---|
| **Hexa-Secure** (PaperCut) | Levels 4 & 5 | Print PIN shown in their portal and app |
| **Canon / uniFlow** | Level 2 | A separate PIN, emailed to them separately |

A Level 2 member set up on Hexa-Secure still won't be able to print, and vice versa. Check their floor first.

## Steps — laptop (Hexa-Secure)

1. Get them onto the **Hexa Spaces** Wi-Fi. Printing will not work off it.
2. Send them to the portal → **Guides** → **Printer Setup**. The page detects their OS and leads with the right installer.
3. They download and run:
   - **Mac** — `hexa-printer-mac.dmg`
   - **Windows** — `hexa-printer-windows.exe`
4. Follow the installer prompts. It arrives pre-configured for our print server — there is nothing to type in.
5. Print a test page and choose the **Hexa-Secure** printer.
6. Walk them to the machine and show them how to release the job with their **print PIN**.

## Steps — phone or tablet (Hexa-Secure)

1. On the **Hexa Spaces** Wi-Fi.
2. **iPhone / iPad** — download the printer profile (`hexa-printer-ios.mobileconfig`) from Guides. Settings will ask them to confirm the install.
3. Then: open a document → **Share** → **Print** → choose **Hexa-Secure**.
4. **Android** — install the print app linked on the same page; it comes pre-set to our print server.

## Steps — Level 2 (Canon / uniFlow)

1. Their uniFlow PIN is emailed to them separately — it is **not** the Hexa-Secure PIN.
2. In the uniFlow portal: **Start Printing** tab → **Download driver** (Mac or Windows).
3. Run the installer, open **uniFlow SmartClient**, enter their email, then **Continue** → **Start**.

## Where the member finds their PIN

- **Portal** → Printing
- **Member app** → More → **Printing** — shows the PIN in large type plus their current printing balance

Point them at the app; they'll be standing at the copier when they need it.

## What happens automatically

- Print usage syncs from PaperCut and becomes **fees**, which sweep onto the company's next invoice — see [Add a fee or charge](../billing/add-a-recurring-fee.md). You don't raise print charges by hand.
- The member's PIN and balance are fetched from an owner-scoped endpoint — a member can only ever see their own, never another member's.
- A negative balance shows as owing in the app.

## Common mistakes

- **Setting them up off the Hexa Spaces Wi-Fi.** The installers assume it. Nothing will print and it looks like a driver fault.
- **Giving a Level 2 member the Hexa-Secure steps.** Different system, different PIN, different driver.
- **Reading the print PIN out from an admin screen** instead of showing them where it lives. They'll need it again tomorrow.
- **Raising a print charge manually.** Usage syncs and bills itself; a manual fee double-charges.
- **Sending the installer by email.** Send them to Guides — the page picks the right one for their OS.

## If something goes wrong

- **Installed but no printer appears** — almost always the wrong Wi-Fi. Check that first, then re-run the installer.
- **Prints queue but never release** — they're entering the wrong PIN, or they're on the other print system.
- **No PIN shows in the app or portal** — nothing has synced for that member yet. See the note below.
- **Jobs release but nothing prints** — that's the machine, not the setup. Check paper, toner and the panel.

> **TODO(verify):** confirm PaperCut is live in production. The integration and the member-facing PIN display are built, but the go-live steps were still outstanding in my notes. If the sync isn't running, members will have no PIN and no balance — and this SOP needs a line saying what to tell them in the meantime.

## Related

- [How to use the member app](using-the-member-app.md)
- [Add a fee or charge](../billing/add-a-recurring-fee.md)
- [Invite a member to the portal](../companies-members/invite-a-member-to-the-portal.md)

---
slug: clickshare
title: Barco ClickShare — get a member presenting (Windows and Mac)
category: operations
audience: [reception, ops]
route: /bookings
relatedCode: []
relatedSops: [meeting-room-av, meeting-room-door-access]
version: 2
reviewDue: 2027-02-01
---

## Purpose

Get someone's screen on the meeting-room display, fast, while their meeting is waiting.

## When to do this

A member can't share their screen. Usually two minutes before something starts, with people watching.

## The kit

**Barco ClickShare CX-20.** Two ways to share, both working on Windows and Mac:

- **The Button** — the puck. Plug into the laptop, press, share. No install, no admin rights, no network needed on the member's side. This is the one to reach for.
- **The ClickShare Desktop App** — software instead of a Button. Needs the member on the **Hexa Spaces** Wi-Fi.

**The CX-20 is a *Conference* model.** That's the thing worth knowing, because members ask for it constantly:

> Once a member is sharing via the Button, the room's **camera, microphone and speakers become available to their laptop** — so Teams, Zoom and Meet run off the room's AV instead of their laptop's. One connection, wireless, no cable to the camera.

The CX-20 is Barco's entry Conference unit, built for **huddle and small meeting rooms**, and ships with **one Button** (USB-C, usually with a USB-A adapter in the box). It supports fewer simultaneous connections than the CX-30 or CX-50 — fine for a small room, worth knowing if it's been put in a large one.

> **NEEDS INPUT — quick check:** confirm the label on the unit reads **CX-20**. "CS-20" isn't a Barco model, and the difference matters: if it turns out to be a C-series or CSE unit, it's presentation-only and the camera/mic section below does not apply.

## Which rooms have it

All on **Level 4**, all Button-based, all **USB-C**:

| Room | Rate | Note |
|---|---|---|
| **North** | $60/hr | Part of the Function Space |
| **South** | $60/hr | Part of the Function Space |
| **West** | $60/hr | Part of the Function Space |
| **East - Tea Room** | $120/hr | Separate room — the Chinese tearoom, up to 6 |

**East is not part of the Function Space.** North, South and West combine into it; East is its own room and books independently. See [Why booking one Function Space room blocks the others](../bookings/function-room-conflicts.md).

Note the system name is **"East - Tea Room"**, not "East" — that's what you'll search for in Bookings.

> **NEEDS INPUT:**
> - Do **Sky** and **Earth** (Level 4), or **Sun**, **Moon** and **Central** (Level 2) have ClickShare? If not, say so here — staff need to know before promising wireless in those rooms.
> - When the **Function Space** is booked as one room, which unit drives the display — North's, or a separate one? Members hiring the whole space will ask.
> - How many Buttons per room, and where are spares kept?

## Steps — the Button

1. Plug the Button into the laptop. The Buttons here are **USB-C**. A member on an older Windows laptop with only USB-A will need an adapter — keep some at reception.
2. **Wait for the LED to go solid white.** It's loading a small app off the Button itself. Pressing early is the single most common reason "it doesn't work".
3. If the laptop prompts, run the ClickShare app from the Button. Nothing installs; no admin rights needed.
4. **Press the big button.** The LED goes red and the screen appears.
5. Press again to stop.

### Using the room's camera and mic (this is a CX-20, so this works)

6. With the Button connected, the member opens their meeting in **Teams, Zoom or Meet**.
7. In the meeting app, set **camera** and **speaker/microphone** to **ClickShare** (it may appear as the room name).
   - **Teams** — ⋯ → Settings → Devices
   - **Zoom** — the ^ arrows next to Mute and Stop Video
   - **Meet** — ⋮ → Settings → Audio / Video
8. It is selected **in the meeting app, not in ClickShare**. This trips people up constantly: the Button is connected, the screen is sharing, and they're still on the laptop's own mic because nothing told them to switch.
9. Their laptop lid can stay open — the room camera and their laptop camera are separate devices; the meeting uses whichever is selected.

## Steps — the Desktop App (no Button)

1. Member joins the **Hexa Spaces** Wi-Fi. Without it, the room won't be found.
2. Open the **ClickShare Desktop App**, or go to the address shown on the room display.
3. Pick the room — the name is on the display wallpaper.
4. Enter the **PIN** if the display shows one.
5. Share.

## The failure everyone hits: Buttons are paired to a room

**A Button only works with the Base Unit it was paired to.** Move a Button from Sky into Earth and it will sit there blinking and never connect.

To re-pair: plug the Button into the **USB port on the Base Unit** of the room you want it in, wait for it to confirm, then unplug.

> **NEEDS INPUT:** is the Base Unit reachable in each room, or is it above the ceiling / behind the screen? If it's not reachable, Buttons must not leave their room — and that should be labelled on them.

This is why Buttons should be labelled per room and returned after functions.

## Mac-specific

- macOS asks for **Screen Recording** permission on first use: **System Settings → Privacy & Security → Screen Recording** → tick ClickShare → **restart the app**. Until that's done and restarted, it often *looks* like it's sharing while showing a black screen.
- On Apple Silicon, older ClickShare versions may prompt to install Rosetta. Allow it.

## Windows-specific

- A firewall prompt on first run — allow on **private** networks.
- Black screen but "sharing" is usually the extended-display arrangement: **Win + P** → **Duplicate**.

## Quick triage

| Symptom | Most likely cause |
|---|---|
| Press does nothing | Not loaded yet — wait for solid white |
| LED blinks white forever | Button paired to a different room — re-pair it |
| Black screen but "sharing" | Mac screen-recording permission, or Windows extended display |
| Room not in the Desktop App | Wrong Wi-Fi — must be **Hexa Spaces** |
| LED never lights | USB-C not seated, a dead port, or a dead Button — try another |
| Button from another room won't connect | North, South, West and East each have their own Base Unit — re-pair it |
| Room camera/mic not available | Not selected in the meeting app — see step 7. Selecting it in ClickShare does nothing |
| Others can't hear them | Mic still set to the laptop, not ClickShare |
| Second person can't connect | CX-20 is the entry unit — connection limits are low. One sharer at a time is normal |

**If it isn't fixed in two minutes, stop.** Get them on an HDMI cable and sort the wireless after — see [Meeting-room AV](meeting-room-av.md).

> **NEEDS INPUT:** is there an HDMI cable in every room, and which adapters are kept at reception? This is the single most useful thing to nail down here.

## Common mistakes

- **Pressing before the LED is solid white.**
- **Moving Buttons between rooms.** They stop working until re-paired.
- **Debugging in front of a waiting room.** Cable first, fix after.
- **Assuming the member's Wi-Fi is right** for the Desktop App. Guest network or a phone hotspot is the usual cause.
- **Not restarting the app after granting Mac permission.** The restart is required.
- **Letting Buttons leave after a function.** They walk, and they're expensive.

## If something goes wrong

- **A Button is lost or broken** — log it under Maintenance with the room. Replacements are not cheap.
- **A whole room won't display** — that's AV, not ClickShare. See [Meeting-room AV](meeting-room-av.md).
- **One room fails repeatedly** — log it as a pattern rather than rescuing it daily. A Base Unit that needs a firmware update or a reboot will keep doing it.

> **NEEDS INPUT:** who maintains the ClickShare units — us, the building, or an AV contractor? Base Units occasionally need a firmware update, and it's worth knowing whose job that is before one fails mid-function.

## Related

- [Meeting-room AV](meeting-room-av.md)
- [How meeting-room door access is granted](../spaces-access/meeting-room-door-access.md)

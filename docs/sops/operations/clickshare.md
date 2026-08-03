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

**Barco ClickShare.** Two ways to share, and both work on Windows and Mac:

- **The Button** — the orange puck. Plug into the laptop, press, share. No install, no admin rights, no network needed on the member's side. This is the one to reach for.
- **The ClickShare Desktop App** — software instead of a Button. Needs the member on the **Hexa Spaces** Wi-Fi.

> **NEEDS INPUT:** which Barco model, and in which rooms? It changes what's possible:
> - **CX series** (CX-20 / CX-30 / CX-50) or **ClickShare Bar** — *Conference* models. The Button also passes the room's **camera, mic and speakers** through to the laptop, so Teams and Zoom run off the room's AV. Worth knowing — members ask for this constantly.
> - **C series** (C-5 / C-10) or **CSE** — *Presentation* models. Screen sharing only; the laptop keeps using its own camera and mic.
>
> Also: how many Buttons per room, where they're kept, and USB-C or USB-A?

## Steps — the Button

1. Plug the Button into the laptop. Check the connector — **USB-C or USB-A**, and whether the member's laptop needs an adapter.
2. **Wait for the LED to go solid white.** It's loading a small app off the Button itself. Pressing early is the single most common reason "it doesn't work".
3. If the laptop prompts, run the ClickShare app from the Button. Nothing installs; no admin rights needed.
4. **Press the big button.** The LED goes red and the screen appears.
5. Press again to stop.

### On a Conference model (CX / Bar)

6. Once shared, the member picks the room's camera and speaker in Teams or Zoom — usually offered automatically as **ClickShare** or the room's name.
7. If the meeting still uses the laptop's own mic, it's selected in the meeting app's audio settings, not in ClickShare.

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
| LED never lights | Wrong port or a dead Button — try another |
| Camera/mic not available | Presentation-only model, or not selected in Teams/Zoom |

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

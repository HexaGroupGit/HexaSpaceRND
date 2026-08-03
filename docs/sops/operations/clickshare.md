---
slug: clickshare
title: ClickShare — get a member presenting (Windows and Mac)
category: operations
audience: [reception, ops]
route: /bookings
relatedCode: []
relatedSops: [meeting-room-av, meeting-room-door-access]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Get someone's screen on the meeting-room display, fast, while their meeting is waiting.

## When to do this

A member can't share their screen. Usually two minutes before something starts, with people watching.

> **NEEDS INPUT — this is the important one.** Which ClickShare model is installed, and in which rooms? The procedure differs between the Button (physical USB dongle) and the app-only models, and between generations. Answer this and the steps below become exact rather than general.
>
> - Model / generation (e.g. CX-30, C-5, CSE-200):
> - Which rooms have it (Sky, Earth, Sun, Moon, North, South, West, Function Space?):
> - Are there physical Buttons, or app-only, or both?
> - How many Buttons per room, and where are they kept?

## Steps — with a Button (USB dongle)

1. Member plugs the Button into their laptop — **USB-C or USB-A**, check which the room has.
2. Wait for the Button's ring light to go **solid white**. It's loading a small app off the dongle.
3. If the laptop asks, run the ClickShare app from the Button. **No install and no admin rights needed** — this is why the Button exists.
4. Press the big button on the dongle. Screen appears on the display.
5. Press again to stop sharing.

Works the same on Windows and Mac.

## Steps — app or wireless (no Button)

1. Member joins the **Hexa Spaces** Wi-Fi. It will not find the room otherwise.
2. Open the ClickShare **Desktop App**, or go to the address shown on the room display.
3. Pick the room — the name is on screen.
4. Enter the PIN if the display shows one.
5. Share.

> **NEEDS INPUT:** do the rooms show a PIN? And is the Desktop App pre-installed on anything, or does each member install their own?

## Mac-specific

- macOS will ask for **Screen Recording** permission the first time: **System Settings → Privacy & Security → Screen Recording** → tick ClickShare, then **restart the app**. It will not share until this is granted, and the app often looks like it's working while showing a black screen.
- On Apple Silicon the app may ask to install Rosetta depending on version.

## Windows-specific

- Windows may show a firewall prompt on first run — allow it on **private** networks.
- If the display shows a black screen, it's usually a second-monitor arrangement problem: **Win + P** → Duplicate.

## Quick triage when it won't work

| Symptom | Most likely |
|---|---|
| Nothing happens when the Button is pressed | Not fully loaded — wait for solid white |
| Black screen but "sharing" | Mac screen-recording permission, or Windows extended display |
| Room not listed in the app | Wrong Wi-Fi — must be **Hexa Spaces** |
| Button won't light at all | Try the other USB port / adapter, then a different Button |
| Audio not carrying | Sharing sends video only unless audio is enabled in the app |

**If it isn't fixed in two minutes, stop debugging.** Get them presenting on an HDMI cable and sort the wireless afterwards — see [Meeting-room AV](meeting-room-av.md).

> **NEEDS INPUT:** is there an HDMI fallback cable in each room? That's the single most useful thing to know here.

## Common mistakes

- **Debugging in front of a waiting room.** Fall back to cable, fix later.
- **Assuming the member's Wi-Fi is right.** Guest or phone hotspot is the usual cause.
- **Not granting Mac screen recording, then restarting the app.** The restart is required.
- **Handing over a Button without checking the port.** USB-C laptop, USB-A Button, no adapter.
- **Leaving Buttons in the room after a function.** They walk.

## If something goes wrong

- **A Button is lost or broken** — log it under Maintenance and note the room. They're not cheap.
- **A whole room won't display** — that's AV, not ClickShare. See [Meeting-room AV](meeting-room-av.md).
- **It fails repeatedly in one room** — log it as a pattern rather than fixing it ad hoc each time.

## Related

- [Meeting-room AV](meeting-room-av.md)
- [How meeting-room door access is granted](../spaces-access/meeting-room-door-access.md)

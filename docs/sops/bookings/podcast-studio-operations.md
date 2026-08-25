---
slug: podcast-studio-operations
title: Podcast studio — running a session end to end
category: bookings
audience: [studio-operator, reception, ops, admin]
route: /studio-requests
relatedCode:
  - src/lib/studio.js
  - src/components/StudioRequests.jsx
  - src/portal/StudioRequestModal.jsx
  - api/studio-request.js
  - api/studio/notify-request.js
relatedSops: [how-members-book-rooms, meeting-room-av]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Run a podcast studio session from request to file handover without losing a
recording or double-booking an operator.

Source of truth for the technical settings is the **Olivecast Studio Operations
Guide v1.0 (24 Aug 2026)**; this SOP is the operational wrapper around it and
the platform workflow.

## Why the studio is different

Meeting rooms are self-service: a member books, their pass opens the door, done.
The podcast studio **cannot work that way** — every session needs an operator on
site running three cameras, the audio desk and the lighting, plus a media
handover afterwards. So the studio is **request-to-book**:

| | Meeting room | Podcast studio |
|---|---|---|
| Booking | Instant | Request → staff approval |
| Status on creation | `Confirmed` | `Pending` |
| Door access | Automatic | Only once approved |
| Charged | On booking | On approval |
| Hours | Member's window | 9:00–17:00 weekdays only |

A `Pending` booking **holds the slot** (so two people can't both be approved for
it) but grants **no door access** — the Salto sweep only ever acts on
`Confirmed` bookings.

## 1 · A request arrives

Requests come from three places, and all three land in the same queue at
**Admin → Studio Requests**:

- **Member portal** — Studios page, pick a slot → questionnaire → policy tick.
- **Website** — hexaspace.com.au/podcast-studio → request form (creates a
  drop-in client record; no member account needed).
- **Admin** — Bookings → New Booking, choosing the studio and status `Pending`.

Ops (eric@ + info@) are emailed with the questionnaire and a review link.

## 2 · Review it — the same day if you can

Open the request in **Studio Requests**. Before you touch a button, check:

1. **Can an operator cover the slot?** This is the whole reason approval exists.
   Never approve a session nobody can staff.
2. **Does the booking fit the recording?** The drawer flags this. A one-hour
   booking leaves about **15 minutes** of recording once ~30 min setup and
   ~15 min transfer are allowed for. If they've asked for 45 minutes of
   recording in a one-hour slot, **propose a longer session** rather than
   approving and having the conversation on the day.
3. **Own cards or ours?** Determines what you install before they arrive.
4. **Policy accepted?** Should show green. If it doesn't (an admin-created
   booking), confirm the terms with the client before approving.

Then choose:

- **Approve & confirm** — status becomes `Confirmed`, door access is scheduled
  automatically, and the client gets their confirmation **plus the guest
  recording guide** in one email they can forward to guests.
- **Propose another time** — moves the slot, stays `Pending`, emails them the
  new time. Still their call.
- **Decline** — frees the slot immediately and emails your reason. Give them
  something actionable ("no operator Tuesday morning, but Thursday 10am is
  free"), not just "unavailable".

> Requests unanswered after **48 hours** are flagged at the top of the queue.
> Someone is holding a slot and planning around it — answer it.

## 3 · Before the client arrives (opening checks)

From the Operations Guide §1 and §4–§6. Do these **before** they walk in, not
while they watch:

- Unlock the studio; check for damage since last use.
- Power on PC, display and the audio console.
- All three cameras on, each with a **formatted, empty** card in it — confirm,
  never assume.
- Camera power (dummy batteries) connected and stable.
- Capture cards connected; all three feeds visible in OBS.
- Both microphones connected; levels showing on the console.
- Key lights and accent lighting on, at the documented preset (4500K).
- Framing and focus set on each camera to the studio marks.
- **10-second test record on all three cameras + audio, then play it back.**
- Confirm free space on every card.
- Tidy the table, chairs and background.

Set from the questionnaire: number of seats and mics, card set (studio vs
client), and anything in "special requirements".

## 4 · The session

- Brief the guests: mic distance, staying in the marked area, moving slowly,
  and that they should ask the operator rather than touching anything.
- **Start all three cameras and the audio together.**
- Monitor levels for clipping and the feeds for focus/framing drift.
- Adjust gain only between sentences, never mid-sentence.
- Do not move a camera mid-record unless something is genuinely broken.
- Watch remaining card space.
- **Stop everything together** at the end, and confirm each device wrote its file.

If something goes wrong mid-session: **prioritise not losing the recording over
fixing the problem perfectly.**

## 5 · Media handover — the golden rule

> **Never format or reuse a card until the recording is copied to two separate
> locations and verified.**

1. Don't remove a card until the device has fully stopped writing.
2. Copy everything into `Client Name > Date > Camera 1 / 2 / 3 / Audio`.
3. Copy the same files to the **second** location (backup drive/SSD).
4. **Open at least one file from each card** and confirm it plays.
5. Hand the client their files — their own drive if they brought one, their own
   cards back if they supplied them.
6. Only now may a studio card be formatted for reuse.
7. Reinstall the labelled studio card set ready for the next booking.
8. Log which card was used for which booking.

Never hand a client a card that also holds studio or another client's footage.

Record the outcome on the booking (card set used, transfer verified, handed
over, retention date). Working copies are kept **14 days**, then deleted — tell
the client that window so they can check they have everything.

## 6 · Close-out

- Confirm every recording is transferred and backed up.
- Remove and store the cards used.
- Power down cameras, console, lighting and display.
- Log out of all accounts on the PC.
- Tidy cables; return furniture to the standard position.
- Lock up and set building security.

## Common failures and what to do

| Symptom | Likely cause | Do this |
|---|---|---|
| No video in OBS | Capture card / cable | Check power and HDMI/USB, reseat the capture card, restart OBS |
| No audio | Mic unplugged or muted | Check XLR to the console, input assignment, mute state |
| Audio too quiet | Gain low / mic placement | Reposition the mic, raise gain, retest |
| Audio clipping | Gain too high | Lower gain and retest before continuing |
| Card full mid-session | Space not checked | Follow the card-change procedure calmly; always check space first |
| Card not recognised | Seating / compatibility | Power down safely, reseat, test a known-good card |
| File missing after recording | Not stopped properly | Confirm the recording stopped; check the card in the right device |
| Guest drifts out of frame | Marks not explained | Remind them of the marked area; only adjust framing if you must |
| "Can I have the files now?" | Timing not set at booking | Explain the transfer time — and make sure it's said at request stage |

> **Never format or delete a card to solve a problem** until the files on it are
> confirmed backed up somewhere else.

## Standing reminders

- Check equipment before the client arrives, not after.
- Never assume a card is empty — confirm it.
- Communicate timing at booking, not during the session.
- Setup time is *inside* the client's booking. Say it early, say it twice.

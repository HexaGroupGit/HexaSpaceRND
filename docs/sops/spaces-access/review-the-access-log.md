---
slug: review-the-access-log
title: Review the access log after an incident
category: spaces-access
audience: [ops, admin]
route: /access-log
relatedCode:
  - src/components/AccessLog.jsx
  - api/salto/open-log.js
  - api/salto/open.js
  - api/salto/open-callback.js
relatedSops: [revoke-salto-access, meeting-room-door-access]
version: 1
reviewDue: 2027-02-01
---

## Purpose

See who remotely unlocked which door, and when.

## When to do this

An incident, a dispute, a complaint about access, or a check that a departed member really is locked out.

## What it does and does not cover

**It covers remote unlocks from the member app only** — someone tapping to open a door in the app.

It does **not** cover fob taps, card presentations, or anyone physically opening a door with a credential. Those live in Salto KS, not here.

For a full picture of a real incident you need **both** this log and the KS audit trail.

## Steps

1. Open **Access Log**.
2. Filter by **Result**:
   - **Opened** — confirmed open
   - **Dispatched (unconfirmed)** — the request was sent but never confirmed back
   - **Failed** — the door system rejected it
   - **Mock** — a test, not a real unlock
3. Read the columns: **Time**, **Member**, **Company**, **Door**, **Type** (Office, Building entry or Meeting room) and **Result**. Meeting-room rows also show the booking reference.
4. Click **Refresh** for the latest — it is not live-updating.
5. For anything serious, take the KS audit trail as well.

## What happens automatically

- A row is written as **dispatched** the moment a member taps, then settled to **opened** or **failed** by the door system's callback.
- The log holds up to 300 recent entries in the view.
- The underlying table is **deny-all** at the database level and can only be read through an admin endpoint — it is not reachable from a browser session, which is what you'd want of an access record.

## Common mistakes

- **Treating this as the complete access record.** Fob and card entries are not here.
- **Reading "dispatched" as "didn't open".** It means we never got confirmation — the door may well have opened.
- **Counting mock rows as real.** They're tests.
- **Assuming empty means nobody entered.** It means nobody used the app's remote unlock.
- **Using it as proof in a dispute without KS.** Take both.

## If something goes wrong

- **Nothing loads** — the endpoint is admin-only. Confirm you're signed in as an admin.
- **A departed member appears after their end date** — treat as a security incident: revoke in Salto KS immediately, then tell Eric the same day.
- **Lots of Failed rows for one member** — their KS access is likely wrong. See [Provision Salto access](provision-salto-access.md).
- **You need history beyond what's shown** — the view is capped. Ask Eric for a fuller extract.

## Related

- [Revoke Salto access on move-out](revoke-salto-access.md)
- [How meeting-room door access is granted](meeting-room-door-access.md)

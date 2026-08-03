---
slug: event-booking-agreements
title: Event booking agreements and insurance
category: bookings
audience: [ops, admin]
route: /event-bookings
relatedCode:
  - src/components/EventBookings.jsx
  - src/components/EventBookingSignPage.jsx
  - api/event-bookings/upload.js
  - event-insurance-storage.sql
relatedSops: [run-an-event, function-space-pipeline]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Get an external event vendor signed up and insured before they use the space.

## When to do this

An external party — a vendor, a partner, an outside organiser — is running something in our space and needs an agreement and proof of insurance.

## The stages

The booking runs through signing, then insurance:

| Status | Meaning |
|---|---|
| **Insurance Pending** | Signed, waiting on their certificate of currency |
| **Complete** | Insurance received, agreement fully executed |

## Steps

1. Open **Event Bookings** and create or open the booking.
2. Send it to the vendor for signature. They sign on their own public link.
3. The vendor uploads their **insurance certificate** through the same flow.
4. Once insurance is in, **countersign**. This is the step that finalises it.
5. Check the fully executed agreement PDF is generated and emailed to the vendor.
6. If the certificate hasn't arrived, send an **insurance reminder**.

## What happens automatically

- Countersigning generates the fully executed agreement PDF, stores it, and **emails it to the vendor**.
- The stored PDF is linked from the booking, and the app checks the link still resolves — if it doesn't, you can regenerate it.
- Reminders can be sent for both the signature and the insurance certificate.
- Uploads go to a dedicated storage bucket, and vendors upload **without logging in** — which is the point, since they're not members.

## ⚠ Uploaded documents are publicly readable

The insurance storage bucket is **public**, with anonymous upload allowed and public read. Anyone holding the file's URL can read an uploaded certificate without signing in.

That's a deliberate trade to let vendors upload with no account, but it means:

- Don't ask vendors to upload anything beyond the insurance certificate.
- Don't put anything sensitive in that bucket.
- Treat the URLs as semi-public.

> **TODO(verify):** confirm this is still the intended posture. `event-insurance-storage.sql` creates the bucket with `public: true` plus an `anon_upload` policy and a `public_read` policy. If certificates should be private, this needs signed URLs and a policy change — worth a decision rather than leaving it implicit.

## Common mistakes

- **Letting the event run before insurance is in.** *Insurance Pending* means we're not covered.
- **Countersigning before the certificate arrives.** Countersigning finalises the agreement.
- **Assuming the vendor got the executed copy.** Check the email went — and check safe mode.
- **Using this for a paid function hire.** A function booking has its own pipeline, pricing and deposit.
- **Uploading anything sensitive** to the insurance bucket.

## If something goes wrong

- **The agreement PDF link is broken** — regenerate it from the booking.
- **The vendor can't upload** — their link may have expired; reissue it.
- **The vendor says they never got the executed agreement** — re-send, and check safe mode first.
- **The event is tomorrow and there's no insurance** — that's a decision for Eric, not a workaround.

## Related

- [Run an event](run-an-event.md)
- [Function space — enquiry to confirmed](function-space-pipeline.md)

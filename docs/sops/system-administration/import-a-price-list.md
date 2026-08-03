---
slug: import-a-price-list
title: Import a price list and bulk-upload photos
category: system-administration
audience: [ops, admin]
route: /spaces
relatedCode:
  - src/components/PriceListImport.jsx
  - src/components/BulkPhotos.jsx
  - api/parse-pricelist.js
relatedSops: [add-or-edit-a-space, escalation]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Update many space rates at once, and attach photos to spaces in bulk.

## When to do this

An annual rate review, or a batch of new photography.

## Before you start

**Both of these change many records at once.** Know what you're importing, and do it when you can check the result — not last thing on a Friday.

## Steps — import a price list

1. Open **Spaces** and click **Import price list**.
2. Provide the price list.
3. Review what it parsed **before** applying — this is the step that matters.
4. Apply.
5. Spot-check several spaces across different types and floors against the source.

## Steps — bulk photo upload

1. Open the bulk photo tool from Settings.
2. Upload the images and match them to spaces.
3. Check a few spaces show the right photo.

## What happens automatically

- The import updates the monthly rate on matched spaces.
- **Office rates normally auto-compute** from floor × placement × pax. An imported rate overrides that until one of those fields is edited, which recomputes it — so an imported rate can be silently replaced later by editing pax or placement.
- Level 2 and Levels 4&5 code to **different Xero accounts**, so a rate applied to the wrong floor lands in the wrong account.
- Rates feed the contract form's list price, so an import changes what new contracts default to. **Existing contracts keep their agreed pricing.**

## Common mistakes

- **Applying without reviewing the parse.** Wrong matches are much harder to unpick afterwards.
- **Importing rates including GST.** Everything here is ex GST.
- **Assuming existing contracts update.** They don't, and shouldn't — those prices were agreed.
- **Editing an office's pax or placement after an import** and overwriting the imported rate without noticing.
- **Bulk-uploading photos without checking the matching.** A photo on the wrong suite goes out on proposals and listings.

## If something goes wrong

- **Rates are wrong after an import** — there's no undo. Correct the affected spaces by hand and tell Eric how many were touched.
- **A space didn't match** — its identifier in the file doesn't match the record. Fix it by hand.
- **A published listing shows the wrong price** — fix the space, then re-check the listing.

> **TODO(verify):** confirm the exact file format the price-list import expects (CSV? XLSX? column headers?) and where the bulk photo tool lives in the UI. `PriceListImport.jsx` and `parse-pricelist.js` handle the parse, and `BulkPhotos.jsx` is referenced from Settings, but I did not establish the input format or the click-path — both need pinning before anyone follows these steps unsupervised.

## Related

- [Add or edit a space](../spaces-access/add-or-edit-a-space.md)
- [Escalation](escalation.md)

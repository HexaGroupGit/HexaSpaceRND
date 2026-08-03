---
slug: update-terms-template
title: Update the T&C template and version
category: contracts
audience: [admin]
route: /templates
relatedCode:
  - src/components/Templates.jsx
  - src/lib/termsVars.js
  - src/components/ContractForm.jsx
relatedSops: [create-a-contract, send-contract-for-e-signature]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Change the Terms & Conditions, House Rules or another contract document, and version it so you can tell which contracts were signed against which text.

## When to do this

A clause changes, a policy is added, or a legal review requires an update. This is admin work — it changes what every future client signs.

## Before you start

- Know what is changing and why. The current membership T&Cs are at v2.1 (updated 13 July 2026: the 2-business-day card-charge notice reinstated in 7(i), and a new 2(d) making the page-1 Minimum Notice govern).
- Decide the new version string before you start editing.

## Steps

1. Open **Templates**. The **Documents** tab is selected by default; **Emails** is a separate tab and must never be attached to an agreement.
2. Click the document row to open it (or the pencil icon).
3. Update the **Version** field — e.g. `v2.1` → `v2.2`. This is a free-text field; nothing increments it for you.
4. Edit the body in the **Content** editor. Use headings for section titles and body text for clauses — the PDF generator renders headings, paragraphs and lists, and ignores anything else.
5. Click **Save Changes**.
6. Open any contract, click **Template View**, and read the document through to check it renders as intended.
7. Generate a PDF from a test contract and check the pagination — each attached document starts on a fresh page with its name as the heading.

## What happens automatically

- **The change is live immediately, for every contract that references this template** — including contracts already signed. There is no snapshot. A previously signed contract's regenerated PDF will show the *new* text.
- Templates are attached to a contract by ID, so renaming or re-versioning does not detach them.
- The **Last Updated** date on the Templates list is stamped for you.
- **Placeholders in the document body are filled at render time** from Settings, in both the on-screen Template View and the generated PDF.
- The client's signing page shows Terms & Conditions and House Rules as compulsory read-through steps, matched by name (anything matching *terms*, then anything matching *house rules*). It prefers the versions attached to that contract and falls back to the global documents.

## Common mistakes

- **Editing the text without changing the Version.** You then cannot tell which text a client signed. Change the version every time the wording changes.
- **Treating a version bump as re-papering.** Existing members are not asked to re-sign and are not notified. If the change materially affects them, that is a separate communication — check with Eric.
- **Editing an Email template thinking it is a document.** They are separate tabs with separate purposes; email templates are explicitly filtered out of contract attachments and PDFs.
- **Naming a document so it no longer matches *terms* or *house rules*.** It then loses its slot in the client's read-through sequence and becomes just another attachment.
- **Deleting a template that contracts reference.** The attachment on those contracts becomes a dangling ID and the document silently drops out of their PDF.

## If something goes wrong

- **The PDF shows raw `{{placeholders}}`** — the value is missing from Settings. Check Settings, don't hard-code it into the document.
- **A clause renders as a wall of text** — the PDF renderer only handles headings, paragraphs and lists. Tables and other markup are dropped.
- **You need the text as it stood at a past date** — there is no version history in the app. Recover it from git, or from a signed PDF attached to a past contract email.
- Anything with legal consequence: Eric approves before it goes live.

## Related

- [Create a contract](create-a-contract.md)
- [Send a contract for e-signature](send-contract-for-e-signature.md)

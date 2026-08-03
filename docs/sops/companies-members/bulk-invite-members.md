---
slug: bulk-invite-members
title: Bulk-invite members to the portal
category: companies-members
audience: [ops, admin]
route: /members
relatedCode:
  - src/components/MigrationPanel.jsx
  - api/auth/bulk-invite.js
  - api/auth/adoption.js
  - src/components/Tenants.jsx
relatedSops: [invite-a-member-to-the-portal, add-a-member]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Get a whole cohort onto the portal in batches, without double-sending and without losing track of who has actually signed up.

## When to do this

Migration pushes, or a periodic sweep to catch members who were added but never invited.

## Before you start

Know which of the two tools you want — they invite different populations:

| Tool | Where | Invites |
|---|---|---|
| **Portal migration** panel | Top of the **Members** page | **Members** (people), batched, with reminders and a roster |
| **✉ Bulk Portal Invite** | **Companies** page header | **Company email addresses**, one pass, no reminders |

The migration panel is the one to use for people. The Companies button is a blunter tool aimed at company-level inboxes.

## Steps — Portal migration panel

1. Open **Members**. The **Portal migration** panel sits above the list.
2. Read the four counters: **Active members**, **Registered (n%)**, **Invited, awaiting**, **Not yet invited**.
3. Click **Invite next batch (n)** and confirm. Up to **25** emails go per run.
4. Wait for the green result line: *Sent n invites … n left for the next batch*.
5. Repeat until **Not yet invited** reaches zero.
6. Later, click **Remind un-registered (n)** to nudge people who were invited but never signed in.
7. Click **View who's registered** to open the roster. Filter by **All**, **Signed up**, **Awaiting sign-up** or **Not invited**.
8. For one person, click **Resend** on their row — that sends a fresh set-password link.

## Steps — Bulk Portal Invite (companies)

1. Open **Companies** and click **✉ Bulk Portal Invite**.
2. Confirm *Check all N companies and invite any not yet on the portal?*
3. Read the result panel: invites sent, already active, already invited, and any failures by name.

## What happens automatically

- **Batches are capped at 25** to stay inside the server's time limit. This is why you have to run it repeatedly — it is not an error.
- Every invited member is stamped, so re-running never double-sends to the same person.
- **Reminders unlock 3 days after the invite**, and re-unlock 3 days after each reminder. The button is disabled until someone qualifies — hover it for the explanation.
- Invite and reminder wording comes from the editable templates, with `{{firstName}}` and `{{businessName}}` filled at send time.
- **Registered** means the person has actually signed in at least once — not merely that an invite was sent.
- The Companies-page tool checks each company's status first and only invites those showing *not invited*.

## Common mistakes

- **Running one batch and assuming you're done.** Check the **Not yet invited** counter and keep going.
- **Hammering Remind.** It won't send until the 3-day window opens; clicking more doesn't help.
- **Reading "Invited" as "on the portal".** Invited means the email went out. Only **Registered** means they got in.
- **Using the Companies bulk button for people.** It targets company email addresses, which are often an accounts inbox — not the members who need access.
- **Bulk-inviting before the member records are right.** Anyone with a wrong or missing email is a wasted send and a support call.

## If something goes wrong

- **Failures listed in the result** — usually a bad address. Fix the member record and use the per-row **Resend**.
- **Someone got two emails** — an invite and a reminder are different messages; that is expected. Genuine duplicate invites are not, so tell Eric if you see one.
- **The panel doesn't appear** — it only renders once the adoption data loads. Click the refresh icon.
- **Registered numbers look stuck** — people often don't act for days. Chase individually via the roster before re-running a batch.

## Related

- [Invite a member to the portal](invite-a-member-to-the-portal.md)
- [Add a member to a company](add-a-member.md)

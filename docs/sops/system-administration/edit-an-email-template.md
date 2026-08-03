---
slug: edit-an-email-template
title: Edit an email template and use placeholders
category: system-administration
audience: [ops, admin]
route: /templates
relatedCode:
  - src/components/Templates.jsx
  - src/lib/sendEmail.js
relatedSops: [update-terms-template, safe-mode, email-not-arriving]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Change the wording of an automated email without a code change.

## When to do this

The wording is wrong, out of date, or off-brand. These emails go to clients — treat edits as publishing.

## Steps

1. Open **Templates** and switch to the **Emails** tab. (**Documents** is the other tab — contract terms, never emails.)
2. Click the template row to open it.
3. Set the **Email type** if you're creating a new one — it decides *when* the template is used. There are around twenty: onboarding, e-sign, signed contract, proposal, tour confirmations, lead follow-ups, function emails, overdue warnings, renewal confirmations.
4. Update the **Version** if the change is material.
5. Edit the **Subject line**.
6. Edit the **HTML** in the left pane. The right pane shows a live **Preview** with sample data.
7. Click **Save Changes**.

## Placeholders

Each email type lists **its own** supported placeholders directly under the subject field — e.g. `{{company}}`, `{{tenantName}}`, `{{unit}}`, `{{contract}}`, `{{signLink}}`, `{{portalUrl}}`.

Use only the ones listed for that type. The preview fills them with sample data so you can see the result.

## What happens automatically

- **The change is live immediately** for every future send of that type.
- If no template exists for a type, the system falls back to a **built-in default** — so deleting a template doesn't break the email, it reverts it.
- Placeholders are filled at send time from live data.
- Email templates are explicitly excluded from contract PDFs and attachments, so they can never leak into an agreement.

## Common mistakes

- **Editing the wrong type.** There are twenty-odd, several similarly named. Check the type, not just the title.
- **Using a placeholder that isn't listed** for that type. It won't fill.
- **Breaking the HTML.** The preview is the check — use it before saving.
- **Editing a document template on the Emails tab** or vice versa. Different tabs, different purposes.
- **Testing with safe mode off.** Test sends go to real clients.
- **Deleting a template to "reset" it.** That works — it falls back to the built-in — but say so, or the next person will think it vanished.

## If something goes wrong

- **The email renders badly** — compare against the preview; the usual cause is unclosed HTML.
- **A placeholder shows literally as `{{something}}`** — it isn't supported for that type, or the value is missing from Settings.
- **You need the previous wording** — there's no version history in the app. Recover it from git.
- **The wrong email went out** — you can't unsend. Fix the template, then decide whether a correction is warranted.

## Related

- [Update the T&C template and version](../contracts/update-terms-template.md)
- [Safe mode](../start-here/safe-mode.md)
- [What to do when an email doesn't arrive](email-not-arriving.md)

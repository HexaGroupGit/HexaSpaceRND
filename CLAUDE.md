# Hexa Space Management System

## About Hexa Space
Hexa Space (Hexa Space Pty Ltd) is a business infrastructure platform at 402/830 Whitehorse Road, Box Hill VIC 3128, Melbourne, Australia.
Website: hexaspace.com.au · Admin + member portal: portal.hexaspace.com.au
Brand is "Hexa Space" everywhere — never "HexaHub" (old name; members.hexaspace.com.au still points at OfficeRND until cutover, so don't link to it).
Slogan: "build locally, scale sustainably"

## What We're Building
A lightweight space and lease management platform — a simpler version of OfficeRND.
No backend required. All data stored in localStorage. Built with React + Vite + Tailwind CSS v4.

## Stack
- React 19 + Vite 8
- Tailwind CSS v4 (via @tailwindcss/vite plugin — no tailwind.config.js needed)
- react-router-dom v7
- jsPDF + jspdf-autotable for PDF generation
- date-fns for date formatting
- lucide-react for icons

## Space Types
- Warehouse Units (operational base, fulfilment) — $2,600–$5,000/month
- Coworking Desks (Hexa Space) — individual desk memberships
- Private Offices (Hexa Space) — small team offices
- Pop-up/Retail Bays (369/878 locations) — short-term brand showcase spaces

## Core Modules
1. Dashboard — occupancy rate, active leases, expiring soon, revenue summary
2. Tenants — add/edit tenant profiles (business name, contact, ABN, industry)
3. Spaces — inventory of all units with status (occupied/vacant/reserved)
4. Leases — create leases linking a tenant to a space with start/end dates and rent
5. Agreements — generate a branded PDF lease agreement document
6. Renewals — flag leases expiring within 60 days

## Brand Colors
- Primary: Black (#000000)
- Secondary: White (#FFFFFF)
- Accent: Light gray (#F5F5F5)
- Text: Dark gray (#1A1A1A)

## Data Models

### Tenant
- id, businessName, contactName, email, phone, abn, industry, country, createdAt

### Space
- id, unitNumber, type (warehouse/desk/office/popup), size, monthlyRate, status (vacant/occupied/reserved), location (huntingdale/lonsdale/whitehorse)

### Lease
- id, tenantId, spaceId, startDate, endDate, monthlyRent, bondAmount, status (active/expired/pending), notes, createdAt

## Building & Testing (ECC toolkit)
A curated subset of [ECC](https://github.com/affaan-m/ecc) (MIT, see `.claude/ECC-LICENSE`) lives in `.claude/`. Use it — don't reinvent:
- **Skills:** `react-patterns` (components/hooks), `vite-patterns` (config, dev proxy), `postgres-patterns` + `database-migrations` (Supabase SQL/RLS in `migrations/`), `security-review` (anything touching auth, RLS, payments, public `/api` endpoints), `error-handling`, `e2e-testing`, `verification-loop`.
- **Agents:** `code-reviewer` + `react-reviewer` before pushing UI changes; `database-reviewer` before running a migration; `security-reviewer` for auth/Stripe/public endpoints; `silent-failure-hunter` for swallowed errors (unawaited sends, lazy Supabase builders); `build-error-resolver` when `vite build` / Vercel fails; `e2e-runner` for click-through tests.
- **Rules:** `.claude/rules/ecc/react` + `web` load only for `.jsx`/`.css` work. ECC's `rules/common` (mandatory TDD, 80% coverage) is deliberately NOT installed — this repo has no unit-test suite.

Workflow for every change:
1. `npx vite build` must pass.
2. Test the real behaviour, not just the build: run `npx vite` (start it from `C:\Hexa-Space-RND` — a lowercase `c:` cwd breaks module serving) and click through with Playwright (`playwright-core` + system Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`). Sign in as admin without sending email: service-role `auth.admin.generateLink({type:'magiclink'})` → anon `verifyOtp({type:'magiclink', token_hash})` → put the session in localStorage under `sb-<project-ref>-auth-token`.
3. Use throwaway records (e.g. `ZZTEST…` ids) and delete them afterwards. Never create test invoices — the Xero sync pushes them.
4. Commit only the files you changed, then push to `main` — Vercel deploys from main. Confirm the new code is in the live bundle.

## Design Style
Clean, minimal, professional. Black and white primary palette. Use Tailwind utility classes.
No rounded-pill buttons — use slightly rounded corners (rounded-md).
Tables for data, cards for summaries. All dates in DD/MM/YYYY format (Australian).

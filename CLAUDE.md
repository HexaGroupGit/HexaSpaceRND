# HexaHub Management System

## About HexaHub
HexaHub is a business infrastructure platform at 7 Distribution Circuit, Huntingdale 3166, Melbourne, Australia.
Website: hexahub.com.au
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

## Design Style
Clean, minimal, professional. Black and white primary palette. Use Tailwind utility classes.
No rounded-pill buttons — use slightly rounded corners (rounded-md).
Tables for data, cards for summaries. All dates in DD/MM/YYYY format (Australian).

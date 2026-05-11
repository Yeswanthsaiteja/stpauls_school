# Benita ERP — PRD

## Original Problem Statement
Build a production-ready, multi-tenant **School ERP SaaS Web Application** named **Benita ERP** (subtitle: *Institutional Management Suite*) for schools with ~700 students. Tech stack: React 18 + Tailwind + framer-motion + recharts + lucide-react + react-router + react-i18next; Firebase (Firestore + Auth + Storage); Gemini for AI insights; Vercel hosting.

## User Choices (Feb 2026)
- **Backend / DB**: Firebase (Firestore + Auth + Storage)
- **Auth**: Firebase Auth (with Demo Mode fallback so app is explorable without keys)
- **AI Model**: Gemini 3 Flash (proxied through FastAPI `/api/ai/insights` using Emergent Universal LLM Key)
- **MVP Scope**: Strong core first — Login, Admin Dashboard, Students+Admission, Parent Dashboard, Academic basics, Finance basics, Communication, Settings
- **i18n**: English + Telugu

## Architecture
- **Frontend**: React 18 (CRA + JSX), Tailwind CSS, framer-motion, recharts, lucide-react, react-router v6, react-i18next, sonner, Firebase SDK v12
- **Backend**: FastAPI + emergentintegrations (proxy for Gemini 3 Flash insights only). MongoDB used for `status` checks.
- **Demo Mode**: When Firebase env vars are blank, app uses `DEMO_USERS` + `demoStore` (localStorage + seed data) so the entire UX can be explored end-to-end.

## Personas
1. **Super Admin / School Admin** — full operational dashboard, finance, attendance, CRM, settings
2. **Staff / Teacher** — limited dashboard, students, academic, communication, CRM
3. **Parent / Guardian** — child-specific portal (diary, announcements, finance, attendance, results, syllabus, etc.)

## What's Implemented (Feb 2026)
- ✅ Login page with animated gradient hero, role visual selector, EN/TE toggle, demo auto-fill
- ✅ DashboardLayout (collapsible sidebar, top navbar, banners, subscription expired overlay)
- ✅ Admin Dashboard — 5 stat cards, revenue area chart, recent activity, AI Insights via Gemini 3 Flash, communication log card
- ✅ Staff Dashboard — 4 stats + reminders + activity + notifications
- ✅ Parent Dashboard — student banner, progress, 10 module tiles + Announcements / Results / Syllabus / Attendance / Finance sub-pages
- ✅ Students Module — landing + Admission Form (5-step wizard) + Directory + recent admissions table + bulk-import scaffold
- ✅ Academic Module — landing + Subjects/Topics with progress
- ✅ Finance Module — module cards + category donut chart + transactions + WhatsApp fee reminders + Razorpay placeholder
- ✅ Employees Module — presence matrix + roster
- ✅ Attendance Module — landing + 7-day engagement bar chart
- ✅ Communication Center — Announcements list + compose
- ✅ CRM Panel — stats by status, filters, status updater, new-ticket modal
- ✅ Settings — profile, tenant info, theme/lang toggles, change password
- ✅ Multi-tenant context with subscription expiry banner (≤30d) + full lockout overlay (expired)
- ✅ i18n EN + TE
- ✅ Dark/Light theme persisted to localStorage
- ✅ Backend `/api/ai/insights` (Gemini 3 Flash via Emergent Universal LLM Key)

## Backlog (P0/P1/P2)
**P0**
- Wire real Firebase config (user provides `firebase-applet-config.json`) — replaces Demo Mode automatically
- Firestore Security Rules (`firestore.rules`) + indexes
- Real password reset via Firebase Auth

**P1**
- Bulk CSV student import (parser + Firestore batch write)
- Results Entry table with bulk save
- Student Attendance daily marker (P/A/L) with WhatsApp absent notification
- Razorpay live integration
- Photo upload to Firebase Storage (Admission Form step 5 + tenant logo)

**P2**
- ID Cards (printable templates)
- Transport (route + bus tracking)
- Hostel (rooms + occupancy)
- Online Exams MCQ runner + GPS Tracking map
- Event Gallery lightbox
- Bell-icon notification center backed by Firestore

## Demo Credentials
- `admin@demo.school` / `demo1234` → SCHOOL_ADMIN
- `staff@demo.school` / `demo1234` → STAFF
- `parent@demo.school` / `demo1234` → PARENT (linked to demo student Aanya Iyer)

## Next Steps
1. Provide Firebase config → real auth + Firestore takes over (Demo Mode auto-disables)
2. Run `firebase deploy --only firestore:rules,firestore:indexes` after rules file is added
3. Deploy frontend on Vercel/Emergent with `REACT_APP_FIREBASE_*` + `REACT_APP_BACKEND_URL` set

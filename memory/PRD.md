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

## What's Implemented (Feb 2026 — Iteration 3)
- ✅ **Iter 1** — Core MVP (Login, Admin/Staff/Parent dashboards, basic modules, AI insights, EN/TE, dark/light)
- ✅ **Iter 2 — P1/P2** — Bulk Import, Results Entry, Student Attendance, Razorpay, photo upload, ID Cards, Transport, Hostel, Online Exams, GPS Tracking, Event Gallery
- ✅ **Iter 3 — Deep Modules** (15 new pages, 100% test pass):
  - **Students**: Directory (grid+table+4 filters), full student profile with 5 tabs (Overview/Academic/Fees/Attendance/Documents), expanded 7-step Admission Form (Personal/Contact/Parent/Admission/Health/Transport+Hostel/Documents), separate Removal page (TC fields + auto-redirect), separate Rejoin page (inactive student list + new class/section assignment + optional new admission number), Certificates (9 types) with editable body + jsPDF letterhead generation
  - **Academic**: Classes & Sections CRUD (datalist input + class teacher 1/2 + section management + delete protection if students enrolled), Timetable with 3 timing profiles (Nursery/Primary/High) + period grid editor + per-class persistence
  - **Finance**: Fee Setup (categories × per-class amounts + installments view), Fee Collection (search → form with Cash/Online/Cheque/DD/Razorpay modes → live receipt preview with INR-words → PDF download via jsPDF + auto-increment receipt no.)
  - **Employees**: Add Employee (full form: identification, role/department, qualification, bank, salary, photo)
  - **Attendance**: RFID CSV upload (parse, match by admission no., flag unknown, batch commit) + Bulk WhatsApp absent notifications, Leave Management (request + approve/reject workflow)
  - **ID Cards**: **ID Card Studio** — live editor with 4 colour pickers (header/card/text/accent), 4 presets, font-size slider, vertical/horizontal layouts, front/back side toggle, school logo upload, per-card photo upload, **QR codes (qrcode.react)** auto-generated per person, bulk PDF export via jsPDF
- ✅ Stack: jsPDF + html2canvas (lazy-loaded), qrcode.react, papaparse (available)

## Backlog
**P0 — Production**
- Provide real Firebase config → replaces Demo Mode automatically
- Firestore Security Rules + indexes
- Wire Firestore writes in services (currently demoStore localStorage)
- Cloud Storage for photos & documents (replace data URLs)

**P1 — Remaining feature depth**
- Lesson Planning (full editor with approval workflow)
- Year-End Promotion (bulk promote/hold with archival)
- Income/Expense Ledger (form + monthly summary charts)
- Payroll generation with payslip PDF
- Subjects + Topics manager refresh (current is read-only)
- Diary, Exam Timetable, Teacher Messaging full screens

**P3 — Polish**
- shadcn Calendar in date fields
- Print stylesheets for ID Cards & receipts
- Real Razorpay Checkout JS integration

## Demo Credentials
- `admin@demo.school` / `demo1234` → SCHOOL_ADMIN
- `staff@demo.school` / `demo1234` → STAFF
- `parent@demo.school` / `demo1234` → PARENT (linked to demo student Aanya Iyer)

## Next Steps
1. Provide Firebase config → real auth + Firestore takes over (Demo Mode auto-disables)
2. Run `firebase deploy --only firestore:rules,firestore:indexes` after rules file is added
3. Deploy frontend on Vercel/Emergent with `REACT_APP_FIREBASE_*` + `REACT_APP_BACKEND_URL` set

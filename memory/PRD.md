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

## What's Implemented (Feb 2026 — Iteration 2)
- ✅ **Iter 1 — Core MVP**: Login (gradient hero, role selector, EN/TE), DashboardLayout (collapsible sidebar, banners), Admin/Staff/Parent dashboards, Students+Admission, Academic+Subjects, Finance+donut, Communication, CRM, Employees, Attendance landing, Settings, multi-tenant context with expiry, EN/TE i18n, dark/light theme, Gemini 3 Flash AI insights via FastAPI
- ✅ **Iter 2 — P1**: Bulk CSV Import (parser + preview + commit), Results Entry (class/subject/exam selector + bulk save with auto-grade A+→F), Student Attendance (P/A/L toggles + WhatsApp absent notify + batch save), Razorpay Settings (config + test payment UI), Admission Form Photo Upload (FileReader preview)
- ✅ **Iter 2 — P2**: ID Cards (4 printable gradient templates with QR placeholder), Transport (4 routes with stops chain), Hostel (24 rooms with occupancy color-coding), Online Exams (MCQ runner with countdown timer + auto-scoring), GPS Tracking (animated bus on stylized map), Event Gallery (lightbox modal)

## Backlog (P0/P3)
**P0 — Production readiness**
- Provide real Firebase config → replaces Demo Mode automatically
- Firestore Security Rules (`firestore.rules`) + indexes
- Real password reset via Firebase Auth
- Move Razorpay key storage to encrypted tenant config; integrate Razorpay Checkout JS

**P3 — Polish**
- Replace native `<input type="date">` with shadcn Calendar for visual consistency
- Diary, Exam Timetable, Teacher Messaging, Branding settings full implementation
- Bell-icon notification center backed by Firestore
- Print stylesheet for ID Cards (hide sidebar/banner)

## Demo Credentials
- `admin@demo.school` / `demo1234` → SCHOOL_ADMIN
- `staff@demo.school` / `demo1234` → STAFF
- `parent@demo.school` / `demo1234` → PARENT (linked to demo student Aanya Iyer)

## Next Steps
1. Provide Firebase config → real auth + Firestore takes over (Demo Mode auto-disables)
2. Run `firebase deploy --only firestore:rules,firestore:indexes` after rules file is added
3. Deploy frontend on Vercel/Emergent with `REACT_APP_FIREBASE_*` + `REACT_APP_BACKEND_URL` set

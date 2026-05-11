import React from 'react';
import { motion } from 'framer-motion';
import { Routes, Route, useNavigate, NavLink, Outlet } from 'react-router-dom';
import OnlineExams from './OnlineExams';
import GPSTracking from './GPSTracking';
import EventGallery from './EventGallery';
import Diary from './Diary';
import ExamTimetable from './ExamTimetablePage';
import TeacherMessaging from './TeacherMessaging';
import {
  BookOpen, Bell, IndianRupee, ClipboardCheck, FileText, Library,
  Calendar, MessageSquare, MapPin, Gamepad2, Phone, Camera,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { demoStore } from '../services/demoStore';
import { getWhatsAppUrl } from '../lib/utils';

const MODULES = [
  { key: 'diary', label: 'Diary', icon: BookOpen, color: 'bg-blue-500', tint: 'bg-blue-500/10 text-blue-500' },
  { key: 'announcements', label: 'Announcement', icon: Bell, color: 'bg-pink-500', tint: 'bg-pink-500/10 text-pink-500' },
  { key: 'finance', label: 'Finance', icon: IndianRupee, color: 'bg-emerald-500', tint: 'bg-emerald-500/10 text-emerald-500' },
  { key: 'attendance', label: 'Attendance', icon: ClipboardCheck, color: 'bg-violet-500', tint: 'bg-violet-500/10 text-violet-500' },
  { key: 'result', label: 'Result', icon: FileText, color: 'bg-amber-500', tint: 'bg-amber-500/10 text-amber-500' },
  { key: 'syllabus', label: 'Syllabus', icon: Library, color: 'bg-indigo-500', tint: 'bg-indigo-500/10 text-indigo-500' },
  { key: 'exam-timetable', label: 'Exam Timetable', icon: Calendar, color: 'bg-rose-500', tint: 'bg-rose-500/10 text-rose-500' },
  { key: 'messaging', label: 'Teacher Messaging', icon: MessageSquare, color: 'bg-cyan-500', tint: 'bg-cyan-500/10 text-cyan-500' },
  { key: 'gps', label: 'GPS Tracking', icon: MapPin, color: 'bg-slate-500', tint: 'bg-slate-500/10 text-slate-500' },
  { key: 'online-exams', label: 'Online Exams', icon: Gamepad2, color: 'bg-orange-500', tint: 'bg-orange-500/10 text-orange-500' },
  { key: 'gallery', label: 'Event Gallery', icon: Camera, color: 'bg-fuchsia-500', tint: 'bg-fuchsia-500/10 text-fuchsia-500' },
];

function ParentHome() {
  const navigate = useNavigate();
  const child = demoStore.list('students').find((s) => s.id === 'demo-stu-1') || demoStore.list('students')[0];
  const avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(child?.fullName || 'Aanya')}`;

  return (
    <div className="space-y-6" data-testid="parent-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tighter uppercase">Parent Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Stay connected with your child's journey.</p>
        </div>
      </div>

      {/* Student banner + progress side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.div whileHover={{ y: -3 }} className="lg:col-span-2 relative rounded-[2rem] p-6 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white overflow-hidden">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex flex-col sm:flex-row gap-5 items-start sm:items-center">
            <img src={avatar} alt="avatar" className="h-24 w-24 rounded-3xl bg-white/20 ring-4 ring-white/20" />
            <div className="flex-1">
              <div className="label-eyebrow text-white/70">Active Student</div>
              <div className="font-display font-black text-3xl tracking-tighter mt-1">{child?.fullName || 'Aanya Iyer'}</div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-3 py-1 rounded-full bg-white/15 label-eyebrow">{child?.admissionNo}</span>
                <span className="px-3 py-1 rounded-full bg-white/15 label-eyebrow">Class {child?.className}-{child?.section}</span>
                <span className="px-3 py-1 rounded-full bg-white/15 label-eyebrow">Roll {child?.rollNo}</span>
              </div>
              <a
                data-testid="parent-whatsapp-office"
                href={getWhatsAppUrl('+919000000000', `Hello, I am ${child?.fatherName || 'parent'} of ${child?.fullName}`)}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-2xl bg-white text-indigo-700 label-eyebrow hover:bg-white/90"
              >
                <Phone className="h-3.5 w-3.5" /> Contact Office
              </a>
            </div>
            <div className="text-right hidden sm:block">
              <div className="label-eyebrow text-white/60">Upcoming PTM</div>
              <div className="font-display font-black text-xl tracking-tighter">Dec 18</div>
              <div className="text-xs text-white/70">Sat · 10:00 AM</div>
            </div>
          </div>
        </motion.div>

        <div className="glass-morphism rounded-[2rem] p-5">
          <div className="label-eyebrow text-muted-foreground">Academic Progress</div>
          <div className="font-display font-black text-2xl tracking-tighter mt-1">Mid-Term · 86%</div>
          <div className="mt-4">
            <div className="flex justify-between label-eyebrow text-muted-foreground mb-1.5"><span>Curriculum Completion</span><span>72%</span></div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: '72%' }} transition={{ duration: 1 }} className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-2xl bg-muted/40 p-3">
              <div className="label-eyebrow text-muted-foreground">Attendance</div>
              <div className="font-display font-black text-xl tracking-tighter mt-0.5">94%</div>
            </div>
            <div className="rounded-2xl bg-muted/40 p-3">
              <div className="label-eyebrow text-muted-foreground">Avg Rating</div>
              <div className="font-display font-black text-xl tracking-tighter mt-0.5">4.6</div>
            </div>
          </div>
        </div>
      </div>

      {/* Module grid */}
      <div>
        <div className="label-eyebrow text-muted-foreground mb-3">Quick Access</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {MODULES.map((m, i) => (
            <motion.button
              key={m.key}
              data-testid={`parent-module-${m.key}`}
              onClick={() => navigate(m.key)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileHover={{ y: -5, scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="glass-morphism rounded-[1.75rem] p-4 text-left flex flex-col gap-3"
            >
              <div className={`h-11 w-11 rounded-2xl ${m.tint} grid place-items-center`}>
                <m.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-sm leading-tight">{m.label}</div>
                <div className="label-eyebrow text-muted-foreground mt-1">Open →</div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

const SimplePage = ({ title, description, children, testId }) => (
  <div className="space-y-5" data-testid={testId}>
    <NavLink to=".." relative="path" className="label-eyebrow text-primary">← Back</NavLink>
    <h2 className="font-display font-black text-3xl tracking-tighter uppercase">{title}</h2>
    {description && <p className="text-sm text-muted-foreground">{description}</p>}
    <div className="glass-morphism rounded-[2rem] p-6">{children}</div>
  </div>
);

const Announcements = () => {
  const list = demoStore.list('announcements');
  return (
    <SimplePage title="Announcements" testId="parent-announcements">
      <div className="space-y-3">
        {list.map((a) => (
          <div key={a.id} className="p-4 rounded-2xl bg-muted/30 border border-border">
            <div className="flex items-center justify-between">
              <div className="font-bold">{a.title}</div>
              <span className="label-eyebrow text-muted-foreground">{new Date(a.date).toLocaleDateString()}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{a.description}</p>
          </div>
        ))}
      </div>
    </SimplePage>
  );
};

const Result = () => {
  const list = demoStore.list('results').filter((r) => r.studentId === 'demo-stu-1');
  const gradeColor = (g) => ({
    'A+': 'bg-indigo-500/10 text-indigo-500', 'A': 'bg-emerald-500/10 text-emerald-500',
    'B': 'bg-amber-500/10 text-amber-500', 'C': 'bg-orange-500/10 text-orange-500',
    'D': 'bg-rose-500/10 text-rose-500', 'F': 'bg-red-500/10 text-red-500',
  }[g] || 'bg-muted');
  return (
    <SimplePage title="Results" testId="parent-result">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {list.map((r) => (
          <div key={r.id} className="p-4 rounded-2xl border border-border">
            <div className="flex items-center justify-between">
              <div className="font-bold">{r.subjectName}</div>
              <span className={`px-2.5 py-1 rounded-full label-eyebrow ${gradeColor(r.grade)}`}>{r.grade}</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <div className="font-display font-black text-3xl tracking-tighter">{r.marks}</div>
              <div className="text-sm text-muted-foreground">/ {r.totalMarks}</div>
            </div>
            <div className="label-eyebrow text-muted-foreground mt-1">{r.examName}</div>
          </div>
        ))}
      </div>
    </SimplePage>
  );
};

const Syllabus = () => {
  const subs = demoStore.list('subjects');
  const tops = demoStore.list('topics');
  return (
    <SimplePage title="Syllabus Status" testId="parent-syllabus">
      <div className="space-y-4">
        {subs.map((s) => {
          const my = tops.filter((t) => t.subjectId === s.id);
          const done = my.filter((t) => t.status === 'COMPLETED').length;
          const pct = my.length ? Math.round((done / my.length) * 100) : 0;
          return (
            <div key={s.id} className="p-4 rounded-2xl border border-border">
              <div className="flex items-center justify-between">
                <div className="font-bold">{s.name}</div>
                <div className="label-eyebrow text-muted-foreground">{pct}%</div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden mt-2">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {my.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded-xl bg-muted/30 text-xs">
                    <span>{t.topicName}</span>
                    <span className={`label-eyebrow ${t.status === 'COMPLETED' ? 'text-emerald-500' : t.status === 'IN_PROGRESS' ? 'text-amber-500' : 'text-muted-foreground'}`}>{t.status.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </SimplePage>
  );
};

const Attendance = () => {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const status = (d) => (d % 11 === 0 ? 'A' : d % 7 === 0 ? 'L' : 'P');
  const colorOf = (s) => s === 'P' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' : s === 'A' ? 'bg-rose-500/15 text-rose-600 border-rose-500/30' : 'bg-amber-500/15 text-amber-600 border-amber-500/30';
  return (
    <SimplePage title="Attendance" testId="parent-attendance">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { l: 'Total Days', v: '30' }, { l: 'Present', v: '26', c: 'text-emerald-500' },
          { l: 'Absent', v: '2', c: 'text-rose-500' }, { l: 'Late', v: '2', c: 'text-amber-500' },
        ].map((s, i) => (
          <div key={i} className="p-4 rounded-2xl bg-muted/30">
            <div className="label-eyebrow text-muted-foreground">{s.l}</div>
            <div className={`font-display font-black text-2xl tracking-tighter ${s.c || ''}`}>{s.v}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => (
          <div key={d} className={`aspect-square rounded-xl border grid place-items-center text-xs font-bold ${colorOf(status(d))}`}>{d}</div>
        ))}
      </div>
    </SimplePage>
  );
};

const Finance = () => {
  const list = demoStore.list('transactions').filter((t) => t.studentId === 'demo-stu-1');
  const paid = list.filter((x) => x.status === 'PAID').reduce((s, x) => s + x.amount, 0);
  const pending = list.filter((x) => x.status === 'PENDING').reduce((s, x) => s + x.amount, 0);
  return (
    <SimplePage title="Finance" testId="parent-finance">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="p-4 rounded-2xl bg-emerald-500/10"><div className="label-eyebrow text-emerald-600">Paid</div><div className="font-display font-black text-2xl tracking-tighter">₹{paid.toLocaleString()}</div></div>
        <div className="p-4 rounded-2xl bg-amber-500/10"><div className="label-eyebrow text-amber-600">Pending</div><div className="font-display font-black text-2xl tracking-tighter">₹{pending.toLocaleString()}</div></div>
        <div className="p-4 rounded-2xl bg-rose-500/10"><div className="label-eyebrow text-rose-600">Overdue</div><div className="font-display font-black text-2xl tracking-tighter">₹0</div></div>
      </div>
      <div className="space-y-2">
        {list.map((t) => (
          <div key={t.id} className="flex items-center justify-between p-3 rounded-2xl border border-border">
            <div>
              <div className="font-bold text-sm">{t.feeName}</div>
              <div className="label-eyebrow text-muted-foreground">{t.receiptNo}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="font-display font-black tracking-tighter">₹{t.amount.toLocaleString()}</div>
              <span className={`px-2.5 py-1 rounded-full label-eyebrow ${t.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' : t.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'}`}>{t.status}</span>
            </div>
          </div>
        ))}
      </div>
    </SimplePage>
  );
};

const Stub = ({ title }) => (
  <SimplePage title={title} testId={`parent-${title.toLowerCase().replace(/\s+/g, '-')}`}>
    <div className="text-center text-sm text-muted-foreground py-8">Coming soon — feature scaffold in place.</div>
  </SimplePage>
);

export default function ParentDashboard() {
  return (
    <Routes>
      <Route index element={<ParentHome />} />
      <Route path="announcements" element={<Announcements />} />
      <Route path="result" element={<Result />} />
      <Route path="syllabus" element={<Syllabus />} />
      <Route path="attendance" element={<Attendance />} />
      <Route path="finance" element={<Finance />} />
      <Route path="diary" element={<Diary />} />
      <Route path="exam-timetable" element={<ExamTimetable />} />
      <Route path="messaging" element={<TeacherMessaging />} />
      <Route path="gps" element={<GPSTracking />} />
      <Route path="online-exams" element={<OnlineExams />} />
      <Route path="gallery" element={<EventGallery />} />
    </Routes>
  );
}

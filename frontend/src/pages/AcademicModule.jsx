import React from 'react';
import { motion } from 'framer-motion';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { BookOpen, BookMarked, Calendar, FileText, Lightbulb, ArrowUpCircle } from 'lucide-react';
import { demoStore } from '../services/demoStore';

const Card = ({ icon: Icon, label, sub, color, onClick, testId }) => (
  <motion.button onClick={onClick} whileHover={{ y: -5, scale: 1.02 }} data-testid={testId} className="glass-morphism rounded-[2rem] p-5 text-left">
    <div className={`h-11 w-11 rounded-2xl ${color} grid place-items-center text-white`}><Icon className="h-5 w-5" /></div>
    <div className="mt-4 font-bold">{label}</div>
    <div className="label-eyebrow text-muted-foreground mt-1">{sub}</div>
  </motion.button>
);

function Landing() {
  const nav = useNavigate();
  const cards = [
    { icon: BookOpen, label: 'Classes & Sections', sub: '12 grades · 32 sections', color: 'bg-gradient-to-br from-indigo-500 to-violet-500', to: '/dashboard/academic/classes' },
    { icon: BookMarked, label: 'Subject Topics', sub: 'CRUD + progress', color: 'bg-gradient-to-br from-emerald-500 to-teal-500', to: '/dashboard/academic/subjects' },
    { icon: Calendar, label: 'Timetable', sub: 'Weekly slots', color: 'bg-gradient-to-br from-amber-500 to-orange-500', to: '/dashboard/timetable' },
    { icon: FileText, label: 'Results Entry', sub: 'Mark sheets', color: 'bg-gradient-to-br from-rose-500 to-pink-500', to: '/dashboard/results-entry' },
    { icon: Lightbulb, label: 'Lesson Planning', sub: 'Approval workflow', color: 'bg-gradient-to-br from-cyan-500 to-blue-500', to: '/dashboard/academic/lesson-planning' },
    { icon: ArrowUpCircle, label: 'Year-End Promotion', sub: 'Bulk promote · retain', color: 'bg-gradient-to-br from-fuchsia-500 to-purple-500', to: '/dashboard/academic/promotion' },
  ];
  const grades = ['VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return (
    <div className="space-y-6" data-testid="academic-module">
      <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tighter uppercase">Academic</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => <Card key={c.label} {...c} onClick={() => c.to !== '#' && nav(c.to)} testId={`acad-card-${c.label}`} />)}
      </div>
      <div className="glass-morphism rounded-[2rem] p-5">
        <div className="label-eyebrow text-muted-foreground mb-4">Class Overview</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {grades.map((g, i) => (
            <div key={g} className="rounded-2xl border border-border p-3 text-center">
              <div className="label-eyebrow text-muted-foreground">Grade</div>
              <div className="font-display font-black text-2xl tracking-tighter">{g}</div>
              <div className="text-xs mt-2">{30 + (i * 5)} students</div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: `${70 + i * 3}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Subjects() {
  const subs = demoStore.list('subjects');
  const tops = demoStore.list('topics');
  return (
    <div className="space-y-5" data-testid="subjects-panel">
      <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Subjects</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {subs.map((s) => {
          const my = tops.filter((t) => t.subjectId === s.id);
          const done = my.filter((t) => t.status === 'COMPLETED').length;
          return (
            <div key={s.id} className="glass-morphism rounded-[2rem] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display font-black text-xl tracking-tighter">{s.name}</div>
                  <div className="label-eyebrow text-muted-foreground">{s.code} · Class {s.className}</div>
                </div>
                <div className="text-right">
                  <div className="font-display font-black text-2xl tracking-tighter">{my.length ? Math.round(done/my.length*100) : 0}%</div>
                  <div className="label-eyebrow text-muted-foreground">Complete</div>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {my.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30">
                    <span className="text-sm font-medium">{t.topicName}</span>
                    <span className={`px-2 py-0.5 rounded-full label-eyebrow ${t.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' : t.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-slate-500'}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AcademicModule() {
  return (
    <Routes>
      <Route index element={<Landing />} />
      <Route path="subjects" element={<Subjects />} />
    </Routes>
  );
}

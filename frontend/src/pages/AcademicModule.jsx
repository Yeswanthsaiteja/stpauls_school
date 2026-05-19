import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { BookOpen, BookMarked, Calendar, FileText, Lightbulb, ArrowUpCircle, Plus, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { listSubjects, addSubject, deleteSubject, listClasses, addClass } from '../services/firebase/academicService';
import { listStudents } from '../services/firebase/studentsService';
import { toast } from 'sonner';

const Card = ({ icon: Icon, label, sub, color, onClick, testId }) => (
  <motion.button onClick={onClick} whileHover={{ y: -5, scale: 1.02 }} data-testid={testId} className="glass-morphism rounded-[2rem] p-5 text-left">
    <div className={`h-11 w-11 rounded-2xl ${color} grid place-items-center text-white`}><Icon className="h-5 w-5" /></div>
    <div className="mt-4 font-bold">{label}</div>
    <div className="label-eyebrow text-muted-foreground mt-1">{sub}</div>
  </motion.button>
);

// ─── Landing ──────────────────────────────────────────────────────────────────
function Landing() {
  const nav = useNavigate();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listStudents({ status: 'ACTIVE' }), listClasses()]).then(([sts, cls]) => {
      setStudents(sts);
      setClasses(cls);
      setLoading(false);
    });
  }, []);

  const cards = [
    { icon: BookOpen,      label: 'Classes & Sections', sub: 'Manage grades',     color: 'bg-gradient-to-br from-indigo-500 to-violet-500',  to: '/dashboard/academic/classes' },
    { icon: BookMarked,    label: 'Subject Topics',      sub: 'CRUD + progress',  color: 'bg-gradient-to-br from-emerald-500 to-teal-500',   to: '/dashboard/academic/subjects' },
    { icon: Calendar,      label: 'Timetable',           sub: 'Weekly slots',     color: 'bg-gradient-to-br from-amber-500 to-orange-500',   to: '/dashboard/timetable' },
    { icon: FileText,      label: 'Results Entry',       sub: 'Mark sheets',      color: 'bg-gradient-to-br from-rose-500 to-pink-500',      to: '/dashboard/results-entry' },
    { icon: FileText,      label: 'Exam Scheduling',     sub: 'Global exams setup',color: 'bg-gradient-to-br from-indigo-500 to-blue-500',     to: '/dashboard/academic/exams' },
    { icon: Lightbulb,     label: 'Lesson Planning',     sub: 'Approval workflow',color: 'bg-gradient-to-br from-cyan-500 to-blue-500',      to: '/dashboard/academic/lesson-planning' },
    { icon: ArrowUpCircle, label: 'Year-End Promotion',  sub: 'Bulk promote',     color: 'bg-gradient-to-br from-fuchsia-500 to-purple-500', to: '/dashboard/academic/promotion' },
  ];

  // Group students by class
  const classCounts = {};
  students.forEach((s) => { if (s.className) classCounts[s.className] = (classCounts[s.className] || 0) + 1; });
  const gradeEntries = Object.entries(classCounts).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-6" data-testid="academic-module">
      <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tighter uppercase">Academic</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => <Card key={c.label} {...c} onClick={() => nav(c.to)} testId={`acad-card-${c.label}`} />)}
      </div>
      <div className="glass-morphism rounded-[2rem] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="label-eyebrow text-muted-foreground">Class Overview (Live from Firestore)</div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>
        {gradeEntries.length === 0 && !loading ? (
          <div className="text-center text-muted-foreground py-6 text-sm">
            No students yet. Add students via Admissions to see class breakdown here.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {gradeEntries.map(([grade, count], i) => (
              <div key={grade} className="rounded-2xl border border-border p-3 text-center">
                <div className="label-eyebrow text-muted-foreground">Class</div>
                <div className="font-display font-black text-2xl tracking-tighter">{grade}</div>
                <div className="text-xs mt-2 font-medium">{count} student{count !== 1 ? 's' : ''}</div>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: `${Math.min(100, count * 3)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Subjects — fully Firestore ───────────────────────────────────────────────
function Subjects() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', code: '', className: 'X', teacher: '' });
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listSubjects();
    setSubs(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Subject name required');
    setSaving(true);
    const row = await addSubject(form);
    if (row?.id) {
      setSubs((s) => [row, ...s]);
      setForm({ name: '', code: '', className: 'X', teacher: '' });
      setShowAdd(false);
      toast.success('Subject saved to Firestore');
    } else {
      toast.error('Failed to save subject');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await deleteSubject(id);
    setSubs((s) => s.filter((x) => x.id !== id));
    toast.success('Subject deleted');
  };

  return (
    <div className="space-y-5" data-testid="subjects-panel">
      <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
      <div className="flex items-center justify-between">
        <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Subjects</h1>
        <div className="flex items-center gap-2">
          <button onClick={load} className="h-9 w-9 rounded-xl bg-muted grid place-items-center">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowAdd((v) => !v)}
            className="h-9 px-4 rounded-xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Subject
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="glass-morphism rounded-[2rem] p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Subject Name*', key: 'name', placeholder: 'Mathematics' },
            { label: 'Code', key: 'code', placeholder: 'MATH' },
            { label: 'Class', key: 'className', placeholder: 'X' },
            { label: 'Teacher', key: 'teacher', placeholder: 'Teacher name' },
          ].map((f) => (
            <div key={f.key}>
              <label className="label-eyebrow text-muted-foreground">{f.label}</label>
              <input type="text" value={form[f.key]} placeholder={f.placeholder}
                onChange={(e) => setForm((d) => ({ ...d, [f.key]: e.target.value }))}
                className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary" />
            </div>
          ))}
          <div className="col-span-full flex gap-2">
            <button type="submit" disabled={saving} className="h-10 px-5 rounded-xl bg-primary text-primary-foreground label-eyebrow disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Subject'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="h-10 px-5 rounded-xl bg-muted label-eyebrow">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Loading from Firestore…</div>
      ) : subs.length === 0 ? (
        <div className="glass-morphism rounded-[2rem] p-10 text-center text-muted-foreground">
          <BookMarked className="h-10 w-10 mx-auto mb-3 opacity-30" />
          No subjects yet. Click "Add Subject" to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {subs.map((s) => (
            <motion.div key={s.id} whileHover={{ y: -3 }} className="glass-morphism rounded-[2rem] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display font-black text-xl tracking-tighter">{s.name}</div>
                  <div className="label-eyebrow text-muted-foreground">
                    {s.code && `${s.code} · `}Class {s.className}{s.teacher && ` · ${s.teacher}`}
                  </div>
                </div>
                <button onClick={() => handleDelete(s.id)} className="h-8 w-8 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 grid place-items-center transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Classes — fully Firestore ────────────────────────────────────────────────
function Classes() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', sections: 'A,B', classTeacher: '', room: '' });
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listClasses();
    setClasses(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Class name required');
    setSaving(true);
    const row = await addClass({
      ...form,
      sections: form.sections.split(',').map((s) => s.trim()).filter(Boolean),
    });
    if (row?.id) {
      setClasses((c) => [row, ...c]);
      setForm({ name: '', sections: 'A,B', classTeacher: '', room: '' });
      setShowAdd(false);
      toast.success('Class saved to Firestore');
    } else {
      toast.error('Failed to save class');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5" data-testid="classes-panel">
      <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
      <div className="flex items-center justify-between">
        <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Classes & Sections</h1>
        <div className="flex items-center gap-2">
          <button onClick={load} className="h-9 w-9 rounded-xl bg-muted grid place-items-center">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowAdd((v) => !v)}
            className="h-9 px-4 rounded-xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Class
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="glass-morphism rounded-[2rem] p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Class Name*', key: 'name', placeholder: 'X, VI, 10th…' },
            { label: 'Sections (comma-sep)', key: 'sections', placeholder: 'A,B,C' },
            { label: 'Class Teacher', key: 'classTeacher', placeholder: 'Teacher name' },
            { label: 'Room No.', key: 'room', placeholder: '101' },
          ].map((f) => (
            <div key={f.key}>
              <label className="label-eyebrow text-muted-foreground">{f.label}</label>
              <input type="text" value={form[f.key]} placeholder={f.placeholder}
                onChange={(e) => setForm((d) => ({ ...d, [f.key]: e.target.value }))}
                className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary" />
            </div>
          ))}
          <div className="col-span-full flex gap-2">
            <button type="submit" disabled={saving} className="h-10 px-5 rounded-xl bg-primary text-primary-foreground label-eyebrow disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Class'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="h-10 px-5 rounded-xl bg-muted label-eyebrow">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Loading from Firestore…</div>
      ) : classes.length === 0 ? (
        <div className="glass-morphism rounded-[2rem] p-10 text-center text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
          No classes yet. Click "Add Class" to create one.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {classes.map((c) => (
            <motion.div key={c.id} whileHover={{ y: -3, scale: 1.03 }} className="glass-morphism rounded-[2rem] p-5">
              <div className="font-display font-black text-3xl tracking-tighter">Class {c.name}</div>
              {c.sections?.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {(Array.isArray(c.sections) ? c.sections : [c.sections]).map((s) => (
                    <span key={s} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary label-eyebrow">{s}</span>
                  ))}
                </div>
              )}
              {c.classTeacher && <div className="label-eyebrow text-muted-foreground mt-2">{c.classTeacher}</div>}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AcademicModule() {
  return (
    <Routes>
      <Route index      element={<Landing />} />
      <Route path="subjects" element={<Subjects />} />
      <Route path="classes"  element={<Classes />} />
    </Routes>
  );
}

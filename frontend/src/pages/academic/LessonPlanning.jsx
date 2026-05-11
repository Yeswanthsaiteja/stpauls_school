import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Plus, Check, X, Send, Pencil, Eye } from 'lucide-react';
import { demoStore } from '../../services/demoStore';
import { CLASS_OPTIONS, SECTION_OPTIONS } from '../../lib/pdfUtils';
import { toast } from 'sonner';

const METHODS = ['Lecture', 'Activity', 'Discussion', 'Demo'];
const STATUS_COLOR = { DRAFT: 'bg-slate-500/10 text-slate-500', SUBMITTED: 'bg-amber-500/10 text-amber-500', APPROVED: 'bg-emerald-500/10 text-emerald-500', REVISION: 'bg-rose-500/10 text-rose-500' };

export default function LessonPlanning() {
  const [list, setList] = useState(demoStore.list('lessonPlans'));
  const subjects = demoStore.list('subjects');
  const employees = demoStore.list('employees');
  const [filter, setFilter] = useState({ teacher: '', class: '', subject: '', status: '' });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: '', subjectName: subjects[0]?.name || 'Mathematics', className: '10th', section: 'A',
    teacher: employees[0]?.fullName || '', topic: '', objectives: '',
    method: 'Lecture', materials: '', period: 1, date: new Date().toISOString().slice(0, 10),
    homework: '', status: 'DRAFT',
  });
  const refresh = () => setList(demoStore.list('lessonPlans'));

  const startCreate = () => {
    setEditing(null);
    setForm({ title: '', subjectName: subjects[0]?.name || 'Mathematics', className: '10th', section: 'A', teacher: employees[0]?.fullName || '', topic: '', objectives: '', method: 'Lecture', materials: '', period: 1, date: new Date().toISOString().slice(0, 10), homework: '', status: 'DRAFT' });
    setOpen(true);
  };
  const startEdit = (lp) => { setEditing(lp); setForm(lp); setOpen(true); };

  const save = (asStatus) => {
    if (!form.title) return toast.error('Title required');
    const payload = { ...form, status: asStatus || form.status };
    if (editing) {
      demoStore.update('lessonPlans', editing.id, payload);
      toast.success('Lesson plan updated');
    } else {
      demoStore.add('lessonPlans', payload);
      toast.success(`Saved as ${payload.status}`);
    }
    setOpen(false); refresh();
  };

  const decide = (id, status) => { demoStore.update('lessonPlans', id, { status }); refresh(); toast.success(`Marked ${status}`); };

  const filtered = list.filter((l) =>
    (!filter.teacher || l.teacher === filter.teacher) &&
    (!filter.class || l.className === filter.class) &&
    (!filter.subject || l.subjectName === filter.subject) &&
    (!filter.status || l.status === filter.status)
  );

  return (
    <div className="space-y-6" data-testid="lesson-planning">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-2">Lesson Planning</h1>
        </div>
        <button onClick={startCreate} data-testid="lp-new" className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2"><Plus className="h-3.5 w-3.5" />New Plan</button>
      </div>

      <div className="glass-morphism rounded-[2rem] p-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        <select value={filter.teacher} onChange={(e) => setFilter({ ...filter, teacher: e.target.value })} className="h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="lp-filter-teacher">
          <option value="">All Teachers</option>{employees.map((e) => <option key={e.id}>{e.fullName}</option>)}
        </select>
        <select value={filter.class} onChange={(e) => setFilter({ ...filter, class: e.target.value })} className="h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="lp-filter-class">
          <option value="">All Classes</option>{CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={filter.subject} onChange={(e) => setFilter({ ...filter, subject: e.target.value })} className="h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="lp-filter-subject">
          <option value="">All Subjects</option>{subjects.map((s) => <option key={s.id}>{s.name}</option>)}
        </select>
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} className="h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="lp-filter-status">
          <option value="">All Status</option><option>DRAFT</option><option>SUBMITTED</option><option>APPROVED</option><option>REVISION</option>
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map((l) => (
          <motion.div key={l.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass-morphism rounded-[1.75rem] p-4" data-testid={`lp-row-${l.id}`}>
            <div className="flex flex-wrap items-start gap-3 justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-bold">{l.title}</div>
                  <span className={`px-2 py-0.5 rounded-full label-eyebrow ${STATUS_COLOR[l.status] || 'bg-muted'}`}>{l.status}</span>
                </div>
                <div className="label-eyebrow text-muted-foreground mt-1">{l.subjectName} · {l.className}-{l.section} · Period {l.period} · {l.date} · {l.teacher}</div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{l.objectives}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(l)} className="p-2 rounded-xl hover:bg-muted" data-testid={`lp-edit-${l.id}`}><Pencil className="h-3.5 w-3.5" /></button>
                {l.status === 'SUBMITTED' && (
                  <>
                    <button onClick={() => decide(l.id, 'APPROVED')} className="h-9 px-3 rounded-xl bg-emerald-500/10 text-emerald-600 label-eyebrow flex items-center gap-1" data-testid={`lp-approve-${l.id}`}><Check className="h-3 w-3" />Approve</button>
                    <button onClick={() => decide(l.id, 'REVISION')} className="h-9 px-3 rounded-xl bg-rose-500/10 text-rose-600 label-eyebrow flex items-center gap-1" data-testid={`lp-revise-${l.id}`}><X className="h-3 w-3" />Revise</button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No lesson plans match filters</div>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card rounded-[2rem] p-6 w-full max-w-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="font-display font-black text-xl tracking-tighter">{editing ? 'Edit Lesson Plan' : 'New Lesson Plan'}</div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Lesson Title" className="h-11 px-4 rounded-2xl border border-border bg-background text-sm sm:col-span-2" data-testid="lp-title" />
              <select value={form.subjectName} onChange={(e) => setForm({ ...form, subjectName: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="lp-subject">{subjects.map((s) => <option key={s.id}>{s.name}</option>)}</select>
              <select value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="lp-teacher">{employees.map((e) => <option key={e.id}>{e.fullName}</option>)}</select>
              <select value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="lp-class">{CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}</select>
              <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="lp-section">{SECTION_OPTIONS.map((c) => <option key={c}>{c}</option>)}</select>
              <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Topic" className="h-11 px-4 rounded-2xl border border-border bg-background text-sm" />
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-background text-sm">{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-background text-sm" />
              <input type="number" value={form.period} onChange={(e) => setForm({ ...form, period: Number(e.target.value) || 1 })} placeholder="Period #" className="h-11 px-3 rounded-2xl border border-border bg-background text-sm" />
              <textarea value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} placeholder="Learning Objectives" rows={2} className="px-4 py-2 rounded-2xl border border-border bg-background text-sm sm:col-span-2" />
              <textarea value={form.materials} onChange={(e) => setForm({ ...form, materials: e.target.value })} placeholder="Materials Required" rows={2} className="px-4 py-2 rounded-2xl border border-border bg-background text-sm sm:col-span-2" />
              <textarea value={form.homework} onChange={(e) => setForm({ ...form, homework: e.target.value })} placeholder="Homework" rows={2} className="px-4 py-2 rounded-2xl border border-border bg-background text-sm sm:col-span-2" />
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => save('DRAFT')} className="h-11 px-4 rounded-2xl bg-muted label-eyebrow" data-testid="lp-save-draft">Save Draft</button>
              <button onClick={() => save('SUBMITTED')} className="h-11 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-1.5" data-testid="lp-submit"><Send className="h-3.5 w-3.5" />Submit</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

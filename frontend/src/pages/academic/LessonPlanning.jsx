import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Plus, Loader2, Lightbulb, RefreshCw, Check, X } from 'lucide-react';
import { listLessonPlans, addLessonPlan, updateLessonPlan } from '../../services/firebase/academicService';
import { listSubjects } from '../../services/firebase/academicService';
import { CLASS_OPTIONS, SECTION_OPTIONS } from '../../lib/pdfUtils';
import { toast } from 'sonner';

const METHODS = ['Lecture', 'Activity', 'Discussion', 'Demo'];
const STATUS_COLOR = {
  DRAFT:     'bg-slate-500/10 text-slate-500',
  SUBMITTED: 'bg-amber-500/10 text-amber-500',
  APPROVED:  'bg-emerald-500/10 text-emerald-500',
  REVISION:  'bg-rose-500/10 text-rose-500',
};

export default function LessonPlanning() {
  const [list, setList] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    className: 'X', section: 'A', subjectId: '', topic: '',
    method: 'Lecture', date: new Date().toISOString().slice(0, 10),
    duration: 45, objectives: '', materials: '',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    const [plans, subs] = await Promise.all([listLessonPlans(), listSubjects()]);
    setList(plans);
    setSubjects(subs);
    if (subs.length) setForm((f) => ({ ...f, subjectId: subs[0].id }));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.topic) return toast.error('Topic is required');
    setSaving(true);
    const sub = subjects.find((s) => s.id === form.subjectId);
    const row = await addLessonPlan({ ...form, subjectName: sub?.name || '', status: 'DRAFT' });
    if (row) {
      setList((l) => [row, ...l]);
      setShowAdd(false);
      toast.success('Lesson plan saved to Firestore ✓');
    } else {
      toast.error('Failed to save lesson plan');
    }
    setSaving(false);
  };

  const updateStatus = async (id, status) => {
    await updateLessonPlan(id, { status });
    setList((l) => l.map((p) => p.id === id ? { ...p, status } : p));
    toast.success(`Status updated to ${status}`);
  };

  return (
    <div className="space-y-5" data-testid="lesson-planning">
      <NavLink to="/dashboard/academic" className="label-eyebrow text-primary">← Back</NavLink>
      <div className="flex items-center justify-between">
        <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Lesson Planning</h1>
        <div className="flex gap-2">
          <button onClick={load} className="h-9 w-9 rounded-xl bg-muted grid place-items-center">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowAdd((v) => !v)} className="h-9 px-4 rounded-xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New Plan
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="glass-morphism rounded-[2rem] p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="label-eyebrow text-muted-foreground">Class</label>
            <select value={form.className} onChange={(e) => set('className', e.target.value)} className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm">
              {CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label-eyebrow text-muted-foreground">Section</label>
            <select value={form.section} onChange={(e) => set('section', e.target.value)} className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm">
              {SECTION_OPTIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label-eyebrow text-muted-foreground">Subject</label>
            <select value={form.subjectId} onChange={(e) => set('subjectId', e.target.value)} className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm">
              {subjects.length === 0 && <option value="">-- Add subjects first --</option>}
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-span-full">
            <label className="label-eyebrow text-muted-foreground">Topic *</label>
            <input value={form.topic} onChange={(e) => set('topic', e.target.value)} placeholder="Lesson topic" className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="label-eyebrow text-muted-foreground">Date</label>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm" />
          </div>
          <div>
            <label className="label-eyebrow text-muted-foreground">Method</label>
            <select value={form.method} onChange={(e) => set('method', e.target.value)} className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm">
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label-eyebrow text-muted-foreground">Duration (min)</label>
            <input type="number" value={form.duration} onChange={(e) => set('duration', Number(e.target.value))} className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm" />
          </div>
          <div className="col-span-full flex gap-2">
            <button type="submit" disabled={saving} className="h-10 px-5 rounded-xl bg-primary text-primary-foreground label-eyebrow disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Plan'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="h-10 px-5 rounded-xl bg-muted label-eyebrow">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : list.length === 0 ? (
        <div className="glass-morphism rounded-[2rem] p-12 text-center text-muted-foreground">
          <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-25" />
          No lesson plans yet. Click "New Plan" to create one — saves to Firebase.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <motion.div key={p.id} whileHover={{ y: -2 }} className="glass-morphism rounded-[1.75rem] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{p.topic}</div>
                  <div className="label-eyebrow text-muted-foreground mt-0.5">
                    Class {p.className}-{p.section} · {p.subjectName} · {p.date} · {p.method}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-0.5 rounded-full label-eyebrow ${STATUS_COLOR[p.status] || STATUS_COLOR.DRAFT}`}>{p.status}</span>
                  {p.status === 'DRAFT' && (
                    <button onClick={() => updateStatus(p.id, 'SUBMITTED')} className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-600 grid place-items-center" title="Submit for approval">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {p.status === 'SUBMITTED' && (
                    <>
                      <button onClick={() => updateStatus(p.id, 'APPROVED')} className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 grid place-items-center" title="Approve">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => updateStatus(p.id, 'REVISION')} className="h-7 w-7 rounded-lg bg-rose-500/10 text-rose-600 grid place-items-center" title="Request revision">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

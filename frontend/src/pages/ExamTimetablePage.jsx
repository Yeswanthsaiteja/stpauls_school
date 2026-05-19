import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Plus, Calendar, MapPin, Clock, X, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CLASS_OPTIONS } from '../lib/pdfUtils';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';

export default function ExamTimetablePage() {
  const { profile } = useAuth();
  const isParent = profile?.role === 'PARENT';

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterCls, setFilterCls] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ examName: 'Mid-Term', subjectName: 'Mathematics', className: '10th', date: '', startTime: '09:30', durationMin: 180, venue: 'Hall A', maxMarks: 80 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'exam_schedule'));
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => r.tenantId === TENANT_ID);
      setList(rows.sort((a, b) => String(a.date).localeCompare(String(b.date))));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!form.date) return toast.error('Date required');
    setSaving(true);
    const ref = await addDoc(collection(db, 'exam_schedule'), { ...form, tenantId: TENANT_ID, createdAt: serverTimestamp() });
    setList((l) => [...l, { id: ref.id, ...form }].sort((a, b) => String(a.date).localeCompare(String(b.date))));
    setOpen(false);
    setSaving(false);
    toast.success('Exam scheduled in Firestore ✓');
  };

  const remove = async (id) => {
    await deleteDoc(doc(db, 'exam_schedule', id));
    setList((l) => l.filter((e) => e.id !== id));
    toast.success('Removed');
  };

  const visible = list.filter((e) => (!filterCls || e.className === filterCls)).sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return (
    <div className="space-y-6" data-testid="exam-timetable-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-2">Exam Timetable</h1>
        </div>
        {!isParent && (
          <button onClick={() => setOpen(true)} className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2" data-testid="et-add"><Plus className="h-3.5 w-3.5" />Schedule Exam</button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3">
        {!isParent && (
          <select value={filterCls} onChange={(e) => setFilterCls(e.target.value)} className="h-10 px-3 rounded-2xl border border-border bg-card text-sm">
            <option value="">All Classes</option>{CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
        <button onClick={load} className="h-9 w-9 rounded-xl bg-muted grid place-items-center ml-auto">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
      <div className="glass-morphism rounded-[2rem] p-3 overflow-x-auto">
        <table className="w-full">
          <thead><tr>{['Exam', 'Subject', 'Class', 'Date', 'Time', 'Duration', 'Venue', 'Max Marks', ''].map((h) => <th key={h} className="label-eyebrow text-muted-foreground text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {list.filter((e) => !filterCls || e.className === filterCls).map((e, i) => (
              <motion.tr key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-t border-border">
                <td className="px-3 py-2.5 font-bold text-sm">{e.examName}</td>
                <td className="px-3 py-2.5 text-sm">{e.subjectName}</td>
                <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary label-eyebrow">{e.className}</span></td>
                <td className="px-3 py-2.5 text-sm">{e.date}</td>
                <td className="px-3 py-2.5 text-sm">{e.startTime}</td>
                <td className="px-3 py-2.5 text-sm">{e.durationMin}m</td>
                <td className="px-3 py-2.5 text-sm">{e.venue}</td>
                <td className="px-3 py-2.5 font-display font-black tracking-tighter text-sm">{e.maxMarks}</td>
                <td className="px-3 py-2.5">{!isParent && <button onClick={() => remove(e.id)} className="p-2 rounded-xl hover:bg-rose-500/10 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>}</td>
              </motion.tr>
            ))}
            {list.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-sm text-muted-foreground">No exams scheduled yet. Click "Schedule Exam" to add one.</td></tr>}
          </tbody>
        </table>
      </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card rounded-[2rem] p-6 w-full max-w-md border border-border">
            <div className="flex items-center justify-between mb-4"><div className="font-display font-black text-xl tracking-tighter">Schedule Exam</div><button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-muted"><X className="h-4 w-4" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <input value={form.examName} onChange={(e) => setForm({ ...form, examName: e.target.value })} placeholder="Exam Name" className="h-11 px-4 rounded-2xl border border-border bg-background text-sm col-span-2" data-testid="et-examName" />
              <input value={form.subjectName} onChange={(e) => setForm({ ...form, subjectName: e.target.value })} placeholder="Subject" className="h-11 px-4 rounded-2xl border border-border bg-background text-sm" data-testid="et-subjectName" />
              <select value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="et-className">{CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}</select>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="et-date" />
              <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-background text-sm" />
              <input type="number" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} placeholder="Duration (min)" className="h-11 px-4 rounded-2xl border border-border bg-background text-sm" />
              <input type="number" value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: Number(e.target.value) })} placeholder="Max Marks" className="h-11 px-4 rounded-2xl border border-border bg-background text-sm" />
              <input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Venue" className="h-11 px-4 rounded-2xl border border-border bg-background text-sm col-span-2" />
              <button onClick={add} disabled={saving} className="h-11 col-span-2 rounded-2xl bg-primary text-primary-foreground label-eyebrow disabled:opacity-60">
                {saving ? 'Saving…' : 'Schedule'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

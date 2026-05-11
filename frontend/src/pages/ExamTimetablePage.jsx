import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Plus, Calendar, MapPin, Clock, X, Trash2 } from 'lucide-react';
import { demoStore } from '../services/demoStore';
import { CLASS_OPTIONS } from '../lib/pdfUtils';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export default function ExamTimetablePage() {
  const { profile } = useAuth();
  const isParent = profile?.role === 'PARENT';
  const child = isParent ? demoStore.list('students').find((s) => s.id === profile?.linkedStudentId) : null;

  const [list, setList] = useState(demoStore.list('examSchedule'));
  const [filterCls, setFilterCls] = useState(isParent ? child?.className || '10th' : '');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ examName: 'Mid-Term', subjectName: 'Mathematics', className: '10th', date: '', startTime: '09:30', durationMin: 180, venue: 'Hall A', maxMarks: 80 });
  const refresh = () => setList(demoStore.list('examSchedule'));

  const add = () => {
    if (!form.date) return toast.error('Date required');
    demoStore.add('examSchedule', form);
    refresh();
    setOpen(false);
    toast.success('Exam scheduled');
  };
  const remove = (id) => { demoStore.remove('examSchedule', id); refresh(); };

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

      {!isParent && (
        <div className="glass-morphism rounded-[2rem] p-4 flex gap-2">
          <select value={filterCls} onChange={(e) => setFilterCls(e.target.value)} className="h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="et-filter">
            <option value="">All Classes</option>{CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      )}

      <div className="glass-morphism rounded-[2rem] p-3 overflow-x-auto">
        <table className="w-full">
          <thead><tr>{['Exam', 'Subject', 'Class', 'Date', 'Time', 'Duration', 'Venue', 'Max Marks', ''].map((h) => <th key={h} className="label-eyebrow text-muted-foreground text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {visible.map((e, i) => (
              <motion.tr key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-t border-border" data-testid={`et-row-${e.id}`}>
                <td className="px-3 py-2.5 font-bold text-sm">{e.examName}</td>
                <td className="px-3 py-2.5 text-sm">{e.subjectName}</td>
                <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary label-eyebrow">{e.className}</span></td>
                <td className="px-3 py-2.5 text-sm flex items-center gap-1"><Calendar className="h-3 w-3 text-muted-foreground" />{e.date}</td>
                <td className="px-3 py-2.5 text-sm flex items-center gap-1"><Clock className="h-3 w-3 text-muted-foreground" />{e.startTime}</td>
                <td className="px-3 py-2.5 text-sm">{e.durationMin}m</td>
                <td className="px-3 py-2.5 text-sm flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" />{e.venue}</td>
                <td className="px-3 py-2.5 font-display font-black tracking-tighter text-sm">{e.maxMarks}</td>
                <td className="px-3 py-2.5">{!isParent && <button onClick={() => remove(e.id)} className="p-2 rounded-xl hover:bg-rose-500/10 hover:text-rose-500" data-testid={`et-del-${e.id}`}><Trash2 className="h-3.5 w-3.5" /></button>}</td>
              </motion.tr>
            ))}
            {visible.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-sm text-muted-foreground">No exams scheduled</td></tr>}
          </tbody>
        </table>
      </div>

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
              <button onClick={add} className="h-11 col-span-2 rounded-2xl bg-primary text-primary-foreground label-eyebrow" data-testid="et-save">Schedule</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Plus, BookOpen, X } from 'lucide-react';
import { demoStore } from '../services/demoStore';
import { CLASS_OPTIONS, SECTION_OPTIONS } from '../lib/pdfUtils';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export default function Diary() {
  const { profile } = useAuth();
  const isParent = profile?.role === 'PARENT';
  const child = isParent ? demoStore.list('students').find((s) => s.id === profile?.linkedStudentId) : null;

  const [list, setList] = useState(demoStore.list('diaryEntries'));
  const [filterCls, setFilterCls] = useState(isParent ? child?.className || '' : '');
  const [filterSec, setFilterSec] = useState(isParent ? child?.section || '' : '');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), className: '7th', section: 'A', note: '', author: profile?.fullName || 'Teacher' });
  const refresh = () => setList(demoStore.list('diaryEntries'));

  const post = () => {
    if (!form.note.trim()) return toast.error('Note required');
    demoStore.add('diaryEntries', form);
    refresh();
    setOpen(false);
    setForm({ ...form, note: '' });
    toast.success('Diary entry posted');
  };

  const visible = list.filter((d) =>
    (!filterCls || d.className === filterCls) &&
    (!filterSec || d.section === filterSec)
  ).sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return (
    <div className="space-y-6" data-testid="diary-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-2">Class Diary</h1>
          <p className="text-sm text-muted-foreground mt-1">{isParent ? `${child?.fullName || 'Your child'}'s daily class notes` : 'Daily notes by teachers for parents'}</p>
        </div>
        {!isParent && (
          <button onClick={() => setOpen(true)} data-testid="diary-new" className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2"><Plus className="h-3.5 w-3.5" />New Entry</button>
        )}
      </div>

      {!isParent && (
        <div className="glass-morphism rounded-[2rem] p-4 grid grid-cols-2 md:grid-cols-3 gap-2">
          <select value={filterCls} onChange={(e) => setFilterCls(e.target.value)} className="h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="diary-filter-class">
            <option value="">All Classes</option>{CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={filterSec} onChange={(e) => setFilterSec(e.target.value)} className="h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="diary-filter-section">
            <option value="">All Sections</option>{SECTION_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      )}

      <div className="space-y-3">
        {visible.map((d, i) => (
          <motion.div key={d.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass-morphism rounded-[1.75rem] p-4 flex gap-3" data-testid={`diary-entry-${d.id}`}>
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 grid place-items-center flex-shrink-0"><BookOpen className="h-4 w-4 text-indigo-500" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-bold text-sm">{d.author}</div>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary label-eyebrow">{d.className}-{d.section}</span>
                <span className="label-eyebrow text-muted-foreground">{d.date}</span>
              </div>
              <p className="text-sm mt-1.5">{d.note}</p>
            </div>
          </motion.div>
        ))}
        {visible.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">No diary entries yet</div>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card rounded-[2rem] p-6 w-full max-w-md border border-border">
            <div className="flex items-center justify-between mb-4"><div className="font-display font-black text-xl tracking-tighter">New Diary Entry</div><button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-muted"><X className="h-4 w-4" /></button></div>
            <div className="space-y-3">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="diary-date" />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="diary-class">{CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}</select>
                <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="diary-section">{SECTION_OPTIONS.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="What should parents know today?" rows={4} className="w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-sm" data-testid="diary-note" />
              <button onClick={post} className="w-full h-11 rounded-2xl bg-primary text-primary-foreground label-eyebrow" data-testid="diary-post">Post</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

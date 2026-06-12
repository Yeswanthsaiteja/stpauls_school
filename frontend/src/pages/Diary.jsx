import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Plus, BookOpen, X, Loader2, RefreshCw } from 'lucide-react';
import { listDiaryEntries, addDiaryEntry } from '../services/firebase/communicationService';
import { CLASS_OPTIONS, SECTION_OPTIONS } from '../lib/pdfUtils';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export default function Diary() {
  const { profile } = useAuth();
  const isParent = profile?.role === 'PARENT';
  const isAdmin = profile?.role === 'SCHOOL_ADMIN';
  // Staff: non-parent, non-admin
  const isStaff = !isParent && !isAdmin;

  // For parents: auto-filter to child's class
  const parentClass = profile?.linkedStudentClass || profile?.linkedClassName || '';
  const parentSection = profile?.section || profile?.linkedSection || '';

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterCls, setFilterCls] = useState(isParent ? parentClass : '');
  const [filterSec, setFilterSec] = useState(isParent ? parentSection : '');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    className: CLASS_OPTIONS[0] || '7th', section: 'A', note: '', homework: '',
    author: profile?.fullName || 'Teacher',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listDiaryEntries({
      className: isParent ? (profile?.linkedClassName || undefined) : undefined,
    });
    setList(data);
    setLoading(false);
  }, [isParent, profile]);

  useEffect(() => { load(); }, [load]);

  const post = async () => {
    if (!form.note.trim()) return toast.error('Note required');
    if (saving) return; setSaving(true);
    const row = await addDiaryEntry(form);
    if (row) {
      setList((l) => [row, ...l]);
      setOpen(false);
      setForm((f) => ({ ...f, note: '' }));
      toast.success('Diary entry saved to Firestore ✓');
    } else {
      toast.error('Failed to save entry');
    }
    setSaving(false);
  };

  const visible = list.filter((d) =>
    (!filterCls || d.className === filterCls) &&
    (!filterSec || d.section === filterSec)
  );

  return (
    <div className="space-y-6" data-testid="diary-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-2">Class Diary</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isParent ? "Your child's daily class notes" : 'Daily notes for parents'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="h-9 w-9 rounded-xl bg-muted grid place-items-center">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {!isParent && (
            <button onClick={() => setOpen(true)} data-testid="diary-new"
              className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2">
              <Plus className="h-3.5 w-3.5" />New Entry
            </button>
          )}
          {isParent && parentClass && (
            <span className="label-eyebrow text-muted-foreground px-3 py-1.5 rounded-full bg-muted">
              Class {parentClass}{parentSection ? `-${parentSection}` : ''}
            </span>
          )}
        </div>
      </div>

      {!isParent && (
        <div className="glass-morphism rounded-[2rem] p-4 grid grid-cols-2 md:grid-cols-3 gap-2">
          <select value={filterCls} onChange={(e) => setFilterCls(e.target.value)} className="h-10 px-3 rounded-2xl border border-border bg-card text-sm">
            <option value="">All Classes</option>{CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={filterSec} onChange={(e) => setFilterSec(e.target.value)} className="h-10 px-3 rounded-2xl border border-border bg-card text-sm">
            <option value="">All Sections</option>{SECTION_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3">
          {visible.map((d, i) => (
            <motion.div key={d.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="glass-morphism rounded-[1.75rem] p-4 flex gap-3" data-testid={`diary-entry-${d.id}`}>
              <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 grid place-items-center flex-shrink-0">
                <BookOpen className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-bold text-sm">{d.author}</div>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary label-eyebrow">{d.className}{d.section ? `-${d.section}` : ''}</span>
                  <span className="label-eyebrow text-muted-foreground">{d.date}</span>
                </div>
                {d.note && <p className="text-sm mt-1.5">{d.note}</p>}
                {d.homework && (
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <div className="label-eyebrow text-amber-600 mb-1">Homework</div>
                    <p className="text-sm">{d.homework}</p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {visible.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">No diary entries yet. Click "New Entry" to create one.</div>}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card rounded-[2rem] p-6 w-full max-w-md border border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="font-display font-black text-xl tracking-tighter">New Diary Entry</div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-background text-sm">
                  {CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
                <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-background text-sm">
                  {SECTION_OPTIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="What happened in class today? Syllabus covered, activities…" rows={3}
                className="w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-sm" />
              <div>
                <label className="label-eyebrow text-muted-foreground mb-1 block">Homework / Assignment</label>
                <textarea value={form.homework || ''} onChange={(e) => setForm({ ...form, homework: e.target.value })}
                  placeholder="Homework or assignment for tomorrow…" rows={2}
                  className="w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-sm" />
              </div>
              <button onClick={post} disabled={saving} className="w-full h-11 rounded-2xl bg-primary text-primary-foreground label-eyebrow disabled:opacity-60">
                {saving ? 'Saving…' : 'Post Entry'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

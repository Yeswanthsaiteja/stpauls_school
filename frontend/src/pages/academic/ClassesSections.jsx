import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Plus, Trash2, Pencil, X, Loader2, RefreshCw } from 'lucide-react';
import { listClasses, addClass, updateClass, deleteClass } from '../../services/firebase/academicService';
import { listEmployees } from '../../services/firebase/employeesService';
import { listStudents } from '../../services/firebase/studentsService';
import { CLASS_OPTIONS } from '../../lib/pdfUtils';
import { toast } from 'sonner';

export default function ClassesSections() {
  const [list, setList] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null); // {classId, sectionIdx?, mode}
  const [form, setForm] = useState({ name: '', sections: 'A', teacher1: '', teacher2: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [clsData, empData, stuData] = await Promise.all([listClasses(), listEmployees({ status: 'ACTIVE' }), listStudents({ status: 'ACTIVE' })]);
    setList(clsData);
    setEmployees(empData);
    setStudents(stuData);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm({ name: '', sections: 'A', teacher1: employees[0]?.fullName || '', teacher2: '' });
    setModal({ mode: 'add' });
  };
  
  const openEdit = (c) => {
    setForm({ name: c.name, sections: c.sections.join(','), teacher1: c.teacher1 || '', teacher2: c.teacher2 || '' });
    setModal({ mode: 'edit', id: c.id });
  };

  const save = async () => {
    const sections = form.sections.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    const payload = {
      name: form.name.trim(),
      sections,
      teacher1: form.teacher1, teacher2: form.teacher2,
    };
    if (!payload.name) return toast.error('Class name required');
    if (!sections.length) return toast.error('At least one section required');

    // ── Duplicate check: same class name + overlapping section ──
    if (modal.mode === 'add') {
      const existing = list.find(c =>
        c.name.trim().toLowerCase() === payload.name.toLowerCase() &&
        c.sections?.some(s => sections.includes(s.toUpperCase()))
      );
      if (existing) {
        const overlap = existing.sections.filter(s => sections.includes(s.toUpperCase()));
        toast.error(`Class "${payload.name}" – Section${overlap.length > 1 ? 's' : ''} "${overlap.join(', ')}" already exists! Please use a different section.`);
        return;
      }
    }

    if (saving) return; setSaving(true);
    if (modal.mode === 'add') {
      const row = await addClass(payload);
      if (row) {
        setList((l) => [...l, row]);
        toast.success(`Class ${payload.name}-${sections.join('/')} saved ✓`);
      } else {
        toast.error('Failed to save class');
      }
    } else {
      await updateClass(modal.id, payload);
      setList((l) => l.map((c) => c.id === modal.id ? { ...c, ...payload } : c));
      toast.success('Class updated ✓');
    }
    setSaving(false);
    setModal(null);
  };


  const remove = async (c) => {
    if (!window.confirm(`Delete class ${c.name}?`)) return;
    await deleteClass(c.id);
    setList((l) => l.filter((x) => x.id !== c.id));
    toast.success('Class removed');
  };

  return (
    <div className="space-y-5" data-testid="classes-sections">
      <NavLink to="/dashboard/academic" className="label-eyebrow text-primary">← Back to Academic</NavLink>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Classes & Sections</h1>
        <div className="flex gap-2">
          <button onClick={load} className="h-10 w-10 rounded-2xl bg-muted grid place-items-center">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openAdd} data-testid="cs-add-btn" className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2">
            <Plus className="h-3.5 w-3.5" />Add Class
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="glass-morphism rounded-[2rem] p-3 overflow-x-auto">
          <table className="w-full">
            <thead><tr>{['Class', 'Sections', 'Teacher 1', 'Teacher 2', 'Students', ''].map((h) => <th key={h} className="label-eyebrow text-muted-foreground text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((c) => {
                const cnt = students.filter(s => s.className === c.name).length;
                return (
                  <tr key={c.id} className="border-t border-border" data-testid={`cs-row-${c.id}`}>
                    <td className="px-3 py-3 font-display font-black tracking-tighter text-lg">{c.name}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 flex-wrap">{(c.sections || []).map((s) => <span key={s} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary label-eyebrow">{s}</span>)}</div>
                    </td>
                    <td className="px-3 py-3 text-sm font-bold">{c.teacher1 || '—'}</td>
                    <td className="px-3 py-3 text-sm">{c.teacher2 || '—'}</td>
                    <td className="px-3 py-3 text-sm font-bold">{cnt}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => openEdit(c)} className="p-2 rounded-xl hover:bg-muted" data-testid={`cs-edit-${c.id}`}><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => remove(c)} className="p-2 rounded-xl hover:bg-rose-500/10 hover:text-rose-500" data-testid={`cs-del-${c.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No classes yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card rounded-[2rem] p-6 w-full max-w-md border border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="font-display font-black text-xl tracking-tighter">{modal.mode === 'add' ? 'Add Class' : 'Edit Class'}</div>
              <button onClick={() => setModal(null)} className="p-2 rounded-xl hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label-eyebrow text-muted-foreground">Class Name</label>
                <input list="class-suggestions" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 5th, Pre-KG, XII-Science" className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="cs-name" />
                <datalist id="class-suggestions">{CLASS_OPTIONS.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <label className="label-eyebrow text-muted-foreground">Sections (comma separated)</label>
                <input value={form.sections} onChange={(e) => setForm({ ...form, sections: e.target.value })} placeholder="A, B, C" className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-background text-sm" data-testid="cs-sections" />
              </div>
              <div>
                <label className="label-eyebrow text-muted-foreground">Class Teacher 1</label>
                <select value={form.teacher1} onChange={(e) => setForm({ ...form, teacher1: e.target.value })} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="cs-teacher1">
                  <option value="">—</option>
                  {employees.map((e) => <option key={e.id} value={e.fullName}>{e.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="label-eyebrow text-muted-foreground">Class Teacher 2 (optional)</label>
                <select value={form.teacher2} onChange={(e) => setForm({ ...form, teacher2: e.target.value })} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="cs-teacher2">
                  <option value="">—</option>
                  {employees.map((e) => <option key={e.id} value={e.fullName}>{e.fullName}</option>)}
                </select>
              </div>
              <button onClick={save} disabled={saving} className="h-11 w-full rounded-2xl bg-primary text-primary-foreground label-eyebrow disabled:opacity-60" data-testid="cs-save">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { ArrowUpCircle, AlertTriangle, Loader2, RefreshCw, Check } from 'lucide-react';
import { listStudents, updateStudent } from '../../services/firebase/studentsService';
import { CLASS_OPTIONS, SECTION_OPTIONS } from '../../lib/pdfUtils';
import { exportToCSV } from '../../lib/utils';
import { toast } from 'sonner';

const NEXT_CLASS = {
  'Nursery': 'LKG', 'LKG': 'UKG', 'UKG': '1st',
  '1st': '2nd', '2nd': '3rd', '3rd': '4th', '4th': '5th', '5th': '6th',
  '6th': '7th', '7th': '8th', '8th': '9th', '9th': '10th',
  '10th': '11th', '11th': '12th', '12th': 'GRADUATED',
};

export default function YearEndPromotion() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [fromClass, setFromClass] = useState('X');
  const [section, setSection] = useState('');
  const [selected, setSelected] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listStudents({ status: 'ACTIVE' });
    setStudents(data);
    setSelected([]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => students.filter((s) => {
    const matchC = !fromClass || s.className === fromClass;
    const matchS = !section  || s.section   === section;
    return matchC && matchS;
  }), [students, fromClass, section]);

  const toClass = NEXT_CLASS[fromClass] || '—';
  const toggleAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map((s) => s.id));
  const toggle = (id) => setSelected((sel) => sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);

  const promote = async () => {
    if (!selected.length) return toast.error('Select at least one student');
    if (toClass === 'GRADUATED') {
      if (!window.confirm(`This will mark ${selected.length} students as GRADUATED. Continue?`)) return;
    } else {
      if (!window.confirm(`Promote ${selected.length} students from ${fromClass} to ${toClass}? This is saved to Firebase immediately.`)) return;
    }
    setPromoting(true);
    let count = 0;
    for (const id of selected) {
      await updateStudent(id, {
        className: toClass === 'GRADUATED' ? fromClass : toClass,
        status: toClass === 'GRADUATED' ? 'GRADUATED' : 'ACTIVE',
        promotedFrom: fromClass,
        promotedAt: new Date().toISOString(),
        academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      });
      count++;
    }
    toast.success(`${count} students promoted to ${toClass} in Firestore ✓`);
    await load();
    setPromoting(false);
  };

  const exportList = () => {
    exportToCSV(
      filtered.map((s) => ({ admissionNo: s.admissionNo, name: s.fullName, class: s.className, section: s.section, toClass })),
      'promotion_list.csv',
    );
  };

  return (
    <div className="space-y-5" data-testid="year-end-promotion">
      <NavLink to="/dashboard/academic" className="label-eyebrow text-primary">← Back</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Year-End Promotion</h1>

      <div className="glass-morphism rounded-[2rem] p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <div>
          <label className="label-eyebrow text-muted-foreground">From Class</label>
          <select value={fromClass} onChange={(e) => { setFromClass(e.target.value); setSelected([]); }}
            className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm">
            {CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Section (optional)</label>
          <select value={section} onChange={(e) => { setSection(e.target.value); setSelected([]); }}
            className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm">
            <option value="">All Sections</option>
            {SECTION_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-span-2 flex items-end gap-2">
          <div className="flex-1">
            <div className="label-eyebrow text-muted-foreground">Promotes to</div>
            <div className="mt-1 h-10 flex items-center px-3 rounded-xl bg-primary/10 text-primary font-bold">{toClass}</div>
          </div>
          <button onClick={load} className="h-10 w-10 rounded-xl bg-muted grid place-items-center">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={exportList} className="h-10 px-4 rounded-xl bg-muted label-eyebrow">Export CSV</button>
          <button onClick={promote} disabled={promoting || !selected.length}
            className="h-10 px-4 rounded-xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-1.5 disabled:opacity-60">
            {promoting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpCircle className="h-3.5 w-3.5" />}
            {promoting ? 'Promoting…' : `Promote ${selected.length || ''}`}
          </button>
        </div>
      </div>

      {toClass === 'GRADUATED' && (
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Class 12th → students will be marked GRADUATED. This action is recorded in Firestore.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="glass-morphism rounded-[2rem] p-3 overflow-x-auto">
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="label-eyebrow text-muted-foreground">{filtered.length} students in {fromClass}{section ? `-${section}` : ''}</div>
            <button onClick={toggleAll} className="label-eyebrow text-primary">
              {selected.length === filtered.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr>{['', 'Adm. No', 'Name', 'Section', 'Status'].map((h) => (
                <th key={h} className="label-eyebrow text-muted-foreground text-left px-3 py-2">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-8 text-sm">No active students in {fromClass}</td></tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className={`border-t border-border cursor-pointer hover:bg-muted/30 ${selected.includes(s.id) ? 'bg-primary/5' : ''}`}
                  onClick={() => toggle(s.id)}>
                  <td className="px-3 py-2.5">
                    <div className={`h-4 w-4 rounded border-2 grid place-items-center ${selected.includes(s.id) ? 'bg-primary border-primary' : 'border-border'}`}>
                      {selected.includes(s.id) && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs font-bold">{s.admissionNo}</td>
                  <td className="px-3 py-2.5 font-bold text-sm">{s.fullName}</td>
                  <td className="px-3 py-2.5 text-sm">{s.section}</td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 rounded-full label-eyebrow bg-emerald-500/10 text-emerald-500">{s.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { ArrowUpCircle, AlertTriangle, Check, FileDown } from 'lucide-react';
import { demoStore } from '../../services/demoStore';
import { CLASS_OPTIONS, SECTION_OPTIONS } from '../../lib/pdfUtils';
import { exportToCSV } from '../../lib/utils';
import { toast } from 'sonner';

// Next class mapping
const NEXT_CLASS = {
  'Nursery': 'LKG', 'LKG': 'UKG', 'UKG': '1st',
  '1st': '2nd', '2nd': '3rd', '3rd': '4th', '4th': '5th', '5th': '6th',
  '6th': '7th', '7th': '8th', '8th': '9th', '9th': '10th',
  '10th': '11th', '11th': '12th', '12th': 'GRADUATED',
};

export default function YearEndPromotion() {
  const allStudents = demoStore.list('students').filter((s) => s.status === 'ACTIVE');
  const [cls, setCls] = useState('5th');
  const [sec, setSec] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-26');
  const [newAcademicYear, setNewAcademicYear] = useState('2026-27');
  const [held, setHeld] = useState({}); // {studentId: reason}
  const [committed, setCommitted] = useState(null);

  const rows = useMemo(() => allStudents.filter((s) => s.className === cls && (!sec || s.section === sec)), [allStudents, cls, sec]);
  const heldCount = Object.keys(held).length;

  const toggleHold = (id) => {
    setHeld((h) => {
      const cp = { ...h };
      if (cp[id] !== undefined) delete cp[id]; else cp[id] = '';
      return cp;
    });
  };

  const commitPromotion = () => {
    if (!rows.length) return toast.error('No students to promote');
    const nextCls = NEXT_CLASS[cls];
    let promoted = 0, retained = 0;
    rows.forEach((s) => {
      if (held[s.id] !== undefined) {
        demoStore.update('students', s.id, {
          academicYear: newAcademicYear,
          heldBack: true, heldReason: held[s.id] || 'Not specified',
        });
        retained++;
      } else if (nextCls === 'GRADUATED') {
        demoStore.update('students', s.id, { status: 'INACTIVE', graduated: true, leavingDate: new Date().toISOString().slice(0, 10) });
        promoted++;
      } else {
        demoStore.update('students', s.id, { className: nextCls, academicYear: newAcademicYear, heldBack: false });
        promoted++;
      }
    });
    setCommitted({ promoted, retained, cls, nextCls, total: rows.length });
    toast.success(`Promoted ${promoted} · Retained ${retained}`);
  };

  const exportReport = () => {
    const data = rows.map((s) => ({
      adm: s.admissionNo, name: s.fullName, currentClass: `${s.className}-${s.section}`,
      action: held[s.id] !== undefined ? 'RETAINED' : (NEXT_CLASS[cls] === 'GRADUATED' ? 'GRADUATED' : 'PROMOTED'),
      next: held[s.id] !== undefined ? cls : NEXT_CLASS[cls],
      reason: held[s.id] || '',
    }));
    exportToCSV(data, `promotion_${cls}_${newAcademicYear}.csv`);
  };

  return (
    <div className="space-y-6" data-testid="year-end-promotion">
      <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Year-End Promotion</h1>

      <div className="glass-morphism rounded-[2rem] p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="label-eyebrow text-muted-foreground">From Class</label>
          <select value={cls} onChange={(e) => setCls(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="yp-class">
            {CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Section (optional)</label>
          <select value={sec} onChange={(e) => setSec(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="yp-section">
            <option value="">All</option>{SECTION_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Current Year</label>
          <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" />
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">New Year</label>
          <input value={newAcademicYear} onChange={(e) => setNewAcademicYear(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-muted-foreground">Students</div><div className="font-display font-black text-2xl tracking-tighter">{rows.length}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-emerald-500">Will Promote</div><div className="font-display font-black text-2xl tracking-tighter">{rows.length - heldCount}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-rose-500">Will Retain</div><div className="font-display font-black text-2xl tracking-tighter">{heldCount}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-primary">Next Class</div><div className="font-display font-black text-xl tracking-tighter mt-1">{NEXT_CLASS[cls] || '—'}</div></div>
      </div>

      <div className="glass-morphism rounded-[2rem] p-3 overflow-x-auto">
        <table className="w-full">
          <thead><tr>{['Adm. No', 'Name', 'Current', '→ Next', 'Hold Back', 'Reason'].map((h) => <th key={h} className="label-eyebrow text-muted-foreground text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No active students in {cls}{sec ? `-${sec}` : ''}</td></tr>}
            {rows.map((s) => {
              const isHeld = held[s.id] !== undefined;
              return (
                <tr key={s.id} className={`border-t border-border ${isHeld ? 'bg-rose-500/5' : ''}`} data-testid={`yp-row-${s.id}`}>
                  <td className="px-3 py-2.5 font-mono text-xs font-bold">{s.admissionNo}</td>
                  <td className="px-3 py-2.5 text-sm font-bold">{s.fullName}</td>
                  <td className="px-3 py-2.5 text-sm">{s.className}-{s.section}</td>
                  <td className="px-3 py-2.5 text-sm">
                    {isHeld ? <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 label-eyebrow">Retained in {cls}</span> : <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 label-eyebrow">{NEXT_CLASS[cls]}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={isHeld} onChange={() => toggleHold(s.id)} className="accent-rose-500 h-4 w-4" data-testid={`yp-hold-${s.id}`} />
                  </td>
                  <td className="px-3 py-2.5">
                    {isHeld && <input value={held[s.id]} onChange={(e) => setHeld((h) => ({ ...h, [s.id]: e.target.value }))} placeholder="Reason for retention" className="h-9 px-3 rounded-xl border border-border bg-card text-sm w-full" data-testid={`yp-reason-${s.id}`} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={exportReport} className="h-11 px-4 rounded-2xl bg-muted hover:bg-muted/80 label-eyebrow flex items-center gap-2" data-testid="yp-export"><FileDown className="h-3.5 w-3.5" />Export Report</button>
        <button onClick={commitPromotion} disabled={!rows.length || committed} className="h-11 px-5 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2 disabled:opacity-50" data-testid="yp-commit">
          <ArrowUpCircle className="h-4 w-4" />{committed ? 'Promotion Committed' : `Promote ${rows.length - heldCount} · Retain ${heldCount}`}
        </button>
      </div>

      {committed && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-morphism rounded-[2rem] p-5 border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-2 mb-2"><Check className="h-4 w-4 text-emerald-500" /><div className="font-bold">Promotion completed</div></div>
          <div className="text-sm text-muted-foreground">{committed.promoted} promoted to {committed.nextCls} · {committed.retained} retained · academic year archived as {academicYear}</div>
        </motion.div>
      )}
    </div>
  );
}

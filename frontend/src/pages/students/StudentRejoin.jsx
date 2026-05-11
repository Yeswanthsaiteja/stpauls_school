import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Search, RefreshCcw } from 'lucide-react';
import { demoStore, newAdmissionNo } from '../../services/demoStore';
import { CLASS_OPTIONS, SECTION_OPTIONS } from '../../lib/pdfUtils';
import { toast } from 'sonner';

export default function StudentRejoin() {
  const inactive = demoStore.list('students').filter((s) => s.status === 'INACTIVE');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const [form, setForm] = useState({
    rejoinDate: new Date().toISOString().slice(0, 10),
    className: '5th', section: 'A',
    academicYear: '2025-26', reason: 'Returned after family relocation', newAdmissionNo: '',
    keepOldAdm: true,
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const matches = inactive.filter((s) => q && `${s.fullName} ${s.admissionNo}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);

  const confirm = () => {
    if (!picked) return;
    const admNo = form.keepOldAdm ? picked.admissionNo : (form.newAdmissionNo || newAdmissionNo());
    demoStore.update('students', picked.id, {
      status: 'ACTIVE',
      admissionNo: admNo,
      className: form.className,
      section: form.section,
      academicYear: form.academicYear,
      rejoinDate: form.rejoinDate,
      rejoinReason: form.reason,
      admissionType: 'Rejoining',
    });
    toast.success(`${picked.fullName} reactivated · ${admNo} · ${form.className}-${form.section}`);
    setPicked(null); setQ('');
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="student-rejoin">
      <NavLink to=".." className="label-eyebrow text-primary">← Back to Students</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Student Rejoin</h1>

      <div className="glass-morphism rounded-[2rem] p-5">
        <label className="label-eyebrow text-muted-foreground">Find Inactive Student ({inactive.length} on record)</label>
        <div className="mt-1.5 flex items-center gap-2 px-3 h-11 rounded-2xl border border-border bg-card">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }} placeholder="Search by name or admission number…" className="flex-1 bg-transparent outline-none text-sm" data-testid="rejoin-search" />
        </div>
        {q && !picked && (
          <div className="mt-3 space-y-2">
            {matches.length === 0 && <div className="text-sm text-muted-foreground py-2">No inactive student found</div>}
            {matches.map((s) => (
              <button key={s.id} onClick={() => setPicked(s)} className="w-full text-left p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 flex items-center gap-3" data-testid={`rejoin-pick-${s.id}`}>
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 grid place-items-center text-white font-black text-sm">{s.firstName[0]}</div>
                <div className="flex-1">
                  <div className="font-bold text-sm">{s.fullName}</div>
                  <div className="label-eyebrow text-muted-foreground">{s.admissionNo} · left {s.leavingDate || '—'} · {s.removalReason || '—'}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {picked && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-morphism rounded-[2rem] p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
            <RefreshCcw className="h-5 w-5 text-emerald-500" />
            <div className="flex-1">
              <div className="font-bold">{picked.fullName}</div>
              <div className="label-eyebrow text-muted-foreground">{picked.admissionNo} · {picked.className}-{picked.section}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label-eyebrow text-muted-foreground">Rejoining Date</label>
              <input type="date" value={form.rejoinDate} onChange={(e) => set('rejoinDate', e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="rejoin-date" />
            </div>
            <div>
              <label className="label-eyebrow text-muted-foreground">Academic Year</label>
              <input value={form.academicYear} onChange={(e) => set('academicYear', e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="rejoin-year" />
            </div>
            <div>
              <label className="label-eyebrow text-muted-foreground">New Class</label>
              <select value={form.className} onChange={(e) => set('className', e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="rejoin-class">
                {CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label-eyebrow text-muted-foreground">Section</label>
              <select value={form.section} onChange={(e) => set('section', e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="rejoin-section">
                {SECTION_OPTIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-full">
              <label className="label-eyebrow text-muted-foreground">Reason for Rejoining</label>
              <textarea value={form.reason} onChange={(e) => set('reason', e.target.value)} rows={2} className="mt-1.5 w-full px-3 py-2 rounded-2xl border border-border bg-card text-sm" data-testid="rejoin-reason" />
            </div>
            <label className="col-span-full flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={form.keepOldAdm} onChange={(e) => set('keepOldAdm', e.target.checked)} className="accent-indigo-500" data-testid="rejoin-keepOldAdm" />
              Retain old admission number ({picked.admissionNo})
            </label>
            {!form.keepOldAdm && (
              <div className="col-span-full">
                <label className="label-eyebrow text-muted-foreground">New Admission Number</label>
                <input value={form.newAdmissionNo} onChange={(e) => set('newAdmissionNo', e.target.value)} placeholder="leave blank to auto-generate" className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="rejoin-newAdm" />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setPicked(null)} className="h-11 px-5 rounded-2xl bg-muted label-eyebrow">Cancel</button>
            <button onClick={confirm} className="h-11 px-5 rounded-2xl bg-emerald-500 text-white label-eyebrow" data-testid="rejoin-confirm">Confirm Rejoin</button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import { Search, AlertTriangle } from 'lucide-react';
import { listStudents, removeStudent, updateStudent } from '../../services/firebase/studentsService';
import { toast } from 'sonner';

const REASONS = ['Transfer', 'Family Relocation', 'Fee Default', 'Rustication', 'Other'];

export default function StudentRemoval() {
  const [all, setAll] = useState([]);
  const [removedStudents, setRemovedStudents] = useState([]);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    reason: 'Transfer', leavingDate: new Date().toISOString().slice(0, 10),
    internalNote: '', tcIssued: true, tcDate: new Date().toISOString().slice(0, 10),
    tcNumber: '', remarks: '',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const loadData = () => {
    listStudents({ status: 'ACTIVE' }).then(setAll);
    listStudents({ status: 'REMOVED' }).then(setRemovedStudents);
  };

  useEffect(() => {
    loadData();
  }, []);

  const matches = all.filter((s) => q && `${s.fullName} ${s.admissionNo}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);

  const confirm = async () => {
    if (!picked) return;
    if (saving) return; setSaving(true);
    await removeStudent(picked.id, form.reason);
    
    // Persist extra TC details
    await updateStudent(picked.id, {
      leavingDate: form.leavingDate,
      internalNote: form.internalNote,
      tcIssued: form.tcIssued,
      tcDate: form.tcDate,
      tcNumber: form.tcNumber,
      remarks: form.remarks,
    });
    
    toast.success(`${picked.fullName} removed · TC ${form.tcNumber || 'pending'}`);
    setPicked(null); setQ('');
    setSaving(false);
    loadData(); // Refresh the lists
  };

  return (
    <div className="space-y-6 max-w-4xl" data-testid="student-removal">
      <NavLink to="/dashboard/students" className="label-eyebrow text-primary">← Back to Students</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Student Removal</h1>

      <div className="glass-morphism rounded-[2rem] p-5">
        <label className="label-eyebrow text-muted-foreground">Find Student to Remove</label>
        <div className="mt-1.5 flex items-center gap-2 px-3 h-11 rounded-2xl border border-border bg-card">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }} placeholder="Search active student by name or admission number…" className="flex-1 bg-transparent outline-none text-sm" data-testid="removal-search" />
        </div>
        {q && !picked && (
          <div className="mt-3 space-y-2">
            {matches.length === 0 && <div className="text-sm text-muted-foreground py-2">No active student found</div>}
            {matches.map((s) => (
              <button key={s.id} onClick={() => setPicked(s)} className="w-full text-left p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 flex items-center gap-3" data-testid={`removal-pick-${s.id}`}>
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white font-black text-sm">{s.firstName[0]}</div>
                <div className="flex-1">
                  <div className="font-bold text-sm">{s.fullName}</div>
                  <div className="label-eyebrow text-muted-foreground">{s.admissionNo} · {s.className}-{s.section}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {picked && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-morphism rounded-[2rem] p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-rose-500/5 border border-rose-500/20">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            <div className="flex-1">
              <div className="font-bold">{picked.fullName}</div>
              <div className="label-eyebrow text-muted-foreground">{picked.admissionNo} · {picked.className}-{picked.section}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label-eyebrow text-muted-foreground">Reason for Leaving</label>
              <select value={form.reason} onChange={(e) => set('reason', e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="removal-reason">
                {REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label-eyebrow text-muted-foreground">Date of Leaving</label>
              <input type="date" value={form.leavingDate} onChange={(e) => set('leavingDate', e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="removal-date" />
            </div>
            <div className="col-span-full">
              <label className="label-eyebrow text-muted-foreground">Internal Note (admin-only)</label>
              <textarea value={form.internalNote} onChange={(e) => set('internalNote', e.target.value)} rows={2} className="mt-1.5 w-full px-3 py-2 rounded-2xl border border-border bg-card text-sm" data-testid="removal-note" />
            </div>
            <label className="col-span-full flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={form.tcIssued} onChange={(e) => set('tcIssued', e.target.checked)} className="accent-indigo-500" data-testid="removal-tcIssued" />
              Transfer Certificate Issued
            </label>
            {form.tcIssued && (
              <>
                <div>
                  <label className="label-eyebrow text-muted-foreground">TC Number</label>
                  <input value={form.tcNumber} onChange={(e) => set('tcNumber', e.target.value)} placeholder="TC2026-0042" className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="removal-tcNumber" />
                </div>
                <div>
                  <label className="label-eyebrow text-muted-foreground">TC Issue Date</label>
                  <input type="date" value={form.tcDate} onChange={(e) => set('tcDate', e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="removal-tcDate" />
                </div>
              </>
            )}
            <div className="col-span-full">
              <label className="label-eyebrow text-muted-foreground">Remarks</label>
              <textarea value={form.remarks} onChange={(e) => set('remarks', e.target.value)} rows={2} className="mt-1.5 w-full px-3 py-2 rounded-2xl border border-border bg-card text-sm" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setPicked(null)} className="h-11 px-5 rounded-2xl bg-muted label-eyebrow" data-testid="removal-cancel">Cancel</button>
            <button onClick={confirm} disabled={saving} className="h-11 px-5 rounded-2xl bg-rose-500 text-white label-eyebrow disabled:opacity-60" data-testid="removal-confirm">{saving ? 'Removing…' : 'Confirm Removal'}</button>
          </div>
        </motion.div>
      )}

      {/* Previously Removed Students Table */}
      <div className="glass-morphism rounded-[2rem] p-5">
        <h2 className="font-display font-bold text-xl mb-4 text-primary uppercase tracking-tight">Previously Removed Students</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 text-sm text-muted-foreground">
                <th className="py-2 px-3 font-semibold">Name</th>
                <th className="py-2 px-3 font-semibold">Admission No</th>
                <th className="py-2 px-3 font-semibold">Dropped Out Class</th>
                <th className="py-2 px-3 font-semibold">Date of Dropout (Year)</th>
                <th className="py-2 px-3 font-semibold">TC Number</th>
                <th className="py-2 px-3 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody>
              {removedStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground text-sm">No removed students found.</td>
                </tr>
              )}
              {removedStudents.map((s) => {
                const dropDate = s.leavingDate ? new Date(s.leavingDate) : null;
                const formattedDate = dropDate ? dropDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
                return (
                  <tr key={s.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors text-sm">
                    <td className="py-3 px-3 font-bold text-foreground">{s.fullName}</td>
                    <td className="py-3 px-3 text-muted-foreground">{s.admissionNo}</td>
                    <td className="py-3 px-3 text-muted-foreground">{s.className} - {s.section}</td>
                    <td className="py-3 px-3 text-muted-foreground">{formattedDate}</td>
                    <td className="py-3 px-3 text-muted-foreground">{s.tcNumber || 'N/A'}</td>
                    <td className="py-3 px-3 text-muted-foreground">{s.removalReason || 'N/A'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


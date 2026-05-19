import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import { Search, AlertTriangle } from 'lucide-react';
import { listEmployees, removeEmployee } from '../../services/firebase/employeesService';
import { toast } from 'sonner';

const REASONS = [
  'Resignation', 'Termination', 'Retirement', 'Contract End',
  'Misconduct', 'Prolonged Absence', 'Voluntary Separation', 'Other',
];

export default function EmployeeRemoval() {
  const [all, setAll] = useState([]);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const [form, setForm] = useState({
    reason: 'Resignation',
    leavingDate: new Date().toISOString().slice(0, 10),
    relievingLetterNo: '',
    relievingIssued: true,
    finalSettlement: false,
    settlementAmount: '',
    internalNote: '',
    remarks: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { listEmployees({ status: 'ACTIVE' }).then(setAll); }, []);

  const matches = all.filter(e =>
    q && `${e.fullName} ${e.employeeId} ${e.phoneNumber || ''}`.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 8);

  const confirm = async () => {
    if (!picked) return;
    setSaving(true);
    try {
      await removeEmployee(picked.id, form.reason, {
        leavingDate: form.leavingDate,
        relievingLetterNo: form.relievingLetterNo,
        relievingIssued: form.relievingIssued,
        finalSettlement: form.finalSettlement,
        settlementAmount: form.settlementAmount,
        internalNote: form.internalNote,
        remarks: form.remarks,
      });
      toast.success(`${picked.fullName} removed · ${form.reason}`);
      setPicked(null); setQ('');
      setTimeout(() => navigate('/dashboard/employees/directory'), 600);
    } catch {
      toast.error('Failed to remove employee. Please try again.');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="employee-removal">
      <NavLink to="/dashboard/employees" className="label-eyebrow text-primary">← Back to Employees</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Employee Removal</h1>

      {/* Search */}
      <div className="glass-morphism rounded-[2rem] p-5">
        <label className="label-eyebrow text-muted-foreground">Find Active Employee</label>
        <div className="mt-1.5 flex items-center gap-2 px-3 h-11 rounded-2xl border border-border bg-card">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={e => { setQ(e.target.value); setPicked(null); }}
            placeholder="Search by name, employee ID or phone…"
            className="flex-1 bg-transparent outline-none text-sm" />
        </div>
        {q && !picked && (
          <div className="mt-3 space-y-2">
            {matches.length === 0 && <div className="text-sm text-muted-foreground py-2">No active employee found</div>}
            {matches.map(e => (
              <button key={e.id} onClick={() => setPicked(e)}
                className="w-full text-left p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 grid place-items-center text-white font-black text-sm overflow-hidden flex-shrink-0">
                  {e.photoURL ? <img src={e.photoURL} alt="" className="h-full w-full object-cover" /> : (e.fullName?.[0] || 'E')}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm">{e.fullName}</div>
                  <div className="label-eyebrow text-muted-foreground">{e.employeeId} · {e.designation || e.role} · {e.department}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Removal form */}
      {picked && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="glass-morphism rounded-[2rem] p-6 space-y-4">

          {/* Selected employee */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-rose-500/5 border border-rose-500/20">
            <AlertTriangle className="h-5 w-5 text-rose-500 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-bold">{picked.fullName}</div>
              <div className="label-eyebrow text-muted-foreground">{picked.employeeId} · {picked.designation || picked.role} · {picked.department}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label-eyebrow text-muted-foreground">Reason for Leaving</label>
              <select value={form.reason} onChange={e => set('reason', e.target.value)}
                className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm">
                {REASONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label-eyebrow text-muted-foreground">Last Working Date</label>
              <input type="date" value={form.leavingDate} onChange={e => set('leavingDate', e.target.value)}
                className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" />
            </div>

            <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
              <input type="checkbox" checked={form.relievingIssued} onChange={e => set('relievingIssued', e.target.checked)} className="accent-indigo-500" />
              Relieving Letter Issued
            </label>
            {form.relievingIssued && (
              <div>
                <label className="label-eyebrow text-muted-foreground">Relieving Letter No.</label>
                <input value={form.relievingLetterNo} onChange={e => set('relievingLetterNo', e.target.value)}
                  placeholder="REL-2026-001"
                  className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
              <input type="checkbox" checked={form.finalSettlement} onChange={e => set('finalSettlement', e.target.checked)} className="accent-indigo-500" />
              Final Settlement Done
            </label>
            {form.finalSettlement && (
              <div>
                <label className="label-eyebrow text-muted-foreground">Settlement Amount (₹)</label>
                <input type="number" value={form.settlementAmount} onChange={e => set('settlementAmount', e.target.value)}
                  className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" />
              </div>
            )}

            <div className="col-span-full">
              <label className="label-eyebrow text-muted-foreground">Internal Note (admin-only)</label>
              <textarea value={form.internalNote} onChange={e => set('internalNote', e.target.value)} rows={2}
                className="mt-1.5 w-full px-3 py-2 rounded-2xl border border-border bg-card text-sm resize-none" />
            </div>
            <div className="col-span-full">
              <label className="label-eyebrow text-muted-foreground">Remarks</label>
              <textarea value={form.remarks} onChange={e => set('remarks', e.target.value)} rows={2}
                className="mt-1.5 w-full px-3 py-2 rounded-2xl border border-border bg-card text-sm resize-none" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setPicked(null)} className="h-11 px-5 rounded-2xl bg-muted label-eyebrow">Cancel</button>
            <button onClick={confirm} disabled={saving}
              className="h-11 px-5 rounded-2xl bg-rose-500 text-white label-eyebrow disabled:opacity-60">
              {saving ? 'Removing…' : 'Confirm Removal'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

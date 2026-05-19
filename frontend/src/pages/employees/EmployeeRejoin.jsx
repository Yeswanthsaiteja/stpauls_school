import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import { Search, RefreshCcw } from 'lucide-react';
import { listEmployees, rejoinEmployee } from '../../services/firebase/employeesService';
import { toast } from 'sonner';

const DEPARTMENTS = ['Primary', 'Secondary', 'Commerce', 'Science', 'Arts', 'Administration', 'Other'];
const ROLES = ['Teacher', 'Class Teacher', 'Principal', 'Vice Principal', 'Accountant', 'Librarian', 'Lab Assistant', 'Administrative', 'Support Staff'];
const EMP_TYPES = ['Permanent', 'Contract', 'Part-time'];

export default function EmployeeRejoin() {
  const navigate = useNavigate();
  const [removed, setRemoved] = useState([]);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    rejoinDate: new Date().toISOString().slice(0, 10),
    role: '',
    department: '',
    employmentType: 'Permanent',
    reason: 'Rehired after gap',
    keepOldId: true,
    newEmployeeId: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { listEmployees({ status: 'REMOVED' }).then(setRemoved); }, []);

  const matches = removed.filter(e =>
    q && `${e.fullName} ${e.employeeId}`.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 8);

  const onPick = (e) => {
    setPicked(e);
    setForm(f => ({ ...f, role: e.role || '', department: e.department || '', employmentType: e.employmentType || 'Permanent' }));
  };

  const confirm = async () => {
    if (!picked) return;
    setSaving(true);
    try {
      const empId = form.keepOldId
        ? picked.employeeId
        : (form.newEmployeeId || `EMP${Date.now().toString().slice(-6)}`);
      await rejoinEmployee(picked.id, {
        rejoinDate: form.rejoinDate,
        role: form.role || picked.role,
        designation: form.role || picked.role,
        department: form.department || picked.department,
        employmentType: form.employmentType,
        employeeId: empId,
        rejoinReason: form.reason,
      });
      toast.success(`${picked.fullName} reactivated · ${empId}`);
      setRemoved(list => list.filter(e => e.id !== picked.id));
      setPicked(null); setQ('');
      setTimeout(() => navigate('/dashboard/employees/directory'), 800);
    } catch {
      toast.error('Failed to rejoin employee. Please try again.');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="employee-rejoin">
      <NavLink to="/dashboard/employees" className="label-eyebrow text-primary">← Back to Employees</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Employee Rejoin</h1>

      {/* Search */}
      <div className="glass-morphism rounded-[2rem] p-5">
        <label className="label-eyebrow text-muted-foreground">
          Find Removed Employee ({removed.length} on record)
        </label>
        <div className="mt-1.5 flex items-center gap-2 px-3 h-11 rounded-2xl border border-border bg-card">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={e => { setQ(e.target.value); setPicked(null); }}
            placeholder="Search by name or employee ID…"
            className="flex-1 bg-transparent outline-none text-sm" />
        </div>
        {q && !picked && (
          <div className="mt-3 space-y-2">
            {matches.length === 0 && <div className="text-sm text-muted-foreground py-2">No removed employee found</div>}
            {matches.map(e => (
              <button key={e.id} onClick={() => onPick(e)}
                className="w-full text-left p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 grid place-items-center text-white font-black text-sm overflow-hidden flex-shrink-0">
                  {e.photoURL ? <img src={e.photoURL} alt="" className="h-full w-full object-cover" /> : (e.fullName?.[0] || 'E')}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm">{e.fullName}</div>
                  <div className="label-eyebrow text-muted-foreground">
                    {e.employeeId} · Left {e.leavingDate || '—'} · {e.removalReason || '—'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Rejoin form */}
      {picked && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="glass-morphism rounded-[2rem] p-6 space-y-4">

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
            <RefreshCcw className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-bold">{picked.fullName}</div>
              <div className="label-eyebrow text-muted-foreground">
                {picked.employeeId} · {picked.designation || picked.role} · {picked.department}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label-eyebrow text-muted-foreground">Rejoining Date</label>
              <input type="date" value={form.rejoinDate} onChange={e => set('rejoinDate', e.target.value)}
                className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" />
            </div>
            <div>
              <label className="label-eyebrow text-muted-foreground">Employment Type</label>
              <select value={form.employmentType} onChange={e => set('employmentType', e.target.value)}
                className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm">
                {EMP_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label-eyebrow text-muted-foreground">New Role</label>
              <select value={form.role} onChange={e => set('role', e.target.value)}
                className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm">
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label-eyebrow text-muted-foreground">Department</label>
              <select value={form.department} onChange={e => set('department', e.target.value)}
                className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm">
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>

            <div className="col-span-full">
              <label className="label-eyebrow text-muted-foreground">Reason for Rejoining</label>
              <textarea value={form.reason} onChange={e => set('reason', e.target.value)} rows={2}
                className="mt-1.5 w-full px-3 py-2 rounded-2xl border border-border bg-card text-sm resize-none" />
            </div>

            <label className="col-span-full flex items-center gap-2 text-sm font-bold cursor-pointer">
              <input type="checkbox" checked={form.keepOldId} onChange={e => set('keepOldId', e.target.checked)} className="accent-indigo-500" />
              Retain old employee ID ({picked.employeeId})
            </label>
            {!form.keepOldId && (
              <div className="col-span-full">
                <label className="label-eyebrow text-muted-foreground">New Employee ID</label>
                <input value={form.newEmployeeId} onChange={e => set('newEmployeeId', e.target.value)}
                  placeholder="Leave blank to auto-generate"
                  className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setPicked(null)} className="h-11 px-5 rounded-2xl bg-muted label-eyebrow">Cancel</button>
            <button onClick={confirm} disabled={saving}
              className="h-11 px-5 rounded-2xl bg-emerald-500 text-white label-eyebrow disabled:opacity-60">
              {saving ? 'Saving…' : 'Confirm Rejoin'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

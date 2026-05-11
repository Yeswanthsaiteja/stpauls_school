import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Plus, CalendarDays } from 'lucide-react';
import { demoStore } from '../services/demoStore';
import { toast } from 'sonner';

const LEAVE_TYPES = ['Casual', 'Sick', 'Emergency', 'Maternity', 'Paternity', 'Earned'];

export default function LeaveManagement() {
  const [list, setList] = useState(demoStore.list('leaveRequests'));
  const employees = demoStore.list('employees');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: employees[0]?.id || '', type: 'Casual', startDate: '', endDate: '', reason: '' });

  const refresh = () => setList(demoStore.list('leaveRequests'));

  const submit = () => {
    if (!form.startDate || !form.endDate) return toast.error('Dates required');
    const emp = employees.find((e) => e.id === form.employeeId);
    demoStore.add('leaveRequests', {
      ...form,
      employeeName: emp?.fullName,
      status: 'PENDING',
    });
    refresh();
    setOpen(false);
    setForm({ employeeId: employees[0]?.id || '', type: 'Casual', startDate: '', endDate: '', reason: '' });
    toast.success('Leave requested');
  };

  const decide = (id, status) => {
    demoStore.update('leaveRequests', id, { status });
    refresh();
    toast.success(`Leave ${status.toLowerCase()}`);
  };

  const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  list.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });

  return (
    <div className="space-y-6" data-testid="leave-management">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Leave Management</h1>
        <button onClick={() => setOpen(true)} className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2" data-testid="leave-new"><Plus className="h-3.5 w-3.5" />Request Leave</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-amber-500">Pending</div><div className="font-display font-black text-2xl tracking-tighter">{counts.PENDING}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-emerald-500">Approved</div><div className="font-display font-black text-2xl tracking-tighter">{counts.APPROVED}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-rose-500">Rejected</div><div className="font-display font-black text-2xl tracking-tighter">{counts.REJECTED || 0}</div></div>
      </div>

      <div className="space-y-3">
        {list.map((l) => (
          <motion.div key={l.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass-morphism rounded-[1.75rem] p-4">
            <div className="flex flex-wrap items-start gap-3 justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-bold">{l.employeeName}</div>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary label-eyebrow">{l.type}</span>
                  <span className={`px-2 py-0.5 rounded-full label-eyebrow ${l.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' : l.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>{l.status}</span>
                </div>
                <div className="label-eyebrow text-muted-foreground mt-1 flex items-center gap-1"><CalendarDays className="h-3 w-3" />{l.startDate} → {l.endDate}</div>
                <p className="text-sm mt-1">{l.reason}</p>
              </div>
              {l.status === 'PENDING' && (
                <div className="flex gap-2">
                  <button onClick={() => decide(l.id, 'APPROVED')} className="h-9 px-3 rounded-xl bg-emerald-500/10 text-emerald-600 label-eyebrow flex items-center gap-1.5" data-testid={`leave-approve-${l.id}`}><Check className="h-3.5 w-3.5" />Approve</button>
                  <button onClick={() => decide(l.id, 'REJECTED')} className="h-9 px-3 rounded-xl bg-rose-500/10 text-rose-600 label-eyebrow flex items-center gap-1.5" data-testid={`leave-reject-${l.id}`}><X className="h-3.5 w-3.5" />Reject</button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card rounded-[2rem] p-6 w-full max-w-md border border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="font-display font-black text-xl tracking-tighter">Request Leave</div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="leave-employee">
                {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </select>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="leave-type">
                {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="leave-start" />
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="leave-end" />
              </div>
              <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason" rows={3} className="w-full px-3 py-2 rounded-2xl border border-border bg-background text-sm" data-testid="leave-reason" />
              <button onClick={submit} className="w-full h-11 rounded-2xl bg-primary text-primary-foreground label-eyebrow" data-testid="leave-submit">Submit Request</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Check, X, Plus, CalendarDays, Loader2, RefreshCw } from 'lucide-react';
import {
  listLeaveRequests, addLeaveRequest, updateLeaveStatus, listEmployees,
} from '../services/firebase/employeesService';
import { addNotification } from '../services/firebase/notificationsService';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';
const LEAVE_TYPES = ['Casual', 'Sick', 'Emergency', 'Maternity', 'Paternity', 'Earned'];

export default function LeaveManagement() {
  const [list, setList] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ employeeId: '', employeeName: '', type: 'Casual', startDate: '', endDate: '', reason: '' });
  const unsubRef = useRef(null);

  useEffect(() => {
    listEmployees({ status: 'ACTIVE' }).then((emps) => {
      setEmployees(emps);
      if (emps.length > 0) setForm((f) => ({ ...f, employeeId: emps[0].id, employeeName: emps[0].fullName }));
    });

    // Real-time leave requests subscription
    if (isFirebaseConfigured && db) {
      try {
        const q = query(
          collection(db, 'leave_requests'),
          where('tenantId', '==', TENANT_ID)
        );
        unsubRef.current = onSnapshot(q, (snap) => {
          const data = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => {
              const ta = a.createdAt?.seconds || 0;
              const tb = b.createdAt?.seconds || 0;
              return tb - ta; // newest first
            });
          setList(data);
          setLoading(false);
        }, (err) => {
          console.error('[LeaveManagement] onSnapshot error:', err);
          // Fall back to one-time fetch
          listLeaveRequests().then(r => { setList(r); setLoading(false); });
        });
      } catch {
        listLeaveRequests().then(r => { setList(r); setLoading(false); });
      }
    } else {
      listLeaveRequests().then(r => { setList(r); setLoading(false); });
    }

    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  const submit = async () => {
    if (!form.startDate || !form.endDate) return toast.error('Dates required');
    if (!form.employeeId) return toast.error('Select employee');
    setSubmitting(true);
    try {
      const emp = employees.find((e) => e.id === form.employeeId);
      await addLeaveRequest({
        ...form,
        employeeId: form.employeeId,
        employeeName: emp?.fullName || form.employeeName,
        leaveType: form.type,
        fromDate: form.startDate,
        toDate: form.endDate,
        totalDays: Math.max(1, Math.ceil((new Date(form.endDate) - new Date(form.startDate)) / 86400000) + 1),
        status: 'PENDING',
      });
      // Real-time listener will automatically update the list
      setOpen(false);
      setForm({ employeeId: employees[0]?.id || '', employeeName: employees[0]?.fullName || '', type: 'Casual', startDate: '', endDate: '', reason: '' });
      toast.success('Leave requested');
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const decide = async (leave, status) => {
    try {
      await updateLeaveStatus(leave.id, { status, reviewedAt: new Date().toISOString() });
      // Real-time listener will update the list automatically.
      toast.success(`Leave ${status.toLowerCase()}`);

      // Send notification to the staff member
      if (leave.employeeId) {
        await addNotification({
          userId: leave.employeeId,    // staff Firestore doc ID
          type: 'leave_status',
          title: `Leave ${status === 'APPROVED' ? 'Approved ✓' : 'Rejected ✗'}`,
          body: `Your ${leave.leaveType || 'leave'} request (${leave.fromDate} → ${leave.toDate}) has been ${status.toLowerCase()}.`,
        });
      }
    } catch {
      toast.error('Failed to update leave status');
    }
  };

  const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  list.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });

  return (
    <div className="space-y-6" data-testid="leave-management">
      <NavLink to="/dashboard/attendance" className="label-eyebrow text-primary">← Back to Attendance</NavLink>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Leave Management</h1>
        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="label-eyebrow text-emerald-600">Live</span>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2"
            data-testid="leave-new"
          >
            <Plus className="h-3.5 w-3.5" />Request Leave
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-morphism rounded-2xl p-4">
          <div className="label-eyebrow text-amber-500">Pending</div>
          <div className="font-display font-black text-2xl tracking-tighter">{counts.PENDING}</div>
        </div>
        <div className="glass-morphism rounded-2xl p-4">
          <div className="label-eyebrow text-emerald-500">Approved</div>
          <div className="font-display font-black text-2xl tracking-tighter">{counts.APPROVED}</div>
        </div>
        <div className="glass-morphism rounded-2xl p-4">
          <div className="label-eyebrow text-rose-500">Rejected</div>
          <div className="font-display font-black text-2xl tracking-tighter">{counts.REJECTED || 0}</div>
        </div>
      </div>

      {loading && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      <div className="space-y-3">
        {list.map((l) => (
          <motion.div key={l.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass-morphism rounded-[1.75rem] p-4">
            <div className="flex flex-wrap items-start gap-3 justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-bold">{l.employeeName}</div>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary label-eyebrow">{l.leaveType || l.type}</span>
                  <span className={`px-2 py-0.5 rounded-full label-eyebrow ${
                    l.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500'
                    : l.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-500'
                    : 'bg-amber-500/10 text-amber-500'
                  }`}>{l.status || 'PENDING'}</span>
                  {l.totalDays && <span className="label-eyebrow text-muted-foreground">{l.totalDays} day{l.totalDays !== 1 ? 's' : ''}</span>}
                </div>
                <div className="label-eyebrow text-muted-foreground mt-1 flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />{l.fromDate || l.startDate} → {l.toDate || l.endDate}
                </div>
                {l.reason && <p className="text-sm mt-1 text-muted-foreground">{l.reason}</p>}
                {l.department && <p className="label-eyebrow text-muted-foreground mt-1">{l.department}</p>}
              </div>
              {(l.status === 'PENDING' || !l.status) && (
                <div className="flex gap-2">
                  <button
                    onClick={() => decide(l, 'APPROVED')}
                    className="h-9 px-3 rounded-xl bg-emerald-500/10 text-emerald-600 label-eyebrow flex items-center gap-1.5 hover:bg-emerald-500/20 transition-colors"
                    data-testid={`leave-approve-${l.id}`}
                  >
                    <Check className="h-3.5 w-3.5" />Approve
                  </button>
                  <button
                    onClick={() => decide(l, 'REJECTED')}
                    className="h-9 px-3 rounded-xl bg-rose-500/10 text-rose-600 label-eyebrow flex items-center gap-1.5 hover:bg-rose-500/20 transition-colors"
                    data-testid={`leave-reject-${l.id}`}
                  >
                    <X className="h-3.5 w-3.5" />Reject
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {!loading && list.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10">
            No leave requests found. Staff can apply from their dashboard.
          </div>
        )}
      </div>

      {/* Add Leave Modal */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-card rounded-[2rem] p-6 w-full max-w-md border border-border shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="font-display font-black text-xl tracking-tighter">Request Leave (on behalf)</div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label-eyebrow text-muted-foreground">Employee</label>
                <select value={form.employeeId}
                  onChange={(e) => { const emp = employees.find((x) => x.id === e.target.value); setForm({ ...form, employeeId: e.target.value, employeeName: emp?.fullName || '' }); }}
                  className="mt-1 w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm"
                  data-testid="leave-employee">
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="label-eyebrow text-muted-foreground">Leave Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="mt-1 w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm"
                  data-testid="leave-type">
                  {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label-eyebrow text-muted-foreground">From</label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="mt-1 w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="leave-start" />
                </div>
                <div>
                  <label className="label-eyebrow text-muted-foreground">To</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="mt-1 w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="leave-end" />
                </div>
              </div>
              <div>
                <label className="label-eyebrow text-muted-foreground">Reason</label>
                <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Reason for leave" rows={3}
                  className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-sm"
                  data-testid="leave-reason" />
              </div>
              <button onClick={submit} disabled={submitting}
                className="w-full h-11 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center justify-center gap-2 disabled:opacity-60"
                data-testid="leave-submit">
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Submit Request
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

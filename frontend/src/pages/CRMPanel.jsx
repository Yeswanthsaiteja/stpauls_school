import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { demoStore } from '../services/demoStore';
import { toast } from 'sonner';

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export default function CRMPanel() {
  const [list, setList] = useState(demoStore.list('tickets'));
  const [filter, setFilter] = useState('ALL');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', priority: 'MEDIUM', category: 'General' });

  const counts = STATUSES.reduce((a, s) => ({ ...a, [s]: list.filter((x) => x.status === s).length }), {});

  const create = () => {
    if (!form.title) return toast.error('Title required');
    const row = demoStore.add('tickets', { ...form, status: 'OPEN', ticketNo: `TKT${1000 + list.length + 1}`, createdByName: 'Asha Reddy' });
    setList((l) => [row, ...l]);
    setForm({ title: '', message: '', priority: 'MEDIUM', category: 'General' });
    setOpen(false);
    toast.success('Ticket created');
  };

  const updateStatus = (id, status) => {
    demoStore.update('tickets', id, { status });
    setList(demoStore.list('tickets'));
  };

  const filtered = filter === 'ALL' ? list : list.filter((x) => x.status === filter);

  const priColor = (p) => p === 'HIGH' ? 'bg-rose-500/10 text-rose-500' : p === 'MEDIUM' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-slate-500';
  const stColor = (s) => s === 'OPEN' ? 'bg-blue-500/10 text-blue-500' : s === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-500' : s === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500';

  return (
    <div className="space-y-6" data-testid="crm-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tighter uppercase">CRM · Tickets</h1>
        <button onClick={() => setOpen(true)} data-testid="crm-new-btn" className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2"><Plus className="h-3.5 w-3.5" />New Ticket</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUSES.map((s) => (
          <div key={s} className="glass-morphism rounded-2xl p-4">
            <div className="label-eyebrow text-muted-foreground">{s.replace('_', ' ')}</div>
            <div className="font-display font-black text-2xl tracking-tighter mt-1">{counts[s] || 0}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {['ALL', ...STATUSES].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-full label-eyebrow ${filter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{s.replace('_', ' ')}</button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-morphism rounded-[1.75rem] p-4">
            <div className="flex flex-wrap items-start gap-3 justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-muted-foreground">{t.ticketNo}</span>
                  <span className={`px-2 py-0.5 rounded-full label-eyebrow ${priColor(t.priority)}`}>{t.priority}</span>
                  <span className={`px-2 py-0.5 rounded-full label-eyebrow ${stColor(t.status)}`}>{t.status.replace('_', ' ')}</span>
                </div>
                <div className="font-bold mt-1.5">{t.title}</div>
                <p className="text-sm text-muted-foreground mt-1">{t.message}</p>
                <div className="label-eyebrow text-muted-foreground mt-2">By {t.createdByName} · {t.category}</div>
              </div>
              <select value={t.status} onChange={(e) => updateStatus(t.id, e.target.value)} className="h-9 px-3 rounded-2xl border border-border bg-card text-xs font-bold" data-testid={`ticket-status-${t.id}`}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </motion.div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card rounded-[2rem] p-6 w-full max-w-md border border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="font-display font-black text-xl tracking-tighter">New Ticket</div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" data-testid="ticket-title" className="w-full h-11 px-4 rounded-2xl border border-border bg-background text-sm outline-none focus:border-primary" />
              <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Describe the issue" rows={3} data-testid="ticket-msg" className="w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-sm outline-none focus:border-primary" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-11 px-4 rounded-2xl border border-border bg-background text-sm">
                  <option>General</option><option>Finance</option><option>Transport</option><option>Admin</option>
                </select>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-11 px-4 rounded-2xl border border-border bg-background text-sm">
                  <option>LOW</option><option>MEDIUM</option><option>HIGH</option>
                </select>
              </div>
              <button onClick={create} data-testid="ticket-submit" className="w-full h-11 rounded-2xl bg-primary text-primary-foreground label-eyebrow">Create</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

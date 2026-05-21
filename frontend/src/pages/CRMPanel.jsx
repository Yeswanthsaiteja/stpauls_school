import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, RefreshCw, Headset } from 'lucide-react';
import { listTickets, addTicket, updateTicketStatus } from '../services/firebase/crmService';
import { addNotification } from '../services/firebase/notificationsService';
import { toast } from 'sonner';

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];
const CATEGORIES = ['Finance', 'Transport', 'Academics', 'Hostel', 'Admission', 'Technical', 'General'];

const STATUS_STYLES = {
  OPEN: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
  IN_PROGRESS: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  RESOLVED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  CLOSED: 'bg-muted text-muted-foreground border-border',
};
const PRIORITY_STYLES = {
  HIGH: 'bg-rose-500/10 text-rose-600',
  MEDIUM: 'bg-amber-500/10 text-amber-600',
  LOW: 'bg-slate-500/10 text-slate-500',
};

export default function CRMPanel() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', priority: 'MEDIUM', category: 'General', createdByName: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listTickets(filter !== 'ALL' ? { status: filter } : {});
    setList(data);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const counts = STATUSES.reduce((a, s) => ({ ...a, [s]: list.filter((x) => x.status === s).length }), {});

  const create = async () => {
    if (!form.title.trim()) return toast.error('Title required');
    setSaving(true);
    try {
      const row = await addTicket({ ...form });
      if (row) {
        setList((l) => [row, ...l]);
        toast.success(`Ticket ${row.ticketNo} created`);
      } else {
        toast.error('Firebase not configured. Please check your setup.');
      }
      setForm({ title: '', message: '', priority: 'MEDIUM', category: 'General', createdByName: '' });
      setOpen(false);
    } catch {
      toast.error('Failed to create ticket. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const [resolutionMap, setResolutionMap] = useState({});

  const changeStatus = async (id, status) => {
    const ticket = list.find(t => t.id === id);
    const resolution = resolutionMap[id] || '';
    await updateTicketStatus(id, status, resolution);
    setList(l => l.map(t => t.id === id ? { ...t, status, resolution } : t));
    toast.success('Status updated');
    // Notify parent if they raised the ticket
    if (ticket?.raisedBy) {
      const parentUserId = `phone_${ticket.raisedBy.replace(/\D/g, '')}`;
      await addNotification({
        userId: parentUserId,
        type: 'ticket_update',
        title: `Ticket ${ticket.ticketNo || ''} Updated`,
        body: `Your support ticket "${ticket.title}" is now ${status.replace('_', ' ')}.${resolution ? ` Resolution: ${resolution}` : ''}`,
      });
    }
  };

  const filtered = filter === 'ALL' ? list : list.filter(t => t.status === filter);

  return (
    <div className="space-y-6" data-testid="crm-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Support & CRM</h1>
        <div className="flex items-center gap-2">
          <button onClick={load} className="h-9 w-9 rounded-xl bg-muted grid place-items-center hover:bg-muted/80">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setOpen(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-primary-foreground label-eyebrow hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> New Ticket
          </button>
        </div>
      </div>

      {/* Status count chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUSES.map((s) => (
          <motion.div key={s} whileHover={{ y: -3 }} className={`glass-morphism rounded-2xl p-4 cursor-pointer border ${filter === s ? 'border-primary' : 'border-transparent'}`}
            onClick={() => setFilter(filter === s ? 'ALL' : s)}>
            <div className="label-eyebrow text-muted-foreground">{s.replace('_', ' ')}</div>
            <div className="font-display font-black text-3xl tracking-tighter mt-1">{counts[s] || 0}</div>
          </motion.div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', ...STATUSES].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full label-eyebrow transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Loading tickets…</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="glass-morphism rounded-[2rem] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="label-eyebrow text-muted-foreground">{t.ticketNo}</span>
                    <span className={`px-2 py-0.5 rounded-full label-eyebrow ${PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.MEDIUM}`}>{t.priority}</span>
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary label-eyebrow">{t.category}</span>
                  </div>
                  <div className="font-bold text-base">{t.title}</div>
                  {t.message && <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.message}</div>}
                  {(t.createdByName || t.parentName) && <div className="label-eyebrow text-muted-foreground mt-2">By: {t.createdByName || t.parentName} {t.studentName ? `· for ${t.studentName}` : ''}</div>}
                  {t.resolution && <div className="mt-1 text-xs text-emerald-700 bg-emerald-500/10 px-2 py-1 rounded-lg">Resolution: {t.resolution}</div>}
                </div>
                <div className="flex flex-col items-end gap-2 min-w-[140px]">
                  <span className={`px-3 py-1 rounded-full label-eyebrow border ${STATUS_STYLES[t.status] || STATUS_STYLES.OPEN}`}>{t.status.replace('_', ' ')}</span>
                  {t.status !== 'CLOSED' && (
                    <>
                      <input
                        value={resolutionMap[t.id] || ''}
                        onChange={e => setResolutionMap(m => ({ ...m, [t.id]: e.target.value }))}
                        placeholder="Resolution note…"
                        className="text-xs px-2 py-1 rounded-xl border border-border bg-card w-full outline-none"
                      />
                      <select value={t.status} onChange={e => changeStatus(t.id, e.target.value)}
                        className="text-xs px-2 py-1 rounded-xl border border-border bg-card w-full">
                        {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && !loading && (
            <div className="glass-morphism rounded-[2rem] p-10 text-center text-muted-foreground">
              <Headset className="h-10 w-10 mx-auto mb-3 opacity-30" />
              No tickets {filter !== 'ALL' ? `with status "${filter}"` : 'yet'}
            </div>
          )}
        </div>
      )}

      {/* New Ticket Modal */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4"
            onClick={e => e.target === e.currentTarget && setOpen(false)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="glass-morphism rounded-[2rem] p-6 w-full max-w-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-display font-black text-2xl tracking-tighter">New Ticket</div>
                <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-xl bg-muted grid place-items-center hover:bg-muted/80"><X className="h-4 w-4" /></button>
              </div>
              {[
                { label: 'Your Name', key: 'createdByName', placeholder: 'Parent / Staff name' },
                { label: 'Subject / Title*', key: 'title', placeholder: 'Briefly describe the issue' },
              ].map(f => (
                <div key={f.key}>
                  <label className="label-eyebrow text-muted-foreground">{f.label}</label>
                  <input type="text" value={form[f.key]} onChange={e => setForm(d => ({...d, [f.key]: e.target.value}))}
                    placeholder={f.placeholder}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary" />
                </div>
              ))}
              <div>
                <label className="label-eyebrow text-muted-foreground">Details</label>
                <textarea value={form.message} onChange={e => setForm(d => ({...d, message: e.target.value}))}
                  rows={3} placeholder="Provide full details…"
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-eyebrow text-muted-foreground">Priority</label>
                  <select value={form.priority} onChange={e => setForm(d => ({...d, priority: e.target.value}))}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm">
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-eyebrow text-muted-foreground">Category</label>
                  <select value={form.category} onChange={e => setForm(d => ({...d, category: e.target.value}))}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={create} disabled={saving}
                  className="flex-1 h-11 rounded-2xl bg-primary text-primary-foreground label-eyebrow disabled:opacity-60">
                  {saving ? 'Creating…' : 'Create Ticket'}
                </button>
                <button onClick={() => setOpen(false)} className="h-11 px-5 rounded-2xl bg-muted label-eyebrow">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

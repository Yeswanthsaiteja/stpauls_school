import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { BedDouble, Users, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { listRooms, addRoom } from '../services/firebase/hostelService';
import { toast } from 'sonner';

export default function Hostel() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ block: 'A', number: '', type: 'BOYS', capacity: 4, floor: 1 });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('ALL');

  const load = async () => {
    setLoading(true);
    const data = await listRooms();
    setRooms(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'ALL' ? rooms : rooms.filter(r => r.type === filter);
  const total = rooms.reduce((s, r) => s + (r.capacity || 0), 0);
  const occupied = rooms.reduce((s, r) => s + (r.occupied || 0), 0);
  const pct = total ? Math.round((occupied / total) * 100) : 0;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.number) return toast.error('Room number is required');
    if (saving) return; setSaving(true);
    try {
      const row = await addRoom({ ...form, capacity: Number(form.capacity), floor: Number(form.floor) });
      if (row) {
        setRooms(r => [...r, row]);
        toast.success('Room added to Firestore');
      } else {
        toast.error('Firebase not configured. Please check your setup.');
      }
      setShowAdd(false);
      setForm({ block: 'A', number: '', type: 'BOYS', capacity: 4, floor: 1 });
    } catch {
      toast.error('Failed to add room. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="hostel-module">
      <NavLink to="/dashboard" className="label-eyebrow text-primary">← Back to Dashboard</NavLink>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Hostel</h1>
        <div className="flex items-center gap-2">
          <button onClick={load} className="h-9 w-9 rounded-xl bg-muted grid place-items-center hover:bg-muted/80" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-primary-foreground label-eyebrow hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> Add Room
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-morphism rounded-[2rem] p-5">
          <div className="label-eyebrow text-muted-foreground">Total Rooms</div>
          <div className="font-display font-black text-3xl tracking-tighter mt-1">{rooms.length}</div>
        </div>
        <div className="glass-morphism rounded-[2rem] p-5">
          <div className="label-eyebrow text-muted-foreground">Total Capacity</div>
          <div className="font-display font-black text-3xl tracking-tighter mt-1">{total}</div>
        </div>
        <div className="glass-morphism rounded-[2rem] p-5">
          <div className="label-eyebrow text-emerald-500">Occupied</div>
          <div className="font-display font-black text-3xl tracking-tighter mt-1">{occupied}</div>
        </div>
        <div className="glass-morphism rounded-[2rem] p-5">
          <div className="label-eyebrow text-muted-foreground">Occupancy</div>
          <div className="font-display font-black text-3xl tracking-tighter mt-1">{pct}%</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['ALL', 'BOYS', 'GIRLS'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full label-eyebrow transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {f === 'ALL' ? 'All Rooms' : f === 'BOYS' ? '🚹 Boys' : '🚺 Girls'}
          </button>
        ))}
      </div>

      {/* Add Room form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="glass-morphism rounded-[2rem] p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="col-span-full label-eyebrow text-primary mb-1">Add New Room</div>
          {[
            { label: 'Block', key: 'block', placeholder: 'A, B, C…' },
            { label: 'Room Number*', key: 'number', placeholder: '101' },
            { label: 'Floor', key: 'floor', type: 'number', placeholder: '1' },
            { label: 'Capacity', key: 'capacity', type: 'number', placeholder: '4' },
          ].map(f => (
            <div key={f.key}>
              <label className="label-eyebrow text-muted-foreground">{f.label}</label>
              <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm(d => ({...d, [f.key]: e.target.value}))}
                placeholder={f.placeholder}
                className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary" />
            </div>
          ))}
          <div>
            <label className="label-eyebrow text-muted-foreground">Type</label>
            <select value={form.type} onChange={e => setForm(d => ({...d, type: e.target.value}))}
              className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm">
              <option value="BOYS">Boys</option>
              <option value="GIRLS">Girls</option>
            </select>
          </div>
          <div className="col-span-full flex gap-2">
            <button type="submit" disabled={saving} className="h-10 px-5 rounded-xl bg-primary text-primary-foreground label-eyebrow disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Room'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="h-10 px-5 rounded-xl bg-muted label-eyebrow">Cancel</button>
          </div>
        </form>
      )}

      {/* Room grid */}
      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Loading rooms…</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filtered.map((r, i) => {
            const full = r.occupied >= r.capacity;
            const partial = r.occupied > 0 && !full;
            return (
              <motion.div key={r.id} whileHover={{ y: -4, scale: 1.04 }}
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }}
                className={`rounded-3xl p-4 border-2 cursor-pointer ${full ? 'border-rose-500/40 bg-rose-500/5' : partial ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/40 bg-emerald-500/5'}`}>
                <div className="flex items-center justify-between">
                  <BedDouble className={`h-5 w-5 ${full ? 'text-rose-500' : partial ? 'text-amber-500' : 'text-emerald-500'}`} />
                  <span className="label-eyebrow text-muted-foreground">{r.type === 'GIRLS' ? '🚺' : '🚹'}{r.block}</span>
                </div>
                <div className="font-display font-black text-2xl tracking-tighter mt-3">{r.number}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Users className="h-3 w-3" />{r.occupied}/{r.capacity}
                </div>
                <div className={`mt-2 text-[9px] font-black uppercase tracking-widest ${full ? 'text-rose-500' : partial ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {full ? 'Full' : partial ? 'Partial' : 'Available'}
                </div>
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full glass-morphism rounded-[2rem] p-10 text-center text-muted-foreground">
              <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
              No rooms found. Click "Add Room" to get started.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { motion } from 'framer-motion';
import { BedDouble, Users, Sparkles } from 'lucide-react';
import { demoStore } from '../services/demoStore';

export default function Hostel() {
  const rooms = demoStore.list('hostelRooms');
  const total = rooms.reduce((s, r) => s + r.capacity, 0);
  const occupied = rooms.reduce((s, r) => s + r.occupied, 0);
  const pct = total ? Math.round((occupied / total) * 100) : 0;

  return (
    <div className="space-y-6" data-testid="hostel-module">
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Hostel</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-morphism rounded-[2rem] p-5"><div className="label-eyebrow text-muted-foreground">Rooms</div><div className="font-display font-black text-3xl tracking-tighter mt-1">{rooms.length}</div></div>
        <div className="glass-morphism rounded-[2rem] p-5"><div className="label-eyebrow text-muted-foreground">Capacity</div><div className="font-display font-black text-3xl tracking-tighter mt-1">{total}</div></div>
        <div className="glass-morphism rounded-[2rem] p-5"><div className="label-eyebrow text-emerald-500">Occupied</div><div className="font-display font-black text-3xl tracking-tighter mt-1">{occupied}</div></div>
        <div className="glass-morphism rounded-[2rem] p-5"><div className="label-eyebrow text-muted-foreground">Occupancy</div><div className="font-display font-black text-3xl tracking-tighter mt-1">{pct}%</div></div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {rooms.map((r, i) => {
          const full = r.occupied >= r.capacity;
          const partial = r.occupied > 0 && !full;
          return (
            <motion.div key={r.id} whileHover={{ y: -4, scale: 1.04 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }} className={`rounded-3xl p-4 border-2 ${full ? 'border-rose-500/40 bg-rose-500/5' : partial ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/40 bg-emerald-500/5'}`}>
              <div className="flex items-center justify-between">
                <BedDouble className={`h-5 w-5 ${full ? 'text-rose-500' : partial ? 'text-amber-500' : 'text-emerald-500'}`} />
                <span className="label-eyebrow text-muted-foreground">{r.block}</span>
              </div>
              <div className="font-display font-black text-2xl tracking-tighter mt-3">{r.number}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Users className="h-3 w-3" />{r.occupied}/{r.capacity}</div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

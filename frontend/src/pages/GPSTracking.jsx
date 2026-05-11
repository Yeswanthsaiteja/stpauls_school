import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { MapPin, Bus, Navigation, Phone } from 'lucide-react';
import { demoStore } from '../services/demoStore';

export default function GPSTracking() {
  const routes = demoStore.list('transportRoutes');
  const [active, setActive] = useState(routes[0]);
  const [pos, setPos] = useState({ x: 30, y: 50 });

  useEffect(() => {
    const t = setInterval(() => {
      setPos((p) => ({ x: Math.min(85, p.x + (Math.random() * 4 - 1)), y: 40 + Math.sin(Date.now() / 1000) * 12 }));
    }, 1500);
    return () => clearInterval(t);
  }, [active]);

  return (
    <div className="space-y-5" data-testid="gps-tracking">
      <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">GPS Tracking</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 relative rounded-[2rem] overflow-hidden bg-slate-900 text-white aspect-[16/10]">
          {/* Decorative map */}
          <div className="absolute inset-0 grid-bg opacity-30" />
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 60">
            <path d="M 10 50 C 20 40, 30 30, 45 35 S 70 50, 90 30" stroke="#6366f1" strokeWidth="0.8" fill="none" strokeDasharray="2 1" />
            <path d="M 5 20 C 25 25, 50 15, 95 25" stroke="#a5b4fc" strokeWidth="0.4" fill="none" />
          </svg>
          {/* stops */}
          {(active?.stops || []).map((s, i, arr) => (
            <div key={s} className="absolute" style={{ left: `${10 + (i / (arr.length - 1)) * 80}%`, top: `${50 - Math.sin(i) * 10}%` }}>
              <div className="h-3 w-3 rounded-full bg-amber-400 ring-4 ring-amber-400/30" />
              <div className="label-eyebrow text-white/70 mt-1 -translate-x-1/2 whitespace-nowrap">{s}</div>
            </div>
          ))}
          {/* Bus marker */}
          <motion.div animate={{ left: `${pos.x}%`, top: `${pos.y}%` }} transition={{ duration: 1.5, ease: 'linear' }} className="absolute -translate-x-1/2 -translate-y-1/2">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500 grid place-items-center text-white shadow-lg shadow-emerald-500/50 animate-pulse-glow">
              <Bus className="h-5 w-5" />
            </div>
          </motion.div>
          <div className="absolute bottom-4 left-4 px-3 py-2 rounded-2xl bg-black/60 backdrop-blur label-eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block mr-2 animate-pulse" />Live · Updated 2s ago
          </div>
        </div>

        <div className="space-y-3">
          <div className="glass-morphism rounded-[2rem] p-5">
            <div className="label-eyebrow text-muted-foreground mb-3">Active Route</div>
            <div className="space-y-2">
              {routes.map((r) => (
                <button key={r.id} onClick={() => setActive(r)} className={`w-full text-left p-3 rounded-2xl ${active?.id === r.id ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30 hover:bg-muted/60'}`} data-testid={`gps-route-${r.id}`}>
                  <div className="flex items-center gap-2">
                    <Navigation className={`h-4 w-4 ${active?.id === r.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="font-bold text-sm">Route {r.code}</div>
                  </div>
                  <div className="label-eyebrow text-muted-foreground mt-1">{r.bus} · {r.driver}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="glass-morphism rounded-[2rem] p-5">
            <div className="label-eyebrow text-muted-foreground">ETA Next Stop</div>
            <div className="font-display font-black text-3xl tracking-tighter mt-1">04:30</div>
            <div className="flex items-center gap-2 mt-3">
              <div className="h-9 w-9 rounded-2xl bg-emerald-500/10 grid place-items-center"><Phone className="h-4 w-4 text-emerald-500" /></div>
              <div className="flex-1 text-xs">Call driver · <span className="font-mono font-bold">+91 98********</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

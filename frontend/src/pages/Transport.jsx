import React from 'react';
import { motion } from 'framer-motion';
import { Bus, MapPin, Clock, Users, Navigation } from 'lucide-react';
import { demoStore } from '../services/demoStore';

export default function Transport() {
  const routes = demoStore.list('transportRoutes');

  return (
    <div className="space-y-6" data-testid="transport-module">
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Transport</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: 'Fleet', v: routes.length || 6, c: 'from-indigo-500 to-violet-500', icon: Bus },
          { l: 'On-Route', v: 4, c: 'from-emerald-500 to-teal-500', icon: Navigation },
          { l: 'Riders', v: 312, c: 'from-amber-500 to-orange-500', icon: Users },
          { l: 'Avg ETA', v: '14m', c: 'from-rose-500 to-pink-500', icon: Clock },
        ].map((s, i) => (
          <motion.div key={i} whileHover={{ y: -5, scale: 1.02 }} className="glass-morphism rounded-[2rem] p-5">
            <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${s.c} grid place-items-center text-white`}><s.icon className="h-5 w-5" /></div>
            <div className="mt-4 label-eyebrow text-muted-foreground">{s.l}</div>
            <div className="font-display font-black text-3xl tracking-tighter">{s.v}</div>
          </motion.div>
        ))}
      </div>

      <div className="space-y-3">
        {routes.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-morphism rounded-[2rem] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 grid place-items-center text-white"><Bus className="h-5 w-5" /></div>
                <div>
                  <div className="font-display font-black text-lg tracking-tighter">Route {r.code}</div>
                  <div className="label-eyebrow text-muted-foreground">Driver {r.driver} · {r.bus}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 label-eyebrow flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{r.status}</span>
                <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary label-eyebrow">{r.riders} riders</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              {r.stops.map((s, idx) => (
                <React.Fragment key={s}>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50">
                    <MapPin className="h-3 w-3 text-primary" />
                    <span className="label-eyebrow">{s}</span>
                  </div>
                  {idx < r.stops.length - 1 && <span className="text-muted-foreground">→</span>}
                </React.Fragment>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

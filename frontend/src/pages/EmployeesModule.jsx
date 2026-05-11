import React from 'react';
import { motion } from 'framer-motion';
import { demoStore } from '../services/demoStore';

const cardColor = (i) => ['from-indigo-500 to-violet-500','from-emerald-500 to-teal-500','from-amber-500 to-orange-500','from-rose-500 to-pink-500','from-cyan-500 to-blue-500'][i % 5];

export default function EmployeesModule() {
  const list = demoStore.list('employees');
  const onDuty = list.filter((e) => e.status === 'ACTIVE').length;
  return (
    <div className="space-y-6" data-testid="employees-module">
      <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tighter uppercase">Human Capital</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { l: 'Deployed', v: onDuty, c: 'text-emerald-500' },
          { l: 'Off-duty', v: 2, c: 'text-amber-500' },
          { l: 'In Transit', v: 1, c: 'text-indigo-500' },
        ].map((s, i) => (
          <motion.div whileHover={{ y: -5 }} key={i} className="glass-morphism rounded-[2rem] p-5">
            <div className="label-eyebrow text-muted-foreground">{s.l}</div>
            <div className={`font-display font-black text-4xl tracking-tighter mt-2 ${s.c}`}>{s.v}</div>
          </motion.div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((e, i) => (
          <motion.div key={e.id} whileHover={{ y: -3 }} className="glass-morphism rounded-[1.75rem] p-4 flex items-center gap-3">
            <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${cardColor(i)} grid place-items-center text-white font-black`}>{e.fullName[0]}</div>
            <div className="flex-1">
              <div className="font-bold text-sm">{e.fullName}</div>
              <div className="label-eyebrow text-muted-foreground">{e.designation} · {e.department}</div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 label-eyebrow">{e.status}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

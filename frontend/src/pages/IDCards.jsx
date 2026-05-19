import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Printer, Download } from 'lucide-react';

import { useTenant } from '../contexts/TenantContext';

export default function IDCards() {
  const [students, setStudents] = React.useState([]);
  React.useEffect(() => { import('../services/firebase/studentsService').then(m => m.listStudents({ status: 'ACTIVE' }).then(setStudents)); }, []);
  const { tenant } = useTenant();
  const [sel, setSel] = useState(students.slice(0, 4).map((s) => s.id));
  const [template, setTemplate] = useState('indigo');

  const toggle = (id) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const cards = students.filter((s) => sel.includes(s.id));

  const variants = {
    indigo: 'from-indigo-600 via-violet-600 to-fuchsia-600',
    emerald: 'from-emerald-600 via-teal-600 to-cyan-600',
    rose: 'from-rose-600 via-pink-600 to-fuchsia-600',
    slate: 'from-slate-800 via-slate-900 to-black',
  };

  const print = () => window.print();

  return (
    <div className="space-y-6" data-testid="id-cards">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display font-black text-3xl tracking-tighter uppercase">ID Cards</h1>
        <div className="flex gap-2">
          <div className="flex bg-muted rounded-full p-1">
            {Object.keys(variants).map((k) => (
              <button key={k} onClick={() => setTemplate(k)} className={`px-3 py-1.5 rounded-full label-eyebrow ${template === k ? 'bg-background shadow' : 'text-muted-foreground'}`} data-testid={`tmpl-${k}`}>{k}</button>
            ))}
          </div>
          <button onClick={print} className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2" data-testid="id-print-btn">
            <Printer className="h-3.5 w-3.5" />Print
          </button>
        </div>
      </div>

      <div className="glass-morphism rounded-[2rem] p-5">
        <div className="label-eyebrow text-muted-foreground mb-3">Select Students · {sel.length} selected</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {students.map((s) => (
            <label key={s.id} className={`p-3 rounded-2xl border cursor-pointer flex items-center gap-2 ${sel.includes(s.id) ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <input type="checkbox" checked={sel.includes(s.id)} onChange={() => toggle(s.id)} className="accent-indigo-500" data-testid={`sel-${s.id}`} />
              <div className="text-sm font-bold truncate">{s.fullName}</div>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-3">
        {cards.map((s) => (
          <motion.div key={s.id} whileHover={{ y: -4, scale: 1.02 }} className={`rounded-[2rem] p-5 bg-gradient-to-br ${variants[template]} text-white shadow-2xl relative overflow-hidden`}>
            <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="label-eyebrow text-white/70">{tenant?.name || 'School'}</div>
                <div className="font-display font-black text-xs tracking-tighter mt-0.5">STUDENT ID</div>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-white/20 grid place-items-center font-black">{s.firstName[0]}</div>
            </div>
            <div className="relative mt-5">
              <div className="font-display font-black text-xl tracking-tighter leading-tight">{s.fullName}</div>
              <div className="label-eyebrow text-white/80 mt-1">{s.admissionNo}</div>
              <div className="flex gap-2 mt-3 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-white/15 label-eyebrow">Class {s.className}-{s.section}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-white/15 label-eyebrow">Roll {s.rollNo}</span>
              </div>
            </div>
            <div className="relative mt-5 pt-4 border-t border-white/15 flex items-center justify-between">
              <div className="label-eyebrow text-white/60">Valid 2025-26</div>
              <div className="h-8 w-8 rounded bg-white/20 grid place-items-center text-[8px] font-black">QR</div>
            </div>
          </motion.div>
        ))}
      </div>

      <style>{`@media print { aside, header { display: none !important; } main { padding: 0 !important; } .print\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); } }`}</style>
    </div>
  );
}

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { demoStore } from '../../services/demoStore';
import { CLASS_OPTIONS } from '../../lib/pdfUtils';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

export default function FeeSetup() {
  const [cats, setCats] = useState(demoStore.list('feeCategories'));
  const [installments, setInstallments] = useState(demoStore.list('feeInstallments'));
  const [newCat, setNewCat] = useState({ name: '', type: 'recurring', amount: 0 });

  const addCategory = () => {
    if (!newCat.name) return toast.error('Name required');
    const row = demoStore.add('feeCategories', { ...newCat, amounts: { default: Number(newCat.amount) } });
    setCats((c) => [row, ...c]);
    setNewCat({ name: '', type: 'recurring', amount: 0 });
    toast.success('Category added');
  };
  const removeCat = (id) => { demoStore.remove('feeCategories', id); setCats(demoStore.list('feeCategories')); };

  const updateAmount = (catId, klass, val) => {
    const cat = demoStore.list('feeCategories').find((c) => c.id === catId);
    if (!cat) return;
    const patch = { amounts: { ...(cat.amounts || {}), [klass]: Number(val) || 0 } };
    demoStore.update('feeCategories', catId, patch);
    setCats(demoStore.list('feeCategories'));
  };

  return (
    <div className="space-y-6" data-testid="fee-setup">
      <NavLink to="/dashboard/finance" className="label-eyebrow text-primary">← Back to Finance</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Fee Setup</h1>

      {/* Add category */}
      <div className="glass-morphism rounded-[2rem] p-5">
        <div className="label-eyebrow text-muted-foreground mb-3">Add Fee Category</div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} placeholder="Category name" className="h-11 px-4 rounded-2xl border border-border bg-card text-sm" data-testid="fs-cat-name" />
          <select value={newCat.type} onChange={(e) => setNewCat({ ...newCat, type: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="fs-cat-type">
            <option value="recurring">Recurring</option>
            <option value="one-time">One-time</option>
          </select>
          <input type="number" value={newCat.amount} onChange={(e) => setNewCat({ ...newCat, amount: e.target.value })} placeholder="Default amount" className="h-11 px-4 rounded-2xl border border-border bg-card text-sm" data-testid="fs-cat-amount" />
          <button onClick={addCategory} className="h-11 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center justify-center gap-2" data-testid="fs-add-cat"><Plus className="h-3.5 w-3.5" />Add</button>
        </div>
      </div>

      {/* Categories list with per-class amounts */}
      <div className="space-y-3">
        {cats.map((c) => (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key={c.id} className="glass-morphism rounded-[2rem] p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-display font-black text-lg tracking-tighter">{c.name}</div>
                <div className="label-eyebrow text-muted-foreground">{c.type}</div>
              </div>
              <button onClick={() => removeCat(c.id)} className="p-2 rounded-xl hover:bg-rose-500/10 hover:text-rose-500" data-testid={`fs-del-${c.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <div className="overflow-x-auto thin-scrollbar">
              <div className="flex gap-2 min-w-max">
                {['default', ...CLASS_OPTIONS].map((k) => (
                  <div key={k} className="flex flex-col">
                    <label className="label-eyebrow text-muted-foreground">{k}</label>
                    <input
                      type="number"
                      defaultValue={c.amounts?.[k] || 0}
                      onBlur={(e) => updateAmount(c.id, k, e.target.value)}
                      className="mt-1 w-28 h-10 px-3 rounded-2xl border border-border bg-card text-sm font-mono"
                      data-testid={`fs-amt-${c.id}-${k}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Installments */}
      <div className="glass-morphism rounded-[2rem] p-5">
        <div className="label-eyebrow text-muted-foreground mb-4">Installments</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {installments.map((i) => (
            <div key={i.id} className="p-4 rounded-2xl border border-border">
              <div className="font-bold">{i.name}</div>
              <div className="label-eyebrow text-muted-foreground mt-1">Due {i.dueDate}</div>
              <div className="font-display font-black text-2xl tracking-tighter mt-2">{i.percentage}%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-morphism rounded-[2rem] p-5">
        <div className="label-eyebrow text-muted-foreground">Sample · Estimated Annual Fee for Class 5th</div>
        <div className="font-display font-black text-3xl tracking-tighter mt-2">
          {formatCurrency(cats.reduce((s, c) => s + (c.amounts?.['5th'] || c.amounts?.default || 0), 0))}
        </div>
      </div>
    </div>
  );
}

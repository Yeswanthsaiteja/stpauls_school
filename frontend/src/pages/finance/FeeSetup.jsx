import React, { useState, useEffect } from 'react';
import { getCurrentAcademicYear } from '../../utils';

import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Plus, Trash2, CalendarDays, Save, Edit3, X } from 'lucide-react';
import { listFeeCategories, addFeeCategory, deleteFeeCategory, updateFeeCategory } from '../../services/firebase/financeService';
import { CLASS_OPTIONS } from '../../lib/pdfUtils';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

export default function FeeSetup() {
  const [cats, setCats] = useState([]);
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const YEARS = ['2024-25', '2025-26', '2026-27', '2027-28'];
  const [newCat, setNewCat] = useState({ name: '', type: 'recurring', appliesTo: 'all' });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setCats(await listFeeCategories());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const addCategory = async () => {
    if (!newCat.name) return toast.error('Name required');
    // Default to one term when created
    const defaultTerm = { id: Date.now().toString(), name: 'Full Fee', dueDate: '', amounts: { default: 0 } };
    const row = await addFeeCategory({ ...newCat, academicYear, terms: [defaultTerm] });
    if (row) {
      setCats((c) => [row, ...c]);
      setNewCat({ name: '', type: 'recurring', appliesTo: 'all' });
      toast.success('Category saved');
    } else {
      toast.error('Failed to save category');
    }
  };

  const removeCat = async (id) => {
    if (!window.confirm('Delete this fee category and all its terms?')) return;
    await deleteFeeCategory(id);
    setCats(c => c.filter(x => x.id !== id));
    toast.success('Category deleted');
  };

  const addTerm = async (catId) => {
    const cat = cats.find(c => c.id === catId);
    if (!cat) return;
    const newTerm = { id: Date.now().toString(), name: `Term ${cat.terms ? cat.terms.length + 1 : 1}`, dueDate: '', amounts: { default: 0 } };
    const updatedTerms = [...(cat.terms || []), newTerm];
    await updateFeeCategory(catId, { terms: updatedTerms });
    setCats(cs => cs.map(c => c.id === catId ? { ...c, terms: updatedTerms } : c));
  };

  const updateTerm = async (catId, termId, field, val) => {
    const cat = cats.find(c => c.id === catId);
    if (!cat) return;
    const updatedTerms = (cat.terms || []).map(t => {
      if (t.id === termId) return { ...t, [field]: val };
      return t;
    });
    setCats(cs => cs.map(c => c.id === catId ? { ...c, terms: updatedTerms } : c));
  };

  const updateTermAmount = (catId, termId, klass, val) => {
    const cat = cats.find(c => c.id === catId);
    if (!cat) return;
    const updatedTerms = (cat.terms || []).map(t => {
      if (t.id === termId) {
        return { ...t, amounts: { ...(t.amounts || {}), [klass]: Number(val) || 0 } };
      }
      return t;
    });
    setCats(cs => cs.map(c => c.id === catId ? { ...c, terms: updatedTerms } : c));
  };

  const saveTerms = async (catId) => {
    const cat = cats.find(c => c.id === catId);
    if (!cat) return;
    await updateFeeCategory(catId, { terms: cat.terms });
    toast.success('Terms & Amounts saved successfully');
  };

  const removeTerm = async (catId, termId) => {
    const cat = cats.find(c => c.id === catId);
    if (!cat) return;
    const updatedTerms = (cat.terms || []).filter(t => t.id !== termId);
    await updateFeeCategory(catId, { terms: updatedTerms });
    setCats(cs => cs.map(c => c.id === catId ? { ...c, terms: updatedTerms } : c));
  };

  return (
    <div className="space-y-6" data-testid="fee-setup">
      <div className="flex items-center justify-between">
        <div>
          <NavLink to="/dashboard/finance" className="label-eyebrow text-primary">← Back to Finance</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-1">Fee Setup</h1>
        </div>
        <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="h-11 px-4 rounded-2xl border border-border bg-card text-sm font-bold shadow-sm">
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Add category */}
      <div className="glass-morphism rounded-[2rem] p-5">
        <div className="label-eyebrow text-muted-foreground mb-3">Add Fee Category</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} placeholder="Category name (e.g. Tuition Fee)" className="h-11 px-4 rounded-2xl border border-border bg-card text-sm lg:col-span-2" />
          <select value={newCat.appliesTo} onChange={(e) => setNewCat({ ...newCat, appliesTo: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-card text-sm">
            <option value="all">Applies to: All Students</option>
            <option value="transport">Applies to: Transport</option>
            <option value="hostel">Applies to: Hostel</option>
          </select>
          <button onClick={addCategory} className="h-11 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center justify-center gap-2"><Plus className="h-3.5 w-3.5" />Add Category</button>
        </div>
      </div>

      {/* Categories list */}
      <div className="space-y-4">
        {cats.filter(c => (c.academicYear || '2026-27') === academicYear).map((c) => (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key={c.id} className="glass-morphism rounded-[2rem] p-5 border border-primary/20">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div>
                <div className="font-display font-black text-xl tracking-tighter text-primary">{c.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="label-eyebrow text-muted-foreground">{c.type}</span>
                  {c.appliesTo && c.appliesTo !== 'all' && (
                    <span className="px-2 py-0.5 rounded-full label-eyebrow bg-amber-500/10 text-amber-600">{c.appliesTo}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => addTerm(c.id)} className="h-9 px-3 rounded-xl bg-muted hover:bg-primary/20 text-foreground label-eyebrow flex items-center gap-1.5"><Plus className="h-3 w-3" />Add Term</button>
                <button onClick={() => removeCat(c.id)} className="h-9 w-9 grid place-items-center rounded-xl bg-rose-500/10 text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>

            <div className="space-y-4">
              {(c.terms || []).map((t, i) => (
                <div key={t.id} className="p-4 rounded-2xl border border-border bg-card/50">
                  <div className="flex flex-wrap gap-3 items-center mb-3">
                    <input value={t.name} onChange={(e) => updateTerm(c.id, t.id, 'name', e.target.value)} className="h-9 px-3 rounded-xl border border-border bg-card text-sm font-bold min-w-[150px]" placeholder="Term Name" />
                    <div className="flex items-center h-9 px-3 rounded-xl border border-border bg-card">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground mr-2" />
                      <input type="date" value={t.dueDate} onChange={(e) => updateTerm(c.id, t.id, 'dueDate', e.target.value)} className="bg-transparent text-sm outline-none" />
                    </div>
                    <button onClick={() => removeTerm(c.id, t.id)} className="h-9 w-9 grid place-items-center rounded-xl hover:bg-rose-500/10 text-rose-500"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  
                  {/* Class amounts */}
                  <div className="overflow-x-auto thin-scrollbar">
                    <div className="flex gap-2 min-w-max pb-2">
                      {['default', ...CLASS_OPTIONS].map((k) => (
                        <div key={k} className="flex flex-col">
                          <label className="label-eyebrow text-muted-foreground text-[10px] uppercase">{k}</label>
                          <input
                            type="number"
                            value={t.amounts?.[k] === undefined ? '' : t.amounts[k]}
                            onChange={(e) => updateTermAmount(c.id, t.id, k, e.target.value)}
                            className="mt-1 w-20 h-9 px-2 rounded-xl border border-border bg-background text-sm font-mono text-center"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="flex justify-end pt-2">
                <button onClick={() => saveTerms(c.id)} className="h-10 px-6 rounded-2xl bg-foreground text-background label-eyebrow flex items-center gap-2"><Save className="h-3.5 w-3.5" />Save {c.name} Amounts</button>
              </div>
            </div>
          </motion.div>
        ))}
        {cats.filter(c => (c.academicYear || '2026-27') === academicYear).length === 0 && !loading && (
          <div className="text-center py-10 text-muted-foreground">No fee categories created for {academicYear}.</div>
        )}
      </div>
    </div>
  );
}

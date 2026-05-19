import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Plus, Trash2, Pencil, X, Loader2, RefreshCw } from 'lucide-react';
import { listExamSetups, addExamSetup, updateExamSetup, deleteExamSetup, listClasses, listSubjects } from '../../services/firebase/academicService';
import { toast } from 'sonner';

const EXAM_TYPES = ['Unit 1', 'Unit 2', 'Unit 3', 'Quarterly', 'Half Yearly', 'Final Exam', 'Other'];

export default function ExamSetupPage() {
  const [list, setList] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null); // { mode, id? }
  
  const [form, setForm] = useState({
    examType: 'Unit 1',
    customName: '',
    selectedClasses: [],
    selectedSubjects: []
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [examData, clsData, subData] = await Promise.all([
        listExamSetups(),
        listClasses(),
        listSubjects()
      ]);
      setList(examData);
      setClasses(clsData);
      setSubjects(subData);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm({
      examType: 'Unit 1',
      customName: '',
      selectedClasses: classes.map(c => c.name),
      selectedSubjects: subjects.map(s => s.name)
    });
    setModal({ mode: 'add' });
  };
  
  const openEdit = (e) => {
    setForm({
      examType: e.examType || 'Unit 1',
      customName: e.customName || '',
      selectedClasses: e.classes || [],
      selectedSubjects: e.subjects || []
    });
    setModal({ mode: 'edit', id: e.id });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.examType) return toast.error('Exam Type is required');
    if (form.examType === 'Other' && !form.customName.trim()) return toast.error('Custom Exam Name is required');
    if (form.selectedClasses.length === 0) return toast.error('Select at least one class');
    if (form.selectedSubjects.length === 0) return toast.error('Select at least one subject');

    const payload = {
      examType: form.examType,
      customName: form.examType === 'Other' ? form.customName.trim() : '',
      classes: form.selectedClasses,
      subjects: form.selectedSubjects
    };

    setSaving(true);
    try {
      if (modal.mode === 'add') {
        const row = await addExamSetup(payload);
        setList(l => [row, ...l]);
        toast.success('Exam scheduled successfully');
      } else {
        await updateExamSetup(modal.id, payload);
        setList(l => l.map(x => x.id === modal.id ? { ...x, ...payload } : x));
        toast.success('Exam updated');
      }
      setModal(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save exam');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this exam setup?')) return;
    await deleteExamSetup(id);
    setList(l => l.filter(x => x.id !== id));
    toast.success('Exam deleted');
  };

  const toggleClass = (cName) => {
    setForm(prev => {
      const isSelected = prev.selectedClasses.includes(cName);
      return {
        ...prev,
        selectedClasses: isSelected 
          ? prev.selectedClasses.filter(x => x !== cName)
          : [...prev.selectedClasses, cName]
      };
    });
  };

  const toggleSubject = (sName) => {
    setForm(prev => {
      const isSelected = prev.selectedSubjects.includes(sName);
      return {
        ...prev,
        selectedSubjects: isSelected 
          ? prev.selectedSubjects.filter(x => x !== sName)
          : [...prev.selectedSubjects, sName]
      };
    });
  };

  return (
    <div className="space-y-5" data-testid="exam-setup-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <NavLink to=".." className="label-eyebrow text-primary">← Back to Academic</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-2">Exam Scheduling</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="h-10 w-10 rounded-2xl bg-muted grid place-items-center">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openAdd} className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2">
            <Plus className="h-3.5 w-3.5" />Schedule Exam
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="glass-morphism rounded-[2rem] p-3 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Exam Name', 'Classes', 'Subjects', ''].map(h => <th key={h} className="label-eyebrow text-muted-foreground text-left px-3 py-2">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map(e => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-3 py-3 font-display font-black tracking-tighter text-lg">
                    {e.examType === 'Other' ? e.customName : e.examType}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {(e.classes || []).slice(0, 3).map(c => <span key={c} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary label-eyebrow">{c}</span>)}
                      {e.classes?.length > 3 && <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground label-eyebrow">+{e.classes.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {(e.subjects || []).slice(0, 3).map(s => <span key={s} className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 label-eyebrow">{s}</span>)}
                      {e.subjects?.length > 3 && <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground label-eyebrow">+{e.subjects.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={() => openEdit(e)} className="p-2 rounded-xl hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(e.id)} className="p-2 rounded-xl hover:bg-rose-500/10 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-sm text-muted-foreground">No exams scheduled yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card rounded-[2rem] p-6 w-full max-w-xl border border-border max-h-[90vh] overflow-y-auto thin-scrollbar">
            <div className="flex items-center justify-between mb-4">
              <div className="font-display font-black text-xl tracking-tighter">{modal.mode === 'add' ? 'Schedule Exam' : 'Edit Exam'}</div>
              <button onClick={() => setModal(null)} className="p-2 rounded-xl hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-eyebrow text-muted-foreground">Exam Type</label>
                  <select 
                    value={form.examType} 
                    onChange={e => setForm({...form, examType: e.target.value})}
                    className="mt-1 w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm outline-none"
                  >
                    {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {form.examType === 'Other' && (
                  <div>
                    <label className="label-eyebrow text-muted-foreground">Custom Name</label>
                    <input 
                      value={form.customName} 
                      onChange={e => setForm({...form, customName: e.target.value})}
                      placeholder="e.g. Weekly Test"
                      className="mt-1 w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm outline-none" 
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="label-eyebrow text-muted-foreground flex justify-between">
                  <span>Applicable Classes</span>
                  <button type="button" onClick={() => setForm({...form, selectedClasses: form.selectedClasses.length === classes.length ? [] : classes.map(c => c.name)})} className="text-primary hover:underline">Toggle All</button>
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {classes.map(c => {
                    const isSelected = form.selectedClasses.includes(c.name);
                    return (
                      <button 
                        key={c.id} 
                        type="button" 
                        onClick={() => toggleClass(c.name)}
                        className={`px-3 py-1.5 rounded-xl border text-sm font-bold transition-colors ${isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted'}`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="label-eyebrow text-muted-foreground flex justify-between">
                  <span>Applicable Subjects</span>
                  <button type="button" onClick={() => setForm({...form, selectedSubjects: form.selectedSubjects.length === subjects.length ? [] : subjects.map(s => s.name)})} className="text-primary hover:underline">Toggle All</button>
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[...new Set(subjects.map(s => s.name))].map(sName => {
                    const isSelected = form.selectedSubjects.includes(sName);
                    return (
                      <button 
                        key={sName} 
                        type="button" 
                        onClick={() => toggleSubject(sName)}
                        className={`px-3 py-1.5 rounded-xl border text-sm font-bold transition-colors ${isSelected ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-background text-muted-foreground border-border hover:bg-muted'}`}
                      >
                        {sName}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <button type="submit" disabled={saving} className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground label-eyebrow disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save Exam'}
                </button>
                <button type="button" onClick={() => setModal(null)} className="h-11 px-6 rounded-2xl bg-muted label-eyebrow">
                  Cancel
                </button>
              </div>
            </form>

          </motion.div>
        </div>
      )}
    </div>
  );
}

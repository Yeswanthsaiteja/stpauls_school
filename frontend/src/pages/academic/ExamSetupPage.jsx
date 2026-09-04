import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Plus, Trash2, Pencil, X, Loader2, RefreshCw, CalendarDays, Clock, Save, Settings2 } from 'lucide-react';
import { listExamSetups, addExamSetup, updateExamSetup, deleteExamSetup, listClasses, listSubjects } from '../../services/firebase/academicService';
import { toast } from 'sonner';

const EXAM_TYPES = ['Unit 1', 'Unit 2', 'Unit 3', 'Quarterly', 'Half Yearly', 'Final Exam', 'Other'];

const DEFAULT_SCALE = [
  { min: 91, max: 100, grade: 'A1' },
  { min: 81, max: 90, grade: 'A2' },
  { min: 71, max: 80, grade: 'B1' },
  { min: 61, max: 70, grade: 'B2' },
  { min: 51, max: 60, grade: 'C1' },
  { min: 41, max: 50, grade: 'C2' },
  { min: 33, max: 40, grade: 'D' },
  { min: 0, max: 32, grade: 'F' }
];

const DEFAULT_GRADES = ['A+', 'A', 'B', 'C', 'D'];

export default function ExamSetupPage() {
  const [list, setList] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState(getEmptyForm());
  const [activeClassTab, setActiveClassTab] = useState('');

  function getEmptyForm() {
    return {
      id: null,
      examType: 'Unit 1',
      customName: '',
      classes: [],
      schedule: {} // { '10th': [ { subjectName, date, ... } ] }
    };
  }

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
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm(getEmptyForm());
    setStep(1);
    setWizardOpen(true);
  };
  
  const openEdit = (e) => {
    setForm({
      id: e.id,
      examType: e.examType || 'Unit 1',
      customName: e.customName || '',
      classes: e.classes || [],
      schedule: e.schedule || {}
    });
    if (e.classes && e.classes.length > 0) setActiveClassTab(e.classes[0]);
    setStep(1);
    setWizardOpen(true);
  };

  const toggleClass = (c) => {
    setForm(prev => {
      const has = prev.classes.includes(c);
      const nextClasses = has ? prev.classes.filter(x => x !== c) : [...prev.classes, c];
      
      const nextSchedule = { ...prev.schedule };
      // Do not delete nextSchedule[c] when toggling off, so data is preserved if they toggle back on.
      if (!has && !nextSchedule[c]) {
        nextSchedule[c] = [];
      }
      
      return { ...prev, classes: nextClasses, schedule: nextSchedule };
    });
  };

  const addSubjectToClass = (cls) => {
    setForm(prev => {
      const next = { ...prev };
      next.schedule = { ...prev.schedule };
      if (!next.schedule[cls]) next.schedule[cls] = [];
      next.schedule[cls] = [...next.schedule[cls], {
        id: Date.now().toString(),
        subjectName: subjects.length > 0 ? subjects[0].name : '',
        date: '',
        startTime: '09:00',
        endTime: '12:00',
        totalMarks: 100,
        minMarks: 35,
        isGradeOnly: false,
        gradingScale: JSON.parse(JSON.stringify(DEFAULT_SCALE)),
        gradeOptions: [...DEFAULT_GRADES]
      }];
      return next;
    });
  };

  const updateSubject = (cls, subId, field, val) => {
    setForm(prev => {
      const next = { ...prev };
      next.schedule = { ...prev.schedule };
      next.schedule[cls] = next.schedule[cls].map(s => s.id === subId ? { ...s, [field]: val } : s);
      return next;
    });
  };

  const removeSubject = (cls, subId) => {
    if (!window.confirm('Remove subject from schedule?')) return;
    setForm(prev => {
      const next = { ...prev };
      next.schedule = { ...prev.schedule };
      next.schedule[cls] = next.schedule[cls].filter(s => s.id !== subId);
      return next;
    });
  };

  const save = async () => {
    if (!form.examType) return toast.error('Exam Type is required');
    if (form.examType === 'Other' && !form.customName.trim()) return toast.error('Custom Exam Name is required');
    if (form.classes.length === 0) return toast.error('Select at least one class');

    // Only save the schedule for classes that are actively selected
    const activeSchedule = {};
    form.classes.forEach(c => {
      activeSchedule[c] = form.schedule[c] || [];
    });

    // extract all unique subjects used across classes
    const allUsedSubjects = new Set();
    Object.values(activeSchedule).forEach(arr => {
      arr.forEach(s => { if (s.subjectName) allUsedSubjects.add(s.subjectName); });
    });

    const payload = {
      examType: form.examType,
      customName: form.examType === 'Other' ? form.customName.trim() : '',
      classes: form.classes,
      subjects: Array.from(allUsedSubjects), // keeping array for backwards compatibility
      schedule: activeSchedule
    };

    if (saving) return; setSaving(true);
    try {
      if (!form.id) {
        const row = await addExamSetup(payload);
        if (row) {
          setList(l => [row, ...l]);
          toast.success('Exam scheduled successfully');
        }
      } else {
        await updateExamSetup(form.id, payload);
        setList(l => l.map(x => x.id === form.id ? { ...x, ...payload } : x));
        toast.success('Exam updated');
      }
      setWizardOpen(false);
    } catch (err) {
      toast.error('Failed to save exam');
    } finally {
      setSaving(false);
    }
  };

  const deleteSetup = async (id) => {
    if (!window.confirm('Delete this exam setup completely? All associated rules will be lost.')) return;
    await deleteExamSetup(id);
    setList(l => l.filter(x => x.id !== id));
    toast.success('Deleted');
  };

  return (
    <div className="space-y-6" data-testid="exam-setup-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-2">Exam Schedule Setup</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="h-10 w-10 rounded-2xl bg-muted grid place-items-center hover:bg-muted/80"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={openAdd} className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2"><Plus className="h-3.5 w-3.5" />New Exam Setup</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(e => (
            <motion.div key={e.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-morphism rounded-[2rem] p-5">
              <div className="flex justify-between items-start mb-4 border-b border-border pb-4">
                <div>
                  <div className="font-display font-black text-xl tracking-tighter text-primary">{e.examType === 'Other' ? e.customName : e.examType}</div>
                  <div className="text-xs text-muted-foreground mt-1">{e.classes?.length || 0} Classes Configured</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(e)} className="p-2 rounded-xl bg-muted hover:bg-primary/20 text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteSetup(e.id)} className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(e.classes || []).map(c => <span key={c} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase">{c}</span>)}
              </div>
            </motion.div>
          ))}
          {list.length === 0 && <div className="col-span-full py-12 text-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-[2rem]">No exams configured yet.</div>}
        </div>
      )}

      {/* Full Screen Wizard */}
      <AnimatePresence>
        {wizardOpen && (
          <div className="fixed inset-0 z-50 flex flex-col bg-background">
            <div className="h-16 border-b border-border px-6 flex items-center justify-between shrink-0 bg-card">
              <div className="font-display font-black text-xl tracking-tighter">{form.id ? 'Edit Exam Setup' : 'New Exam Setup'}</div>
              <button onClick={() => setWizardOpen(false)} className="p-2 hover:bg-muted rounded-xl"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-auto bg-muted/30 p-6">
              <div className="max-w-5xl mx-auto space-y-6">
                
                {/* STEP 1: Basic Info */}
                <div className="glass-morphism rounded-[2rem] p-6 border border-border bg-card">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-bold text-lg">1. Basic Information</div>
                    {step === 2 && <button onClick={() => setStep(1)} className="text-sm text-primary font-bold">Edit</button>}
                  </div>
                  
                  {step === 1 ? (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="label-eyebrow text-muted-foreground">Exam Name</label>
                          <select value={form.examType} onChange={(e) => setForm({ ...form, examType: e.target.value })} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm">
                            {EXAM_TYPES.map(t => <option key={t}>{t}</option>)}
                          </select>
                        </div>
                        {form.examType === 'Other' && (
                          <div>
                            <label className="label-eyebrow text-muted-foreground">Custom Name</label>
                            <input value={form.customName} onChange={(e) => setForm({ ...form, customName: e.target.value })} className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-background text-sm" placeholder="e.g. Pre-Board 1" />
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label className="label-eyebrow text-muted-foreground mb-3 block">Select Classes Participating in this Exam</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {classes.map(c => {
                            const active = form.classes.includes(c.name);
                            return (
                              <label key={c.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${active ? 'bg-primary/5 border-primary shadow-sm' : 'bg-background border-border hover:bg-muted/50'}`}>
                                <input 
                                  type="checkbox" 
                                  checked={active} 
                                  onChange={() => toggleClass(c.name)} 
                                  className="accent-primary h-4 w-4"
                                />
                                <span className={`text-sm font-bold ${active ? 'text-primary' : 'text-foreground'}`}>Class {c.name}</span>
                              </label>
                            );
                          })}
                        </div>
                        {form.classes.length === 0 && <p className="text-xs text-rose-500 mt-2 flex items-center gap-1">⚠ Please select at least one class to proceed.</p>}
                      </div>

                      <div className="pt-2 border-t border-border flex justify-end">
                        <button onClick={() => {
                          if (form.classes.length === 0) return toast.error('Select classes first');
                          setActiveClassTab(form.classes[0]);
                          setStep(2);
                        }} className="h-11 px-6 rounded-2xl bg-foreground text-background font-bold text-sm">Next: Configure Subjects & Schedule</button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="font-bold text-foreground">{form.examType === 'Other' ? form.customName : form.examType}</span> · 
                      {form.classes.length} Classes Selected
                    </div>
                  )}
                </div>

                {/* STEP 2: Subject Configuration */}
                {step === 2 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-morphism rounded-[2rem] p-6 border border-border bg-card">
                    <div className="flex items-center justify-between mb-4">
                      <div className="font-bold text-lg">2. Configure Schedule & Marks</div>
                    </div>

                    <div className="flex gap-2 border-b border-border mb-5 overflow-x-auto thin-scrollbar pb-2">
                      {form.classes.map(cls => (
                        <button key={cls} onClick={() => setActiveClassTab(cls)} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${activeClassTab === cls ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}>
                          Class {cls}
                        </button>
                      ))}
                    </div>

                    {activeClassTab && (
                      <div className="space-y-6">
                        {(!form.schedule[activeClassTab] || form.schedule[activeClassTab].length === 0) ? (
                          <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
                            No subjects configured for Class {activeClassTab}.
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {form.schedule[activeClassTab].map((sub, idx) => (
                              <div key={sub.id} className="p-5 rounded-2xl border border-border bg-muted/20 space-y-4">
                                
                                <div className="flex flex-wrap gap-4 items-end">
                                  <div className="flex-1 min-w-[200px]">
                                    <label className="label-eyebrow text-muted-foreground mb-1 block">Subject Name</label>
                                    <div className="flex gap-2">
                                      <select value={sub.subjectName} onChange={e => updateSubject(activeClassTab, sub.id, 'subjectName', e.target.value)} className="h-10 px-3 rounded-xl border border-border bg-background text-sm flex-1">
                                        <option value="">Select Subject</option>
                                        {subjects.filter(s => s.className === activeClassTab).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                      </select>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 h-10 px-4 rounded-xl border border-primary/30 bg-primary/5 cursor-pointer" onClick={() => updateSubject(activeClassTab, sub.id, 'isGradeOnly', !sub.isGradeOnly)}>
                                    <input type="checkbox" checked={sub.isGradeOnly} onChange={() => {}} className="accent-primary" />
                                    <span className="text-sm font-bold text-primary select-none">Grade Only Subject (No Marks)</span>
                                  </div>

                                  <button onClick={() => removeSubject(activeClassTab, sub.id)} className="h-10 px-3 rounded-xl hover:bg-rose-500/10 text-rose-500"><Trash2 className="h-4 w-4" /></button>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <div><label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Date</label><input type="date" value={sub.date} onChange={e => updateSubject(activeClassTab, sub.id, 'date', e.target.value)} className="w-full h-9 px-3 rounded-xl border border-border bg-background text-sm" /></div>
                                  <div><label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Start Time</label><input type="time" value={sub.startTime} onChange={e => updateSubject(activeClassTab, sub.id, 'startTime', e.target.value)} className="w-full h-9 px-3 rounded-xl border border-border bg-background text-sm" /></div>
                                  <div><label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">End Time</label><input type="time" value={sub.endTime} onChange={e => updateSubject(activeClassTab, sub.id, 'endTime', e.target.value)} className="w-full h-9 px-3 rounded-xl border border-border bg-background text-sm" /></div>
                                  {!sub.isGradeOnly && (
                                    <>
                                      <div><label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Maximum Marks</label><input type="number" value={sub.totalMarks} onChange={e => updateSubject(activeClassTab, sub.id, 'totalMarks', Number(e.target.value))} className="w-full h-9 px-3 rounded-xl border border-border bg-background text-sm" /></div>
                                      <div><label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Minimum Marks</label><input type="number" value={sub.minMarks ?? 35} onChange={e => updateSubject(activeClassTab, sub.id, 'minMarks', Number(e.target.value))} className="w-full h-9 px-3 rounded-xl border border-border bg-background text-sm" /></div>
                                    </>
                                  )}
                                </div>

                                {/* Grading Scale Config */}
                                <div className="pt-3 border-t border-border">
                                  <div className="flex items-center gap-2 mb-2 text-sm font-bold text-foreground"><Settings2 className="h-4 w-4 text-muted-foreground" /> Grading Rules</div>
                                  
                                  {sub.isGradeOnly ? (
                                    <div className="bg-background rounded-xl p-3 border border-border">
                                      <p className="text-xs text-muted-foreground mb-2">Teachers will select from these grades instead of entering marks (comma separated):</p>
                                      <input 
                                        value={(sub.gradeOptions || []).join(', ')} 
                                        onChange={e => updateSubject(activeClassTab, sub.id, 'gradeOptions', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} 
                                        className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm font-mono" 
                                        placeholder="e.g. A+, A, B, C, F" 
                                      />
                                    </div>
                                  ) : (
                                    <div className="bg-background rounded-xl p-3 border border-border overflow-x-auto">
                                      <div className="text-xs text-muted-foreground mb-2 flex justify-between">
                                        <span>Define Mark Ranges for Grades:</span>
                                        <button onClick={() => {
                                          const nextScale = [...sub.gradingScale, { min: 0, max: 0, grade: '' }];
                                          updateSubject(activeClassTab, sub.id, 'gradingScale', nextScale);
                                        }} className="text-primary hover:underline">+ Add Range</button>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {sub.gradingScale.map((scale, i) => (
                                          <div key={i} className="flex items-center gap-1 bg-muted/50 p-1.5 rounded-lg border border-border">
                                            <input type="number" value={scale.min} onChange={e => {
                                              const newScale = [...sub.gradingScale];
                                              newScale[i].min = Number(e.target.value);
                                              updateSubject(activeClassTab, sub.id, 'gradingScale', newScale);
                                            }} className="w-12 h-7 px-1 text-center text-xs rounded border border-border bg-background" />
                                            <span className="text-xs text-muted-foreground">-</span>
                                            <input type="number" value={scale.max} onChange={e => {
                                              const newScale = [...sub.gradingScale];
                                              newScale[i].max = Number(e.target.value);
                                              updateSubject(activeClassTab, sub.id, 'gradingScale', newScale);
                                            }} className="w-12 h-7 px-1 text-center text-xs rounded border border-border bg-background" />
                                            <span className="text-xs text-muted-foreground mx-1">→</span>
                                            <input type="text" value={scale.grade} onChange={e => {
                                              const newScale = [...sub.gradingScale];
                                              newScale[i].grade = e.target.value;
                                              updateSubject(activeClassTab, sub.id, 'gradingScale', newScale);
                                            }} className="w-14 h-7 px-1 text-center text-xs font-bold rounded border border-border bg-background" placeholder="Grade" />
                                            <button onClick={() => {
                                              const newScale = sub.gradingScale.filter((_, idx) => idx !== i);
                                              updateSubject(activeClassTab, sub.id, 'gradingScale', newScale);
                                            }} className="ml-1 text-rose-500 hover:text-rose-700"><X className="h-3 w-3" /></button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <button onClick={() => addSubjectToClass(activeClassTab)} className="w-full h-11 rounded-2xl border border-dashed border-primary text-primary font-bold text-sm hover:bg-primary/5 flex items-center justify-center gap-2">
                          <Plus className="h-4 w-4" /> Add Subject to Class {activeClassTab}
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}

              </div>
            </div>

            {/* Sticky Footer */}
            <div className="h-16 border-t border-border px-6 flex items-center justify-between shrink-0 bg-card">
              <div className="text-sm text-muted-foreground">Ensure all grading scales are correct before saving.</div>
              <button onClick={save} disabled={saving || step === 1} className="h-10 px-6 rounded-2xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Complete Setup
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

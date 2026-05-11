import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Plus, Trash2, Pencil, X, BookOpen, BookMarked } from 'lucide-react';
import { demoStore } from '../../services/demoStore';
import { CLASS_OPTIONS, SECTION_OPTIONS } from '../../lib/pdfUtils';
import { toast } from 'sonner';

const TYPES = ['Core', 'Elective', 'Language', 'Activity'];
const STATUS = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];

export default function SubjectsTopicsCRUD() {
  const [subjects, setSubjects] = useState(demoStore.list('subjects'));
  const [topics, setTopics] = useState(demoStore.list('topics'));
  const employees = demoStore.list('employees');
  const [active, setActive] = useState(subjects[0]?.id || null);

  const [subjModal, setSubjModal] = useState(null);
  const [subjForm, setSubjForm] = useState({ name: '', code: '', className: '10th', section: '', teacherId: employees[0]?.fullName || '', type: 'Core' });

  const [topicModal, setTopicModal] = useState(null);
  const [topicForm, setTopicForm] = useState({ topicName: '', description: '', periods: 1, status: 'NOT_STARTED', startDate: '', endDate: '' });

  const refresh = () => { setSubjects(demoStore.list('subjects')); setTopics(demoStore.list('topics')); };

  const saveSubject = () => {
    if (!subjForm.name) return toast.error('Name required');
    if (subjModal === 'add') { demoStore.add('subjects', subjForm); toast.success('Subject added'); }
    else { demoStore.update('subjects', subjModal, subjForm); toast.success('Subject updated'); }
    setSubjModal(null); refresh();
  };
  const delSubject = (s) => {
    const myTopics = topics.filter((t) => t.subjectId === s.id);
    if (myTopics.length > 0) return toast.error(`Cannot delete · ${myTopics.length} topics inside`);
    demoStore.remove('subjects', s.id); refresh();
    toast.success('Subject removed');
  };

  const saveTopic = () => {
    if (!topicForm.topicName) return toast.error('Topic required');
    const subj = subjects.find((s) => s.id === active);
    const payload = { ...topicForm, subjectId: active, subjectName: subj?.name };
    if (topicModal === 'add') demoStore.add('topics', payload);
    else demoStore.update('topics', topicModal, payload);
    toast.success('Topic saved');
    setTopicModal(null); refresh();
  };

  const updateTopicStatus = (id, status) => { demoStore.update('topics', id, { status }); refresh(); };
  const delTopic = (id) => { demoStore.remove('topics', id); refresh(); };

  const activeSubject = subjects.find((s) => s.id === active);
  const subjectTopics = topics.filter((t) => t.subjectId === active);
  const done = subjectTopics.filter((t) => t.status === 'COMPLETED').length;
  const pct = subjectTopics.length ? Math.round((done / subjectTopics.length) * 100) : 0;

  return (
    <div className="space-y-5" data-testid="subjects-topics">
      <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Subjects & Topics</h1>
        <button onClick={() => { setSubjForm({ name: '', code: '', className: '10th', section: '', teacherId: employees[0]?.fullName || '', type: 'Core' }); setSubjModal('add'); }} data-testid="st-add-subject" className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2"><Plus className="h-3.5 w-3.5" />Add Subject</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Subject list */}
        <div className="space-y-2">
          {subjects.map((s) => {
            const myT = topics.filter((t) => t.subjectId === s.id);
            const c = myT.filter((t) => t.status === 'COMPLETED').length;
            return (
              <motion.button key={s.id} onClick={() => setActive(s.id)} whileHover={{ x: 4 }} className={`w-full text-left p-4 rounded-2xl border ${active === s.id ? 'border-primary bg-primary/5' : 'border-border bg-card'}`} data-testid={`st-subj-${s.id}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" />{s.name}</div>
                    <div className="label-eyebrow text-muted-foreground mt-0.5">{s.code} · {s.className}{s.section ? `-${s.section}` : ''} · {s.type || 'Core'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-black text-lg tracking-tighter">{myT.length ? Math.round(c / myT.length * 100) : 0}%</div>
                    <div className="label-eyebrow text-muted-foreground">{c}/{myT.length}</div>
                  </div>
                </div>
                <div className="flex gap-1 mt-2 justify-end">
                  <button onClick={(e) => { e.stopPropagation(); setSubjForm({ name: s.name, code: s.code || '', className: s.className || '10th', section: s.section || '', teacherId: s.teacherId || '', type: s.type || 'Core' }); setSubjModal(s.id); }} className="p-1.5 rounded-lg hover:bg-muted" data-testid={`st-edit-subj-${s.id}`}><Pencil className="h-3 w-3" /></button>
                  <button onClick={(e) => { e.stopPropagation(); delSubject(s); }} className="p-1.5 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" data-testid={`st-del-subj-${s.id}`}><Trash2 className="h-3 w-3" /></button>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Topics panel */}
        <div className="lg:col-span-2">
          {activeSubject && (
            <div className="glass-morphism rounded-[2rem] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="label-eyebrow text-muted-foreground">Topics in</div>
                  <div className="font-display font-black text-2xl tracking-tighter">{activeSubject.name}</div>
                </div>
                <button onClick={() => { setTopicForm({ topicName: '', description: '', periods: 1, status: 'NOT_STARTED', startDate: '', endDate: '' }); setTopicModal('add'); }} data-testid="st-add-topic" className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2"><Plus className="h-3.5 w-3.5" />Add Topic</button>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-muted/30 p-3"><div className="label-eyebrow text-muted-foreground">Total</div><div className="font-display font-black text-xl tracking-tighter">{subjectTopics.length}</div></div>
                <div className="rounded-2xl bg-emerald-500/10 p-3"><div className="label-eyebrow text-emerald-500">Completed</div><div className="font-display font-black text-xl tracking-tighter">{done}</div></div>
                <div className="rounded-2xl bg-amber-500/10 p-3"><div className="label-eyebrow text-amber-500">Progress</div><div className="font-display font-black text-xl tracking-tighter">{pct}%</div></div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: `${pct}%` }} /></div>

              <div className="space-y-2">
                {subjectTopics.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-2xl border border-border" data-testid={`st-topic-${t.id}`}>
                    <BookMarked className={`h-4 w-4 ${t.status === 'COMPLETED' ? 'text-emerald-500' : t.status === 'IN_PROGRESS' ? 'text-amber-500' : 'text-muted-foreground'}`} />
                    <div className="flex-1">
                      <div className="font-bold text-sm">{t.topicName}</div>
                      <div className="label-eyebrow text-muted-foreground">{t.description || ''}{t.periods ? ` · ${t.periods}p` : ''}</div>
                    </div>
                    <select value={t.status} onChange={(e) => updateTopicStatus(t.id, e.target.value)} className="h-9 px-3 rounded-xl border border-border bg-card text-xs font-bold" data-testid={`st-status-${t.id}`}>
                      {STATUS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <button onClick={() => { setTopicForm(t); setTopicModal(t.id); }} className="p-1.5 rounded-lg hover:bg-muted"><Pencil className="h-3 w-3" /></button>
                    <button onClick={() => delTopic(t.id)} className="p-1.5 rounded-lg hover:bg-rose-500/10 hover:text-rose-500"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
                {subjectTopics.length === 0 && <div className="text-center text-sm text-muted-foreground py-6">No topics yet · click Add Topic</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subject modal */}
      {subjModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card rounded-[2rem] p-6 w-full max-w-md border border-border">
            <div className="flex items-center justify-between mb-4"><div className="font-display font-black text-xl tracking-tighter">{subjModal === 'add' ? 'Add Subject' : 'Edit Subject'}</div><button onClick={() => setSubjModal(null)} className="p-2 rounded-xl hover:bg-muted"><X className="h-4 w-4" /></button></div>
            <div className="space-y-3">
              <input value={subjForm.name} onChange={(e) => setSubjForm({ ...subjForm, name: e.target.value })} placeholder="Subject Name" className="w-full h-11 px-4 rounded-2xl border border-border bg-background text-sm" data-testid="st-subj-name" />
              <input value={subjForm.code} onChange={(e) => setSubjForm({ ...subjForm, code: e.target.value })} placeholder="Code" className="w-full h-11 px-4 rounded-2xl border border-border bg-background text-sm" data-testid="st-subj-code" />
              <div className="grid grid-cols-2 gap-2">
                <select value={subjForm.className} onChange={(e) => setSubjForm({ ...subjForm, className: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-background text-sm">{CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}</select>
                <select value={subjForm.section} onChange={(e) => setSubjForm({ ...subjForm, section: e.target.value })} className="h-11 px-3 rounded-2xl border border-border bg-background text-sm"><option value="">All sections</option>{SECTION_OPTIONS.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              <select value={subjForm.teacherId} onChange={(e) => setSubjForm({ ...subjForm, teacherId: e.target.value })} className="w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="st-subj-teacher">{employees.map((e) => <option key={e.id}>{e.fullName}</option>)}</select>
              <select value={subjForm.type} onChange={(e) => setSubjForm({ ...subjForm, type: e.target.value })} className="w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm">{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
              <button onClick={saveSubject} className="w-full h-11 rounded-2xl bg-primary text-primary-foreground label-eyebrow" data-testid="st-subj-save">Save</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Topic modal */}
      {topicModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card rounded-[2rem] p-6 w-full max-w-md border border-border">
            <div className="flex items-center justify-between mb-4"><div className="font-display font-black text-xl tracking-tighter">{topicModal === 'add' ? 'Add Topic' : 'Edit Topic'}</div><button onClick={() => setTopicModal(null)} className="p-2 rounded-xl hover:bg-muted"><X className="h-4 w-4" /></button></div>
            <div className="space-y-3">
              <input value={topicForm.topicName} onChange={(e) => setTopicForm({ ...topicForm, topicName: e.target.value })} placeholder="Topic" className="w-full h-11 px-4 rounded-2xl border border-border bg-background text-sm" data-testid="st-topic-name" />
              <textarea value={topicForm.description} onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })} placeholder="Description" rows={2} className="w-full px-4 py-2 rounded-2xl border border-border bg-background text-sm" />
              <input type="number" value={topicForm.periods} onChange={(e) => setTopicForm({ ...topicForm, periods: Number(e.target.value) || 1 })} placeholder="Periods required" className="w-full h-11 px-4 rounded-2xl border border-border bg-background text-sm" />
              <select value={topicForm.status} onChange={(e) => setTopicForm({ ...topicForm, status: e.target.value })} className="w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm">{STATUS.map((s) => <option key={s}>{s}</option>)}</select>
              <button onClick={saveTopic} className="w-full h-11 rounded-2xl bg-primary text-primary-foreground label-eyebrow" data-testid="st-topic-save">Save</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

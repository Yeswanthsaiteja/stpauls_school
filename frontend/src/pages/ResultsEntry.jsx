import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Save, Calculator, Loader2 } from 'lucide-react';
import { listSubjects, bulkSaveResults, listClasses, listExamSetups, listResults } from '../services/firebase/academicService';
import { listStudents } from '../services/firebase/studentsService';
import { calcGrade } from '../lib/utils';
import { toast } from 'sonner';

export default function ResultsEntry() {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [examId, setExamId] = useState('');
  const [totalMarks, setTotalMarks] = useState(100);
  const [marks, setMarks] = useState({});

  useEffect(() => {
    Promise.all([listClasses(), listSubjects(), listStudents({ status: 'ACTIVE' }), listExamSetups()]).then(([clsList, subs, stus, exs]) => {
      setClasses(clsList);
      setSubjects(subs);
      setStudents(stus);
      setExams(exs);
      if (clsList.length > 0) {
        const defaultClass = clsList[0];
        setClassName(defaultClass.name);
        if (defaultClass.sections?.length > 0) setSection(defaultClass.sections[0]);
      }
      setLoading(false);
    });
  }, []);

  const activeClassObj = classes.find(c => c.name === className);
  const applicableExams = exams.filter(e => e.classes?.includes(className));
  const activeExam = exams.find(e => e.id === examId) || applicableExams[0];
  const activeExamName = activeExam ? (activeExam.examType === 'Other' ? activeExam.customName : activeExam.examType) : '';
  
  useEffect(() => {
    if (applicableExams.length > 0 && (!examId || !applicableExams.find(e => e.id === examId))) {
      setExamId(applicableExams[0].id);
    }
  }, [applicableExams, examId]);

  useEffect(() => {
    const clsSubs = subjects.filter(s => s.className === className);
    if (clsSubs.length > 0 && (!subjectId || !clsSubs.find(s => s.id === subjectId))) {
      setSubjectId(clsSubs[0].id);
    }
  }, [className, subjects, subjectId]);

  useEffect(() => {
    if (!className || !activeExamName || !subjectId) {
      setMarks({});
      return;
    }
    const loadMarks = async () => {
      const res = await listResults({ className, examType: activeExamName });
      const currentSubjectRes = res.filter(r => r.subjectId === subjectId);
      const newMarks = {};
      currentSubjectRes.forEach(r => {
        newMarks[r.studentId] = r.marks;
      });
      setMarks(newMarks);
    };
    loadMarks();
  }, [className, activeExamName, subjectId]);

  const rows    = useMemo(() => students.filter((s) => s.className === className && (!section || s.section === section)), [students, className, section]);
  const sectionOpts = activeClassObj ? activeClassObj.sections : [];
  const classOpts = classes.map(c => c.name);
  const filteredSubjects = subjects.filter(s => s.className === className);
  const subject = subjects.find((s) => s.id === subjectId);
  const summary = useMemo(() => {
    const entries = Object.values(marks).map(Number).filter((x) => !isNaN(x));
    if (!entries.length) return { avg: 0, top: 0, low: 0 };
    return {
      avg: Math.round(entries.reduce((s, x) => s + x, 0) / entries.length),
      top: Math.max(...entries),
      low: Math.min(...entries),
    };
  }, [marks]);

  const saveAll = async () => {
    if (!className) return toast.error('Select a class');
    if (!subjectId) return toast.error('Select a subject');
    if (!activeExamName) return toast.error('Select an exam. Go to Exam Scheduling to create one.');
    
    const entries = Object.entries(marks).filter(([, v]) => v !== '' && v !== undefined);
    if (!entries.length) return toast.error('Enter at least one mark');
    setSaving(true);
    const payload = entries.map(([studentId, m]) => {
      const num = Number(m);
      const grade = calcGrade(num, totalMarks);
      const student = students.find((s) => s.id === studentId);
      return { studentId, studentName: student?.fullName, subjectId, subject: subject?.name, examType: activeExamName, marks: num, totalMarks, grade, className, section };
    });
    await bulkSaveResults(payload);
    toast.success(`Saved ${payload.length} results to Firestore`);
    setSaving(false);
  };

  return (
    <div className="space-y-6" data-testid="results-entry">
      <NavLink to=".." className="label-eyebrow text-primary">← Back to Academic</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Results Entry</h1>

      <div className="glass-morphism rounded-[2rem] p-5 grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <label className="label-eyebrow text-muted-foreground">Class</label>
          <select value={className} onChange={(e) => {
            setClassName(e.target.value);
            const newCls = classes.find(c => c.name === e.target.value);
            if (newCls?.sections?.length > 0) setSection(newCls.sections[0]);
            else setSection('');
            const newSubs = subjects.filter(s => s.className === e.target.value);
            if (newSubs.length > 0) setSubjectId(newSubs[0].id);
            else setSubjectId('');
          }} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="results-class">
            {classOpts.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Section</label>
          <select value={section} onChange={(e) => setSection(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="results-section">
            <option value="">All</option>
            {sectionOpts.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Subject</label>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="results-subject">
            {filteredSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Exam</label>
          <select value={examId} onChange={(e) => setExamId(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="results-exam">
            {applicableExams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.examType === 'Other' ? e.customName : e.examType}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Total Marks</label>
          <input type="number" value={totalMarks} onChange={(e) => setTotalMarks(Number(e.target.value) || 100)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="results-total" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-muted-foreground">Students</div><div className="font-display font-black text-2xl tracking-tighter">{rows.length}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-muted-foreground">Average</div><div className="font-display font-black text-2xl tracking-tighter">{summary.avg}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-muted-foreground">Top</div><div className="font-display font-black text-2xl tracking-tighter text-emerald-500">{summary.top || '—'}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-muted-foreground">Lowest</div><div className="font-display font-black text-2xl tracking-tighter text-rose-500">{summary.low || '—'}</div></div>
      </div>

      <div className="glass-morphism rounded-[2rem] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="label-eyebrow text-muted-foreground flex items-center gap-1.5"><Calculator className="h-3.5 w-3.5" />Mark Entry</div>
          <button onClick={saveAll} disabled={saving} className="h-10 px-5 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2 disabled:opacity-60" data-testid="results-save-btn">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Saving…' : 'Save All'}
          </button>
        </div>
        <div className="overflow-x-auto thin-scrollbar">
          <table className="w-full">
            <thead><tr className="text-left">{['Adm. No','Student','Roll','Marks','Grade'].map((h) => <th key={h} className="label-eyebrow text-muted-foreground p-2">{h}</th>)}</tr></thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="text-center text-sm text-muted-foreground py-8">No students in {className}-{section}</td></tr>
              )}
              {rows.map((s) => {
                const m = marks[s.id] || '';
                const grade = m !== '' ? calcGrade(Number(m), totalMarks) : '—';
                return (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-t border-border hover:bg-muted/30">
                    <td className="p-2 font-mono text-xs font-bold">{s.admissionNo}</td>
                    <td className="p-2 font-bold text-sm">{s.fullName}</td>
                    <td className="p-2 text-sm">{s.rollNo}</td>
                    <td className="p-2">
                      <input type="number" min={0} max={totalMarks} value={m} onChange={(e) => setMarks((mm) => ({ ...mm, [s.id]: e.target.value }))} className="w-24 h-9 px-3 rounded-xl border border-border bg-card text-sm" data-testid={`mark-${s.id}`} />
                    </td>
                    <td className="p-2"><span className={`px-2.5 py-1 rounded-full label-eyebrow ${grade === '—' ? 'bg-muted text-muted-foreground' : grade === 'F' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>{grade}</span></td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

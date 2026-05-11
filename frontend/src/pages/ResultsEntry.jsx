import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Save, Calculator } from 'lucide-react';
import { demoStore } from '../services/demoStore';
import { calcGrade } from '../lib/utils';
import { toast } from 'sonner';

export default function ResultsEntry() {
  const subjects = demoStore.list('subjects');
  const students = demoStore.list('students');
  const [className, setClassName] = useState('X');
  const [section, setSection] = useState('A');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [examName, setExamName] = useState('Mid-Term');
  const [totalMarks, setTotalMarks] = useState(100);
  const [marks, setMarks] = useState({}); // {studentId: marks}

  const rows = useMemo(() => students.filter((s) => s.className === className && (!section || s.section === section)), [students, className, section]);
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

  const saveAll = () => {
    const entries = Object.entries(marks).filter(([, v]) => v !== '' && v !== undefined);
    if (!entries.length) return toast.error('Enter at least one mark');
    entries.forEach(([studentId, m]) => {
      const num = Number(m);
      const grade = calcGrade(num, totalMarks);
      const student = students.find((s) => s.id === studentId);
      demoStore.add('results', {
        studentId, studentName: student?.fullName,
        subjectId, subjectName: subject?.name,
        examName, marks: num, totalMarks, grade, className,
      });
    });
    toast.success(`Saved ${entries.length} results`);
    setMarks({});
  };

  return (
    <div className="space-y-6" data-testid="results-entry">
      <NavLink to=".." className="label-eyebrow text-primary">← Back to Academic</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Results Entry</h1>

      <div className="glass-morphism rounded-[2rem] p-5 grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <label className="label-eyebrow text-muted-foreground">Class</label>
          <select value={className} onChange={(e) => setClassName(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="results-class">
            {['VI','VII','VIII','IX','X','XI','XII'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Section</label>
          <select value={section} onChange={(e) => setSection(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="results-section">
            {['A','B','C'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Subject</label>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="results-subject">
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Exam</label>
          <input value={examName} onChange={(e) => setExamName(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="results-exam" />
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
          <button onClick={saveAll} className="h-10 px-5 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2" data-testid="results-save-btn">
            <Save className="h-3.5 w-3.5" />Save All
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

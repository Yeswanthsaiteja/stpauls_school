import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Save, MessageCircle, CalendarDays } from 'lucide-react';
import { demoStore } from '../services/demoStore';
import { getWhatsAppUrl } from '../lib/utils';
import { toast } from 'sonner';

const STATUS = ['PRESENT', 'ABSENT', 'LATE'];
const labelOf = { PRESENT: 'P', ABSENT: 'A', LATE: 'L' };
const colorOf = {
  PRESENT: 'bg-emerald-500 text-white',
  ABSENT: 'bg-rose-500 text-white',
  LATE: 'bg-amber-500 text-white',
};

export default function StudentAttendance() {
  const students = demoStore.list('students');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [className, setClassName] = useState('X');
  const [section, setSection] = useState('A');
  const [marks, setMarks] = useState({}); // {studentId: 'PRESENT'|'ABSENT'|'LATE'}

  const rows = useMemo(() => students.filter((s) => s.className === className && s.section === section), [students, className, section]);

  const setAll = (status) => {
    const m = {};
    rows.forEach((s) => { m[s.id] = status; });
    setMarks(m);
  };

  const counts = useMemo(() => {
    const c = { PRESENT: 0, ABSENT: 0, LATE: 0 };
    Object.values(marks).forEach((s) => { c[s] = (c[s] || 0) + 1; });
    return c;
  }, [marks]);

  const save = () => {
    const entries = Object.entries(marks);
    if (!entries.length) return toast.error('Mark at least one student');
    entries.forEach(([studentId, status]) => {
      demoStore.add('attendance', { studentId, date, status, type: 'STUDENT', markedBy: 'Admin' });
    });
    toast.success(`Saved attendance for ${entries.length} students`);
  };

  return (
    <div className="space-y-6" data-testid="student-attendance">
      <NavLink to=".." className="label-eyebrow text-primary">← Back to Attendance</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Student Attendance</h1>

      <div className="glass-morphism rounded-[2rem] p-5 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="label-eyebrow text-muted-foreground"><CalendarDays className="inline h-3 w-3 mr-1" />Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="att-date" />
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Class</label>
          <select value={className} onChange={(e) => setClassName(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="att-class">
            {['VI','VII','VIII','IX','X','XI','XII'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Section</label>
          <select value={section} onChange={(e) => setSection(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="att-section">
            {['A','B','C'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button onClick={() => setAll('PRESENT')} className="flex-1 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 label-eyebrow" data-testid="att-mark-all">Mark All Present</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-emerald-500">Present</div><div className="font-display font-black text-2xl tracking-tighter">{counts.PRESENT || 0}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-rose-500">Absent</div><div className="font-display font-black text-2xl tracking-tighter">{counts.ABSENT || 0}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-amber-500">Late</div><div className="font-display font-black text-2xl tracking-tighter">{counts.LATE || 0}</div></div>
      </div>

      <div className="glass-morphism rounded-[2rem] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="label-eyebrow text-muted-foreground">Roster · {rows.length} students</div>
          <button onClick={save} className="h-10 px-5 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2" data-testid="att-save">
            <Save className="h-3.5 w-3.5" />Save Attendance
          </button>
        </div>
        <div className="space-y-2">
          {rows.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">No students in this class/section</div>}
          {rows.map((s) => {
            const status = marks[s.id];
            return (
              <motion.div key={s.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 p-3 rounded-2xl border border-border">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white font-black text-sm">{s.firstName[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{s.fullName}</div>
                  <div className="label-eyebrow text-muted-foreground">{s.admissionNo} · Roll {s.rollNo}</div>
                </div>
                <div className="flex gap-1.5">
                  {STATUS.map((st) => (
                    <button key={st} onClick={() => setMarks((mm) => ({ ...mm, [s.id]: st }))} data-testid={`att-${s.id}-${st}`} className={`h-9 w-9 rounded-xl text-xs font-black ${status === st ? colorOf[st] : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                      {labelOf[st]}
                    </button>
                  ))}
                </div>
                {status === 'ABSENT' && s.phoneNumber && (
                  <a href={getWhatsAppUrl(s.phoneNumber, `Your child ${s.fullName} was marked absent on ${date}. Kindly inform if you have any concern.`)} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-xl bg-emerald-500/10 text-emerald-600 label-eyebrow flex items-center gap-1.5" data-testid={`att-wa-${s.id}`}>
                    <MessageCircle className="h-3 w-3" />Notify
                  </a>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * StaffDashboard — fully scoped to:
 *  • Home: stats for their classes
 *  • My Class: view/edit (no remove/rejoin) — only their class-teacher class
 *  • Attendance: mark/view — only their class-teacher class
 *  • Marks Entry: for each class they teach × subject they teach
 *  • Topics: mark syllabus topics as completed
 *  • Leave: apply / view own leave (real-time status updates)
 *  • Messages: send/receive messages (real-time via onSnapshot)
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import {
  Bell, Save, Send, Plus, RefreshCw,
  Sparkles, Edit3, X, CheckSquare, Square,
  Loader2, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { listStudents, updateStudent } from '../services/firebase/studentsService';
import { listEmployees, listLeaveRequests, addLeaveRequest } from '../services/firebase/employeesService';
import { getAttendance, saveAttendance } from '../services/firebase/attendanceService';
import { listSubjects, listTopics, updateTopic, listClasses, listExamSetups, bulkSaveResults, listResults } from '../services/firebase/academicService';
import { calcGrade } from '../lib/utils';
import { listAnnouncements, sendMessage, subscribeMessages } from '../services/firebase/communicationService';
import { addNotification } from '../services/firebase/notificationsService';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const TODAY = new Date().toISOString().slice(0, 10);
const TENANT_ID_LEAVE = process.env.REACT_APP_TENANT_ID || 'stpauls';

/** Derive active section from URL path */
function useSectionFromPath() {
  const { pathname } = useLocation();
  const seg = pathname.split('/').pop();
  const map = { 'my-class': 'students', attendance: 'attendance', marks: 'marks', topics: 'topics', leave: 'leave', messages: 'messages' };
  return map[seg] || 'home';
}

/**
 * Derive what a staff member teaches from Firestore class + subject records.
 * Classes: saved with teacher1/teacher2 = employee fullName
 * Subjects: saved with teacherId = employee fullName
 */
function deriveAssignments(fullName, classes, subjects) {
  if (!fullName) return { myClasses: [], myClass: null, myClassRecords: [], teachingSubjects: [], teachingClasses: [] };

  // All classes where this teacher is teacher1 OR teacher2
  const myClassRecords = classes.filter(c => c.teacher1 === fullName || c.teacher2 === fullName);
  const myClass = myClassRecords[0]?.name || null; // primary class (for backward compat)

  // Subjects this teacher is assigned to
  const teachingSubjects = subjects.filter(s => s.teacherId === fullName);

  // All class names from class-teacher records + subject records (for marks)
  const seen = new Set();
  const teachingClasses = [
    // Classes where they are class teacher
    ...myClassRecords.map(c => ({ label: c.name, className: c.name, section: '', isClassTeacher: true })),
    // Classes from subject assignments
    ...teachingSubjects.map(s => ({
      label: `${s.className}${s.section ? `-${s.section}` : ''}`,
      className: s.className, section: s.section || '', isClassTeacher: false,
    })),
  ].filter(c => { const key = `${c.className}-${c.section}`; if (seen.has(key)) return false; seen.add(key); return true; });

  return { myClasses: myClassRecords.map(c => c.name), myClass, myClassRecords, teachingSubjects, teachingClasses };
}

// ─── Student Edit Mini-Modal ──────────────────────────────────────────────────
function StudentEditModal({ student, onClose, onSaved }) {
  const [form, setForm] = useState({ fullName: student.fullName, phoneNumber: student.phoneNumber || '', address: student.address || '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await updateStudent(student.id, form); onSaved({ ...student, ...form }); toast.success('Saved'); onClose(); }
    catch { toast.error('Save failed'); }
    setSaving(false);
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
        className="w-full max-w-md bg-background rounded-[2rem] border border-border p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Edit Student Details</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        {[
          { label: 'Full Name', key: 'fullName' },
          { label: 'Phone', key: 'phoneNumber' },
          { label: 'Address', key: 'address' },
        ].map(f => (
          <div key={f.key}>
            <label className="label-eyebrow text-muted-foreground">{f.label}</label>
            <input value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary" />
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground label-eyebrow text-xs disabled:opacity-60 flex items-center justify-center gap-1.5">
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</> : <><Save className="h-3.5 w-3.5" />Save</>}
          </button>
          <button onClick={onClose} className="px-4 rounded-xl bg-muted label-eyebrow text-xs">Cancel</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Home Tab ──────────────────────────────────────────────────────────────────
function HomeTab({ profile, assignments, myStudents, announcements, pendingLeaves }) {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const { myClasses, myClass, teachingClasses, teachingSubjects } = assignments;
  const uniqueSubjects = [...new Set(teachingSubjects.map(s => s.name))];

  return (
    <div className="space-y-5">
      <div className="relative rounded-[2rem] p-6 bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700 text-white overflow-hidden">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1"><Sparkles className="h-4 w-4 text-cyan-200" /><span className="label-eyebrow text-cyan-200">{today}</span></div>
          <h1 className="font-display font-black text-3xl tracking-tighter">Welcome, {profile?.fullName?.split(' ')[0] || 'Staff'}</h1>
          <p className="text-white/70 text-sm mt-1">{profile?.designation || profile?.role} · {profile?.department || "St. Paul's"}</p>
          {myClasses.length > 0 && <p className="text-white/80 text-sm mt-1 font-bold">Class Teacher: {myClasses.join(', ')}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'My Students', value: myStudents.length, color: 'from-indigo-500 to-violet-500' },
          { label: 'Teaching Classes', value: teachingClasses.length, color: 'from-cyan-500 to-blue-500' },
          { label: 'Subjects', value: uniqueSubjects.length || 0, color: 'from-violet-500 to-fuchsia-500' },
          { label: 'Pending Leaves', value: pendingLeaves, color: 'from-amber-500 to-orange-500' },
        ].map((s, i) => (
          <motion.div key={i} whileHover={{ y: -4 }} className="glass-morphism rounded-[2rem] p-5">
            <div className={`h-10 w-10 rounded-2xl bg-gradient-to-br ${s.color} grid place-items-center text-white mb-3`}><Users className="h-4 w-4" /></div>
            <div className="label-eyebrow text-muted-foreground">{s.label}</div>
            <div className="font-display font-black text-3xl tracking-tighter mt-1">{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Teaching assignment (auto-derived from class + subject records) */}
      <div className="glass-morphism rounded-[2rem] p-5">
        <div className="label-eyebrow text-muted-foreground mb-3">My Teaching Assignment</div>
        {myClass || teachingSubjects.length > 0 ? (
          <div className="space-y-2">
            {myClasses.length > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                <Users className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <div><div className="label-eyebrow text-muted-foreground">Class Teacher of</div><div className="text-sm font-bold">{myClasses.join(', ')}</div></div>
              </div>
            )}
            {teachingSubjects.length > 0 && (
              <div className="space-y-1">
                {teachingSubjects.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-muted/30">
                    <span className="text-sm font-bold">{s.name}</span>
                    <span className="label-eyebrow text-muted-foreground">{s.className}{s.section ? `-${s.section}` : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No class or subjects assigned yet. Admin can assign you as class teacher in <strong>Academic → Classes & Sections</strong>, and assign subjects in <strong>Academic → Subjects</strong>.
          </p>
        )}
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="glass-morphism rounded-[2rem] p-5">
          <div className="flex items-center gap-2 mb-3"><Bell className="h-4 w-4 text-primary" /><span className="label-eyebrow">Announcements</span></div>
          {announcements.slice(0, 4).map((a, i) => (
            <div key={a.id || i} className="p-3 rounded-2xl bg-muted/30 border border-border mb-2">
              <div className="flex justify-between gap-2"><p className="text-sm font-bold">{a.title || a.message}</p><span className="label-eyebrow text-muted-foreground whitespace-nowrap">{a.date}</span></div>
              {a.title && a.message && <p className="text-xs text-muted-foreground mt-1">{a.message}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── My Class Tab ─────────────────────────────────────────────────────────────
function MyClassTab({ assignments, students, setStudents }) {
  const { myClasses } = assignments;
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);

  // All ACTIVE students from ALL classes this teacher is class-teacher of
  const myStudents = students.filter(s => s.status === 'ACTIVE' && myClasses.includes(s.className));
  const filtered = myStudents.filter(s =>
    !search || (s.fullName || '').toLowerCase().includes(search.toLowerCase()) || (s.admissionNo || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {myClasses.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-700">
          You are not assigned as class teacher of any class yet. Admin can assign you in <strong>Academic → Classes & Sections</strong>.
        </div>
      )}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or admission no…"
        className="w-full px-4 py-3 rounded-2xl border-2 border-border bg-card outline-none focus:border-primary text-sm" />
      <div className="label-eyebrow text-muted-foreground">{filtered.length} students · {myClasses.length > 0 ? myClasses.join(', ') : 'No class assigned'}</div>
      <div className="space-y-2">
        {filtered.map((s, i) => (
          <div key={s.id || i} className="glass-morphism rounded-2xl p-4 flex items-center gap-4">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 grid place-items-center text-white font-black text-lg flex-shrink-0">
              {(s.fullName || 'S')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold">{s.fullName}</div>
              <div className="text-xs text-muted-foreground">{s.admissionNo} · Sec {s.section}</div>
              <div className="text-xs text-muted-foreground">{s.phoneNumber && `Ph: ${s.phoneNumber}`}</div>
            </div>
            <button onClick={() => setEditing(s)}
              className="h-8 w-8 rounded-xl bg-muted grid place-items-center hover:bg-primary hover:text-primary-foreground transition-colors">
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No students found in your class</p>}
      </div>
      <AnimatePresence>
        {editing && (
          <StudentEditModal student={editing} onClose={() => setEditing(null)}
            onSaved={updated => { setStudents(prev => prev.map(s => s.id === updated.id ? updated : s)); setEditing(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────
function AttendanceTab({ assignments, students, staffName }) {
  const { myClasses, myClassRecords } = assignments;

  // State: selected class for attendance
  const [selClass, setSelClass] = useState(myClasses[0] || '');
  const selRecord = myClassRecords?.find(r => r.name === selClass);
  const sections = selRecord?.sections || ['A'];
  const [selSection, setSelSection] = useState(sections[0] || 'A');
  const [date, setDate] = useState(TODAY);
  const [records, setRecords] = useState({});
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState(false);

  const myStudents = students.filter(s =>
    s.status === 'ACTIVE' && selClass && s.className === selClass && s.section === selSection
  );

  useEffect(() => {
    if (!selClass) return;
    getAttendance(selClass, selSection, date).then(r => {
      if (r && Object.keys(r).length > 0) { setRecords(r); setExisting(true); }
      else {
        const init = {};
        myStudents.forEach(s => { init[s.id] = 'PRESENT'; });
        setRecords(init); setExisting(false);
      }
    });
  }, [date, selClass, selSection, myStudents.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = id => setRecords(prev => {
    const cur = prev[id] || 'PRESENT';
    return { ...prev, [id]: cur === 'PRESENT' ? 'ABSENT' : cur === 'ABSENT' ? 'LATE' : 'PRESENT' };
  });

  const save = async () => {
    if (!selClass) return toast.error('Select a class first');
    setSaving(true);
    try {
      await saveAttendance(selClass, selSection, date, records, staffName || 'Staff');
      toast.success('Attendance saved!'); setExisting(true);
    } catch (e) { toast.error(e.message || 'Failed'); }
    setSaving(false);
  };

  const colorOf = s => s === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
    : s === 'ABSENT' ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
    : 'bg-amber-500/10 text-amber-600 border-amber-500/30';

  const present = Object.values(records).filter(v => v === 'PRESENT').length;
  const absent  = Object.values(records).filter(v => v === 'ABSENT').length;
  const late    = Object.values(records).filter(v => v === 'LATE').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="px-4 py-2 rounded-2xl border-2 border-border bg-card outline-none focus:border-primary text-sm font-bold" />
        {/* Class selector */}
        {myClasses.length > 1 && (
          <div className="flex gap-1 bg-muted rounded-2xl p-1">
            {myClasses.map(cls => (
              <button key={cls} onClick={() => { setSelClass(cls); setSelSection('A'); setRecords({}); }}
                className={`px-3 py-1.5 rounded-xl label-eyebrow text-xs ${selClass === cls ? 'bg-background shadow' : 'text-muted-foreground'}`}>
                {cls}
              </button>
            ))}
          </div>
        )}
        {/* Section selector — if the selected class has multiple sections */}
        {sections.length > 1 && (
          <div className="flex gap-1 bg-muted rounded-2xl p-1">
            {sections.map(sec => (
              <button key={sec} onClick={() => { setSelSection(sec); setRecords({}); }}
                className={`px-3 py-1.5 rounded-xl label-eyebrow text-xs ${selSection === sec ? 'bg-background shadow' : 'text-muted-foreground'}`}>
                Section {sec}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold">✓ {present}</span>
          <span className="px-3 py-1.5 rounded-full bg-rose-500/10 text-rose-600 font-bold">✗ {absent}</span>
          <span className="px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 font-bold">~ {late}</span>
        </div>
        {existing && <span className="px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 label-eyebrow">Already saved</span>}
      </div>
      {myClasses.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-700">
          You are not assigned as class teacher. Admin can assign you in <strong>Academic → Classes & Sections</strong>.
        </div>
      )}
      <div className="space-y-2">
        {myStudents.map((s, i) => {
          const status = records[s.id] || 'PRESENT';
          return (
            <div key={s.id || i} className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${colorOf(status)}`} onClick={() => toggle(s.id)}>
              <div className="h-9 w-9 rounded-xl bg-white/20 grid place-items-center font-black text-sm flex-shrink-0">{i + 1}</div>
              <div className="flex-1"><div className="font-bold text-sm">{s.fullName}</div><div className="text-xs opacity-70">{s.admissionNo}</div></div>
              <span className="label-eyebrow font-black">{status}</span>
            </div>
          );
        })}
        {myStudents.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No active students in your class</p>}
      </div>
      {myStudents.length > 0 && (
        <button onClick={save} disabled={saving}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <><RefreshCw className="h-4 w-4 animate-spin" />Saving…</> : <><Save className="h-4 w-4" />Save Attendance</>}
        </button>
      )}
    </div>
  );
}

// ─── Marks Entry Tab ──────────────────────────────────────────────────────────
function MarksTab({ assignments, allStudents }) {
  const { teachingClasses, teachingSubjects, myClasses } = assignments;

  // All class names this teacher is responsible for
  const allMyClassNames = [...new Set([
    ...myClasses,
    ...teachingSubjects.map(s => s.className),
  ])];

  const [allExams, setAllExams] = useState([]);
  const [allSubjectsData, setAllSubjectsData] = useState([]);
  const [className, setClassName] = useState(allMyClassNames[0] || '');
  const [section, setSection] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [examId, setExamId] = useState('');
  const [totalMarks, setTotalMarks] = useState(100);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([listExamSetups(), listSubjects()]).then(([exs, subs]) => {
      setAllExams(exs);
      setAllSubjectsData(subs);
      setLoading(false);
    });
  }, []);

  // Exams applicable to selected class
  const applicableExams = allExams.filter(e => !className || e.classes?.includes(className));
  const activeExam = allExams.find(e => e.id === examId) || applicableExams[0];
  const activeExamName = activeExam ? (activeExam.examType === 'Other' ? activeExam.customName : activeExam.examType) : '';

  // Subjects this teacher is assigned to for the selected class (teacherId stores fullName)
  const mySubjectNames = new Set(teachingSubjects.map(s => s.name));
  const classSubjects = allSubjectsData.filter(s =>
    s.className === className && (
      teachingSubjects.some(ts => ts.id === s.id) || // exact match by id
      mySubjectNames.has(s.name)                      // or by name
    )
  );

  // Students for selected class/section
  const rows = allStudents.filter(s =>
    s.status === 'ACTIVE' && s.className === className && (!section || s.section === section)
  );

  // Auto-select exam when class changes
  useEffect(() => {
    if (applicableExams.length > 0 && (!examId || !applicableExams.find(e => e.id === examId))) {
      setExamId(applicableExams[0].id);
    }
  }, [className, allExams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select subject when class changes
  useEffect(() => {
    if (classSubjects.length > 0 && (!subjectId || !classSubjects.find(s => s.id === subjectId))) {
      setSubjectId(classSubjects[0].id);
    }
  }, [className, allSubjectsData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing marks when class/exam/subject changes
  useEffect(() => {
    if (!className || !activeExamName || !subjectId) { setMarks({}); return; }
    listResults({ className, examType: activeExamName }).then(res => {
      const subRes = res.filter(r => r.subjectId === subjectId);
      const newMarks = {};
      subRes.forEach(r => { newMarks[r.studentId] = r.marks; });
      setMarks(newMarks);
    });
  }, [className, activeExamName, subjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const subject = allSubjectsData.find(s => s.id === subjectId);

  const summary = (() => {
    const entries = Object.values(marks).map(Number).filter(x => !isNaN(x) && x !== 0);
    if (!entries.length) return { avg: 0, top: 0, low: 0 };
    return { avg: Math.round(entries.reduce((a, x) => a + x, 0) / entries.length), top: Math.max(...entries), low: Math.min(...entries) };
  })();

  const saveAll = async () => {
    if (!className) return toast.error('Select a class');
    if (classSubjects.length === 0) return toast.error('No subjects assigned to you for this class. Ask admin to assign subjects in Academic → Subjects.');
    if (!subjectId) return toast.error('Select a subject');
    if (!activeExamName) return toast.error('No exam found. Admin must create an exam in Exam Setup first.');
    const entries = Object.entries(marks).filter(([, v]) => v !== '' && v !== undefined);
    if (!entries.length) return toast.error('Enter at least one mark');
    setSaving(true);
    try {
      const payload = entries.map(([studentId, m]) => {
        const num = Number(m);
        const student = allStudents.find(s => s.id === studentId);
        return { studentId, studentName: student?.fullName, subjectId, subject: subject?.name, examType: activeExamName, marks: num, totalMarks, grade: calcGrade(num, totalMarks), className, section };
      });
      await bulkSaveResults(payload);
      toast.success(`Saved ${payload.length} results for ${subject?.name} — ${activeExamName}`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save results');
    }
    setSaving(false);
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground text-sm">Loading exams…</div>;

  return (
    <div className="space-y-4">
      {allMyClassNames.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-700">
          No classes assigned. Admin can assign subjects to you in <strong>Academic → Subjects</strong>.
        </div>
      )}

      {classSubjects.length === 0 && className && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-700">
          ⚠️ No subjects assigned to you for <strong>{className}</strong>. Ask admin to assign subjects in <strong>Academic → Subjects</strong> with your name as teacher. You cannot enter marks without a subject assignment.
        </div>
      )}

      {classSubjects.length > 0 && applicableExams.length === 0 && className && (
        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-sm text-blue-700">
          No exams scheduled for <strong>{className}</strong> yet. Admin must create one in <strong>Academic → Exam Setup</strong>.
        </div>
      )}

      {/* Controls — identical layout to admin ResultsEntry */}
      <div className="glass-morphism rounded-[2rem] p-5 grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <label className="label-eyebrow text-muted-foreground">Class</label>
          <select value={className} onChange={e => { setClassName(e.target.value); setSection(''); setSubjectId(''); setMarks({}); }}
            className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm">
            {allMyClassNames.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Section</label>
          <select value={section} onChange={e => setSection(e.target.value)}
            className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm">
            <option value="">All</option>
            {['A','B','C','D','E'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Subject</label>
          <select value={subjectId} onChange={e => setSubjectId(e.target.value)}
            className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm">
            {classSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            {classSubjects.length === 0 && <option value="">No subjects</option>}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Exam</label>
          <select value={examId} onChange={e => setExamId(e.target.value)}
            className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm">
            {applicableExams.map(e => (
              <option key={e.id} value={e.id}>{e.examType === 'Other' ? e.customName : e.examType}</option>
            ))}
            {applicableExams.length === 0 && <option value="">No exams</option>}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Total Marks</label>
          <input type="number" value={totalMarks} onChange={e => setTotalMarks(Number(e.target.value) || 100)}
            className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-muted-foreground">Students</div><div className="font-display font-black text-2xl tracking-tighter">{rows.length}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-muted-foreground">Average</div><div className="font-display font-black text-2xl tracking-tighter">{summary.avg || '—'}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-muted-foreground">Top</div><div className="font-display font-black text-2xl tracking-tighter text-emerald-500">{summary.top || '—'}</div></div>
      </div>

      {/* Marks table — identical to admin */}
      <div className="glass-morphism rounded-[2rem] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="label-eyebrow text-muted-foreground">Mark Entry · {activeExamName || 'Select exam'}</div>
          <button onClick={saveAll} disabled={saving || !activeExamName}
            className="h-10 px-5 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2 disabled:opacity-60">
            {saving ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Saving…</> : <><Save className="h-3.5 w-3.5" />Save All</>}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="text-left">{['Adm. No','Student','Roll','Marks','Grade'].map(h => <th key={h} className="label-eyebrow text-muted-foreground p-2">{h}</th>)}</tr></thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="text-center text-sm text-muted-foreground py-8">No students in {className}{section ? `-${section}` : ''}</td></tr>
              )}
              {rows.map(s => {
                const m = marks[s.id] ?? '';
                const grade = m !== '' ? calcGrade(Number(m), totalMarks) : '—';
                return (
                  <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-2 font-mono text-xs font-bold">{s.admissionNo}</td>
                    <td className="p-2 font-bold text-sm">{s.fullName}</td>
                    <td className="p-2 text-sm text-muted-foreground">{s.rollNo || '—'}</td>
                    <td className="p-2">
                      <input type="number" min={0} max={totalMarks} value={m}
                        onChange={e => setMarks(mm => ({ ...mm, [s.id]: e.target.value }))}
                        className="w-24 h-9 px-3 rounded-xl border border-border bg-card text-sm" />
                    </td>
                    <td className="p-2">
                      <span className={`px-2.5 py-1 rounded-full label-eyebrow ${grade === '—' ? 'bg-muted text-muted-foreground' : grade === 'F' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>{grade}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Topics Tab ───────────────────────────────────────────────────────────────
function TopicsTab({ assignments, allSubjects, staffName }) {
  // Use subjects directly assigned to this teacher from Firestore subject records
  const mySubjects = assignments.teachingSubjects;
  const [topics, setTopics] = useState([]);
  const [selSubject, setSelSubject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState({});

  // Auto-select first subject
  useEffect(() => { if (mySubjects.length > 0 && !selSubject) setSelSubject(mySubjects[0]); }, [mySubjects.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTopics = useCallback(async (subjectId) => {
    if (!subjectId) return;
    setLoading(true);
    const t = await listTopics({ subjectId });
    setTopics(t);
    setLoading(false);
  }, []);

  // Auto-load topics whenever selected subject changes
  useEffect(() => { if (selSubject?.id) loadTopics(selSubject.id); }, [selSubject?.id, loadTopics]);

  const toggleComplete = async (topic) => {
    const isCompleted = topic.status === 'COMPLETED';
    setToggling(p => ({ ...p, [topic.id]: true }));
    try {
      await updateTopic(topic.id, {
        status: isCompleted ? 'PENDING' : 'COMPLETED',
        completedBy: isCompleted ? null : staffName,
        completedDate: isCompleted ? null : TODAY,
      });
      setTopics(prev => prev.map(t => t.id === topic.id ? { ...t, status: isCompleted ? 'PENDING' : 'COMPLETED', completedBy: isCompleted ? null : staffName } : t));
      toast.success(isCompleted ? 'Marked as pending' : 'Topic marked as completed!');
    } catch { toast.error('Failed to update topic'); }
    setToggling(p => ({ ...p, [topic.id]: false }));
  };

  return (
    <div className="space-y-4">
      {mySubjects.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-700">
          No subjects assigned. Admin can assign subjects to you in <strong>Academic → Subjects</strong>.
        </div>
      )}

      {/* Subject selector — from assigned subjects in Firestore */}
      <div className="flex gap-2 flex-wrap">
        {mySubjects.map(s => (
          <button key={s.id} onClick={() => { setSelSubject(s); loadTopics(s.id); }}
            className={`px-3 py-2 rounded-2xl label-eyebrow text-xs border transition-all ${selSubject?.id === s.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border'}`}>
            {s.name} {s.className && `(${s.className}${s.section ? `-${s.section}` : ''})`}
          </button>
        ))}
      </div>

      {selSubject && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="label-eyebrow text-muted-foreground">{selSubject.name} · {topics.length} topic(s)</div>
            <div className="text-xs text-muted-foreground">{topics.filter(t => t.status === 'COMPLETED').length} completed</div>
          </div>

          {loading ? <div className="text-center py-6 text-muted-foreground text-sm">Loading…</div> : (
            topics.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">No topics added for this subject yet</p>
            ) : (
              topics.map((t, i) => {
                const done = t.status === 'COMPLETED';
                return (
                  <div key={t.id || i} className={`flex items-start gap-3 p-3 rounded-2xl border transition-colors ${done ? 'bg-emerald-500/5 border-emerald-500/20' : 'border-border'}`}>
                    <button onClick={() => toggleComplete(t)} disabled={toggling[t.id]}
                      className={`flex-shrink-0 mt-0.5 ${done ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                      {toggling[t.id] ? <Loader2 className="h-5 w-5 animate-spin" /> : done ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm ${done ? 'line-through text-muted-foreground' : ''}`}>{t.title || t.name}</div>
                      {t.description && <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>}
                      {done && t.completedBy && <div className="text-xs text-emerald-600 mt-1">✓ Completed by {t.completedBy} · {t.completedDate}</div>}
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      )}
      {!selSubject && mySubjects.length > 0 && (
        <p className="text-center text-muted-foreground py-8 text-sm">Select a subject above to view topics</p>
      )}
    </div>
  );
}

// ─── Leave Tab ────────────────────────────────────────────────────────────────
function LeaveTab({ profile }) {
  const [leaves, setLeaves] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ leaveType: 'Sick Leave', fromDate: TODAY, toDate: TODAY, reason: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const unsubLeaveRef = useRef(null);

  useEffect(() => {
    const staffId = profile?.employeeId; // Firestore doc ID
    if (!staffId) { setLoading(false); return; }

    // Real-time: staff sees their leave status update as soon as admin approves/rejects
    if (isFirebaseConfigured && db) {
      try {
        const q = query(
          collection(db, 'leave_requests'),
          where('tenantId', '==', TENANT_ID_LEAVE),
          where('employeeId', '==', staffId),
        );
        unsubLeaveRef.current = onSnapshot(q, (snap) => {
          const list = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          setLeaves(list);
          setLoading(false);
        }, (err) => {
          console.error('[LeaveTab]', err);
          listLeaveRequests({ employeeId: staffId }).then(r => { setLeaves(r); setLoading(false); });
        });
      } catch {
        listLeaveRequests({ employeeId: staffId }).then(r => { setLeaves(r); setLoading(false); });
      }
    } else {
      listLeaveRequests({ employeeId: staffId }).then(r => { setLeaves(r); setLoading(false); });
    }
    return () => { if (unsubLeaveRef.current) { unsubLeaveRef.current(); unsubLeaveRef.current = null; } };
  }, [profile?.employeeId]);

  const submit = async () => {
    if (!form.reason) return toast.error('Enter a reason');
    if (!form.fromDate || !form.toDate) return toast.error('Select dates');
    setSaving(true);
    try {
      const totalDays = Math.max(1, Math.ceil((new Date(form.toDate) - new Date(form.fromDate)) / 86400000) + 1);
      // profile.employeeId IS the Firestore employee doc ID (set in AuthContext resolvePhoneAsRole)
      const staffDocId = profile?.employeeId || '';
      const entry = await addLeaveRequest({
        ...form, totalDays,
        employeeId: staffDocId,
        employeeName: profile?.fullName || 'Staff',
        department: profile?.department || '',
        phone: profile?.phone || '',
        status: 'PENDING',
      });
      if (entry) {
        setLeaves(p => [entry, ...p]);
        toast.success('Leave request submitted — pending admin approval');
        setShowForm(false);
        setForm({ leaveType: 'Sick Leave', fromDate: TODAY, toDate: TODAY, reason: '' });
        // Notify admin of new leave request
        await addNotification({
          userId: 'admin',
          type: 'leave_request',
          title: `Leave Request: ${profile?.fullName || 'Staff'}`,
          body: `${profile?.fullName} applied for ${form.leaveType} (${form.fromDate} → ${form.toDate}). Reason: ${form.reason.slice(0, 60)}`,
        });
      } else {
        toast.error('Could not save leave request. Check browser console for details.');
      }
    } catch (err) {
      console.error('[LeaveTab] submit error:', err);
      toast.error(`Failed: ${err?.message || 'Unknown error'}`);
    }
    setSaving(false);
  };

  const statusStyle = { PENDING: 'bg-amber-500/10 text-amber-600', APPROVED: 'bg-emerald-500/10 text-emerald-600', REJECTED: 'bg-rose-500/10 text-rose-600' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="label-eyebrow text-muted-foreground">My Leave Requests</span>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-primary text-primary-foreground label-eyebrow text-xs">
          <Plus className="h-3.5 w-3.5" /> Apply Leave
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="glass-morphism rounded-[2rem] p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label-eyebrow text-muted-foreground">Leave Type</label>
                <select value={form.leaveType} onChange={e => setForm(f => ({ ...f, leaveType: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-card text-sm outline-none">
                  {['Sick Leave', 'Casual Leave', 'Earned Leave', 'Maternity Leave', 'Other'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label-eyebrow text-muted-foreground">From</label>
                <input type="date" value={form.fromDate} onChange={e => setForm(f => ({ ...f, fromDate: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-card text-sm outline-none" />
              </div>
              <div>
                <label className="label-eyebrow text-muted-foreground">To</label>
                <input type="date" value={form.toDate} onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-card text-sm outline-none" />
              </div>
              <div className="col-span-2">
                <label className="label-eyebrow text-muted-foreground">Reason</label>
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-card text-sm outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={submit} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground label-eyebrow text-xs disabled:opacity-50">{saving ? 'Submitting…' : 'Submit'}</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl bg-muted label-eyebrow text-xs">Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? <p className="text-center text-muted-foreground py-8 text-sm">Loading…</p> : (
        <div className="space-y-2">
          {leaves.map((l, i) => (
            <div key={l.id || i} className="glass-morphism rounded-2xl p-4 flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-sm">{l.leaveType}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{l.fromDate} → {l.toDate}</div>
                <div className="text-xs text-muted-foreground mt-1">{l.reason}</div>
              </div>
              <span className={`px-3 py-1 rounded-full label-eyebrow text-[9px] ${statusStyle[l.status] || statusStyle.PENDING}`}>{l.status || 'PENDING'}</span>
            </div>
          ))}
          {leaves.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No leave requests yet</p>}
        </div>
      )}
    </div>
  );
}

// ─── Messages Tab ─────────────────────────────────────────────────────────────
function MessagesTab({ profile, employees }) {
  // Staff's Firestore doc ID — used as senderId/recipientId in messages
  // profile.employeeId = Firestore employee doc ID (set in AuthContext resolvePhoneAsRole as match.id)
  const myId = profile?.employeeId || profile?.phone || '';

  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);  // full recipient object
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const unsubRef = useRef(null);

  // Build recipients list: School Admin first, then other active staff
  const recipients = [
    { id: 'admin', fullName: 'School Admin', role: 'admin', designation: 'Administrator' },
    ...employees.filter(e => e.id !== myId && e.status !== 'REMOVED'),
  ];

  // Real-time message subscription when selected recipient changes
  useEffect(() => {
    if (!selected || !myId) return;
    setLoading(true);
    setMessages([]);
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }

    const otherId = selected.id; // 'admin' or staff Firestore doc ID
    unsubRef.current = subscribeMessages(myId, otherId, (msgs) => {
      setMessages(msgs);
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; } };
  }, [selected?.id, myId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select School Admin on first render
  useEffect(() => {
    if (!selected && recipients.length > 0) setSelected(recipients[0]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!selected) return toast.error('Select a recipient');
    if (!text.trim()) return toast.error('Type a message');
    if (!myId) return toast.error('Your staff ID is not set. Please log out and log back in.');
    setSending(true);
    try {
      await sendMessage({
        senderId: myId,                          // staff's Firestore doc ID
        senderName: profile?.fullName || 'Staff',
        recipientId: selected.id,               // 'admin' or other staff's doc ID
        recipientName: selected.fullName,
        text: text.trim(),
      });
      setText('');
      // Notify recipient
      await addNotification({
        userId: selected.id,  // 'admin' or other staff doc ID
        type: 'message',
        title: `New message from ${profile?.fullName || 'Staff'}`,
        body: text.trim().slice(0, 80),
      });
      // subscribeMessages will automatically update the message list
    } catch (err) {
      console.error('[MessagesTab] send error:', err);
      toast.error('Failed to send message');
    }
    setSending(false);
  };

  return (
    <div className="space-y-4">
      {/* Recipient selector */}
      <div>
        <label className="label-eyebrow text-muted-foreground">To</label>
        <select
          value={selected?.id || ''}
          onChange={e => setSelected(recipients.find(r => r.id === e.target.value) || null)}
          className="mt-1 w-full px-4 py-2.5 rounded-2xl border-2 border-border bg-card text-sm outline-none focus:border-primary"
        >
          <option value="">Select recipient…</option>
          {recipients.map(r => (
            <option key={r.id} value={r.id}>
              {r.fullName}{r.role && r.role !== 'admin' ? ` (${r.designation || r.role})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Chat thread */}
      <div className="glass-morphism rounded-[2rem] overflow-hidden">
        <div className="px-4 py-3 border-b border-border label-eyebrow text-muted-foreground">
          {selected ? `Conversation with ${selected.fullName}` : 'Select a recipient above'}
        </div>
        <div className="p-4 space-y-2 overflow-y-auto" style={{ minHeight: '200px', maxHeight: '380px' }}>
          {loading && <p className="text-center text-muted-foreground py-4 text-sm">Loading…</p>}
          {!loading && messages.length === 0 && (
            <p className="text-center text-muted-foreground py-4 text-sm">
              {selected ? 'No messages yet. Start the conversation!' : 'Select a recipient to view messages.'}
            </p>
          )}
          {messages.map((m, i) => {
            const isMine = m.senderId === myId;
            return (
              <div key={m.id || i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${isMine ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {!isMine && <div className="text-[10px] font-bold mb-1 opacity-70">{m.senderName}</div>}
                  <div>{m.text || m.body}</div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        {/* Message input */}
        <div className="px-4 pb-4 pt-2 border-t border-border flex gap-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={selected ? `Message ${selected.fullName}…` : 'Select a recipient first'}
            disabled={!selected}
            className="flex-1 px-4 py-2.5 rounded-2xl border-2 border-border bg-card text-sm outline-none focus:border-primary disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim() || !selected}
            className="px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-1.5"
          >
            {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Staff Dashboard ─────────────────────────────────────────────────────
export default function StaffDashboard() {
  const { profile } = useAuth();
  const section = useSectionFromPath();
  const [students, setStudents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      listStudents({ status: 'ACTIVE' }),
      listEmployees({ status: 'ACTIVE' }),
      listLeaveRequests({ status: 'PENDING' }),
      listAnnouncements({ targetRole: 'STAFF' }),
      listSubjects(),
      listClasses(),
    ]).then(([sts, emps, leaves, anns, subs, cls]) => {
      setStudents(sts);
      setEmployees(emps);
      setPendingLeaves(leaves.length);
      setAnnouncements(anns);
      setAllSubjects(subs);
      setAllClasses(cls);
      setLoading(false);
    });
  }, []);

  // Derive all assignments from class + subject records — no manual entry needed
  const assignments = deriveAssignments(profile?.fullName, allClasses, allSubjects);

  const myStudents = students.filter(s =>
    s.status === 'ACTIVE' && assignments.myClasses.includes(s.className)
  );

  if (loading) {
    return <div className="text-center py-20 text-muted-foreground">Loading…</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div key={section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
        {section === 'home'       && <HomeTab profile={profile} assignments={assignments} myStudents={myStudents} announcements={announcements} pendingLeaves={pendingLeaves} />}
        {section === 'students'   && <MyClassTab assignments={assignments} students={students} setStudents={setStudents} />}
        {section === 'attendance' && <AttendanceTab assignments={assignments} students={students} staffName={profile?.fullName} />}
        {section === 'marks'      && <MarksTab assignments={assignments} allStudents={students} />}
        {section === 'topics'     && <TopicsTab assignments={assignments} allSubjects={allSubjects} staffName={profile?.fullName} />}
        {section === 'leave'      && <LeaveTab profile={profile} />}
        {section === 'messages'   && <MessagesTab profile={profile} employees={employees} />}
      </motion.div>
    </AnimatePresence>
  );
}

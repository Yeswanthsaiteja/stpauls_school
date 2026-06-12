import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Save, MessageCircle, CalendarDays, Loader2, RefreshCw, CheckCircle2, X, Send } from 'lucide-react';
import { listStudents } from '../services/firebase/studentsService';
import { listClasses } from '../services/firebase/academicService';
import { getAttendance, saveAttendance, listAttendance } from '../services/firebase/attendanceService';
import { listHolidays } from '../services/firebase/holidaysService';
import { getWhatsAppUrl } from '../lib/utils';
import { logActivity } from '../services/firebase/activityService';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const STATUS = ['PRESENT', 'ABSENT'];
const labelOf = { PRESENT: 'P', ABSENT: 'A' };
const colorOf = {
  PRESENT: 'bg-emerald-500 text-white',
  ABSENT: 'bg-rose-500 text-white',
};

export default function StudentAttendance() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [marks, setMarks] = useState({});
  const [existingRecord, setExistingRecord] = useState(null);
  const [recentRecords, setRecentRecords] = useState([]);
  const [tab, setTab] = useState('mark'); // 'mark' | 'history'
  const [absentModal, setAbsentModal] = useState(null); // list of absent students after save

  // Load classes from DB on mount
  useEffect(() => {
    listClasses().then((cls) => {
      setClasses(cls);
      if (cls.length > 0) {
        setClassName(cls[0].name);
        const firstSections = cls[0].sections || ['A'];
        setSection(firstSections[0] || 'A');
      }
      setLoading(false);
    });
  }, []);

  // Sections for selected class
  const sections = useMemo(() => {
    const cls = classes.find((c) => c.name === className);
    return cls?.sections?.length ? cls.sections : ['A'];
  }, [classes, className]);

  // When class changes, reset section to first available
  useEffect(() => {
    if (sections.length > 0 && !sections.includes(section)) {
      setSection(sections[0]);
    }
  }, [sections, section]);

  // Load students for selected class/section
  useEffect(() => {
    if (!className) return;
    setLoading(true);
    listStudents({ status: 'ACTIVE' }).then((all) => {
      const filtered = all.filter((s) => s.className === className && s.section === section);
      setStudents(filtered);
      setLoading(false);
    });
  }, [className, section]);

  const [holiday, setHoliday] = useState(null);

  // Load existing attendance when date/class/section changes
  useEffect(() => {
    if (!className || !section || !date) return;
    Promise.all([
      getAttendance(className, section, date),
      listHolidays()
    ]).then(([records, hols]) => {
      const hol = hols.find(h => h.date === date);
      setHoliday(hol || null);

      if (records && Object.keys(records).length > 0) {
        setMarks(records);
        setExistingRecord({ loaded: true });
      } else {
        const init = {};
        students.forEach((s) => { init[s.id] = 'PRESENT'; });
        setMarks(init);
        setExistingRecord(null);
      }
    });
  }, [className, section, date, students]);

  // Load recent attendance history for the selected class/section
  const loadHistory = useCallback(async () => {
    if (!className || !section) return;
    const recs = await listAttendance({ className });
    const filtered = recs.filter((r) => r.section === section).sort((a, b) => b.date?.localeCompare(a.date));
    setRecentRecords(filtered.slice(0, 30));
  }, [className, section]);

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab, loadHistory]);

  const setAll = (status) => {
    const m = {};
    students.forEach((s) => { m[s.id] = status; });
    setMarks(m);
  };

  const counts = useMemo(() => {
    const c = { PRESENT: 0, ABSENT: 0 };
    Object.values(marks).forEach((s) => { c[s] = (c[s] || 0) + 1; });
    return c;
  }, [marks]);

  const save = async () => {
    const entries = Object.entries(marks);
    if (!entries.length) return toast.error('Mark at least one student');
    if (saving) return; setSaving(true);
    try {
      await saveAttendance(className, section, date, marks, profile?.fullName || 'Admin');
      setExistingRecord({ loaded: true });
      toast.success(`Attendance saved for ${entries.length} students`);

      // Dispatch real-time activity log
      const total = entries.length;
      const present = Object.values(marks).filter((v) => v === 'PRESENT').length;
      await logActivity({
        type: 'attendance',
        text: `Attendance marked · Class ${className}-${section}, ${present}/${total} present`,
      });

      // After save, show absent students for WhatsApp notification
      const absentList = students.filter((s) => marks[s.id] === 'ABSENT');
      if (absentList.length > 0) {
        setAbsentModal({ students: absentList, date });
      }
    } catch (err) {
      console.error('Save attendance error:', err);
      toast.error(err?.message || 'Failed to save. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && classes.length === 0) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="student-attendance">
      <NavLink to="/dashboard/attendance" className="label-eyebrow text-primary">← Back to Attendance</NavLink>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Student Attendance</h1>
        <div className="flex bg-muted rounded-full p-1 w-fit">
          <button onClick={() => setTab('mark')} className={`px-4 py-1.5 rounded-full label-eyebrow transition-colors ${tab === 'mark' ? 'bg-background shadow' : 'text-muted-foreground'}`}>Mark Attendance</button>
          <button onClick={() => setTab('history')} className={`px-4 py-1.5 rounded-full label-eyebrow transition-colors ${tab === 'history' ? 'bg-background shadow' : 'text-muted-foreground'}`}>History</button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-morphism rounded-[2rem] p-5 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="label-eyebrow text-muted-foreground"><CalendarDays className="inline h-3 w-3 mr-1" />Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="att-date" />
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Class</label>
          <select value={className} onChange={(e) => setClassName(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="att-class">
            {classes.length === 0 && <option value="">No classes in DB</option>}
            {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Section</label>
          <select value={section} onChange={(e) => setSection(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="att-section">
            {sections.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button onClick={() => setAll('PRESENT')} className="flex-1 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 label-eyebrow" data-testid="att-mark-all">Mark All Present</button>
        </div>
      </div>

      {tab === 'mark' && (
        <>
          {existingRecord && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 label-eyebrow w-fit">
              <CheckCircle2 className="h-4 w-4" />
              Attendance already recorded for this date — you can edit and re-save.
            </div>
          )}

          {/* Counts */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-emerald-500">Present</div><div className="font-display font-black text-2xl tracking-tighter">{counts.PRESENT || 0}</div></div>
            <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-rose-500">Absent</div><div className="font-display font-black text-2xl tracking-tighter">{counts.ABSENT || 0}</div></div>
          </div>

          {/* Roster */}
          <div className="glass-morphism rounded-[2rem] p-5">
            {holiday ? (
              <div className="text-center py-10 border border-indigo-500/20 rounded-2xl bg-indigo-500/5">
                <div className="mx-auto w-12 h-12 rounded-full bg-indigo-500/10 grid place-items-center mb-4">
                  <span className="text-2xl">🎉</span>
                </div>
                <h3 className="font-display font-black text-2xl tracking-tighter text-indigo-500 mb-2">Today is a Holiday</h3>
                <p className="text-muted-foreground">{holiday.name}</p>
                <p className="text-xs text-muted-foreground mt-2 opacity-70">Attendance marking is disabled for holidays.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="label-eyebrow text-muted-foreground">
                    Roster · {loading ? '…' : `${students.length} students`}
                  </div>
                  <button onClick={save} disabled={saving || students.length === 0} className="h-10 px-5 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2 disabled:opacity-60" data-testid="att-save">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {existingRecord ? 'Update Attendance' : 'Save Attendance'}
                  </button>
                </div>

                {loading ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : students.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No students found in {className} – {section}.<br />
                    <span className="text-xs">Make sure students are enrolled with the matching class and section.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {students.map((s) => {
                      const status = marks[s.id];
                      return (
                        <motion.div key={s.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 p-3 rounded-2xl border border-border">
                          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white font-black text-sm flex-shrink-0">
                            {(s.firstName || s.fullName || 'S')[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm">{s.fullName}</div>
                            <div className="label-eyebrow text-muted-foreground">{s.admissionNo}{s.rollNo ? ` · Roll ${s.rollNo}` : ''}</div>
                          </div>
                          <div className="flex gap-1.5">
                            {STATUS.map((st) => (
                              <button key={st} onClick={() => setMarks((mm) => ({ ...mm, [s.id]: st }))} data-testid={`att-${s.id}-${st}`}
                                className={`h-9 w-9 rounded-xl text-xs font-black transition-colors ${status === st ? colorOf[st] : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                                {labelOf[st]}
                              </button>
                            ))}
                          </div>
                          {status === 'ABSENT' && s.phoneNumber && (
                            <a href={getWhatsAppUrl(s.phoneNumber, `Your child ${s.fullName} was marked absent on ${date}. Kindly inform if you have any concern.`)} target="_blank" rel="noreferrer"
                              className="h-9 px-3 rounded-xl bg-emerald-500/10 text-emerald-600 label-eyebrow flex items-center gap-1.5" data-testid={`att-wa-${s.id}`}>
                              <MessageCircle className="h-3 w-3" />Notify
                            </a>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="glass-morphism rounded-[2rem] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="label-eyebrow text-muted-foreground">Recent Attendance · {className} – {section}</div>
            <button onClick={loadHistory} className="h-9 w-9 rounded-xl bg-muted grid place-items-center hover:bg-muted/80">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          {recentRecords.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">No attendance records found for this class and section.</div>
          ) : (
            <div className="space-y-3">
              {recentRecords.map((rec) => {
                const total = Object.keys(rec.records || {}).length;
                const p = rec.present ?? Object.values(rec.records || {}).filter((v) => v === 'PRESENT').length;
                const a = rec.absent ?? Object.values(rec.records || {}).filter((v) => v === 'ABSENT').length;
                return (
                  <div key={rec.id} className="flex items-center justify-between p-4 rounded-2xl border border-border">
                    <div>
                      <div className="font-bold text-sm">{rec.date}</div>
                      <div className="label-eyebrow text-muted-foreground mt-0.5">Marked by: {rec.markedBy || 'Admin'}</div>
                    </div>
                    <div className="flex gap-3 text-sm">
                      <span className="text-emerald-500 font-bold">{p}P</span>
                      <span className="text-rose-500 font-bold">{a}A</span>
                      <span className="text-muted-foreground">/{total}</span>
                    </div>
                    <button onClick={() => { setDate(rec.date); setMarks(rec.records || {}); setExistingRecord({ loaded: true }); setTab('mark'); }}
                      className="h-8 px-3 rounded-xl bg-primary/10 text-primary label-eyebrow">Edit</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* WhatsApp Absent Notification Modal */}
      <AnimatePresence>
        {absentModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4"
            onClick={(e) => e.target === e.currentTarget && setAbsentModal(null)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="glass-morphism rounded-[2rem] p-6 w-full max-w-md space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display font-black text-xl tracking-tighter">Notify Absent Parents</div>
                  <div className="label-eyebrow text-muted-foreground mt-0.5">{absentModal.students.length} absent on {absentModal.date}</div>
                </div>
                <button onClick={() => setAbsentModal(null)} className="h-8 w-8 rounded-xl bg-muted grid place-items-center hover:bg-muted/80">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {absentModal.students.map((s) => {
                  const msg = `Dear Parent, your child *${s.fullName}* (Class ${className}-${section}) was marked *ABSENT* on ${absentModal.date}. Please contact the school if you have any concern. — St. Paul's High School`;
                  const hasPhone = !!s.phoneNumber;
                  return (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-2xl border border-border gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{s.fullName}</div>
                        <div className="label-eyebrow text-muted-foreground">{s.phoneNumber || 'No phone number'}</div>
                      </div>
                      {hasPhone ? (
                        <a href={getWhatsAppUrl(s.phoneNumber, msg)} target="_blank" rel="noreferrer"
                          className="h-9 px-3 rounded-xl bg-emerald-500 text-white label-eyebrow flex items-center gap-1.5 flex-shrink-0 hover:bg-emerald-600">
                          <Send className="h-3 w-3" />WhatsApp
                        </a>
                      ) : (
                        <span className="label-eyebrow text-muted-foreground text-xs px-2">No phone</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setAbsentModal(null)}
                className="w-full h-10 rounded-2xl bg-muted label-eyebrow">Done</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

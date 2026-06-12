import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Calendar, MapPin, Clock, Loader2, RefreshCw } from 'lucide-react';
import { listExamSetups } from '../services/firebase/academicService';
import { CLASS_OPTIONS } from '../lib/pdfUtils';
import { useAuth } from '../contexts/AuthContext';
import { ParentChildContext } from './ParentDashboard';
import { toast } from 'sonner';

export default function ExamTimetablePage() {
  const { profile } = useAuth();
  const parentCtx = React.useContext(ParentChildContext);
  const activeChildClass = parentCtx?.activeChild?.className;
  
  const isParent = profile?.role === 'PARENT';

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCls, setFilterCls] = useState('');

  // Set filterCls when activeChildClass changes for parents
  useEffect(() => {
    if (isParent && activeChildClass) {
      setFilterCls(activeChildClass);
    }
  }, [isParent, activeChildClass]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const setups = await listExamSetups();
      const rows = [];
      setups.forEach(setup => {
        const examName = setup.examType === 'Other' ? setup.customName : setup.examType;
        if (setup.schedule) {
          Object.entries(setup.schedule).forEach(([className, subjects]) => {
            subjects.forEach(sub => {
              rows.push({
                id: `${setup.id}-${className}-${sub.id}`,
                examName,
                className,
                subjectName: sub.subjectName,
                date: sub.date,
                startTime: sub.startTime,
                endTime: sub.endTime,
                durationMin: sub.durationMin,
                totalMarks: sub.totalMarks,
                isGradeOnly: sub.isGradeOnly
              });
            });
          });
        }
      });
      // Sort by date, then by time
      setList(rows.sort((a, b) => {
        const d = String(a.date || '').localeCompare(String(b.date || ''));
        return d !== 0 ? d : String(a.startTime || '').localeCompare(String(b.startTime || ''));
      }));
    } catch (e) { 
      console.error(e); 
      toast.error('Failed to load exam schedule');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = list.filter((e) => (!filterCls || e.className === filterCls));

  return (
    <div className="space-y-6" data-testid="exam-timetable-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-2">Exam Timetable</h1>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        {!isParent && (
          <select value={filterCls} onChange={(e) => setFilterCls(e.target.value)} className="h-10 px-3 rounded-2xl border border-border bg-card text-sm">
            <option value="">All Classes</option>{CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
        <button onClick={load} className="h-9 w-9 rounded-xl bg-muted grid place-items-center ml-auto">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
      <div className="glass-morphism rounded-[2rem] p-3 overflow-x-auto">
        <table className="w-full">
          <thead><tr>{['Date', 'Time', 'Exam', 'Class', 'Subject', 'Mode / Max Marks'].map((h) => <th key={h} className="label-eyebrow text-muted-foreground text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {visible.map((e, i) => (
              <motion.tr key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-2.5 font-bold text-sm whitespace-nowrap">{e.date || 'TBD'}</td>
                <td className="px-3 py-2.5 text-sm whitespace-nowrap">{e.startTime || 'TBD'} - {e.endTime || 'TBD'}</td>
                <td className="px-3 py-2.5 font-bold text-sm">{e.examName}</td>
                <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary label-eyebrow">{e.className}</span></td>
                <td className="px-3 py-2.5 text-sm">{e.subjectName}</td>
                <td className="px-3 py-2.5 font-display font-black tracking-tighter text-sm">
                  {e.isGradeOnly ? <span className="text-muted-foreground text-xs font-normal">Grade Only</span> : e.totalMarks}
                </td>
              </motion.tr>
            ))}
            {visible.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No exams scheduled for the selected filter.</td></tr>}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

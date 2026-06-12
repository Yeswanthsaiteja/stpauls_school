import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Calendar, Clock, Loader2, Send, Save } from 'lucide-react';
import { listExamSetups, updateExamSetup } from '../../services/firebase/academicService';
import { listStudents } from '../../services/firebase/studentsService';
import { addNotification } from '../../services/firebase/notificationsService';
import { toast } from 'sonner';

export default function ResultSchedulingPage() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const loadExams = async () => {
    try {
      const data = await listExamSetups();
      setExams(data);
    } catch (e) {
      toast.error('Failed to load exams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, []);

  const handleUpdateReleaseDate = async (examId, newDate) => {
    setSavingId(examId);
    try {
      await updateExamSetup(examId, { releaseDate: newDate });
      setExams(prev => prev.map(e => e.id === examId ? { ...e, releaseDate: newDate } : e));
      toast.success('Result release schedule updated');
    } catch (e) {
      toast.error('Failed to update schedule');
    } finally {
      setSavingId(null);
    }
  };

  const handleReleaseNow = async (exam) => {
    if (!window.confirm('Are you sure you want to release these results immediately? Parents will be notified.')) return;
    
    setSavingId(exam.id);
    try {
      const now = new Date().toISOString();
      await updateExamSetup(exam.id, { releaseDate: now });
      
      // Send notifications to all parents of students in these classes
      const allStudents = await listStudents({ status: 'ACTIVE' });
      const targetStudents = allStudents.filter(s => exam.classes.includes(s.className));
      
      const examName = exam.examType === 'Other' ? exam.customName : exam.examType;
      
      await Promise.all(targetStudents.map(s => addNotification({
        userId: s.id,
        type: 'result',
        title: `Results Released`,
        body: `Result got released for ${examName}`
      })));
      
      setExams(prev => prev.map(e => e.id === exam.id ? { ...e, releaseDate: now } : e));
      toast.success('Results released and notifications sent!');
    } catch (e) {
      toast.error('Failed to release results');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="result-scheduling">
      <div>
        <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
        <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-2">Result Scheduling</h1>
        <p className="text-sm text-muted-foreground mt-1">Schedule when parents can view their child's marks.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exams.map(e => {
            const name = e.examType === 'Other' ? e.customName : e.examType;
            return (
              <motion.div key={e.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-morphism rounded-[2rem] p-5 flex flex-col">
                <div className="font-display font-black text-xl tracking-tighter text-primary">{name}</div>
                <div className="text-xs text-muted-foreground mt-1 mb-4 flex flex-wrap gap-1">
                  {(e.classes || []).map(c => <span key={c} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase">{c}</span>)}
                </div>
                
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="label-eyebrow text-muted-foreground flex items-center gap-1.5 mb-1.5">
                      <Calendar className="h-3.5 w-3.5" /> Scheduled Release Date
                    </label>
                    <input 
                      type="datetime-local" 
                      value={e.releaseDate ? e.releaseDate.slice(0,16) : ''} 
                      onChange={(ev) => handleUpdateReleaseDate(e.id, new Date(ev.target.value).toISOString())}
                      className="w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>
                
                <div className="mt-5 pt-4 border-t border-border flex justify-between items-center">
                  <div className="text-xs text-muted-foreground">
                    {e.releaseDate && new Date(e.releaseDate) <= new Date() ? (
                      <span className="text-emerald-500 font-bold flex items-center gap-1"><Clock className="h-3 w-3" /> Released</span>
                    ) : e.releaseDate ? (
                      <span className="text-amber-500 font-bold flex items-center gap-1"><Clock className="h-3 w-3" /> Scheduled</span>
                    ) : (
                      <span>Not Scheduled</span>
                    )}
                  </div>
                  <button 
                    onClick={() => handleReleaseNow(e)}
                    disabled={savingId === e.id}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingId === e.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Release Now
                  </button>
                </div>
              </motion.div>
            );
          })}
          {exams.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-[2rem]">
              No exams found. Go to Exam Scheduling to create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

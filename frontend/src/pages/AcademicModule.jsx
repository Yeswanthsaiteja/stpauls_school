import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { BookOpen, BookMarked, Calendar, FileText, Lightbulb, ArrowUpCircle, Plus, Trash2, RefreshCw, Loader2, Clock } from 'lucide-react';
import { listSubjects, addSubject, deleteSubject, listClasses, addClass } from '../services/firebase/academicService';
import { listStudents } from '../services/firebase/studentsService';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const Card = ({ icon: Icon, label, sub, color, onClick, testId }) => (
  <motion.button onClick={onClick} whileHover={{ y: -5, scale: 1.02 }} data-testid={testId} className="glass-morphism rounded-[2rem] p-5 text-left">
    <div className={`h-11 w-11 rounded-2xl ${color} grid place-items-center text-white`}><Icon className="h-5 w-5" /></div>
    <div className="mt-4 font-bold">{label}</div>
    <div className="label-eyebrow text-muted-foreground mt-1">{sub}</div>
  </motion.button>
);

// ─── Landing ──────────────────────────────────────────────────────────────────
function Landing() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listStudents({ status: 'ACTIVE' }), listClasses()]).then(([sts, cls]) => {
      setStudents(sts);
      setClasses(cls);
      setLoading(false);
    });
  }, []);

  const { profile } = useAuth();
  const p = profile?.permissions || [];
  const isAdmin = profile?.role === 'SCHOOL_ADMIN' || profile?.role === 'ADMIN';
  const canAccess = (key) => isAdmin || p.includes('academic') || p.includes(key);

  const allCards = [
    { icon: BookOpen,      label: t('classesSections'), sub: t('manageGrades'),     color: 'bg-gradient-to-br from-indigo-500 to-violet-500',  to: '/dashboard/academic/classes', reqKey: 'academic.classes' },
    { icon: BookMarked,    label: t('subjectTopics'),    sub: t('crudProgress'),  color: 'bg-gradient-to-br from-emerald-500 to-teal-500',   to: '/dashboard/academic/subjects', reqKey: 'academic.subject-topics' },
    { icon: Calendar,      label: t('timetable'),         sub: t('weeklySlots'),     color: 'bg-gradient-to-br from-amber-500 to-orange-500',   to: '/dashboard/timetable', reqKey: 'academic.timetable' },
    { icon: FileText,      label: t('marksEntry', 'Marks Entry'),     sub: t('markSheets'),      color: 'bg-gradient-to-br from-rose-500 to-pink-500',      to: '/dashboard/results-entry', reqKey: 'academic.marks-entry' },
    { icon: FileText,      label: 'Results Sheet', sub: 'Comprehensive Marks', color: 'bg-gradient-to-br from-indigo-500 to-blue-500', to: '/dashboard/academic/results-sheet', reqKey: 'academic.results-sheet' },
    { icon: FileText,      label: t('examScheduling'),   sub: t('globalExamsSetup'),color: 'bg-gradient-to-br from-indigo-500 to-blue-500',     to: '/dashboard/academic/exams', reqKey: 'academic.exam-setup' },
    { icon: Clock,         label: 'Result Scheduling', sub: 'Publish results', color: 'bg-gradient-to-br from-pink-500 to-rose-500', to: '/dashboard/academic/result-scheduling', reqKey: 'academic.result-scheduling' },
    { icon: Lightbulb,     label: t('lessonPlanning'),   sub: t('approvalWorkflow'),color: 'bg-gradient-to-br from-cyan-500 to-blue-500',      to: '/dashboard/academic/lesson-planning', reqKey: 'academic.lesson-planning' },
    { icon: ArrowUpCircle, label: t('yearEndPromotion'),sub: t('bulkPromote'),     color: 'bg-gradient-to-br from-fuchsia-500 to-purple-500', to: '/dashboard/academic/promotion', reqKey: 'academic.year-end-promotion' },
  ];
  
  const cards = allCards.filter(c => canAccess(c.reqKey));

  // Group students by class
  const classCounts = {};
  students.forEach((s) => { if (s.className) classCounts[s.className] = (classCounts[s.className] || 0) + 1; });
  const gradeEntries = Object.entries(classCounts).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-6" data-testid="academic-module">
      <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tighter uppercase">{t('academic')}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => <Card key={c.label} {...c} onClick={() => nav(c.to)} testId={`acad-card-${c.label}`} />)}
      </div>
      <div className="glass-morphism rounded-[2rem] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="label-eyebrow text-muted-foreground">{t('classOverview')}</div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>
        {gradeEntries.length === 0 && !loading ? (
          <div className="text-center text-muted-foreground py-6 text-sm">
            {t('noStudentsYet')}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {gradeEntries.map(([grade, count], i) => (
              <div key={grade} className="rounded-2xl border border-border p-3 text-center">
                <div className="label-eyebrow text-muted-foreground">{t('class')}</div>
                <div className="font-display font-black text-2xl tracking-tighter">{grade}</div>
                <div className="text-xs mt-2 font-medium">{count} student{count !== 1 ? 's' : ''}</div>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: `${Math.min(100, count * 3)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Premium Academic Components ──────────────────────────────────────────────
import ClassesSections from './academic/ClassesSections';
import SubjectsTopicsCRUD from './academic/SubjectsTopicsCRUD';
import ExamSetupPage from './academic/ExamSetupPage';
import LessonPlanning from './academic/LessonPlanning';
import YearEndPromotion from './academic/YearEndPromotion';
import ResultsSheetPage from './academic/ResultsSheetPage';
import ResultSchedulingPage from './academic/ResultSchedulingPage';

export default function AcademicModule() {
  return (
    <Routes>
      <Route index element={<Landing />} />
      <Route path="classes" element={<ClassesSections />} />
      <Route path="subjects" element={<SubjectsTopicsCRUD />} />
      <Route path="exams" element={<ExamSetupPage />} />
      <Route path="lesson-planning" element={<LessonPlanning />} />
      <Route path="promotion" element={<YearEndPromotion />} />
      <Route path="results-sheet" element={<ResultsSheetPage />} />
      <Route path="result-scheduling" element={<ResultSchedulingPage />} />
    </Routes>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { FileText, Loader2, Download, Search } from 'lucide-react';
import { listClasses, listSubjects, listExamSetups, listResults } from '../../services/firebase/academicService';
import { listStudents } from '../../services/firebase/studentsService';

export default function ResultsSheetPage() {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);

  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [examId, setExamId] = useState('');

  // Initial data load
  useEffect(() => {
    Promise.all([
      listClasses(), listSubjects(), listStudents({ status: 'ACTIVE' }), listExamSetups()
    ]).then(([cls, subs, stus, exs]) => {
      setClasses(cls);
      setSubjects(subs);
      setStudents(stus);
      setExams(exs);
      
      if (cls.length > 0) {
        setClassName(cls[0].name);
        if (cls[0].sections?.length > 0) setSection(cls[0].sections[0]);
      }
      setLoading(false);
    });
  }, []);

  const activeClassObj = classes.find(c => c.name === className);
  const sectionOpts = activeClassObj?.sections || [];
  const applicableExams = exams.filter(e => e.classes?.includes(className));
  const activeExam = exams.find(e => e.id === examId) || applicableExams[0];
  const activeExamName = activeExam ? (activeExam.examType === 'Other' ? activeExam.customName : activeExam.examType) : '';
  
  // Set default exam when class changes
  useEffect(() => {
    if (applicableExams.length > 0 && (!examId || !applicableExams.find(e => e.id === examId))) {
      setExamId(applicableExams[0].id);
    }
  }, [applicableExams, examId]);

  // Load results when Class or Exam changes
  useEffect(() => {
    if (!className || !activeExamName) {
      setResults([]);
      return;
    }
    const loadData = async () => {
      setLoadingResults(true);
      try {
        const res = await listResults({ className, examType: activeExamName });
        setResults(res);
      } catch (err) {
        console.error("Error loading results", err);
      } finally {
        setLoadingResults(false);
      }
    };
    loadData();
  }, [className, activeExamName]);

  // Data processing
  const filteredStudents = useMemo(() => {
    return students
      .filter(s => s.className === className && (!section || s.section === section))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [students, className, section]);

  const classSubjects = useMemo(() => {
    return subjects.filter(s => s.className === className);
  }, [subjects, className]);

  // Build a tabular map
  // tableData[studentId] = { student, marks: { subjectId: { mark, grade } }, total, maxTotal, percentage }
  const tableData = useMemo(() => {
    const data = {};
    filteredStudents.forEach(s => {
      data[s.id] = { student: s, marks: {}, total: 0, maxTotal: 0, percentage: 0 };
    });

    results.forEach(r => {
      if (data[r.studentId]) {
        // Only include if student is in filtered list
        data[r.studentId].marks[r.subjectId] = { mark: r.marks, grade: r.grade, isGradeOnly: r.marks === null };
      }
    });

    // Calculate totals
    Object.values(data).forEach(row => {
      let t = 0;
      let maxT = 0;
      classSubjects.forEach(sub => {
        const examConfig = activeExam?.schedule?.[className]?.find(s => s.subjectName === sub.name);
        const subMax = examConfig?.totalMarks || 100;
        const isGradeOnly = examConfig?.isGradeOnly;

        const m = row.marks[sub.id];
        if (m && m.mark !== null && m.mark !== undefined && !isGradeOnly) {
          t += Number(m.mark);
          maxT += subMax;
        } else if (!isGradeOnly) {
          // Even if they didn't get marks, if it's supposed to be marked, add to max
          maxT += subMax;
        }
      });
      row.total = t;
      row.maxTotal = maxT;
      row.percentage = maxT > 0 ? ((t / maxT) * 100).toFixed(1) : 0;
    });

    return Object.values(data).sort((a, b) => a.student.fullName.localeCompare(b.student.fullName));
  }, [filteredStudents, results, classSubjects, activeExam, className]);

  // Averages per subject
  const subjectAverages = useMemo(() => {
    const avgs = {};
    classSubjects.forEach(sub => {
      let sum = 0;
      let count = 0;
      tableData.forEach(row => {
        const m = row.marks[sub.id];
        if (m && m.mark !== null && m.mark !== undefined) {
          sum += Number(m.mark);
          count++;
        }
      });
      avgs[sub.id] = count > 0 ? (sum / count).toFixed(1) : '-';
    });
    return avgs;
  }, [classSubjects, tableData]);

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <NavLink to="/dashboard/academic" className="label-eyebrow text-primary">← Back to Academic</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Results Sheet</h1>

      <div className="glass-morphism rounded-[2rem] p-5 grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="label-eyebrow text-muted-foreground">Class</label>
          <select value={className} onChange={(e) => {
            setClassName(e.target.value);
            const newCls = classes.find(c => c.name === e.target.value);
            if (newCls?.sections?.length > 0) setSection(newCls.sections[0]);
            else setSection('');
          }} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm">
            {classes.map(c => <option key={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Section</label>
          <select value={section} onChange={(e) => setSection(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm">
            <option value="">All</option>
            {sectionOpts.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Exam</label>
          <select value={examId} onChange={(e) => setExamId(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm">
            {applicableExams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.examType === 'Other' ? e.customName : e.examType}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="glass-morphism rounded-[2rem] p-5 overflow-x-auto thin-scrollbar relative">
        {loadingResults && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-[2rem]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        <div className="flex items-center justify-between mb-4">
          <div className="label-eyebrow text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Comprehensive Marks
          </div>
          <button onClick={() => window.print()} className="h-10 px-5 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2">
            <Download className="h-3.5 w-3.5" /> Print / Export
          </button>
        </div>

        {classSubjects.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">No subjects found for this class.</div>
        ) : (
          <table className="w-full text-sm border-collapse min-w-[800px]">
            <thead>
              <tr>
                <th className="border-b border-border p-2 text-left font-bold text-muted-foreground" rowSpan={2}>Student</th>
                {classSubjects.map(sub => (
                  <th key={sub.id} className="border-b border-border p-2 text-center font-bold" colSpan={2}>{sub.name}</th>
                ))}
                <th className="border-b border-border p-2 text-center font-bold text-muted-foreground" rowSpan={2}>Total</th>
                <th className="border-b border-border p-2 text-center font-bold text-muted-foreground" rowSpan={2}>%</th>
              </tr>
              <tr>
                {classSubjects.map(sub => (
                  <React.Fragment key={`${sub.id}-cols`}>
                    <th className="border-b border-border p-1.5 text-center text-xs text-muted-foreground">Mark</th>
                    <th className="border-b border-border p-1.5 text-center text-xs text-muted-foreground">Grade</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.length === 0 ? (
                <tr>
                  <td colSpan={classSubjects.length * 2 + 3} className="text-center p-8 text-muted-foreground">
                    <Search className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    No students found in this class/section.
                  </td>
                </tr>
              ) : tableData.map((row) => (
                <tr key={row.student.id} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="p-2 whitespace-nowrap">
                    <div className="font-semibold">{row.student.fullName}</div>
                    <div className="text-xs text-muted-foreground">{row.student.admissionNumber || '-'}</div>
                  </td>
                  {classSubjects.map(sub => {
                    const m = row.marks[sub.id];
                    return (
                      <React.Fragment key={`${row.student.id}-${sub.id}`}>
                        <td className="p-2 text-center font-medium">{m?.isGradeOnly ? '-' : (m?.mark ?? '-')}</td>
                        <td className="p-2 text-center font-bold text-primary">{m?.grade ?? '-'}</td>
                      </React.Fragment>
                    );
                  })}
                  <td className="p-2 text-center font-black">
                    {row.total} <span className="text-xs text-muted-foreground font-normal">/ {row.maxTotal}</span>
                  </td>
                  <td className="p-2 text-center font-black text-emerald-500">
                    {row.percentage}%
                  </td>
                </tr>
              ))}
              {tableData.length > 0 && (
                <tr className="bg-muted/30 font-bold">
                  <td className="p-2 text-right">Class Average:</td>
                  {classSubjects.map(sub => (
                    <React.Fragment key={`avg-${sub.id}`}>
                      <td className="p-2 text-center text-indigo-500">{subjectAverages[sub.id]}</td>
                      <td className="p-2 text-center">-</td>
                    </React.Fragment>
                  ))}
                  <td className="p-2 text-center">-</td>
                  <td className="p-2 text-center">-</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

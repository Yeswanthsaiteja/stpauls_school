import React, { useState, useEffect, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { FileText, Loader2, Download, Search } from 'lucide-react';
import { listClasses, listSubjects, listExamSetups, listResults } from '../../services/firebase/academicService';
import { listStudents } from '../../services/firebase/studentsService';
import { calcGrade } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  const scheduledSubjects = useMemo(() => {
    const scheduledNames = activeExam?.schedule?.[className]?.map(s => s.subjectName) || [];
    return subjects.filter(s => s.className === className && scheduledNames.includes(s.name));
  }, [subjects, className, activeExam]);

  const dynamicCalcGrade = (num, config) => {
    if (!config || config.isGradeOnly) return '—';
    const scale = config.gradingScale || [];
    const rawMin = config.minMarks;
    const min = (rawMin === undefined || rawMin === null || rawMin === '') ? 35 : Number(rawMin);
    
    if (num < min) return 'F';
    
    if (scale.length > 0) {
      for (const r of scale) {
        if (num >= Number(r.min) && num <= Number(r.max)) return r.grade;
      }
      return '—';
    }
    
    return num >= min ? 'P' : 'F';
  };

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
      let hasFailed = false;
      let allBlank = true;

      scheduledSubjects.forEach(sub => {
        const examConfig = activeExam?.schedule?.[className]?.find(s => s.subjectName === sub.name);
        const subMax = examConfig?.totalMarks || 100;
        const rawMin = examConfig?.minMarks;
        const subMin = (rawMin === undefined || rawMin === null || rawMin === '') ? 35 : Number(rawMin);
        const isGradeOnly = examConfig?.isGradeOnly;

        const m = row.marks[sub.id];
        
        // Dynamically recalculate grade if it has a mark
        if (m && m.mark !== undefined && m.mark !== null && !isGradeOnly && m.mark !== 'AB') {
            m.grade = dynamicCalcGrade(Number(m.mark), examConfig);
        }

        if (m && (m.mark !== undefined || m.grade !== undefined) && (m.mark !== '' || m.grade !== '')) {
          allBlank = false;
          if (!isGradeOnly) {
            if (m.mark === 'AB') {
              hasFailed = true;
            } else {
              const numMark = Number(m.mark);
              t += numMark;
              maxT += subMax;
              if (numMark < subMin) hasFailed = true;
            }
          } else {
            if (m.grade === 'F' || m.grade === 'E') hasFailed = true;
          }
        } else {
           // No mark entered yet for this subject
           if (!isGradeOnly) maxT += subMax;
           hasFailed = true;
        }
      });
      row.total = t;
      row.maxTotal = maxT;
      row.percentage = maxT > 0 ? ((t / maxT) * 100).toFixed(1) : 0;
      row.resultStatus = allBlank ? '-' : (hasFailed ? 'FAIL' : 'PASS');
      row.overallGrade = allBlank ? '-' : (hasFailed ? 'F' : calcGrade(row.total, row.maxTotal));
    });

    return Object.values(data).sort((a, b) => a.student.fullName.localeCompare(b.student.fullName));
  }, [filteredStudents, results, scheduledSubjects, activeExam, className]);

  // Averages per subject
  const subjectAverages = useMemo(() => {
    const avgs = {};
    scheduledSubjects.forEach(sub => {
      let sum = 0;
      let count = 0;
      tableData.forEach(row => {
        const m = row.marks[sub.id];
        if (m && m.mark !== null && m.mark !== undefined && m.mark !== 'AB') {
          sum += Number(m.mark);
          count++;
        }
      });
      avgs[sub.id] = count > 0 ? (sum / count).toFixed(1) : '-';
    });
    return avgs;
  }, [scheduledSubjects, tableData]);

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(16);
    doc.text(`Results Sheet: ${className} ${section ? '- ' + section : ''} - ${activeExamName}`, 14, 15);
    
    const head = [
      [
        { content: 'Student', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
        ...scheduledSubjects.map(s => ({ content: s.name, colSpan: 2, styles: { halign: 'center' } })),
        { content: 'Total', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: '%', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Grade', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Result', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      ],
      [
        ...scheduledSubjects.flatMap(() => [
          { content: 'Mark', styles: { halign: 'center' } },
          { content: 'Grade', styles: { halign: 'center' } }
        ])
      ]
    ];
    
    const body = tableData.map(row => {
      const rowData = [
        `${row.student.fullName}\n${row.student.admissionNumber || '-'}`
      ];
      
      scheduledSubjects.forEach(sub => {
        const m = row.marks[sub.id];
        const markText = m?.mark === 'AB' ? 'AB' : (m?.isGradeOnly ? '-' : (m?.mark ?? '-'));
        const gradeText = m?.grade === 'AB' ? 'AB' : (m?.grade ?? '-');
        rowData.push(markText);
        rowData.push(gradeText);
      });
      
      rowData.push(`${row.total} / ${row.maxTotal}`);
      rowData.push(`${row.percentage}%`);
      rowData.push(row.overallGrade);
      rowData.push(row.resultStatus);
      
      return rowData;
    });

    if (tableData.length > 0) {
      const avgRow = ['Class Average:'];
      scheduledSubjects.forEach(sub => {
        avgRow.push(subjectAverages[sub.id]);
        avgRow.push('-');
      });
      avgRow.push('-');
      avgRow.push('-');
      avgRow.push('-');
      avgRow.push('-');
      body.push(avgRow);
    }

    autoTable(doc, {
      startY: 25,
      head: head,
      body: body,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, halign: 'center' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(`Results_${className}_${activeExamName}.pdf`);
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          @page { size: landscape; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { width: 100% !important; min-width: 100% !important; }
          th, td { font-size: 11px !important; padding: 4px 2px !important; border: 1px solid #ccc !important; }
        }
      `}</style>
      <NavLink to="/dashboard/academic" className="label-eyebrow text-primary print:hidden">← Back to Academic</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase print:text-center print:mb-4">Results Sheet</h1>

      <div className="glass-morphism rounded-[2rem] p-5 grid grid-cols-2 md:grid-cols-3 gap-3 print:hidden">
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

      <div className="glass-morphism rounded-[2rem] p-5 overflow-x-auto thin-scrollbar relative print:overflow-visible print:p-0 print:shadow-none print:border-none print:bg-transparent">
        {loadingResults && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-[2rem]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        <div className="flex items-center justify-between mb-4 print:hidden">
          <div className="label-eyebrow text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Comprehensive Marks
          </div>
          <button onClick={handleExportPDF} className="h-10 px-5 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2">
            <Download className="h-3.5 w-3.5" /> Print / Export
          </button>
        </div>

        {scheduledSubjects.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">No subjects configured in Exam Setup for this class.</div>
        ) : (
          <table className="w-full text-sm border-collapse min-w-[800px]">
            <thead>
              <tr>
                <th className="border-b border-border p-2 text-left font-bold text-muted-foreground" rowSpan={2}>Student</th>
                {scheduledSubjects.map(sub => (
                  <th key={sub.id} className="border-b border-border p-2 text-center font-bold" colSpan={2}>{sub.name}</th>
                ))}
                <th className="border-b border-border p-2 text-center font-bold text-muted-foreground" rowSpan={2}>Total</th>
                <th className="border-b border-border p-2 text-center font-bold text-muted-foreground" rowSpan={2}>%</th>
                <th className="border-b border-border p-2 text-center font-bold text-muted-foreground" rowSpan={2}>Grade</th>
                <th className="border-b border-border p-2 text-center font-bold text-muted-foreground" rowSpan={2}>Result</th>
              </tr>
              <tr>
                {scheduledSubjects.map(sub => (
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
                  <td colSpan={scheduledSubjects.length * 2 + 5} className="text-center p-8 text-muted-foreground">
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
                  {scheduledSubjects.map(sub => {
                    const m = row.marks[sub.id];
                    return (
                      <React.Fragment key={sub.id}>
                        <td className="p-2 text-center text-muted-foreground">
                          {m?.mark === 'AB' ? <span className="text-rose-500 font-bold text-[10px] uppercase">Absent</span> : (m?.isGradeOnly ? '-' : (m?.mark ?? '-'))}
                        </td>
                        <td className="p-2 text-center font-bold text-primary">
                          {m?.grade === 'AB' ? <span className="text-rose-500 font-bold text-[10px] uppercase">Absent</span> : (m?.grade ?? '-')}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className="p-2 text-center font-black">
                    {row.total} <span className="text-xs text-muted-foreground font-normal">/ {row.maxTotal}</span>
                  </td>
                  <td className="p-2 text-center font-black text-emerald-500">
                    {row.percentage}%
                  </td>
                  <td className={`p-2 text-center font-black ${row.overallGrade === 'F' ? 'text-rose-500' : 'text-primary'}`}>
                    {row.overallGrade}
                  </td>
                  <td className={`p-2 text-center font-black ${row.resultStatus === 'PASS' ? 'text-emerald-500' : (row.resultStatus === '-' ? 'text-muted-foreground' : 'text-rose-500')}`}>
                    {row.resultStatus}
                  </td>
                </tr>
              ))}
              {tableData.length > 0 && (
                <tr className="bg-muted/30 font-bold">
                  <td className="p-2 text-right">Class Average:</td>
                  {scheduledSubjects.map(sub => (
                    <React.Fragment key={`avg-${sub.id}`}>
                      <td className="p-2 text-center text-indigo-500">{subjectAverages[sub.id]}</td>
                      <td className="p-2 text-center">-</td>
                    </React.Fragment>
                  ))}
                  <td className="p-2 text-center">-</td>
                  <td className="p-2 text-center">-</td>
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

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Download, RefreshCw, Users, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { listAttendance } from '../services/firebase/attendanceService';
import { listStudents } from '../services/firebase/studentsService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePDF } from '../lib/mobileDownload';

export default function AttendanceStatus() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [students, setStudents] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [attData, stuData] = await Promise.all([
        listAttendance({ date }),
        listStudents({ status: 'ACTIVE' })
      ]);
      setRecords(attData);
      setStudents(stuData);
    } catch (e) {
      toast.error('Failed to load attendance status');
      console.error(e);
    }
    setLoading(false);
  }, [date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    let totalPresent = 0;
    let totalAbsent = 0;
    records.forEach(r => {
      totalPresent += r.present || 0;
      totalAbsent += r.absent || 0;
    });
    return {
      present: totalPresent,
      absent: totalAbsent,
      strength: totalPresent + totalAbsent,
    };
  }, [records]);

  const handleDownloadSchoolPDF = async () => {
    if (!records.length) {
      toast.error('No attendance records found for this date');
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`School Attendance Status - ${date}`, 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Total Strength: ${stats.strength}`, 14, 32);
    doc.text(`Total Present: ${stats.present}`, 14, 38);
    doc.text(`Total Absent: ${stats.absent}`, 14, 44);

    const tableData = [...records]
      .sort((a, b) => a.className.localeCompare(b.className) || a.section.localeCompare(b.section))
      .map(r => [
        `${r.className} - ${r.section}`,
        (r.present || 0) + (r.absent || 0),
        r.present || 0,
        r.absent || 0
      ]);

    autoTable(doc, {
      startY: 50,
      head: [['Class & Section', 'Total Strength', 'Present', 'Absent']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
    });

    await savePDF(doc, `School_Attendance_${date}.pdf`);
  };

  const handleDownloadClassPDF = async (record) => {
    const className = record.className || 'Unknown';
    const section = record.section || 'Unknown';
    const attRecords = record.records || {};
    
    const classStudents = students.filter(s => s.className === className && s.section === section);
    
    if (classStudents.length === 0) {
      toast.error(`No students found in ${className}-${section}`);
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Attendance Report - Class ${className}-${section}`, 14, 22);
    doc.setFontSize(12);
    doc.text(`Date: ${date}`, 14, 30);
    doc.text(`Total Strength: ${classStudents.length}`, 14, 38);
    doc.text(`Present: ${record.present || 0}`, 14, 44);
    doc.text(`Absent: ${record.absent || 0}`, 14, 50);

    const tableData = classStudents.map(stu => [
      stu.fullName || `${stu.firstName} ${stu.lastName}`,
      stu.admissionNo || 'N/A',
      attRecords[stu.id] || 'NOT MARKED'
    ]);

    autoTable(doc, {
      startY: 56,
      head: [['Student Name', 'Admission No', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 2) {
          if (data.cell.raw === 'PRESENT') {
            data.cell.styles.textColor = [16, 185, 129];
          } else if (data.cell.raw === 'ABSENT') {
            data.cell.styles.textColor = [244, 63, 94];
          }
        }
      }
    });

    await savePDF(doc, `Attendance_${className}_${section}_${date}.pdf`);
  };

  return (
    <div className="space-y-6" data-testid="attendance-status-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <NavLink to="/dashboard/attendance" className="label-eyebrow text-primary">← Back to Attendance</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-2">Attendance Status</h1>
        </div>
        <div className="flex gap-3 items-center flex-wrap bg-card border border-border p-2 rounded-2xl">
          <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-1">
            <span className="label-eyebrow text-muted-foreground whitespace-nowrap">Select Date:</span>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              className="h-9 bg-transparent border-none text-sm outline-none font-bold" 
            />
          </div>
          <button onClick={loadData} className="h-10 w-10 rounded-xl bg-muted hover:bg-muted/80 grid place-items-center transition-colors" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleDownloadSchoolPDF} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2 transition-colors shadow-lg shadow-primary/20">
            <Download className="h-3.5 w-3.5" />Download Summary PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <motion.div whileHover={{ y: -4 }} className="glass-morphism rounded-[2rem] p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-500 grid place-items-center"><Users className="h-5 w-5" /></div>
            <div className="label-eyebrow text-indigo-500">Total Strength</div>
          </div>
          <div className="font-display font-black text-4xl tracking-tighter">{stats.strength}</div>
        </motion.div>
        <motion.div whileHover={{ y: -4 }} className="glass-morphism rounded-[2rem] p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 grid place-items-center"><UserCheck className="h-5 w-5" /></div>
            <div className="label-eyebrow text-emerald-500">Total Present</div>
          </div>
          <div className="font-display font-black text-4xl tracking-tighter text-emerald-600">{stats.present}</div>
        </motion.div>
        <motion.div whileHover={{ y: -4 }} className="glass-morphism rounded-[2rem] p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-500 grid place-items-center"><UserX className="h-5 w-5" /></div>
            <div className="label-eyebrow text-rose-500">Total Absent</div>
          </div>
          <div className="font-display font-black text-4xl tracking-tighter text-rose-600">{stats.absent}</div>
        </motion.div>
      </div>

      <div className="glass-morphism rounded-[2rem] p-3 overflow-hidden">
        {loading ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground label-eyebrow">Loading...</div>
        ) : records.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <div className="h-12 w-12 rounded-full bg-muted grid place-items-center"><Users className="h-5 w-5 opacity-50" /></div>
            <div className="label-eyebrow">No attendance marked for this date</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Class & Section', 'Total Strength', 'Present', 'Absent', ''].map((h) => (
                    <th key={h} className="label-eyebrow text-muted-foreground text-left px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...records]
                  .sort((a, b) => a.className.localeCompare(b.className) || a.section.localeCompare(b.section))
                  .map((r, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-bold">{r.className} - {r.section}</td>
                      <td className="px-4 py-3 font-mono">{(r.present || 0) + (r.absent || 0)}</td>
                      <td className="px-4 py-3 font-mono text-emerald-600">{r.present || 0}</td>
                      <td className="px-4 py-3 font-mono text-rose-600">{r.absent || 0}</td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => handleDownloadClassPDF(r)}
                          className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors inline-flex items-center justify-center"
                          title="Download Class PDF"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

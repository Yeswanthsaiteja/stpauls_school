import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Download, RefreshCw, Users, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { listAttendance } from '../services/firebase/attendanceService';
import { listStudents } from '../services/firebase/studentsService';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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

  const handleDownloadZip = async () => {
    if (!records.length) {
      toast.error('No attendance records found for this date');
      return;
    }

    const toastId = toast.loading('Generating ZIP file...');
    try {
      const zip = new JSZip();
      
      records.forEach(record => {
        const className = record.className || 'Unknown';
        const section = record.section || 'Unknown';
        const attRecords = record.records || {};
        
        let csvContent = 'Student Name,Admission No,Status\n';
        
        // Find students in this class/section and get their attendance status
        const classStudents = students.filter(s => s.className === className && s.section === section);
        
        classStudents.forEach(stu => {
          const status = attRecords[stu.id] || 'NOT MARKED';
          // Wrap names in quotes to handle commas in names safely
          csvContent += `"${stu.firstName} ${stu.lastName}","${stu.admissionNo || ''}",${status}\n`;
        });
        
        const fileName = `${className}_${section}_Attendance_${date}.csv`;
        zip.file(fileName, csvContent);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `Attendance_Status_${date}.zip`);
      toast.success('ZIP downloaded successfully!', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate ZIP', { id: toastId });
    }
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
          <button onClick={handleDownloadZip} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2 transition-colors shadow-lg shadow-primary/20">
            <Download className="h-3.5 w-3.5" />Download ZIP
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
                  {['Class & Section', 'Total Strength', 'Present', 'Absent'].map((h) => (
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

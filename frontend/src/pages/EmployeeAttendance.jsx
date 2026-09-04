import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Search, RefreshCw, Users, CheckCircle2, XCircle,
  Clock, ChevronLeft, AlertTriangle, Fingerprint, Download, Filter, FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listEmployees } from '../services/firebase/employeesService';
import {
  getBiometricLogsForDate,
  getBiometricLogsForMonth,
  computeAttendance,
  computeMonthlyAttendance,
  formatPunchTime
} from '../services/firebase/biometricService';
import { toast } from 'sonner';
import { savePDF } from '../lib/mobileDownload';

const STATUS_CONFIG = {
  'PRESENT': { label: 'Present', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle2 },
  'ABSENT':  { label: 'Absent',  color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: XCircle },
  'LATE':    { label: 'Late',    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: AlertTriangle },
  'EARLY LEAVE': { label: 'Early Leave', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20', icon: Clock },
  'LATE & EARLY LEAVE': { label: 'Late & Early', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20', icon: AlertTriangle },
};

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toLocalMonthStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function minutesToHM(mins) {
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function EmployeeAttendance() {
  const navigate = useNavigate();
  const today = toLocalDateStr(new Date());
  const thisMonth = toLocalMonthStr(new Date());

  const [viewMode, setViewMode] = useState('DAILY'); // 'DAILY' or 'MONTHLY'
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(thisMonth);
  
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loadData = useCallback(async (vMode, selectedDate, selectedMonth, showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const emps = await listEmployees({ status: 'ACTIVE' });
      setEmployees(emps);
      
      if (vMode === 'DAILY') {
        const logs = await getBiometricLogsForDate(selectedDate);
        const result = computeAttendance(emps, logs);
        setAttendance(result);
      } else {
        const logs = await getBiometricLogsForMonth(selectedMonth);
        const result = computeMonthlyAttendance(emps, logs);
        setAttendance(result);
      }
    } catch (e) {
      toast.error('Failed to load attendance data');
    }
    
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData(viewMode, date, month);
  }, [viewMode, date, month, loadData]);

  const handleRefresh = () => { loadData(viewMode, date, month, true); toast.success('Refreshed!'); };

  const filtered = attendance.filter(emp => {
    const matchSearch = !search ||
      (emp.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
      (emp.department || '').toLowerCase().includes(search.toLowerCase()) ||
      (emp.role || '').toLowerCase().includes(search.toLowerCase());
    
    // Status filter only makes sense for daily view
    const matchStatus = viewMode === 'MONTHLY' || statusFilter === 'ALL' || emp.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const exportDailyPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();
      doc.text(`Daily Attendance Report - ${date}`, 14, 15);
      
      const tableData = filtered.map(e => [
        e.fullName || '',
        e.role || 'N/A',
        e.shiftStartTime ? `${e.shiftStartTime} - ${e.shiftEndTime || '?'}` : 'N/A',
        formatPunchTime(e.punchIn) || '-',
        formatPunchTime(e.punchOut) || '-',
        e.status || '-',
        e.minutesLate ? minutesToHM(e.minutesLate) : '-',
        e.minutesEarly ? minutesToHM(e.minutesEarly) : '-'
      ]);

      autoTable(doc, {
        startY: 25,
        head: [['Employee Name', 'Role', 'Shift Config', 'Time In', 'Time Out', 'Status', 'Late By', 'Early By']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [79, 70, 229] }
      });

      await savePDF(doc, `Attendance_Daily_${date}.pdf`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate PDF');
    }
  };

  const exportMonthlyPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF('landscape');
      doc.text(`Monthly Attendance Summary - ${month}`, 14, 15);
      
      const [y, m] = month.split('-');
      const daysInMonth = new Date(y, m, 0).getDate();
      const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
      
      const tableData = filtered.map(e => {
        const row = [e.fullName || '', e.role || 'N/A'];
        for (let i = 1; i <= daysInMonth; i++) {
          const dateStr = `${y}-${m}-${String(i).padStart(2, '0')}`;
          row.push(e.dailyPunches?.[dateStr] || '-');
        }
        return row;
      });

      autoTable(doc, {
        startY: 25,
        head: [['Employee Name', 'Role', ...dayHeaders]],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 6, cellPadding: 1 },
        headStyles: { fillColor: [79, 70, 229], halign: 'center' },
        bodyStyles: { halign: 'center' },
        columnStyles: {
          0: { cellWidth: 35, halign: 'left' },
          1: { cellWidth: 25, halign: 'left' },
        }
      });

      await savePDF(doc, `Attendance_Monthly_${month}.pdf`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate PDF');
    }
  };

  return (
    <div className="space-y-6" data-testid="employee-attendance">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="h-9 w-9 rounded-2xl bg-muted grid place-items-center hover:bg-muted/80 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tighter uppercase flex items-center gap-2">
              <Fingerprint className="h-6 w-6 text-primary" />
              Employee Attendance
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Live biometric punch data</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={viewMode === 'DAILY' ? exportDailyPDF : exportMonthlyPDF}
            className="h-9 px-3 rounded-2xl bg-muted text-muted-foreground label-eyebrow text-xs flex items-center gap-1.5 hover:bg-muted/80 transition-colors">
            <FileText className="h-3.5 w-3.5" /> Download PDF
          </button>
          <button onClick={handleRefresh} disabled={refreshing}
            className="h-9 px-3 rounded-2xl bg-primary text-primary-foreground label-eyebrow text-xs flex items-center gap-1.5 disabled:opacity-60">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* View Toggle & Filters */}
      <div className="glass-morphism rounded-[2rem] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex bg-muted rounded-xl p-1">
            <button onClick={() => setViewMode('DAILY')} className={`px-4 py-1.5 rounded-lg label-eyebrow text-xs transition-colors ${viewMode === 'DAILY' ? 'bg-background shadow text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Daily</button>
            <button onClick={() => setViewMode('MONTHLY')} className={`px-4 py-1.5 rounded-lg label-eyebrow text-xs transition-colors ${viewMode === 'MONTHLY' ? 'bg-background shadow text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Monthly</button>
          </div>

          <div className="h-6 w-px bg-border mx-2"></div>

          {viewMode === 'DAILY' ? (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)}
                className="h-9 px-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <input type="month" value={month} max={thisMonth} onChange={e => setMonth(e.target.value)}
                className="h-9 px-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-1 justify-end">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search employee..."
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary" />
          </div>

          {viewMode === 'DAILY' && (
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary">
              <option value="ALL">All Status</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LATE">Late</option>
              <option value="EARLY LEAVE">Early Leave</option>
            </select>
          )}
        </div>
      </div>

      {/* Table Data */}
      <div className="glass-morphism rounded-[2rem] p-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-border text-muted-foreground label-eyebrow text-xs">
                <th className="px-5 py-4 font-medium">Employee</th>
                <th className="px-5 py-4 font-medium">Shift Config</th>
                {viewMode === 'DAILY' ? (
                  <>
                    <th className="px-5 py-4 font-medium">Time In</th>
                    <th className="px-5 py-4 font-medium">Time Out</th>
                    <th className="px-5 py-4 font-medium">Status</th>
                    <th className="px-5 py-4 font-medium">Late By</th>
                    <th className="px-5 py-4 font-medium">Early By</th>
                  </>
                ) : (
                  <>
                    <th className="px-5 py-4 font-medium">Total Days</th>
                    <th className="px-5 py-4 font-medium">Present</th>
                    <th className="px-5 py-4 font-medium">Absent</th>
                    <th className="px-5 py-4 font-medium text-amber-500">Late Days</th>
                    <th className="px-5 py-4 font-medium text-orange-500">Early Leaves</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-5 py-12 text-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-muted-foreground label-eyebrow">Loading data...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-5 py-12 text-center text-muted-foreground">
                    <Fingerprint className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="label-eyebrow">No records found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((emp, i) => {
                  const cfg = STATUS_CONFIG[emp.status] || STATUS_CONFIG.ABSENT;
                  const StatusIcon = cfg.icon;

                  return (
                    <tr key={emp.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center font-bold text-xs">
                            {emp.photoURL ? <img src={emp.photoURL} alt="" className="h-full w-full rounded-full object-cover" /> : (emp.fullName?.[0] || 'E')}
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{emp.fullName}</div>
                            <div className="text-xs text-muted-foreground">{emp.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {emp.shiftStartTime ? `${emp.shiftStartTime} - ${emp.shiftEndTime || '?'}` : 'Not Set'}
                      </td>
                      
                      {viewMode === 'DAILY' ? (
                        <>
                          <td className="px-5 py-3 font-medium">{formatPunchTime(emp.punchIn)}</td>
                          <td className="px-5 py-3 font-medium">{formatPunchTime(emp.punchOut)}</td>
                          <td className="px-5 py-3">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border label-eyebrow text-[10px] ${cfg.color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {cfg.label}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-amber-500 font-medium text-xs">
                            {emp.minutesLate > 0 ? minutesToHM(emp.minutesLate) : '—'}
                          </td>
                          <td className="px-5 py-3 text-orange-500 font-medium text-xs">
                            {emp.minutesEarly > 0 ? minutesToHM(emp.minutesEarly) : '—'}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-5 py-3 font-bold">{emp.workingDays || 0}</td>
                          <td className="px-5 py-3 text-emerald-500 font-medium">{emp.totalPresent || 0}</td>
                          <td className="px-5 py-3 text-red-500 font-medium">{emp.totalAbsent || 0}</td>
                          <td className="px-5 py-3 text-amber-500 font-medium">{emp.totalLate || 0}</td>
                          <td className="px-5 py-3 text-orange-500 font-medium">{emp.totalEarly || 0}</td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

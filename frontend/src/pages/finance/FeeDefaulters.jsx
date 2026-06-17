import React, { useState, useEffect, useMemo } from 'react';
import { getCurrentAcademicYear } from '../../utils';

import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { AlertCircle, Download, FileText, Loader2, Search } from 'lucide-react';
import { listStudents } from '../../services/firebase/studentsService';
import { listClasses } from '../../services/firebase/academicService';
import { listTransactions, listFeeCategories, listConcessions } from '../../services/firebase/financeService';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';
import { useTenant } from '../../contexts/TenantContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function FeeDefaulters() {
  const { tenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [feeCategories, setFeeCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [concessions, setConcessions] = useState([]);

  const [selectedClass, setSelectedClass] = useState('');
  const [q, setQ] = useState('');
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const YEARS = ['2024-25', '2025-26', '2026-27', '2027-28'];

  useEffect(() => {
    Promise.all([
      listClasses(),
      listStudents({ status: 'ACTIVE' }),
      listFeeCategories(),
      listTransactions({ status: 'PAID' }),
      listConcessions()
    ]).then(([clsList, stuList, cats, txs, conList]) => {
      setClasses(clsList);
      setStudents(stuList);
      setFeeCategories(cats);
      setTransactions(txs);
      setConcessions(conList);
      
      if (clsList.length > 0) setSelectedClass(clsList[0].name);
      setLoading(false);
    });
  }, []);

  // Compute defaulters logic
  const { schoolSummary, classDefaulters } = useMemo(() => {
    if (!students.length || !feeCategories.length) return { schoolSummary: [], classDefaulters: [] };

    const today = new Date().toISOString().slice(0, 10);
    const summaryMap = {}; // by class
    const defaultersList = [];

    students.forEach(s => {
      if ((s.academicYear || '2026-27') !== academicYear) return;
      if (!s.className) return;
      if (!summaryMap[s.className]) {
        summaryMap[s.className] = { class: s.className, defaultersCount: 0, totalDefaulterAmount: 0 };
      }

      let totalPastDue = 0;
      let totalFee = 0;
      const pastDueTerms = [];

      const filteredCategories = feeCategories.filter(c => (c.academicYear || '2026-27') === academicYear);
      const filteredTransactions = transactions.filter(t => (t.academicYear || '2026-27') === academicYear);

      filteredCategories.forEach(cat => {
        (cat.terms || []).forEach(t => {
          const amt = Number((t.amounts && t.amounts[s.className]) ?? (t.amounts && t.amounts['default']) ?? 0);
          if (amt > 0) {
            totalFee += amt;
            // Check if past due
            if (t.dueDate && t.dueDate < today) {
              totalPastDue += amt;
              pastDueTerms.push({ name: `${cat.name} - ${t.name}`, amount: amt, dueDate: t.dueDate });
            }
          }
        });
      });

      // Calculate paid and concessions
      const paid = filteredTransactions.filter(tx => tx.studentId === s.id).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const con = concessions.find(c => c.studentId === s.id);
      const concessionAmt = Number(con?.amount || 0);

      // Pending against PAST DUE (not total fee)
      // If paid + concession < totalPastDue, they are a defaulter.
      // E.g., Past due = 10k, paid = 5k. Defaulter amount = 5k.
      const defaulterAmount = totalPastDue - paid - concessionAmt;
      const totalPending = totalFee - paid - concessionAmt;

      if (defaulterAmount > 0) {
        summaryMap[s.className].defaultersCount++;
        summaryMap[s.className].totalDefaulterAmount += defaulterAmount;

        if (s.className === selectedClass) {
          defaultersList.push({
            ...s,
            totalPastDue,
            paid,
            concessionAmt,
            defaulterAmount,
            totalPending,
            pastDueTerms
          });
        }
      }
    });

    const schoolSummary = Object.values(summaryMap).sort((a,b) => a.class.localeCompare(b.class));
    const sortedClassDefaulters = defaultersList.sort((a,b) => b.defaulterAmount - a.defaulterAmount);

    return { schoolSummary, classDefaulters: sortedClassDefaulters };
  }, [students, feeCategories, transactions, concessions, selectedClass, academicYear]);

  const filteredDefaulters = classDefaulters.filter(d => 
    `${d.fullName} ${d.admissionNo}`.toLowerCase().includes(q.toLowerCase())
  );

  const generateSlips = () => {
    if (filteredDefaulters.length === 0) return toast.error('No defaulters to print');
    
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // Slips format: 2 columns, 5 rows = 10 slips per page.
    const cols = 2;
    const rows = 5;
    const margin = 10;
    const slipWidth = (pageWidth - (margin * 3)) / cols;
    const slipHeight = (pageHeight - (margin * 6)) / rows;
    
    let currentSlip = 0;

    filteredDefaulters.forEach((d, index) => {
      if (currentSlip > 0 && currentSlip % (cols * rows) === 0) {
        doc.addPage();
        currentSlip = 0;
      }

      const colIdx = currentSlip % cols;
      const rowIdx = Math.floor(currentSlip / cols);
      
      const x = margin + colIdx * (slipWidth + margin);
      const y = margin + rowIdx * (slipHeight + margin);

      // Draw border
      doc.setDrawColor(200);
      doc.setLineWidth(0.5);
      doc.rect(x, y, slipWidth, slipHeight);

      // School Name
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(tenant?.name || 'School Name', x + slipWidth/2, y + 6, { align: 'center' });
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("FEE REMINDER", x + slipWidth/2, y + 10, { align: 'center' });

      // Student Details
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Name: ${d.fullName}`, x + 3, y + 15);
      doc.text(`Adm No: ${d.admissionNo}`, x + slipWidth - 3, y + 15, { align: 'right' });
      doc.text(`Class: ${d.className}-${d.section}`, x + 3, y + 19);

      // Due Details
      doc.setFont("helvetica", "bold");
      doc.text(`Past Due Amount: Rs. ${d.defaulterAmount.toLocaleString('en-IN')}`, x + 3, y + 25);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("Please clear the pending dues at the earliest", x + 3, y + 30);
      doc.text("to avoid late fees or suspension of services.", x + 3, y + 33);
      
      // Footer
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, x + 3, y + slipHeight - 3);

      currentSlip++;
    });

    doc.save(`Fee_Reminders_${selectedClass}.pdf`);
    toast.success('Reminder slips generated');
  };

  const generateReport = () => {
    if (schoolSummary.length === 0) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`School Fee Defaulters Report`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

    const body = schoolSummary.map(c => [
      c.class, 
      c.defaultersCount, 
      `Rs. ${c.totalDefaulterAmount.toLocaleString('en-IN')}`
    ]);

    const totals = schoolSummary.reduce((acc, c) => ({
      students: acc.students + c.defaultersCount,
      amt: acc.amt + c.totalDefaulterAmount
    }), { students: 0, amt: 0 });

    body.push(['TOTAL', totals.students, `Rs. ${totals.amt.toLocaleString('en-IN')}`]);

    autoTable(doc, {
      startY: 28,
      head: [['Class', 'Defaulters', 'Total Past Due Amount']],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [225, 29, 72] } // rose-600
    });

    doc.save('School_Defaulters_Report.pdf');
  };

  if (loading) return <div className="flex justify-center items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const overallDefaulters = schoolSummary.reduce((sum, c) => sum + c.defaultersCount, 0);
  const overallDue = schoolSummary.reduce((sum, c) => sum + c.totalDefaulterAmount, 0);

  return (
    <div className="space-y-6" data-testid="fee-defaulters">
      <NavLink to="/dashboard/finance" className="label-eyebrow text-primary">← Back to Finance</NavLink>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Fee Defaulters</h1>
        <button onClick={generateReport} className="h-10 px-4 rounded-2xl bg-muted text-foreground label-eyebrow flex items-center gap-2 hover:bg-muted/80">
          <FileText className="h-4 w-4" />School Summary Report
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-morphism rounded-[2rem] p-5 border border-rose-500/20 bg-rose-500/5">
            <div className="flex items-center gap-2 text-rose-500 mb-2"><AlertCircle className="h-4 w-4" /><span className="label-eyebrow font-bold">School Overview</span></div>
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Total Defaulters</div>
                <div className="font-display font-black text-3xl tracking-tighter text-rose-600 mt-1">{overallDefaulters}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Total Past Due</div>
                <div className="font-display font-black text-2xl tracking-tighter text-rose-600 mt-1">{formatCurrency(overallDue)}</div>
              </div>
            </div>
          </div>

          <div className="glass-morphism rounded-[2rem] p-5">
            <div className="space-y-4">
              <div>
                <label className="label-eyebrow text-muted-foreground">Academic Year</label>
                <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm font-bold shadow-sm">
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="label-eyebrow text-muted-foreground">Select Class</label>
                <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm">
                  {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Main List */}
        <div className="lg:col-span-3">
          <div className="glass-morphism rounded-[2rem] p-5">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
              <div>
                <div className="label-eyebrow text-muted-foreground">Class Defaulters</div>
                <div className="font-bold text-lg">{selectedClass} · {classDefaulters.length} students</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 h-10 rounded-2xl border border-border bg-card">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." className="bg-transparent outline-none text-sm w-32 focus:w-48 transition-all" />
                </div>
                {filteredDefaulters.length > 0 && (
                  <button onClick={generateSlips} className="h-10 px-4 rounded-2xl bg-rose-500 text-white label-eyebrow flex items-center gap-2 hover:bg-rose-600">
                    <Download className="h-4 w-4" />Print Slips
                  </button>
                )}
              </div>
            </div>

            {filteredDefaulters.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <div className="inline-flex h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-500 items-center justify-center mb-3">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <p>No defaulters found for this class.</p>
              </div>
            ) : (
              <div className="overflow-x-auto thin-scrollbar">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-3 px-2">Student</th>
                      <th className="py-3 px-2">Section</th>
                      <th className="py-3 px-2 text-right">Total Expected</th>
                      <th className="py-3 px-2 text-right">Total Paid</th>
                      <th className="py-3 px-2 text-right">Past Due Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDefaulters.map((d) => (
                      <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 px-2">
                          <div className="font-bold">{d.fullName}</div>
                          <div className="text-xs text-muted-foreground">{d.admissionNo}</div>
                        </td>
                        <td className="py-3 px-2 font-medium">{d.section}</td>
                        <td className="py-3 px-2 text-right text-muted-foreground">{formatCurrency(d.totalPending + d.paid + d.concessionAmt)}</td>
                        <td className="py-3 px-2 text-right font-medium text-emerald-500">{formatCurrency(d.paid)}</td>
                        <td className="py-3 px-2 text-right font-bold text-rose-500">
                          {formatCurrency(d.defaulterAmount)}
                          {d.pastDueTerms.length > 0 && (
                            <div className="text-[10px] text-rose-500/70 font-normal mt-0.5 max-w-[120px] ml-auto truncate" title={d.pastDueTerms.map(t=>`${t.name} (Due ${t.dueDate})`).join(', ')}>
                              {d.pastDueTerms.length} terms overdue
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

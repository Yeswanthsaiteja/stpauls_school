import React, { useState, useEffect, useMemo } from 'react';
import { getCurrentAcademicYear } from '../../utils';

import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Clock,
  Minus, Gift, Loader2, IndianRupee, Search,
} from 'lucide-react';
import { listStudents } from '../../services/firebase/studentsService';
import {
  listTransactions, listFeeCategories, listConcessionsV2, setConcessionV2,
} from '../../services/firebase/financeService';
import { listClasses } from '../../services/firebase/academicService';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computeTermPaid(txList, categoryId, termId) {
  let paid = 0;
  txList.forEach(tx => {
    if (tx.status !== 'PAID') return;
    if (tx.termAllocations && tx.termAllocations.length > 0) {
      tx.termAllocations.forEach(a => {
        if (a.categoryId === categoryId && a.termId === termId) paid += Number(a.amount || 0);
      });
    } else if (tx.categoryId === categoryId) {
      paid += Number(tx.amount || 0);
    }
  });
  return paid;
}

function StatusBadge({ status }) {
  if (status === 'PAID')    return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600">PAID</span>;
  if (status === 'CRITICAL') return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-600 flex items-center gap-1"><AlertCircle className="h-3 w-3"/>OVERDUE</span>;
  if (status === 'PARTIAL') return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-600">PARTIAL</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-muted text-muted-foreground">PENDING</span>;
}

function ConcessionEditor({ value, onSave, onCancel }) {
  const [amt, setAmt] = useState(value?.amount || '');
  const [reason, setReason] = useState(value?.reason || '');
  return (
    <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex flex-wrap gap-2 items-end">
      <div>
        <label className="label-eyebrow text-amber-600/80 text-[10px]">Concession ₹</label>
        <input type="number" value={amt} onChange={e => setAmt(e.target.value)}
          className="mt-1 w-24 h-8 px-2 rounded-xl border border-amber-500/30 bg-card text-sm text-center" />
      </div>
      <div className="flex-1 min-w-[100px]">
        <label className="label-eyebrow text-amber-600/80 text-[10px]">Reason</label>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Scholarship…"
          className="mt-1 w-full h-8 px-2 rounded-xl border border-amber-500/30 bg-card text-sm" />
      </div>
      <div className="flex gap-1">
        <button onClick={() => onSave(Number(amt), reason)}
          className="h-8 px-3 rounded-xl bg-amber-500 text-white label-eyebrow text-[10px]">Apply</button>
        <button onClick={onCancel}
          className="h-8 px-3 rounded-xl bg-muted label-eyebrow text-[10px]">Cancel</button>
      </div>
    </div>
  );
}

// ─── Per-student summary builder ──────────────────────────────────────────────
function buildStudentSummary(student, feeCategories, txList, concessionsV2) {
  const today = new Date().toISOString().slice(0, 10);
  const studentTx = txList.filter(t => t.studentId === student.id);
  const studentCons = concessionsV2.filter(c => c.studentId === student.id);

  let totalFee = 0, totalConc = 0, totalPaid = 0;
  let hasOverdue = false;
  const categories = [];

  feeCategories.forEach(cat => {
    const terms = (cat.terms || []).map(term => {
      const feeAmt = Number((term.amounts?.[student.className]) ?? (term.amounts?.['default']) ?? 0);
      if (feeAmt <= 0) return null;
      const concEntry = studentCons.find(c => c.categoryId === cat.id && c.termId === term.id);
      const concAmt = Number(concEntry?.amount || 0);
      const termPaid = computeTermPaid(studentTx, cat.id, term.id);
      const effectiveFee = feeAmt - concAmt;
      const termDue = Math.max(0, effectiveFee - termPaid);
      const isOverdue = term.dueDate && term.dueDate < today && termDue > 0;
      let termStatus = 'pending';
      if (termDue <= 0) termStatus = 'paid';
      else if (termPaid > 0) termStatus = isOverdue ? 'overdue' : 'partial';
      else if (isOverdue) termStatus = 'overdue';
      if (isOverdue) hasOverdue = true;
      return { ...term, feeAmt, concAmt, termPaid, effectiveFee, termDue, termStatus, concEntry };
    }).filter(Boolean);

    if (terms.length === 0) return;
    const catFee = terms.reduce((s, t) => s + t.feeAmt, 0);
    const catConc = terms.reduce((s, t) => s + t.concAmt, 0);
    const catPaid = terms.reduce((s, t) => s + t.termPaid, 0);
    const catDue = terms.reduce((s, t) => s + t.termDue, 0);
    totalFee += catFee;
    totalConc += catConc;
    totalPaid += catPaid;
    categories.push({ ...cat, terms, catFee, catConc, catPaid, catDue });
  });

  const totalDue = totalFee - totalConc - totalPaid;
  let overallStatus = 'PENDING';
  if (totalDue <= 0) overallStatus = 'PAID';
  else if (hasOverdue) overallStatus = 'CRITICAL';
  else if (totalPaid > 0) overallStatus = 'PARTIAL';

  return { totalFee, totalConc, totalPaid, totalDue, overallStatus, categories };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FeeStatus() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [feeCategories, setFeeCategories] = useState([]);
  const [allTx, setAllTx] = useState([]);
  const [concessionsV2, setConcessionsV2] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [search, setSearch] = useState('');
  const [expandedStudents, setExpandedStudents] = useState({});
  const [editingCon, setEditingCon] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const YEARS = ['2024-25', '2025-26', '2026-27', '2027-28'];

  useEffect(() => {
    Promise.all([
      listStudents({ status: 'ACTIVE' }),
      listFeeCategories(),
      listTransactions(),
      listConcessionsV2(),
      listClasses(),
    ]).then(([studs, cats, txs, cv2, cls]) => {
      setStudents(studs);
      setFeeCategories(cats);
      setAllTx(txs);
      setConcessionsV2(cv2);
      setClasses(cls);
      if (cls.length > 0) {
        setSelectedClass(cls[0].name);
        setSelectedSection(cls[0].sections?.[0] || '');
      }
      setLoading(false);
    });
  }, []);

  const selectedClassData = classes.find(c => c.name === selectedClass);
  const sections = selectedClassData?.sections || [];

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if ((s.academicYear || '2026-27') !== academicYear) return false;
      if (s.className !== selectedClass) return false;
      if (selectedSection && s.section !== selectedSection) return false;
      if (search && !`${s.fullName} ${s.admissionNo}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [students, selectedClass, selectedSection, search, academicYear]);

  const studentSummaries = useMemo(() => {
    const filteredCategories = feeCategories.filter(c => (c.academicYear || '2026-27') === academicYear);
    return filteredStudents.map(s => ({
      student: s,
      ...buildStudentSummary(s, filteredCategories, allTx, concessionsV2),
    }));
  }, [filteredStudents, feeCategories, allTx, concessionsV2, academicYear]);

  const displayedSummaries = useMemo(() => {
    if (filterStatus === 'ALL') return studentSummaries;
    return studentSummaries.filter(s => s.overallStatus === filterStatus);
  }, [studentSummaries, filterStatus]);

  // Aggregate stats
  const classStats = useMemo(() => {
    const total = studentSummaries.reduce((s, x) => s + x.totalFee, 0);
    const conc = studentSummaries.reduce((s, x) => s + x.totalConc, 0);
    const paid = studentSummaries.reduce((s, x) => s + x.totalPaid, 0);
    const pending = studentSummaries.reduce((s, x) => s + x.totalDue, 0);
    const critical = studentSummaries.filter(x => x.overallStatus === 'CRITICAL').length;
    return { total, conc, paid, pending, critical };
  }, [studentSummaries]);

  const toggleExpand = (sid) => setExpandedStudents(p => ({ ...p, [sid]: !p[sid] }));

  const handleSaveConcession = async (studentId, categoryId, termId, amount, reason) => {
    try {
      await setConcessionV2({ studentId, categoryId, termId, amount, reason });
      const docId = `${studentId}_${categoryId}_${termId}`;
      setConcessionsV2(prev => {
        const filtered = prev.filter(c => !(c.studentId === studentId && c.categoryId === categoryId && c.termId === termId));
        return [...filtered, { studentId, categoryId, termId, amount, reason, id: docId }];
      });
      toast.success('Concession applied');
      setEditingCon(null);
    } catch {
      toast.error('Failed to apply concession');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="fee-status">
      <div className="flex items-center justify-between">
        <div>
          <NavLink to="/dashboard/finance" className="label-eyebrow text-primary">← Back to Finance</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-1">Fee Status</h1>
        </div>
        <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="h-11 px-4 rounded-2xl border border-border bg-card text-sm font-bold shadow-sm">
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Filters */}
      <div className="glass-morphism rounded-[2rem] p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="label-eyebrow text-muted-foreground">Class</label>
          <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); }}
            className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm">
            {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Section</label>
          <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}
            className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm">
            <option value="">All Sections</option>
            {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Status Filter</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm">
            <option value="ALL">All Students</option>
            <option value="CRITICAL">🔴 Overdue</option>
            <option value="PARTIAL">🟡 Partial</option>
            <option value="PENDING">⚪ Pending</option>
            <option value="PAID">🟢 Fully Paid</option>
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Search</label>
          <div className="mt-1.5 flex items-center gap-2 h-11 px-3 rounded-2xl border border-border bg-card">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or admission no…"
              className="flex-1 bg-transparent outline-none text-sm" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Expected', value: formatCurrency(classStats.total), color: '' },
          { label: 'Concessions', value: formatCurrency(classStats.conc), color: 'text-amber-500' },
          { label: 'Collected', value: formatCurrency(classStats.paid), color: 'text-emerald-500' },
          { label: 'Pending', value: formatCurrency(classStats.pending), color: 'text-rose-500' },
          { label: 'Overdue Students', value: classStats.critical, color: 'text-rose-600', highlight: classStats.critical > 0 },
        ].map((s, i) => (
          <div key={i} className={`glass-morphism rounded-2xl p-4 ${s.highlight ? 'border border-rose-500/30' : ''}`}>
            <div className="label-eyebrow text-muted-foreground text-[10px]">{s.label}</div>
            <div className={`font-display font-black text-xl tracking-tighter mt-1 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Student Table */}
      <div className="glass-morphism rounded-[2rem] overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="label-eyebrow text-muted-foreground">
            {displayedSummaries.length} student{displayedSummaries.length !== 1 ? 's' : ''} · {selectedClass}{selectedSection ? ` – ${selectedSection}` : ''}
          </div>
        </div>

        {displayedSummaries.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No students found for the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/20">
                <tr>
                  <th className="text-left py-3 px-4 label-eyebrow text-muted-foreground font-semibold">Student</th>
                  <th className="text-right py-3 px-3 label-eyebrow text-muted-foreground font-semibold hidden sm:table-cell">Total Fee</th>
                  <th className="text-right py-3 px-3 label-eyebrow text-muted-foreground font-semibold hidden md:table-cell">Concession</th>
                  <th className="text-right py-3 px-3 label-eyebrow text-muted-foreground font-semibold">Paid</th>
                  <th className="text-right py-3 px-3 label-eyebrow text-muted-foreground font-semibold">Pending</th>
                  <th className="text-center py-3 px-3 label-eyebrow text-muted-foreground font-semibold">Status</th>
                  <th className="text-center py-3 px-3 label-eyebrow text-muted-foreground font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedSummaries.map(({ student, totalFee, totalConc, totalPaid, totalDue, overallStatus, categories }) => (
                  <React.Fragment key={student.id}>
                    <tr
                      className={`border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer ${overallStatus === 'CRITICAL' ? 'bg-rose-500/3' : ''}`}
                      onClick={() => toggleExpand(student.id)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white font-black text-xs flex-shrink-0">
                            {(student.fullName || 'S')[0]}
                          </div>
                          <div>
                            <div className="font-bold">{student.fullName}</div>
                            <div className="text-xs text-muted-foreground">{student.admissionNo} · Sec {student.section}</div>
                          </div>
                          {expandedStudents[student.id] ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-2" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-2" />}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right hidden sm:table-cell">{formatCurrency(totalFee)}</td>
                      <td className="py-3 px-3 text-right text-amber-500 hidden md:table-cell">{totalConc > 0 ? `-${formatCurrency(totalConc)}` : '—'}</td>
                      <td className="py-3 px-3 text-right text-emerald-600 font-bold">{formatCurrency(totalPaid)}</td>
                      <td className={`py-3 px-3 text-right font-bold ${totalDue > 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>{totalDue > 0 ? formatCurrency(totalDue) : '—'}</td>
                      <td className="py-3 px-3 text-center"><StatusBadge status={overallStatus} /></td>
                      <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/dashboard/finance/collect/${student.id}`)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 label-eyebrow text-[10px] hover:bg-emerald-500/20 transition-colors flex items-center gap-1 mx-auto"
                        >
                          <IndianRupee className="h-3 w-3" />Collect
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Detail */}
                    {expandedStudents[student.id] && (
                      <tr>
                        <td colSpan={7} className="bg-muted/10 px-4 py-4">
                          <div className="space-y-3">
                            {categories.map(cat => (
                              <div key={cat.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                                <div className="flex items-center justify-between p-3 bg-muted/20 border-b border-border/50">
                                  <div className="font-bold text-sm">{cat.name}</div>
                                  <div className="flex items-center gap-3 text-xs">
                                    <span className="text-muted-foreground">Fee: {formatCurrency(cat.catFee)}</span>
                                    {cat.catConc > 0 && <span className="text-amber-500">-{formatCurrency(cat.catConc)}</span>}
                                    <span className="text-emerald-600 font-bold">Paid: {formatCurrency(cat.catPaid)}</span>
                                    <span className={`font-bold ${cat.catDue > 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                                      {cat.catDue > 0 ? `Pending: ${formatCurrency(cat.catDue)}` : '✓ Clear'}
                                    </span>
                                  </div>
                                </div>
                                <div className="divide-y divide-border/30">
                                  {cat.terms.map(term => (
                                    <div key={term.id} className="p-3">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <span className="font-medium text-sm">{term.name}</span>
                                          {term.dueDate && <span className="text-xs text-muted-foreground ml-2">Due: {term.dueDate}</span>}
                                          {term.concAmt > 0 && <span className="text-xs text-amber-600 ml-2">-{formatCurrency(term.concAmt)} conc.</span>}
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <span className="text-xs">
                                            <span className="text-emerald-600 font-bold">{formatCurrency(term.termPaid)}</span>
                                            <span className="text-muted-foreground"> / {formatCurrency(term.effectiveFee)}</span>
                                          </span>
                                          {term.termStatus === 'paid' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                          {term.termStatus === 'partial' && <Clock className="h-4 w-4 text-amber-500" />}
                                          {term.termStatus === 'overdue' && <AlertCircle className="h-4 w-4 text-rose-500" />}
                                          {term.termStatus === 'pending' && <Minus className="h-4 w-4 text-muted-foreground" />}
                                        </div>
                                      </div>

                                      {/* Concession editor */}
                                      <div className="mt-2" onClick={e => e.stopPropagation()}>
                                        {editingCon?.studentId === student.id && editingCon?.categoryId === cat.id && editingCon?.termId === term.id ? (
                                          <ConcessionEditor
                                            value={term.concEntry}
                                            onSave={(amt, reason) => handleSaveConcession(student.id, cat.id, term.id, amt, reason)}
                                            onCancel={() => setEditingCon(null)}
                                          />
                                        ) : (
                                          <button
                                            onClick={() => setEditingCon({ studentId: student.id, categoryId: cat.id, termId: term.id })}
                                            className="flex items-center gap-1 text-[10px] text-amber-600 hover:bg-amber-500/10 px-2 py-1 rounded-lg transition-colors"
                                          >
                                            <Gift className="h-3 w-3" />
                                            {term.concAmt > 0 ? `Edit Concession (₹${term.concAmt})` : 'Add Concession'}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

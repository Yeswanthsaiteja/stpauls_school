import React, { useState, useEffect, useMemo } from 'react';
import { getCurrentAcademicYear } from '../../utils';

import { motion } from 'framer-motion';
import { NavLink, useParams } from 'react-router-dom';
import {
  Search, Save, Receipt, Download, Loader2, CalendarDays, Gift, ChevronDown, ChevronUp,
  CheckCircle2, Clock, AlertCircle, Minus,
} from 'lucide-react';
import { listStudents } from '../../services/firebase/studentsService';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Capacitor } from '@capacitor/core';
import {
  listTransactions, addTransaction, listFeeCategories,
  listConcessions, setConcession, listConcessionsV2, setConcessionV2,
  computeTermPaid, allocatePayment,
} from '../../services/firebase/financeService';
import { downloadElementAsPDF } from '../../lib/pdfUtils';
import { formatCurrency } from '../../lib/utils';
import { useTenant } from '../../contexts/TenantContext';
import { logActivity } from '../../services/firebase/activityService';
import { toast } from 'sonner';
import ReceiptTemplate from '../../components/ReceiptTemplate';

const MODES = ['Cash', 'QR', 'Cheque', 'DD'];



// ─── Term Status Badge ────────────────────────────────────────────────────────
function TermBadge({ status, paidAmt, dueAmt }) {
  if (status === 'paid')    return <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full"><CheckCircle2 className="h-3 w-3"/>PAID</span>;
  if (status === 'partial') return <span className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full"><Clock className="h-3 w-3"/>PARTIAL</span>;
  if (status === 'overdue') return <span className="flex items-center gap-1 text-[10px] font-black text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded-full"><AlertCircle className="h-3 w-3"/>OVERDUE</span>;
  return <span className="flex items-center gap-1 text-[10px] font-black text-muted-foreground bg-muted px-2 py-0.5 rounded-full"><Minus className="h-3 w-3"/>PENDING</span>;
}

// ─── Inline Concession Editor ─────────────────────────────────────────────────
function ConcessionEditor({ value, onSave, onCancel }) {
  const [amt, setAmt] = useState(value?.amount || '');
  const [reason, setReason] = useState(value?.reason || '');
  return (
    <div className="mt-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex flex-wrap gap-2 items-end">
      <div>
        <label className="label-eyebrow text-amber-600/80 text-[10px]">Concession ₹</label>
        <input type="number" value={amt} onChange={e => setAmt(e.target.value)}
          className="mt-1 w-28 h-9 px-2 rounded-xl border border-amber-500/30 bg-card text-sm text-center" />
      </div>
      <div className="flex-1 min-w-[120px]">
        <label className="label-eyebrow text-amber-600/80 text-[10px]">Reason</label>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Scholarship"
          className="mt-1 w-full h-9 px-2 rounded-xl border border-amber-500/30 bg-card text-sm" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave(Number(amt), reason)}
          className="h-9 px-3 rounded-xl bg-amber-500 text-white label-eyebrow text-[10px]">Apply</button>
        <button onClick={onCancel}
          className="h-9 px-3 rounded-xl bg-muted label-eyebrow text-[10px]">Cancel</button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FeeCollection() {
  const { studentId: paramStudentId } = useParams();
  const { tenant } = useTenant();
  const { profile } = useAuth();

  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const YEARS = ['2024-25', '2025-26', '2026-27', '2027-28'];

  const [students, setStudents] = useState([]);
  const [feeCategories, setFeeCategories] = useState([]);
  const [allTx, setAllTx] = useState([]);
  const [concessionsV2, setConcessionsV2] = useState([]);

  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const [studentTx, setStudentTx] = useState([]);

  // Collection form
  const [selectedCatId, setSelectedCatId] = useState('');
  const [payAmt, setPayAmt] = useState('');
  const [mode, setMode] = useState('Cash');
  const [chequeNo, setChequeNo] = useState('');
  const [bank, setBank] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lastReceipt, setLastReceipt] = useState(null);
  const [saving, setSaving] = useState(false);

  // Concession editor state: { categoryId, termId }
  const [editingCon, setEditingCon] = useState(null);

  // Expanded categories in breakdown
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    Promise.all([
      listStudents({ status: 'ACTIVE' }),
      listFeeCategories(),
      listTransactions(),
      listConcessionsV2(),
    ]).then(([stuList, cats, txs, cv2]) => {
      setStudents(stuList);
      setFeeCategories(cats);
      setAllTx(txs);
      setConcessionsV2(cv2);

      if (paramStudentId) {
        const s = stuList.find(s => s.id === paramStudentId);
        if (s) {
          setPicked(s);
          setStudentTx(txs.filter(t => t.studentId === s.id));
          if (cats.length > 0) setSelectedCatId(cats[0].id);
        }
      }
    });
  }, [paramStudentId]);

  const matches = q
    ? students
        .filter(s => (s.academicYear || '2026-27') === academicYear)
        .filter(s => `${s.fullName} ${s.admissionNo}`.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 8)
    : [];

  const selectStudent = (s) => {
    setPicked(s);
    setStudentTx(allTx.filter(t => t.studentId === s.id));
    setLastReceipt(null);
    setExpanded({});
    setQ('');
  };



  // ─── Per-student, per-category summary ────────────────────────────────────
  const categoryBreakdown = useMemo(() => {
    if (!picked || !feeCategories.length) return [];
    const today = new Date().toISOString().slice(0, 10);

    return feeCategories.filter(c => (c.academicYear || '2026-27') === academicYear).map(cat => {
      const terms = (cat.terms || []).map(t => {
        const feeAmt = Number((t.amounts?.[picked.className]) ?? (t.amounts?.['default']) ?? 0);
        const concEntry = concessionsV2.find(c => c.categoryId === cat.id && c.termId === t.id && c.studentId === picked.id);
        const concAmt = Number(concEntry?.amount || 0);
        const termPaid = computeTermPaid(studentTx, cat.id, t.id);
        const effectiveFee = feeAmt - concAmt;
        const termDue = Math.max(0, effectiveFee - termPaid);
        const isOverdue = t.dueDate && t.dueDate < today && termDue > 0;
        let status = 'pending';
        if (termDue <= 0) status = 'paid';
        else if (termPaid > 0) status = isOverdue ? 'overdue' : 'partial';
        else if (isOverdue) status = 'overdue';
        return { ...t, feeAmt, concAmt, termPaid, effectiveFee, termDue, status, isOverdue, concEntry };
      });

      const totalFee = terms.reduce((s, t) => s + t.feeAmt, 0);
      const totalConc = terms.reduce((s, t) => s + t.concAmt, 0);
      const totalPaid = terms.reduce((s, t) => s + t.termPaid, 0);
      const totalDue = terms.reduce((s, t) => s + t.termDue, 0);

      return { ...cat, terms, totalFee, totalConc, totalPaid, totalDue };
    }).filter(c => c.totalFee > 0);
  }, [picked, feeCategories, studentTx, concessionsV2, academicYear]);

  const filteredStudentTx = useMemo(() => {
    return studentTx.filter(t => (t.academicYear || '2026-27') === academicYear);
  }, [studentTx, academicYear]);

  // Auto-select first valid category
  useEffect(() => {
    if (categoryBreakdown.length > 0) {
      if (!selectedCatId || !categoryBreakdown.find(c => c.id === selectedCatId)) {
        setSelectedCatId(categoryBreakdown[0].id);
      }
    } else {
      setSelectedCatId('');
    }
  }, [categoryBreakdown, selectedCatId]);

  const overallMetrics = useMemo(() => {
    const totalFee = categoryBreakdown.reduce((s, c) => s + c.totalFee, 0);
    const totalConc = categoryBreakdown.reduce((s, c) => s + c.totalConc, 0);
    const totalPaid = categoryBreakdown.reduce((s, c) => s + c.totalPaid, 0);
    const totalDue = categoryBreakdown.reduce((s, c) => s + c.totalDue, 0);
    return { totalFee, totalConc, totalPaid, totalDue };
  }, [categoryBreakdown]);

  // Preview allocation for selected category + amount
  const previewAlloc = useMemo(() => {
    if (!picked || !selectedCatId || !payAmt) return [];
    const cat = feeCategories.find(c => c.id === selectedCatId);
    if (!cat) return [];
    const studentConcsV2 = concessionsV2.filter(c => c.studentId === picked.id);
    const { allocations } = allocatePayment(Number(payAmt), cat.terms || [], picked.className, studentTx, studentConcsV2, cat.id);
    return allocations;
  }, [picked, selectedCatId, payAmt, feeCategories, studentTx, concessionsV2]);

  const finalizePayment = async (amt, cat, allocations, rzpPaymentId = null) => {
    try {
      const row = await addTransaction({
        studentId: picked.id,
        studentName: picked.fullName,
        fatherName: picked.fatherName || '',
        admissionNo: picked.admissionNo,
        className: picked.className,
        section: picked.section,
        feeName: cat?.name || 'Fee Payment',
        categoryId: selectedCatId,
        amount: amt,
        paymentDate: new Date().toISOString(),
        paymentMethod: mode.toUpperCase(),
        academicYear,
        status: 'PAID',
        remarks: rzpPaymentId ? `Razorpay: ${rzpPaymentId}` : remarks,
        chequeNo,
        bank,
        termAllocations: allocations,
      });
      setLastReceipt({ ...row, cat, allocations });
      setStudentTx(t => [row, ...t]);
      setAllTx(prev => [row, ...prev]);
      setPayAmt('');
      toast.success(`Payment recorded · ${row.receiptNo}`);

      await logActivity({
        type: 'fee',
        text: `Fee payment received · ₹${row.amount.toLocaleString('en-IN')} from ${picked.fullName} (${cat?.name})`,
      });
    } catch {
      toast.error('Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const collect = async () => {
    if (!picked) return toast.error('Select a student');
    if (!selectedCatId) return toast.error('Select a fee category');
    const amt = Number(payAmt);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');

    const cat = feeCategories.find(c => c.id === selectedCatId);
    const catDue = categoryBreakdown.find(c => c.id === selectedCatId);
    
    if (!catDue) return toast.error('This fee category is not applicable to this student.');
    if (catDue.totalDue <= 0) return toast.error('No amount is due to collect fees for this category.');
    if (amt > catDue.totalDue + 0.01) {
      return toast.error(`Amount exceeds the pending ₹${catDue.totalDue.toLocaleString('en-IN')}`);
    }

    const studentConcsV2 = concessionsV2.filter(c => c.studentId === picked.id);
    const actualAmt = Math.min(amt, catDue?.totalDue || amt);
    const { allocations } = allocatePayment(
      actualAmt,
      cat?.terms || [],
      picked.className,
      studentTx,
      studentConcsV2,
      selectedCatId,
    );

    if (saving) return; setSaving(true);
    
    if (mode === 'QR') {
      try {
        const isMobileDevice = Capacitor.isNativePlatform() || /android|iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase());

        if (isMobileDevice) {
          console.log('[Payment] Mobile device detected, using payment link flow for QR');
          const token = auth.currentUser ? await auth.currentUser.getIdToken(true) : '';
          const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
          const res = await fetch(`${backendUrl}/api/payments/create-payment-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              amount: Math.round(actualAmt * 100),
              currency: 'INR',
              studentId: picked.id,
              studentName: picked.fullName,
              feeName: cat?.name || 'Fee Payment',
              phone: (picked.phone && picked.phone.replace(/\D/g, '').length >= 10) ? picked.phone.replace(/\D/g, '').slice(-10) : (profile?.phone ? profile.phone.replace(/\D/g, '').slice(-10) : '9988776655'),
              description: `Fee Payment for ${picked.fullName}`,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            alert('Backend Error: ' + JSON.stringify(data));
            throw new Error(data.detail || 'Failed to create payment link');
          }
          const url = data.shortUrl;
          toast.success('Opening payment link...');
          try { window.open(url, '_system'); } catch (_) {}
          setTimeout(() => { window.location.href = url; }, 300);
          setSaving(false);
          return;
        }

        const rzpKey = process.env.REACT_APP_RAZORPAY_KEY_ID;
        
        if (!rzpKey) {
          setSaving(false);
          return toast.error('Razorpay not configured. Please contact school admin.');
        }

        const isLoaded = await new Promise((resolve) => {
          if (window.Razorpay) { resolve(true); return; }
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });

        if (!isLoaded) {
          setSaving(false);
          return toast.error('Failed to load Razorpay SDK');
        }

        const options = {
          key: rzpKey,
          amount: actualAmt * 100,
          currency: "INR",
          name: tenant?.name || "St Paul's School",
          description: `Fee Payment for ${picked.fullName}`,
          prefill: {
            name: picked.fullName,
            method: 'upi'
          },
          config: {
            display: {
              blocks: { upi: { name: 'Pay via UPI', instruments: [{ method: 'upi' }] } },
              sequence: ['block.upi'],
              preferences: { show_default_blocks: false }
            }
          },
          handler: async function (response) {
            const pid = typeof response === 'string' ? response : response.razorpay_payment_id;
            await finalizePayment(actualAmt, cat, allocations, pid);
          },
          modal: {
            ondismiss: function() {
              setSaving(false);
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } catch (e) {
        console.error(e);
        setSaving(false);
        toast.error('Payment Error: ' + e.message);
      }
    } else {
      await finalizePayment(actualAmt, cat, allocations);
    }
  };

  const handleSaveConcession = async (categoryId, termId, amount, reason) => {
    try {
      await setConcessionV2({ studentId: picked.id, categoryId, termId, amount, reason });
      const docId = `${picked.id}_${categoryId}_${termId}`;
      setConcessionsV2(prev => {
        const filtered = prev.filter(c => !(c.studentId === picked.id && c.categoryId === categoryId && c.termId === termId));
        return [...filtered, { studentId: picked.id, categoryId, termId, amount, reason, id: docId }];
      });
      toast.success('Concession applied');
      setEditingCon(null);
    } catch {
      toast.error('Failed to apply concession');
    }
  };

  const downloadReceipt = async () => {
    if (!lastReceipt) return;
    try {
      await downloadElementAsPDF('classic-receipt-preview', `${lastReceipt.receiptNo}.pdf`);
    } catch {
      toast.error('Download failed');
    }
  };

  const toggleExpand = (catId) => setExpanded(p => ({ ...p, [catId]: !p[catId] }));

  return (
    <div className="space-y-6" data-testid="fee-collection">
      <div className="flex items-center justify-between">
        <div>
          <NavLink to="/dashboard/finance" className="label-eyebrow text-primary">← Back to Finance</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-1">Fee Collection</h1>
        </div>
        <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="h-11 px-4 rounded-2xl border border-border bg-card text-sm font-bold shadow-sm">
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">

          {/* STUDENT SEARCH */}
          {!picked && (
            <div className="glass-morphism rounded-[2rem] p-5">
              <label className="label-eyebrow text-muted-foreground">Find Student</label>
              <div className="mt-1.5 flex items-center gap-2 px-3 h-11 rounded-2xl border border-border bg-card">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Name or admission number…" className="flex-1 bg-transparent outline-none text-sm" />
              </div>
              <div className="mt-3 space-y-2">
                {matches.map(s => (
                  <button key={s.id} onClick={() => selectStudent(s)} className="w-full text-left p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white font-black text-sm">{(s.firstName || s.fullName || 'S')[0]}</div>
                    <div className="flex-1">
                      <div className="font-bold text-sm">{s.fullName}</div>
                      <div className="label-eyebrow text-muted-foreground">{s.admissionNo} · {s.className}-{s.section}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STUDENT PANEL */}
          {picked && (
            <>
              {/* Header */}
              <div className="glass-morphism rounded-[2rem] p-5">
                <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                  <div>
                    <div className="label-eyebrow text-muted-foreground">Selected Student</div>
                    <div className="font-display font-black text-2xl tracking-tighter mt-1">{picked.fullName}</div>
                    <div className="label-eyebrow text-muted-foreground mt-0.5">{picked.admissionNo} · {picked.className}-{picked.section}</div>
                  </div>
                  <button onClick={() => { setPicked(null); setLastReceipt(null); }} className="label-eyebrow text-primary px-4 py-2 rounded-xl bg-primary/10">Change</button>
                </div>

                {/* Overall metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="rounded-2xl bg-muted/30 p-3">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Fee</div>
                    <div className="font-black text-sm mt-1">{formatCurrency(overallMetrics.totalFee)}</div>
                  </div>
                  <div className="rounded-2xl bg-amber-500/10 p-3">
                    <div className="text-[10px] text-amber-500 uppercase font-bold tracking-wider">Concession</div>
                    <div className="font-black text-sm mt-1 text-amber-600">-{formatCurrency(overallMetrics.totalConc)}</div>
                  </div>
                  <div className="rounded-2xl bg-emerald-500/10 p-3">
                    <div className="text-[10px] text-emerald-500 uppercase font-bold tracking-wider">Paid</div>
                    <div className="font-black text-sm mt-1 text-emerald-600">{formatCurrency(overallMetrics.totalPaid)}</div>
                  </div>
                  <div className="rounded-2xl bg-rose-500/10 p-3">
                    <div className="text-[10px] text-rose-500 uppercase font-bold tracking-wider">Pending</div>
                    <div className="font-black text-sm mt-1 text-rose-600">{formatCurrency(overallMetrics.totalDue)}</div>
                  </div>
                </div>
              </div>

              {/* Category-wise breakdown */}
              <div className="glass-morphism rounded-[2rem] p-5 space-y-3">
                <div className="label-eyebrow text-muted-foreground">Fee Category Breakdown</div>
                {categoryBreakdown.map(cat => (
                  <div key={cat.id} className="rounded-2xl border border-border overflow-hidden">
                    <button
                      onClick={() => toggleExpand(cat.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-left">
                          <div className="font-bold text-sm">{cat.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Total: {formatCurrency(cat.totalFee)}
                            {cat.totalConc > 0 && <span className="text-amber-500 ml-2">-{formatCurrency(cat.totalConc)} concession</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs text-emerald-600 font-bold">Paid: {formatCurrency(cat.totalPaid)}</div>
                          <div className={`text-xs font-bold ${cat.totalDue > 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                            Pending: {formatCurrency(cat.totalDue)}
                          </div>
                        </div>
                        {expanded[cat.id] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {expanded[cat.id] && (
                      <div className="border-t border-border bg-muted/10 p-3 space-y-2">
                        {cat.terms.filter(t => t.feeAmt > 0).map(term => (
                          <div key={term.id} className="p-3 rounded-xl bg-card border border-border">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-bold text-sm">{term.name}</div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  {term.dueDate && (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <CalendarDays className="h-3 w-3" />Due: {term.dueDate}
                                    </span>
                                  )}
                                  {term.concAmt > 0 && (
                                    <span className="text-xs text-amber-600 font-medium">-{formatCurrency(term.concAmt)} concession</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-col items-end">
                                <TermBadge status={term.status} />
                                <div className="text-xs text-right">
                                  <span className="text-emerald-600 font-bold">{formatCurrency(term.termPaid)}</span>
                                  <span className="text-muted-foreground"> / {formatCurrency(term.effectiveFee)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-2 justify-end">
                              {editingCon?.categoryId === cat.id && editingCon?.termId === term.id ? (
                                <ConcessionEditor
                                  value={term.concEntry}
                                  onSave={(amt, reason) => handleSaveConcession(cat.id, term.id, amt, reason)}
                                  onCancel={() => setEditingCon(null)}
                                />
                              ) : (
                                <button
                                  onClick={() => setEditingCon({ categoryId: cat.id, termId: term.id })}
                                  className="flex items-center gap-1 text-[10px] text-amber-600 hover:bg-amber-500/10 px-2 py-1 rounded-lg transition-colors"
                                >
                                  <Gift className="h-3 w-3" />
                                  {term.concAmt > 0 ? 'Edit Concession' : 'Add Concession'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {categoryBreakdown.length === 0 && (
                  <div className="text-center text-muted-foreground py-6 text-sm">No fee categories configured. Set up fees in Fee Setup first.</div>
                )}
              </div>

              {/* COLLECTION FORM */}
              <div className="glass-morphism rounded-[2rem] p-5 space-y-4">
                <div className="label-eyebrow text-muted-foreground">Collect Payment</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-full">
                    <label className="label-eyebrow text-muted-foreground">Fee Category</label>
                    <select value={selectedCatId} onChange={e => setSelectedCatId(e.target.value)}
                      className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm">
                      {categoryBreakdown.length === 0 && <option value="">No pending categories</option>}
                      {categoryBreakdown.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} — Pending: {formatCurrency(c.totalDue)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label-eyebrow text-muted-foreground">Amount (₹)</label>
                    <input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)}
                      placeholder="Enter amount"
                      className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm" />
                  </div>

                  <div>
                    <label className="label-eyebrow text-muted-foreground">Payment Mode</label>
                    <select value={mode} onChange={e => setMode(e.target.value)}
                      className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm">
                      {MODES.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>

                  {mode === 'Cheque' && (
                    <>
                      <div>
                        <label className="label-eyebrow text-muted-foreground">Cheque No.</label>
                        <input value={chequeNo} onChange={e => setChequeNo(e.target.value)}
                          className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm" />
                      </div>
                      <div>
                        <label className="label-eyebrow text-muted-foreground">Bank</label>
                        <input value={bank} onChange={e => setBank(e.target.value)}
                          className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm" />
                      </div>
                    </>
                  )}

                  <div className="col-span-full">
                    <label className="label-eyebrow text-muted-foreground">Remarks</label>
                    <input value={remarks} onChange={e => setRemarks(e.target.value)}
                      className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm" />
                  </div>
                </div>

                {/* Auto-allocation preview */}
                {previewAlloc.length > 0 && (
                  <div className="p-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-1">
                    <div className="label-eyebrow text-indigo-500 text-[10px] mb-2">Auto-allocation Preview</div>
                    {previewAlloc.map((a, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{a.termName}</span>
                        <span className="font-bold text-indigo-600">{formatCurrency(a.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={collect} disabled={saving}
                  className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white label-eyebrow flex items-center justify-center gap-2 disabled:opacity-60 transition-colors text-sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Collect Payment · {formatCurrency(Number(payAmt) || 0)}
                </button>
              </div>

              {/* Transaction history */}
              <div className="glass-morphism rounded-[2rem] p-5">
                <div className="label-eyebrow text-muted-foreground mb-3">Payment History for {academicYear}</div>
                <div className="space-y-2">
                  {filteredStudentTx.length === 0 && <div className="text-sm text-muted-foreground py-4 text-center">No prior payments for {academicYear}</div>}
                  {filteredStudentTx.map(t => (
                    <div key={t.id} className="p-3 rounded-2xl border border-border">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-sm">{t.feeName}</div>
                          <div className="label-eyebrow text-muted-foreground">{t.receiptNo} · {t.paymentMethod}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{new Date(t.paymentDate).toLocaleDateString('en-IN')}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-display font-black tracking-tighter">{formatCurrency(t.amount)}</div>
                          <span className="px-2 py-0.5 rounded-full label-eyebrow bg-emerald-500/10 text-emerald-500">{t.status}</span>
                        </div>
                      </div>
                      {t.termAllocations && t.termAllocations.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50 space-y-0.5">
                          {t.termAllocations.map((a, i) => (
                            <div key={i} className="flex justify-between text-xs text-muted-foreground">
                              <span>{a.termName}</span>
                              <span className="font-bold text-emerald-600">{formatCurrency(a.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* RECEIPT PANEL */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <div className="label-eyebrow text-muted-foreground mb-2">Receipt Preview</div>
            <motion.div id="receipt-preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white text-slate-900 rounded-[2rem] p-6 shadow-xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white grid place-items-center">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-display font-black text-lg tracking-tight">{tenant?.name || 'School'}</div>
                    <div className="text-[10px] text-slate-500">Fee Receipt</div>
                  </div>
                </div>
                <div className="text-right text-[10px]">
                  <div className="font-mono font-bold">{lastReceipt?.receiptNo || '—'}</div>
                  <div className="text-slate-500">{new Date(lastReceipt?.paymentDate || Date.now()).toLocaleDateString('en-IN')}</div>
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Student</span><span className="font-bold">{picked?.fullName || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Father's Name</span><span className="font-bold">{picked?.fatherName || lastReceipt?.fatherName || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Admission No.</span><span className="font-mono font-bold">{picked?.admissionNo || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Class</span><span className="font-bold">{picked?.className}-{picked?.section}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Category</span><span className="font-bold">{lastReceipt?.feeName || feeCategories.find(c => c.id === selectedCatId)?.name || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Mode</span><span className="font-bold">{lastReceipt?.paymentMethod || mode}</span></div>
              </div>
              {lastReceipt?.allocations && lastReceipt.allocations.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-100 space-y-1">
                  {lastReceipt.allocations.map((a, i) => (
                    <div key={i} className="flex justify-between text-[10px]">
                      <span className="text-slate-500">{a.termName}</span>
                      <span className="font-bold">{formatCurrency(a.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 p-3 rounded-xl bg-indigo-50 flex items-center justify-between">
                <span className="text-xs text-slate-500">Amount Paid</span>
                <span className="font-display font-black text-2xl tracking-tighter text-indigo-700">{formatCurrency(lastReceipt?.amount || Number(payAmt) || 0)}</span>
              </div>
              <div className="mt-6 flex items-end justify-between text-[10px] text-slate-500">
                <span>Cashier · Admin</span>
                <span>Authorised Signatory</span>
              </div>
            </motion.div>
            {lastReceipt && (
              <>
                <ReceiptTemplate receiptData={lastReceipt} id="classic-receipt-preview" />
                <button onClick={downloadReceipt} className="mt-4 w-full h-11 rounded-2xl bg-foreground hover:bg-foreground/90 text-background label-eyebrow flex items-center justify-center gap-2 transition-colors">
                  <Download className="h-4 w-4" />Download Receipt
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

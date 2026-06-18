import React, { useEffect, useState, createContext, useContext, useCallback, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { getCurrentAcademicYear } from '../utils';

import { motion, AnimatePresence } from 'framer-motion';
import { Routes, Route, useNavigate, NavLink } from 'react-router-dom';
import OnlineExams from './OnlineExams';
import GPSTracking from './GPSTracking';
import EventGallery from './EventGallery';
import ExamTimetable from './ExamTimetablePage';
import TeacherMessaging from './TeacherMessaging';
import {
  BookOpen, Bell, IndianRupee, ClipboardCheck, FileText, Library,
  Calendar, MessageSquare, MapPin, Gamepad2, Phone, Camera,
  Headset, Send, Plus, RefreshCw, BookMarked, FileDown, Receipt
} from 'lucide-react';
import { downloadElementAsPDF } from '../lib/pdfUtils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import ReceiptTemplate from '../components/ReceiptTemplate';
import { useAuth } from '../contexts/AuthContext';
import { getStudent } from '../services/firebase/studentsService';
import { listTransactions, listFeeCategories, allocatePayment, computeTermPaid } from '../services/firebase/financeService';
import { listResults, listExamSetups } from '../services/firebase/academicService';
import { getStudentAttendanceSummary, listAttendance } from '../services/firebase/attendanceService';
import { listHolidays } from '../services/firebase/holidaysService';
import { listTickets, addTicket } from '../services/firebase/communicationService';
import { listEmployees } from '../services/firebase/employeesService';
import { listMessages, sendMessage, listAnnouncements } from '../services/firebase/communicationService';
import { listDiaryEntries } from '../services/firebase/communicationService';
import { getWhatsAppUrl } from '../lib/utils';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { addNotification } from '../services/firebase/notificationsService';

// ─── Parent Context (active child shared across all sub-pages) ────────────────
export const ParentChildContext = createContext({ activeChild: null, linkedStudents: [], childIdx: 0, setChildIdx: () => {} });
export const useParentChild = () => useContext(ParentChildContext);

const MODULES = [
  { key: 'diary',         label: 'Diary',             icon: BookMarked,     color: 'bg-blue-500',    tint: 'bg-blue-500/10 text-blue-500' },
  { key: 'announcements', label: 'Announcements',      icon: Bell,           color: 'bg-pink-500',    tint: 'bg-pink-500/10 text-pink-500' },
  { key: 'finance',       label: 'Fees',               icon: IndianRupee,    color: 'bg-emerald-500', tint: 'bg-emerald-500/10 text-emerald-500' },
  { key: 'attendance',    label: 'Attendance',         icon: ClipboardCheck, color: 'bg-violet-500',  tint: 'bg-violet-500/10 text-violet-500' },
  { key: 'result',        label: 'Results',            icon: FileText,       color: 'bg-amber-500',   tint: 'bg-amber-500/10 text-amber-500' },
  { key: 'support',       label: 'Support',            icon: Headset,        color: 'bg-rose-500',    tint: 'bg-rose-500/10 text-rose-500' },
  { key: 'messages',      label: 'Messages',           icon: MessageSquare,  color: 'bg-cyan-500',    tint: 'bg-cyan-500/10 text-cyan-500' },
  { key: 'exam-timetable',label: 'Exam Timetable',     icon: Calendar,       color: 'bg-indigo-500',  tint: 'bg-indigo-500/10 text-indigo-500' },
  { key: 'gps',           label: 'GPS Tracking',       icon: MapPin,         color: 'bg-slate-500',   tint: 'bg-slate-500/10 text-slate-500' },
  { key: 'online-exams',  label: 'Online Exams',       icon: Gamepad2,       color: 'bg-orange-500',  tint: 'bg-orange-500/10 text-orange-500' },
  { key: 'gallery',       label: 'Event Gallery',      icon: Camera,         color: 'bg-fuchsia-500', tint: 'bg-fuchsia-500/10 text-fuchsia-500' },
];

// ─── Shared layout for sub-pages ─────────────────────────────────────────────
const SimplePage = ({ title, description, children, testId }) => {
  const { linkedStudents, childIdx, setChildIdx } = useParentChild();
  return (
    <div className="space-y-5" data-testid={testId}>
      <NavLink to=".." relative="path" className="label-eyebrow text-primary">← Back</NavLink>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-black text-3xl tracking-tighter uppercase">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="glass-morphism rounded-[2rem] p-6">{children}</div>
    </div>
  );
};

// ─── Announcements ──────────────────────────────────────────
const Announcements = () => {
  const { activeChild } = useContext(ParentChildContext);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAnnouncements().then(data => {
      // Filter for parents, and optionally for specific class/section if specified
      const filtered = data.filter(a => {
        if (a.targetRole !== 'ALL' && a.targetRole !== 'PARENT') return false;
        
        // If it targets a specific class, must match activeChild
        if (a.targetRole === 'PARENT') {
          if (!activeChild) return false;
          // Only show announcements that match the child's academic year (or if none was specified on old announcements)
          if (a.academicYear && a.academicYear !== activeChild.academicYear) return false;
          if (a.targetClass && a.targetClass !== activeChild.className) return false;
          if (a.targetSection && a.targetSection !== activeChild.section) return false;
        }
        
        return true;
      });
      setList(filtered);
      setLoading(false);
    });
  }, [activeChild]);

  return (
    <SimplePage title="Announcements" testId="parent-announcements">
      {loading ? (
        <div className="flex justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3">
          {list.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">No new announcements.</div>}
          {list.map((a, i) => (
            <div key={a.id || i} className="p-4 rounded-2xl bg-muted/30 border border-border">
              <div className="flex items-center justify-between">
                <div className="font-bold text-foreground">{a.title}</div>
                <span className="label-eyebrow text-muted-foreground">{a.date}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.description}</p>
            </div>
          ))}
        </div>
      )}
    </SimplePage>
  );
};

// ─── Result page — loads from Firestore for active child ─────────────────────
const Result = () => {
  const { activeChild } = useParentChild();
  const studentId = activeChild?.id;
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) { setLoading(false); return; }
    setLoading(true);
    
    Promise.all([
      listResults({ studentId }),
      listExamSetups()
    ]).then(([resultsData, examsData]) => {
      // Filter out results if their associated exam setup does not have a past releaseDate
      const now = new Date();
      
      const allowedExams = new Set();
      examsData.forEach(ex => {
        if (ex.releaseDate && new Date(ex.releaseDate) <= now) {
          // Both examType or customName might be used, store both to be safe
          if (ex.examType !== 'Other') allowedExams.add(ex.examType);
          if (ex.customName) allowedExams.add(ex.customName);
        }
      });
      
      // Some old results might not have examType, but if they do, strictly enforce releaseDate
      const visibleResults = resultsData.filter(r => {
        if (!r.examType) return true; // fallback for legacy data
        return allowedExams.has(r.examType);
      });
      
      setList(visibleResults);
      setLoading(false);
    });
  }, [studentId]);

  const gradeColor = (g) => ({ 'A+': 'bg-indigo-500/10 text-indigo-500', 'A': 'bg-emerald-500/10 text-emerald-500', 'B': 'bg-amber-500/10 text-amber-500', 'C': 'bg-orange-500/10 text-orange-500', 'D': 'bg-rose-500/10 text-rose-500' }[g] || 'bg-muted');

  return (
    <SimplePage title="Results" testId="parent-result">
      {loading ? <div className="text-center text-muted-foreground py-4">Loading…</div> :
        list.length === 0 ? <div className="text-center text-muted-foreground py-4">No results have been released yet.</div> :
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {list.map((r, i) => (
            <div key={r.id || i} className="p-4 rounded-2xl border border-border">
              <div className="flex items-center justify-between">
                <div className="font-bold">{r.subject || r.subjectName}</div>
                <span className={`px-2.5 py-1 rounded-full label-eyebrow ${gradeColor(r.grade)}`}>{r.grade}</span>
              </div>
              {r.examType && <div className="text-xs text-muted-foreground mt-1 mb-2">Exam: <span className="font-bold">{r.examType}</span></div>}
              <div className="mt-2 flex items-baseline gap-2">
                <div className="font-display font-black text-3xl tracking-tighter">{r.marks}</div>
                <div className="text-sm text-muted-foreground">/ {r.totalMarks || 100}</div>
              </div>
            </div>
          ))}
        </div>
      }
    </SimplePage>
  );
};

// ─── Razorpay UPI loader ──────────────────────────────────────────────────────
async function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// ─── Finance — shows fee categories (pending) + transactions (paid) ───────────
const Finance = () => {
  const { activeChild } = useParentChild();
  const { profile } = useAuth();
  const studentId = activeChild?.id;
  const studentClass = activeChild?.className || '';
  
  const [transactions, setTransactions] = useState([]);
  const [feeCategories, setFeeCategories] = useState([]);
  const [concessionsV2, setConcessionsV2] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [receiptToDownload, setReceiptToDownload] = useState(null);

  const loadData = useCallback(async () => {
    if (!studentId) { setLoading(false); return; }
    setLoading(true);
    const { listConcessionsV2 } = await import('../services/firebase/financeService');
    const [txns, cats, cv2] = await Promise.all([
      listTransactions({ studentId }),
      listFeeCategories(),
      listConcessionsV2(),
    ]);
    setTransactions(txns);
    setFeeCategories(cats);
    setConcessionsV2(cv2);
    if (cats.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(cats[0].id);
    }
    setLoading(false);
  }, [studentId, selectedCategoryId]);

  useEffect(() => { loadData(); }, [loadData]);

  const today = new Date().toISOString().slice(0, 10);
  const studentCons = concessionsV2.filter(c => c.studentId === studentId);

  let totalPaid = 0;
  let totalPending = 0;
  let totalOverdue = 0;
  
  const categoryBreakdown = feeCategories.map(cat => {
    const terms = (cat.terms || []).map(term => {
      const feeAmt = Number((term.amounts?.[studentClass]) ?? (term.amounts?.['default']) ?? 0);
      if (feeAmt <= 0) return null;
      const concAmt = Number(studentCons.find(c => c.categoryId === cat.id && c.termId === term.id)?.amount || 0);
      const termPaid = computeTermPaid(transactions, cat.id, term.id);
      const effectiveFee = feeAmt - concAmt;
      const termDue = Math.max(0, effectiveFee - termPaid);
      const isOverdue = term.dueDate && term.dueDate < today && termDue > 0;
      let status = 'PENDING';
      if (termDue <= 0) status = 'PAID';
      else if (termPaid > 0) status = isOverdue ? 'OVERDUE' : 'PARTIAL';
      else if (isOverdue) status = 'OVERDUE';
      return { ...term, feeAmt, concAmt, termPaid, effectiveFee, termDue, status };
    }).filter(Boolean);

    if (terms.length === 0) return null;
    const catFee = terms.reduce((s, t) => s + t.feeAmt, 0);
    const catConc = terms.reduce((s, t) => s + t.concAmt, 0);
    const catPaid = terms.reduce((s, t) => s + t.termPaid, 0);
    const catDue = terms.reduce((s, t) => s + t.termDue, 0);
    const hasOverdue = terms.some(t => t.status === 'OVERDUE');

    totalPaid += catPaid;
    totalPending += catDue;
    if (hasOverdue) {
      totalOverdue += terms.filter(t => t.status === 'OVERDUE').reduce((s, t) => s + t.termDue, 0);
    }

    return { ...cat, terms, catFee, catConc, catPaid, catDue, hasOverdue };
  }).filter(Boolean);

  const previewAlloc = useMemo(() => {
    if (!selectedCategoryId || !payAmount) return [];
    const cat = feeCategories.find(c => c.id === selectedCategoryId);
    if (!cat) return [];
    const studentConcs = concessionsV2.filter(c => c.studentId === studentId);
    const { allocations } = allocatePayment(Number(payAmount), cat.terms || [], studentClass, transactions, studentConcs, cat.id);
    return allocations;
  }, [selectedCategoryId, payAmount, feeCategories, studentClass, transactions, concessionsV2, studentId]);

  const payUPI = async () => {
    if (!selectedCategoryId) return toast.error('Select a fee category');
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount to pay');

    const cat = feeCategories.find(c => c.id === selectedCategoryId);
    const catDue = categoryBreakdown.find(c => c.id === selectedCategoryId);
    
    if (!catDue || catDue.catDue <= 0) return toast.error('No pending fees for this category');
    if (amt > catDue.catDue + 0.01) return toast.error(`Amount exceeds the pending ₹${catDue.catDue.toLocaleString('en-IN')}`);

    const studentConcs = concessionsV2.filter(c => c.studentId === studentId);
    const { allocations } = allocatePayment(amt, cat?.terms || [], studentClass, transactions, studentConcs, selectedCategoryId);

    setPaying(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) { toast.error('Failed to load payment gateway.'); setPaying(false); return; }

      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      let orderId, amountValue;
      const childName = activeChild?.name || profile?.linkedStudentName || 'Student';
      const receiptNo = `RCPT${Date.now().toString().slice(-8)}`;

      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
        const res = await fetch(`${backendUrl}/api/payments/create-order`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            amount: amt * 100, 
            currency: 'INR', 
            studentId,
            receipt: receiptNo,
            studentName: childName,
            feeName: cat?.name || 'Online Fee Payment'
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to create order');
        orderId = data.id || data.orderId;
        amountValue = data.amount;
      } catch (e) {
        console.error('Order creation error:', e);
        orderId = null;
        amountValue = amt * 100;
      }
      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY_ID || '',
        amount: amountValue || amt * 100,
        currency: 'INR',
        name: "St. Paul's High School",
        description: `Fee Payment — ${cat?.name || 'Online'}`,
        order_id: orderId || undefined,
        prefill: { contact: (profile?.phone || '').replace(/\D/g, '').slice(-10), name: profile?.fullName, method: 'upi' },
        config: {
          display: {
            blocks: { upi: { name: 'Pay via UPI', instruments: [{ method: 'upi' }] } },
            sequence: ['block.upi'],
            preferences: { show_default_blocks: false }
          }
        },
        theme: { color: '#4f46e5' },
        handler: async (response) => {
          try {
            const pid = typeof response === 'string' ? response : response.razorpay_payment_id;
            await addDoc(collection(db, 'transactions'), {
              studentId,
              studentName: childName,
              amount: amt,
              categoryId: selectedCategoryId,
              feeName: cat?.name || 'Online Fee Payment',
              status: 'PAID',
              paymentMode: 'UPI',
              paymentMethod: 'ONLINE',
              paymentId: pid,
              receiptNo,
              termAllocations: allocations,
              tenantId: process.env.REACT_APP_TENANT_ID || 'stpauls',
              paidAt: serverTimestamp(),
              paymentDate: new Date().toISOString(),
              admissionNo: activeChild?.admissionNo || profile?.linkedStudentAdmissionNo || '',
              className: activeChild?.className || profile?.linkedStudentClass || '',
              section: activeChild?.section || profile?.linkedStudentSection || '',
              fatherName: activeChild?.fatherName || profile?.fatherName || '',
            });
            toast.success('Payment successful!');
            setPayAmount('');
            loadData();
          } catch (e) { console.error(e); toast.error('Payment verified, but saving failed. Please contact admin.'); }
        },
        modal: { ondismiss: () => setPaying(false) },
      };

      if (!options.key) {
        toast.error('Razorpay not configured. Please contact school admin to set up online payments.');
        setPaying(false);
        return;
      }

      const isMobileDevice = Capacitor.isNativePlatform() || /android|iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase());

      if (isMobileDevice) {
        // Native app / mobile device: create a Razorpay Payment Link, open in system browser
        console.log('[Payment] Mobile device detected, using payment link flow');
        try {
          const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
          const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
          console.log('[Payment] Calling backend:', backendUrl);
          const res = await fetch(`${backendUrl}/api/payments/create-payment-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              amount: Math.round(amt * 100),
              currency: 'INR',
              studentId,
              studentName: childName,
              feeName: cat?.name || 'Fee Payment',
              phone: (profile?.phone || '').replace(/\D/g, '').slice(-10),
              description: `Fee Payment — ${cat?.name || 'Online'} for ${childName}`,
            }),
          });
          const data = await res.json();
          console.log('[Payment] Link response:', JSON.stringify(data));
          if (!res.ok) throw new Error(data.detail || 'Failed to create payment link');
          const url = data.shortUrl;
          toast.success('Opening payment page...');
          // Try multiple methods to open external browser
          try { window.open(url, '_system'); } catch (_) {}
          setTimeout(() => { window.location.href = url; }, 300);
          setPaying(false);
        } catch (e) {
          console.error('[Payment] Error:', e);
          setPaying(false);
          toast.error('Payment failed: ' + e.message);
        }
      } else {
        console.log('[Payment] Web platform, using Razorpay checkout');
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (e) {
      toast.error('Payment failed: ' + e.message);
    }
    setPaying(false);
  };

  const getStatusStyle = (status) => {
    if (status === 'PAID') return 'bg-emerald-500/10 text-emerald-600';
    if (status === 'OVERDUE') return 'bg-rose-500/10 text-rose-600';
    if (status === 'PARTIAL') return 'bg-amber-500/10 text-amber-600';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <SimplePage title="Fees" testId="parent-finance">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="p-4 rounded-2xl bg-emerald-500/10"><div className="label-eyebrow text-emerald-600">Paid</div><div className="font-display font-black text-2xl tracking-tighter">₹{totalPaid.toLocaleString()}</div></div>
        <div className="p-4 rounded-2xl bg-amber-500/10"><div className="label-eyebrow text-amber-600">Pending</div><div className="font-display font-black text-2xl tracking-tighter">₹{totalPending.toLocaleString()}</div></div>
        <div className="p-4 rounded-2xl bg-rose-500/10"><div className="label-eyebrow text-rose-600">Overdue</div><div className="font-display font-black text-2xl tracking-tighter">₹{totalOverdue.toLocaleString()}</div></div>
      </div>

      {/* Payment Form */}
      {totalPending > 0 && (
        <div className="p-5 rounded-2xl border border-border bg-card mb-5 space-y-4">
          <div className="label-eyebrow text-muted-foreground">Make a Payment</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-eyebrow text-muted-foreground">Select Fee Category</label>
              <select value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)}
                className="mt-1.5 w-full h-11 px-3 rounded-xl border border-border bg-background text-sm">
                <option value="">Select category...</option>
                {categoryBreakdown.filter(c => c.catDue > 0).map(c => (
                  <option key={c.id} value={c.id}>{c.name} (Due: ₹{c.catDue.toLocaleString()})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-eyebrow text-muted-foreground">Amount (₹)</label>
              <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                placeholder="Enter amount"
                className="mt-1.5 w-full h-11 px-4 rounded-xl border border-border bg-background text-sm" />
            </div>
          </div>

          {previewAlloc.length > 0 && (
            <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-1">
              <div className="label-eyebrow text-indigo-500 text-[10px] mb-2">Smart Allocation Preview</div>
              {previewAlloc.map((a, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{a.termName}</span>
                  <span className="font-bold text-indigo-600">₹{a.amount.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          )}

          <button onClick={payUPI} disabled={paying || !payAmount || !selectedCategoryId}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black label-eyebrow flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
            {paying ? (
              <><RefreshCw className="h-4 w-4 animate-spin" />Opening Gateway…</>
            ) : (
              <>Pay via UPI</>
            )}
          </button>
        </div>
      )}

      {loading ? <div className="text-center text-muted-foreground py-4">Loading…</div> :
        categoryBreakdown.length === 0 ? <div className="text-center text-muted-foreground py-4">No fee records found</div> :
        <div className="space-y-4">
          <div className="label-eyebrow text-muted-foreground">Fee Breakdown</div>
          {categoryBreakdown.map((cat, i) => (
            <div key={cat.id || i} className="rounded-2xl border border-border overflow-hidden bg-card">
              <div className="flex items-center justify-between p-4 bg-muted/20 border-b border-border/50">
                <div>
                  <div className="font-bold">{cat.name}</div>
                  <div className="text-xs text-muted-foreground">Total: ₹{cat.catFee.toLocaleString()} {cat.catConc > 0 ? `(-₹${cat.catConc} conc.)` : ''}</div>
                </div>
                <div className="text-right">
                  <div className="font-display font-black tracking-tighter text-emerald-600">₹{cat.catPaid.toLocaleString()} paid</div>
                  <div className={`text-xs font-bold ${cat.catDue > 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>{cat.catDue > 0 ? `₹${cat.catDue.toLocaleString()} pending` : '✓ Cleared'}</div>
                </div>
              </div>
              <div className="divide-y divide-border/30">
                {cat.terms.map(t => (
                  <div key={t.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm">{t.name}</div>
                      <div className="label-eyebrow text-muted-foreground mt-0.5">Due: {t.dueDate || 'N/A'} {t.concAmt > 0 && <span className="text-amber-500 ml-1">(-₹{t.concAmt})</span>}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right flex flex-col items-end">
                        <span className="text-emerald-600 font-bold">₹{t.termPaid.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground"> / ₹{t.effectiveFee.toLocaleString()}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full label-eyebrow text-[9px] ${getStatusStyle(t.status)}`}>{t.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          <div className="flex items-center justify-between mt-6 mb-3">
            <div className="label-eyebrow text-muted-foreground">Payment History</div>
            <div className="label-eyebrow text-muted-foreground">Download Receipt</div>
          </div>
          <div className="space-y-2">
            {transactions.length === 0 && <div className="text-sm text-muted-foreground py-4 text-center">No transactions yet</div>}
            {transactions.map((t, i) => (
              <div key={t.id || i} className="flex items-center justify-between p-3 rounded-2xl border border-border">
                <div>
                  <div className="font-bold text-sm">{t.feeName || 'Fee Payment'}</div>
                  <div className="label-eyebrow text-muted-foreground">{t.receiptNo} {t.paymentMode ? `· ${t.paymentMode}` : ''}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(t.paymentDate || t.paidAt?.toDate() || Date.now()).toLocaleDateString('en-IN')}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-display font-black tracking-tighter">₹{(t.amount || 0).toLocaleString()}</div>
                    <span className={`px-2 py-0.5 rounded-full label-eyebrow text-[9px] ${t.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{t.status}</span>
                  </div>
                  {t.status === 'PAID' && (
                    <button onClick={async () => {
                        let receiptData = { ...t };
                        if (!receiptData.fatherName || !receiptData.className) {
                          const student = await getStudent(t.studentId);
                          if (student) {
                            receiptData.fatherName = student.fatherName || student.parentName || receiptData.fatherName || '';
                            receiptData.className = student.className || receiptData.className || '';
                            receiptData.section = student.section || receiptData.section || '';
                            receiptData.admissionNo = student.admissionNo || receiptData.admissionNo || '';
                            receiptData.studentName = student.fullName || receiptData.studentName || '';
                          }
                        }
                        setReceiptToDownload(receiptData);
                        setTimeout(() => {
                          downloadElementAsPDF('parent-receipt-preview', `${receiptData.receiptNo || receiptData.id}.pdf`).then(() => setReceiptToDownload(null));
                        }, 100);
                      }} 
                      className="text-primary hover:bg-primary/10 p-2 rounded-xl transition-colors shrink-0" title="Download Receipt">
                      <FileDown className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      }

      {/* HIDDEN RECEIPT TEMPLATE FOR DOWNLOADING */}
      {receiptToDownload && (
        <ReceiptTemplate receiptData={receiptToDownload} id="parent-receipt-preview" />
      )}
    </SimplePage>
  );
};

// ─── Attendance (real data from Firestore for active child) ───────────────────
const Attendance = () => {
  const { activeChild } = useParentChild();
  const studentId = activeChild?.id;
  const className = activeChild?.className;
  const [summary, setSummary] = useState({ present: 0, absent: 0, late: 0, total: 0, pct: 0 });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      getStudentAttendanceSummary(studentId),
      listAttendance({ className }),
      listHolidays()
    ]).then(([sum, atList, hols]) => {
      setSummary(sum);
      let rows = atList.map(doc => ({
        date: doc.date, status: (doc.records || {})[studentId],
        className: doc.className, section: doc.section,
      })).filter(r => r.status);
      
      // Inject holidays into the records
      const holMap = {};
      hols.forEach(h => { holMap[h.date] = h; });
      
      rows.forEach(r => {
        if (holMap[r.date]) {
          r.status = 'HOLIDAY';
          r.name = holMap[r.date].name;
          delete holMap[r.date];
        }
      });
      
      // Add remaining holidays that didn't have any attendance record at all
      Object.values(holMap).forEach(h => {
        rows.push({ date: h.date, status: 'HOLIDAY', name: h.name });
      });

      rows.sort((a, b) => b.date.localeCompare(a.date));
      setRecords(rows);
      setLoading(false);
    });
  }, [studentId, className]);

  const colorOf = (s) => s === 'PRESENT' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
    : s === 'ABSENT' ? 'bg-rose-500/15 text-rose-600 border-rose-500/30'
    : s === 'HOLIDAY' ? 'bg-indigo-500/15 text-indigo-600 border-indigo-500/30'
    : 'bg-amber-500/15 text-amber-600 border-amber-500/30';

  return (
    <SimplePage title="Attendance" testId="parent-attendance">
      {loading ? <div className="text-center py-6 text-muted-foreground">Loading…</div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { l: 'Total Days', v: summary.total },
              { l: 'Present', v: summary.present, c: 'text-emerald-500' },
              { l: 'Absent', v: summary.absent, c: 'text-rose-500' },
              { l: 'Late', v: summary.late, c: 'text-amber-500' },
            ].map((s, i) => (
              <div key={i} className="p-4 rounded-2xl bg-muted/30">
                <div className="label-eyebrow text-muted-foreground">{s.l}</div>
                <div className={`font-display font-black text-2xl tracking-tighter ${s.c || ''}`}>{s.v}</div>
              </div>
            ))}
          </div>
          {summary.total > 0 && (
            <div className="mb-5 p-3 rounded-2xl bg-muted/30">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Attendance %</span>
                <span className="font-bold">{summary.pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${summary.pct >= 75 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${summary.pct}%` }} />
              </div>
              {summary.pct < 75 && <p className="text-xs text-rose-500 mt-1">Attendance below 75% — please attend regularly</p>}
            </div>
          )}
          <div className="space-y-2">
            {records.slice(0, 30).map((r, i) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-2xl border ${colorOf(r.status)}`}>
                <span className="text-sm font-bold">{r.date}</span>
                {r.status === 'HOLIDAY' ? (
                  <span className="label-eyebrow font-black">{r.name} (HOLIDAY)</span>
                ) : (
                  <span className="label-eyebrow font-black">{r.status}</span>
                )}
              </div>
            ))}
            {records.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">No attendance records found yet</p>}
          </div>
        </>
      )}
    </SimplePage>
  );
};

// ─── Diary page — reads entries for active child's class ──────────────────────
const ParentDiaryPage = () => {
  const { activeChild } = useParentChild();
  const studentClass = activeChild?.className || '';
  const studentSection = activeChild?.section || '';
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listDiaryEntries({ className: studentClass || undefined }).then(data => {
      setEntries(data);
      setLoading(false);
    });
  }, [studentClass]);

  // Filter by academicYear, class, and section
  const visible = entries.filter(d =>
    (!activeChild?.academicYear || !d.academicYear || d.academicYear === activeChild.academicYear) &&
    (!studentClass || d.className === studentClass) &&
    (!studentSection || d.section === studentSection || !d.section)
  );

  return (
    <SimplePage title="Class Diary" testId="parent-diary">
      {studentClass && (
        <div className="mb-4 flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 label-eyebrow">
            Class {studentClass}{studentSection ? `-${studentSection}` : ''} · {activeChild?.name || 'Student'}
          </span>
        </div>
      )}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading diary…</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No diary entries yet for Class {studentClass || "your child's class"}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((d, i) => (
            <motion.div key={d.id || i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <BookMarked className="h-4 w-4 text-indigo-500" />
                <span className="font-bold text-sm">{d.author}</span>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary label-eyebrow text-[10px]">{d.className}{d.section ? `-${d.section}` : ''}</span>
                <span className="label-eyebrow text-muted-foreground">{d.date}</span>
              </div>
              {d.note && <p className="text-sm mt-1">{d.note}</p>}
              {d.homework && (
                <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="label-eyebrow text-amber-600 mb-1">Homework</div>
                  <p className="text-sm">{d.homework}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </SimplePage>
  );
};

// ─── CRM — raise/track tickets ────────────────────────────────────────────────
const Support = () => {
  const { profile } = useAuth();
  const { activeChild } = useParentChild();
  const [tickets, setTickets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', category: 'General' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTickets().then(all => {
      const myPhone = (profile?.phone || '').replace(/\D/g, '').slice(-10);
      setTickets(all.filter(t => {
        const tPhone = (t.raisedBy || '').replace(/\D/g, '').slice(-10);
        return tPhone === myPhone || t.parentName === profile?.fullName || t.studentName === profile?.linkedStudentName || t.studentId === activeChild?.id;
      }));
      setLoading(false);
    });
  }, [profile, activeChild]);

  const handleSubmit = async () => {
    if (!form.title || !form.description) return toast.error('Fill in title and description');
    if (saving) return; setSaving(true);
    const ticket = await addTicket({
      ...form, raisedBy: profile?.phone, parentName: profile?.fullName,
      studentName: activeChild?.name || profile?.linkedStudentName, studentId: activeChild?.id || profile?.linkedStudentId,
      createdByName: profile?.fullName,
    });
    if (ticket) {
      setTickets(p => [ticket, ...p]);
      toast.success(`Ticket ${ticket.ticketNo} raised`);
      setShowForm(false); setForm({ title: '', description: '', priority: 'MEDIUM', category: 'General' });
      try {
        await addNotification({
          userId: 'admin',
          type: 'crm_ticket',
          title: `New Support Ticket: ${ticket.ticketNo}`,
          body: `${profile?.fullName || 'Parent'}: "${form.title}" — ${form.category} · ${form.priority} priority`,
        });
      } catch {}
    } else { toast.error('Failed. Check Firebase config.'); }
    setSaving(false);
  };

  const statusStyle = { OPEN: 'bg-rose-500/10 text-rose-600', IN_PROGRESS: 'bg-amber-500/10 text-amber-600', RESOLVED: 'bg-emerald-500/10 text-emerald-600' };

  return (
    <SimplePage title="Support" testId="parent-support">
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-primary text-primary-foreground label-eyebrow text-xs">
          <Plus className="h-3.5 w-3.5" /> Raise Ticket
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 rounded-2xl border border-border bg-muted/20 space-y-3">
            <input placeholder="Title / Subject" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary" />
            <textarea rows={3} placeholder="Describe your issue…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none resize-none focus:border-primary" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="px-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none">
                {['General', 'Fee', 'Attendance', 'Marks', 'Transport', 'Hostel', 'Other'].map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="px-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none">
                {['LOW', 'MEDIUM', 'HIGH'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground label-eyebrow text-xs disabled:opacity-50">
                {saving ? 'Submitting…' : 'Submit Ticket'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 rounded-xl bg-muted label-eyebrow text-xs">Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? <p className="text-center text-muted-foreground py-6 text-sm">Loading…</p> : (
        <div className="space-y-3">
          {tickets.map((t, i) => (
            <div key={t.id || i} className="p-4 rounded-2xl border border-border">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-sm">{t.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t.description}</div>
                  <div className="label-eyebrow text-muted-foreground mt-2">{t.ticketNo} · {t.category}</div>
                </div>
                <span className={`px-3 py-1 rounded-full label-eyebrow text-[9px] ${statusStyle[t.status] || statusStyle.OPEN}`}>{t.status}</span>
              </div>
              {(t.resolution || t.remarks) && (
                <div className="mt-3 p-2 rounded-xl bg-emerald-500/10 text-xs text-emerald-700">
                  <span className="font-bold">Resolution:</span> {t.resolution || t.remarks}
                </div>
              )}
            </div>
          ))}
          {tickets.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">No support tickets yet</p>}
        </div>
      )}
    </SimplePage>
  );
};

// ─── Messages — contact teachers ──────────────────────────────────────────────
const Messages = () => {
  const { profile } = useAuth();
  const { activeChild } = useParentChild();
  const [employees, setEmployees] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const myId = profile?.phone || profile?.uid;

  useEffect(() => {
    Promise.all([listEmployees({ status: 'ACTIVE' }), listMessages({ senderId: myId }), listMessages({ recipientId: myId })])
      .then(([emps, sent, received]) => {
        const childClass = activeChild?.className || profile?.linkedStudentClass;
        const relevant = childClass
          ? emps.filter(e => {
              const teachesThisClass = (e.classes || '').includes(childClass) || e.className === childClass || e.classTeacherOf?.startsWith(childClass);
              return teachesThisClass || e.role === 'Principal' || e.role === 'Vice Principal';
            })
          : emps;
        setEmployees(relevant.length > 0 ? relevant : emps);
        const all = [...sent, ...received].filter((m, i, a) => a.findIndex(x => x.id === m.id) === i)
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        setMessages(all); setLoading(false);
      });
  }, [myId, activeChild?.className]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async () => {
    if (!selected) return toast.error('Select a teacher');
    if (!text.trim()) return toast.error('Type a message');
    setSending(true);
    const msg = await sendMessage({
      senderId: myId, senderName: profile?.fullName || 'Parent',
      recipientId: selected.id, recipientName: selected.fullName,
      text: text.trim(), role: 'PARENT',
    });
    if (msg) { setMessages(p => [msg, ...p]); setText(''); toast.success('Message sent'); }
    else toast.error('Failed. Check Firebase config.');
    setSending(false);
  };

  return (
    <SimplePage title="Message Teachers" testId="parent-messages">
      <div className="space-y-4">
        <div>
          <label className="label-eyebrow text-muted-foreground">Select Teacher</label>
          <select onChange={e => setSelected(employees.find(emp => emp.id === e.target.value) || null)}
            className="mt-1 w-full px-4 py-2.5 rounded-2xl border-2 border-border bg-card text-sm outline-none focus:border-primary">
            <option value="">Select a teacher…</option>
            {employees.filter(e => e.department === 'Teaching' || e.designation?.toLowerCase().includes('teacher') || e.role === 'TEACHER').map(e => (
              <option key={e.id} value={e.id}>{e.fullName} {e.designation ? `(${e.designation})` : ''}</option>
            ))}
            {employees.filter(e => !e.designation?.toLowerCase().includes('teacher')).map(e => (
              <option key={e.id} value={e.id}>{e.fullName} — {e.department}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type your message…"
            className="flex-1 px-4 py-2.5 rounded-2xl border-2 border-border bg-card text-sm outline-none focus:border-primary" />
          <button onClick={handleSend} disabled={sending}
            className="px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground disabled:opacity-50">
            {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <div className="space-y-2">
          <div className="label-eyebrow text-muted-foreground">Message History</div>
          {loading ? <p className="text-center text-muted-foreground py-4 text-sm">Loading…</p> : (
            messages.length === 0 ? <p className="text-center text-muted-foreground py-4 text-sm">No messages yet</p> : (
              messages.slice(0, 20).map((m, i) => {
                const isMine = m.senderId === myId;
                return (
                  <div key={m.id || i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${isMine ? 'bg-fuchsia-600 text-white' : 'bg-muted'}`}>
                      {!isMine && <div className="text-[10px] font-bold mb-1 opacity-70">{m.senderName}</div>}
                      {m.text}
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>
    </SimplePage>
  );
};

// ─── Welcome splash ───────────────────────────────────────────────────────────
function WelcomeSplash({ name, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-fuchsia-600 via-violet-700 to-indigo-800 text-white"
    >
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
        className="text-8xl mb-6 select-none">👋</motion.div>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}
        className="text-center space-y-2 px-8">
        <p className="text-fuchsia-200 font-semibold tracking-widest uppercase text-sm">{greeting}</p>
        <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter">Welcome,</h1>
        <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tighter text-fuchsia-200">{name}!</h2>
        <p className="text-white/70 text-sm mt-3">Stay connected with your child's journey at St. Paul's</p>
      </motion.div>
      <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.5, duration: 2.5, ease: 'linear' }}
        className="absolute bottom-0 left-0 h-1 bg-white/40 origin-left w-full" />
    </motion.div>
  );
}

// ─── Parent Home ──────────────────────────────────────────────────────────────
function ParentHome() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { activeChild } = useParentChild();
  const [child, setChild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      const studentId = activeChild?.id;
      if (studentId) {
        const s = await getStudent(studentId);
        setChild(s);
      }
      
      // Load top announcements
      listAnnouncements().then(data => {
        const filtered = data.filter(a => {
          if (a.targetRole !== 'ALL' && a.targetRole !== 'PARENT') return false;
          if (a.targetRole === 'PARENT' && a.targetClass) {
            if (!activeChild) return false;
            if (a.targetClass !== activeChild.className) return false;
            if (a.targetSection && a.targetSection !== activeChild.section) return false;
          }
          return true;
        });
        setAnnouncements(filtered.slice(0, 3));
      }).catch(e => console.error(e));

      setLoading(false);
    };
    loadData();
  }, [activeChild]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!profile) return;
    const key = `stpauls_welcome_shown_${profile.phone || profile.fullName}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      setShowWelcome(true);
    }
  }, [profile?.phone]); // eslint-disable-line react-hooks/exhaustive-deps

  const avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(child?.fullName || activeChild?.name || 'Aanya')}`;
  const parentName = profile?.displayName || profile?.fullName || 'Parent';

  return (
    <>
      <AnimatePresence>
        {showWelcome && (
          <WelcomeSplash name={parentName} onDone={() => setShowWelcome(false)} />
        )}
      </AnimatePresence>

      <div className="space-y-6" data-testid="parent-dashboard">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tighter uppercase">Parent Portal</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Welcome, {parentName} · Stay connected with your child's journey.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading your child's data…</div>
        ) : (
          <>
            {/* Student banner */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <motion.div whileHover={{ y: -3 }} className="lg:col-span-2 relative rounded-[2rem] p-6 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white overflow-hidden">
                <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                <div className="relative flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                  <img src={avatar} alt="avatar" className="h-24 w-24 rounded-3xl bg-white/20 ring-4 ring-white/20" />
                  <div className="flex-1">
                    <div className="label-eyebrow text-white/70">Your Child</div>
                    <div className="font-display font-black text-3xl tracking-tighter mt-1">{child?.fullName || activeChild?.name || 'Student'}</div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {child?.admissionNo && <span className="px-3 py-1 rounded-full bg-white/15 label-eyebrow">{child.admissionNo}</span>}
                      {child?.className && <span className="px-3 py-1 rounded-full bg-white/15 label-eyebrow">Class {child.className}-{child.section}</span>}
                      {!child && activeChild?.className && <span className="px-3 py-1 rounded-full bg-white/15 label-eyebrow">Class {activeChild.className}</span>}
                    </div>
                    <a href={getWhatsAppUrl('+919000000000', `Hello, I am parent of ${child?.fullName || 'my child'}`)}
                      target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-2xl bg-white text-indigo-700 label-eyebrow hover:bg-white/90">
                      <Phone className="h-3.5 w-3.5" /> Contact Office
                    </a>
                  </div>
                </div>
              </motion.div>

              <div className="glass-morphism rounded-[2rem] p-5">
                <div className="label-eyebrow text-muted-foreground">Quick Info</div>
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Academic Year</span><span className="font-bold">{child?.academicYear || '2025-26'}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Section</span><span className="font-bold">{child?.section || activeChild?.section || '—'}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">House</span><span className="font-bold">{child?.house || '—'}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Medium</span><span className="font-bold">{child?.mediumOfInstruction || 'English'}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Blood Group</span><span className="font-bold">{child?.bloodGroup || '—'}</span></div>
                </div>
              </div>
            </div>

            {/* Announcements Preview */}
            <div className="glass-morphism rounded-[2rem] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="label-eyebrow text-muted-foreground flex items-center gap-2">
                  <Bell className="h-4 w-4 text-pink-500" /> Latest Announcements
                </div>
                <button onClick={() => navigate('announcements')} className="text-xs font-bold text-primary hover:underline">View All</button>
              </div>
              <div className="space-y-3">
                {announcements.length === 0 && <div className="text-sm text-muted-foreground py-4">No recent announcements.</div>}
                {announcements.map((a, i) => (
                  <div key={a.id || i} className="p-4 rounded-2xl bg-muted/30 border border-border/50">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm text-foreground">{a.title}</div>
                      <span className="label-eyebrow text-muted-foreground">{a.date}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Modules Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {MODULES.map((m, i) => (
                <motion.button key={m.key} onClick={() => navigate(m.key)}
                  whileHover={{ y: -4, scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl glass-morphism border border-border hover:border-primary/20 transition-colors">
                  <div className={`h-14 w-14 rounded-2xl ${m.tint} grid place-items-center`}>
                    <m.icon className="h-6 w-6" />
                  </div>
                  <span className="font-bold text-xs text-center">{m.label}</span>
                </motion.button>
              ))}
            </div>

          </>
        )}
      </div>
    </>
  );
}

// ─── Root router — owns the active-child state ────────────────────────────────
export default function ParentDashboard() {
  const { profile } = useAuth();
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const YEARS = ['2024-25', '2025-26', '2026-27', '2027-28'];

  // Build linked students list from profile
  const linkedStudents = profile?.linkedStudents ||
    (profile?.linkedStudentId ? [{
      id: profile.linkedStudentId,
      name: profile.linkedStudentName,
      className: profile.linkedStudentClass,
      section: profile.section,
      admissionNo: profile.admissionNo,
    }] : []);

  const [fullLinkedStudents, setFullLinkedStudents] = useState([]);
  useEffect(() => {
    Promise.all(linkedStudents.map(s => getStudent(s.id))).then(students => {
      // Keep only students that exist and merge them with base profile data
      const valid = students.filter(Boolean).map(s => ({
        ...s,
        name: s.fullName || s.name,
      }));
      setFullLinkedStudents(valid.length > 0 ? valid : linkedStudents);
    });
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter by academic year
  const yearFilteredStudents = useMemo(() => {
    if (fullLinkedStudents.length === 0) return [];
    return fullLinkedStudents.filter(s => (s.academicYear || '2026-27') === academicYear);
  }, [fullLinkedStudents, academicYear]);

  // Persist selected child index in localStorage so it survives navigation
  const [childIdx, setChildIdxState] = useState(() => {
    try { return Number(localStorage.getItem('stpauls_child_idx') || '0'); } catch { return 0; }
  });

  const setChildIdx = (idx) => {
    setChildIdxState(idx);
    try { localStorage.setItem('stpauls_child_idx', String(idx)); } catch {}
  };

  const activeChild = yearFilteredStudents[childIdx] || yearFilteredStudents[0] || null;

  return (
    <ParentChildContext.Provider value={{ activeChild, linkedStudents, childIdx, setChildIdx }}>
      <div className="flex flex-col h-full space-y-4">
        {/* GLOBAL MULTI-CHILD SWITCHER */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl sticky top-4 z-40 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="label-eyebrow text-indigo-700 dark:text-indigo-300 ml-2">Academic Year:</span>
            <select value={academicYear} onChange={(e) => { setAcademicYear(e.target.value); setChildIdx(0); }} className="h-9 px-3 rounded-xl border border-indigo-500/30 bg-card text-sm font-bold text-indigo-700 dark:text-indigo-300">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          
          {yearFilteredStudents.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="label-eyebrow text-indigo-700 dark:text-indigo-300">Viewing Child:</span>
              <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                {yearFilteredStudents.map((c, i) => (
                  <button key={c.id} onClick={() => setChildIdx(i)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all whitespace-nowrap ${childIdx === i ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}>
                    <span className="font-bold text-sm">{c.name?.split(' ')[0] || 'Child'}</span>
                    <span className="label-eyebrow text-[10px] opacity-70">({c.className}{c.section ? `-${c.section}` : ''})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {yearFilteredStudents.length === 0 && (
            <div className="text-sm text-indigo-600 font-bold px-4">
              No records linked for {academicYear}
            </div>
          )}
        </div>

        <div className="flex-1">
          <Routes>
            <Route index element={<ParentHome />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="result"        element={<Result />} />
            <Route path="attendance"    element={<Attendance />} />
            <Route path="finance"       element={<Finance />} />
            <Route path="support"       element={<Support />} />
            <Route path="messages"      element={<Messages />} />
            <Route path="diary"         element={<ParentDiaryPage />} />
            <Route path="exam-timetable" element={<ExamTimetable />} />
            <Route path="messaging"     element={<TeacherMessaging />} />
            <Route path="gps"           element={<GPSTracking />} />
            <Route path="online-exams"  element={<OnlineExams />} />
            <Route path="gallery"       element={<EventGallery />} />
          </Routes>
        </div>
      </div>
    </ParentChildContext.Provider>
  );
}

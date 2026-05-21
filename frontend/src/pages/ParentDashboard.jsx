import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Routes, Route, useNavigate, NavLink } from 'react-router-dom';
import OnlineExams from './OnlineExams';
import GPSTracking from './GPSTracking';
import EventGallery from './EventGallery';
import Diary from './Diary';
import ExamTimetable from './ExamTimetablePage';
import TeacherMessaging from './TeacherMessaging';
import {
  BookOpen, Bell, IndianRupee, ClipboardCheck, FileText, Library,
  Calendar, MessageSquare, MapPin, Gamepad2, Phone, Camera,
  Headset, Send, Plus, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { getStudent } from '../services/firebase/studentsService';
import { listTransactions } from '../services/firebase/financeService';
import { listResults } from '../services/firebase/academicService';
import { getStudentAttendanceSummary, listAttendance } from '../services/firebase/attendanceService';
import { listTickets, addTicket } from '../services/firebase/communicationService';
import { listEmployees } from '../services/firebase/employeesService';
import { listMessages, sendMessage } from '../services/firebase/communicationService';
import { getWhatsAppUrl } from '../lib/utils';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { addNotification } from '../services/firebase/notificationsService';

const MODULES = [
  { key: 'diary',         label: 'Diary',             icon: BookOpen,       color: 'bg-blue-500',    tint: 'bg-blue-500/10 text-blue-500' },
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
const SimplePage = ({ title, description, children, testId }) => (
  <div className="space-y-5" data-testid={testId}>
    <NavLink to=".." relative="path" className="label-eyebrow text-primary">← Back</NavLink>
    <h2 className="font-display font-black text-3xl tracking-tighter uppercase">{title}</h2>
    {description && <p className="text-sm text-muted-foreground">{description}</p>}
    <div className="glass-morphism rounded-[2rem] p-6">{children}</div>
  </div>
);

// ─── Announcements (static for now, can be wired to Firestore) ───────────────
const Announcements = () => (
  <SimplePage title="Announcements" testId="parent-announcements">
    <div className="space-y-3">
      {[
        { title: 'School Annual Day — Dec 22', date: '2025-12-10', description: 'Annual Day will be held on 22nd December at 5 PM. Parents are cordially invited.' },
        { title: 'Fee Reminder — Q3 Installment', date: '2025-12-05', description: 'Q3 fee installment is due by December 15. Please clear dues to avoid late fees.' },
        { title: 'PTM — December 18', date: '2025-12-01', description: 'Parent-Teacher Meeting scheduled for Saturday, December 18 from 10 AM to 1 PM.' },
      ].map((a, i) => (
        <div key={i} className="p-4 rounded-2xl bg-muted/30 border border-border">
          <div className="flex items-center justify-between">
            <div className="font-bold">{a.title}</div>
            <span className="label-eyebrow text-muted-foreground">{new Date(a.date).toLocaleDateString()}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{a.description}</p>
        </div>
      ))}
    </div>
  </SimplePage>
);

// ─── Result page — loads from Firestore ──────────────────────────────────────
const Result = ({ studentId }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) { setLoading(false); return; }
    listResults({}).then(r => {
      setList(r.filter(x => x.studentId === studentId));
      setLoading(false);
    });
  }, [studentId]);

  const gradeColor = (g) => ({ 'A+': 'bg-indigo-500/10 text-indigo-500', 'A': 'bg-emerald-500/10 text-emerald-500', 'B': 'bg-amber-500/10 text-amber-500', 'C': 'bg-orange-500/10 text-orange-500', 'D': 'bg-rose-500/10 text-rose-500' }[g] || 'bg-muted');

  return (
    <SimplePage title="Results" testId="parent-result">
      {loading ? <div className="text-center text-muted-foreground py-4">Loading…</div> :
        list.length === 0 ? <div className="text-center text-muted-foreground py-4">No results found yet</div> :
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {list.map((r, i) => (
            <div key={r.id || i} className="p-4 rounded-2xl border border-border">
              <div className="flex items-center justify-between">
                <div className="font-bold">{r.subject || r.subjectName}</div>
                <span className={`px-2.5 py-1 rounded-full label-eyebrow ${gradeColor(r.grade)}`}>{r.grade}</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <div className="font-display font-black text-3xl tracking-tighter">{r.marks}</div>
                <div className="text-sm text-muted-foreground">/ {r.totalMarks || 100}</div>
              </div>
              <div className="label-eyebrow text-muted-foreground mt-1">{r.examType}</div>
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

// ─── Finance page — loads from Firestore ─────────────────────────────────────
const Finance = ({ studentId, profile }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!studentId) { setLoading(false); return; }
    listTransactions({ studentId }).then(r => { setList(r); setLoading(false); });
  }, [studentId]);

  const paid    = list.filter(x => x.status === 'PAID').reduce((s, x) => s + (x.amount || 0), 0);
  const pending = list.filter(x => x.status === 'PENDING').reduce((s, x) => s + (x.amount || 0), 0);

  const payUPI = async () => {
    if (pending <= 0) return toast.error('No pending fees to pay');
    setPaying(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) { toast.error('Failed to load payment gateway. Please try again.'); setPaying(false); return; }

      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      let orderId, amount;
      try {
        const res = await fetch(`${backendUrl}/api/payments/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: pending, currency: 'INR', studentId }),
        });
        const data = await res.json();
        orderId = data.id;
        amount = data.amount;
      } catch {
        // If backend not available, use amount directly
        orderId = null;
        amount = pending * 100;
      }

      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY_ID || '',
        amount: amount || pending * 100,
        currency: 'INR',
        name: "St. Paul's High School",
        description: `Fee Payment — ${profile?.linkedStudentName || 'Student'}`,
        order_id: orderId || undefined,
        method: { upi: true, card: false, netbanking: false, wallet: false, emi: false },
        prefill: { contact: (profile?.phone || '').replace(/\D/g, '').slice(-10), name: profile?.fullName },
        theme: { color: '#4f46e5' },
        handler: async (response) => {
          try {
            await addDoc(collection(db, 'transactions'), {
              studentId,
              studentName: profile?.linkedStudentName,
              amount: pending,
              status: 'PAID',
              paymentMode: 'UPI',
              paymentId: response.razorpay_payment_id,
              feeName: 'UPI Fee Payment',
              tenantId: process.env.REACT_APP_TENANT_ID || 'stpauls',
              paidAt: serverTimestamp(),
            });
            toast.success('Payment successful! Receipt recorded.');
            listTransactions({ studentId }).then(r => setList(r));
          } catch { toast.success('Payment successful!'); }
        },
        modal: { ondismiss: () => setPaying(false) },
      };

      if (!options.key) {
        toast.error('Razorpay not configured. Please contact school admin to set up online payments.');
        setPaying(false);
        return;
      }

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      toast.error('Payment failed: ' + e.message);
    }
    setPaying(false);
  };

  return (
    <SimplePage title="Finance" testId="parent-finance">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="p-4 rounded-2xl bg-emerald-500/10"><div className="label-eyebrow text-emerald-600">Paid</div><div className="font-display font-black text-2xl tracking-tighter">₹{paid.toLocaleString()}</div></div>
        <div className="p-4 rounded-2xl bg-amber-500/10"><div className="label-eyebrow text-amber-600">Pending</div><div className="font-display font-black text-2xl tracking-tighter">₹{pending.toLocaleString()}</div></div>
        <div className="p-4 rounded-2xl bg-rose-500/10"><div className="label-eyebrow text-rose-600">Overdue</div><div className="font-display font-black text-2xl tracking-tighter">₹0</div></div>
      </div>

      {/* UPI Pay button */}
      {pending > 0 && (
        <button onClick={payUPI} disabled={paying}
          className="w-full mb-5 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black label-eyebrow flex items-center justify-center gap-2 disabled:opacity-60">
          {paying ? (
            <><RefreshCw className="h-4 w-4 animate-spin" />Opening payment…</>
          ) : (
            <>Pay ₹{pending.toLocaleString()} via UPI</>
          )}
        </button>
      )}

      {loading ? <div className="text-center text-muted-foreground py-4">Loading…</div> :
        list.length === 0 ? <div className="text-center text-muted-foreground py-4">No fee records found</div> :
        <div className="space-y-2">
          {list.map((t, i) => (
            <div key={t.id || i} className="flex items-center justify-between p-3 rounded-2xl border border-border">
              <div>
                <div className="font-bold text-sm">{t.feeName || t.description || 'Fee'}</div>
                <div className="label-eyebrow text-muted-foreground">{t.receiptNo} {t.paymentMode ? `· ${t.paymentMode}` : ''}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="font-display font-black tracking-tighter">₹{(t.amount || 0).toLocaleString()}</div>
                <span className={`px-2.5 py-1 rounded-full label-eyebrow ${t.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' : t.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'}`}>{t.status}</span>
              </div>
            </div>
          ))}
        </div>
      }
    </SimplePage>
  );
};

// ─── Attendance (real data from Firestore) ────────────────────────────────────
const Attendance = ({ studentId, student }) => {
  const [summary, setSummary] = useState({ present: 0, absent: 0, late: 0, total: 0, pct: 0 });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) { setLoading(false); return; }
    Promise.all([
      getStudentAttendanceSummary(studentId),
      listAttendance({ className: student?.className }),
    ]).then(([sum, atList]) => {
      setSummary(sum);
      // Build per-date record for this student
      const rows = atList.map(doc => ({
        date: doc.date, status: (doc.records || {})[studentId],
        className: doc.className, section: doc.section,
      })).filter(r => r.status).sort((a, b) => b.date.localeCompare(a.date));
      setRecords(rows);
      setLoading(false);
    });
  }, [studentId, student?.className]);

  const colorOf = (s) => s === 'PRESENT' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
    : s === 'ABSENT' ? 'bg-rose-500/15 text-rose-600 border-rose-500/30'
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
                <span className="label-eyebrow font-black">{r.status}</span>
              </div>
            ))}
            {records.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">No attendance records found yet</p>}
          </div>
        </>
      )}
    </SimplePage>
  );
};

// ─── CRM — raise/track tickets ────────────────────────────────────────────────
const Support = ({ profile }) => {
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
        return tPhone === myPhone || t.parentName === profile?.fullName || t.studentName === profile?.linkedStudentName;
      }));
      setLoading(false);
    });
  }, [profile]);

  const handleSubmit = async () => {
    if (!form.title || !form.description) return toast.error('Fill in title and description');
    setSaving(true);
    const ticket = await addTicket({
      ...form, raisedBy: profile?.phone, parentName: profile?.fullName,
      studentName: profile?.linkedStudentName, studentId: profile?.linkedStudentId,
      createdByName: profile?.fullName,
    });
    if (ticket) {
      setTickets(p => [ticket, ...p]);
      toast.success(`Ticket ${ticket.ticketNo} raised`);
      setShowForm(false); setForm({ title: '', description: '', priority: 'MEDIUM', category: 'General' });
      // Notify admin
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
const Messages = ({ profile }) => {
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
        // Filter to teachers of the child's class when possible
        const childClass = profile?.linkedStudentClass;
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
  }, [myId]); // eslint-disable-line react-hooks/exhaustive-deps

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
            {employees.filter(e => !e.department?.includes('Teaching') && !e.designation?.toLowerCase().includes('teacher')).length > 0 && (
              employees.filter(e => !e.designation?.toLowerCase().includes('teacher')).map(e => (
                <option key={e.id} value={e.id}>{e.fullName} — {e.department}</option>
              ))
            )}
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

// ─── Welcome splash (shown once per session when parent opens dashboard) ──────
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

// ─── Parent Home ─────────────────────────────────────────────────────────────
function ParentHome() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [child, setChild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  // Multi-child: index of currently selected child
  const [childIdx, setChildIdx] = useState(0);
  const linkedStudents = profile?.linkedStudents || (profile?.linkedStudentId ? [{ id: profile.linkedStudentId, name: profile.linkedStudentName, className: profile.linkedStudentClass, section: profile.section }] : []);
  const activeChild = linkedStudents[childIdx] || null;

  useEffect(() => {
    const loadChild = async () => {
      const studentId = activeChild?.id || profile?.linkedStudentId;
      if (studentId) {
        const s = await getStudent(studentId);
        setChild(s);
      }
      setLoading(false);
    };
    loadChild();
  }, [activeChild?.id, profile?.linkedStudentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show welcome splash only once per login session (not on every navigation)
  useEffect(() => {
    if (!profile) return;
    const key = `stpauls_welcome_shown_${profile.phone || profile.fullName}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      setShowWelcome(true);
    }
  }, [profile?.phone]); // eslint-disable-line react-hooks/exhaustive-deps

  const avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(child?.fullName || profile?.displayName || 'Aanya')}`;
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

      {/* Multi-child switcher */}
      {linkedStudents.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <span className="label-eyebrow text-muted-foreground self-center">Switch Child:</span>
          {linkedStudents.map((c, i) => (
            <button key={c.id} onClick={() => { setChildIdx(i); setLoading(true); }}
              className={`px-4 py-2 rounded-2xl label-eyebrow text-xs border transition-all ${childIdx === i ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border text-muted-foreground'}`}>
              {c.name} · Class {c.className}{c.section ? `-${c.section}` : ''}
            </button>
          ))}
        </div>
      )}

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
                  <div className="font-display font-black text-3xl tracking-tighter mt-1">{child?.fullName || profile?.linkedStudentName || 'Student'}</div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {child?.admissionNo && <span className="px-3 py-1 rounded-full bg-white/15 label-eyebrow">{child.admissionNo}</span>}
                    {child?.className && <span className="px-3 py-1 rounded-full bg-white/15 label-eyebrow">Class {child.className}-{child.section}</span>}
                    {!child && profile?.linkedStudentClass && <span className="px-3 py-1 rounded-full bg-white/15 label-eyebrow">Class {profile.linkedStudentClass}</span>}
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
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Section</span><span className="font-bold">{child?.section || '—'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">House</span><span className="font-bold">{child?.house || '—'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Medium</span><span className="font-bold">{child?.mediumOfInstruction || 'English'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Blood Group</span><span className="font-bold">{child?.bloodGroup || '—'}</span></div>
              </div>
            </div>
          </div>

          {/* Module grid */}
          <div>
            <div className="label-eyebrow text-muted-foreground mb-3">Quick Access</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {MODULES.map((m, i) => (
                <motion.button key={m.key} data-testid={`parent-module-${m.key}`} onClick={() => navigate(m.key)}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -5, scale: 1.03 }} whileTap={{ scale: 0.98 }}
                  className="glass-morphism rounded-[1.75rem] p-4 text-left flex flex-col gap-3">
                  <div className={`h-11 w-11 rounded-2xl ${m.tint} grid place-items-center`}><m.icon className="h-5 w-5" /></div>
                  <div>
                    <div className="font-bold text-sm leading-tight">{m.label}</div>
                    <div className="label-eyebrow text-muted-foreground mt-1">Open →</div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
    </>
  );
}

// ─── Router wrapper — passes studentId to sub-pages ──────────────────────────
export default function ParentDashboard() {
  const { profile } = useAuth();
  const studentId = profile?.linkedStudentId;
  const [student, setStudent] = useState(null);
  useEffect(() => { if (studentId) getStudent(studentId).then(setStudent); }, [studentId]);

  return (
    <Routes>
      <Route index element={<ParentHome />} />
      <Route path="announcements" element={<Announcements />} />
      <Route path="result"        element={<Result studentId={studentId} />} />
      <Route path="attendance"    element={<Attendance studentId={studentId} student={student} />} />
      <Route path="finance"       element={<Finance studentId={studentId} profile={profile} />} />
      <Route path="support"       element={<Support profile={profile} />} />
      <Route path="messages"      element={<Messages profile={profile} />} />
      <Route path="diary"         element={<Diary />} />
      <Route path="exam-timetable" element={<ExamTimetable />} />
      <Route path="messaging"     element={<TeacherMessaging />} />
      <Route path="gps"           element={<GPSTracking />} />
      <Route path="online-exams"  element={<OnlineExams />} />
      <Route path="gallery"       element={<EventGallery />} />
    </Routes>
  );
}

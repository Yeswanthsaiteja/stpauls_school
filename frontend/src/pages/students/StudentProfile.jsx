import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import { Mail, Phone, MapPin, Calendar, GraduationCap, IndianRupee, FileText, Edit, MessageCircle, Award, Loader2 } from 'lucide-react';
import { getStudent } from '../../services/firebase/studentsService';
import { listTransactions, listFeeCategories } from '../../services/firebase/financeService';
import { listResults } from '../../services/firebase/academicService';
import { getWhatsAppUrl, formatCurrency } from '../../lib/utils';

const Section = ({ icon: Icon, title, children, testId }) => (
  <div className="glass-morphism rounded-[2rem] p-5" data-testid={testId}>
    <div className="flex items-center gap-2 mb-4">
      <div className="h-9 w-9 rounded-xl bg-primary/10 grid place-items-center"><Icon className="h-4 w-4 text-primary" /></div>
      <div className="label-eyebrow text-muted-foreground">{title}</div>
    </div>
    {children}
  </div>
);

const Row = ({ label, value }) => (
  <div className="flex justify-between gap-3 py-1.5 text-sm border-b border-border last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-bold text-right">{value || '—'}</span>
  </div>
);

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [feeCategories, setFeeCategories] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    const load = async () => {
      const [stu, txs, res, fCats] = await Promise.all([
        getStudent(id),
        listTransactions({ studentId: id }),
        listResults({}),
        listFeeCategories(),
      ]);
      setStudent(stu);
      setTransactions(txs);
      setResults((res || []).filter((r) => r.studentId === id));
      setFeeCategories(fCats);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-3" data-testid="student-profile-missing">
        <NavLink to="/dashboard/students/directory" className="label-eyebrow text-primary">← Back to Directory</NavLink>
        <div className="glass-morphism rounded-[2rem] p-8 text-center text-sm text-muted-foreground">Student not found.</div>
      </div>
    );
  }

  const totalExpected = feeCategories.reduce((sum, cat) => {
    // Skip transport-only fee if student doesn't use bus
    if (cat.appliesTo === 'transport' && !student.usesBus) return sum;
    // Skip hostel-only fee if student doesn't stay in hostel
    if (cat.appliesTo === 'hostel' && !student.inHostel) return sum;
    const amt = (cat.amounts && cat.amounts[student.className]) ?? (cat.amounts && cat.amounts['default']) ?? 0;
    return sum + Number(amt);
  }, 0);
  const paid    = transactions.filter((t) => t.status === 'PAID').reduce((s, t) => s + (t.amount || 0), 0);
  const pending = totalExpected - paid;

  const TABS = [
    { k: 'overview', label: 'Overview' },
    { k: 'academic', label: 'Academic' },
    { k: 'attendance', label: 'Attendance' },
    { k: 'fees', label: 'Fees' },
    { k: 'documents', label: 'Documents' },
  ];

  return (
    <div className="space-y-5" data-testid="student-profile">
      <NavLink to="/dashboard/students/directory" className="label-eyebrow text-primary">← Back to Directory</NavLink>

      {/* Banner */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative rounded-[2rem] p-6 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white overflow-hidden">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {student.photoURL ? (
            <img src={student.photoURL} alt={student.fullName} className="h-24 w-24 rounded-3xl object-cover ring-4 ring-white/20" />
          ) : (
            <div className="h-24 w-24 rounded-3xl bg-white/20 grid place-items-center text-white font-black text-3xl ring-4 ring-white/20">{student.firstName?.[0]}</div>
          )}
          <div className="flex-1">
            <div className="label-eyebrow text-white/70">Student</div>
            <div className="font-display font-black text-3xl tracking-tighter mt-1">{student.fullName}</div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="px-3 py-1 rounded-full bg-white/15 label-eyebrow">{student.admissionNo}</span>
              <span className="px-3 py-1 rounded-full bg-white/15 label-eyebrow">Class {student.className}-{student.section}</span>
              <span className="px-3 py-1 rounded-full bg-white/15 label-eyebrow">Roll {student.rollNo || '—'}</span>
              <span className={`px-3 py-1 rounded-full label-eyebrow ${student.status === 'ACTIVE' ? 'bg-emerald-400/30 text-emerald-100' : 'bg-rose-400/30 text-rose-100'}`}>{student.status}</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <a href={getWhatsAppUrl(student.phoneNumber, `Hello regarding ${student.fullName}`)} target="_blank" rel="noreferrer" className="px-4 h-10 rounded-2xl bg-white text-indigo-700 label-eyebrow flex items-center gap-2" data-testid="profile-wa">
              <MessageCircle className="h-3.5 w-3.5" />WhatsApp
            </a>
            <button onClick={() => navigate(`/dashboard/students/edit/${student.id}`)} className="px-4 h-10 rounded-2xl bg-white/15 hover:bg-white/25 label-eyebrow flex items-center gap-2" data-testid="profile-edit">
              <Edit className="h-3.5 w-3.5" />Edit
            </button>
          </div>
        </div>
      </motion.div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-emerald-500">Fees Paid</div><div className="font-display font-black text-xl tracking-tighter mt-1">{formatCurrency(paid)}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-amber-500">Pending</div><div className="font-display font-black text-xl tracking-tighter mt-1">{formatCurrency(pending)}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-muted-foreground">Attendance</div><div className="font-display font-black text-xl tracking-tighter mt-1">94%</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-muted-foreground">Avg Marks</div><div className="font-display font-black text-xl tracking-tighter mt-1">{results.length ? Math.round(results.reduce((s,r)=>s+r.marks,0)/results.length) : '—'}</div></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-full p-1 w-fit overflow-x-auto thin-scrollbar">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-1.5 rounded-full label-eyebrow whitespace-nowrap ${tab === t.k ? 'bg-background shadow' : 'text-muted-foreground'}`} data-testid={`tab-${t.k}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section icon={GraduationCap} title="Personal" testId="sec-personal">
            <Row label="Date of Birth" value={student.dateOfBirth} />
            <Row label="Gender" value={student.gender} />
            <Row label="Blood Group" value={student.bloodGroup} />
            <Row label="Nationality" value={student.nationality || 'Indian'} />
            <Row label="Religion" value={student.religion} />
            <Row label="Category" value={student.category} />
            <Row label="Mother Tongue" value={student.motherTongue} />
            <Row label="Aadhar" value={student.aadharNumber} />
          </Section>
          <Section icon={Phone} title="Contact & Address" testId="sec-contact">
            <Row label="Phone" value={student.phoneNumber} />
            <Row label="Email" value={student.email} />
            <Row label="Address" value={student.address} />
            <Row label="City" value={student.city} />
            <Row label="State" value={student.state} />
            <Row label="PIN" value={student.pinCode} />
          </Section>
          <Section icon={GraduationCap} title="Parent / Guardian" testId="sec-parent">
            <Row label="Father" value={student.fatherName} />
            <Row label="Father Occupation" value={student.fatherOccupation} />
            <Row label="Father Phone" value={student.fatherPhone} />
            <Row label="Mother" value={student.motherName} />
            <Row label="Mother Occupation" value={student.motherOccupation} />
            <Row label="Mother Phone" value={student.motherPhone} />
            <Row label="Guardian" value={student.guardianName} />
            <Row label="Annual Income" value={student.annualIncome ? formatCurrency(student.annualIncome) : '—'} />
          </Section>
          <Section icon={Calendar} title="Admission" testId="sec-admission">
            <Row label="Admission Date" value={student.admissionDate?.slice(0,10)} />
            <Row label="Academic Year" value={student.academicYear} />
            <Row label="Admission Type" value={student.admissionType || 'New'} />
            <Row label="Previous School" value={student.previousSchool} />
            <Row label="Previous Class" value={student.lastGradePassed} />
            <Row label="TC Number" value={student.tcNumber} />
            <Row label="Medium" value={student.mediumOfInstruction || 'English'} />
            <Row label="Uses Bus" value={student.usesBus ? `Yes · ${student.busRoute || ''}` : 'No'} />
            <Row label="In Hostel" value={student.inHostel ? `Yes · ${student.hostelRoom || ''}` : 'No'} />
          </Section>
        </div>
      )}

      {tab === 'academic' && (
        <Section icon={FileText} title="Results & Marks" testId="sec-results">
          {results.length === 0 ? <div className="text-sm text-muted-foreground text-center py-6">No results recorded yet</div> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {results.map((r) => (
                <div key={r.id} className="p-3 rounded-2xl border border-border">
                  <div className="flex justify-between items-center">
                    <div className="font-bold">{r.subject}</div>
                    <span className="px-2 py-0.5 rounded-full label-eyebrow bg-emerald-500/10 text-emerald-500">{r.grade}</span>
                  </div>
                  <div className="mt-1 font-display font-black text-2xl tracking-tighter">{r.marks}<span className="text-sm text-muted-foreground">/{r.totalMarks}</span></div>
                  <div className="label-eyebrow text-muted-foreground">{r.examType}</div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {tab === 'fees' && (() => {
        const totalFee = feeCategories.reduce((sum, cat) => {
          if (cat.appliesTo === 'transport' && !student.usesBus) return sum;
          if (cat.appliesTo === 'hostel' && !student.inHostel) return sum;
          const amt = (cat.amounts && cat.amounts[student.className]) ?? (cat.amounts && cat.amounts['default']) ?? 0;
          return sum + Number(amt);
        }, 0);
        const paidFee = transactions.filter(t => t.status === 'PAID').reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const remainingFee = totalFee - paidFee;

        return (
          <Section icon={IndianRupee} title="Fee Ledger" testId="sec-fees">
            <div className="grid grid-cols-3 gap-3 mb-5 text-center">
              <div className="rounded-2xl bg-muted/30 p-3"><div className="label-eyebrow text-muted-foreground">Total Fee</div><div className="font-display font-black text-xl tracking-tighter">{formatCurrency(totalFee)}</div></div>
              <div className="rounded-2xl bg-emerald-500/10 p-3"><div className="label-eyebrow text-emerald-500">Paid</div><div className="font-display font-black text-xl tracking-tighter">{formatCurrency(paidFee)}</div></div>
              <div className="rounded-2xl bg-amber-500/10 p-3"><div className="label-eyebrow text-amber-500">Remaining</div><div className="font-display font-black text-xl tracking-tighter">{formatCurrency(remainingFee)}</div></div>
            </div>
            <div className="space-y-2">
            {transactions.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">No fee records yet</div>}
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-2xl border border-border">
                <div>
                  <div className="font-bold text-sm">{t.feeName}</div>
                  <div className="label-eyebrow text-muted-foreground">{t.receiptNo}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-display font-black tracking-tighter">{formatCurrency(t.amount)}</div>
                  <span className={`px-2.5 py-1 rounded-full label-eyebrow ${t.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' : t.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'}`}>{t.status}</span>
                </div>
              </div>
            ))}
          </div>
            <button onClick={() => navigate(`/dashboard/finance/collect/${student.id}`)} className="mt-4 h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow" data-testid="profile-collect-fee">Collect Payment</button>
          </Section>
        );
      })}

      {tab === 'attendance' && (
        <Section icon={Calendar} title="Attendance Calendar" testId="sec-att">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => {
              const s = d % 11 === 0 ? 'A' : d % 7 === 0 ? 'L' : 'P';
              const cls = s === 'P' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : s === 'A' ? 'bg-rose-500/10 text-rose-600 border-rose-500/30' : 'bg-amber-500/10 text-amber-600 border-amber-500/30';
              return <div key={d} className={`aspect-square rounded-xl border grid place-items-center text-xs font-bold ${cls}`}>{d}</div>;
            })}
          </div>
        </Section>
      )}

      {tab === 'documents' && (
        <Section icon={Award} title="Documents & Certificates" testId="sec-docs">
          <div className="space-y-2">
            {(student.documents || []).length === 0 && <div className="text-sm text-muted-foreground text-center py-4">No documents uploaded yet</div>}
            <button onClick={() => navigate(`/dashboard/students/certificates?studentId=${student.id}`)} className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow">Issue Certificate</button>
          </div>
        </Section>
      )}
    </div>
  );
}

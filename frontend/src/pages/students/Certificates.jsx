import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink, useSearchParams } from 'react-router-dom';
import { Search, Award, Download, Eye } from 'lucide-react';
import { demoStore } from '../../services/demoStore';
import { useTenant } from '../../contexts/TenantContext';
import { downloadElementAsPDF } from '../../lib/pdfUtils';
import { toast } from 'sonner';

const CERT_TYPES = [
  'Transfer Certificate', 'Study Certificate', 'Bonafide Certificate', 'Character Certificate',
  'Date of Birth Certificate', 'Medium of Instruction Certificate', 'Migration Certificate',
  'Conduct Certificate', 'Course Completion Certificate',
];

const TEMPLATES = {
  'Bonafide Certificate': (s, t, today) => `This is to certify that ${s.fullName}, son/daughter of ${s.fatherName || '—'}, bearing Admission No. ${s.admissionNo} is a bonafide student of ${t.name || 'this institution'}, currently studying in Class ${s.className} Section ${s.section} during the academic year ${s.academicYear || '2025-26'}. This certificate is issued for the purpose stated by the applicant on ${today}.`,
  'Transfer Certificate': (s, t, today) => `Transfer Certificate is hereby issued to ${s.fullName} (Adm. No. ${s.admissionNo}), born on ${s.dateOfBirth || '—'}, who has been studying in Class ${s.className}-${s.section} at ${t.name}. The student has completed all formalities and is leaving the institution from ${today}. Character and conduct were found to be good.`,
  'Character Certificate': (s, t, today) => `This is to certify that ${s.fullName} (Adm. No. ${s.admissionNo}) of Class ${s.className}-${s.section} has been a student of ${t.name}. During the period of study, the student's character and conduct were observed to be exemplary. Issued on ${today}.`,
  'Study Certificate': (s, t, today) => `This is to certify that ${s.fullName} (Adm. No. ${s.admissionNo}) is currently a student of Class ${s.className}-${s.section} at ${t.name} for the academic year ${s.academicYear || '2025-26'}. Issued on ${today}.`,
  'Date of Birth Certificate': (s, t, today) => `This is to certify that according to school records, ${s.fullName} (Adm. No. ${s.admissionNo}) was born on ${s.dateOfBirth || '—'}. Issued on ${today}.`,
  'Medium of Instruction Certificate': (s, t, today) => `This is to certify that ${s.fullName} (Adm. No. ${s.admissionNo}) has been receiving instruction in ${s.mediumOfInstruction || 'English'} medium at ${t.name}. Issued on ${today}.`,
  'Migration Certificate': (s, t, today) => `Migration Certificate is granted to ${s.fullName} (Adm. No. ${s.admissionNo}) who has completed studies at ${t.name} and is hereby permitted to migrate to another institution. Issued on ${today}.`,
  'Conduct Certificate': (s, t, today) => `This certifies that ${s.fullName} (Adm. No. ${s.admissionNo}) maintained satisfactory conduct throughout the time spent at ${t.name}. Issued on ${today}.`,
  'Course Completion Certificate': (s, t, today) => `This is to certify that ${s.fullName} (Adm. No. ${s.admissionNo}) has successfully completed the prescribed course of study at ${t.name}. Issued on ${today}.`,
};

export default function Certificates() {
  const [searchParams] = useSearchParams();
  const presetId = searchParams.get('studentId');
  const students = demoStore.list('students');
  const { tenant } = useTenant();

  const [q, setQ] = useState('');
  const [studentId, setStudentId] = useState(presetId || '');
  const [type, setType] = useState('Bonafide Certificate');
  const [customBody, setCustomBody] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toLocaleDateString('en-IN'));
  const [refNo, setRefNo] = useState(`REF-${Date.now().toString().slice(-6)}`);

  const matches = students.filter((s) => q && `${s.fullName} ${s.admissionNo}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  const student = students.find((s) => s.id === studentId);
  const body = customBody || (student ? TEMPLATES[type](student, tenant || { name: 'School' }, issueDate) : '');

  const generate = async () => {
    if (!student) return toast.error('Pick a student');
    await downloadElementAsPDF('cert-preview', `${type.replace(/\s+/g, '_')}_${student.admissionNo}.pdf`);
    toast.success('Certificate downloaded');
  };

  return (
    <div className="space-y-6" data-testid="certificates-page">
      <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Certificates</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-morphism rounded-[2rem] p-5 space-y-3">
            <label className="label-eyebrow text-muted-foreground">Select Student</label>
            <div className="flex items-center gap-2 px-3 h-11 rounded-2xl border border-border bg-card">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => { setQ(e.target.value); setStudentId(''); }} placeholder="Search…" className="flex-1 bg-transparent outline-none text-sm" data-testid="cert-search" />
            </div>
            {q && !studentId && matches.map((s) => (
              <button key={s.id} onClick={() => { setStudentId(s.id); setQ(s.fullName); }} className="w-full text-left p-2 rounded-xl hover:bg-muted/50 text-sm" data-testid={`cert-pick-${s.id}`}>
                <span className="font-bold">{s.fullName}</span> · <span className="text-muted-foreground">{s.admissionNo}</span>
              </button>
            ))}
            {student && <div className="p-3 rounded-2xl bg-primary/5 text-xs"><span className="label-eyebrow">Selected · </span>{student.fullName} ({student.admissionNo})</div>}
          </div>

          <div className="glass-morphism rounded-[2rem] p-5 space-y-3">
            <label className="label-eyebrow text-muted-foreground">Certificate Type</label>
            <select value={type} onChange={(e) => { setType(e.target.value); setCustomBody(''); }} className="w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="cert-type">
              {CERT_TYPES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label-eyebrow text-muted-foreground">Issue Date</label>
                <input value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="mt-1.5 w-full h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="cert-date" />
              </div>
              <div>
                <label className="label-eyebrow text-muted-foreground">Reference No.</label>
                <input value={refNo} onChange={(e) => setRefNo(e.target.value)} className="mt-1.5 w-full h-10 px-3 rounded-2xl border border-border bg-card text-sm font-mono" />
              </div>
            </div>
            <div>
              <label className="label-eyebrow text-muted-foreground">Body (editable)</label>
              <textarea value={customBody || body} onChange={(e) => setCustomBody(e.target.value)} rows={5} className="mt-1.5 w-full px-3 py-2 rounded-2xl border border-border bg-card text-sm" data-testid="cert-body" />
            </div>
            <button onClick={generate} className="h-11 w-full rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center justify-center gap-2" data-testid="cert-generate">
              <Download className="h-3.5 w-3.5" />Generate PDF
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-3">
          <div className="label-eyebrow text-muted-foreground mb-2 flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" />Preview</div>
          <motion.div id="cert-preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white text-slate-900 rounded-[2rem] p-10 shadow-2xl border-8 border-double border-indigo-200" style={{ minHeight: '70vh' }}>
            <div className="flex items-center justify-between border-b-2 border-indigo-100 pb-4">
              <div className="flex items-center gap-3">
                {tenant?.logoUrl ? <img src={tenant.logoUrl} className="h-14 w-14 rounded-2xl" alt="" /> : <div className="h-14 w-14 rounded-2xl bg-indigo-600 text-white grid place-items-center font-black"><Award className="h-7 w-7" /></div>}
                <div>
                  <div className="font-display font-black text-2xl tracking-tight">{tenant?.name || 'School Name'}</div>
                  <div className="text-xs text-slate-500">{tenant?.address || 'School Address'} · {tenant?.contactNumber || ''}</div>
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="font-mono font-bold">{refNo}</div>
                <div className="text-slate-500">{issueDate}</div>
              </div>
            </div>

            <h2 className="font-display font-black text-3xl tracking-tighter text-center my-8 uppercase">{type}</h2>

            {student && (
              <div className="text-sm leading-loose text-justify whitespace-pre-line">{body}</div>
            )}
            {!student && (
              <div className="text-center text-slate-400 py-12 text-sm">Select a student to preview certificate.</div>
            )}

            <div className="mt-16 flex justify-between items-end">
              <div className="text-center">
                <div className="h-10 border-b border-slate-400 w-40" />
                <div className="text-xs text-slate-500 mt-1">School Seal</div>
              </div>
              <div className="text-center">
                <div className="h-10 border-b border-slate-400 w-40" />
                <div className="text-xs text-slate-500 mt-1">Principal Signature</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

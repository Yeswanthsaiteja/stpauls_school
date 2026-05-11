import React, { useState } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, FilePlus2, UserMinus2, Award, MessageCircle, Search, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { demoStore, newAdmissionNo } from '../services/demoStore';
import { getWhatsAppUrl } from '../lib/utils';
import { toast } from 'sonner';

const STEPS = ['Personal', 'Contact', 'Parent Info', 'Academic', 'Photo'];

function Landing() {
  const navigate = useNavigate();
  const recents = demoStore.list('students').slice(0, 5);
  const cards = [
    { icon: Users, label: 'Student Directory', sub: 'Browse · search · filter', to: '/dashboard/students/directory', color: 'from-indigo-500 to-violet-500' },
    { icon: FilePlus2, label: 'Admission Form', sub: 'Multi-step wizard', to: '/dashboard/students/admission-full', color: 'from-emerald-500 to-teal-500' },
    { icon: UserMinus2, label: 'Student Removal', sub: 'TC + deactivation', to: '/dashboard/students/removal', color: 'from-amber-500 to-orange-500' },
    { icon: Award, label: 'Certificates', sub: 'TC · Bonafide · more', to: '/dashboard/students/certificates', color: 'from-rose-500 to-pink-500' },
  ];
  return (
    <div className="space-y-6" data-testid="students-module">
      <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tighter uppercase">Students</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <motion.button key={c.to} onClick={() => navigate(c.to)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -5, scale: 1.02 }} className="glass-morphism rounded-[2rem] p-5 text-left" data-testid={`students-card-${c.label.split(' ').join('-')}`}>
            <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${c.color} grid place-items-center text-white`}><c.icon className="h-5 w-5" /></div>
            <div className="mt-4 font-bold">{c.label}</div>
            <div className="label-eyebrow text-muted-foreground mt-1">{c.sub}</div>
          </motion.button>
        ))}
        <motion.button onClick={() => navigate('/dashboard/students/rejoin')} whileHover={{ y: -5, scale: 1.02 }} className="glass-morphism rounded-[2rem] p-5 text-left" data-testid="students-card-Rejoin">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 grid place-items-center text-white"><Users className="h-5 w-5" /></div>
          <div className="mt-4 font-bold">Student Rejoin</div>
          <div className="label-eyebrow text-muted-foreground mt-1">Reactivate alumni</div>
        </motion.button>
      </div>

      <div className="glass-morphism rounded-[2rem] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="label-eyebrow text-muted-foreground">Recent Admissions</div>
          <button className="label-eyebrow text-primary">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                {['Token', 'Student', 'Class', 'Status', ''].map((h) => (
                  <th key={h} className="label-eyebrow text-muted-foreground py-2 px-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recents.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30 group">
                  <td className="px-3 py-3 font-mono text-xs font-bold">{s.admissionNo}</td>
                  <td className="px-3 py-3">
                    <div className="font-bold text-sm">{s.fullName}</div>
                    <div className="label-eyebrow text-muted-foreground">{s.fatherName}</div>
                  </td>
                  <td className="px-3 py-3 text-sm">{s.className}-{s.section}</td>
                  <td className="px-3 py-3"><span className="px-2.5 py-1 rounded-full label-eyebrow bg-emerald-500/10 text-emerald-500">{s.status}</span></td>
                  <td className="px-3 py-3 text-right">
                    <a href={getWhatsAppUrl(s.phoneNumber, `Hello, regarding ${s.fullName}`)} target="_blank" rel="noreferrer" data-testid={`wa-${s.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 label-eyebrow opacity-0 group-hover:opacity-100 transition">
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-morphism rounded-[2rem] p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 grid place-items-center"><Upload className="h-4 w-4 text-primary" /></div>
          <div className="flex-1">
            <div className="font-bold text-sm">Bulk Import (CSV)</div>
            <div className="label-eyebrow text-muted-foreground">Drag & drop or browse · 700+ records supported</div>
          </div>
          <button onClick={() => navigate('/dashboard/bulk-import')} data-testid="bulk-import-btn" className="px-4 py-2 rounded-2xl bg-foreground text-background label-eyebrow">Open Importer</button>
        </div>
      </div>
    </div>
  );
}

function AdmissionForm() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ firstName: '', lastName: '', dateOfBirth: '', gender: 'Male', className: 'X', section: 'A', phoneNumber: '', fatherName: '', motherName: '' });
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }));
  const navigate = useNavigate();

  const onPhoto = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => set('photoURL', String(e.target.result || ''));
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!data.firstName || !data.lastName) return toast.error('Name required');
    const admissionNo = newAdmissionNo();
    demoStore.add('students', {
      ...data,
      fullName: `${data.firstName} ${data.lastName}`,
      admissionNo,
      status: 'ACTIVE',
      admissionDate: new Date().toISOString(),
    });
    toast.success(`Admission created: ${admissionNo}`);
    navigate('..');
  };

  const Field = ({ label, k, type = 'text', placeholder }) => (
    <div>
      <label className="label-eyebrow text-muted-foreground">{label}</label>
      <input type={type} placeholder={placeholder} value={data[k] || ''} onChange={(e) => set(k, e.target.value)} className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-card outline-none focus:border-primary text-sm" data-testid={`adm-input-${k}`} />
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl" data-testid="admission-form">
      <NavLink to=".." className="label-eyebrow text-primary">← Back to Students</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Admission Form</h1>

      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`label-eyebrow mt-1.5 ${i <= step ? 'text-primary' : 'text-muted-foreground'}`}>{i + 1}. {s}</div>
          </div>
        ))}
      </div>

      <div className="glass-morphism rounded-[2rem] p-6">
        {step === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First Name" k="firstName" placeholder="Aarav" />
            <Field label="Last Name" k="lastName" placeholder="Sharma" />
            <Field label="Date of Birth" k="dateOfBirth" type="date" />
            <div>
              <label className="label-eyebrow text-muted-foreground">Gender</label>
              <select value={data.gender} onChange={(e) => set('gender', e.target.value)} className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm">
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Phone Number" k="phoneNumber" placeholder="+91…" />
            <Field label="Email" k="email" type="email" />
            <Field label="Address" k="address" />
            <Field label="Emergency Contact" k="emergencyContact" />
          </div>
        )}
        {step === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Father's Name" k="fatherName" />
            <Field label="Father's Occupation" k="fatherOccupation" />
            <Field label="Mother's Name" k="motherName" />
            <Field label="Mother's Occupation" k="motherOccupation" />
            <Field label="Annual Income" k="annualIncome" type="number" />
          </div>
        )}
        {step === 3 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Class" k="className" />
            <Field label="Section" k="section" />
            <Field label="Academic Year" k="academicYear" placeholder="2025-26" />
            <Field label="Previous School" k="previousSchool" />
          </div>
        )}
        {step === 4 && (
          <div className="space-y-4">
            <label className="block border-2 border-dashed border-border rounded-3xl p-12 text-center cursor-pointer hover:border-primary transition">
              <input type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0])} className="hidden" data-testid="adm-photo-input" />
              {data.photoURL ? (
                <img src={data.photoURL} alt="preview" className="h-40 w-40 object-cover rounded-3xl mx-auto" />
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <div className="mt-3 font-bold text-sm">Drop photo here or click to browse</div>
                  <div className="label-eyebrow text-muted-foreground mt-1">PNG / JPG · max 5MB</div>
                </>
              )}
            </label>
            {data.photoURL && (
              <button onClick={() => set('photoURL', '')} className="label-eyebrow text-rose-500">Remove photo</button>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between gap-3">
        <button disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="px-5 h-11 rounded-2xl bg-muted label-eyebrow disabled:opacity-40" data-testid="adm-back-btn">Back</button>
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep((s) => s + 1)} className="px-5 h-11 rounded-2xl bg-primary text-primary-foreground label-eyebrow" data-testid="adm-next-btn">Next →</button>
        ) : (
          <button onClick={submit} className="px-5 h-11 rounded-2xl bg-emerald-500 text-white label-eyebrow" data-testid="adm-submit-btn">Submit Admission</button>
        )}
      </div>
    </div>
  );
}

function Directory() {
  const [q, setQ] = useState('');
  const list = demoStore.list('students').filter((s) => s.fullName.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-5" data-testid="student-directory">
      <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Student Directory</h1>
      <div className="glass-morphism rounded-[2rem] p-2 flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground ml-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students…" className="flex-1 h-10 bg-transparent outline-none text-sm" data-testid="directory-search" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((s) => (
          <motion.div key={s.id} whileHover={{ y: -3 }} className="glass-morphism rounded-[1.75rem] p-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white font-black">{s.firstName[0]}</div>
            <div className="flex-1">
              <div className="font-bold text-sm">{s.fullName}</div>
              <div className="label-eyebrow text-muted-foreground">{s.admissionNo} · {s.className}-{s.section}</div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 label-eyebrow">{s.status}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Manage() {
  return (
    <div className="space-y-5" data-testid="student-manage">
      <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Student Management</h1>
      <div className="glass-morphism rounded-[2rem] p-6 text-sm text-muted-foreground">Search a student by name/admission to remove or rejoin. (Stub)</div>
    </div>
  );
}

export default function StudentsModule() {
  return (
    <Routes>
      <Route index element={<Landing />} />
      <Route path="admission" element={<AdmissionForm />} />
      <Route path="directory" element={<Directory />} />
      <Route path="manage" element={<Manage />} />
      <Route path="certificates" element={<Manage />} />
    </Routes>
  );
}

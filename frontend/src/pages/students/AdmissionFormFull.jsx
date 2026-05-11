import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import { Upload, Check, User, MapPin, Users, GraduationCap, HeartPulse, Bus, FileText } from 'lucide-react';
import { demoStore, newAdmissionNo } from '../../services/demoStore';
import { CLASS_OPTIONS, SECTION_OPTIONS } from '../../lib/pdfUtils';
import { toast } from 'sonner';

const STEPS = [
  { k: 'personal', label: 'Personal', icon: User },
  { k: 'contact', label: 'Contact', icon: MapPin },
  { k: 'parent', label: 'Parent Info', icon: Users },
  { k: 'admission', label: 'Admission', icon: GraduationCap },
  { k: 'health', label: 'Health', icon: HeartPulse },
  { k: 'transport', label: 'Transport/Hostel', icon: Bus },
  { k: 'documents', label: 'Documents', icon: FileText },
];

export default function AdmissionFormFull() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    // personal
    firstName: '', lastName: '', dateOfBirth: '', gender: 'Male', bloodGroup: '', aadharNumber: '',
    nationality: 'Indian', religion: '', category: 'General', motherTongue: '', photoURL: '',
    // contact
    address: '', currentAddress: '', sameAsPermanent: true, city: '', state: '', pinCode: '',
    phoneNumber: '', email: '',
    // parent
    fatherName: '', fatherOccupation: '', fatherPhone: '', fatherEmail: '', fatherAadhar: '', fatherIncome: '', fatherPhoto: '',
    motherName: '', motherOccupation: '', motherPhone: '', motherEmail: '', motherAadhar: '', motherIncome: '', motherPhoto: '',
    guardianName: '', guardianRelation: '', guardianPhone: '',
    annualIncome: '',
    // admission
    admissionDate: new Date().toISOString().slice(0, 10),
    className: '5th', section: 'A', academicYear: '2025-26',
    admissionType: 'New', previousSchool: '', lastGradePassed: '', tcNumber: '',
    mediumOfInstruction: 'English',
    // health
    medicalConditions: '', allergies: '', emergencyName: '', emergencyContact: '',
    // transport / hostel
    usesBus: false, busRoute: '',
    inHostel: false, hostelRoom: '',
    // documents
    docs: { birth: '', aadhar: '', tc: '', caste: '', passport: '', other: '' },
    // other
    house: 'Red',
    siblings: '',
    specialNeeds: '',
  });
  const navigate = useNavigate();
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }));

  const onFile = (key) => (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => set(key, String(ev.target.result || ''));
    r.readAsDataURL(f);
  };
  const onDoc = (k) => (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => setData((d) => ({ ...d, docs: { ...d.docs, [k]: { name: f.name, dataURL: String(ev.target.result || '') } } }));
    r.readAsDataURL(f);
  };

  const submit = () => {
    if (!data.firstName || !data.lastName) { setStep(0); return toast.error('Name required'); }
    const admissionNo = newAdmissionNo();
    demoStore.add('students', {
      ...data,
      fullName: `${data.firstName} ${data.lastName}`,
      admissionNo,
      status: 'ACTIVE',
    });
    toast.success(`Admission created: ${admissionNo}`);
    navigate('/dashboard/students/directory');
  };

  const Field = ({ label, k, type = 'text', placeholder, full }) => (
    <div className={full ? 'col-span-full' : ''}>
      <label className="label-eyebrow text-muted-foreground">{label}</label>
      <input type={type} placeholder={placeholder} value={data[k] || ''} onChange={(e) => set(k, e.target.value)} className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-card outline-none focus:border-primary text-sm" data-testid={`adm-${k}`} />
    </div>
  );
  const Select = ({ label, k, options }) => (
    <div>
      <label className="label-eyebrow text-muted-foreground">{label}</label>
      <select value={data[k]} onChange={(e) => set(k, e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid={`adm-${k}`}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  const cur = STEPS[step];

  return (
    <div className="space-y-6 max-w-5xl" data-testid="admission-form-full">
      <NavLink to=".." className="label-eyebrow text-primary">← Back to Students</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Admission Form</h1>

      {/* Stepper */}
      <div className="flex gap-2 flex-wrap">
        {STEPS.map((s, i) => (
          <button key={s.k} onClick={() => setStep(i)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full label-eyebrow ${i === step ? 'bg-primary text-primary-foreground' : i < step ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`} data-testid={`step-${s.k}`}>
            {i < step ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}{s.label}
          </button>
        ))}
      </div>

      <div className="glass-morphism rounded-[2rem] p-6">
        {/* Personal */}
        {cur.k === 'personal' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="First Name" k="firstName" placeholder="Aarav" />
            <Field label="Last Name" k="lastName" placeholder="Sharma" />
            <Field label="Date of Birth" k="dateOfBirth" type="date" />
            <Select label="Gender" k="gender" options={['Male', 'Female', 'Other']} />
            <Select label="Blood Group" k="bloodGroup" options={['', 'A+','A-','B+','B-','O+','O-','AB+','AB-']} />
            <Field label="Aadhar Number" k="aadharNumber" placeholder="XXXX-XXXX-XXXX" />
            <Field label="Nationality" k="nationality" />
            <Field label="Religion" k="religion" />
            <Select label="Category" k="category" options={['General', 'OBC', 'SC', 'ST']} />
            <Field label="Mother Tongue" k="motherTongue" />
            <div className="col-span-full">
              <label className="label-eyebrow text-muted-foreground">Photo</label>
              <label className="mt-1.5 block border-2 border-dashed border-border rounded-2xl p-4 text-center cursor-pointer hover:border-primary">
                <input type="file" accept="image/*" onChange={onFile('photoURL')} className="hidden" data-testid="adm-photo" />
                {data.photoURL ? <img src={data.photoURL} alt="" className="h-24 w-24 object-cover mx-auto rounded-2xl" /> : <><Upload className="h-6 w-6 mx-auto text-muted-foreground" /><div className="label-eyebrow text-muted-foreground mt-1">Upload Photo</div></>}
              </label>
            </div>
          </div>
        )}

        {/* Contact */}
        {cur.k === 'contact' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Permanent Address" k="address" full />
            <label className="col-span-full flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={data.sameAsPermanent} onChange={(e) => set('sameAsPermanent', e.target.checked)} className="accent-indigo-500" data-testid="adm-sameAddress" />
              Current address is same as permanent
            </label>
            {!data.sameAsPermanent && <Field label="Current Address" k="currentAddress" full />}
            <Field label="City" k="city" />
            <Field label="State" k="state" />
            <Field label="PIN Code" k="pinCode" />
            <Field label="Phone Number" k="phoneNumber" placeholder="+91…" />
            <Field label="Email" k="email" type="email" />
          </div>
        )}

        {/* Parent */}
        {cur.k === 'parent' && (
          <div className="space-y-5">
            <div>
              <div className="label-eyebrow text-muted-foreground mb-3">Father's Details</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Name" k="fatherName" />
                <Field label="Occupation" k="fatherOccupation" />
                <Field label="Phone" k="fatherPhone" />
                <Field label="Email" k="fatherEmail" type="email" />
                <Field label="Aadhar" k="fatherAadhar" />
                <Field label="Annual Income (₹)" k="fatherIncome" type="number" />
              </div>
            </div>
            <div>
              <div className="label-eyebrow text-muted-foreground mb-3">Mother's Details</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Name" k="motherName" />
                <Field label="Occupation" k="motherOccupation" />
                <Field label="Phone" k="motherPhone" />
                <Field label="Email" k="motherEmail" type="email" />
                <Field label="Aadhar" k="motherAadhar" />
                <Field label="Annual Income (₹)" k="motherIncome" type="number" />
              </div>
            </div>
            <div>
              <div className="label-eyebrow text-muted-foreground mb-3">Guardian (if different)</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Name" k="guardianName" />
                <Field label="Relationship" k="guardianRelation" />
                <Field label="Phone" k="guardianPhone" />
              </div>
            </div>
          </div>
        )}

        {/* Admission */}
        {cur.k === 'admission' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Admission Date" k="admissionDate" type="date" />
            <Select label="Class" k="className" options={CLASS_OPTIONS} />
            <Select label="Section" k="section" options={SECTION_OPTIONS} />
            <Field label="Academic Year" k="academicYear" placeholder="2025-26" />
            <Select label="Admission Type" k="admissionType" options={['New', 'Transfer', 'Rejoining']} />
            <Field label="Previous School" k="previousSchool" />
            <Field label="Previous Class Passed" k="lastGradePassed" />
            <Field label="TC Number (if transfer)" k="tcNumber" />
            <Select label="Medium" k="mediumOfInstruction" options={['English', 'Hindi', 'Telugu', 'Regional']} />
            <Select label="House" k="house" options={['Red', 'Blue', 'Green', 'Yellow']} />
            <Field label="Siblings in school" k="siblings" placeholder="e.g. ADM20253142" />
          </div>
        )}

        {/* Health */}
        {cur.k === 'health' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Medical Conditions" k="medicalConditions" full />
            <Field label="Allergies" k="allergies" full />
            <Field label="Emergency Contact Name" k="emergencyName" />
            <Field label="Emergency Contact Phone" k="emergencyContact" />
            <Field label="Special Needs / Disability" k="specialNeeds" full />
          </div>
        )}

        {/* Transport / Hostel */}
        {cur.k === 'transport' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl border border-border">
              <label className="flex items-center gap-2 font-bold">
                <input type="checkbox" checked={data.usesBus} onChange={(e) => set('usesBus', e.target.checked)} className="accent-indigo-500" data-testid="adm-usesBus" />
                Student uses school bus
              </label>
              {data.usesBus && (
                <select value={data.busRoute} onChange={(e) => set('busRoute', e.target.value)} className="mt-3 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="adm-busRoute">
                  <option value="">Select route…</option>
                  {demoStore.list('transportRoutes').map((r) => <option key={r.id} value={r.code}>Route {r.code} · {r.stops.join(' → ')}</option>)}
                </select>
              )}
            </div>
            <div className="p-4 rounded-2xl border border-border">
              <label className="flex items-center gap-2 font-bold">
                <input type="checkbox" checked={data.inHostel} onChange={(e) => set('inHostel', e.target.checked)} className="accent-indigo-500" data-testid="adm-inHostel" />
                Student stays in hostel
              </label>
              {data.inHostel && (
                <select value={data.hostelRoom} onChange={(e) => set('hostelRoom', e.target.value)} className="mt-3 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="adm-hostelRoom">
                  <option value="">Select room…</option>
                  {demoStore.list('hostelRooms').filter((r) => r.occupied < r.capacity).map((r) => <option key={r.id} value={`${r.block}-${r.number}`}>Block {r.block} · Room {r.number} ({r.occupied}/{r.capacity})</option>)}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Documents */}
        {cur.k === 'documents' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { k: 'birth', label: 'Birth Certificate' },
              { k: 'aadhar', label: 'Aadhar Card' },
              { k: 'tc', label: 'Previous TC' },
              { k: 'caste', label: 'Caste Certificate' },
              { k: 'passport', label: 'Passport Photo' },
              { k: 'other', label: 'Other' },
            ].map((d) => (
              <label key={d.k} className="block border-2 border-dashed border-border rounded-2xl p-4 cursor-pointer hover:border-primary">
                <input type="file" onChange={onDoc(d.k)} className="hidden" data-testid={`doc-${d.k}`} />
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 grid place-items-center"><Upload className="h-4 w-4 text-primary" /></div>
                  <div className="flex-1">
                    <div className="font-bold text-sm">{d.label}</div>
                    <div className="label-eyebrow text-muted-foreground">{data.docs[d.k]?.name || 'Click to upload'}</div>
                  </div>
                  {data.docs[d.k] && <Check className="h-4 w-4 text-emerald-500" />}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between gap-3">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="h-11 px-5 rounded-2xl bg-muted label-eyebrow disabled:opacity-40" data-testid="adm-back-btn">Back</button>
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep((s) => s + 1)} className="h-11 px-5 rounded-2xl bg-primary text-primary-foreground label-eyebrow" data-testid="adm-next-btn">Next →</button>
        ) : (
          <button onClick={submit} className="h-11 px-5 rounded-2xl bg-emerald-500 text-white label-eyebrow" data-testid="adm-submit-btn">Submit Admission</button>
        )}
      </div>
    </div>
  );
}

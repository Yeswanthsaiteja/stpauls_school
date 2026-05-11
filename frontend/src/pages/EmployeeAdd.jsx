import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import { Upload, Check } from 'lucide-react';
import { demoStore } from '../services/demoStore';
import { CLASS_OPTIONS } from '../lib/pdfUtils';
import { toast } from 'sonner';

const ROLES = ['Teacher', 'Class Teacher', 'Principal', 'Vice Principal', 'Accountant', 'Librarian', 'Lab Assistant', 'Administrative', 'Support Staff'];
const DEPARTMENTS = ['Primary', 'Secondary', 'Commerce', 'Science', 'Arts', 'Administration', 'Other'];
const EMP_TYPES = ['Permanent', 'Contract', 'Part-time'];

export default function EmployeeAdd() {
  const [form, setForm] = useState({
    fullName: '', employeeId: `EMP${String(demoStore.list('employees').length + 1).padStart(3, '0')}`,
    dateOfBirth: '', gender: 'Male', phoneNumber: '', email: '', address: '',
    aadharNumber: '', panNumber: '', dateOfJoining: new Date().toISOString().slice(0, 10),
    employmentType: 'Permanent', role: 'Teacher', department: 'Primary',
    subjects: '', classes: '', classTeacherOf: '',
    qualification: '', specialization: '', institution: '', qualYear: '',
    experience: 0, previousSchool: '',
    bankAccount: '', bankName: '', ifsc: '',
    basicSalary: 0, photoURL: '',
  });
  const navigate = useNavigate();
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onPhoto = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = (ev) => set('photoURL', String(ev.target.result || '')); r.readAsDataURL(f);
  };

  const submit = () => {
    if (!form.fullName) return toast.error('Name required');
    demoStore.add('employees', { ...form, status: 'ACTIVE' });
    toast.success(`Employee ${form.employeeId} created`);
    navigate('/dashboard/employees');
  };

  const Field = ({ label, k, type = 'text', placeholder, full }) => (
    <div className={full ? 'col-span-full' : ''}>
      <label className="label-eyebrow text-muted-foreground">{label}</label>
      <input type={type} placeholder={placeholder} value={form[k] || ''} onChange={(e) => set(k, e.target.value)} className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm outline-none focus:border-primary" data-testid={`emp-${k}`} />
    </div>
  );
  const Select = ({ label, k, options }) => (
    <div>
      <label className="label-eyebrow text-muted-foreground">{label}</label>
      <select value={form[k]} onChange={(e) => set(k, e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid={`emp-${k}`}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl" data-testid="employee-add">
      <NavLink to="/dashboard/employees" className="label-eyebrow text-primary">← Back to Employees</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Add Employee</h1>

      <div className="glass-morphism rounded-[2rem] p-6 space-y-5">
        <div>
          <div className="label-eyebrow text-muted-foreground mb-3">Identification</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Full Name" k="fullName" />
            <Field label="Employee ID" k="employeeId" />
            <Field label="Date of Birth" k="dateOfBirth" type="date" />
            <Select label="Gender" k="gender" options={['Male', 'Female', 'Other']} />
            <Field label="Phone" k="phoneNumber" />
            <Field label="Email" k="email" type="email" />
            <Field label="Aadhar" k="aadharNumber" />
            <Field label="PAN" k="panNumber" />
            <Field label="Address" k="address" full />
          </div>
        </div>

        <div>
          <div className="label-eyebrow text-muted-foreground mb-3">Role & Department</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Date of Joining" k="dateOfJoining" type="date" />
            <Select label="Employment Type" k="employmentType" options={EMP_TYPES} />
            <Select label="Role" k="role" options={ROLES} />
            <Select label="Department" k="department" options={DEPARTMENTS} />
            <Field label="Subjects (comma)" k="subjects" placeholder="Math, Science" />
            <Field label="Classes (comma)" k="classes" placeholder="5th, 6th" />
            <Field label="Class Teacher Of" k="classTeacherOf" placeholder="5-A" />
            <Field label="Experience (yrs)" k="experience" type="number" />
            <Field label="Previous School" k="previousSchool" />
          </div>
        </div>

        <div>
          <div className="label-eyebrow text-muted-foreground mb-3">Qualification</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Field label="Degree" k="qualification" />
            <Field label="Specialization" k="specialization" />
            <Field label="Institution" k="institution" />
            <Field label="Year" k="qualYear" type="number" />
          </div>
        </div>

        <div>
          <div className="label-eyebrow text-muted-foreground mb-3">Bank & Salary</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Field label="Bank Account No." k="bankAccount" />
            <Field label="Bank & Branch" k="bankName" />
            <Field label="IFSC" k="ifsc" />
            <Field label="Basic Salary (₹)" k="basicSalary" type="number" />
          </div>
        </div>

        <div>
          <div className="label-eyebrow text-muted-foreground mb-3">Photo</div>
          <label className="block border-2 border-dashed border-border rounded-2xl p-4 cursor-pointer hover:border-primary text-center">
            <input type="file" accept="image/*" onChange={onPhoto} className="hidden" data-testid="emp-photo" />
            {form.photoURL ? <img src={form.photoURL} alt="" className="h-24 w-24 object-cover mx-auto rounded-2xl" /> : <><Upload className="h-6 w-6 mx-auto text-muted-foreground" /><div className="label-eyebrow text-muted-foreground mt-1">Upload Photo</div></>}
          </label>
        </div>

        <button onClick={submit} className="h-11 px-5 rounded-2xl bg-emerald-500 text-white label-eyebrow flex items-center gap-2" data-testid="emp-submit"><Check className="h-3.5 w-3.5" />Create Employee</button>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import { Upload, Check, Loader2 } from 'lucide-react';
import { addEmployee, listEmployees } from '../services/firebase/employeesService';
import { logActivity } from '../services/firebase/activityService';
import { toast } from 'sonner';

const ROLES = ['Teacher', 'Class Teacher', 'Principal', 'Vice Principal', 'Accountant', 'Librarian', 'Lab Assistant', 'Administrative', 'Support Staff'];
const DEPARTMENTS = ['Teaching', 'Non teaching', 'Administration'];
const EMP_TYPES = ['Probation', 'Permanent', 'Contract'];
const AVAILABLE_MODULES = [
  { key: 'students', label: 'Students' },
  { key: 'academic', label: 'Academic' },
  { key: 'finance', label: 'Finance' },
  { key: 'employees', label: 'Employees' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'communication', label: 'Communication' },
  { key: 'crm', label: 'CRM / Support' },
  { key: 'transport', label: 'Transport' },
  { key: 'hostel', label: 'Hostel' },
  { key: 'library', label: 'Library' }
];

// ─── Field & Select MUST live outside the parent component so React doesn't
//     treat them as a new component type on every render (which causes remount
//     and focus loss after every keystroke).
function Field({ label, k, type = 'text', placeholder, full, value, onChange }) {
  return (
    <div className={full ? 'col-span-full' : ''}>
      <label className="label-eyebrow text-muted-foreground">{label}</label>
      <input
        id={`emp-field-${k}`}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete="off"
        className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm outline-none focus:border-primary transition-colors"
        data-testid={`emp-${k}`}
      />
    </div>
  );
}

function SelectField({ label, k, options, value, onChange }) {
  return (
    <div>
      <label className="label-eyebrow text-muted-foreground">{label}</label>
      <select
        id={`emp-select-${k}`}
        value={value}
        onChange={onChange}
        className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm"
        data-testid={`emp-${k}`}
      >
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

export default function EmployeeAdd() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: '', employeeId: '',
    dateOfBirth: '', gender: 'Male', phoneNumber: '', email: '', address: '',
    aadharNumber: '', panNumber: '', dateOfJoining: new Date().toISOString().slice(0, 10),
    employmentType: 'Permanent', role: 'Teacher', department: 'Primary',
    subjectsTaught: '',
    qualification: '', specialization: '', institution: '', qualYear: '',
    experience: 0, previousSchool: '',
    bankAccount: '', bankName: '', ifsc: '',
    basicSalary: 0, photoURL: '',
    permissions: [],
  });
  const navigate = useNavigate();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onPhoto = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = (ev) => setForm(prev => ({ ...prev, photoURL: String(ev.target.result || '') })); r.readAsDataURL(f);
  };

  const submit = async () => {
    if (!form.fullName.trim()) return toast.error('Full Name is required');
    if (!form.phoneNumber.trim()) return toast.error('Phone number is required');

    // Strict 10-digit phone number validation
    const phoneDigits = form.phoneNumber.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      return toast.error('Please enter a valid 10-digit mobile number');
    }

    if (!form.dateOfBirth) return toast.error('Date of Birth is required');
    if (!form.gender) return toast.error('Gender is required');
    if (!form.address.trim()) return toast.error('Address is required');
    if (!form.dateOfJoining) return toast.error('Date of Joining is required');
    if (!form.employmentType) return toast.error('Employment Type is required');
    if (!form.role) return toast.error('Role is required');
    if (!form.department) return toast.error('Department is required');

    if (saving) return; setSaving(true);
    try {
      // Retrieve list of all employees to check for duplicates
      const existing = await listEmployees();
      const normPhone = phoneDigits;
      
      const duplicatePhone = existing.find(e => {
        const p = (e.phoneNumber || '').replace(/\D/g, '');
        return p === normPhone || p.slice(-10) === normPhone;
      });
      
      if (duplicatePhone) {
        toast.error(`Phone number ${form.phoneNumber} already exists in database for employee ${duplicatePhone.fullName}`);
        setSaving(false);
        return;
      }
      
      if (form.email && form.email.trim()) {
        const emailLower = form.email.trim().toLowerCase();
        const duplicateEmail = existing.find(e => (e.email || '').trim().toLowerCase() === emailLower);
        if (duplicateEmail) {
          toast.error(`Email ${form.email} already exists in database for employee ${duplicateEmail.fullName}`);
          setSaving(false);
          return;
        }
      }

      const emp = await addEmployee({ ...form, designation: form.role, status: 'ACTIVE' });
      toast.success(`Employee ${emp?.employeeId || form.fullName} created`);
      
      // Log system activity & alert admin
      await logActivity({
        type: 'employee',
        text: `New employee appointed · ${form.fullName} joined as ${form.role}`,
      });

      navigate('/dashboard/employees');
    } catch (e) {
      console.error(e);
      toast.error('Failed to create employee. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl" data-testid="employee-add">
      <NavLink to="/dashboard/employees" className="label-eyebrow text-primary">← Back to Employees</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Add Employee</h1>

      <form autoComplete="off" onSubmit={e => e.preventDefault()} className="glass-morphism rounded-[2rem] p-6 space-y-5">

        {/* ── Identification ── */}
        <div>
          <div className="label-eyebrow text-muted-foreground mb-3 font-semibold">Identification (Fields marked * are required)</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Full Name *" k="fullName" value={form.fullName} onChange={set('fullName')} />
            <Field label="Employee ID" k="employeeId" placeholder="Auto-generated if blank" value={form.employeeId} onChange={set('employeeId')} />
            <Field label="Date of Birth *" k="dateOfBirth" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
            <SelectField label="Gender *" k="gender" options={['Male', 'Female', 'Other']} value={form.gender} onChange={set('gender')} />
            <Field label="Phone *" k="phoneNumber" value={form.phoneNumber} onChange={set('phoneNumber')} />
            <Field label="Email" k="email" type="email" value={form.email} onChange={set('email')} />
            <Field label="Aadhar" k="aadharNumber" value={form.aadharNumber} onChange={set('aadharNumber')} />
            <Field label="PAN" k="panNumber" value={form.panNumber} onChange={set('panNumber')} />
            <Field label="Address *" k="address" full value={form.address} onChange={set('address')} />
          </div>
        </div>

        {/* ── Role & Department ── */}
        <div>
          <div className="label-eyebrow text-muted-foreground mb-3 font-semibold">Role & Department</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Date of Joining *" k="dateOfJoining" type="date" value={form.dateOfJoining} onChange={set('dateOfJoining')} />
            <SelectField label="Employment Type *" k="employmentType" options={EMP_TYPES} value={form.employmentType} onChange={set('employmentType')} />
            <SelectField label="Role *" k="role" options={ROLES} value={form.role} onChange={set('role')} />
            <SelectField label="Department *" k="department" options={DEPARTMENTS} value={form.department} onChange={set('department')} />
            <Field label="Subjects Taught" k="subjectsTaught" placeholder="e.g. Maths, Science, Telugu" value={form.subjectsTaught} onChange={set('subjectsTaught')} />
            <Field label="Experience (yrs)" k="experience" type="number" value={form.experience} onChange={set('experience')} />
            <Field label="Previous School" k="previousSchool" value={form.previousSchool} onChange={set('previousSchool')} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            ℹ️ Classes & subjects are auto-derived from Academic → Classes & Subjects. No need to enter them here.
          </p>
        </div>

        {/* ── Permissions ── */}
        <div>
          <div className="label-eyebrow text-muted-foreground mb-3 font-semibold">Additional Module Permissions</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {AVAILABLE_MODULES.map(m => {
              const isSelected = form.permissions.includes(m.key);
              return (
                <label key={m.key} className="flex items-center gap-2 cursor-pointer group">
                  <div className={`h-5 w-5 rounded border grid place-items-center transition-colors ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-card group-hover:border-primary'}`}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <span className="text-sm select-none">{m.label}</span>
                  <input type="checkbox" className="hidden"
                    checked={isSelected}
                    onChange={(e) => {
                      const p = form.permissions;
                      setForm({ ...form, permissions: e.target.checked ? [...p, m.key] : p.filter(k => k !== m.key) });
                    }}
                  />
                </label>
              );
            })}
          </div>
        </div>

        {/* ── Qualification ── */}
        <div>
          <div className="label-eyebrow text-muted-foreground mb-3">Qualification</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Field label="Degree" k="qualification" value={form.qualification} onChange={set('qualification')} />
            <Field label="Specialization" k="specialization" value={form.specialization} onChange={set('specialization')} />
            <Field label="Institution" k="institution" value={form.institution} onChange={set('institution')} />
            <Field label="Year" k="qualYear" type="number" value={form.qualYear} onChange={set('qualYear')} />
          </div>
        </div>

        {/* ── Bank & Salary ── */}
        <div>
          <div className="label-eyebrow text-muted-foreground mb-3">Bank & Salary</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Field label="Bank Account No." k="bankAccount" value={form.bankAccount} onChange={set('bankAccount')} />
            <Field label="Bank & Branch" k="bankName" value={form.bankName} onChange={set('bankName')} />
            <Field label="IFSC" k="ifsc" value={form.ifsc} onChange={set('ifsc')} />
            <Field label="Basic Salary (₹)" k="basicSalary" type="number" value={form.basicSalary} onChange={set('basicSalary')} />
          </div>
        </div>

        {/* ── Photo ── */}
        <div>
          <div className="label-eyebrow text-muted-foreground mb-3">Photo</div>
          <label className="block border-2 border-dashed border-border rounded-2xl p-4 cursor-pointer hover:border-primary text-center transition-colors">
            <input type="file" accept="image/*" onChange={onPhoto} className="hidden" data-testid="emp-photo" />
            {form.photoURL
              ? <img src={form.photoURL} alt="" className="h-24 w-24 object-cover mx-auto rounded-2xl" />
              : <><Upload className="h-6 w-6 mx-auto text-muted-foreground" /><div className="label-eyebrow text-muted-foreground mt-1">Upload Photo</div></>
            }
          </label>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="h-11 px-6 rounded-2xl bg-emerald-500 text-white label-eyebrow flex items-center gap-2 disabled:opacity-60 hover:bg-emerald-600 transition-colors"
          data-testid="emp-submit"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Create Employee
        </button>
      </form>
    </div>
  );
}

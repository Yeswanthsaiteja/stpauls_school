import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import { Upload, Check, Loader2 } from 'lucide-react';
import { addEmployee, listEmployees } from '../services/firebase/employeesService';
import { logActivity } from '../services/firebase/activityService';
import { toast } from 'sonner';
import { uploadToStorage } from '../lib/storageUtils';

const ROLES = ['Teacher', 'Class Teacher', 'Principal', 'Vice Principal', 'Accountant', 'Librarian', 'Lab Assistant', 'Administrative', 'Support Staff'];
const DEPARTMENTS = ['Teaching', 'Non teaching', 'Administration'];
const EMP_TYPES = ['Probation', 'Permanent', 'Contract'];
const AVAILABLE_MODULES = [
  { 
    key: 'students', label: 'Students', 
    submodules: [
      {key: 'students.directory', label: 'Directory'}, 
      {key: 'students.admission-full', label: 'Admission'}, 
      {key: 'students.removal', label: 'Removal'}, 
      {key: 'students.edit', label: 'Edit Student'}, 
      {key: 'students.certificates', label: 'Certificates'},
      {key: 'bulk-import', label: 'Import Data'},
      {key: 'students.houses', label: 'House Assignment'},
      {key: 'students.rejoin', label: 'Rejoin'}
    ] 
  },
  { 
    key: 'academic', label: 'Academic', 
    submodules: [
      {key: 'academic.classes', label: 'Classes & Sections'}, 
      {key: 'academic.subject-topics', label: 'Subject Topics'},
      {key: 'academic.timetable', label: 'Timetable'},
      {key: 'academic.marks-entry', label: 'Marks Entry'},
      {key: 'academic.results-sheet', label: 'Results Sheet'},
      {key: 'academic.exam-setup', label: 'Exam Scheduling'}, 
      {key: 'academic.result-scheduling', label: 'Result Scheduling'}, 
      {key: 'academic.lesson-planning', label: 'Lesson Planning'},
      {key: 'academic.year-end-promotion', label: 'Year-End Promotion'}
    ] 
  },
  { 
    key: 'finance', label: 'Finance', 
    submodules: [
      {key: 'finance.setup', label: 'Fee Setup'}, 
      {key: 'finance.collect', label: 'Collection'}, 
      {key: 'finance.defaulters', label: 'Defaulters'}, 
      {key: 'finance.status', label: 'Status'}, 
      {key: 'finance.payroll', label: 'Payroll'}, 
      {key: 'finance.ledger', label: 'Ledger'}
    ] 
  },
  { 
    key: 'employees', label: 'Employees', 
    submodules: [
      {key: 'employees.directory', label: 'Directory'}, 
      {key: 'employees.add', label: 'Add Employee'}, 
      {key: 'employees.removal', label: 'Removal'}, 
      {key: 'employees.rejoin', label: 'Rejoin'}
    ] 
  },
  { key: 'attendance', label: 'Attendance', submodules: [] },
  { key: 'communication', label: 'Communication', submodules: [] },
  { key: 'crm', label: 'CRM / Support', submodules: [] },
  { key: 'transport', label: 'Transport', submodules: [] },
  { key: 'hostel', label: 'Hostel', submodules: [] },
  { key: 'library', label: 'Library', submodules: [] },
  { key: 'idcards', label: 'ID Cards', submodules: [] }
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
  const [photoFile, setPhotoFile] = useState(null);
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
    rfidNo: '',
    shiftStartTime: '09:00', shiftEndTime: '17:00',
  });
  const navigate = useNavigate();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onPhoto = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setPhotoFile(f);
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

      let finalPhotoURL = form.photoURL;
      if (photoFile) {
        const ext = photoFile.name.split('.').pop() || 'jpg';
        const path = `staff-photos/${form.phoneNumber}_${Date.now()}.${ext}`;
        finalPhotoURL = await uploadToStorage(photoFile, path);
      }

      const emp = await addEmployee({ ...form, designation: form.role, status: 'ACTIVE', photoURL: finalPhotoURL });
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {AVAILABLE_MODULES.map(m => {
              const isModuleSelected = form.permissions.includes(m.key);
              return (
                <div key={m.key} className="bg-card border border-border p-3 rounded-2xl">
                  <label className="flex items-center gap-2 cursor-pointer group mb-2">
                    <div className={`h-5 w-5 rounded border grid place-items-center transition-colors ${isModuleSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-card group-hover:border-primary'}`}>
                      {isModuleSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="font-bold text-sm select-none">{m.label}</span>
                    <input type="checkbox" className="hidden"
                      checked={isModuleSelected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        let p = form.permissions.filter(k => k !== m.key && !(m.submodules || []).some(sub => sub.key === k));
                        if (checked) {
                          p.push(m.key);
                        }
                        setForm({ ...form, permissions: p });
                      }}
                    />
                  </label>
                  {(m.submodules && m.submodules.length > 0) && (
                    <div className="pl-7 space-y-2 border-l-2 border-border ml-2.5 mt-2">
                      {m.submodules.map(sub => {
                        // If parent module is selected, all submodules are implicitly active
                        const isSubSelected = isModuleSelected || form.permissions.includes(sub.key);
                        return (
                          <label key={sub.key} className={`flex items-center gap-2 cursor-pointer group ${isModuleSelected ? 'opacity-60 cursor-default' : ''}`}>
                            <div className={`h-4 w-4 rounded border grid place-items-center transition-colors ${isSubSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-card group-hover:border-primary'}`}>
                              {isSubSelected && <Check className="h-2.5 w-2.5" />}
                            </div>
                            <span className="text-xs select-none">{sub.label}</span>
                            <input type="checkbox" className="hidden"
                              disabled={isModuleSelected}
                              checked={isSubSelected}
                              onChange={(e) => {
                                if (isModuleSelected) return;
                                const p = form.permissions;
                                setForm({ ...form, permissions: e.target.checked ? [...p, sub.key] : p.filter(k => k !== sub.key) });
                              }}
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
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

        {/* ── Biometric & Shift Timing ── */}
        <div>
          <div className="label-eyebrow text-muted-foreground mb-3 font-semibold">🔒 Biometric & Shift Timing</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="RFID No. (Biometric)" k="rfidNo" placeholder="e.g. 9568912" value={form.rfidNo} onChange={set('rfidNo')} />
            <Field label="Shift Start Time" k="shiftStartTime" type="time" value={form.shiftStartTime} onChange={set('shiftStartTime')} />
            <Field label="Shift End Time" k="shiftEndTime" type="time" value={form.shiftEndTime} onChange={set('shiftEndTime')} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            ℹ️ RFID No. must match exactly what is stored in the biometric machine. This is used to link punch data for attendance.
          </p>
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

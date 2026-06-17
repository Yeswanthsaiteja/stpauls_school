import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Loader2, X, Save, TrendingUp, Award, History,
  User, Briefcase, GraduationCap, Banknote, Phone, Mail,
  MapPin, ChevronRight, CheckCircle2, Edit3, IndianRupee,
  BookUser, UserMinus, RefreshCcw, LayoutGrid, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { listEmployees, updateEmployee } from '../services/firebase/employeesService';

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
const cardColor = (i) => ['from-indigo-500 to-violet-500', 'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500', 'from-rose-500 to-pink-500', 'from-cyan-500 to-blue-500'][i % 5];

// ─── Field helpers ─────────────────────────────────────────────────────────────
const Field = ({ label, name, value, onChange, type = 'text', placeholder, full }) => (
  <div className={full ? 'col-span-full' : ''}>
    <label className="label-eyebrow text-muted-foreground">{label}</label>
    <input type={type} name={name} placeholder={placeholder} value={value || ''}
      onChange={onChange}
      className="mt-1.5 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary" />
  </div>
);
const SelectField = ({ label, name, value, onChange, options }) => (
  <div>
    <label className="label-eyebrow text-muted-foreground">{label}</label>
    <select name={name} value={value || ''} onChange={onChange}
      className="mt-1.5 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary">
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  </div>
);

// ─── Employee Detail Panel ─────────────────────────────────────────────────────
function EmployeePanel({ emp, colorIdx, onClose, onSave }) {
  const [tab, setTab] = useState('profile');
  const [form, setForm] = useState({ ...emp });
  const [saving, setSaving] = useState(false);

  // Salary/promotion state
  const [salaryModal, setSalaryModal] = useState(null); // 'increase' | 'promote'
  const [salaryForm, setSalaryForm] = useState({ amount: '', percent: '', reason: '', newRole: emp.role || '', newSalary: '' });
  const [history, setHistory] = useState(emp.salaryHistory || []);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSaveEdit = async () => {
    if (saving) return; setSaving(true);
    try {
      await updateEmployee(emp.id, { ...form });
      toast.success('Employee details updated');
      onSave({ ...emp, ...form });
    } catch { toast.error('Failed to save changes'); }
    setSaving(false);
  };

  const handleSalaryAction = async () => {
    const currentSalary = Number(form.basicSalary || 0);
    let newSalary = currentSalary;
    let type = '';

    if (salaryModal === 'increase') {
      if (salaryForm.percent) newSalary = Math.round(currentSalary * (1 + Number(salaryForm.percent) / 100));
      else if (salaryForm.amount) newSalary = currentSalary + Number(salaryForm.amount);
      else return toast.error('Enter amount or percentage');
      type = 'Increment';
    } else if (salaryModal === 'promote') {
      if (!salaryForm.newRole) return toast.error('Select new role');
      newSalary = salaryForm.newSalary ? Number(salaryForm.newSalary) : currentSalary;
      type = 'Promotion';
    }

    if (newSalary < currentSalary && salaryModal === 'increase') return toast.error('New salary cannot be less');

    const entry = {
      date: new Date().toISOString().slice(0, 10),
      type, reason: salaryForm.reason || type,
      oldSalary: currentSalary, newSalary,
      oldRole: form.role || emp.role,
      newRole: salaryModal === 'promote' ? salaryForm.newRole : (form.role || emp.role),
    };

    const updatedHistory = [entry, ...history];
    const patch = {
      basicSalary: newSalary,
      salaryHistory: updatedHistory,
      ...(salaryModal === 'promote' ? { role: salaryForm.newRole, designation: salaryForm.newRole } : {}),
    };

    if (saving) return; setSaving(true);
    try {
      await updateEmployee(emp.id, patch);
      setHistory(updatedHistory);
      setForm(f => ({ ...f, basicSalary: newSalary, ...(salaryModal === 'promote' ? { role: salaryForm.newRole } : {}) }));
      toast.success(salaryModal === 'promote' ? `${emp.fullName} promoted to ${salaryForm.newRole}` : `Salary updated to ₹${newSalary.toLocaleString()}`);
      setSalaryModal(null);
      setSalaryForm({ amount: '', percent: '', reason: '', newRole: emp.role || '', newSalary: '' });
      onSave({ ...emp, ...form, ...patch });
    } catch { toast.error('Failed to update salary'); }
    setSaving(false);
  };

  const TABS = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'edit', label: 'Edit', icon: Edit3 },
    { id: 'salary', label: 'Salary & Promotion', icon: IndianRupee },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] bg-background border border-border shadow-2xl">

        {/* Header */}
        <div className={`p-6 bg-gradient-to-br ${cardColor(colorIdx)} text-white relative`}>
          <button onClick={onClose} className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/20 grid place-items-center">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white/20 grid place-items-center text-3xl font-black flex-shrink-0">
              {form.photoURL ? <img src={form.photoURL} alt="" className="h-full w-full object-cover rounded-2xl" /> : (form.fullName?.[0] || 'E')}
            </div>
            <div>
              <h2 className="font-display font-black text-2xl tracking-tighter">{form.fullName}</h2>
              <p className="text-white/80 text-sm">{form.role} · {form.department}</p>
              <p className="text-white/60 text-xs mt-0.5">{form.employeeId}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <div className="px-3 py-1.5 rounded-full bg-white/20 text-xs font-bold">₹{Number(form.basicSalary || 0).toLocaleString()}/mo</div>
            <div className="px-3 py-1.5 rounded-full bg-white/20 text-xs font-bold">{form.employmentType}</div>
            <div className="px-3 py-1.5 rounded-full bg-white/20 text-xs font-bold">{form.experience || 0} yrs exp</div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border bg-muted/30">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 label-eyebrow text-xs transition-all ${tab === t.id ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>
                <Icon className="h-3.5 w-3.5" />{t.label}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {/* ── Profile view ── */}
          {tab === 'profile' && (
            <div className="space-y-4">
              {[
                { icon: Phone, label: 'Phone', value: form.phoneNumber || form.phone },
                { icon: Mail, label: 'Email', value: form.email },
                { icon: MapPin, label: 'Address', value: form.address },
                { icon: Briefcase, label: 'Subjects', value: form.subjects },
                { icon: GraduationCap, label: 'Qualification', value: form.qualification && `${form.qualification}${form.specialization ? `, ${form.specialization}` : ''}` },
                { icon: Banknote, label: 'Bank', value: form.bankAccount && `${form.bankAccount} · ${form.bankName} · ${form.ifsc}` },
              ].filter(r => r.value).map((r, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-xl bg-muted grid place-items-center flex-shrink-0">
                    <r.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="label-eyebrow text-muted-foreground">{r.label}</div>
                    <div className="text-sm font-medium mt-0.5">{r.value}</div>
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3 mt-2">
                {[
                  { l: 'Joining Date', v: form.dateOfJoining },
                  { l: 'Class Teacher Of', v: form.classTeacherOf || '—' },
                  { l: 'Classes', v: form.classes || '—' },
                  { l: 'Prev. School', v: form.previousSchool || '—' },
                ].map((s, i) => (
                  <div key={i} className="p-3 rounded-2xl bg-muted/30">
                    <div className="label-eyebrow text-muted-foreground">{s.l}</div>
                    <div className="text-sm font-bold mt-1">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Edit form ── */}
          {tab === 'edit' && (
            <div className="space-y-5">
              <div>
                <div className="label-eyebrow text-muted-foreground mb-3">Personal Details</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Full Name" name="fullName" value={form.fullName} onChange={handleChange} full />
                  <Field label="Date of Birth" name="dateOfBirth" value={form.dateOfBirth} onChange={handleChange} type="date" />
                  <SelectField label="Gender" name="gender" value={form.gender} onChange={handleChange} options={['Male', 'Female', 'Other']} />
                  <Field label="Phone" name="phoneNumber" value={form.phoneNumber} onChange={handleChange} />
                  <Field label="Email" name="email" value={form.email} onChange={handleChange} type="email" />
                  <Field label="Aadhar" name="aadharNumber" value={form.aadharNumber} onChange={handleChange} />
                  <Field label="PAN" name="panNumber" value={form.panNumber} onChange={handleChange} />
                  <Field label="Address" name="address" value={form.address} onChange={handleChange} full />
                </div>
              </div>
              <div>
                <div className="label-eyebrow text-muted-foreground mb-3">Role & Assignment</div>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Role" name="role" value={form.role} onChange={handleChange} options={ROLES} />
                  <SelectField label="Department" name="department" value={form.department} onChange={handleChange} options={DEPARTMENTS} />
                  <SelectField label="Employment Type" name="employmentType" value={form.employmentType} onChange={handleChange} options={EMP_TYPES} />
                  <Field label="Date of Joining" name="dateOfJoining" value={form.dateOfJoining} onChange={handleChange} type="date" />
                  <Field label="Subjects" name="subjects" value={form.subjects} onChange={handleChange} placeholder="Math, Science" />
                  <Field label="Classes" name="classes" value={form.classes} onChange={handleChange} placeholder="5th, 6th" />
                  <Field label="Class Teacher Of" name="classTeacherOf" value={form.classTeacherOf} onChange={handleChange} placeholder="5-A" />
                  <Field label="Experience (yrs)" name="experience" value={form.experience} onChange={handleChange} type="number" />
                  <Field label="Previous School" name="previousSchool" value={form.previousSchool} onChange={handleChange} />
                </div>
              </div>
              <div>
                <div className="label-eyebrow text-muted-foreground mb-3">Qualification</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Degree" name="qualification" value={form.qualification} onChange={handleChange} />
                  <Field label="Specialization" name="specialization" value={form.specialization} onChange={handleChange} />
                  <Field label="Institution" name="institution" value={form.institution} onChange={handleChange} />
                  <Field label="Year" name="qualYear" value={form.qualYear} onChange={handleChange} type="number" />
                </div>
              </div>
              <div>
                <div className="label-eyebrow text-muted-foreground mb-3">Bank Details</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Account No." name="bankAccount" value={form.bankAccount} onChange={handleChange} />
                  <Field label="Bank & Branch" name="bankName" value={form.bankName} onChange={handleChange} />
                  <Field label="IFSC" name="ifsc" value={form.ifsc} onChange={handleChange} />
                  <Field label="Basic Salary (₹)" name="basicSalary" value={form.basicSalary} onChange={handleChange} type="number" />
                </div>
              </div>
              <div>
                <div className="label-eyebrow text-muted-foreground mb-3">🔒 Biometric & Shift Timing</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="RFID No. (Biometric)" name="rfidNo" value={form.rfidNo} onChange={handleChange} placeholder="e.g. 9568912" />
                  <Field label="Shift Start Time" name="shiftStartTime" value={form.shiftStartTime} onChange={handleChange} type="time" />
                  <Field label="Shift End Time" name="shiftEndTime" value={form.shiftEndTime} onChange={handleChange} type="time" />
                </div>
              </div>
              <div>
                <div className="label-eyebrow text-muted-foreground mb-3">Additional Module Permissions</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {AVAILABLE_MODULES.map(m => {
                    const isSelected = (form.permissions || []).includes(m.key);
                    return (
                      <label key={m.key} className="flex items-center gap-2 cursor-pointer group">
                        <div className={`h-5 w-5 rounded border grid place-items-center transition-colors ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-card group-hover:border-primary'}`}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <span className="text-sm select-none">{m.label}</span>
                        <input type="checkbox" className="hidden"
                          checked={isSelected}
                          onChange={(e) => {
                            const p = form.permissions || [];
                            setForm({ ...form, permissions: e.target.checked ? [...p, m.key] : p.filter(k => k !== m.key) });
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
              <button onClick={handleSaveEdit} disabled={saving}
                className="w-full py-3 rounded-2xl bg-primary text-primary-foreground label-eyebrow text-xs flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Changes
              </button>
            </div>
          )}

          {/* ── Salary & Promotion ── */}
          {tab === 'salary' && (
            <div className="space-y-4">
              {/* Current salary card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                <div className="label-eyebrow text-muted-foreground">Current Basic Salary</div>
                <div className="font-display font-black text-4xl tracking-tighter mt-1 text-emerald-600">
                  ₹{Number(form.basicSalary || 0).toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground ml-1">/ month</span>
                </div>
                <div className="label-eyebrow text-muted-foreground mt-2">Current Role: <span className="text-foreground">{form.role}</span></div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setSalaryModal('increase')}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white label-eyebrow text-xs">
                  <TrendingUp className="h-4 w-4" /> Increase Salary
                </button>
                <button onClick={() => setSalaryModal('promote')}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white label-eyebrow text-xs">
                  <Award className="h-4 w-4" /> Promote
                </button>
              </div>

              {/* Modal for Increase / Promote */}
              <AnimatePresence>
                {salaryModal && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="p-4 rounded-2xl border-2 border-primary/30 bg-muted/20 space-y-3">
                    <h3 className="font-bold text-sm">
                      {salaryModal === 'increase' ? '📈 Salary Increase' : '🏆 Promote Employee'}
                    </h3>

                    {salaryModal === 'increase' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="label-eyebrow text-muted-foreground">Increase by Amount (₹)</label>
                            <input type="number" placeholder="e.g. 5000"
                              value={salaryForm.amount} onChange={e => setSalaryForm(f => ({ ...f, amount: e.target.value, percent: '' }))}
                              className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-card text-sm outline-none" />
                          </div>
                          <div>
                            <label className="label-eyebrow text-muted-foreground">Or Increase by %</label>
                            <input type="number" placeholder="e.g. 10"
                              value={salaryForm.percent} onChange={e => setSalaryForm(f => ({ ...f, percent: e.target.value, amount: '' }))}
                              className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-card text-sm outline-none" />
                          </div>
                        </div>
                        {(salaryForm.amount || salaryForm.percent) && (
                          <div className="p-2 rounded-xl bg-emerald-500/10 text-sm text-emerald-700 font-bold">
                            New salary: ₹{salaryForm.percent
                              ? Math.round(Number(form.basicSalary || 0) * (1 + Number(salaryForm.percent) / 100)).toLocaleString()
                              : (Number(form.basicSalary || 0) + Number(salaryForm.amount || 0)).toLocaleString()
                            }
                          </div>
                        )}
                      </>
                    )}

                    {salaryModal === 'promote' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label-eyebrow text-muted-foreground">New Role / Designation</label>
                          <select value={salaryForm.newRole}
                            onChange={e => setSalaryForm(f => ({ ...f, newRole: e.target.value }))}
                            className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-card text-sm outline-none">
                            {ROLES.map(r => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label-eyebrow text-muted-foreground">New Salary (₹) (optional)</label>
                          <input type="number" placeholder={`Current: ${form.basicSalary}`}
                            value={salaryForm.newSalary} onChange={e => setSalaryForm(f => ({ ...f, newSalary: e.target.value }))}
                            className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-card text-sm outline-none" />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="label-eyebrow text-muted-foreground">Reason / Remarks</label>
                      <input type="text" placeholder="e.g. Annual increment, Performance bonus…"
                        value={salaryForm.reason} onChange={e => setSalaryForm(f => ({ ...f, reason: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-card text-sm outline-none" />
                    </div>

                    <div className="flex gap-2">
                      <button onClick={handleSalaryAction} disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground label-eyebrow text-xs disabled:opacity-60 flex items-center justify-center gap-2">
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        {salaryModal === 'increase' ? 'Apply Increment' : 'Apply Promotion'}
                      </button>
                      <button onClick={() => setSalaryModal(null)} className="px-4 rounded-xl bg-muted label-eyebrow text-xs">Cancel</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Salary history */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span className="label-eyebrow text-muted-foreground">Revision History</span>
                </div>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No salary revisions yet</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((h, i) => (
                      <div key={i} className="p-3 rounded-2xl border border-border">
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-1 rounded-full label-eyebrow text-[9px] ${h.type === 'Promotion' ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600'}`}>{h.type}</span>
                          <span className="label-eyebrow text-muted-foreground">{h.date}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground line-through">₹{Number(h.oldSalary).toLocaleString()}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-bold text-emerald-600">₹{Number(h.newSalary).toLocaleString()}</span>
                          {h.type === 'Promotion' && h.newRole !== h.oldRole && (
                            <span className="text-xs text-muted-foreground">· {h.oldRole} → {h.newRole}</span>
                          )}
                        </div>
                        {h.reason && <div className="text-xs text-muted-foreground mt-1">{h.reason}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Employees Module ────────────────────────────────────────────────────
export default function EmployeesModule() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const navigate = useNavigate();

  useEffect(() => {
    listEmployees().then((data) => { setList(data); setLoading(false); });
  }, []);

  const departments = ['ALL', ...new Set(list.map(e => e.department).filter(Boolean))];
  const filtered = list.filter(e => {
    const matchSearch = !search || (e.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.employeeId || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.phoneNumber || '').includes(search);
    const matchDept = filter === 'ALL' || e.department === filter;
    return matchSearch && matchDept;
  });

  const onSave = (updated) => setList(prev => prev.map(e => e.id === updated.id ? updated : e));

  const onDuty = list.filter(e => e.status === 'ACTIVE').length;

  return (
    <div className="space-y-6" data-testid="employees-module">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tighter uppercase">{t('humanCapital')}</h1>
        <button onClick={() => navigate('/dashboard/employees/add')}
          className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2" data-testid="emp-add-btn">
          <Plus className="h-3.5 w-3.5" />{t('addEmployee')}
        </button>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('directory'),  icon: BookUser,    color: 'from-indigo-500 to-violet-500', to: '/dashboard/employees/directory' },
          { label: t('addEmployee'), icon: Plus,       color: 'from-emerald-500 to-teal-500', to: '/dashboard/employees/add' },
          { label: t('removal'),    icon: UserMinus,   color: 'from-rose-500 to-pink-500',    to: '/dashboard/employees/removal' },
          { label: t('rejoin'),     icon: RefreshCcw,  color: 'from-amber-500 to-orange-500', to: '/dashboard/employees/rejoin' },
        ].map(a => {
          const Icon = a.icon;
          return (
            <motion.button key={a.label} whileHover={{ y: -4 }} onClick={() => navigate(a.to)}
              className={`glass-morphism rounded-[1.75rem] p-4 flex flex-col items-center gap-2 cursor-pointer`}>
              <div className={`h-10 w-10 rounded-2xl bg-gradient-to-br ${a.color} grid place-items-center text-white`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <span className="label-eyebrow text-xs">{a.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { l: t('active'), v: onDuty, c: 'text-emerald-500' },
          { l: t('inactive'), v: list.filter(e => e.status !== 'ACTIVE').length, c: 'text-amber-500' },
          { l: t('total'), v: list.length, c: 'text-indigo-500' },
        ].map((s, i) => (
          <motion.div whileHover={{ y: -5 }} key={i} className="glass-morphism rounded-[2rem] p-5">
            <div className="label-eyebrow text-muted-foreground">{s.l}</div>
            <div className={`font-display font-black text-4xl tracking-tighter mt-2 ${s.c}`}>{s.v}</div>
          </motion.div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="flex-1 min-w-48 px-4 py-2.5 rounded-2xl border-2 border-border bg-card text-sm outline-none focus:border-primary" />
        <div className="flex gap-1 bg-muted rounded-2xl p-1">
          {departments.slice(0, 5).map(d => (
            <button key={d} onClick={() => setFilter(d)}
              className={`px-3 py-1.5 rounded-xl label-eyebrow text-xs ${filter === d ? 'bg-background shadow' : 'text-muted-foreground'}`}>{d}</button>
          ))}
        </div>
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {/* Employee cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((e, i) => (
          <motion.div key={e.id} whileHover={{ y: -3 }}
            className="glass-morphism rounded-[1.75rem] p-4 flex items-center gap-3 cursor-pointer hover:border-primary border border-transparent transition-colors"
            onClick={() => { setSelected(e); setSelectedIdx(i); }}>
            <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${cardColor(i)} grid place-items-center text-white font-black flex-shrink-0 overflow-hidden`}>
              {e.photoURL ? <img src={e.photoURL} alt="" className="h-full w-full object-cover" /> : (e.fullName?.[0] || 'E')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">{e.fullName}</div>
              <div className="label-eyebrow text-muted-foreground truncate">{e.designation || e.role} · {e.department}</div>
              <div className="label-eyebrow text-muted-foreground">{e.phoneNumber || e.phone || '—'}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`px-2.5 py-1 rounded-full label-eyebrow text-[9px] ${e.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>{e.status || 'ACTIVE'}</span>
              {e.basicSalary && <span className="text-xs text-muted-foreground">₹{Number(e.basicSalary).toLocaleString()}</span>}
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && !loading && (
          <p className="col-span-full text-center text-muted-foreground py-8">No employees found</p>
        )}
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <EmployeePanel emp={selected} colorIdx={selectedIdx}
            onClose={() => setSelected(null)}
            onSave={updated => { onSave(updated); setSelected(updated); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

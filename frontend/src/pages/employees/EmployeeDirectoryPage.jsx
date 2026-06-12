import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutGrid, List, Search, Plus, Loader2, RefreshCw,
  Phone, Mail, Briefcase, X, Edit3, IndianRupee,
  Download, ChevronDown, FileText, FileSpreadsheet, File,
} from 'lucide-react';
import { toast } from 'sonner';
import { listEmployees, updateEmployee } from '../../services/firebase/employeesService';

// ─── Export helpers ────────────────────────────────────────────────────────────

function buildEmpRows(list) {
  return list.map((e, i) => ({
    '#': i + 1,
    'Employee ID': e.employeeId || '',
    'Full Name': e.fullName || '',
    'Designation': e.designation || e.role || '',
    'Department': e.department || '',
    'Employee Nature': e.employeeNature || e.employeeType || '',
    'Date of Birth': e.dateOfBirth || '',
    'Aadhar Number': e.aadharNumber || '',
    'PAN Number': e.panNumber || '',
    'Joining Date': e.dateOfJoining || '',
    'Phone Number': e.phoneNumber || e.phone || '',
    'Subjects': Array.isArray(e.subjects) ? e.subjects.join(', ') : (e.subjects || ''),
    'Qualification': e.qualification || '',
  }));
}

async function exportCSV(list, filename) {
  const rows = buildEmpRows(list);
  if (!rows.length) return toast.error('No data to export');
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV downloaded');
}

async function exportXLSX(list, filename) {
  const rows = buildEmpRows(list);
  if (!rows.length) return toast.error('No data to export');
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Employees');
  XLSX.writeFile(wb, filename);
  toast.success('Excel downloaded');
}

async function exportPDF(list, filename) {
  if (!list.length) return toast.error('No data to export');
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const rows = buildEmpRows(list);
  const headers = Object.keys(rows[0]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.setFontSize(14);
  pdf.text('Employee Directory — St. Pauls High School', 14, 14);
  pdf.setFontSize(9);
  pdf.text(`Exported: ${new Date().toLocaleString('en-IN')} · ${list.length} records`, 14, 20);
  autoTable(pdf, {
    startY: 25,
    head: [headers],
    body: rows.map(r => headers.map(h => r[h])),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  pdf.save(filename);
  toast.success('PDF downloaded');
}

function ExportDropdown({ list, prefix }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const ts = new Date().toISOString().slice(0, 10);
  const fn = (ext) => `${prefix}_${ts}.${ext}`;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} disabled={!list.length}
        className="h-10 px-4 rounded-2xl bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-bold flex items-center gap-2 disabled:opacity-50">
        <Download className="h-3.5 w-3.5" />Export<ChevronDown className="h-3 w-3" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 mt-1 w-44 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
            {[
              { label: 'PDF (.pdf)',     icon: FileText,        color: 'text-rose-500',    action: () => exportPDF(list,  fn('pdf'))  },
              { label: 'CSV (.csv)',     icon: File,            color: 'text-emerald-500', action: () => exportCSV(list,  fn('csv'))  },
              { label: 'Excel (.xlsx)', icon: FileSpreadsheet, color: 'text-blue-500',    action: () => exportXLSX(list, fn('xlsx')) },
            ].map(({ label, icon: Icon, color, action }) => (
              <button key={label} onClick={() => { action(); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left">
                <Icon className={`h-4 w-4 ${color}`} />{label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const DEPARTMENTS = ['All', 'Teaching', 'Non teaching', 'Administration'];
const ROLES = ['Teacher', 'Class Teacher', 'Principal', 'Vice Principal', 'Accountant', 'Librarian', 'Lab Assistant', 'Administrative', 'Support Staff'];
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
const cardGradient = (i) => ['from-indigo-500 to-violet-500', 'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500', 'from-rose-500 to-pink-500', 'from-cyan-500 to-blue-500'][i % 5];

const F = ({ label, name, value, onChange, type = 'text', span }) => (
  <div className={span ? 'col-span-2' : ''}>
    <label className="label-eyebrow text-muted-foreground">{label}</label>
    <input type={type} name={name} value={value || ''} onChange={onChange}
      className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary" />
  </div>
);

const S = ({ label, name, value, onChange, options }) => (
  <div>
    <label className="label-eyebrow text-muted-foreground">{label}</label>
    <select name={name} value={value || ''} onChange={onChange}
      className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary">
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  </div>
);

// ─── Employee Profile Modal ────────────────────────────────────────────────────
function ProfileModal({ emp, idx, onClose, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...emp });
  const [saving, setSaving] = useState(false);
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const save = async () => {
    if (saving) return; setSaving(true);
    try {
      await updateEmployee(emp.id, form);
      onUpdated({ ...emp, ...form });
      setEditing(false);
    } catch { }
    setSaving(false);
  };



  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
        className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] bg-background border border-border shadow-2xl">

        {/* Header */}
        <div className={`relative p-6 bg-gradient-to-br ${cardGradient(idx)} text-white`}>
          <button onClick={onClose} className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/20 grid place-items-center"><X className="h-4 w-4" /></button>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white/20 grid place-items-center text-3xl font-black overflow-hidden flex-shrink-0">
              {emp.photoURL ? <img src={emp.photoURL} alt="" className="h-full w-full object-cover" /> : (emp.fullName?.[0] || 'E')}
            </div>
            <div>
              <h2 className="font-display font-black text-2xl tracking-tighter">{emp.fullName}</h2>
              <p className="text-white/80 text-sm">{emp.designation || emp.role} · {emp.department}</p>
              <p className="text-white/60 text-xs mt-0.5">{emp.employeeId} · Joined {emp.dateOfJoining || '—'}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2 flex-wrap">
            {emp.basicSalary && <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-bold">₹{Number(emp.basicSalary).toLocaleString()}/mo</span>}
            <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-bold">{emp.employmentType || 'Permanent'}</span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${emp.status === 'ACTIVE' ? 'bg-emerald-400/30' : 'bg-rose-400/30'}`}>{emp.status}</span>
          </div>
        </div>

        <div className="p-5">
          {!editing ? (
            <>
              {/* View mode */}
              <div className="space-y-3">
                {[
                  { icon: Phone,   label: 'Phone',       value: emp.phoneNumber || emp.phone },
                  { icon: Mail,    label: 'Email',       value: emp.email },
                  { icon: Briefcase, label: 'Subjects',  value: emp.subjects },
                  { icon: Briefcase, label: 'Classes',   value: emp.classes },
                ].filter(r => r.value).map((r, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-muted grid place-items-center flex-shrink-0"><r.icon className="h-4 w-4 text-muted-foreground" /></div>
                    <div><div className="label-eyebrow text-muted-foreground">{r.label}</div><div className="text-sm font-medium">{r.value}</div></div>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {[
                    { l: 'Class Teacher Of', v: emp.classTeacherOf || '—' },
                    { l: 'Qualification', v: emp.qualification || '—' },
                    { l: 'Experience', v: emp.experience ? `${emp.experience} yrs` : '—' },
                    { l: 'Aadhar / PAN', v: [emp.aadharNumber, emp.panNumber].filter(Boolean).join(' / ') || '—' },
                    { l: 'Bank', v: emp.bankAccount ? `${emp.bankAccount} · ${emp.bankName || ''}` : '—' },
                    { l: 'Address', v: emp.address || '—' },
                  ].map((s, i) => (
                    <div key={i} className="p-3 rounded-2xl bg-muted/30">
                      <div className="label-eyebrow text-muted-foreground">{s.l}</div>
                      <div className="text-sm font-bold mt-1 truncate">{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => setEditing(true)}
                className="mt-4 w-full py-3 rounded-2xl bg-primary text-primary-foreground label-eyebrow text-xs flex items-center justify-center gap-2">
                <Edit3 className="h-3.5 w-3.5" /> Edit Details
              </button>
            </>
          ) : (
            /* Edit mode */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <F label="Full Name" name="fullName" span value={form.fullName} onChange={handleChange} />
                <F label="Phone" name="phoneNumber" value={form.phoneNumber} onChange={handleChange} />
                <F label="Email" name="email" type="email" value={form.email} onChange={handleChange} />
                <F label="Date of Birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} />
                <S label="Gender" name="gender" options={['Male', 'Female', 'Other']} value={form.gender} onChange={handleChange} />
                <F label="Address" name="address" span value={form.address} onChange={handleChange} />
                <S label="Role" name="role" options={ROLES} value={form.role} onChange={handleChange} />
                <S label="Department" name="department" options={DEPARTMENTS.slice(1)} value={form.department} onChange={handleChange} />
                <S label="Employment Type" name="employmentType" options={EMP_TYPES} value={form.employmentType} onChange={handleChange} />
                <F label="Date of Joining" name="dateOfJoining" type="date" value={form.dateOfJoining} onChange={handleChange} />
                <F label="Subjects" name="subjects" value={form.subjects} onChange={handleChange} />
                <F label="Classes" name="classes" value={form.classes} onChange={handleChange} />
                <F label="Class Teacher Of" name="classTeacherOf" value={form.classTeacherOf} onChange={handleChange} />
                <F label="Experience (yrs)" name="experience" type="number" value={form.experience} onChange={handleChange} />
                <F label="Qualification" name="qualification" value={form.qualification} onChange={handleChange} />
                <F label="Specialization" name="specialization" value={form.specialization} onChange={handleChange} />
                <F label="Bank Account" name="bankAccount" value={form.bankAccount} onChange={handleChange} />
                <F label="IFSC" name="ifsc" value={form.ifsc} onChange={handleChange} />
                <F label="Basic Salary (₹)" name="basicSalary" type="number" value={form.basicSalary} onChange={handleChange} />
                <F label="Aadhar" name="aadharNumber" value={form.aadharNumber} onChange={handleChange} />
                <F label="PAN" name="panNumber" value={form.panNumber} onChange={handleChange} />
              </div>
              
              <div className="mt-4 pt-4 border-t border-border">
                <label className="label-eyebrow text-muted-foreground block mb-3">Additional Module Permissions</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {AVAILABLE_MODULES.map(m => {
                    const isSelected = (form.permissions || []).includes(m.key);
                    return (
                      <label key={m.key} className="flex items-center gap-2 cursor-pointer group">
                        <div className={`h-5 w-5 rounded border grid place-items-center transition-colors ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-card group-hover:border-primary'}`}>
                          {isSelected && <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
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

              <div className="flex gap-2 mt-4">
                <button onClick={save} disabled={saving}
                  className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground label-eyebrow text-xs disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button onClick={() => { setEditing(false); setForm({ ...emp }); }}
                  className="px-5 rounded-2xl bg-muted label-eyebrow text-xs">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Directory ────────────────────────────────────────────────────────────
export default function EmployeeDirectoryPage() {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table'); // default: table
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('All');
  const [status, setStatus] = useState('ACTIVE');
  const [selected, setSelected] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const navigate = useNavigate();

  const load = () => { setLoading(true); listEmployees().then(d => { setAll(d); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const list = useMemo(() => all.filter(e => {
    const matchQ = !q || `${e.fullName} ${e.employeeId} ${e.phoneNumber || ''}`.toLowerCase().includes(q.toLowerCase());
    const matchD = dept === 'All' || e.department === dept;
    const matchS = !status || e.status === status;
    return matchQ && matchD && matchS;
  }), [all, q, dept, status]);

  const exportPrefix = `Employees_${dept !== 'All' ? dept : 'All'}_${status || 'All'}`;

  return (
    <div className="space-y-5" data-testid="employee-directory-page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <NavLink to="/dashboard/employees" className="label-eyebrow text-primary">← Back</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-2">Employee Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">{loading ? 'Loading…' : `${list.length} of ${all.length} employees`}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="h-10 w-10 rounded-2xl bg-muted grid place-items-center"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <div className="flex bg-muted rounded-full p-1">
            <button onClick={() => setView('table')} className={`px-3 py-1.5 rounded-full ${view === 'table' ? 'bg-background shadow' : ''}`} title="Table view"><List className="h-3.5 w-3.5" /></button>
            <button onClick={() => setView('grid')} className={`px-3 py-1.5 rounded-full ${view === 'grid' ? 'bg-background shadow' : ''}`} title="Grid view"><LayoutGrid className="h-3.5 w-3.5" /></button>
          </div>
          <ExportDropdown list={list} prefix={exportPrefix} />
          <button onClick={() => navigate('/dashboard/employees/add')}
            className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2">
            <Plus className="h-3.5 w-3.5" />Add Employee
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-morphism rounded-[2rem] p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2 md:col-span-2 flex items-center gap-2 px-3 h-10 rounded-2xl border border-border bg-card">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Name, ID or phone…" className="flex-1 bg-transparent outline-none text-sm" />
        </div>
        <select value={dept} onChange={e => setDept(e.target.value)}
          className="h-10 px-3 rounded-2xl border border-border bg-card text-sm outline-none">
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="h-10 px-3 rounded-2xl border border-border bg-card text-sm outline-none">
          <option value="ACTIVE">Active Only</option>
          <option value="">All Statuses</option>
          <option value="REMOVED">Removed</option>
        </select>
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {/* Grid view */}
      {view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((e, i) => (
            <motion.div key={e.id} whileHover={{ y: -3 }}
              className="glass-morphism rounded-[1.75rem] p-4 flex items-center gap-3 cursor-pointer hover:border-primary border border-transparent transition-colors"
              onClick={() => { setSelected(e); setSelectedIdx(i); }}>
              <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${cardGradient(i)} grid place-items-center text-white font-black flex-shrink-0 overflow-hidden`}>
                {e.photoURL ? <img src={e.photoURL} alt="" className="h-full w-full object-cover" /> : (e.fullName?.[0] || 'E')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{e.fullName}</div>
                <div className="label-eyebrow text-muted-foreground truncate">{e.designation || e.role} · {e.department}</div>
                <div className="label-eyebrow text-muted-foreground">{e.phoneNumber || e.phone || '—'}</div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`px-2.5 py-1 rounded-full label-eyebrow text-[9px] ${e.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>{e.status || 'ACTIVE'}</span>
                {e.basicSalary && <span className="text-[10px] text-muted-foreground">₹{Number(e.basicSalary).toLocaleString()}</span>}
              </div>
            </motion.div>
          ))}
          {!loading && list.length === 0 && <p className="col-span-full text-center text-muted-foreground py-8">No employees found</p>}
        </div>
      )}

      {/* Table view */}
      {view === 'table' && (
        <div className="glass-morphism rounded-[2rem] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  {[
                    { label: '#',               cls: 'w-10' },
                    { label: 'Full Name',        cls: 'min-w-[160px]' },
                    { label: 'Employee ID',      cls: 'min-w-[120px]' },
                    { label: 'Designation',      cls: 'min-w-[140px]' },
                    { label: 'Department',       cls: 'min-w-[120px]' },
                    { label: 'Employee Nature',  cls: 'min-w-[120px]' },
                    { label: 'Date of Birth',    cls: 'min-w-[110px]' },
                    { label: 'Aadhar No',        cls: 'min-w-[130px]' },
                    { label: 'PAN No',           cls: 'min-w-[110px]' },
                    { label: 'Joining Date',     cls: 'min-w-[110px]' },
                    { label: 'Phone No',         cls: 'min-w-[120px]' },
                    { label: 'Subjects',         cls: 'min-w-[140px]' },
                    { label: 'Qualification',    cls: 'min-w-[120px]' },
                  ].map(({ label, cls: c }) => (
                    <th key={label} className={`px-4 py-3 text-left label-eyebrow text-muted-foreground font-semibold ${c}`}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((e, i) => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => { setSelected(e); setSelectedIdx(i); }}>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-bold flex items-center gap-2">
                      <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${cardGradient(i)} grid place-items-center text-white font-black text-xs flex-shrink-0 overflow-hidden`}>
                        {e.photoURL ? <img src={e.photoURL} alt="" className="h-full w-full object-cover" /> : (e.fullName?.[0] || 'E')}
                      </div>
                      <span className="truncate max-w-[130px]">{e.fullName}</span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-xs">{e.employeeId || '—'}</td>
                    <td className="px-4 py-3">{e.designation || e.role || '—'}</td>
                    <td className="px-4 py-3">{e.department || '—'}</td>
                    <td className="px-4 py-3">{e.employeeNature || e.employeeType || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{e.dateOfBirth || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{e.aadharNumber || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{e.panNumber || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{e.dateOfJoining || '—'}</td>
                    <td className="px-4 py-3">{e.phoneNumber || e.phone || '—'}</td>
                    <td className="px-4 py-3 text-xs">{Array.isArray(e.subjects) ? e.subjects.join(', ') : (e.subjects || '—')}</td>
                    <td className="px-4 py-3 text-xs">{e.qualification || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && list.length === 0 && <p className="text-center text-muted-foreground py-8">No employees found</p>}
        </div>
      )}

      {/* Profile modal */}
      <AnimatePresence>
        {selected && (
          <ProfileModal emp={selected} idx={selectedIdx}
            onClose={() => setSelected(null)}
            onUpdated={updated => { setAll(prev => prev.map(e => e.id === updated.id ? updated : e)); setSelected(updated); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

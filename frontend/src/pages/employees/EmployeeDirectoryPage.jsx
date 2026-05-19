import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutGrid, List, Search, Plus, Loader2, RefreshCw,
  Phone, Mail, Briefcase, X, Edit3, IndianRupee,
} from 'lucide-react';
import { listEmployees, updateEmployee } from '../../services/firebase/employeesService';

const DEPARTMENTS = ['All', 'Primary', 'Secondary', 'Commerce', 'Science', 'Arts', 'Administration', 'Other'];
const ROLES = ['Teacher', 'Class Teacher', 'Principal', 'Vice Principal', 'Accountant', 'Librarian', 'Lab Assistant', 'Administrative', 'Support Staff'];
const EMP_TYPES = ['Permanent', 'Contract', 'Part-time'];
const cardGradient = (i) => ['from-indigo-500 to-violet-500', 'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500', 'from-rose-500 to-pink-500', 'from-cyan-500 to-blue-500'][i % 5];

// ─── Employee Profile Modal ────────────────────────────────────────────────────
function ProfileModal({ emp, idx, onClose, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...emp });
  const [saving, setSaving] = useState(false);
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      await updateEmployee(emp.id, form);
      onUpdated({ ...emp, ...form });
      setEditing(false);
    } catch { }
    setSaving(false);
  };

  const F = ({ label, name, type = 'text', span }) => (
    <div className={span ? 'col-span-2' : ''}>
      <label className="label-eyebrow text-muted-foreground">{label}</label>
      <input type={type} name={name} value={form[name] || ''} onChange={handleChange}
        className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary" />
    </div>
  );
  const S = ({ label, name, options }) => (
    <div>
      <label className="label-eyebrow text-muted-foreground">{label}</label>
      <select name={name} value={form[name] || ''} onChange={handleChange}
        className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary">
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );

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
                <F label="Full Name" name="fullName" span />
                <F label="Phone" name="phoneNumber" />
                <F label="Email" name="email" type="email" />
                <F label="Date of Birth" name="dateOfBirth" type="date" />
                <S label="Gender" name="gender" options={['Male', 'Female', 'Other']} />
                <F label="Address" name="address" span />
                <S label="Role" name="role" options={ROLES} />
                <S label="Department" name="department" options={DEPARTMENTS.slice(1)} />
                <S label="Employment Type" name="employmentType" options={EMP_TYPES} />
                <F label="Date of Joining" name="dateOfJoining" type="date" />
                <F label="Subjects" name="subjects" />
                <F label="Classes" name="classes" />
                <F label="Class Teacher Of" name="classTeacherOf" />
                <F label="Experience (yrs)" name="experience" type="number" />
                <F label="Qualification" name="qualification" />
                <F label="Specialization" name="specialization" />
                <F label="Bank Account" name="bankAccount" />
                <F label="IFSC" name="ifsc" />
                <F label="Basic Salary (₹)" name="basicSalary" type="number" />
                <F label="Aadhar" name="aadharNumber" />
                <F label="PAN" name="panNumber" />
              </div>
              <div className="flex gap-2">
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
  const [view, setView] = useState('grid');
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
            <button onClick={() => setView('grid')} className={`px-3 py-1.5 rounded-full ${view === 'grid' ? 'bg-background shadow' : ''}`}><LayoutGrid className="h-3.5 w-3.5" /></button>
            <button onClick={() => setView('table')} className={`px-3 py-1.5 rounded-full ${view === 'table' ? 'bg-background shadow' : ''}`}><List className="h-3.5 w-3.5" /></button>
          </div>
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
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>{['Name', 'ID', 'Role', 'Department', 'Phone', 'Salary', 'Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left label-eyebrow text-muted-foreground">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {list.map((e, i) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => { setSelected(e); setSelectedIdx(i); }}>
                  <td className="px-4 py-3 font-bold">{e.fullName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.employeeId}</td>
                  <td className="px-4 py-3">{e.designation || e.role}</td>
                  <td className="px-4 py-3">{e.department}</td>
                  <td className="px-4 py-3">{e.phoneNumber || e.phone || '—'}</td>
                  <td className="px-4 py-3">{e.basicSalary ? `₹${Number(e.basicSalary).toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full label-eyebrow text-[9px] ${e.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>{e.status || 'ACTIVE'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

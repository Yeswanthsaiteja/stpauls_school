import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutGrid, List, Search, Filter, Plus, Loader2, RefreshCw } from 'lucide-react';
import { listStudents } from '../../services/firebase/studentsService';
import { CLASS_OPTIONS, SECTION_OPTIONS } from '../../lib/pdfUtils';

export default function StudentDirectoryPage() {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [view, setView] = useState('grid');
  const [q, setQ] = useState('');
  const [cls, setCls] = useState('');
  const [sec, setSec] = useState('');
  const [gender, setGender] = useState('');
  const [status, setStatus] = useState('ACTIVE');

  const load = async () => {
    setLoading(true);
    const data = await listStudents();
    setAll(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const list = useMemo(() => all.filter((s) => {
    const matchQ = !q || `${s.fullName} ${s.admissionNo}`.toLowerCase().includes(q.toLowerCase());
    const matchC = !cls || s.className === cls;
    const matchS = !sec || s.section === sec;
    const matchG = !gender || (s.gender || '').toLowerCase() === gender.toLowerCase();
    const matchSt = !status || s.status === status;
    return matchQ && matchC && matchS && matchG && matchSt;
  }), [all, q, cls, sec, gender, status]);

  return (
    <div className="space-y-5" data-testid="student-directory-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-2">Student Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">{loading ? 'Loading…' : `${list.length} of ${all.length} students`}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="h-10 w-10 rounded-2xl bg-muted grid place-items-center" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex bg-muted rounded-full p-1">
            <button onClick={() => setView('grid')} className={`px-3 py-1.5 rounded-full ${view === 'grid' ? 'bg-background shadow' : ''}`} data-testid="view-grid"><LayoutGrid className="h-3.5 w-3.5" /></button>
            <button onClick={() => setView('table')} className={`px-3 py-1.5 rounded-full ${view === 'table' ? 'bg-background shadow' : ''}`} data-testid="view-table"><List className="h-3.5 w-3.5" /></button>
          </div>
          <button onClick={() => navigate('/dashboard/students/admission-full')} className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2" data-testid="dir-add-btn">
            <Plus className="h-3.5 w-3.5" />Add Student
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="glass-morphism rounded-[2rem] p-4 grid grid-cols-2 md:grid-cols-5 gap-2 items-center">
        <div className="md:col-span-2 flex items-center gap-2 px-3 h-10 rounded-2xl border border-border bg-card">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or admission no" className="bg-transparent outline-none text-sm flex-1" data-testid="dir-search" />
        </div>
        <select value={cls} onChange={(e) => setCls(e.target.value)} className="h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="dir-class">
          <option value="">All Classes</option>
          {CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={sec} onChange={(e) => setSec(e.target.value)} className="h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="dir-section">
          <option value="">All Sections</option>
          {SECTION_OPTIONS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="dir-status">
          <option value="ACTIVE">Active Only</option>
          <option value="">All Students</option>
          <option value="REMOVED">Removed</option>
        </select>
        <select value={gender} onChange={(e) => setGender(e.target.value)} className="h-10 px-3 rounded-2xl border border-border bg-card text-sm col-span-2 md:col-span-1" data-testid="dir-gender">
          <option value="">All Genders</option>
          <option>Male</option><option>Female</option><option>Other</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {list.map((s, i) => (
            <motion.button
              key={s.id}
              data-testid={`dir-card-${s.id}`}
              onClick={() => navigate(`/dashboard/students/profile/${s.id}`)}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className="glass-morphism rounded-[1.75rem] p-4 text-left flex items-center gap-3"
            >
              {s.photoURL ? (
                <img src={s.photoURL} alt={s.fullName} className="h-14 w-14 rounded-2xl object-cover" />
              ) : (
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white font-black text-lg">{s.firstName?.[0]}</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{s.fullName}</div>
                <div className="label-eyebrow text-muted-foreground mt-0.5">{s.admissionNo}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold">{s.className}-{s.section}</span>
                  <span className={`px-2 py-0.5 rounded-full label-eyebrow ${s.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>{s.status}</span>
                </div>
              </div>
            </motion.button>
          ))}
          {list.length === 0 && <div className="col-span-full text-center py-12 text-sm text-muted-foreground"><Filter className="h-6 w-6 mx-auto mb-2" />No students match filters</div>}
        </div>
      ) : (
        <div className="glass-morphism rounded-[2rem] p-3 overflow-x-auto">
          <table className="w-full">
            <thead><tr>{['Adm. No', 'Name', 'Class', 'Gender', 'Phone', 'Status', ''].map((h) => <th key={h} className="label-eyebrow text-muted-foreground text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/dashboard/students/profile/${s.id}`)}>
                  <td className="px-3 py-2.5 font-mono text-xs font-bold">{s.admissionNo}</td>
                  <td className="px-3 py-2.5 text-sm font-bold">{s.fullName}</td>
                  <td className="px-3 py-2.5 text-sm">{s.className}-{s.section}</td>
                  <td className="px-3 py-2.5 text-sm">{s.gender || '—'}</td>
                  <td className="px-3 py-2.5 text-sm">{s.phoneNumber || '—'}</td>
                  <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full label-eyebrow ${s.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>{s.status}</span></td>
                  <td className="px-3 py-2.5 label-eyebrow text-primary">View →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

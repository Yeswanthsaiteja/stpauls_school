import React, { useState, useMemo, useEffect, useRef } from 'react';
import { getCurrentAcademicYear } from '../../utils';

import { motion, AnimatePresence } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutGrid, List, Search, Plus, Loader2, RefreshCw,
  Download, ChevronDown, FileText, FileSpreadsheet, File, UserPlus
} from 'lucide-react';
import { toast } from 'sonner';
import { listStudents, addStudent } from '../../services/firebase/studentsService';
import { CLASS_OPTIONS, SECTION_OPTIONS } from '../../lib/pdfUtils';
import { savePDF } from '../../lib/mobileDownload';

// ─── Export helpers ────────────────────────────────────────────────────────────

function buildStudentRows(list) {
  return list.map((s, i) => ({
    '#':              i + 1,
    'Full Name':      s.fullName || '',
    'DOB':            s.dateOfBirth || '',
    'Gender':         s.gender || '',
    'Aadhar No':      s.aadharNumber || '',
    'Adm No':         s.admissionNo || '',
    'Adm Year':       s.admissionYear || s.academicYear || '',
    'Adm Class':      s.admissionClass || s.admissionClass || '',
    'Current Class':  s.className || '',
    'Sec':            s.section || '',
    'Father':         s.fatherName || '',
    'Mother':         s.motherName || '',
    'Phone':          s.fatherPhone || s.phoneNumber || '',
    'Category':       s.category || '',
  }));
}

async function exportCSV(list, filename) {
  const rows = buildStudentRows(list);
  if (!rows.length) return toast.error('No data to export');
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const { saveBlob } = await import('../../lib/mobileDownload');
  await saveBlob(blob, filename);
  toast.success('CSV downloaded');
}

async function exportXLSX(list, filename) {
  const rows = buildStudentRows(list);
  if (!rows.length) return toast.error('No data to export');
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  XLSX.writeFile(wb, filename);
  toast.success('Excel downloaded');
}

async function exportPDF(list, filename) {
  if (!list.length) return toast.error('No data to export');
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const rows = buildStudentRows(list);
  const headers = Object.keys(rows[0]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.setFontSize(14);
  pdf.text('Student Directory — St. Pauls High School', 14, 14);
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
  await savePDF(pdf, filename);
  toast.success('PDF downloaded');
}

// ─── Export dropdown button ────────────────────────────────────────────────────

function ExportDropdown({ list, prefix }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const ts = new Date().toISOString().slice(0, 10);
  const fn = (ext) => `${prefix}_${ts}.${ext}`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={!list.length}
        className="h-10 px-4 rounded-2xl bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
      >
        <Download className="h-3.5 w-3.5" />
        Export
        <ChevronDown className="h-3 w-3" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 mt-1 w-44 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden"
          >
            {[
              { label: 'PDF (.pdf)', icon: FileText,        color: 'text-rose-500',    fn: () => exportPDF(list,  fn('pdf'))  },
              { label: 'CSV (.csv)', icon: File,            color: 'text-emerald-500', fn: () => exportCSV(list,  fn('csv'))  },
              { label: 'Excel (.xlsx)', icon: FileSpreadsheet, color: 'text-blue-500', fn: () => exportXLSX(list, fn('xlsx')) },
            ].map(({ label, icon: Icon, color, fn: action }) => (
              <button
                key={label}
                onClick={() => { action(); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left"
              >
                <Icon className={`h-4 w-4 ${color}`} />
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function StudentDirectoryPage() {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [view, setView] = useState('table'); // default: table
  const [q, setQ] = useState('');
  const [cls, setCls] = useState('');
  const [sec, setSec] = useState('');
  const [gender, setGender] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showPromote, setShowPromote] = useState(false);
  const [promoteYear, setPromoteYear] = useState('2027-28');
  const [promoteClass, setPromoteClass] = useState('');
  const [promoteSection, setPromoteSection] = useState('');
  const [promoting, setPromoting] = useState(false);

  const YEARS = ['2024-25', '2025-26', '2026-27', '2027-28'];

  const load = async () => {
    setLoading(true);
    const data = await listStudents();
    setAll(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const list = useMemo(() => all.filter((s) => {
    const matchY  = (s.academicYear || '2026-27') === academicYear;
    const matchQ  = !q      || `${s.fullName} ${s.admissionNo}`.toLowerCase().includes(q.toLowerCase());
    const matchC  = !cls    || s.className === cls;
    const matchS  = !sec    || s.section   === sec;
    const matchG  = !gender || (s.gender || '').toLowerCase() === gender.toLowerCase();
    const matchSt = !status || s.status    === status;
    return matchY && matchQ && matchC && matchS && matchG && matchSt;
  }), [all, q, cls, sec, gender, status, academicYear]);

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === list.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(list.map(s => s.id)));
  };

  const handlePromote = async () => {
    if (!promoteClass || !promoteSection) return toast.error('Please select target class and section');
    if (selectedIds.size === 0) return toast.error('No students selected');
    setPromoting(true);
    try {
      let count = 0;
      for (const id of selectedIds) {
        const student = all.find(s => s.id === id);
        if (student) {
          const { id: oldId, ...data } = student;
          await addStudent({
            ...data,
            academicYear: promoteYear,
            className: promoteClass,
            section: promoteSection
          });
          count++;
        }
      }
      toast.success(`Successfully promoted ${count} students to ${promoteYear}`);
      setShowPromote(false);
      setSelectedIds(new Set());
      load();
    } catch (err) {
      console.error(err);
      toast.error('Failed to promote students');
    } finally {
      setPromoting(false);
    }
  };

  const exportPrefix = `Students_${academicYear}_${cls || 'All'}_${sec || 'All'}_${status || 'All'}`;

  return (
    <div className="space-y-5" data-testid="student-directory-page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-2">Student Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading…' : `${list.length} of ${all.length} students`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={load} className="h-10 w-10 rounded-2xl bg-muted grid place-items-center" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {/* View toggle */}
          <div className="flex bg-muted rounded-full p-1">
            <button
              onClick={() => setView('table')}
              className={`px-3 py-1.5 rounded-full ${view === 'table' ? 'bg-background shadow' : ''}`}
              data-testid="view-table"
              title="Table view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView('grid')}
              className={`px-3 py-1.5 rounded-full ${view === 'grid' ? 'bg-background shadow' : ''}`}
              data-testid="view-grid"
              title="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
          <ExportDropdown list={list} prefix={exportPrefix} />
          <button
            onClick={() => navigate('/dashboard/students/admission-full')}
            className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2"
            data-testid="dir-add-btn"
          >
            <Plus className="h-3.5 w-3.5" />Add Student
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="glass-morphism rounded-[2rem] p-4 grid grid-cols-2 md:grid-cols-6 gap-2 items-center">
        <select value={academicYear} onChange={(e) => { setAcademicYear(e.target.value); setSelectedIds(new Set()); }}
          className="h-10 px-3 rounded-2xl border border-border bg-card text-sm font-bold">
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="md:col-span-2 flex items-center gap-2 px-3 h-10 rounded-2xl border border-border bg-card">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or admission no"
            className="bg-transparent outline-none text-sm flex-1"
            data-testid="dir-search"
          />
        </div>
        <select value={cls} onChange={(e) => setCls(e.target.value)}
          className="h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="dir-class">
          <option value="">All Classes</option>
          {CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={sec} onChange={(e) => setSec(e.target.value)}
          className="h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="dir-section">
          <option value="">All Sections</option>
          {SECTION_OPTIONS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="dir-status">
          <option value="ACTIVE">Active Only</option>
          <option value="">All Students</option>
          <option value="REMOVED">Removed</option>
        </select>
        <select value={gender} onChange={(e) => setGender(e.target.value)}
          className="h-10 px-3 rounded-2xl border border-border bg-card text-sm col-span-2 md:col-span-1" data-testid="dir-gender">
          <option value="">All Genders</option>
          <option>Male</option><option>Female</option><option>Other</option>
        </select>
      </div>

      {/* Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-primary text-primary-foreground rounded-2xl p-4 flex items-center justify-between">
              <div className="font-bold text-sm">{selectedIds.size} student(s) selected</div>
              <div className="flex gap-2">
                <button onClick={() => setShowPromote(true)} className="h-9 px-4 rounded-xl bg-primary-foreground text-primary text-xs font-bold flex items-center gap-2 hover:bg-background">
                  <UserPlus className="h-3.5 w-3.5" /> Promote Selected
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="h-9 px-4 rounded-xl border border-primary-foreground/20 text-xs font-bold hover:bg-primary-foreground/10">
                  Clear Selection
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Table view (default) */}
      {!loading && view === 'table' && (
        <div className="glass-morphism rounded-[2rem] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-3 py-3 w-10 sticky left-0 bg-muted/40 z-10">
                    <input type="checkbox" className="accent-indigo-500 h-4 w-4" checked={list.length > 0 && selectedIds.size === list.length} onChange={toggleAll} />
                  </th>
                  {[
                    { label: '#',             cls: 'w-10' },
                    { label: 'Full Name',      cls: 'min-w-[160px]' },
                    { label: 'DOB',            cls: 'min-w-[100px]' },
                    { label: 'Gender',         cls: 'min-w-[80px]'  },
                    { label: 'Aadhar No',      cls: 'min-w-[130px]' },
                    { label: 'Adm No',         cls: 'min-w-[110px]' },
                    { label: 'Adm Year',       cls: 'min-w-[90px]'  },
                    { label: 'Adm Class',      cls: 'min-w-[90px]'  },
                    { label: 'Current Class',  cls: 'min-w-[110px]' },
                    { label: 'Sec',            cls: 'min-w-[60px]'  },
                    { label: 'Father',         cls: 'min-w-[140px]' },
                    { label: 'Mother',         cls: 'min-w-[140px]' },
                    { label: 'Phone',          cls: 'min-w-[120px]' },
                    { label: 'Category',       cls: 'min-w-[100px]' },
                    { label: '',               cls: 'w-16'           },
                  ].map(({ label, cls: c }) => (
                    <th key={label} className={`px-3 py-3 text-left label-eyebrow text-muted-foreground font-semibold ${c}`}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((s, i) => (
                  <tr
                    key={s.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${selectedIds.has(s.id) ? 'bg-primary/5' : ''}`}
                    data-testid={`dir-row-${s.id}`}
                  >
                    <td className="px-3 py-2.5 sticky left-0 bg-card z-10 border-r border-border/50">
                      <input type="checkbox" className="accent-indigo-500 h-4 w-4" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} />
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs" onClick={() => navigate(`/dashboard/students/profile/${s.id}`)}>{i + 1}</td>
                    <td className="px-3 py-2.5 font-bold cursor-pointer" onClick={() => navigate(`/dashboard/students/profile/${s.id}`)}>
                      <div className="flex items-center gap-2">
                        {s.photoURL ? (
                          <img src={s.photoURL} alt="" className="h-7 w-7 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white font-black text-xs flex-shrink-0">
                            {s.firstName?.[0] || s.fullName?.[0] || '?'}
                          </div>
                        )}
                        <span className="truncate max-w-[130px] text-sm">{s.fullName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono">{s.dateOfBirth || '—'}</td>
                    <td className="px-3 py-2.5 text-xs">{s.gender || '—'}</td>
                    <td className="px-3 py-2.5 text-xs font-mono">{s.aadharNumber || '—'}</td>
                    <td className="px-3 py-2.5 text-xs font-mono font-bold">{s.admissionNo || '—'}</td>
                    <td className="px-3 py-2.5 text-xs">{s.admissionYear || s.academicYear || '—'}</td>
                    <td className="px-3 py-2.5 text-xs">{s.admissionClass || '—'}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold">{s.className || '—'}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold">{s.section || '—'}</td>
                    <td className="px-3 py-2.5 text-xs">{s.fatherName || '—'}</td>
                    <td className="px-3 py-2.5 text-xs">{s.motherName || '—'}</td>
                    <td className="px-3 py-2.5 text-xs">{s.fatherPhone || s.phoneNumber || '—'}</td>
                    <td className="px-3 py-2.5 text-xs">{s.category || '—'}</td>
                    <td className="px-3 py-2.5 text-xs font-bold text-primary">View →</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length === 0 && (
              <div className="text-center py-16 text-sm text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
                No students match the current filters
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid view */}
      {!loading && view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {list.map((s, i) => (
            <motion.button
              key={s.id}
              data-testid={`dir-card-${s.id}`}
              onClick={() => navigate(`/dashboard/students/profile/${s.id}`)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className="glass-morphism rounded-[1.75rem] p-4 text-left flex items-center gap-3"
            >
              {s.photoURL ? (
                <img src={s.photoURL} alt={s.fullName} className="h-14 w-14 rounded-2xl object-cover" />
              ) : (
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white font-black text-lg">
                  {s.firstName?.[0] || s.fullName?.[0] || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{s.fullName}</div>
                <div className="label-eyebrow text-muted-foreground mt-0.5">{s.admissionNo}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold">{s.className}-{s.section}</span>
                  <span className={`px-2 py-0.5 rounded-full label-eyebrow ${s.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    {s.status}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{s.fatherName || '—'}</div>
              </div>
            </motion.button>
          ))}
          {list.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
              <Search className="h-6 w-6 mx-auto mb-2" />No students match filters
            </div>
          )}
        </div>
      )}

      {/* Promote Modal */}
      <AnimatePresence>
        {showPromote && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-md rounded-[2rem] shadow-2xl border border-border p-6">
              <h2 className="font-display font-black text-2xl tracking-tighter uppercase text-primary">Promote Students</h2>
              <p className="text-sm text-muted-foreground mt-1">Promote {selectedIds.size} student(s) to a new academic year.</p>
              
              <div className="space-y-4 mt-6">
                <div>
                  <label className="label-eyebrow text-muted-foreground">Target Academic Year</label>
                  <select value={promoteYear} onChange={e => setPromoteYear(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm font-bold">
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-eyebrow text-muted-foreground">Target Class</label>
                  <select value={promoteClass} onChange={e => setPromoteClass(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm font-bold">
                    <option value="">Select Class</option>
                    {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-eyebrow text-muted-foreground">Target Section</label>
                  <select value={promoteSection} onChange={e => setPromoteSection(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm font-bold">
                    <option value="">Select Section</option>
                    {SECTION_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={() => setShowPromote(false)} className="flex-1 h-11 rounded-2xl bg-muted label-eyebrow hover:bg-muted/80">Cancel</button>
                <button onClick={handlePromote} disabled={promoting} className="flex-1 h-11 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50">
                  {promoting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Promotion'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

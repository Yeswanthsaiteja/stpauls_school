/**
 * IDCardStudio.jsx — St. Pauls ID Card Generation Module (v2)
 *
 * Changes from v1:
 * - Logo = full image upload (logo + school name banner) replacing text header
 * - Theme shade = one RGB color picker per theme (all students in that theme share same color)
 * - Assign Themes UI = simple grid: click student to select, then click theme
 * - Removed PDF download → replaced with ZIP (one PNG per student)
 * - Info rows (Class/Sec, Father Name, Contact No, Admission No) centered
 * - "F'Name" renamed to "Father Name"
 * - Theme color is global per theme key — not per individual student
 */

import React, { useState, useEffect, useRef } from 'react';
import { getCurrentAcademicYear } from '../utils';

import { motion } from 'framer-motion';
import {
  Download, Printer, Upload, ChevronDown, Save, Eye, Settings,
  Users, Palette, Pencil, Check, X as XIcon, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import { listStudents } from '../services/firebase/studentsService';
import { listClasses } from '../services/firebase/academicService';
import { loadIdCardConfig, saveIdCardConfig } from '../services/firebase/idCardService';
import { uploadToStorage } from '../lib/storageUtils';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRE_PRIMARY = ['Nursery', 'LKG', 'UKG'];

// Available themes per class type — each theme has a default RGB accent color
// Admin can change the accent via RGB picker; that one color applies to ALL students with that theme
const THEME_DEFAULTS = {
  red:    { label: 'Red',    default: '#E53935', bg: '#FFEBEE' },
  green:  { label: 'Green',  default: '#388E3C', bg: '#E8F5E9' },
  blue:   { label: 'Blue',   default: '#1565C0', bg: '#E3F2FD' },
  yellow: { label: 'Yellow', default: '#F9A825', bg: '#FFFDE7' },
  pink:   { label: 'Pink',   default: '#C2185B', bg: '#FCE4EC' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function lighten(hex, amount = 0.85) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.round(r + (255 - r) * amount)},${Math.round(g + (255 - g) * amount)},${Math.round(b + (255 - b) * amount)})`;
}

// ─── Single ID Card Component ─────────────────────────────────────────────────

function IdCard({
  student,
  themeKey,
  themeColor,
  logoDataUrl,
  signatureDataUrl,
  address,
  onPhotoChange,
  onFieldEdit,
  readOnly = false,
}) {
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState('');

  const startEdit = (field, val) => { setEditing(field); setEditVal(val || ''); };
  const commitEdit = () => { if (editing) onFieldEdit?.(editing, editVal); setEditing(null); };
  const cancelEdit = () => setEditing(null);

  const W = 242;
  const H = 390;

  const bgLight = lighten(themeColor, 0.93);

  return (
    <div
      className="id-card"
      style={{
        width: W, height: H, minWidth: W,
        background: bgLight,
        borderRadius: 8,
        fontFamily: "'Arial', 'Helvetica Neue', sans-serif",
        border: `2px solid ${themeColor}`,
        letterSpacing: 'normal',
        wordSpacing: 'normal',
        position: 'relative',
        overflow: 'hidden',
      }}
      data-card-id={student.id}
    >
      {/* ── Header: White section with logo ── */}
      <div style={{
        background: '#fff',
        borderBottom: `3px solid ${themeColor}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '6px 8px',
        minHeight: 66,
      }}>
        {/* Use uploaded logo from school config, fall back to /logo.png */}
        <img
          src={logoDataUrl || '/logo.png'}
          alt="St. Pauls High School"
          crossOrigin="anonymous"
          style={{ maxHeight: 56, maxWidth: '100%', height: 'auto', display: 'block', objectFit: 'contain' }}
        />
      </div>

      {/* ── Right side chevron decoration ── */}
      <div style={{ position: 'absolute', top: 74, right: 4, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[0,1,2].map(i => (
          <svg key={i} width="14" height="10" viewBox="0 0 14 10">
            <polyline points="1,1 7,9 13,1" fill="none" stroke={themeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ))}
      </div>

      {/* ── Left side bottom chevrons ── */}
      <div style={{ position: 'absolute', bottom: 64, left: 4, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[0,1,2].map(i => (
          <svg key={i} width="14" height="10" viewBox="0 0 14 10">
            <polyline points="1,1 7,9 13,1" fill="none" stroke={themeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ))}
      </div>

      {/* ── Dot grid (bottom right) ── */}
      <svg style={{ position: 'absolute', bottom: 62, right: 6, zIndex: 1 }} width="24" height="24" viewBox="0 0 24 24">
        {Array.from({ length: 16 }).map((_, k) => (
          <circle key={k} cx={(k%4)*6+3} cy={Math.floor(k/4)*6+3} r="1.4" fill={themeColor} opacity="0.4" />
        ))}
      </svg>

      {/* ── Student Photo ── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8, position: 'relative', zIndex: 2 }}>
        <label style={{ cursor: readOnly ? 'default' : 'pointer', position: 'relative' }}>
          {!readOnly && (
            <input type="file" accept="image/*" onChange={async e => {
              const f = e.target.files?.[0]; if (!f) return;
              try {
                const ext = f.name.split('.').pop() || 'jpg';
                const url = await uploadToStorage(f, `student-photos/${student.id}_${Date.now()}.${ext}`);
                onPhotoChange?.(url);
              } catch (err) {
                console.error(err);
              }
            }} style={{ display: 'none' }} />
          )}
          <div style={{
            width: 126, height: 152,
            border: `3px solid ${themeColor}`,
            borderRadius: 4,
            overflow: 'hidden',
            background: '#ddd',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            {student.photoDataUrl
              ? <img src={student.photoDataUrl} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
              : !readOnly && (
                <div style={{ textAlign: 'center', color: '#aaa' }}>
                  <Upload size={20} />
                  <div style={{ fontSize: 8, marginTop: 2 }}>Upload Photo</div>
                </div>
              )
            }
            {!readOnly && (
              <div style={{ position: 'absolute', bottom: 2, right: 2, background: themeColor, borderRadius: 3, padding: '2px 3px' }}>
                <Upload size={7} color="#fff" />
              </div>
            )}
          </div>
        </label>
      </div>

      {/* ── Student Name ── */}
      <div style={{ textAlign: 'center', marginTop: 6, padding: '0 16px', zIndex: 2, position: 'relative' }}>
        {editing === 'name' && !readOnly ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <input autoFocus value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && commitEdit()}
              style={{ fontSize: 11, fontWeight: 900, color: themeColor, border: `1px solid ${themeColor}`, borderRadius: 3, padding: '2px 4px', width: '100%', textAlign: 'center' }}
            />
            <button onClick={commitEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'green' }}><Check size={12} /></button>
            <button onClick={cancelEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red' }}><XIcon size={12} /></button>
          </div>
        ) : (
          <div
            onClick={() => !readOnly && startEdit('name', student.name)}
            style={{ fontWeight: 900, fontSize: 13, color: themeColor, letterSpacing: '1px', cursor: readOnly ? 'default' : 'pointer', lineHeight: 1.2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            {student.name || 'STUDENT NAME'}
            {!readOnly && <Pencil size={9} style={{ opacity: 0.35, flexShrink: 0 }} />}
          </div>
        )}
      </div>

      {/* ── Info Rows ── */}
      <div style={{ marginTop: 8, padding: '0 18px 0 22px', zIndex: 2, position: 'relative' }}>
        {[
          { label: 'Class/Sec',   value: `${student.className || '?'} / ${student.section || '?'}`, field: null },
          { label: 'Father Name', value: student.fatherName || '', field: 'fatherName' },
          { label: 'Contact No',  value: student.contactNo  || '', field: 'contactNo'  },
        ].map(({ label, value, field }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', marginBottom: 5, fontSize: 9 }}>
            <span style={{ width: 68, fontWeight: 700, color: '#222', flexShrink: 0, whiteSpace: 'nowrap' }}>{label}</span>
            <span style={{ margin: '0 6px', color: '#444', fontWeight: 700 }}>:</span>
            {field && editing === field && !readOnly ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                <input autoFocus value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && commitEdit()}
                  style={{ fontSize: 8, border: `1px solid ${themeColor}`, borderRadius: 3, padding: '1px 4px', flex: 1 }}
                />
                <button onClick={commitEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'green' }}><Check size={10} /></button>
                <button onClick={cancelEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red' }}><XIcon size={10} /></button>
              </div>
            ) : (
              <span
                onClick={() => field && !readOnly && startEdit(field, value)}
                style={{ fontWeight: 600, color: '#111', cursor: field && !readOnly ? 'pointer' : 'default', flex: 1, display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}
              >
                {value || (field && !readOnly ? <span style={{ color: '#bbb', fontStyle: 'italic' }}>tap to add</span> : '—')}
                {field && !readOnly && <Pencil size={7} style={{ opacity: 0.25, flexShrink: 0 }} />}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div style={{
        position: 'absolute', bottom: 20, left: 0, right: 0,
        borderTop: `1.5px solid ${themeColor}60`,
        padding: '5px 10px 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        {/* Address */}
        <div style={{ fontSize: 6.5, color: '#333', lineHeight: 1.7, maxWidth: 138, fontWeight: 500 }}>
          {(address || '8-15-42 Head post office road, Ring road,\nSrikakulam 532001 AP').split('\n').map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
        {/* Signature */}
        <div style={{ textAlign: 'center', minWidth: 64 }}>
          <div style={{ fontSize: 7, color: '#444', fontWeight: 700, marginBottom: 2 }}>Principal</div>
          {signatureDataUrl ? (
            <img src={signatureDataUrl} alt="sig" style={{ height: 26, maxWidth: 66, objectFit: 'contain' }} crossOrigin="anonymous" />
          ) : (
            <div style={{ height: 22, borderBottom: '1px solid #999', width: 60, margin: '0 auto' }} />
          )}
        </div>
      </div>

      {/* ── Bottom bar with Admission No ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 20, background: themeColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 3,
      }}>
        <span style={{ fontSize: 7.5, color: '#fff', fontWeight: 800, letterSpacing: '1px' }}>
          {student.admissionNo || ''}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function IDCardStudio() {
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const YEARS = ['2024-25', '2025-26', '2026-27', '2027-28'];

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [allClasses, setAllClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [availableSections, setAvailableSections] = useState([]);

  // ── Students ──────────────────────────────────────────────────────────────────
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // cardData: { [studentId]: { theme, photoDataUrl, name, fatherName, contactNo } }
  const [cardData, setCardData] = useState({});

  // themeColors: { [themeKey]: hexColor } — one color per theme, shared by all students
  const [themeColors, setThemeColors] = useState(() => {
    const init = {};
    Object.entries(THEME_DEFAULTS).forEach(([k, v]) => { init[k] = v.default; });
    return init;
  });

  // ── School config ─────────────────────────────────────────────────────────────
  const [schoolConfig, setSchoolConfig] = useState({
    logoDataUrl: '',
    address: '8-15-42 Head post office road, Ring road,\nSrikakulam 532001 AP',
    signatureDataUrl: '',
  });

  // ── UI ────────────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState('students');
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [enlargedStudent, setEnlargedStudent] = useState(null);

  // For ZIP: render one card at a time off-screen
  const [renderStudent, setRenderStudent] = useState(null);
  const renderRef = useRef(null);

  // ── Load classes ──────────────────────────────────────────────────────────────
  useEffect(() => {
    listClasses().then((cls) => {
      const ORDER = ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
      setAllClasses(cls.sort((a, b) => {
        const ai = ORDER.indexOf(a.name); const bi = ORDER.indexOf(b.name);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1; if (bi !== -1) return 1;
        return (a.name || '').localeCompare(b.name || '');
      }));
    });
  }, []);

  // ── Class change ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedClass) { setAvailableSections([]); setSelectedSection(''); return; }
    const cls = allClasses.find((c) => c.name === selectedClass);
    const secs = cls?.sections || ['A', 'B', 'C'];
    setAvailableSections(Array.isArray(secs) ? secs : ['A', 'B', 'C']);
    setSelectedSection('');
    setStudents([]);
    setCardData({});
    setConfigLoaded(false);
  }, [selectedClass, allClasses]);

  // ── Class+Section change → load students + saved config ───────────────────────
  useEffect(() => {
    if (!selectedClass || !selectedSection) return;
    setLoadingStudents(true);
    Promise.all([
      listStudents({ className: selectedClass, section: selectedSection, status: 'ACTIVE' }),
      loadIdCardConfig(academicYear, selectedClass, selectedSection),
    ]).then(([studs, saved]) => {
      const filtered = studs.filter(s => (s.academicYear || '2026-27') === academicYear);
      setStudents(filtered);
      const isPP = PRE_PRIMARY.includes(selectedClass);
      const initial = {};
      filtered.forEach((s) => {
        const sv = saved?.assignments?.[s.id] || {};
        initial[s.id] = {
          theme: sv.theme || (isPP ? 'pink' : 'blue'),
          photoDataUrl: sv.photoDataUrl || s.photoURL || '',
          name: sv.name || s.fullName || '',
          fatherName: sv.fatherName || s.fatherName || '',
          contactNo: sv.contactNo || s.fatherPhone || s.phoneNumber || '',
        };
      });
      setCardData(initial);
      if (saved?.schoolConfig) setSchoolConfig((sc) => ({ ...sc, ...saved.schoolConfig }));
      if (saved?.themeColors) setThemeColors((tc) => ({ ...tc, ...saved.themeColors }));
      setConfigLoaded(!!saved);
      setLoadingStudents(false);
      setTab('students');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, selectedSection, academicYear]);

  const isPrePrimary = PRE_PRIMARY.includes(selectedClass);
  const availableThemes = isPrePrimary ? ['pink'] : ['red', 'green', 'blue', 'yellow'];

  const updateCardField = (sid, field, val) =>
    setCardData((cd) => ({ ...cd, [sid]: { ...cd[sid], [field]: val } }));

  const setStudentTheme = (sid, theme) =>
    setCardData((cd) => ({ ...cd, [sid]: { ...cd[sid], theme } }));

  // ── Save ──────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedClass || !selectedSection) return toast.error('Select class and section first');
    if (saving) return; setSaving(true);
    try {
      await saveIdCardConfig(academicYear, selectedClass, selectedSection, cardData, { ...schoolConfig, themeColors });
      toast.success('Saved!');
    } catch (e) { toast.error('Save failed: ' + e.message); }
    finally { setSaving(false); }
  };

  // ── File helpers ──────────────────────────────────────────────────────────────

  // ── ZIP Download ──────────────────────────────────────────────────────────────
  const handleDownloadZip = async () => {
    if (!students.length) return toast.error('No students to export');
    setDownloading(true);
    setProgress(0);
    setTab('preview');
    await new Promise((r) => setTimeout(r, 400)); // let preview render

    try {
      const { default: html2canvas } = await import('html2canvas');
      const zip = new JSZip();

      for (let i = 0; i < students.length; i++) {
        const s = students[i];
        const cardEl = document.querySelector(`[data-card-id="${s.id}"]`);
        if (cardEl) {
        const canvas = await html2canvas(cardEl, {
          scale: 3,
          backgroundColor: '#ffffff',
          useCORS: true,
          allowTaint: true,
          logging: false,
        });
          const blob = await new Promise((res) => canvas.toBlob(res, 'image/png', 1.0));
          const safeN = (cardData[s.id]?.name || s.fullName || `Student_${i+1}`).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
          zip.file(`${String(i+1).padStart(2,'0')}_${safeN}_IDCard.png`, blob);
        }
        setProgress(Math.round(((i + 1) / students.length) * 100));
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `IDCards_${selectedClass}_${selectedSection}_${academicYear}.zip`);
      toast.success('ZIP downloaded!');
    } catch (e) {
      console.error(e);
      toast.error('ZIP error: ' + e.message);
    } finally {
      setDownloading(false);
      setProgress(0);
    }
  };

  const handleDownloadSingle = async (s) => {
    // wait a tick if modal just opened
    await new Promise(r => setTimeout(r, 100));
    
    // Select the card rendered in the preview list, not the modal, to be safe. 
    // Or just any element with the correct data attribute. We'll grab the first one.
    const cardEl = document.querySelector(`[data-card-id="${s.id}"]`);
    if (!cardEl) return toast.error('Could not find card to download.');
    
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardEl, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png', 1.0));
      const cd = cardData[s.id] || {};
      const safeN = (cd.name || s.fullName || `Student`).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      saveAs(blob, `${safeN}_IDCard.png`);
      toast.success(`Downloaded ID for ${cd.name || s.fullName}`);
    } catch (e) {
      console.error(e);
      toast.error('Download failed: ' + e.message);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5" data-testid="idcard-studio">

      {/* ── Header bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase">ID Card Studio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage and print student ID cards</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {configLoaded && (
            <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-bold border border-green-500/20">
              ✓ Config loaded
            </span>
          )}
          <button onClick={handleSave} disabled={saving || !students.length}
            className="h-10 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50">
            <Save className="h-3.5 w-3.5" />{saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={handleDownloadZip} disabled={downloading || !students.length}
            className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 disabled:opacity-50">
            {downloading
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating… {progress}%</>
              : <><Download className="h-3.5 w-3.5" />Download ZIP</>}
          </button>
          <button onClick={() => { setTab('preview'); setTimeout(() => window.print(), 400); }} disabled={!students.length}
            className="h-10 px-4 rounded-2xl bg-muted hover:bg-muted/80 text-xs font-bold flex items-center gap-2 disabled:opacity-50">
            <Printer className="h-3.5 w-3.5" />Print
          </button>
        </div>
      </div>

      {/* ── Filter row ── */}
      <div className="glass-morphism rounded-[2rem] p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <div className="text-xs font-bold text-muted-foreground mb-1.5">Academic Year</div>
            <div className="relative">
              <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full h-10 pl-3 pr-8 rounded-xl border border-border bg-card text-sm appearance-none cursor-pointer">
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="flex-1 min-w-[140px]">
            <div className="text-xs font-bold text-muted-foreground mb-1.5">Class</div>
            <div className="relative">
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full h-10 pl-3 pr-8 rounded-xl border border-border bg-card text-sm appearance-none cursor-pointer">
                <option value="">Select Class</option>
                {allClasses.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="flex-1 min-w-[120px]">
            <div className="text-xs font-bold text-muted-foreground mb-1.5">Section</div>
            <div className="relative">
              <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)}
                disabled={!selectedClass}
                className="w-full h-10 pl-3 pr-8 rounded-xl border border-border bg-card text-sm appearance-none cursor-pointer disabled:opacity-50">
                <option value="">Select Section</option>
                {availableSections.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {students.length > 0 && (
            <div className="h-10 px-3 rounded-xl bg-muted text-sm flex items-center gap-1.5 font-semibold">
              <Users className="h-4 w-4 text-muted-foreground" />
              {students.length} students
            </div>
          )}
        </div>
      </div>

      {/* ── Empty states ── */}
      {!selectedClass && (
        <div className="glass-morphism rounded-[2rem] p-12 text-center">
          <div className="text-5xl mb-3">🪪</div>
          <div className="font-bold text-lg">Select Class & Section to begin</div>
          <div className="text-sm text-muted-foreground mt-1">Choose a class and section to load students.</div>
        </div>
      )}
      {loadingStudents && (
        <div className="glass-morphism rounded-[2rem] p-8 text-center text-muted-foreground text-sm animate-pulse flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading students…
        </div>
      )}
      {!loadingStudents && selectedClass && selectedSection && students.length === 0 && (
        <div className="glass-morphism rounded-[2rem] p-12 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <div className="font-bold">No active students in {selectedClass} / {selectedSection}</div>
        </div>
      )}

      {/* ── Main workspace ── */}
      {!loadingStudents && students.length > 0 && (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 bg-muted p-1 rounded-2xl w-fit flex-wrap">
            {[
              { id: 'students', icon: Users,   label: 'Students' },
              { id: 'themes',   icon: Palette, label: 'Assign Themes' },
              { id: 'settings', icon: Settings, label: 'Settings' },
              { id: 'preview',  icon: Eye,     label: 'Preview' },
            ].map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  tab === id ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>

          {/* ════ STUDENTS TAB ════ */}
          {tab === 'students' && (
            <div className="glass-morphism rounded-[2rem] p-5 space-y-3">
              <div className="text-xs font-bold text-muted-foreground">{students.length} students · {selectedClass} / {selectedSection}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {students.map((s) => {
                  const cd = cardData[s.id] || {};
                  const themeColor = themeColors[cd.theme] || '#1565C0';
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-2xl border border-border" style={{ borderLeft: `4px solid ${themeColor}` }}>
                      <div className="h-9 w-9 rounded-xl grid place-items-center text-white font-black text-sm flex-shrink-0"
                        style={{ background: themeColor }}>
                        {(cd.name || s.fullName || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{cd.name || s.fullName}</div>
                        <div className="text-xs text-muted-foreground">{s.admissionNo}</div>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: lighten(themeColor, 0.85), color: themeColor }}>
                        {cd.theme || '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setTab('themes')} className="mt-2 h-10 px-5 rounded-2xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2">
                <Palette className="h-3.5 w-3.5" />Assign Themes →
              </button>
            </div>
          )}

          {/* ════ THEMES TAB ════ */}
          {tab === 'themes' && (
            <div className="space-y-4">

              {/* Theme color customization — one picker per theme */}
              <div className="glass-morphism rounded-[2rem] p-5 space-y-3">
                <div className="text-xs font-bold text-muted-foreground mb-1">Theme Colors — pick the exact color for each theme (applies to ALL students with that theme)</div>
                <div className="flex flex-wrap gap-4">
                  {availableThemes.map((t) => (
                    <div key={t} className="flex items-center gap-2">
                      <label
                        className="relative cursor-pointer group"
                        title={`Pick color for ${THEME_DEFAULTS[t].label}`}
                      >
                        <input
                          type="color"
                          value={themeColors[t]}
                          onChange={(e) => setThemeColors((tc) => ({ ...tc, [t]: e.target.value }))}
                          className="sr-only"
                        />
                        <div
                          className="h-9 w-9 rounded-full border-4 border-white shadow-lg cursor-pointer ring-2 ring-offset-1 transition-transform group-hover:scale-110"
                          style={{ background: themeColors[t], ringColor: themeColors[t] }}
                        />
                      </label>
                      <div>
                        <div className="text-xs font-bold">{THEME_DEFAULTS[t].label}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{themeColors[t]}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  💡 Click the color circle to open the color picker. The chosen color applies to every student assigned to that theme.
                </p>
              </div>

              {/* Student → Theme assignment grid */}
              <div className="glass-morphism rounded-[2rem] p-5 space-y-2">
                <div className="text-xs font-bold text-muted-foreground mb-3">
                  Assign Theme — click a student row, then click a color chip to assign
                </div>

              {/* Theme assignment summary / Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
                {availableThemes.map((t) => {
                  const count = students.filter((s) => (cardData[s.id]?.theme || (isPrePrimary ? 'pink' : 'blue')) === t).length;
                  const color = themeColors[t] || '#888';
                  return (
                    <div key={t} className="glass-morphism rounded-2xl p-4 flex flex-col items-center text-center border-b-[6px]" style={{ borderBottomColor: color }}>
                      <div className="text-xs font-bold text-muted-foreground uppercase">{THEME_DEFAULTS[t].label} Theme</div>
                      <div className="text-4xl font-black mt-2" style={{ color }}>{count}</div>
                      <div className="text-xs font-semibold mt-1 opacity-70">Students Assigned</div>
                    </div>
                  );
                })}
              </div>

                {/* Theme legend */}
                <div className="flex gap-2 flex-wrap mb-3 pb-3 border-b border-border">
                  {availableThemes.map((t) => (
                    <div key={t} className="flex items-center gap-1.5 text-xs font-semibold">
                      <span className="h-4 w-4 rounded-full border-2 border-white shadow" style={{ background: themeColors[t] }} />
                      {THEME_DEFAULTS[t].label}
                    </div>
                  ))}
                </div>

                {students.map((s) => {
                  const cd = cardData[s.id] || {};
                  const activeColor = themeColors[cd.theme] || '#888';
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-2xl border border-border hover:border-primary/40 transition-colors">
                      {/* Student info */}
                      <div className="h-8 w-8 rounded-xl grid place-items-center text-white font-black text-xs flex-shrink-0"
                        style={{ background: activeColor }}>
                        {(cd.name || s.fullName || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{cd.name || s.fullName}</div>
                      </div>
                      {/* Theme picker chips */}
                      <div className="flex gap-1.5">
                        {availableThemes.map((t) => (
                          <button
                            key={t}
                            onClick={() => setStudentTheme(s.id, t)}
                            title={THEME_DEFAULTS[t].label}
                            className="transition-transform hover:scale-110 focus:outline-none"
                          >
                            <div
                              className={`h-7 w-7 rounded-full border-white shadow transition-all ${cd.theme === t ? 'scale-125 border-4' : 'border-2 opacity-70'}`}
                              style={{ background: themeColors[t], boxShadow: cd.theme === t ? `0 0 0 2px ${themeColors[t]}` : undefined }}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button onClick={() => setTab('preview')} className="h-10 px-5 rounded-2xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2">
                <Eye className="h-3.5 w-3.5" />Preview Cards →
              </button>
            </div>
          )}

          {/* ════ SETTINGS TAB ════ */}
          {tab === 'settings' && (
            <div className="glass-morphism rounded-[2rem] p-5 space-y-5 max-w-lg">
              <div className="text-xs font-bold text-muted-foreground">School Configuration</div>

              {/* Logo — full banner image */}
              <div>
                <div className="text-xs font-bold mb-2">School Logo / Header Image</div>
                <p className="text-[11px] text-muted-foreground mb-3">Upload the complete logo image (with school name). This will replace the entire header area of each ID card.</p>
                <div className="flex items-center gap-4">
                  {schoolConfig.logoDataUrl && (
                    <img src={schoolConfig.logoDataUrl} alt="logo preview" className="h-16 max-w-[200px] object-contain rounded-lg border border-border" />
                  )}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" onChange={async (e) => { 
                      const f = e.target.files?.[0]; if (!f) return; 
                      const ext = f.name.split('.').pop() || 'png';
                      const url = await uploadToStorage(f, `school-config/logo_${Date.now()}.${ext}`); 
                      setSchoolConfig((sc) => ({ ...sc, logoDataUrl: url })); 
                    }} className="hidden" />
                    <div className="h-10 px-4 rounded-xl border-2 border-dashed border-border hover:border-primary flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      <Upload className="h-3.5 w-3.5" />{schoolConfig.logoDataUrl ? 'Change Image' : 'Upload Logo Image'}
                    </div>
                  </label>
                </div>
              </div>

              {/* School address */}
              <div>
                <label className="text-xs font-bold block mb-1">School Address (bottom of card)</label>
                <textarea
                  value={schoolConfig.address}
                  onChange={(e) => setSchoolConfig((sc) => ({ ...sc, address: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm resize-none"
                />
              </div>

              {/* Principal signature */}
              <div>
                <div className="text-xs font-bold mb-2">Principal's Signature</div>
                <div className="flex items-center gap-4">
                  {schoolConfig.signatureDataUrl ? (
                    <img src={schoolConfig.signatureDataUrl} alt="sig" className="h-12 max-w-[100px] object-contain border border-border rounded p-1" />
                  ) : (
                    <div className="h-12 w-24 border border-dashed border-border rounded flex items-center justify-center text-[10px] text-muted-foreground">No signature</div>
                  )}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" onChange={async (e) => { 
                      const f = e.target.files?.[0]; if (!f) return; 
                      const ext = f.name.split('.').pop() || 'png';
                      const url = await uploadToStorage(f, `school-config/sig_${Date.now()}.${ext}`); 
                      setSchoolConfig((sc) => ({ ...sc, signatureDataUrl: url })); 
                    }} className="hidden" />
                    <div className="h-9 px-4 rounded-xl border-2 border-dashed border-border hover:border-primary flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      <Upload className="h-3.5 w-3.5" />{schoolConfig.signatureDataUrl ? 'Change Signature' : 'Upload Signature'}
                    </div>
                  </label>
                </div>
              </div>

              <button onClick={() => setTab('preview')} className="h-10 px-5 rounded-2xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2">
                <Eye className="h-3.5 w-3.5" />Preview Cards →
              </button>
            </div>
          )}

          {/* ════ PREVIEW TAB ════ */}
          {tab === 'preview' && (
            <div>
              {downloading && (
                <div className="mb-3 p-3 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <div className="flex-1">
                    <div className="text-xs font-bold">Generating ZIP… {progress}%</div>
                    <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>
              )}
              <div className="text-xs font-bold text-muted-foreground mb-3">
                Preview · {students.length} cards · Click any field to edit inline · Click photo to upload
              </div>
              <div id="id-print-area" className="flex flex-wrap gap-5 p-5 rounded-[2rem] bg-slate-100 dark:bg-slate-900">
                {students.map((s) => {
                  const cd = cardData[s.id] || {};
                  return (
                    <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <IdCard
                        student={{
                          id: s.id,
                          name: cd.name || s.fullName || '',
                          fatherName: cd.fatherName || '',
                          contactNo: cd.contactNo || '',
                          className: s.className || '',
                          section: s.section || '',
                          admissionNo: s.admissionNo || '',
                          photoDataUrl: cd.photoDataUrl || '',
                        }}
                        themeKey={cd.theme || (isPrePrimary ? 'pink' : 'blue')}
                        themeColor={themeColors[cd.theme || (isPrePrimary ? 'pink' : 'blue')] || '#1565C0'}
                        logoDataUrl={schoolConfig.logoDataUrl}
                        signatureDataUrl={schoolConfig.signatureDataUrl}
                        address={schoolConfig.address}
                        onPhotoChange={(url) => updateCardField(s.id, 'photoDataUrl', url)}
                        onFieldEdit={(field, val) => updateCardField(s.id, field, val)}
                      />
                      <button onClick={() => setEnlargedStudent(s)} className="mt-3 px-4 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold flex items-center gap-1.5 transition-colors">
                        <Eye className="h-3.5 w-3.5" /> Enlarge & Download
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Hidden card for clean download (always in React tree, off-screen) ── */}
      {enlargedStudent && (() => {
        const s = enlargedStudent;
        const cd = cardData[s.id] || {};
        const isPrePrimary2 = ['nursery','lkg','ukg','pre-primary','pp'].includes((s.className || '').toLowerCase());
        const themeKey2 = cd.theme || (isPrePrimary2 ? 'pink' : 'blue');
        const themeColor2 = themeColors[themeKey2] || '#1565C0';
        return (
          <div
            id="hidden-card-for-download"
            style={{ position: 'fixed', left: -9999, top: -9999, pointerEvents: 'none', zIndex: -1 }}
          >
            <IdCard
              student={{ id: s.id, name: cd.name || s.fullName || '', fatherName: cd.fatherName || '', contactNo: cd.contactNo || '', className: s.className || '', section: s.section || '', admissionNo: s.admissionNo || '', photoDataUrl: cd.photoDataUrl || '' }}
              themeKey={themeKey2} themeColor={themeColor2}
              logoDataUrl={schoolConfig.logoDataUrl} signatureDataUrl={schoolConfig.signatureDataUrl} address={schoolConfig.address}
              readOnly={true}
            />
          </div>
        );
      })()}

      {/* ── Enlarged Card Modal ── */}
      {enlargedStudent && (() => {
        const s = enlargedStudent;
        const cd = cardData[s.id] || {};
        const isPrePrimary2 = ['nursery','lkg','ukg','pre-primary','pp'].includes((s.className || '').toLowerCase());
        const themeKey2 = cd.theme || (isPrePrimary2 ? 'pink' : 'blue');
        const themeColor2 = themeColors[themeKey2] || '#1565C0';
        const cardProps = {
          student: { id: s.id, name: cd.name || s.fullName || '', fatherName: cd.fatherName || '', contactNo: cd.contactNo || '', className: s.className || '', section: s.section || '', admissionNo: s.admissionNo || '', photoDataUrl: cd.photoDataUrl || '' },
          themeKey: themeKey2, themeColor: themeColor2,
          logoDataUrl: schoolConfig.logoDataUrl, signatureDataUrl: schoolConfig.signatureDataUrl, address: schoolConfig.address,
        };

        const handleDownload = async () => {
          try {
            toast.loading('Preparing download...', { id: 'dl' });
            // Small delay to ensure hidden card is fully painted
            await new Promise(r => setTimeout(r, 80));
            const hiddenDiv = document.getElementById('hidden-card-for-download');
            const cardEl = hiddenDiv?.querySelector('.id-card');
            if (!cardEl) { toast.error('Could not find card.', { id: 'dl' }); return; }
            const { default: html2canvas } = await import('html2canvas');
            const canvas = await html2canvas(cardEl, { scale: 3, backgroundColor: null, useCORS: true, allowTaint: true, logging: false });
            const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 1.0));
            const safeN = (cardProps.student.name || 'Student').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
            saveAs(blob, `${safeN}_IDCard.png`);
            toast.success('Downloaded!', { id: 'dl' });
          } catch (e) {
            toast.error('Download failed: ' + e.message, { id: 'dl' });
          }
        };

        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <button onClick={() => setEnlargedStudent(null)} className="absolute top-6 right-6 p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-[10000]">
              <XIcon className="h-8 w-8" />
            </button>
            <div className="flex flex-col items-center gap-8">
              <div className="scale-[1.4] md:scale-[1.6] transform origin-center shadow-2xl">
                <IdCard {...cardProps} readOnly={true} />
              </div>
              <button
                onClick={handleDownload}
                className="mt-24 px-8 h-12 rounded-full bg-primary text-primary-foreground font-bold shadow-xl flex items-center gap-2 hover:scale-105 transition-transform"
              >
                <Download className="h-5 w-5" /> Download Single ID
              </button>
            </div>
          </div>
        );
      })()}

      {/* Print styles */}
      <style>{`
        @media print {
          aside, header, nav, button, .glass-morphism:not(#id-print-area) { display: none !important; }
          #id-print-area { background: white !important; padding: 0 !important; display: flex !important; flex-wrap: wrap !important; gap: 8mm !important; }
          .id-card { page-break-inside: avoid !important; break-inside: avoid !important; }
          main { padding: 0 !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

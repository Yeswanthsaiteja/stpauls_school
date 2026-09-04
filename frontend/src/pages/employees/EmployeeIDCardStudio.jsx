import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Download, Printer, Upload, ChevronDown, Save, Eye, Settings,
  Users, Palette, Pencil, Check, X as XIcon, Loader2, UserSquare2
} from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import { listEmployees, updateEmployee } from '../../services/firebase/employeesService';
import { loadIdCardConfig, saveIdCardConfig } from '../../services/firebase/idCardService';
import { uploadToStorage } from '../../lib/storageUtils';
import ImageCropperModal from '../../components/ImageCropperModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getCorsProxyUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  if (url.includes('firebasestorage.googleapis.com')) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=webp`;
  }
  return url;
};

// ─── Single Employee ID Card Component ───────────────────────────────────────

function EmployeeIdCard({
  employee,
  themeColor = '#E53935',
  logoDataUrl,
  signatureDataUrl,
  address,
  onPhotoChange,
  onFieldEdit,
  readOnly = false,
}) {
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [cropImageSrc, setCropImageSrc] = useState(null);

  const startEdit = (field, val) => { setEditing(field); setEditVal(val || ''); };
  const commitEdit = () => { if (editing) onFieldEdit?.(editing, editVal); setEditing(null); };
  const cancelEdit = () => setEditing(null);

  const handlePhotoUpload = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setCropImageSrc(e.target.result);
    };
    reader.readAsDataURL(f);
  };

  const handleCropComplete = async (croppedBlob) => {
    setCropImageSrc(null);
    try {
      const ext = 'jpg';
      const file = new File([croppedBlob], `photo.${ext}`, { type: croppedBlob.type });
      const url = await uploadToStorage(file, `employee-photos/${employee.id}_${Date.now()}.${ext}`);
      onPhotoChange?.(url);
    } catch (err) {
      console.error(err);
    }
  };

  const W = 242;
  const H = 390;

  return (
    <div
      className="id-card"
      style={{
        width: W, height: H, minWidth: W,
        backgroundColor: '#fff',
        borderRadius: 8,
        fontFamily: "'Arial', 'Helvetica Neue', sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
      data-card-id={employee.id}
    >
      {/* Background Image rendered as <img> for better html2canvas quality */}
      <img 
        src="/assets/employee_id_bg.jpg" 
        alt="ID Card Background" 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }} 
        crossOrigin="anonymous"
      />

      {/* Employee Photo */}
      <div style={{ position: 'absolute', top: 58, left: 68, width: 114, height: 146, zIndex: 3 }}>
        <label style={{ cursor: readOnly ? 'default' : 'pointer', width: '100%', height: '100%', display: 'block' }}>
          {!readOnly && (
            <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
          )}
          <div style={{
            width: '100%', height: '100%',
            background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {employee.photoDataUrl ? (
              <img src={getCorsProxyUrl(employee.photoDataUrl)} alt={employee.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
            ) : (
              !readOnly && (
                <div style={{ textAlign: 'center', color: '#666' }}>
                  <Upload size={16} className="mx-auto" />
                  <div style={{ fontSize: 7, marginTop: 2 }}>Photo</div>
                </div>
              )
            )}
          </div>
        </label>
      </div>

      {/* Employee Details */}
      <div style={{ position: 'absolute', top: 200, left: 0, width: '100%', zIndex: 3, color: 'red', textAlign: 'center' }}>
        {/* Name */}
        {editing === 'fullName' && !readOnly ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <input autoFocus value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && commitEdit()}
              style={{ fontSize: 13, fontWeight: 900, color: 'red', border: '1px solid red', borderRadius: 3, padding: '2px 4px', width: '80%', textAlign: 'center', background: '#333' }}
            />
            <button onClick={commitEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4ade80' }}><Check size={12} /></button>
          </div>
        ) : (
          <div
            onClick={() => !readOnly && startEdit('fullName', employee.fullName)}
            style={{ fontWeight: 800, fontSize: 13, color: 'red', letterSpacing: '0.5px', cursor: readOnly ? 'default' : 'pointer', textTransform: 'uppercase' }}
          >
            {employee.fullName || 'EMPLOYEE NAME'}
          </div>
        )}
      </div>
      {/* Info Values (positioned individually to align perfectly with the background colons) */}
      <div style={{ position: 'absolute', top: 223, left: 115, zIndex: 3, fontSize: 9.5, fontWeight: 700, color: 'white' }}>
        {editing === 'employeeId' && !readOnly ? (
          <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && commitEdit()} style={{ fontSize: 9.5, color: 'black' }} />
        ) : (
          <span onClick={() => !readOnly && startEdit('employeeId', employee.employeeId)} style={{ cursor: readOnly ? 'default' : 'pointer' }}>
            {employee.employeeId || 'STPEMP0000'}
          </span>
        )}
      </div>

      <div style={{ position: 'absolute', top: 244, left: 115, zIndex: 3, fontSize: 9.5, fontWeight: 700, color: 'white' }}>
        {editing === 'role' && !readOnly ? (
          <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && commitEdit()} style={{ fontSize: 9.5, color: 'black' }} />
        ) : (
          <span onClick={() => !readOnly && startEdit('role', employee.role)} style={{ cursor: readOnly ? 'default' : 'pointer' }}>
            {employee.role || 'TEACHER'}
          </span>
        )}
      </div>

      <div style={{ position: 'absolute', top: 266, left: 115, zIndex: 3, fontSize: 9.5, fontWeight: 700, color: 'white' }}>
        {editing === 'phoneNumber' && !readOnly ? (
          <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && commitEdit()} style={{ fontSize: 9.5, color: 'black' }} />
        ) : (
          <span onClick={() => !readOnly && startEdit('phoneNumber', employee.phoneNumber)} style={{ cursor: readOnly ? 'default' : 'pointer' }}>
            {employee.phoneNumber || '9999999999'}
          </span>
        )}
      </div>

      {cropImageSrc && (
        <ImageCropperModal
          imageSrc={cropImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropImageSrc(null)}
          aspectRatio={114 / 146}
        />
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function EmployeeIDCardStudio() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // cardData: { [empId]: { photoDataUrl, fullName, employeeId, role, department, phoneNumber } }
  const [cardData, setCardData] = useState({});

  // ── School config ─────────────────────────────────────────────────────────────
  const [schoolConfig, setSchoolConfig] = useState({
    logoDataUrl: '',
    address: '8-15-42 Head post office road, Ring road,\nSrikakulam 532001 AP',
    signatureDataUrl: '',
  });
  const [themeColor, setThemeColor] = useState('#E53935');

  // ── UI ────────────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState('employees');
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('ALL');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listEmployees(),
      loadIdCardConfig('global', 'employees', 'all'), // Store under a global key for employees
    ]).then(([emps, saved]) => {
      const activeEmps = emps.filter(e => e.status === 'ACTIVE');
      setEmployees(activeEmps);
      const initial = {};
      activeEmps.forEach((e) => {
        const sv = saved?.assignments?.[e.id] || {};
        initial[e.id] = {
          id: e.id,
          photoDataUrl: sv.photoDataUrl || e.photoURL || '',
          fullName: sv.fullName || e.fullName || '',
          employeeId: sv.employeeId || e.employeeId || '',
          role: sv.role || e.role || '',
          department: sv.department || e.department || '',
          phoneNumber: sv.phoneNumber || e.phoneNumber || '',
        };
      });
      setCardData(initial);
      if (saved?.schoolConfig) setSchoolConfig((sc) => ({ ...sc, ...saved.schoolConfig }));
      if (saved?.themeColors?.employee) setThemeColor(saved.themeColors.employee);
      setConfigLoaded(!!saved);
      setLoading(false);
    });
  }, []);

  const updateCardField = (eid, field, val) =>
    setCardData((cd) => ({ ...cd, [eid]: { ...cd[eid], [field]: val } }));

  // ── Save ──────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (saving) return; setSaving(true);
    try {
      await saveIdCardConfig('global', 'employees', 'all', cardData, { ...schoolConfig, themeColors: { employee: themeColor } });
      toast.success('Saved Employee ID Config!');
    } catch (e) { toast.error('Save failed: ' + e.message); }
    finally { setSaving(false); }
  };

  // ── ZIP Download ──────────────────────────────────────────────────────────────
  const handleDownloadZip = async () => {
    const toExport = employees.filter(e => departmentFilter === 'ALL' || e.department === departmentFilter);
    if (!toExport.length) return toast.error('No employees to export');
    setDownloading(true);
    setProgress(0);
    setTab('preview');
    await new Promise((r) => setTimeout(r, 400)); // let preview render

    try {
      const { default: html2canvas } = await import('html2canvas');
      const zip = new JSZip();

      for (let i = 0; i < toExport.length; i++) {
        const e = toExport[i];
        const cardEl = document.querySelector(`[data-card-id="${e.id}"]`);
        if (cardEl) {
          const canvas = await html2canvas(cardEl, {
            scale: 3,
            backgroundColor: '#ffffff',
            useCORS: true,
            allowTaint: true,
            logging: false,
          });
          const blob = await new Promise((res) => canvas.toBlob(res, 'image/png', 1.0));
          const safeN = (cardData[e.id]?.fullName || e.fullName || `Employee_${i+1}`).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
          zip.file(`${String(i+1).padStart(2,'0')}_${safeN}_IDCard.png`, blob);
        }
        setProgress(Math.round(((i + 1) / toExport.length) * 100));
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `Employee_IDCards_${departmentFilter}.zip`);
      toast.success('ZIP downloaded!');
    } catch (e) {
      console.error(e);
      toast.error('ZIP error: ' + e.message);
    } finally {
      setDownloading(false);
      setProgress(0);
    }
  };

  const handleDownloadSingle = async (e) => {
    // wait a tick if modal just opened
    await new Promise(r => setTimeout(r, 100));
    
    const cardEl = document.querySelector(`[data-card-id="${e.id}"]`);
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
      const cd = cardData[e.id] || {};
      const safeN = (cd.fullName || e.fullName || `Employee`).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      saveAs(blob, `${safeN}_IDCard.png`);
      toast.success('Card downloaded!');
    } catch (err) {
      console.error(err);
      toast.error('Download error: ' + err.message);
    }
  };

  const departments = ['ALL', ...new Set(employees.map(e => e.department).filter(Boolean))];
  const filteredEmployees = employees.filter(e => departmentFilter === 'ALL' || e.department === departmentFilter);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5" data-testid="employee-idcard-studio">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Employee ID Cards</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage and print staff ID cards</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {configLoaded && (
            <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-bold border border-green-500/20">
              ✓ Config loaded
            </span>
          )}
          <button onClick={handleSave} disabled={saving || !employees.length}
            className="h-10 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50">
            <Save className="h-3.5 w-3.5" />{saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={handleDownloadZip} disabled={downloading || !filteredEmployees.length}
            className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 disabled:opacity-50">
            {downloading
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating… {progress}%</>
              : <><Download className="h-3.5 w-3.5" />Download ZIP</>}
          </button>
          <button onClick={() => { setTab('preview'); setTimeout(() => window.print(), 400); }} disabled={!filteredEmployees.length}
            className="h-10 px-4 rounded-2xl bg-muted hover:bg-muted/80 text-xs font-bold flex items-center gap-2 disabled:opacity-50">
            <Printer className="h-3.5 w-3.5" />Print
          </button>
        </div>
      </div>

      <div className="glass-morphism rounded-[2rem] p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs font-bold text-muted-foreground mb-1.5">Filter by Department</div>
            <div className="relative">
              <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full h-10 pl-3 pr-8 rounded-xl border border-border bg-card text-sm appearance-none cursor-pointer">
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          {filteredEmployees.length > 0 && (
            <div className="h-10 px-3 rounded-xl bg-muted text-sm flex items-center gap-1.5 font-semibold">
              <UserSquare2 className="h-4 w-4 text-muted-foreground" />
              {filteredEmployees.length} employees
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="glass-morphism rounded-[2rem] p-8 text-center text-muted-foreground text-sm animate-pulse flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading employees…
        </div>
      )}

      {!loading && employees.length > 0 && (
        <>
          <div className="flex gap-1 bg-muted p-1 rounded-2xl w-fit flex-wrap">
            {[
              { id: 'employees', icon: Users,   label: 'Employees' },
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

          {tab === 'employees' && (
            <div className="glass-morphism rounded-[2rem] p-5 space-y-3">
              <div className="text-xs font-bold text-muted-foreground">{filteredEmployees.length} employees found</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {filteredEmployees.map((e) => {
                  const cd = cardData[e.id] || {};
                  return (
                    <div key={e.id} className="flex items-center gap-3 p-3 rounded-2xl border border-border" style={{ borderLeft: `4px solid ${themeColor}` }}>
                      <div className="h-9 w-9 rounded-xl grid place-items-center text-white font-black text-sm flex-shrink-0"
                        style={{ background: themeColor }}>
                        {(cd.fullName || e.fullName || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{cd.fullName || e.fullName}</div>
                        <div className="text-xs text-muted-foreground">{cd.employeeId || e.employeeId} · {cd.department || e.department}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="glass-morphism rounded-[2rem] p-5 space-y-5 max-w-lg">
              <div className="text-xs font-bold text-muted-foreground">ID Card Settings</div>

              <div>
                <label className="text-xs font-bold block mb-1">Theme Color</label>
                <div className="flex items-center gap-3 mt-2">
                  <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="h-10 w-10 p-0 border-0 rounded cursor-pointer" />
                  <span className="text-sm font-mono text-muted-foreground">{themeColor}</span>
                </div>
              </div>

              <div>
                <div className="text-xs font-bold mb-2">School Logo / Header Image</div>
                <div className="flex items-center gap-4">
                  {schoolConfig.logoDataUrl && (
                    <img src={schoolConfig.logoDataUrl} alt="logo preview" className="h-16 max-w-[200px] object-contain rounded-lg border border-border bg-white" />
                  )}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" onChange={async (e) => { 
                      const f = e.target.files?.[0]; if (!f) return; 
                      const ext = f.name.split('.').pop() || 'png';
                      const url = await uploadToStorage(f, `school-config/logo_${Date.now()}.${ext}`); 
                      setSchoolConfig((sc) => ({ ...sc, logoDataUrl: url })); 
                    }} className="hidden" />
                    <div className="h-10 px-4 rounded-xl border-2 border-dashed border-border hover:border-primary flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      <Upload className="h-3.5 w-3.5" />{schoolConfig.logoDataUrl ? 'Change Image' : 'Upload Header'}
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">School Address (bottom of card)</label>
                <textarea
                  value={schoolConfig.address}
                  onChange={(e) => setSchoolConfig((sc) => ({ ...sc, address: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm resize-none"
                />
              </div>

              <div>
                <div className="text-xs font-bold mb-2">Principal Signature</div>
                <div className="flex items-center gap-4">
                  {schoolConfig.signatureDataUrl && (
                    <img src={schoolConfig.signatureDataUrl} alt="signature preview" className="h-10 object-contain p-1 rounded bg-white" />
                  )}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" onChange={async (e) => { 
                      const f = e.target.files?.[0]; if (!f) return; 
                      const ext = f.name.split('.').pop() || 'png';
                      const url = await uploadToStorage(f, `school-config/sig_${Date.now()}.${ext}`); 
                      setSchoolConfig((sc) => ({ ...sc, signatureDataUrl: url })); 
                    }} className="hidden" />
                    <div className="h-8 px-3 rounded-lg border border-border bg-card hover:bg-muted text-xs font-bold flex items-center gap-2 transition-colors">
                      <Upload className="h-3 w-3" />{schoolConfig.signatureDataUrl ? 'Change Signature' : 'Upload Signature'}
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {tab === 'preview' && (
            <div className="glass-morphism rounded-[2rem] p-5">
              <div className="text-xs font-bold text-muted-foreground mb-4">Click fields on the cards to edit employee information just for the print. (Changes are saved when you click Save)</div>
              
              <div className="flex flex-wrap gap-4 justify-center print:justify-start">
                {filteredEmployees.map((e) => (
                  <div key={e.id} className="print:break-inside-avoid print:mb-4 relative group">
                    <EmployeeIdCard
                      employee={cardData[e.id] || e}
                      themeColor={themeColor}
                      logoDataUrl={schoolConfig.logoDataUrl}
                      signatureDataUrl={schoolConfig.signatureDataUrl}
                      address={schoolConfig.address}
                      onPhotoChange={(url) => updateCardField(e.id, 'photoDataUrl', url)}
                      onFieldEdit={(field, val) => updateCardField(e.id, field, val)}
                    />
                    <button 
                      onClick={() => handleDownloadSingle(e)}
                      className="absolute top-2 right-2 p-2 bg-white/90 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary hover:text-white print:hidden z-10 text-muted-foreground"
                      title="Download this ID card"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Print-only CSS overrides */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          [data-testid="employee-idcard-studio"] .print\\:break-inside-avoid { visibility: visible; }
          [data-testid="employee-idcard-studio"] .print\\:break-inside-avoid * { visibility: visible; }
          [data-testid="employee-idcard-studio"] .flex-wrap {
            position: absolute;
            left: 0; top: 0;
            display: flex !important;
            gap: 15px !important;
            flex-wrap: wrap !important;
            visibility: visible !important;
            justify-content: flex-start !important;
          }
          [data-testid="employee-idcard-studio"] .flex-wrap > * {
            page-break-inside: avoid;
            margin-bottom: 10px;
          }
        }
      `}</style>
    </div>
  );
}

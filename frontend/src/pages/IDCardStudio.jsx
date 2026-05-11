import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Upload, Download } from 'lucide-react';
import { demoStore } from '../services/demoStore';
import { useTenant } from '../contexts/TenantContext';
import { downloadElementAsPDF } from '../lib/pdfUtils';
import { toast } from 'sonner';

const PRESETS = [
  { name: 'Indigo', headerBg: '#4338ca', cardBg: '#ffffff', textColor: '#0f172a', accent: '#6366f1' },
  { name: 'Emerald', headerBg: '#047857', cardBg: '#f0fdf4', textColor: '#064e3b', accent: '#10b981' },
  { name: 'Rose', headerBg: '#be123c', cardBg: '#fff1f2', textColor: '#4c0519', accent: '#f43f5e' },
  { name: 'Midnight', headerBg: '#0f172a', cardBg: '#0f172a', textColor: '#f1f5f9', accent: '#a5b4fc' },
];

export default function IDCardStudio() {
  const students = demoStore.list('students');
  const employees = demoStore.list('employees');
  const { tenant } = useTenant();
  const [mode, setMode] = useState('student'); // student | staff
  const [layout, setLayout] = useState('vertical');
  const [side, setSide] = useState('front');
  const [theme, setTheme] = useState({ ...PRESETS[0], fontSize: 14 });
  const [sel, setSel] = useState(students.slice(0, 4).map((s) => s.id));
  const [logo, setLogo] = useState(tenant?.logoUrl || '');
  const [photoOverrides, setPhotoOverrides] = useState({});
  const [backText, setBackText] = useState(`If found, please return to ${tenant?.name || 'the school'}.\nAddress: ${tenant?.address || ''}\nPhone: ${tenant?.contactNumber || ''}`);

  const people = (mode === 'student' ? students : employees).filter((p) => sel.includes(p.id));
  const toggle = (id) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const onLogo = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = (ev) => setLogo(String(ev.target.result || '')); r.readAsDataURL(f);
  };
  const onPhoto = (id) => (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => setPhotoOverrides((o) => ({ ...o, [id]: String(ev.target.result || '') }));
    r.readAsDataURL(f);
  };

  const downloadPDF = async () => {
    await downloadElementAsPDF('id-print-area', `id-cards-${mode}.pdf`);
    toast.success('PDF downloaded');
  };

  const cardW = layout === 'vertical' ? 260 : 380;
  const cardH = layout === 'vertical' ? 380 : 240;

  return (
    <div className="space-y-6" data-testid="idcard-studio">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display font-black text-3xl tracking-tighter uppercase">ID Card Studio</h1>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="h-10 px-4 rounded-2xl bg-muted hover:bg-muted/80 label-eyebrow flex items-center gap-2" data-testid="studio-print"><Printer className="h-3.5 w-3.5" />Print</button>
          <button onClick={downloadPDF} className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2" data-testid="studio-pdf"><Download className="h-3.5 w-3.5" />Download PDF</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Controls */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-morphism rounded-[2rem] p-5 space-y-3">
            <div className="label-eyebrow text-muted-foreground">Card Setup</div>
            <div className="flex bg-muted rounded-full p-1 w-fit">
              <button onClick={() => setMode('student')} className={`px-3 py-1 rounded-full label-eyebrow ${mode === 'student' ? 'bg-background shadow' : 'text-muted-foreground'}`} data-testid="studio-mode-student">Student</button>
              <button onClick={() => setMode('staff')} className={`px-3 py-1 rounded-full label-eyebrow ${mode === 'staff' ? 'bg-background shadow' : 'text-muted-foreground'}`} data-testid="studio-mode-staff">Staff</button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setLayout('vertical')} className={`px-3 py-1.5 rounded-2xl label-eyebrow ${layout === 'vertical' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} data-testid="studio-layout-v">Vertical</button>
              <button onClick={() => setLayout('horizontal')} className={`px-3 py-1.5 rounded-2xl label-eyebrow ${layout === 'horizontal' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} data-testid="studio-layout-h">Horizontal</button>
              <div className="flex-1" />
              <button onClick={() => setSide('front')} className={`px-3 py-1.5 rounded-2xl label-eyebrow ${side === 'front' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} data-testid="studio-side-front">Front</button>
              <button onClick={() => setSide('back')} className={`px-3 py-1.5 rounded-2xl label-eyebrow ${side === 'back' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} data-testid="studio-side-back">Back</button>
            </div>
          </div>

          <div className="glass-morphism rounded-[2rem] p-5 space-y-3">
            <div className="label-eyebrow text-muted-foreground">Theme</div>
            <div className="flex gap-2 flex-wrap">
              {PRESETS.map((p) => (
                <button key={p.name} onClick={() => setTheme({ ...theme, ...p })} className="h-9 px-3 rounded-full label-eyebrow flex items-center gap-2 border border-border" data-testid={`studio-preset-${p.name}`}>
                  <span className="h-3 w-3 rounded-full" style={{ background: p.headerBg }} />{p.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs"><span className="label-eyebrow text-muted-foreground block mb-1">Header BG</span>
                <input type="color" value={theme.headerBg} onChange={(e) => setTheme({ ...theme, headerBg: e.target.value })} className="w-full h-9 rounded-lg cursor-pointer" data-testid="studio-headerBg" />
              </label>
              <label className="text-xs"><span className="label-eyebrow text-muted-foreground block mb-1">Card BG</span>
                <input type="color" value={theme.cardBg} onChange={(e) => setTheme({ ...theme, cardBg: e.target.value })} className="w-full h-9 rounded-lg cursor-pointer" data-testid="studio-cardBg" />
              </label>
              <label className="text-xs"><span className="label-eyebrow text-muted-foreground block mb-1">Text</span>
                <input type="color" value={theme.textColor} onChange={(e) => setTheme({ ...theme, textColor: e.target.value })} className="w-full h-9 rounded-lg cursor-pointer" data-testid="studio-text" />
              </label>
              <label className="text-xs"><span className="label-eyebrow text-muted-foreground block mb-1">Accent</span>
                <input type="color" value={theme.accent} onChange={(e) => setTheme({ ...theme, accent: e.target.value })} className="w-full h-9 rounded-lg cursor-pointer" data-testid="studio-accent" />
              </label>
              <label className="text-xs col-span-2"><span className="label-eyebrow text-muted-foreground block mb-1">Font Size · {theme.fontSize}px</span>
                <input type="range" min="11" max="18" value={theme.fontSize} onChange={(e) => setTheme({ ...theme, fontSize: Number(e.target.value) })} className="w-full" />
              </label>
            </div>
          </div>

          <div className="glass-morphism rounded-[2rem] p-5 space-y-3">
            <div className="label-eyebrow text-muted-foreground">School Logo</div>
            <label className="block border-2 border-dashed border-border rounded-2xl p-3 cursor-pointer text-center hover:border-primary">
              <input type="file" accept="image/*" onChange={onLogo} className="hidden" data-testid="studio-logo" />
              {logo ? <img src={logo} alt="" className="h-14 mx-auto" /> : <><Upload className="h-5 w-5 mx-auto text-muted-foreground" /><div className="label-eyebrow text-muted-foreground mt-1">Upload Logo</div></>}
            </label>
            <div className="label-eyebrow text-muted-foreground">Back Side Text</div>
            <textarea value={backText} onChange={(e) => setBackText(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-2xl border border-border bg-card text-xs" data-testid="studio-backText" />
          </div>

          <div className="glass-morphism rounded-[2rem] p-5">
            <div className="label-eyebrow text-muted-foreground mb-2">{mode === 'student' ? 'Students' : 'Staff'} · {sel.length} selected</div>
            <div className="max-h-60 overflow-y-auto thin-scrollbar space-y-1">
              {(mode === 'student' ? students : employees).map((p) => (
                <label key={p.id} className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer ${sel.includes(p.id) ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                  <input type="checkbox" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} className="accent-indigo-500" data-testid={`studio-sel-${p.id}`} />
                  <span className="text-xs font-bold truncate">{p.fullName}</span>
                  <span className="ml-auto label-eyebrow text-muted-foreground">{mode === 'student' ? `${p.className}-${p.section}` : p.role}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-3">
          <div className="label-eyebrow text-muted-foreground mb-2">Preview · {side} · {layout}</div>
          <div id="id-print-area" className="bg-slate-100 dark:bg-slate-900 rounded-[2rem] p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {people.map((p) => {
              const photo = photoOverrides[p.id] || p.photoURL;
              return (
                <div key={p.id} className="relative rounded-3xl shadow-xl overflow-hidden" style={{ width: '100%', maxWidth: cardW, height: cardH, background: theme.cardBg, color: theme.textColor, fontSize: theme.fontSize }}>
                  {side === 'front' ? (
                    layout === 'vertical' ? (
                      <div className="h-full flex flex-col">
                        <div className="p-3 flex items-center gap-2" style={{ background: theme.headerBg, color: '#fff' }}>
                          {logo && <img src={logo} alt="" className="h-8 w-8 rounded-lg object-cover" />}
                          <div className="font-display font-black tracking-tight text-sm">{tenant?.name || 'School'}</div>
                        </div>
                        <div className="flex-1 p-4 flex flex-col items-center text-center">
                          <label className="cursor-pointer">
                            <input type="file" accept="image/*" onChange={onPhoto(p.id)} className="hidden" data-testid={`studio-photo-${p.id}`} />
                            {photo ? <img src={photo} alt={p.fullName} className="h-24 w-24 rounded-2xl object-cover ring-2" style={{ '--tw-ring-color': theme.accent }} /> : <div className="h-24 w-24 rounded-2xl grid place-items-center font-black text-2xl" style={{ background: theme.accent, color: '#fff' }}>{p.fullName[0]}</div>}
                          </label>
                          <div className="font-display font-black tracking-tight mt-3" style={{ fontSize: theme.fontSize + 2 }}>{p.fullName}</div>
                          <div className="text-[10px] mt-0.5 opacity-70">{mode === 'student' ? `Class ${p.className}-${p.section}` : p.designation}</div>
                          <div className="text-[10px] font-mono mt-1 opacity-80">{mode === 'student' ? p.admissionNo : p.employeeId}</div>
                          <div className="mt-auto pt-3 bg-white p-1.5 rounded-lg">
                            <QRCodeSVG value={`${mode}:${p.admissionNo || p.employeeId}`} size={56} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex">
                        <div className="w-1/3 p-3" style={{ background: theme.headerBg }}>
                          {photo ? <img src={photo} alt="" className="h-full w-full object-cover rounded-xl" /> : <div className="h-full w-full grid place-items-center text-white font-black text-3xl rounded-xl" style={{ background: theme.accent }}>{p.fullName[0]}</div>}
                        </div>
                        <div className="flex-1 p-3 flex flex-col">
                          {logo && <img src={logo} alt="" className="h-6 w-6 rounded mb-1" />}
                          <div className="font-display font-black tracking-tight text-xs uppercase" style={{ color: theme.accent }}>{tenant?.name}</div>
                          <div className="font-display font-black tracking-tighter mt-1" style={{ fontSize: theme.fontSize + 1 }}>{p.fullName}</div>
                          <div className="text-[10px] mt-0.5 opacity-70">{mode === 'student' ? `Class ${p.className}-${p.section}` : p.designation}</div>
                          <div className="text-[10px] font-mono mt-0.5 opacity-80">{mode === 'student' ? p.admissionNo : p.employeeId}</div>
                          <div className="mt-auto bg-white p-1 rounded-lg w-fit"><QRCodeSVG value={`${mode}:${p.admissionNo || p.employeeId}`} size={44} /></div>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="h-full p-4 flex flex-col">
                      <div className="font-display font-black tracking-tight text-xs uppercase pb-2 border-b" style={{ color: theme.accent, borderColor: theme.accent + '40' }}>Contact</div>
                      <div className="text-[11px] mt-2 whitespace-pre-line leading-relaxed">{backText}</div>
                      <div className="mt-auto text-[10px] opacity-60">Card valid for academic year 2025-26</div>
                    </div>
                  )}
                </div>
              );
            })}
            {people.length === 0 && <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Select people on the left to preview cards.</div>}
          </div>
        </div>
      </div>
      <style>{`@media print { aside, header, .glass-morphism:not(#id-print-area .glass-morphism) { display: none !important; } main { padding: 0 !important; } }`}</style>
    </div>
  );
}

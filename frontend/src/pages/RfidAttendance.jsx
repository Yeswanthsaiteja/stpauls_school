import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { UploadCloud, Check, AlertTriangle, MessageCircle, Send } from 'lucide-react';
import { listStudents } from '../services/firebase/studentsService';
import { saveAttendance } from '../services/firebase/attendanceService';
import { CLASS_OPTIONS, SECTION_OPTIONS } from '../lib/pdfUtils';
import { getWhatsAppUrl } from '../lib/utils';
import { toast } from 'sonner';

const SAMPLE = `rfid,present
ADM20253142,1
ADM20253143,1
ADM20253144,0
ADM20253145,1
ADM20253101,1`;

function parseAttendance(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idIdx = headers.findIndex((h) => h === 'rfid' || h === 'admissionno' || h === 'admission_no' || h === 'id');
  const presIdx = headers.findIndex((h) => h === 'present' || h === 'status');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    return { id: (cells[idIdx] || '').trim(), present: ['1', 'yes', 'p', 'present', 'true'].includes(String(cells[presIdx] || '').trim().toLowerCase()) };
  });
}

export default function RfidAttendance() {
  const [students, setStudents] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [cls, setCls] = useState('');
  const [sec, setSec] = useState('');
  const [parsed, setParsed] = useState([]);
  const [committed, setCommitted] = useState(false);
  const [committing, setCommitting] = useState(false);

  useEffect(() => { listStudents({ status: 'ACTIVE' }).then(setStudents); }, []);

  const onFile = (f) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = (e) => setParsed(parseAttendance(String(e.target.result || '')));
    r.readAsText(f);
  };
  const loadSample = () => setParsed(parseAttendance(SAMPLE));

  const enriched = parsed.map((row) => {
    const student = students.find((s) => s.admissionNo === row.id || s.rfid === row.id);
    return { ...row, student };
  });
  const unknown = enriched.filter((r) => !r.student);
  const known = enriched.filter((r) => r.student);
  const filtered = known.filter((r) => (!cls || r.student.className === cls) && (!sec || r.student.section === sec));
  const absent = filtered.filter((r) => !r.present);

  const commit = async () => {
    setCommitting(true);
    // Group by class-section and save to Firestore
    const grouped = {};
    filtered.forEach((r) => {
      const key = `${r.student.className}_${r.student.section}`;
      if (!grouped[key]) grouped[key] = { className: r.student.className, section: r.student.section, records: {} };
      grouped[key].records[r.student.id] = r.present ? 'PRESENT' : 'ABSENT';
    });
    for (const g of Object.values(grouped)) {
      await saveAttendance(g.className, g.section, date, g.records);
    }
    setCommitted(true);
    setCommitting(false);
    toast.success(`Saved attendance for ${filtered.length} students to Firestore ✓`);
  };

  const bulkWhatsApp = () => {
    if (!absent.length) return toast('No absentees to notify');
    absent.forEach((r) => {
      const url = getWhatsAppUrl(r.student.phoneNumber, `Your child ${r.student.fullName} was marked absent on ${date}.`);
      window.open(url, '_blank');
    });
    toast.success(`Opened ${absent.length} WhatsApp links`);
  };

  return (
    <div className="space-y-6" data-testid="rfid-attendance">
      <NavLink to="/dashboard/attendance" className="label-eyebrow text-primary">← Back</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">RFID Attendance Upload</h1>

      <div className="glass-morphism rounded-[2rem] p-5 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="label-eyebrow text-muted-foreground">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="rfid-date" />
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Filter Class</label>
          <select value={cls} onChange={(e) => setCls(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="rfid-class">
            <option value="">All</option>
            {CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Filter Section</label>
          <select value={sec} onChange={(e) => setSec(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="rfid-section">
            <option value="">All</option>
            {SECTION_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={loadSample} className="self-end h-11 px-4 rounded-2xl bg-muted hover:bg-muted/80 label-eyebrow" data-testid="rfid-sample">Load Sample</button>
      </div>

      <motion.label whileHover={{ y: -3 }} className="block glass-morphism rounded-[2rem] p-8 border-2 border-dashed border-border cursor-pointer text-center">
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="hidden" data-testid="rfid-file" />
        <UploadCloud className="h-10 w-10 mx-auto text-primary" />
        <div className="mt-3 font-bold">Upload RFID CSV</div>
        <div className="label-eyebrow text-muted-foreground mt-1">Columns: rfid (or admissionNo), present (1/0)</div>
      </motion.label>

      {parsed.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-muted-foreground">Parsed</div><div className="font-display font-black text-2xl tracking-tighter">{parsed.length}</div></div>
            <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-emerald-500">Matched</div><div className="font-display font-black text-2xl tracking-tighter">{known.length}</div></div>
            <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-rose-500">Unknown</div><div className="font-display font-black text-2xl tracking-tighter">{unknown.length}</div></div>
            <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-amber-500">Absentees</div><div className="font-display font-black text-2xl tracking-tighter">{absent.length}</div></div>
          </div>

          {unknown.length > 0 && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-3 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <div>{unknown.length} unrecognised RFID IDs — needs manual review: <span className="font-mono">{unknown.slice(0, 5).map((u) => u.id).join(', ')}</span>{unknown.length > 5 ? '…' : ''}</div>
            </div>
          )}

          <div className="glass-morphism rounded-[2rem] p-3 overflow-x-auto">
            <table className="w-full">
              <thead><tr>{['Adm. No', 'Name', 'Class', 'Status'].map((h) => <th key={h} className="label-eyebrow text-muted-foreground text-left px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {filtered.slice(0, 30).map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                    <td className="px-3 py-2 font-bold text-sm">{r.student.fullName}</td>
                    <td className="px-3 py-2 text-sm">{r.student.className}-{r.student.section}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full label-eyebrow ${r.present ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>{r.present ? 'PRESENT' : 'ABSENT'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={commit} disabled={committed || committing} className="h-11 px-5 rounded-2xl bg-emerald-500 text-white label-eyebrow flex items-center gap-2 disabled:opacity-50" data-testid="rfid-commit">
              <Check className="h-3.5 w-3.5" />{committing ? 'Saving to Firebase…' : committed ? 'Committed ✓' : `Commit ${filtered.length} Records`}
            </button>
            <button onClick={bulkWhatsApp} disabled={absent.length === 0} className="h-11 px-5 rounded-2xl bg-emerald-500/10 text-emerald-600 label-eyebrow flex items-center gap-2 disabled:opacity-50" data-testid="rfid-bulk-wa">
              <Send className="h-3.5 w-3.5" />Send Absent Notifications · {absent.length}
            </button>
            <div className="flex-1" />
            {absent.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {absent.slice(0, 4).map((r) => (
                  <a key={r.student.id} href={getWhatsAppUrl(r.student.phoneNumber, `Your child ${r.student.fullName} was absent on ${date}.`)} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-full bg-emerald-500/10 text-emerald-600 label-eyebrow flex items-center gap-1.5">
                    <MessageCircle className="h-3 w-3" />{r.student.firstName}
                  </a>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, Download, CheckCircle2, Loader2, FileSpreadsheet } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { bulkAddStudents } from '../services/firebase/studentsService';
import { toast } from 'sonner';

const SAMPLE = `firstName,lastName,className,section,rollNo,gender,phoneNumber,fatherName,motherName
Aarav,Mehta,X,A,15,Male,+919812340001,Suresh Mehta,Anita Mehta
Diya,Reddy,IX,B,09,Female,+919812340002,Karthik Reddy,Latha Reddy
Kabir,Khan,VIII,A,21,Male,+919812340003,Imran Khan,Sara Khan`;

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = (cells[i] || '').trim(); });
    return row;
  });
}

export default function BulkImport() {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [committed, setCommitted] = useState(0);
  const [committing, setCommitting] = useState(false);
  const navigate = useNavigate();

  const onFile = (f) => {
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCSV(String(e.target.result || ''));
      setRows(parsed);
      toast.success(`Parsed ${parsed.length} rows`);
    };
    reader.readAsText(f);
  };

  const loadSample = () => {
    setFileName('sample.csv');
    setRows(parseCSV(SAMPLE));
  };

  const commit = async () => {
    if (!rows.length) return;
    setCommitting(true);
    try {
      const enriched = rows.map((r, idx) => ({
        ...r,
        fullName: `${r.firstName || ''} ${r.lastName || ''}`.trim(),
        status: 'ACTIVE',
        admissionDate: new Date().toISOString(),
      }));
      await bulkAddStudents(enriched);
      setCommitted(enriched.length);
      toast.success(`Imported ${enriched.length} students to Firestore`);
      setTimeout(() => navigate('..'), 1200);
    } catch (err) {
      toast.error('Import failed: ' + err.message);
    } finally {
      setCommitting(false);
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'students_sample.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-5xl" data-testid="bulk-import">
      <NavLink to=".." className="label-eyebrow text-primary">← Back to Students</NavLink>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Bulk CSV Import</h1>
        <button onClick={downloadSample} className="h-10 px-4 rounded-2xl bg-muted hover:bg-muted/80 flex items-center gap-2 label-eyebrow" data-testid="download-sample-btn">
          <Download className="h-3.5 w-3.5" />Sample CSV
        </button>
      </div>

      <motion.label whileHover={{ y: -3 }} className="block glass-morphism rounded-[2rem] p-8 border-2 border-dashed border-border cursor-pointer">
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="hidden" data-testid="csv-file-input" />
        <div className="text-center">
          <Upload className="h-10 w-10 mx-auto text-primary" />
          <div className="mt-3 font-bold">Drop CSV here or click to browse</div>
          <div className="label-eyebrow text-muted-foreground mt-1">Up to 700 rows · UTF-8</div>
          {fileName && <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary label-eyebrow"><FileSpreadsheet className="h-3.5 w-3.5" />{fileName}</div>}
        </div>
        <div className="text-center mt-4">
          <button type="button" onClick={(e) => { e.preventDefault(); loadSample(); }} className="label-eyebrow text-primary underline" data-testid="use-sample-btn">or load sample data</button>
        </div>
      </motion.label>

      {rows.length > 0 && (
        <div className="glass-morphism rounded-[2rem] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="label-eyebrow text-muted-foreground">Preview · {rows.length} rows</div>
            <button onClick={commit} disabled={committed > 0 || committing} data-testid="commit-import-btn" className="h-10 px-5 rounded-2xl bg-emerald-500 text-white label-eyebrow flex items-center gap-2 disabled:opacity-50">
              {committing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : committed > 0 ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
              {committed > 0 ? `Imported ${committed}` : committing ? 'Saving to Firestore…' : `Import ${rows.length} Students`}
            </button>
          </div>
          <div className="overflow-x-auto thin-scrollbar">
            <table className="w-full text-xs">
              <thead><tr>{Object.keys(rows[0]).map((h) => <th key={h} className="label-eyebrow text-muted-foreground p-2 text-left">{h}</th>)}</tr></thead>
              <tbody>
                {rows.slice(0, 15).map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    {Object.keys(rows[0]).map((h) => <td key={h} className="p-2 font-medium">{r[h]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 15 && <div className="text-center label-eyebrow text-muted-foreground mt-2">…and {rows.length - 15} more</div>}
          </div>
        </div>
      )}
    </div>
  );
}

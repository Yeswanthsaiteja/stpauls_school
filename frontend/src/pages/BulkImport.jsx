/**
 * BulkImport.jsx — Excel & CSV bulk importer for Students and Staff
 * Handles St. Paul's High School specific Excel formats (Class 1-10, Nursery, LKG, UKG)
 * and the Staff register format.
 */
import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Download, CheckCircle2, Loader2, FileSpreadsheet,
  Users, UserCheck, AlertTriangle, X, ChevronRight, ArrowLeft,
  Eye, Play, RefreshCw, Info
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { addStudent } from '../services/firebase/studentsService';
import { addEmployee, listEmployees } from '../services/firebase/employeesService';
import { toast } from 'sonner';

// ─── COLUMN MAPPERS ───────────────────────────────────────────────────────────

/**
 * Normalize a header string: trim + lowercase + remove extra whitespace
 */
function normHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Parse Excel date serial numbers to ISO date string
 */
function parseExcelDate(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  if (typeof val === 'string') {
    // Try to parse common Indian date formats: DD-MM-YYYY, DD/MM/YYYY
    const m = val.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (m) {
      const [, d, mo, y] = m;
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    // Try ISO format
    const iso = new Date(val);
    if (!isNaN(iso.getTime())) return iso.toISOString().slice(0, 10);
  }
  return String(val);
}

/**
 * Normalize phone number to 10-digit string
 */
function normalizePhone(val) {
  if (!val) return '';
  const str = String(val).replace(/\D/g, '');
  return str.slice(-10);
}

/**
 * Map a raw row from St. Paul's student Excel to app student model
 * Headers: S.NO, Admission Number, AADHAR NUMBER, CHILD NAME, DOB, GENDER,
 *          CASTE, Sub-Caste, Father Name, Mother Name,
 *          Admission Year, Admission Class, CONTACT NUMBERS, CLASS
 *
 * Root-cause note: Excel's "Admission Class" header cell sometimes has a line-break
 * inside it, so XLSX.js may parse it as "Class" (second line only). This means
 * simple exact or fuzzy matching on "class" can accidentally hit the Admission Class
 * column. Fix: search from the END of headers and explicitly SKIP any header that
 * also contains the word "admission".
 */
function mapStudentRow(row, headers) {
  /** Fuzzy forward search – header CONTAINS key */
  const get = (keys) => {
    for (const key of keys) {
      const normKey = normHeader(key);
      const idx = headers.findIndex(h => normHeader(h).includes(normKey));
      if (idx !== -1 && row[idx] != null && row[idx] !== '') return row[idx];
    }
    return '';
  };

  /**
   * CURRENT-CLASS lookup:
   * Search from the END of the header array, skip any header that contains
   * "admission". This guarantees we find the standalone "CLASS" column and
   * never accidentally pick up "Admission Class".
   */
  const getCurrentClass = () => {
    for (let i = headers.length - 1; i >= 0; i--) {
      const h = normHeader(headers[i]);
      if (h.includes('class') && !h.includes('admission')) {
        const val = row[i];
        if (val != null && val !== '') return val;
      }
    }
    return '';
  };

  /**
   * ADMISSION-CLASS lookup:
   * Forward search – first header containing BOTH "admission" and "class".
   */
  const getAdmissionClass = () => {
    for (let i = 0; i < headers.length; i++) {
      const h = normHeader(headers[i]);
      if (h.includes('admission') && h.includes('class')) {
        const val = row[i];
        if (val != null && val !== '') return val;
      }
    }
    return '';
  };

  /**
   * ADMISSION-YEAR lookup:
   * Forward search – first header containing BOTH "admission" and "year".
   */
  const getAdmissionYear = () => {
    for (let i = 0; i < headers.length; i++) {
      const h = normHeader(headers[i]);
      if (h.includes('admission') && h.includes('year')) {
        const val = row[i];
        if (val != null && val !== '') return String(val).trim();
      }
    }
    return '';
  };

  const fullName = String(get(['child name', 'name']) || '').trim();
  if (!fullName) return null; // skip empty rows

  // Split full name into first/last
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || fullName;
  const lastName  = nameParts.slice(1).join(' ') || '';

  const classMap = {
    'NURSERY': 'Nursery', 'NURSUREY': 'Nursery', 'NURSURY': 'Nursery', 'NURS': 'Nursery',
    'LKG': 'LKG', 'UKG': 'UKG',
    '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '5': '5th',
    '6': '6th', '7': '7th', '8': '8th', '9': '9th', '10': '10th',
  };

  // ── Current class (CLASS column — NOT Admission Class) ──
  const rawCurrentClass = String(getCurrentClass() || '').trim().toUpperCase();
  const className = classMap[rawCurrentClass] || rawCurrentClass || '';

  // ── Admission Class (the class student was in when they FIRST joined school) ──
  const rawAdmClass = String(getAdmissionClass() || '').trim().toUpperCase();
  const admissionClass = classMap[rawAdmClass] || rawAdmClass || '';

  // ── Admission Year (e.g. "24-25") ──
  const admissionYear = getAdmissionYear();

  // ── Admission Number ──
  const admRaw = get(['admission number', 'adm no', 'admission no']);
  const admissionNo = admRaw
    ? `STPSTD${String(admRaw).trim().replace(/\.0+$/, '').replace(/^(STPSTD|STP|STD)/i, '')}`
    : '';

  // ── Aadhar Number (12-digit; Excel stores as scientific notation) ──
  const rawAadhar = get(['aadhar', 'aadhaar']);
  let aadharNumber = '';
  if (rawAadhar) {
    aadharNumber = typeof rawAadhar === 'number'
      ? Math.round(rawAadhar).toString()
      : String(rawAadhar).replace(/\D/g, '');
  }

  return {
    fullName,
    firstName,
    lastName,
    dateOfBirth:  parseExcelDate(get(['dob', 'date of birth'])),
    gender:       String(get(['gender']) || 'Male').trim()
                    .replace(/^MALE$/i, 'Male').replace(/^FEMALE$/i, 'Female'),
    aadharNumber,
    category:     String(get(['caste']) || 'General').trim(),
    subCaste:     String(get(['sub-caste', 'sub caste', 'subcaste']) || '').trim(),
    fatherName:   String(get(['father name', 'father']) || '').trim(),
    motherName:   String(get(['mother name', 'mother']) || '').trim(),
    phoneNumber:  normalizePhone(get(['contact', 'phone', 'mobile'])),
    // ── Immutable — set once at import, never overwritten ──
    admissionNo,        // e.g. "STP3344"
    admissionYear,      // e.g. "24-25"
    admissionClass,     // e.g. "LKG" (class when they first enrolled)
    // ── Current enrollment ──
    className,          // e.g. "1st", "LKG" — from the CLASS column
    section:      'A',  // all students in section A
    admissionDate: new Date().toISOString().slice(0, 10),
    status:       'ACTIVE',
    nationality:  'Indian',
    mediumOfInstruction: 'English',
    academicYear: '2026-27',
  };
}


/**
 * Map a raw row from St. Paul's staff Excel to app employee model
 * Headers (row 5): S.No, Name, Qualification, Employment Nature,
 *                  Date of Appointment, Dob, Aadhar Number, Pan Number,
 *                  Designation, Subjects Taught, Contact Number
 */
function mapStaffRow(row, headers) {
  const get = (keys) => {
    for (const key of keys) {
      const idx = headers.findIndex(h => normHeader(h).includes(normHeader(key)));
      if (idx !== -1 && row[idx] !== null && row[idx] !== undefined && row[idx] !== '') {
        return row[idx];
      }
    }
    return '';
  };

  const rawName = String(get(['name']) || '').trim();
  if (!rawName || rawName === 'Name') return null;

  // Clean name (remove Mrs./Mr. prefix)
  const fullName = rawName.replace(/^(Mrs?\.|Dr\.|Ms\.)\s*/i, '').trim();
  // Split into firstName / lastName (format: SURNAME. FIRSTNAME MIDDLENAME)
  const dotParts = fullName.split('.');
  let lastName = '', firstName = fullName;
  if (dotParts.length >= 2) {
    lastName = dotParts[0].trim();
    firstName = dotParts.slice(1).join('.').trim();
  } else {
    const parts = fullName.split(/\s+/);
    firstName = parts[0] || fullName;
    lastName = parts.slice(1).join(' ');
  }

  const designation = String(get(['designation']) || 'Teacher').trim();
  const department = designation.toLowerCase().includes('principal')
    ? 'Management'
    : designation.toLowerCase().includes('lab')
    ? 'Labs'
    : designation.toLowerCase().includes('librar')
    ? 'Library'
    : 'Teaching';

  // ── Aadhar Number (12-digit; Excel stores in scientific notation e.g. 4.36E+11) ──
  const rawStaffAadhar = get(['aadhar', 'aadhaar']);
  let staffAadharNumber = '';
  if (rawStaffAadhar) {
    staffAadharNumber = typeof rawStaffAadhar === 'number'
      ? Math.round(rawStaffAadhar).toString()
      : String(rawStaffAadhar).replace(/[^0-9]/g, '');
  }

  // ── Employment Nature → map to app values ──
  const rawEmpNature = String(get(['employment nature', 'nature', 'employment']) || 'Permanent').trim();
  const employmentType = /probation/i.test(rawEmpNature) ? 'Contract'
    : /part.?time/i.test(rawEmpNature) ? 'Part-time'
    : 'Permanent';

  return {
    fullName: `${lastName} ${firstName}`.trim(),
    firstName,
    lastName,
    designation,
    department,
    role: designation,
    qualification: String(get(['qualification']) || '').replace(/\n/g, ', ').trim(),
    employmentType,
    joiningDate:    parseExcelDate(get(['date of appointment', 'appointment', 'joining'])),
    dateOfBirth:    parseExcelDate(get(['dob', 'date of birth', 'birth'])),
    aadharNumber:   staffAadharNumber,
    panNumber:      String(get(['pan number', 'pan']) || '').trim().toUpperCase(),
    subjectsTaught: String(get(['subjects taught', 'subject taught', 'subjects', 'subject']) || '').trim(),
    phoneNumber:    normalizePhone(get(['contact number', 'contact', 'phone', 'mobile'])),
    status: 'ACTIVE',
    email: '',
    address: 'Srikakulam',
  };
}


// ─── DETECT FILE TYPE & PARSE ─────────────────────────────────────────────────

/**
 * Parse a workbook sheet into rows
 * Returns { headers, rows, isStaffFormat }
 */
function parseSheet(ws) {
  // Get all rows as arrays
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (!raw.length) return { headers: [], rows: [], isStaffFormat: false };

  // Check if this is staff.xlsx format (school name in row 1, headers in row 5)
  const firstCell = String(raw[0]?.[0] || '').toLowerCase();
  const isStaffFormat = firstCell.includes("st.paul") || firstCell.includes("paul");

  let headerRowIdx = 0;
  if (isStaffFormat) {
    // Find the row that has "Name" or "S.No" after the school header rows
    for (let i = 0; i < Math.min(raw.length, 10); i++) {
      const r = raw[i];
      if (r && r.some(c => normHeader(c).includes('name') && normHeader(c) !== 'school name')) {
        headerRowIdx = i;
        break;
      }
    }
  }

  const headers = raw[headerRowIdx].map(h => String(h || '').trim());
  const dataRows = raw.slice(headerRowIdx + 1).filter(r =>
    r && r.some(c => c !== null && c !== undefined && c !== '')
  );

  return { headers, rows: dataRows, isStaffFormat };
}

/**
 * Parse a CSV text into { headers, rows }
 */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const cells = line.split(',');
    return headers.map((_, i) => (cells[i] || '').trim());
  });
  return { headers, rows };
}

// ─── IMPORT TYPE TABS ─────────────────────────────────────────────────────────
const IMPORT_TYPES = [
  { id: 'students', label: 'Students', icon: Users, color: 'from-indigo-500 to-violet-500', description: 'Import class-wise student data from Excel (Class 1–10, Nursery, LKG, UKG)' },
  { id: 'staff', label: 'Staff / Employees', icon: UserCheck, color: 'from-emerald-500 to-teal-500', description: 'Import staff register from staff.xlsx' },
];

// ─── SAMPLE TEMPLATES ─────────────────────────────────────────────────────────
const STUDENT_CSV_SAMPLE = `fullName,dateOfBirth,gender,className,section,admissionNo,aadharNumber,category,fatherName,motherName,phoneNumber,admissionYear
ARJI JOSHIK VARMA,2020-08-03,Male,1st,A,STP3344,,SC,INDRA MOHAN,NIRMALA,9676502045,2024-25
BATCHU CHENNA KESAVA,2019-12-08,Male,1st,A,STP3417,536304839920,BC-A,MURALI,HYMAVATHI,6303667839,2024-25`;

const STAFF_CSV_SAMPLE = `fullName,designation,department,qualification,employmentType,joiningDate,dateOfBirth,aadharNumber,panNumber,subjectsTaught,phoneNumber
VIJAYA SANTHA KUMARI TANUKU,PRINCIPAL,Management,"M.A. English, B.Ed",Permanent,1989-08-01,,,AHMPT6604N,,9490005998`;

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function BulkImport() {
  const [importType, setImportType] = useState('students');
  const [stage, setStage] = useState('upload'); // upload | preview | importing | done
  const [parsedData, setParsedData] = useState(null); // { headers, mappedRows, rawRows, fileName, isStaffFormat }
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [results, setResults] = useState({ success: [], failed: [] });
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  // ── File parsing ─────────────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();

    try {
      if (ext === 'xlsx' || ext === 'xls') {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: true });

        // For multi-sheet workbooks (e.g. if someone uploads all sheets), process first sheet
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const { headers, rows, isStaffFormat } = parseSheet(ws);

        // Auto-switch import type based on format
        const detectedType = isStaffFormat ? 'staff' : 'students';
        setImportType(detectedType);

        const mappedRows = rows
          .map(r => detectedType === 'staff' ? mapStaffRow(r, headers) : mapStudentRow(r, headers))
          .filter(Boolean);

        setParsedData({ headers, mappedRows, rawRows: rows, fileName: file.name, isStaffFormat });
        setStage('preview');
        toast.success(`Parsed ${mappedRows.length} ${detectedType} records from ${file.name}`);
      } else if (ext === 'csv') {
        const text = await file.text();
        const { headers, rows } = parseCSV(text);
        const mappedRows = rows.map(r => {
          // CSV rows are already mapped to header keys
          const obj = {};
          headers.forEach((h, i) => { obj[h] = r[i]; });
          return obj;
        });
        setParsedData({ headers, mappedRows, rawRows: rows, fileName: file.name, isStaffFormat: false });
        setStage('preview');
        toast.success(`Parsed ${mappedRows.length} rows from ${file.name}`);
      } else {
        toast.error('Please upload a .xlsx, .xls, or .csv file');
      }
    } catch (err) {
      console.error('Parse error:', err);
      toast.error('Failed to parse file: ' + err.message);
    }
  }, []);

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  // ── Import execution ──────────────────────────────────────────────────────
  const runImport = async () => {
    if (!parsedData?.mappedRows?.length) return;
    setStage('importing');
    const total = parsedData.mappedRows.length;
    setProgress({ done: 0, total, errors: 0 });
    const success = [], failed = [];

    // Pre-assign sequential STPEMP IDs for staff
    if (importType === 'staff') {
      const allEmps = await listEmployees();
      let max = 0;
      for (const e of allEmps) {
        if (e.employeeId && e.employeeId.toUpperCase().startsWith('STPEMP')) {
          const num = parseInt(e.employeeId.toUpperCase().replace('STPEMP', ''), 10);
          if (!isNaN(num) && num > max) max = num;
        }
      }
      for (let i = 0; i < parsedData.mappedRows.length; i++) {
        max++;
        parsedData.mappedRows[i].employeeId = `STPEMP${String(max).padStart(4, '0')}`;
      }
    }

    for (let i = 0; i < parsedData.mappedRows.length; i++) {
      const row = parsedData.mappedRows[i];
      try {
        if (importType === 'staff') {
          await addEmployee(row);
        } else {
          await addStudent(row);
        }
        success.push(row);
      } catch (err) {
        failed.push({ row, error: err.message });
      }
      setProgress({ done: i + 1, total, errors: failed.length });
      // Small delay to avoid hammering Firestore rate limits
      if ((i + 1) % 20 === 0) await new Promise(r => setTimeout(r, 500));
    }

    setResults({ success, failed });
    setStage('done');
    if (failed.length === 0) {
      toast.success(`✅ Successfully imported ${success.length} ${importType} records!`);
    } else {
      toast.warning(`Imported ${success.length} records. ${failed.length} failed.`);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = () => {
    setParsedData(null);
    setProgress({ done: 0, total: 0, errors: 0 });
    setResults({ success: [], failed: [] });
    setStage('upload');
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── Download sample ───────────────────────────────────────────────────────
  const downloadSample = async () => {
    const csv = importType === 'staff' ? STAFF_CSV_SAMPLE : STUDENT_CSV_SAMPLE;
    const name = importType === 'staff' ? 'staff_sample.csv' : 'students_sample.csv';
    const blob = new Blob([csv], { type: 'text/csv' });
    const { saveBlob } = await import('../lib/mobileDownload');
    await saveBlob(blob, name);
  };

  return (
    <div className="space-y-6 max-w-6xl" data-testid="bulk-import">
      <NavLink to="/dashboard/students" className="label-eyebrow text-primary flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Students
      </NavLink>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tighter uppercase">
            Bulk Import
          </h1>
          <p className="label-eyebrow text-muted-foreground mt-1">
            Import students or staff from Excel / CSV files
          </p>
        </div>
        {stage === 'upload' && (
          <button
            onClick={downloadSample}
            className="h-10 px-4 rounded-2xl bg-muted hover:bg-muted/80 flex items-center gap-2 label-eyebrow transition-colors"
            data-testid="download-sample-btn"
          >
            <Download className="h-3.5 w-3.5" />
            Sample {importType === 'staff' ? 'Staff' : 'Student'} CSV
          </button>
        )}
        {stage !== 'upload' && (
          <button onClick={reset} className="h-10 px-4 rounded-2xl bg-muted hover:bg-muted/80 flex items-center gap-2 label-eyebrow transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> New Import
          </button>
        )}
      </div>

      {/* ── Type Tabs ── */}
      {stage === 'upload' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {IMPORT_TYPES.map((t) => (
            <motion.button
              key={t.id}
              onClick={() => setImportType(t.id)}
              whileHover={{ y: -3, scale: 1.01 }}
              className={`glass-morphism rounded-[2rem] p-5 text-left transition-all border-2 ${importType === t.id ? 'border-primary' : 'border-transparent'}`}
              data-testid={`import-type-${t.id}`}
            >
              <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${t.color} grid place-items-center text-white mb-3`}>
                <t.icon className="h-5 w-5" />
              </div>
              <div className="font-bold">{t.label}</div>
              <div className="label-eyebrow text-muted-foreground mt-1">{t.description}</div>
            </motion.button>
          ))}
        </div>
      )}

      {/* ── Stage: Upload ── */}
      <AnimatePresence mode="wait">
        {stage === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">

            {/* Format guide */}
            <div className="glass-morphism rounded-[2rem] p-4 flex gap-3 items-start">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                {importType === 'students' ? (
                  <>Upload the class-wise Excel files (<code className="bg-muted px-1 rounded">1.xlsx</code>, <code className="bg-muted px-1 rounded">2.xlsx</code> … <code className="bg-muted px-1 rounded">LKG.xlsx</code>, <code className="bg-muted px-1 rounded">UKG.xlsx</code>, <code className="bg-muted px-1 rounded">NURSERY.xlsx</code>). The app will auto-detect the St. Paul's format and map all columns.</>
                ) : (
                  <>Upload <code className="bg-muted px-1 rounded">staff.xlsx</code>. The school name header rows will be skipped and the staff register will be imported automatically.</>
                )}
              </div>
            </div>

            {/* Drop zone */}
            <motion.label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              whileHover={{ y: -3 }}
              animate={dragOver ? { scale: 1.02, borderColor: 'var(--primary)' } : {}}
              className={`block glass-morphism rounded-[2rem] p-10 border-2 border-dashed cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => processFile(e.target.files?.[0])}
                className="hidden"
                data-testid="xlsx-file-input"
              />
              <div className="text-center">
                <div className="h-16 w-16 rounded-3xl bg-primary/10 grid place-items-center mx-auto">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
                <div className="mt-4 font-bold text-lg">
                  {dragOver ? 'Drop it!' : 'Drop file here or click to browse'}
                </div>
                <div className="label-eyebrow text-muted-foreground mt-2">
                  Supports .xlsx · .xls · .csv — up to 1,000 rows
                </div>
              </div>
            </motion.label>
          </motion.div>
        )}

        {/* ── Stage: Preview ── */}
        {stage === 'preview' && parsedData && (
          <motion.div key="preview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Summary bar */}
            <div className="glass-morphism rounded-[2rem] p-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-emerald-500/15 grid place-items-center">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                </div>
                <span className="font-bold text-sm">{parsedData.fileName}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 label-eyebrow text-primary">
                <Eye className="h-3 w-3" />
                {parsedData.mappedRows.length} records ready
              </div>
              {parsedData.isStaffFormat && (
                <div className="px-3 py-1 rounded-full bg-amber-500/10 label-eyebrow text-amber-600">
                  Staff format detected
                </div>
              )}
              <button
                onClick={runImport}
                className="ml-auto h-10 px-5 rounded-2xl bg-emerald-500 text-white label-eyebrow flex items-center gap-2 hover:bg-emerald-600 transition-colors"
                data-testid="commit-import-btn"
              >
                <Play className="h-3.5 w-3.5" />
                Import {parsedData.mappedRows.length} Records
              </button>
            </div>

            {/* Preview table */}
            <div className="glass-morphism rounded-[2rem] p-5">
              <div className="label-eyebrow text-muted-foreground mb-3">
                Preview (first 20 rows of {parsedData.mappedRows.length})
              </div>
              <div className="overflow-x-auto thin-scrollbar">
                <table className="w-full text-xs min-w-max">
                  <thead>
                    <tr className="text-left">
                      {importType === 'students' ? (
                        ['#', 'Full Name', 'DOB', 'Gender', 'Aadhar No', 'Adm No', 'Adm Year', 'Adm Class', 'Current Class', 'Sec', 'Father', 'Mother', 'Phone', 'Category'].map(h => (
                          <th key={h} className="label-eyebrow text-muted-foreground p-2 whitespace-nowrap">{h}</th>
                        ))
                      ) : (
                        ['#', 'Full Name', 'Designation', 'Dept', 'Emp Nature', 'DOB', 'Aadhar No', 'PAN No', 'Joining Date', 'Phone', 'Subjects', 'Qualification'].map(h => (
                          <th key={h} className="label-eyebrow text-muted-foreground p-2 whitespace-nowrap">{h}</th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.mappedRows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t border-border hover:bg-muted/20">
                        {importType === 'students' ? (
                          <>
                            <td className="p-2 font-mono text-muted-foreground">{i + 1}</td>
                            <td className="p-2 font-bold whitespace-nowrap">{r.fullName}</td>
                            <td className="p-2 whitespace-nowrap">{r.dateOfBirth}</td>
                            <td className="p-2">{r.gender}</td>
                            <td className="p-2 font-mono text-xs">{r.aadharNumber || '—'}</td>
                            <td className="p-2 font-mono">{r.admissionNo}</td>
                            <td className="p-2 font-bold text-amber-600">{r.admissionYear || '—'}</td>
                            <td className="p-2 font-bold text-violet-600">{r.admissionClass || '—'}</td>
                            <td className="p-2 font-bold text-emerald-600">{r.className}</td>
                            <td className="p-2 font-bold">{r.section}</td>
                            <td className="p-2 whitespace-nowrap">{r.fatherName}</td>
                            <td className="p-2 whitespace-nowrap">{r.motherName}</td>
                            <td className="p-2 font-mono">{r.phoneNumber}</td>
                            <td className="p-2">{r.category}</td>
                          </>
                        ) : (
                          <>
                            <td className="p-2 font-mono text-muted-foreground">{i + 1}</td>
                            <td className="p-2 font-bold whitespace-nowrap">{r.fullName}</td>
                            <td className="p-2 whitespace-nowrap">{r.designation}</td>
                            <td className="p-2">{r.department}</td>
                            <td className="p-2 font-bold">{r.employmentType}</td>
                            <td className="p-2 whitespace-nowrap">{r.dateOfBirth || '—'}</td>
                            <td className="p-2 font-mono text-xs">{r.aadharNumber || '—'}</td>
                            <td className="p-2 font-mono text-xs">{r.panNumber || '—'}</td>
                            <td className="p-2 whitespace-nowrap">{r.joiningDate || '—'}</td>
                            <td className="p-2 font-mono">{r.phoneNumber}</td>
                            <td className="p-2 truncate max-w-40" title={r.subjectsTaught}>{r.subjectsTaught || '—'}</td>
                            <td className="p-2 max-w-48 truncate" title={r.qualification}>{r.qualification || '—'}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.mappedRows.length > 20 && (
                  <div className="text-center label-eyebrow text-muted-foreground mt-3 py-2">
                    …and {parsedData.mappedRows.length - 20} more records
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Stage: Importing ── */}
        {stage === 'importing' && (
          <motion.div key="importing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="glass-morphism rounded-[2rem] p-8 text-center space-y-5">
              <div className="h-20 w-20 rounded-3xl bg-primary/10 grid place-items-center mx-auto">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              </div>
              <div>
                <div className="font-bold text-xl">Importing records to Firestore…</div>
                <div className="label-eyebrow text-muted-foreground mt-1">
                  Please keep this tab open
                </div>
              </div>
              {/* Progress bar */}
              <div className="max-w-sm mx-auto space-y-2">
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: '0%' }}
                    animate={{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%' }}
                    transition={{ ease: 'linear' }}
                  />
                </div>
                <div className="flex justify-between label-eyebrow text-muted-foreground">
                  <span>{progress.done} / {progress.total}</span>
                  {progress.errors > 0 && (
                    <span className="text-rose-500">{progress.errors} errors</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Stage: Done ── */}
        {stage === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            {/* Success card */}
            <div className="glass-morphism rounded-[2rem] p-8 text-center space-y-4">
              <div className="h-20 w-20 rounded-3xl bg-emerald-500/15 grid place-items-center mx-auto">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              <div>
                <div className="font-black text-2xl tracking-tight">Import Complete!</div>
                <div className="label-eyebrow text-muted-foreground mt-1">
                  {results.success.length} records successfully saved to Firestore
                </div>
              </div>
              <div className="flex justify-center gap-4 flex-wrap">
                <div className="px-4 py-2 rounded-2xl bg-emerald-500/10 text-emerald-600 label-eyebrow">
                  ✅ {results.success.length} imported
                </div>
                {results.failed.length > 0 && (
                  <div className="px-4 py-2 rounded-2xl bg-rose-500/10 text-rose-500 label-eyebrow">
                    ❌ {results.failed.length} failed
                  </div>
                )}
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={reset}
                  className="h-10 px-5 rounded-2xl bg-muted label-eyebrow hover:bg-muted/80 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Import More
                </button>
                <NavLink
                  to={importType === 'staff' ? '/dashboard/employees' : '/dashboard/students/directory'}
                  className="h-10 px-5 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2 hover:opacity-90 transition-opacity"
                >
                  View {importType === 'staff' ? 'Employees' : 'Students'} <ChevronRight className="h-3.5 w-3.5" />
                </NavLink>
              </div>
            </div>

            {/* Failed rows */}
            {results.failed.length > 0 && (
              <div className="glass-morphism rounded-[2rem] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <div className="label-eyebrow text-amber-600">{results.failed.length} failed records</div>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto thin-scrollbar">
                  {results.failed.map((f, i) => (
                    <div key={i} className="text-xs p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 flex items-start gap-2">
                      <X className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">{f.row?.fullName || `Row ${i + 1}`}</div>
                        <div className="text-muted-foreground">{f.error}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

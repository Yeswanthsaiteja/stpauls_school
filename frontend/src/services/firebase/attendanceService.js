/**
 * attendanceService.js — Firestore CRUD for attendance.
 * No composite indexes. No demoStore. Pure Firestore.
 */
import {
  collection, doc, getDoc, getDocs, setDoc, serverTimestamp, query, where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe, queryDocs } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';
const COL = 'attendance';

const attCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function guard() { return isFirebaseConfigured && !!db; }

/** Get attendance for a class-section on a specific date. */
export async function getAttendance(className, section, date) {
  if (!guard()) return {};
  const docId = `${TENANT_ID}_${className}_${section}_${date}`;
  return safe(async () => {
    const snap = await getDoc(doc(db, COL, docId));
    return snap.exists() ? (snap.data().records || {}) : {};
  }, {});
}

/** Save attendance for a class-section on a date. records = { studentId: 'PRESENT'|'ABSENT'|'LATE' } */
export async function saveAttendance(className, section, date, records, markedBy = 'Admin') {
  if (!guard()) throw new Error('Firebase is not configured. Cannot save attendance.');
  const docId = `${TENANT_ID}_${className}_${section}_${date}`;
  const present = Object.values(records).filter((s) => s === 'PRESENT').length;
  const absent  = Object.values(records).filter((s) => s === 'ABSENT').length;
  const late    = Object.values(records).filter((s) => s === 'LATE').length;
  // Do NOT use safe() here — let errors propagate so the caller can show proper feedback
  await setDoc(doc(db, COL, docId), {
    tenantId: TENANT_ID, className, section, date, records,
    present, absent, late, markedBy, updatedAt: serverTimestamp(),
  }, { merge: true });
  attCache.clear();
}

/** List all attendance records (client-side filtered). */
export async function listAttendance(args = {}) {
  const { className, date } = args;
  const cacheKey = 'list_' + JSON.stringify(args);
  if (attCache.has(cacheKey)) {
    const { data, timestamp } = attCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return [];
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (className) constraints.push(where('className', '==', className));
    if (date) constraints.push(where('date', '==', date));
    
    const list = await queryDocs(COL, ...constraints);
    attCache.set(cacheKey, { data: list, timestamp: Date.now() });
    return list;
  }, []);
}

/** Get attendance summary for a student over a date range. */
export async function getStudentAttendanceSummary(studentId) {
  const cacheKey = 'summary_' + studentId;
  if (attCache.has(cacheKey)) {
    const { data, timestamp } = attCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return { present: 0, absent: 0, late: 0, total: 0 };
  return safe(async () => {
    // Only fetch attendance documents that contain an entry for this specific student
    const list = await queryDocs(
      COL,
      where('tenantId', '==', TENANT_ID),
      where(`records.${studentId}`, 'in', ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY'])
    );
    
    let present = 0, absent = 0, late = 0;
    list.forEach((data) => {
      const status = (data.records || {})[studentId];
      if (status === 'PRESENT') present++;
      else if (status === 'ABSENT') absent++;
      else if (status === 'LATE') late++;
    });
    const total = present + absent + late;
    const result = { present, absent, late, total, pct: total ? Math.round((present / total) * 100) : 0 };
    attCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }, { present: 0, absent: 0, late: 0, total: 0, pct: 0 });
}

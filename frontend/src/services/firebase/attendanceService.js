/**
 * attendanceService.js — Firestore CRUD for attendance.
 * No composite indexes. No demoStore. Pure Firestore.
 */
import {
  collection, doc, getDoc, getDocs, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';
const COL = 'attendance';

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
}

/** List all attendance records (client-side filtered). */
export async function listAttendance({ className, date } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    const snap = await getDocs(collection(db, COL));
    let list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => !r.tenantId || r.tenantId === TENANT_ID);
    if (className) list = list.filter((r) => r.className === className);
    if (date)      list = list.filter((r) => r.date      === date);
    return list;
  }, []);
}

/** Get attendance summary for a student over a date range. */
export async function getStudentAttendanceSummary(studentId) {
  if (!guard()) return { present: 0, absent: 0, late: 0, total: 0 };
  return safe(async () => {
    const snap = await getDocs(collection(db, COL));
    let present = 0, absent = 0, late = 0;
    snap.docs.forEach((d) => {
      const data = d.data();
      if (!data.tenantId || data.tenantId !== TENANT_ID) return;
      const status = (data.records || {})[studentId];
      if (status === 'PRESENT') present++;
      else if (status === 'ABSENT') absent++;
      else if (status === 'LATE') late++;
    });
    const total = present + absent + late;
    return { present, absent, late, total, pct: total ? Math.round((present / total) * 100) : 0 };
  }, { present: 0, absent: 0, late: 0, total: 0, pct: 0 });
}

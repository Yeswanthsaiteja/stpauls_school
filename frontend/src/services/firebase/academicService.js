/**
 * academicService.js — Firestore CRUD for academic collections.
 * No composite indexes. No demoStore. Pure Firestore.
 */
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';

function guard() { return isFirebaseConfigured && !!db; }

async function fetchCol(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => !r.tenantId || r.tenantId === TENANT_ID);
}

// Helper: convert Firestore Timestamp, seconds-object, or string → ms for sorting
function toMs(v) {
  if (!v) return 0;
  if (typeof v === 'object' && typeof v.toDate === 'function') return v.toDate().getTime();
  if (typeof v === 'object' && v.seconds) return v.seconds * 1000;
  const n = Number(v);
  if (!isNaN(n)) return n;
  return new Date(v).getTime() || 0;
}

// ─── Classes ──────────────────────────────────────────────────────────────────
export async function listClasses() {
  if (!guard()) return [];
  return safe(async () => (await fetchCol('classes')).sort((a, b) => (a.name || '').localeCompare(b.name || '')), []);
}
export async function addClass(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'classes'), payload); return { id: r.id, ...data }; }, null);
}
export async function updateClass(id, patch) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'classes', id), { ...patch, updatedAt: serverTimestamp() }));
}
export async function deleteClass(id) {
  if (!guard()) return;
  await safe(() => deleteDoc(doc(db, 'classes', id)));
}

// ─── Subjects ─────────────────────────────────────────────────────────────────
export async function listSubjects({ className } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    let list = await fetchCol('subjects');
    if (className) list = list.filter((s) => s.className === className);
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, []);
}
export async function addSubject(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'subjects'), payload); return { id: r.id, ...data }; }, null);
}
export async function updateSubject(id, patch) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'subjects', id), { ...patch, updatedAt: serverTimestamp() }));
}
export async function deleteSubject(id) {
  if (!guard()) return;
  await safe(() => deleteDoc(doc(db, 'subjects', id)));
}

// ─── Topics ───────────────────────────────────────────────────────────────────
export async function listTopics({ subjectId } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    let list = await fetchCol('topics');
    if (subjectId) list = list.filter((t) => t.subjectId === subjectId);
    // Fix: Firestore Timestamps can't be compared with localeCompare — use toMs()
    return list.sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));
  }, []);
}
export async function addTopic(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, status: data.status || 'PENDING', createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'topics'), payload); return { id: r.id, ...data, status: payload.status }; }, null);
}
export async function updateTopic(id, patch) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'topics', id), { ...patch, updatedAt: serverTimestamp() }));
}
export async function deleteTopic(id) {
  if (!guard()) return;
  await safe(() => deleteDoc(doc(db, 'topics', id)));
}

// ─── Timetable ────────────────────────────────────────────────────────────────
export async function getTimetable(className, section) {
  if (!guard()) return null;
  return safe(async () => {
    const id = `${TENANT_ID}_${className}_${section}`;
    const snap = await getDoc(doc(db, 'timetables', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }, null);
}
export async function saveTimetable(className, section, slots) {
  if (!guard()) return;
  const id = `${TENANT_ID}_${className}_${section}`;
  await safe(() => setDoc(doc(db, 'timetables', id), { tenantId: TENANT_ID, className, section, slots, updatedAt: serverTimestamp() }, { merge: true }));
}

// ─── Results ──────────────────────────────────────────────────────────────────
export async function listResults({ className, examType, studentId } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    let list = await fetchCol('results');
    if (className) list = list.filter((r) => r.className === className);
    if (examType)  list = list.filter((r) => r.examType  === examType);
    if (studentId) list = list.filter((r) => r.studentId === studentId);
    return list;
  }, []);
}
export async function saveResult(data) {
  if (!guard()) return null;
  const id = `${TENANT_ID}_${data.studentId}_${data.examType}_${(data.subject || data.subjectId || '').replace(/\s+/g, '_')}`;
  await safe(() => setDoc(doc(db, 'results', id), { ...data, tenantId: TENANT_ID, updatedAt: serverTimestamp() }, { merge: true }));
  return { id, ...data };
}
export async function bulkSaveResults(rows) {
  if (!guard()) return [];
  const results = await Promise.all(rows.map(r => saveResult(r)));
  return results.filter(Boolean);
}

// ─── Lesson Plans ─────────────────────────────────────────────────────────────
export async function listLessonPlans({ className } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    let list = await fetchCol('lesson_plans');
    if (className) list = list.filter((l) => l.className === className);
    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, []);
}
export async function addLessonPlan(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'lesson_plans'), payload); return { id: r.id, ...data }; }, null);
}
export async function updateLessonPlan(id, patch) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'lesson_plans', id), { ...patch, updatedAt: serverTimestamp() }));
}

// ─── Attendance ───────────────────────────────────────────────────────────────
export async function listAttendance({ className, date, studentId } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    let list = await fetchCol('attendance');
    if (className) list = list.filter((a) => a.className === className);
    if (date)      list = list.filter((a) => a.date      === date);
    if (studentId) list = list.filter((a) => a.studentId === studentId);
    return list;
  }, []);
}
export async function saveAttendance(data) {
  if (!guard()) return null;
  const id = `${TENANT_ID}_${data.className}_${data.section}_${data.date}`;
  await safe(() => setDoc(doc(db, 'attendance', id), { ...data, tenantId: TENANT_ID, updatedAt: serverTimestamp() }, { merge: true }));
  return { id, ...data };
}

// ─── Year-End Promotion ───────────────────────────────────────────────────────
export async function promoteStudents(fromClass, toClass, studentIds) {
  if (!guard()) return { promoted: 0 };
  return safe(async () => {
    for (const sid of studentIds) {
      await updateDoc(doc(db, 'students', sid), { className: toClass, promotedFrom: fromClass, promotedAt: serverTimestamp() });
    }
    return { promoted: studentIds.length };
  }, { promoted: 0 });
}

// ─── Exam Setup ───────────────────────────────────────────────────────────────
export async function listExamSetups() {
  if (!guard()) return [];
  return safe(async () => (await fetchCol('exam_setup')).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt)), []);
}
export async function addExamSetup(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'exam_setup'), payload); return { id: r.id, ...data }; }, null);
}
export async function updateExamSetup(id, patch) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'exam_setup', id), { ...patch, updatedAt: serverTimestamp() }));
}
export async function deleteExamSetup(id) {
  if (!guard()) return;
  await safe(() => deleteDoc(doc(db, 'exam_setup', id)));
}

/**
 * academicService.js — Firestore CRUD for academic collections.
 * No composite indexes. No demoStore. Pure Firestore.
 */
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, setDoc, query, where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe, getDocsCached, invalidateCache as firestoreInvalidateCache, queryDocs } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';

const listCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function invalidateCache(key) {
  listCache.clear();
  firestoreInvalidateCache(key);
}

function guard() { return isFirebaseConfigured && !!db; }

async function fetchCol(name) {
  const snap = await getDocsCached(name);
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
  const cacheKey = 'classes_all';
  if (listCache.has(cacheKey)) {
    const { data, timestamp } = listCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return [];
  return safe(async () => {
    const rawClasses = await fetchCol('classes');
    const classMap = new Map();
    
    rawClasses.forEach(cls => {
      if (!cls.name) return;
      const key = cls.name.trim().toLowerCase();
      if (classMap.has(key)) {
        const existing = classMap.get(key);
        const mergedSections = Array.from(new Set([...(existing.sections || []), ...(cls.sections || [])]));
        existing.sections = mergedSections.sort();
      } else {
        classMap.set(key, { ...cls, name: cls.name.trim(), sections: [...(cls.sections || [])].sort() });
      }
    });

    const sorted = Array.from(classMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    listCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
    return sorted;
  }, []);
}
export async function addClass(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => {
    const r = await addDoc(collection(db, 'classes'), payload);
    invalidateCache('classes');
    return { id: r.id, ...data };
  }, null);
}
export async function updateClass(id, patch) {
  if (!guard()) return;
  await safe(async () => {
    await updateDoc(doc(db, 'classes', id), { ...patch, updatedAt: serverTimestamp() });
    invalidateCache('classes');
  });
}
export async function deleteClass(id) {
  if (!guard()) return;
  await safe(async () => {
    await deleteDoc(doc(db, 'classes', id));
    invalidateCache('classes');
  });
}

// ─── Subjects ─────────────────────────────────────────────────────────────────
export async function listSubjects(args = {}) {
  const { className } = args;
  const cacheKey = 'subjects_' + JSON.stringify(args);
  if (listCache.has(cacheKey)) {
    const { data, timestamp } = listCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return [];
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (className) constraints.push(where('className', '==', className));
    
    let list = await queryDocs('subjects', ...constraints);
    const sorted = list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    listCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
    return sorted;
  }, []);
}
export async function addSubject(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => {
    const r = await addDoc(collection(db, 'subjects'), payload);
    invalidateCache('subjects');
    return { id: r.id, ...data };
  }, null);
}
export async function updateSubject(id, patch) {
  if (!guard()) return;
  await safe(async () => {
    await updateDoc(doc(db, 'subjects', id), { ...patch, updatedAt: serverTimestamp() });
    invalidateCache('subjects');
  });
}
export async function deleteSubject(id) {
  if (!guard()) return;
  await safe(async () => {
    await deleteDoc(doc(db, 'subjects', id));
    invalidateCache('subjects');
  });
}

// ─── Topics ───────────────────────────────────────────────────────────────────
export async function listTopics(args = {}) {
  const { subjectId } = args;
  const cacheKey = 'topics_' + JSON.stringify(args);
  if (listCache.has(cacheKey)) {
    const { data, timestamp } = listCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return [];
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (subjectId) constraints.push(where('subjectId', '==', subjectId));
    
    let list = await queryDocs('topics', ...constraints);
    // Fix: Firestore Timestamps can't be compared with localeCompare — use toMs()
    const sorted = list.sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));
    listCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
    return sorted;
  }, []);
}
export async function addTopic(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, status: data.status || 'PENDING', createdAt: serverTimestamp() };
  return safe(async () => {
    const r = await addDoc(collection(db, 'topics'), payload);
    invalidateCache('topics');
    return { id: r.id, ...data, status: payload.status };
  }, null);
}
export async function updateTopic(id, patch) {
  if (!guard()) return;
  await safe(async () => {
    await updateDoc(doc(db, 'topics', id), { ...patch, updatedAt: serverTimestamp() });
    invalidateCache('topics');
  });
}
export async function deleteTopic(id) {
  if (!guard()) return;
  await safe(async () => {
    await deleteDoc(doc(db, 'topics', id));
    invalidateCache('topics');
  });
}

// ─── Timetable ────────────────────────────────────────────────────────────────
export async function getTimetable(className, section) {
  const cacheKey = 'timetable_' + className + '_' + section;
  if (listCache.has(cacheKey)) {
    const { data, timestamp } = listCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return null;
  return safe(async () => {
    let id = `${TENANT_ID}_${className}_${section}`;
    let snap = await getDoc(doc(db, 'timetables', id));
    if (!snap.exists() && section) {
      id = `${TENANT_ID}_${className}_`;
      snap = await getDoc(doc(db, 'timetables', id));
    }
    const result = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    listCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }, null);
}
export async function saveTimetable(className, section, slots) {
  if (!guard()) return;
  const id = `${TENANT_ID}_${className}_${section}`;
  await safe(async () => {
    await setDoc(doc(db, 'timetables', id), { tenantId: TENANT_ID, className, section, slots, updatedAt: serverTimestamp() }, { merge: true });
    invalidateCache('timetables');
  });
}

// ─── Results ──────────────────────────────────────────────────────────────────
export async function listResults(args = {}) {
  const { className, examType, studentId } = args;
  const cacheKey = 'results_' + JSON.stringify(args);
  if (listCache.has(cacheKey)) {
    const { data, timestamp } = listCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return [];
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (studentId) constraints.push(where('studentId', '==', studentId));
    else if (className) constraints.push(where('className', '==', className));
    else if (examType) constraints.push(where('examType', '==', examType));
    
    let list = await queryDocs('results', ...constraints);
    
    // Apply remaining JS filters
    if (studentId) {
      if (className) list = list.filter((r) => r.className === className);
      if (examType)  list = list.filter((r) => r.examType  === examType);
    } else if (className) {
      if (examType)  list = list.filter((r) => r.examType  === examType);
    }
    
    listCache.set(cacheKey, { data: list, timestamp: Date.now() });
    return list;
  }, []);
}
export async function saveResult(data) {
  if (!guard()) return null;
  const id = `${TENANT_ID}_${data.studentId}_${data.examType}_${(data.subject || data.subjectId || '').replace(/[\s/]+/g, '_')}`;
  await safe(async () => {
    await setDoc(doc(db, 'results', id), { ...data, tenantId: TENANT_ID, updatedAt: serverTimestamp() }, { merge: true });
    invalidateCache('results');
  });
  return { id, ...data };
}
export async function bulkSaveResults(rows) {
  if (!guard()) return [];
  const results = await Promise.all(rows.map(r => saveResult(r)));
  return results.filter(Boolean);
}

// ─── Lesson Plans ─────────────────────────────────────────────────────────────
export async function listLessonPlans(args = {}) {
  const { className } = args;
  const cacheKey = 'lessonplans_' + JSON.stringify(args);
  if (listCache.has(cacheKey)) {
    const { data, timestamp } = listCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return [];
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (className) constraints.push(where('className', '==', className));
    
    let list = await queryDocs('lesson_plans', ...constraints);
    const sorted = list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    listCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
    return sorted;
  }, []);
}
export async function addLessonPlan(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => {
    const r = await addDoc(collection(db, 'lesson_plans'), payload);
    invalidateCache('lesson_plans');
    return { id: r.id, ...data };
  }, null);
}
export async function updateLessonPlan(id, patch) {
  if (!guard()) return;
  await safe(async () => {
    await updateDoc(doc(db, 'lesson_plans', id), { ...patch, updatedAt: serverTimestamp() });
    invalidateCache('lesson_plans');
  });
}

// ─── Attendance ───────────────────────────────────────────────────────────────
export async function listAttendance(args = {}) {
  const { className, date, studentId } = args;
  const cacheKey = 'attendance_' + JSON.stringify(args);
  if (listCache.has(cacheKey)) {
    const { data, timestamp } = listCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return [];
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (studentId) constraints.push(where('studentId', '==', studentId));
    else if (className) constraints.push(where('className', '==', className));
    else if (date) constraints.push(where('date', '==', date));
    
    let list = await queryDocs('attendance', ...constraints);
    
    // Apply remaining JS filters
    if (studentId) {
      if (className) list = list.filter((a) => a.className === className);
      if (date) list = list.filter((a) => a.date === date);
    } else if (className) {
      if (date) list = list.filter((a) => a.date === date);
    }
    
    listCache.set(cacheKey, { data: list, timestamp: Date.now() });
    return list;
  }, []);
}
export async function saveAttendance(data) {
  if (!guard()) return null;
  const id = `${TENANT_ID}_${data.className}_${data.section}_${data.date}`;
  await safe(async () => {
    await setDoc(doc(db, 'attendance', id), { ...data, tenantId: TENANT_ID, updatedAt: serverTimestamp() }, { merge: true });
    invalidateCache('attendance');
  });
  return { id, ...data };
}

// ─── Year-End Promotion ───────────────────────────────────────────────────────
export async function promoteStudents(fromClass, toClass, studentIds) {
  if (!guard()) return { promoted: 0 };
  return safe(async () => {
    for (const sid of studentIds) {
      await updateDoc(doc(db, 'students', sid), { className: toClass, promotedFrom: fromClass, promotedAt: serverTimestamp() });
    }
    invalidateCache('students');
    return { promoted: studentIds.length };
  }, { promoted: 0 });
}

// ─── Exam Setup ───────────────────────────────────────────────────────────────
export async function listExamSetups() {
  const cacheKey = 'examsetup_all';
  if (listCache.has(cacheKey)) {
    const { data, timestamp } = listCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return [];
  return safe(async () => {
    const list = (await fetchCol('exam_setup')).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    listCache.set(cacheKey, { data: list, timestamp: Date.now() });
    return list;
  }, []);
}
export async function addExamSetup(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => {
    const r = await addDoc(collection(db, 'exam_setup'), payload);
    invalidateCache('exam_setup');
    return { id: r.id, ...data };
  }, null);
}
export async function updateExamSetup(id, patch) {
  if (!guard()) return;
  await safe(async () => {
    await updateDoc(doc(db, 'exam_setup', id), { ...patch, updatedAt: serverTimestamp() });
    invalidateCache('exam_setup');
  });
}
export async function deleteExamSetup(id) {
  if (!guard()) return;
  await safe(async () => {
    await deleteDoc(doc(db, 'exam_setup', id));
    invalidateCache('exam_setup');
  });
}

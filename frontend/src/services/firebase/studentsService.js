/**
 * studentsService.js — Firestore CRUD for students.
 * Uses simple getDocs(collection) + client-side filter to avoid composite index errors.
 */
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, query, where, getCountFromServer,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe, getDocsCached, invalidateCache, queryDocs } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';
const COL = 'students';

// Get all students from Firestore (no composite index needed)
async function fetchAll() {
  const snap = await getDocsCached(COL);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => s.tenantId === TENANT_ID);
}

const listCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function listStudents(args = {}) {
  const { className, section, status, academicYear } = args;
  const cacheKey = JSON.stringify(args);
  
  if (listCache.has(cacheKey)) {
    const { data, timestamp } = listCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }

  if (!isFirebaseConfigured || !db) { console.error('Firebase not configured'); return []; }
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (className) constraints.push(where('className', '==', className));
    else if (academicYear) constraints.push(where('academicYear', '==', academicYear));
    else if (status) constraints.push(where('status', '==', status));
    
    let list = await queryDocs(COL, ...constraints);
    
    // JS filters
    if (academicYear && className) list = list.filter((s) => s.academicYear === academicYear);
    if (section) list = list.filter((s) => s.section === section);
    if (status && (className || academicYear)) list = list.filter((s) => s.status === status);
    
    const sortedList = list.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    listCache.set(cacheKey, { data: sortedList, timestamp: Date.now() });
    return sortedList;
  }, []);
}

export async function getStudentsCount({ status } = {}) {
  if (!isFirebaseConfigured || !db) return 0;
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (status) constraints.push(where('status', '==', status));
    
    const q = query(collection(db, COL), ...constraints);
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  }, 0);
}

export async function getStudent(id) {
  if (!isFirebaseConfigured || !db) return null;
  return safe(async () => {
    const snap = await getDoc(doc(db, COL, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }, null);
}

export async function addStudent(data) {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase not configured');
  let admissionNo = data.admissionNo;
  if (!admissionNo) {
    const list = await fetchAll();
    let max = 0;
    for (const s of list) {
      if (s.admissionNo && s.admissionNo.toLowerCase().startsWith('stpstd')) {
        const num = parseInt(s.admissionNo.toLowerCase().replace('stpstd', ''), 10);
        if (!isNaN(num) && num > max) max = num;
      }
    }
    admissionNo = `STPSTD${String(max + 1).padStart(5, '0')}`;
  }
  const payload = {
    ...data,
    admissionNo,
    tenantId: TENANT_ID,
    status: data.status || 'ACTIVE',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  return safe(async () => {
    const r = await addDoc(collection(db, COL), { ...payload, tenantId: TENANT_ID });
    listCache.clear();
    invalidateCache(COL);
    return { id: r.id, ...payload };
  }, null);
}

export async function updateStudent(id, patch) {
  if (!isFirebaseConfigured || !db) return;
  // These fields are set at admission time and must never be overwritten
  const { admissionYear, admissionClass, admissionNo, tenantId, createdAt, ...safePatch } = patch;
  await safe(async () => {
    await updateDoc(doc(db, COL, id), { ...safePatch, updatedAt: serverTimestamp() });
    invalidateCache(COL);
  });
}

export async function removeStudent(id, reason = '') {
  if (!isFirebaseConfigured || !db) return;
  await safe(async () => {
    await updateDoc(doc(db, COL, id), {
      status: 'REMOVED', removalReason: reason,
      removedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    invalidateCache(COL);
  });
}

export async function rejoinStudent(id) {
  if (!isFirebaseConfigured || !db) return;
  await safe(async () => {
    await updateDoc(doc(db, COL, id), { status: 'ACTIVE', rejoinedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    invalidateCache(COL);
  });
}

export async function deleteStudent(id) {
  if (!isFirebaseConfigured || !db) return;
  await safe(async () => {
    await deleteDoc(doc(db, COL, id));
    listCache.clear();
    invalidateCache(COL);
  });
}

export async function searchStudents(term, { status = 'ACTIVE', academicYear } = {}) {
  const all = await listStudents({ status, academicYear });
  const t = term.toLowerCase();
  return all.filter(
    (s) =>
      s.fullName?.toLowerCase().includes(t) ||
      s.admissionNo?.toLowerCase().includes(t) ||
      s.phoneNumber?.includes(t),
  );
}

export async function bulkAddStudents(rows) {
  const results = [];
  for (const r of rows) {
    const result = await addStudent(r);
    if (result) results.push(result);
  }
  return results;
}

/**
 * studentsService.js — Firestore CRUD for students.
 * Uses simple getDocs(collection) + client-side filter to avoid composite index errors.
 */
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';
const COL = 'students';

// Get all students from Firestore (no composite index needed)
async function fetchAll() {
  const snap = await getDocs(collection(db, COL));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => s.tenantId === TENANT_ID);
}

export async function listStudents({ className, section, status } = {}) {
  if (!isFirebaseConfigured || !db) { console.error('Firebase not configured'); return []; }
  return safe(async () => {
    let list = await fetchAll();
    if (className) list = list.filter((s) => s.className === className);
    if (section)   list = list.filter((s) => s.section   === section);
    if (status)    list = list.filter((s) => s.status    === status);
    return list.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
  }, []);
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
  const admissionNo = data.admissionNo || `STP${Date.now().toString().slice(-6)}`;
  const payload = {
    ...data,
    admissionNo,
    tenantId: TENANT_ID,
    status: data.status || 'ACTIVE',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  return safe(async () => {
    const ref = await addDoc(collection(db, COL), payload);
    return { id: ref.id, ...payload };
  }, null);
}

export async function updateStudent(id, patch) {
  if (!isFirebaseConfigured || !db) return;
  await safe(() => updateDoc(doc(db, COL, id), { ...patch, updatedAt: serverTimestamp() }));
}

export async function removeStudent(id, reason = '') {
  if (!isFirebaseConfigured || !db) return;
  await safe(() =>
    updateDoc(doc(db, COL, id), {
      status: 'REMOVED', removalReason: reason,
      removedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }),
  );
}

export async function rejoinStudent(id) {
  if (!isFirebaseConfigured || !db) return;
  await safe(() =>
    updateDoc(doc(db, COL, id), { status: 'ACTIVE', rejoinedAt: serverTimestamp(), updatedAt: serverTimestamp() }),
  );
}

export async function deleteStudent(id) {
  if (!isFirebaseConfigured || !db) return;
  await safe(() => deleteDoc(doc(db, COL, id)));
}

export async function searchStudents(term, { status = 'ACTIVE' } = {}) {
  const all = await listStudents({ status });
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

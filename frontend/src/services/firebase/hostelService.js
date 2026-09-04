/**
 * hostelService.js — Firestore CRUD for hostel rooms and allocations
 */
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe, queryDocs } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';
const col = (name) => collection(db, name);
const tenantQ = (name, ...extra) => query(col(name), where('tenantId', '==', TENANT_ID), ...extra);

const hsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// ─── Rooms ────────────────────────────────────────────────────────────────────
export async function listRooms(args = {}) {
  const { block, type } = args;
  const cacheKey = 'rooms_' + JSON.stringify(args);
  if (hsCache.has(cacheKey)) {
    const { data, timestamp } = hsCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!isFirebaseConfigured || !db) return [];
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (block) constraints.push(where('block', '==', block));
    if (type) constraints.push(where('type', '==', type));
    
    let rows = await queryDocs('hostel_rooms', ...constraints);
    const sorted = rows.sort((a, b) => (a.block || '').localeCompare(b.block || '') || (a.number || '').localeCompare(b.number || ''));
    hsCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
    return sorted;
  }, []);
}
export async function addRoom(data) {
  if (!isFirebaseConfigured || !db) return null;
  return safe(async () => {
    const ref = await addDoc(col('hostel_rooms'), { ...data, tenantId: TENANT_ID, occupied: 0, createdAt: serverTimestamp() });
    hsCache.clear();
    return { id: ref.id, ...data, occupied: 0 };
  }, null);
}
export async function updateRoom(id, patch) {
  if (!isFirebaseConfigured || !db) return;
  await safe(async () => {
    await updateDoc(doc(db, 'hostel_rooms', id), { ...patch, updatedAt: serverTimestamp() });
    hsCache.clear();
  });
}

// ─── Allocations ──────────────────────────────────────────────────────────────
export async function listHostelAllocations(args = {}) {
  const { roomId, studentId } = args;
  const cacheKey = 'allocations_' + JSON.stringify(args);
  if (hsCache.has(cacheKey)) {
    const { data, timestamp } = hsCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!isFirebaseConfigured || !db) return [];
  return safe(async () => {
    let q = tenantQ('hostel_allocations');
    if (roomId)    q = query(col('hostel_allocations'), where('tenantId', '==', TENANT_ID), where('roomId',    '==', roomId));
    if (studentId) q = query(col('hostel_allocations'), where('tenantId', '==', TENANT_ID), where('studentId', '==', studentId));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    hsCache.set(cacheKey, { data: list, timestamp: Date.now() });
    return list;
  }, []);
}
export async function allocateRoom(data) {
  if (!isFirebaseConfigured || !db) return null;
  return safe(async () => {
    const ref = await addDoc(col('hostel_allocations'), { ...data, tenantId: TENANT_ID, allocatedAt: serverTimestamp() });
    // Increment occupied count
    if (data.roomId) await updateDoc(doc(db, 'hostel_rooms', data.roomId), { occupied: (data.currentOccupied || 0) + 1 });
    hsCache.clear();
    return { id: ref.id, ...data };
  }, {});
}
export async function vacateRoom(allocationId, roomId, currentOccupied) {
  if (!isFirebaseConfigured || !db) return;
  await safe(async () => {
    await deleteDoc(doc(db, 'hostel_allocations', allocationId));
    if (roomId) await updateDoc(doc(db, 'hostel_rooms', roomId), { occupied: Math.max(0, (currentOccupied || 1) - 1) });
    hsCache.clear();
  });
}

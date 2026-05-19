/**
 * operationsService.js — Firestore CRUD for transport, hostel, holidays.
 * No composite indexes. No demoStore. Pure Firestore.
 */
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp,
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

// ─── Transport Routes ─────────────────────────────────────────────────────────
export async function listTransportRoutes() {
  if (!guard()) return [];
  return safe(async () => (await fetchCol('transport_routes')).sort((a, b) => (a.code || '').localeCompare(b.code || '')), []);
}
export async function addTransportRoute(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'transport_routes'), payload); return { id: r.id, ...data }; }, null);
}
export async function updateTransportRoute(id, patch) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'transport_routes', id), { ...patch, updatedAt: serverTimestamp() }));
}
export async function deleteTransportRoute(id) {
  if (!guard()) return;
  await safe(() => deleteDoc(doc(db, 'transport_routes', id)));
}

// ─── Hostel Rooms ─────────────────────────────────────────────────────────────
export async function listHostelRooms({ type, status } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    let list = await fetchCol('hostel_rooms');
    if (type)   list = list.filter((r) => r.type   === type);
    if (status) list = list.filter((r) => r.status === status);
    return list.sort((a, b) => (a.roomNo || '').localeCompare(b.roomNo || ''));
  }, []);
}
export async function addHostelRoom(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'hostel_rooms'), payload); return { id: r.id, ...data }; }, null);
}
export async function updateHostelRoom(id, patch) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'hostel_rooms', id), { ...patch, updatedAt: serverTimestamp() }));
}

// ─── Holiday Calendar ─────────────────────────────────────────────────────────
export async function listHolidays({ month } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    let list = await fetchCol('holidays');
    if (month) list = list.filter((h) => (h.date || '').startsWith(month));
    return list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, []);
}
export async function addHoliday(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'holidays'), payload); return { id: r.id, ...data }; }, null);
}
export async function deleteHoliday(id) {
  if (!guard()) return;
  await safe(() => deleteDoc(doc(db, 'holidays', id)));
}

/**
 * transportService.js — Firestore CRUD for transport routes, vehicles, allocations
 */
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';
const col = (name) => collection(db, name);
const tenantQ = (name, ...extra) => query(col(name), where('tenantId', '==', TENANT_ID), ...extra);

// ─── Routes ───────────────────────────────────────────────────────────────────
export async function listRoutes() {
  if (!isFirebaseConfigured || !db) return [];
  return safe(async () => {
    // Use simple where-only query to avoid composite index requirement; sort client-side
    const snap = await getDocs(tenantQ('transport_routes'));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return rows.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, []);
}
export async function addRoute(data) {
  if (!isFirebaseConfigured || !db) return null;
  return safe(async () => {
    const ref = await addDoc(col('transport_routes'), { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() });
    return { id: ref.id, ...data };
  }, null);
}
export async function updateRoute(id, patch) {
  if (!isFirebaseConfigured || !db) return;
  await safe(() => updateDoc(doc(db, 'transport_routes', id), { ...patch, updatedAt: serverTimestamp() }));
}
export async function deleteRoute(id) {
  if (!isFirebaseConfigured || !db) return;
  await safe(() => deleteDoc(doc(db, 'transport_routes', id)));
}

// ─── Allocations (student ↔ route) ───────────────────────────────────────────
export async function listAllocations({ routeId } = {}) {
  if (!isFirebaseConfigured || !db) return [];
  return safe(async () => {
    let q = tenantQ('transport_allocations');
    if (routeId) q = query(col('transport_allocations'), where('tenantId', '==', TENANT_ID), where('routeId', '==', routeId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, []);
}
export async function addAllocation(data) {
  if (!isFirebaseConfigured || !db) return { id: Date.now().toString(), ...data };
  return safe(async () => {
    const ref = await addDoc(col('transport_allocations'), { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() });
    return { id: ref.id, ...data };
  }, {});
}
export async function removeAllocation(id) {
  if (!isFirebaseConfigured || !db) return;
  await safe(() => deleteDoc(doc(db, 'transport_allocations', id)));
}

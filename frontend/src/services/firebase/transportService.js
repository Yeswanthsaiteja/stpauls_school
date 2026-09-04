/**
 * transportService.js — Firestore CRUD for transport routes, vehicles, allocations
 */
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';
const col = (name) => collection(db, name);
const tenantQ = (name, ...extra) => query(col(name), where('tenantId', '==', TENANT_ID), ...extra);

const trCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// ─── Routes ───────────────────────────────────────────────────────────────────
export async function listRoutes() {
  const cacheKey = 'routes_all';
  if (trCache.has(cacheKey)) {
    const { data, timestamp } = trCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!isFirebaseConfigured || !db) return [];
  return safe(async () => {
    // Use simple where-only query to avoid composite index requirement; sort client-side
    const snap = await getDocs(tenantQ('transport_routes'));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const sorted = rows.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    trCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
    return sorted;
  }, []);
}
export async function addRoute(data) {
  if (!isFirebaseConfigured || !db) return null;
  return safe(async () => {
    const ref = await addDoc(col('transport_routes'), { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() });
    trCache.clear();
    return { id: ref.id, ...data };
  }, null);
}
export async function updateRoute(id, patch) {
  if (!isFirebaseConfigured || !db) return;
  await safe(async () => {
    await updateDoc(doc(db, 'transport_routes', id), { ...patch, updatedAt: serverTimestamp() });
    trCache.clear();
  });
}
export async function deleteRoute(id) {
  if (!isFirebaseConfigured || !db) return;
  await safe(async () => {
    await deleteDoc(doc(db, 'transport_routes', id));
    trCache.clear();
  });
}

// ─── Allocations (student ↔ route) ───────────────────────────────────────────
export async function listAllocations(args = {}) {
  const { routeId } = args;
  const cacheKey = 'allocations_' + JSON.stringify(args);
  if (trCache.has(cacheKey)) {
    const { data, timestamp } = trCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!isFirebaseConfigured || !db) return [];
  return safe(async () => {
    let q = tenantQ('transport_allocations');
    if (routeId) q = query(col('transport_allocations'), where('tenantId', '==', TENANT_ID), where('routeId', '==', routeId));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    trCache.set(cacheKey, { data: list, timestamp: Date.now() });
    return list;
  }, []);
}
export async function addAllocation(data) {
  if (!isFirebaseConfigured || !db) return { id: Date.now().toString(), ...data };
  return safe(async () => {
    const ref = await addDoc(col('transport_allocations'), { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() });
    trCache.clear();
    return { id: ref.id, ...data };
  }, {});
}
export async function removeAllocation(id) {
  if (!isFirebaseConfigured || !db) return;
  await safe(async () => {
    await deleteDoc(doc(db, 'transport_allocations', id));
    trCache.clear();
  });
}

/**
 * crmService.js — Firestore CRUD for CRM tickets / support requests
 */
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe, getDocsCached, invalidateCache, queryDocs } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';

const crmCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function invalidateCrmCache(key) {
  crmCache.clear();
  invalidateCache(key);
}

function guard() { return isFirebaseConfigured && !!db; }

async function fetchCol(name) {
  const snap = await getDocsCached(name);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => !r.tenantId || r.tenantId === TENANT_ID);
}

// ─── Tickets ─────────────────────────────────────────────────────────────────
export async function listTickets(args = {}) {
  const { status } = args;
  const cacheKey = 'tickets_' + JSON.stringify(args);
  if (crmCache.has(cacheKey)) {
    const { data, timestamp } = crmCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return [];
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (status && status !== 'ALL') constraints.push(where('status', '==', status));
    
    let list = await queryDocs('crm_tickets', ...constraints);
    const sorted = list.sort((a, b) => {
      const ta = a.createdAt?.seconds || 0;
      const tb = b.createdAt?.seconds || 0;
      return tb - ta;
    });
    crmCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
    return sorted;
  }, []);
}

export async function addTicket(data) {
  if (!guard()) return null;
  return safe(async () => {
    const allTickets = await fetchCol('crm_tickets');
    const ticketNo = `TKT${1001 + allTickets.length}`;
    const ref = await addDoc(collection(db, 'crm_tickets'), {
      ...data, ticketNo, tenantId: TENANT_ID, status: 'OPEN', createdAt: serverTimestamp(),
    });
    invalidateCrmCache('crm_tickets');
    return { id: ref.id, ticketNo, ...data, status: 'OPEN' };
  }, null);
}

export async function updateTicketStatus(id, status, resolution = '') {
  if (!guard()) return;
  await safe(async () => {
    await updateDoc(doc(db, 'crm_tickets', id), {
      status, resolution, updatedAt: serverTimestamp(),
      resolvedAt: status === 'RESOLVED' ? serverTimestamp() : null,
    });
    invalidateCrmCache('crm_tickets');
  });
}

export async function deleteTicket(id) {
  if (!isFirebaseConfigured || !db) return;
  await safe(async () => {
    await deleteDoc(doc(db, 'crm_tickets', id));
    invalidateCrmCache('crm_tickets');
  });
}

// ─── Enquiries (admission leads) ─────────────────────────────────────────────
export async function listEnquiries(args = {}) {
  const { status } = args;
  const cacheKey = 'enquiries_' + JSON.stringify(args);
  if (crmCache.has(cacheKey)) {
    const { data, timestamp } = crmCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!isFirebaseConfigured || !db) return [];
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (status) constraints.push(where('status', '==', status));
    
    let list = await queryDocs('enquiries', ...constraints);
    const sorted = list.sort((a, b) => {
      const ta = a.createdAt?.seconds || 0;
      const tb = b.createdAt?.seconds || 0;
      return tb - ta;
    });
    crmCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
    return sorted;
  }, []);
}

export async function addEnquiry(data) {
  if (!isFirebaseConfigured || !db) return { id: Date.now().toString(), ...data };
  return safe(async () => {
    const ref = await addDoc(collection(db, 'enquiries'), { ...data, tenantId: TENANT_ID, status: 'NEW', createdAt: serverTimestamp() });
    invalidateCrmCache('enquiries');
    return { id: ref.id, ...data };
  }, {});
}

export async function updateEnquiry(id, patch) {
  if (!isFirebaseConfigured || !db) return;
  await safe(async () => {
    await updateDoc(doc(db, 'enquiries', id), { ...patch, updatedAt: serverTimestamp() });
    invalidateCrmCache('enquiries');
  });
}

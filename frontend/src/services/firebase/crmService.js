/**
 * crmService.js — Firestore CRUD for CRM tickets / support requests
 */
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
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

// ─── Tickets ─────────────────────────────────────────────────────────────────
export async function listTickets({ status } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    let list = await fetchCol('crm_tickets');
    if (status && status !== 'ALL') list = list.filter(t => t.status === status);
    return list.sort((a, b) => {
      const ta = a.createdAt?.seconds || 0;
      const tb = b.createdAt?.seconds || 0;
      return tb - ta;
    });
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
    return { id: ref.id, ticketNo, ...data, status: 'OPEN' };
  }, null);
}

export async function updateTicketStatus(id, status, resolution = '') {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'crm_tickets', id), {
    status, resolution, updatedAt: serverTimestamp(),
    resolvedAt: status === 'RESOLVED' ? serverTimestamp() : null,
  }));
}

export async function deleteTicket(id) {
  if (!isFirebaseConfigured || !db) return;
  await safe(() => deleteDoc(doc(db, 'crm_tickets', id)));
}

// ─── Enquiries (admission leads) ─────────────────────────────────────────────
export async function listEnquiries({ status } = {}) {
  if (!isFirebaseConfigured || !db) return [];
  return safe(async () => {
    let q = tenantQ('enquiries', orderBy('createdAt', 'desc'));
    if (status) q = query(col('enquiries'), where('tenantId', '==', TENANT_ID), where('status', '==', status));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, []);
}

export async function addEnquiry(data) {
  if (!isFirebaseConfigured || !db) return { id: Date.now().toString(), ...data };
  return safe(async () => {
    const ref = await addDoc(col('enquiries'), { ...data, tenantId: TENANT_ID, status: 'NEW', createdAt: serverTimestamp() });
    return { id: ref.id, ...data };
  }, {});
}

export async function updateEnquiry(id, patch) {
  if (!isFirebaseConfigured || !db) return;
  await safe(() => updateDoc(doc(db, 'enquiries', id), { ...patch, updatedAt: serverTimestamp() }));
}

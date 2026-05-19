/**
 * crmService.js — Firestore CRUD for CRM tickets / support requests
 */
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';
const col = (name) => collection(db, name);
const tenantQ = (name, ...extra) => query(col(name), where('tenantId', '==', TENANT_ID), ...extra);

// ─── Tickets ─────────────────────────────────────────────────────────────────
export async function listTickets({ status } = {}) {
  if (!isFirebaseConfigured || !db) return [];
  return safe(async () => {
    let q = tenantQ('crm_tickets', orderBy('createdAt', 'desc'));
    if (status && status !== 'ALL') q = query(col('crm_tickets'), where('tenantId', '==', TENANT_ID), where('status', '==', status), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, []);
}

export async function addTicket(data) {
  if (!isFirebaseConfigured || !db) return null;
  return safe(async () => {
    const count = (await getDocs(tenantQ('crm_tickets'))).size;
    const ticketNo = `TKT${1001 + count}`;
    const ref = await addDoc(col('crm_tickets'), {
      ...data, ticketNo, tenantId: TENANT_ID, status: 'OPEN', createdAt: serverTimestamp(),
    });
    return { id: ref.id, ticketNo, ...data, status: 'OPEN' };
  }, null);
}

export async function updateTicketStatus(id, status, remarks = '') {
  if (!isFirebaseConfigured || !db) return;
  await safe(() => updateDoc(doc(db, 'crm_tickets', id), {
    status, remarks, updatedAt: serverTimestamp(), resolvedAt: status === 'RESOLVED' ? serverTimestamp() : null,
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

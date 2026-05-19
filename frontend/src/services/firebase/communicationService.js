/**
 * communicationService.js — Firestore CRUD + real-time subscriptions.
 * senderId/recipientId convention:
 *   admin  → 'admin' (hardcoded, admin has no employee Firestore doc)
 *   staff  → profile.employeeId which equals the Firestore employee doc ID
 */
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  serverTimestamp, onSnapshot, query, where,
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

// ─── Announcements ────────────────────────────────────────────────────────────
export async function listAnnouncements({ targetRole } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    let list = await fetchCol('announcements');
    if (targetRole && targetRole !== 'ALL') list = list.filter((a) => a.targetRole === targetRole || a.targetRole === 'ALL');
    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, []);
}
export async function addAnnouncement(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, date: data.date || new Date().toISOString().slice(0, 10), createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'announcements'), payload); return { id: r.id, ...payload }; }, null);
}
export async function updateAnnouncement(id, patch) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'announcements', id), { ...patch, updatedAt: serverTimestamp() }));
}
export async function deleteAnnouncement(id) {
  if (!guard()) return;
  await safe(() => deleteDoc(doc(db, 'announcements', id)));
}

// ─── Real-time Announcements subscription ─────────────────────────────────────
export function subscribeAnnouncements(targetRole, callback) {
  if (!guard()) { callback([]); return () => {}; }
  try {
    const q = query(collection(db, 'announcements'), where('tenantId', '==', TENANT_ID));
    return onSnapshot(q, (snap) => {
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (targetRole && targetRole !== 'ALL') {
        list = list.filter(a => a.targetRole === targetRole || a.targetRole === 'ALL');
      }
      list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      callback(list);
    }, (err) => { console.error('[Announcements] onSnapshot error:', err); callback([]); });
  } catch { return () => {}; }
}

// ─── Messages ─────────────────────────────────────────────────────────────────
export async function listMessages({ recipientId, senderId } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    let list = await fetchCol('messages');
    if (recipientId) list = list.filter((m) => m.recipientId === recipientId);
    if (senderId)    list = list.filter((m) => m.senderId    === senderId);
    return list.sort((a, b) => {
      const ta = a.createdAt?.seconds || 0;
      const tb = b.createdAt?.seconds || 0;
      return ta - tb; // oldest first for chat display
    });
  }, []);
}
export async function sendMessage(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, status: 'SENT', createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'messages'), payload); return { id: r.id, ...payload, createdAt: { seconds: Date.now() / 1000 } }; }, null);
}

/**
 * Subscribe to a conversation thread in real-time.
 * Returns all messages where (senderId=userA AND recipientId=userB) OR (senderId=userB AND recipientId=userA).
 * onSnapshot fires immediately and on every change.
 */
export function subscribeMessages(myId, otherId, callback) {
  if (!guard() || !myId || !otherId) { callback([]); return () => {}; }
  try {
    // Listen to all messages in the collection for this tenant
    const q = query(collection(db, 'messages'), where('tenantId', '==', TENANT_ID));
    return onSnapshot(q, (snap) => {
      const all = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m =>
          (m.senderId === myId && m.recipientId === otherId) ||
          (m.senderId === otherId && m.recipientId === myId)
        )
        .sort((a, b) => {
          const ta = a.createdAt?.seconds || 0;
          const tb = b.createdAt?.seconds || 0;
          return ta - tb; // oldest first
        });
      callback(all);
    }, (err) => { console.error('[Messages] onSnapshot error:', err); callback([]); });
  } catch { callback([]); return () => {}; }
}

// ─── CRM Tickets ──────────────────────────────────────────────────────────────
export async function listTickets({ status, assignedTo } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    let list = await fetchCol('crm_tickets');
    if (status)     list = list.filter((t) => t.status     === status);
    if (assignedTo) list = list.filter((t) => t.assignedTo === assignedTo);
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, []);
}
export async function addTicket(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, status: 'OPEN', createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'crm_tickets'), payload); return { id: r.id, ...payload }; }, null);
}
export async function updateTicket(id, patch) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'crm_tickets', id), { ...patch, updatedAt: serverTimestamp() }));
}

// ─── Diary Entries ────────────────────────────────────────────────────────────
export async function listDiaryEntries({ className, date, studentId } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    let list = await fetchCol('diary_entries');
    if (className) list = list.filter((d) => d.className === className);
    if (date)      list = list.filter((d) => d.date      === date);
    if (studentId) list = list.filter((d) => d.studentId === studentId);
    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, []);
}
export async function addDiaryEntry(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'diary_entries'), payload); return { id: r.id, ...payload }; }, null);
}

// ─── Gallery ──────────────────────────────────────────────────────────────────
export async function listGallery({ category } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    let list = await fetchCol('gallery');
    if (category) list = list.filter((g) => g.category === category);
    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, []);
}
export async function addGalleryItem(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'gallery'), payload); return { id: r.id, ...payload }; }, null);
}

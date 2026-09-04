/**
 * communicationService.js — Firestore CRUD + real-time subscriptions.
 * senderId/recipientId convention:
 *   admin  → 'admin' (hardcoded, admin has no employee Firestore doc)
 *   staff  → profile.employeeId which equals the Firestore employee doc ID
 */
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  serverTimestamp, onSnapshot, query, where, or,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe, getDocsCached, invalidateCache, queryDocs } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';

const commCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function invalidateCommCache(key) {
  commCache.clear();
  invalidateCache(key);
}

function guard() { return isFirebaseConfigured && !!db; }

async function fetchCol(name) {
  const snap = await getDocsCached(name);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => !r.tenantId || r.tenantId === TENANT_ID);
}

// ─── Announcements ────────────────────────────────────────────────────────────
export async function listAnnouncements(args = {}) {
  const { targetRole } = args;
  const cacheKey = 'announcements_' + JSON.stringify(args);
  if (commCache.has(cacheKey)) {
    const { data, timestamp } = commCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return [];
  return safe(async () => {
    let list = await queryDocs('announcements', where('tenantId', '==', TENANT_ID));
    if (targetRole && targetRole !== 'ALL') list = list.filter((a) => a.targetRole === targetRole || a.targetRole === 'ALL');
    const sorted = list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    commCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
    return sorted;
  }, []);
}
export async function addAnnouncement(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, date: data.date || new Date().toISOString().slice(0, 10), createdAt: serverTimestamp() };
  return safe(async () => {
    const r = await addDoc(collection(db, 'announcements'), payload);
    invalidateCommCache('announcements');
    return { id: r.id, ...payload };
  }, null);
}
export async function updateAnnouncement(id, patch) {
  if (!guard()) return;
  await safe(async () => {
    await updateDoc(doc(db, 'announcements', id), { ...patch, updatedAt: serverTimestamp() });
    invalidateCommCache('announcements');
  });
}
export async function deleteAnnouncement(id) {
  if (!guard()) return;
  await safe(async () => {
    await deleteDoc(doc(db, 'announcements', id));
    invalidateCommCache('announcements');
  });
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
export async function listMessages(args = {}) {
  const { recipientId, senderId } = args;
  const cacheKey = 'messages_' + JSON.stringify(args);
  if (commCache.has(cacheKey)) {
    const { data, timestamp } = commCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return [];
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (recipientId) constraints.push(where('recipientId', '==', recipientId));
    else if (senderId) constraints.push(where('senderId', '==', senderId));
    
    let list = await queryDocs('messages', ...constraints);
    
    // JS filters for the other param
    if (recipientId && senderId) list = list.filter(m => m.senderId === senderId);

    const sorted = list.sort((a, b) => {
      const ta = a.createdAt?.seconds || 0;
      const tb = b.createdAt?.seconds || 0;
      return ta - tb; // oldest first for chat display
    });
    commCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
    return sorted;
  }, []);
}
export async function sendMessage(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, status: 'SENT', createdAt: serverTimestamp() };
  return safe(async () => {
    const r = await addDoc(collection(db, 'messages'), payload);
    invalidateCommCache('messages');
    return { id: r.id, ...payload, createdAt: { seconds: Date.now() / 1000 } };
  }, null);
}

/**
 * Subscribe to a conversation thread in real-time.
 * Returns all messages where (senderId=userA AND recipientId=userB) OR (senderId=userB AND recipientId=userA).
 * onSnapshot fires immediately and on every change.
 */
export function subscribeMessages(myId, otherId, callback) {
  if (!guard() || !myId || !otherId) { callback([]); return () => {}; }
  try {
    // Use Firestore `or()` to only fetch messages for this conversation
    const q = query(
      collection(db, 'messages'),
      where('tenantId', '==', TENANT_ID),
      or(
        where('senderId', '==', myId),
        where('recipientId', '==', myId)
      )
    );
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
export async function listTickets(args = {}) {
  const { status, assignedTo } = args;
  const cacheKey = 'tickets_' + JSON.stringify(args);
  if (commCache.has(cacheKey)) {
    const { data, timestamp } = commCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return [];
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (status) constraints.push(where('status', '==', status));
    
    let list = await queryDocs('crm_tickets', ...constraints);
    if (assignedTo) list = list.filter((t) => t.assignedTo === assignedTo);
    
    const sorted = list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    commCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
    return sorted;
  }, []);
}
export async function addTicket(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, status: 'OPEN', createdAt: serverTimestamp() };
  return safe(async () => {
    const r = await addDoc(collection(db, 'crm_tickets'), payload);
    invalidateCommCache('crm_tickets');
    return { id: r.id, ...payload };
  }, null);
}
export async function updateTicket(id, patch) {
  if (!guard()) return;
  await safe(async () => {
    await updateDoc(doc(db, 'crm_tickets', id), { ...patch, updatedAt: serverTimestamp() });
    invalidateCommCache('crm_tickets');
  });
}

// ─── Diary Entries ────────────────────────────────────────────────────────────
export async function listDiaryEntries(args = {}) {
  const { className, date, studentId } = args;
  const cacheKey = 'diary_' + JSON.stringify(args);
  if (commCache.has(cacheKey)) {
    const { data, timestamp } = commCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return [];
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (studentId) constraints.push(where('studentId', '==', studentId));
    else if (className) constraints.push(where('className', '==', className));
    else if (date) constraints.push(where('date', '==', date));
    
    let list = await queryDocs('diary_entries', ...constraints);
    
    // JS filter the rest
    if (studentId) {
      if (className) list = list.filter((d) => d.className === className);
      if (date) list = list.filter((d) => d.date === date);
    } else if (className) {
      if (date) list = list.filter((d) => d.date === date);
    }
    
    const sorted = list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    commCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
    return sorted;
  }, []);
}
export async function addDiaryEntry(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => {
    const r = await addDoc(collection(db, 'diary_entries'), payload);
    invalidateCommCache('diary_entries');
    return { id: r.id, ...payload };
  }, null);
}

// ─── Gallery ──────────────────────────────────────────────────────────────────
export async function listGallery(args = {}) {
  const { category } = args;
  const cacheKey = 'gallery_' + JSON.stringify(args);
  if (commCache.has(cacheKey)) {
    const { data, timestamp } = commCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return [];
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (category) constraints.push(where('category', '==', category));
    
    let list = await queryDocs('gallery', ...constraints);
    const sorted = list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    commCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
    return sorted;
  }, []);
}
export async function addGalleryItem(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => {
    const r = await addDoc(collection(db, 'gallery'), payload);
    invalidateCommCache('gallery');
    return { id: r.id, ...payload };
  }, null);
}

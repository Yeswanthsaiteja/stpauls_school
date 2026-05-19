/**
 * notificationsService.js — Real-time notification system using Firestore onSnapshot.
 * Notifications are scoped by userId:
 *   admin  → userId = 'admin'
 *   staff  → userId = employee Firestore doc ID (profile.employeeId)
 */
import {
  collection, addDoc, updateDoc, doc, query, where, onSnapshot, serverTimestamp, writeBatch, getDocs,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';
function guard() { return isFirebaseConfigured && !!db; }

// ─── Add a notification ───────────────────────────────────────────────────────
export async function addNotification({ userId, type, title, body }) {
  if (!guard() || !userId) return null;
  return safe(async () => {
    const payload = {
      userId, type, title, body,
      read: false, tenantId: TENANT_ID,
      createdAt: serverTimestamp(),
    };
    const r = await addDoc(collection(db, 'notifications'), payload);
    return { id: r.id, ...payload };
  }, null);
}

// ─── Subscribe to notifications in real-time (onSnapshot) ────────────────────
// Returns the unsubscribe function — call it on cleanup.
export function subscribeNotifications(userId, callback) {
  if (!guard() || !userId) { callback([]); return () => {}; }
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('tenantId', '==', TENANT_ID),
    );
    const unsub = onSnapshot(q, (snap) => {
      const notes = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.seconds || 0;
          const tb = b.createdAt?.seconds || 0;
          return tb - ta; // newest first
        });
      callback(notes);
    }, (err) => {
      console.error('[Notifications] onSnapshot error:', err);
      callback([]);
    });
    return unsub;
  } catch (err) {
    console.error('[Notifications] subscribe error:', err);
    callback([]);
    return () => {};
  }
}

// ─── Mark a single notification as read ──────────────────────────────────────
export async function markNotificationRead(id) {
  if (!guard() || !id) return;
  await safe(() => updateDoc(doc(db, 'notifications', id), { read: true }));
}

// ─── Mark all notifications as read for a user ───────────────────────────────
export async function markAllNotificationsRead(userId) {
  if (!guard() || !userId) return;
  return safe(async () => {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false),
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
  });
}

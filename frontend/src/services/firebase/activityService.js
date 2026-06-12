/**
 * activityService.js — Real-time system activity logging + dynamic subscription.
 */
import { collection, addDoc, query, onSnapshot, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe } from './firestoreHelpers';
import { addNotification } from './notificationsService';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';

function guard() { return isFirebaseConfigured && !!db; }

/**
 * Log a new system activity.
 * Writes a log document to 'activities' and dispatches a notification to 'admin'.
 */
export async function logActivity({ type, text }) {
  if (!guard()) return null;
  return safe(async () => {
    const payload = {
      type,
      text,
      tenantId: TENANT_ID,
      createdAt: serverTimestamp(),
    };
    
    // 1. Add to system activities collection
    const r = await addDoc(collection(db, 'activities'), payload);
    
    // 2. Map activity type to notification category and dispatch real-time admin alert
    let title = 'System Activity';
    if (type === 'admission') title = 'New Student Admitted';
    else if (type === 'fee') title = 'Fee Payment Received';
    else if (type === 'attendance') title = 'Attendance Marked';
    else if (type === 'employee') title = 'New Employee Appointed';
    
    // Admin receives all notifications
    await addNotification({
      userId: 'admin',
      type: type === 'employee' ? 'leave_status' : type === 'admission' ? 'announcement' : type,
      title,
      body: text,
    });
    
    return { id: r.id, ...payload };
  }, null);
}

/**
 * Subscribe to recent activities in real-time.
 * Returns the unsubscribe function.
 */
export function subscribeRecentActivities(callback) {
  if (!guard()) { callback([]); return () => {}; }
  try {
    const q = query(
      collection(db, 'activities'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          time: formatTime(data.createdAt),
          dot: getDotColor(data.type),
        };
      });
      callback(list);
    }, (err) => {
      console.error('[Activities] onSnapshot error:', err);
      callback([]);
    });
    return unsub;
  } catch (err) {
    console.error('[Activities] subscribe error:', err);
    callback([]);
    return () => {};
  }
}

function formatTime(createdAt) {
  if (!createdAt) return 'Just now';
  const sec = createdAt.seconds;
  if (!sec) return 'Just now';
  const diff = Math.floor((Date.now() / 1000) - sec);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getDotColor(type) {
  switch (type) {
    case 'admission': return 'bg-indigo-500';
    case 'fee': return 'bg-emerald-500';
    case 'attendance': return 'bg-amber-500';
    case 'employee': return 'bg-purple-500';
    default: return 'bg-muted-foreground';
  }
}

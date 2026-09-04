/**
 * firestoreHelpers.js
 * Wraps Firestore calls. Returns fallback (default []) on error.
 * NO demoStore. NO localStorage. Pure Firestore.
 */
import { getDocs, collection, query } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 mins

export async function getDocsCached(colName) {
  if (!isFirebaseConfigured || !db) return { docs: [] };
  
  const now = Date.now();
  if (cache.has(colName)) {
    const { data, timestamp } = cache.get(colName);
    if (now - timestamp < CACHE_TTL) {
      return data;
    }
  }
  
  const snap = await getDocs(collection(db, colName));
  cache.set(colName, { data: snap, timestamp: now });
  return snap;
}

export function invalidateCache(colName) {
  cache.delete(colName);
}

export async function queryDocs(colName, ...queryConstraints) {
  if (!isFirebaseConfigured || !db) return [];
  const q = query(collection(db, colName), ...queryConstraints);
  const snap = await safe(() => getDocs(q), { docs: [] });
  return snap.docs ? snap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
}

export async function safe(fn, fallback = []) {
  try {
    return await fn();
  } catch (err) {
    const code = err?.code || '';
    console.error('[Firestore]', code, err?.message);
    return fallback;
  }
}

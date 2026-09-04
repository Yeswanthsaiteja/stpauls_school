import { collection, doc, getDocs, addDoc, deleteDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';
const COL = 'holidays';

const holCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

export async function listHolidays() {
  const cacheKey = 'holidays_all';
  if (holCache.has(cacheKey)) {
    const { data, timestamp } = holCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!isFirebaseConfigured || !db) return [];
  return safe(async () => {
    // Note: We'll filter on client to avoid needing composite index just yet,
    // though querying by tenantId is fine if simple.
    const q = query(collection(db, COL), where('tenantId', '==', TENANT_ID));
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort descending by date so newest/upcoming are clear
    const sorted = list.sort((a, b) => b.date.localeCompare(a.date));
    holCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
    return sorted;
  }, []);
}

export async function addHoliday({ date, name, type }) {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase not configured');
  return safe(async () => {
    const payload = {
      tenantId: TENANT_ID,
      date, // YYYY-MM-DD
      name,
      type, // 'PLANNED' or 'SUDDEN'
      createdAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, COL), payload);
    holCache.clear();
    return { id: ref.id, ...payload };
  });
}

export async function removeHoliday(id) {
  if (!isFirebaseConfigured || !db) return;
  await safe(async () => {
    await deleteDoc(doc(db, COL, id));
    holCache.clear();
  });
}

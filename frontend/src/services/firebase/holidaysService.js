import { collection, doc, getDocs, addDoc, deleteDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';
const COL = 'holidays';

export async function listHolidays() {
  if (!isFirebaseConfigured || !db) return [];
  return safe(async () => {
    // Note: We'll filter on client to avoid needing composite index just yet,
    // though querying by tenantId is fine if simple.
    const q = query(collection(db, COL), where('tenantId', '==', TENANT_ID));
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort descending by date so newest/upcoming are clear
    return list.sort((a, b) => b.date.localeCompare(a.date));
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
    return { id: ref.id, ...payload };
  });
}

export async function removeHoliday(id) {
  if (!isFirebaseConfigured || !db) return;
  await safe(() => deleteDoc(doc(db, COL, id)));
}

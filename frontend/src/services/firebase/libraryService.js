import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, setDoc, query, where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe, getDocsCached, invalidateCache as firestoreInvalidateCache, queryDocs } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';

const libCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function invalidateCache(key) {
  libCache.clear();
  firestoreInvalidateCache(key);
}

function guard() {
  return isFirebaseConfigured && !!db;
}

async function fetchCol(name) {
  const snap = await getDocsCached(name);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => !r.tenantId || r.tenantId === TENANT_ID);
}

// ─── Racks ─────────────────────────────────────────────────────────────────────
export async function listRacks() {
  const cacheKey = 'racks_all';
  if (libCache.has(cacheKey)) {
    const { data, timestamp } = libCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return [];
  return safe(async () => {
    const list = await queryDocs('library_racks', where('tenantId', '==', TENANT_ID));
    const sorted = list.sort((a, b) => {
      const numA = parseInt(a.rackNumber) || 0;
      const numB = parseInt(b.rackNumber) || 0;
      return numA - numB;
    });
    libCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
    return sorted;
  }, []);
}

export async function addRack(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => {
    const r = await addDoc(collection(db, 'library_racks'), payload);
    invalidateCache('library_racks');
    return { id: r.id, ...payload };
  }, null);
}

export async function deleteRack(id) {
  if (!guard()) return;
  await safe(async () => {
    await deleteDoc(doc(db, 'library_racks', id));
    invalidateCache('library_racks');
  });
}

export async function updateRack(id, patch) {
  if (!guard()) return;
  await safe(async () => {
    await updateDoc(doc(db, 'library_racks', id), { ...patch, updatedAt: serverTimestamp() });
    invalidateCache('library_racks');
  });
}

// ─── Books (Accession Register) ────────────────────────────────────────────────
export async function listBooks() {
  const cacheKey = 'books_all';
  if (libCache.has(cacheKey)) {
    const { data, timestamp } = libCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return [];
  return safe(async () => {
    const list = await queryDocs('library_books', where('tenantId', '==', TENANT_ID));
    const sorted = list.sort((a, b) => {
      // Sort by Sl. No if possible
      const sA = parseInt(a.slNo) || 0;
      const sB = parseInt(b.slNo) || 0;
      return sA - sB;
    });
    libCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
    return sorted;
  }, []);
}

export async function addBook(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp(), status: 'AVAILABLE' };
  return safe(async () => {
    const r = await addDoc(collection(db, 'library_books'), payload);
    invalidateCache('library_books');
    return { id: r.id, ...payload };
  }, null);
}

export async function bulkAddBooks(booksArray) {
  if (!guard()) return;
  return safe(async () => {
    const batch = writeBatch(db);
    const colRef = collection(db, 'library_books');
    
    // Process in chunks of 500 (Firestore limit)
    for (let i = 0; i < booksArray.length; i += 500) {
      const chunk = booksArray.slice(i, i + 500);
      const currentBatch = writeBatch(db);
      for (const book of chunk) {
        const docRef = doc(colRef);
        currentBatch.set(docRef, {
          ...book,
          tenantId: TENANT_ID,
          createdAt: serverTimestamp(),
          status: 'AVAILABLE'
        });
      }
      await currentBatch.commit();
    }
    invalidateCache('library_books');
  });
}

export async function updateBook(id, patch) {
  if (!guard()) return;
  await safe(async () => {
    await updateDoc(doc(db, 'library_books', id), { ...patch, updatedAt: serverTimestamp() });
    invalidateCache('library_books');
  });
}

export async function deleteBook(id) {
  if (!guard()) return;
  await safe(async () => {
    await deleteDoc(doc(db, 'library_books', id));
    invalidateCache('library_books');
  });
}

// ─── Issues ───────────────────────────────────────────────────────────────────
export async function listIssues(borrowerType = null) {
  const cacheKey = 'issues_' + borrowerType;
  if (libCache.has(cacheKey)) {
    const { data, timestamp } = libCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }
  if (!guard()) return [];
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (borrowerType) constraints.push(where('borrowerType', '==', borrowerType));
    
    let list = await queryDocs('library_issues', ...constraints);
    const sorted = list.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
    libCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
    return sorted;
  }, []);
}

export async function issueBook(bookId, data) {
  if (!guard()) return null;
  return safe(async () => {
    const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
    const r = await addDoc(collection(db, 'library_issues'), payload);
    
    // Update book status and remove from rack since it's issued
    await updateDoc(doc(db, 'library_books', bookId), {
      status: 'ISSUED',
      currentIssueId: r.id,
      rackId: null,
      updatedAt: serverTimestamp()
    });
    
    invalidateCache('library_issues');
    invalidateCache('library_books');
    return { id: r.id, ...payload };
  }, null);
}

export async function returnBook(issueId, bookId) {
  if (!guard()) return;
  return safe(async () => {
    // Mark issue as returned
    await updateDoc(doc(db, 'library_issues', issueId), {
      status: 'RETURNED',
      returnDate: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });
    
    // Update book status
    await updateDoc(doc(db, 'library_books', bookId), {
      status: 'AVAILABLE',
      currentIssueId: null,
      updatedAt: serverTimestamp()
    });
    
    invalidateCache('library_issues');
    invalidateCache('library_books');
  });
}

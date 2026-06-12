import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, setDoc
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';

function guard() {
  return isFirebaseConfigured && !!db;
}

async function fetchCol(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => !r.tenantId || r.tenantId === TENANT_ID);
}

// ─── Books (Accession Register) ────────────────────────────────────────────────
export async function listBooks() {
  if (!guard()) return [];
  return safe(async () => {
    const list = await fetchCol('library_books');
    return list.sort((a, b) => {
      // Sort by Sl. No if possible
      const sA = parseInt(a.slNo) || 0;
      const sB = parseInt(b.slNo) || 0;
      return sA - sB;
    });
  }, []);
}

export async function addBook(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp(), status: 'AVAILABLE' };
  return safe(async () => {
    const r = await addDoc(collection(db, 'library_books'), payload);
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
  });
}

export async function updateBook(id, patch) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'library_books', id), { ...patch, updatedAt: serverTimestamp() }));
}

export async function deleteBook(id) {
  if (!guard()) return;
  await safe(() => deleteDoc(doc(db, 'library_books', id)));
}

// ─── Issues ───────────────────────────────────────────────────────────────────
export async function listIssues(borrowerType = null) {
  if (!guard()) return [];
  return safe(async () => {
    let list = await fetchCol('library_issues');
    if (borrowerType) {
      list = list.filter(i => i.borrowerType === borrowerType);
    }
    return list.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  }, []);
}

export async function issueBook(bookId, data) {
  if (!guard()) return null;
  return safe(async () => {
    const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
    const r = await addDoc(collection(db, 'library_issues'), payload);
    
    // Update book status
    await updateDoc(doc(db, 'library_books', bookId), {
      status: 'ISSUED',
      currentIssueId: r.id,
      updatedAt: serverTimestamp()
    });
    
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
  });
}

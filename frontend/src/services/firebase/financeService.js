/**
 * financeService.js — Firestore CRUD for finance.
 * Uses getDocs(collection) + client-side filter to avoid composite index errors.
 * ZERO demoStore.
 */
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';

async function fetchCol(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => !r.tenantId || r.tenantId === TENANT_ID);
}

function guard() {
  return isFirebaseConfigured && !!db;
}

// ─── Shared Utilities ──────────────────────────────────────────────────────────

/**
 * Given all transactions for a student, compute how much has been paid
 * toward a specific categoryId + termId.
 */
export function computeTermPaid(txList, categoryId, termId) {
  let paid = 0;
  txList.forEach((tx) => {
    if (tx.status !== 'PAID') return;
    if (tx.termAllocations && tx.termAllocations.length > 0) {
      tx.termAllocations.forEach((a) => {
        if (a.categoryId === categoryId && a.termId === termId) paid += Number(a.amount || 0);
      });
    } else if (tx.categoryId === categoryId) {
      // Legacy: single-category tx without allocations
      paid += Number(tx.amount || 0);
    }
  });
  return paid;
}

/**
 * Auto-allocate a payment amount across the unpaid terms of a category,
 * clearing from oldest (lowest index) first.
 */
export function allocatePayment(amount, terms, studentClass, txList, concessionsV2, categoryId) {
  let remaining = amount;
  const allocations = [];

  for (const term of terms) {
    if (remaining <= 0) break;
    const termFee = Number((term.amounts?.[studentClass]) ?? (term.amounts?.['default']) ?? 0);
    if (termFee <= 0) continue;

    const concEntry = concessionsV2.find(
      (c) => c.categoryId === categoryId && c.termId === term.id
    );
    const concAmt = Number(concEntry?.amount || 0);
    const termPaid = computeTermPaid(txList, categoryId, term.id);
    const effectiveFee = termFee - concAmt;
    const termDue = Math.max(0, effectiveFee - termPaid);

    if (termDue <= 0) continue; // already fully paid

    const alloc = Math.min(remaining, termDue);
    allocations.push({
      termId: term.id,
      termName: term.name,
      categoryId,
      amount: alloc,
    });
    remaining -= alloc;
  }

  return { allocations, unallocated: remaining };
}

// ─── Fee Categories ───────────────────────────────────────────────────────────
export async function listFeeCategories() {
  if (!guard()) return [];
  return safe(async () => (await fetchCol('fee_categories')).sort((a, b) => (a.name || '').localeCompare(b.name || '')), []);
}
export async function addFeeCategory(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'fee_categories'), payload); return { id: r.id, ...data }; }, null);
}
export async function updateFeeCategory(id, patch) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'fee_categories', id), { ...patch, updatedAt: serverTimestamp() }));
}
export async function deleteFeeCategory(id) {
  if (!guard()) return;
  await safe(() => deleteDoc(doc(db, 'fee_categories', id)));
}

// ─── Fee Installments ─────────────────────────────────────────────────────────
export async function listFeeInstallments() {
  if (!guard()) return [];
  return safe(async () => (await fetchCol('fee_installments')).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')), []);
}
export async function addFeeInstallment(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'fee_installments'), payload); return { id: r.id, ...data }; }, null);
}

// ─── Transactions ─────────────────────────────────────────────────────────────
export async function listTransactions({ studentId, status } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    let list = await fetchCol('transactions');
    if (studentId) list = list.filter((t) => t.studentId === studentId);
    if (status)    list = list.filter((t) => t.status    === status);
    return list.sort((a, b) => (b.paymentDate || b.createdAt || '').localeCompare(a.paymentDate || a.createdAt || ''));
  }, []);
}
export async function getTransaction(id) {
  if (!guard()) return null;
  return safe(async () => { const s = await getDoc(doc(db, 'transactions', id)); return s.exists() ? { id: s.id, ...s.data() } : null; }, null);
}
export async function addTransaction(data) {
  if (!guard()) return null;
  const receiptNo = `RCPT${Date.now().toString().slice(-8)}`;
  const payload = {
    ...data,
    tenantId: TENANT_ID,
    receiptNo,
    status: data.status || 'PAID',
    paymentDate: data.paymentDate || new Date().toISOString(),
    // termAllocations: [{ termId, termName, categoryId, categoryName, amount }]
    termAllocations: data.termAllocations || [],
    createdAt: serverTimestamp(),
  };
  return safe(async () => { const r = await addDoc(collection(db, 'transactions'), payload); return { id: r.id, ...payload }; }, null);
}
export async function updateTransaction(id, patch) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'transactions', id), { ...patch, updatedAt: serverTimestamp() }));
}

// ─── Concessions (Legacy — flat per student) ──────────────────────────────────
export async function listConcessions() {
  if (!guard()) return [];
  return safe(async () => fetchCol('fee_concessions'), []);
}
export async function setConcession(studentId, amount, reason = '') {
  if (!guard()) return;
  const payload = { studentId, amount: Number(amount), reason, tenantId: TENANT_ID, updatedAt: serverTimestamp() };
  await safe(() => setDoc(doc(db, 'fee_concessions', studentId), payload, { merge: true }));
}

// ─── Concessions V2 (per student, per category, per term) ─────────────────────
export async function listConcessionsV2() {
  if (!guard()) return [];
  return safe(async () => fetchCol('fee_concessions_v2'), []);
}

/**
 * Set a concession for a specific student + category + term.
 * Doc ID: `${studentId}_${categoryId}_${termId}`
 */
export async function setConcessionV2({ studentId, categoryId, termId, amount, reason = '' }) {
  if (!guard()) return;
  const docId = `${studentId}_${categoryId}_${termId}`;
  const payload = {
    studentId, categoryId, termId,
    amount: Number(amount),
    reason,
    tenantId: TENANT_ID,
    updatedAt: serverTimestamp(),
  };
  await safe(() => setDoc(doc(db, 'fee_concessions_v2', docId), payload, { merge: true }));
}

// ─── Expenses ─────────────────────────────────────────────────────────────────
export async function listExpenses() {
  if (!guard()) return [];
  return safe(async () => (await fetchCol('expenses')).sort((a, b) => (b.date || '').localeCompare(a.date || '')), []);
}
export async function addExpense(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'expenses'), payload); return { id: r.id, ...data }; }, null);
}
export async function updateExpense(id, patch) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'expenses', id), { ...patch, updatedAt: serverTimestamp() }));
}
export async function deleteExpense(id) {
  if (!guard()) return;
  await safe(() => deleteDoc(doc(db, 'expenses', id)));
}

// ─── Payroll ──────────────────────────────────────────────────────────────────
export async function listPayroll({ month } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    let list = await fetchCol('payroll');
    if (month) list = list.filter((p) => p.month === month);
    return list.sort((a, b) => (b.month || '').localeCompare(a.month || ''));
  }, []);
}
export async function addPayrollEntry(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'payroll'), payload); return { id: r.id, ...data }; }, null);
}
export async function updatePayrollStatus(id, status) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'payroll', id), { status, updatedAt: serverTimestamp() }));
}

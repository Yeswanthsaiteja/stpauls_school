/**
 * financeService.js — Firestore CRUD for finance.
 * Uses getDocs(collection) + client-side filter to avoid composite index errors.
 * ZERO demoStore.
 */
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp,
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
  const payload = { ...data, tenantId: TENANT_ID, receiptNo, status: data.status || 'PAID', paymentDate: data.paymentDate || new Date().toISOString(), createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'transactions'), payload); return { id: r.id, ...payload }; }, null);
}
export async function updateTransaction(id, patch) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'transactions', id), { ...patch, updatedAt: serverTimestamp() }));
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

/**
 * employeesService.js — Firestore CRUD for employees + leave requests.
 * No composite indexes. No demoStore. Pure Firestore.
 */
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';

function guard() { return isFirebaseConfigured && !!db; }

async function fetchCol(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => !r.tenantId || r.tenantId === TENANT_ID);
}

// ─── Employees ────────────────────────────────────────────────────────────────
export async function listEmployees({ department, status } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    let list = await fetchCol('employees');
    if (department) list = list.filter((e) => e.department === department);
    if (status)     list = list.filter((e) => e.status     === status);
    return list.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
  }, []);
}

export async function addEmployee(data) {
  if (!guard()) return null;
  let empNo = data.employeeId;
  if (!empNo) {
    const list = await fetchCol('employees');
    let max = 0;
    for (const e of list) {
      if (e.employeeId && e.employeeId.toLowerCase().startsWith('stpemp')) {
        const num = parseInt(e.employeeId.toLowerCase().replace('stpemp', ''), 10);
        if (!isNaN(num) && num > max) max = num;
      } else if (e.employeeId && e.employeeId.startsWith('SPH')) {
        const num = parseInt(e.employeeId.replace('SPH', ''), 10);
        if (!isNaN(num) && num > max) max = num;
      }
    }
    empNo = `STPEMP${String(max + 1).padStart(4, '0')}`;
  }
  const payload = { ...data, employeeId: empNo, tenantId: TENANT_ID, status: 'ACTIVE', createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'employees'), payload); return { id: r.id, ...payload }; }, null);
}

export async function updateEmployee(id, patch) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'employees', id), { ...patch, updatedAt: serverTimestamp() }));
}

export async function deleteEmployee(id) {
  if (!guard()) return;
  await safe(() => deleteDoc(doc(db, 'employees', id)));
}

// ─── Leave Requests ───────────────────────────────────────────────────────────
export async function listLeaveRequests({ employeeId, status } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    let list = await fetchCol('leave_requests');
    if (employeeId) list = list.filter((l) => l.employeeId === employeeId);
    if (status)     list = list.filter((l) => l.status     === status);
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, []);
}

export async function addLeaveRequest(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, status: 'PENDING', createdAt: serverTimestamp() };
  return safe(async () => { const r = await addDoc(collection(db, 'leave_requests'), payload); return { id: r.id, ...payload }; }, null);
}

export async function updateLeaveRequest(id, patch) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'leave_requests', id), { ...patch, updatedAt: serverTimestamp() }));
}

// Alias kept for backward compatibility
export const updateLeaveStatus = updateLeaveRequest;

// ─── Employee Removal ─────────────────────────────────────────────────────────
export async function removeEmployee(id, reason, extra = {}) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'employees', id), {
    status: 'REMOVED',
    removalReason: reason,
    leavingDate: extra.leavingDate || new Date().toISOString().slice(0, 10),
    ...extra,
    updatedAt: serverTimestamp(),
  }));
}

// ─── Employee Rejoin ──────────────────────────────────────────────────────────
export async function rejoinEmployee(id, patch = {}) {
  if (!guard()) return;
  await safe(() => updateDoc(doc(db, 'employees', id), {
    status: 'ACTIVE',
    rejoinDate: patch.rejoinDate || new Date().toISOString().slice(0, 10),
    ...patch,
    updatedAt: serverTimestamp(),
  }));
}

// ─── Bulk Add Employees ───────────────────────────────────────────────────────
export async function bulkAddEmployees(rows) {
  const results = [];
  for (const r of rows) {
    const result = await addEmployee(r);
    if (result) results.push(result);
  }
  return results;
}

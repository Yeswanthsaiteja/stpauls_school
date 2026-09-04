/**
 * employeesService.js — Firestore CRUD for employees + leave requests.
 * No composite indexes. No demoStore. Pure Firestore.
 */
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, query, where, getCountFromServer,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe, getDocsCached, invalidateCache, queryDocs } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';

function guard() { return isFirebaseConfigured && !!db; }

async function fetchCol(name) {
  const snap = await getDocsCached(name);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => !r.tenantId || r.tenantId === TENANT_ID);
}

// ─── Employees ────────────────────────────────────────────────────────────────
const empCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

export async function listEmployees(args = {}) {
  const { department, status } = args;
  const cacheKey = JSON.stringify(args);
  
  if (empCache.has(cacheKey)) {
    const { data, timestamp } = empCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  }

  if (!guard()) return [];
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (department) constraints.push(where('department', '==', department));
    else if (status) constraints.push(where('status', '==', status));
    
    let list = await queryDocs('employees', ...constraints);
    
    if (department && status) list = list.filter((e) => e.status === status);
    
    const sortedList = list.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    empCache.set(cacheKey, { data: sortedList, timestamp: Date.now() });
    return sortedList;
  }, []);
}

export async function getEmployeesCount({ status } = {}) {
  if (!guard()) return 0;
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (status) constraints.push(where('status', '==', status));
    
    const q = query(collection(db, 'employees'), ...constraints);
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  }, 0);
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
  return safe(async () => {
    const ref = await addDoc(collection(db, 'employees'), payload);
    empCache.clear();
    invalidateCache('employees');
    return { id: ref.id, ...payload };
  }, null);
}

export async function updateEmployee(id, patch) {
  if (!guard()) return;
  await safe(async () => {
    await updateDoc(doc(db, 'employees', id), { ...patch, updatedAt: serverTimestamp() });
    empCache.clear();
    invalidateCache('employees');
  });
}

export async function deleteEmployee(id) {
  if (!guard()) return;
  await safe(async () => {
    await deleteDoc(doc(db, 'employees', id));
    empCache.clear();
    invalidateCache('employees');
  });
}

// ─── Leave Requests ───────────────────────────────────────────────────────────
export async function listLeaveRequests({ employeeId, status } = {}) {
  if (!guard()) return [];
  return safe(async () => {
    const constraints = [where('tenantId', '==', TENANT_ID)];
    if (employeeId) constraints.push(where('employeeId', '==', employeeId));
    else if (status) constraints.push(where('status', '==', status));
    
    let list = await queryDocs('leave_requests', ...constraints);
    
    if (employeeId && status) list = list.filter((l) => l.status === status);
    
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, []);
}

export async function addLeaveRequest(data) {
  if (!guard()) return null;
  const payload = { ...data, tenantId: TENANT_ID, status: 'PENDING', createdAt: serverTimestamp() };
  return safe(async () => {
    const r = await addDoc(collection(db, 'leave_requests'), payload);
    invalidateCache('leave_requests');
    return { id: r.id, ...payload };
  }, null);
}

export async function updateLeaveRequest(id, patch) {
  if (!guard()) return;
  await safe(async () => {
    await updateDoc(doc(db, 'leave_requests', id), { ...patch, updatedAt: serverTimestamp() });
    invalidateCache('leave_requests');
  });
}

// Alias kept for backward compatibility
export const updateLeaveStatus = updateLeaveRequest;

// ─── Employee Removal ─────────────────────────────────────────────────────────
export async function removeEmployee(id, reason, extra = {}) {
  if (!guard()) return;
  await safe(async () => {
    await updateDoc(doc(db, 'employees', id), {
      status: 'REMOVED',
      removalReason: reason,
      leavingDate: extra.leavingDate || new Date().toISOString().slice(0, 10),
      ...extra,
      updatedAt: serverTimestamp(),
    });
    invalidateCache('employees');
  });
}

// ─── Employee Rejoin ──────────────────────────────────────────────────────────
export async function rejoinEmployee(id, patch = {}) {
  if (!guard()) return;
  await safe(async () => {
    await updateDoc(doc(db, 'employees', id), {
      status: 'ACTIVE',
      rejoinDate: patch.rejoinDate || new Date().toISOString().slice(0, 10),
      ...patch,
      updatedAt: serverTimestamp(),
    });
    invalidateCache('employees');
  });
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

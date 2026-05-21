import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  signOut as fbSignOut,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, query, collection, where, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { otpAPI } from '../services/api';

// ─── Admin phone number (E.164 format) ───────────────────────────────────────
const ADMIN_PHONE = '+911234567890';
const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';

const AuthContext = createContext(null);

// ─── Resolve a phone number strictly as a specific role ───────────────────────
async function resolvePhoneAsRole(phone, loginRole) {
  // Always check admin first — no Firestore needed
  if (loginRole === 'admin') {
    const digits = phone.replace(/\D/g, '');
    const adminDigits = ADMIN_PHONE.replace(/\D/g, '');
    if (digits.endsWith(adminDigits.slice(-10))) {
      return { role: 'SCHOOL_ADMIN', tenantId: TENANT_ID, fullName: 'School Administrator', phone, displayName: 'Admin' };
    }
    return null;
  }

  // For staff/parent — if Firebase is not configured, allow login with selected role (dev fallback)
  if (!isFirebaseConfigured || !db) {
    console.warn('[Auth] Firebase not configured — allowing login with selected role (dev mode):', loginRole);
    return {
      role: loginRole === 'staff' ? 'STAFF' : 'PARENT',
      tenantId: TENANT_ID, fullName: 'User', phone, displayName: 'User',
    };
  }

  // Last 10 digits — handles +91XXXXXXXXXX, 91XXXXXXXXXX, or plain XXXXXXXXXX
  const digits10 = phone.replace(/\D/g, '').slice(-10);

  if (loginRole === 'staff') {
    try {
      const allEmps = await getDocs(collection(db, 'employees'));
      console.log('[Auth] Checking', allEmps.docs.length, 'employees for phone', digits10);
      const match = allEmps.docs.find(d => {
        const data = d.data();
        if (data.tenantId && data.tenantId !== TENANT_ID) return false;
        // phoneNumber is the field saved by EmployeeAdd form
        const stored = (data.phoneNumber || data.phone || '').replace(/\D/g, '').slice(-10);
        console.log('[Auth] Employee:', data.fullName, '→ stored phone:', stored);
        return stored === digits10;
      });
      if (match) {
        const emp = match.data();
        console.log('[Auth] Staff match found:', emp.fullName);
        return {
          role: emp.role || 'STAFF',
          tenantId: TENANT_ID,
          fullName: emp.fullName || emp.name || 'Staff Member',
          phone, email: emp.email || '',
          employeeId: match.id, department: emp.department,
          designation: emp.designation, className: emp.className,
          salary: emp.salary, displayName: emp.fullName || emp.name,
        };
      }
      console.warn('[Auth] No employee found with phone:', digits10);
    } catch (e) {
      console.error('[Auth] Employee lookup error:', e);
    }
    return null;
  }

  if (loginRole === 'parent') {
    try {
      const allStudents = await getDocs(collection(db, 'students'));
      console.log('[Auth] Checking', allStudents.docs.length, 'students for parent phone', digits10);
      const matchedChildren = [];
      let parentFullName = 'Parent';

      for (const d of allStudents.docs) {
        const s = d.data();
        if (s.tenantId && s.tenantId !== TENANT_ID) continue;
        if (s.status === 'REMOVED') continue;
        for (const [field, nameField] of [
          ['fatherPhone', 'fatherName'],
          ['motherPhone', 'motherName'],
          ['guardianPhone', 'guardianName'],
        ]) {
          const stored = (s[field] || '').replace(/\D/g, '').slice(-10);
          if (stored && stored === digits10) {
            console.log('[Auth] Parent match found in student:', s.fullName, 'via', field);
            parentFullName = s[nameField] || 'Parent';
            matchedChildren.push({
              id: d.id, name: s.fullName,
              className: s.className, section: s.section,
              admissionNo: s.admissionNo,
            });
            break; // avoid double-adding same student via multiple phone fields
          }
        }
      }

      if (matchedChildren.length > 0) {
        const primary = matchedChildren[0];
        return {
          role: 'PARENT', tenantId: TENANT_ID,
          fullName: parentFullName, phone,
          linkedStudentId: primary.id, linkedStudentName: primary.name,
          linkedStudentClass: primary.className, section: primary.section,
          linkedStudents: matchedChildren,
          displayName: parentFullName,
        };
      }
      console.warn('[Auth] No student found with parent phone:', digits10);
    } catch (e) {
      console.error('[Auth] Parent lookup error:', e);
    }
    return null;
  }

  return null;
}

// ─── Role resolver: phone → role + linked data ────────────────────────────────
async function resolveRoleByPhone(phone) {
  if (!isFirebaseConfigured || !db) return null;

  // 1. Admin phone check
  const normalised = phone.replace(/\s/g, '');
  if (normalised === ADMIN_PHONE || normalised === ADMIN_PHONE.replace('+91', '') || normalised === '1234567890') {
    return {
      role: 'SCHOOL_ADMIN',
      tenantId: TENANT_ID,
      fullName: 'School Administrator',
      phone: normalised,
      displayName: 'Admin',
    };
  }

  // 2. Check employees collection (match last 10 digits of phoneNumber field)
  try {
    const digits10 = phone.replace(/\D/g, '').slice(-10);
    const allEmps = await getDocs(collection(db, 'employees'));
    const empMatch = allEmps.docs.find(d => {
      const data = d.data();
      if (data.tenantId && data.tenantId !== TENANT_ID) return false;
      const stored = (data.phoneNumber || data.phone || '').replace(/\D/g, '').slice(-10);
      return stored === digits10;
    });
    if (empMatch) {
      const emp = empMatch.data();
      return {
        role: emp.role || 'STAFF', tenantId: TENANT_ID,
        fullName: emp.fullName || emp.name || 'Staff Member', phone,
        employeeId: empMatch.id, department: emp.department,
        designation: emp.designation, className: emp.className,
        displayName: emp.fullName || emp.name,
      };
    }
  } catch (e) { console.warn('Employee lookup failed', e); }

  // 3. Check students collection (parent phone — match last 10 digits)
  try {
    const digits10 = phone.replace(/\D/g, '').slice(-10);
    const allStudents = await getDocs(collection(db, 'students'));
    for (const d of allStudents.docs) {
      const s = d.data();
      if (s.tenantId && s.tenantId !== TENANT_ID) continue;
      for (const [field, nameField] of [
        ['fatherPhone', 'fatherName'],
        ['motherPhone', 'motherName'],
        ['guardianPhone', 'guardianName'],
      ]) {
        const stored = (s[field] || '').replace(/\D/g, '').slice(-10);
        if (stored === digits10) {
          return {
            role: 'PARENT', tenantId: TENANT_ID,
            fullName: s[nameField] || 'Parent', phone,
            linkedStudentId: d.id, linkedStudentName: s.fullName,
            linkedStudentClass: s.className,
            displayName: s[nameField] || 'Parent',
          };
        }
      }
    }
  } catch (e) { console.warn('Student parent lookup failed', e); }

  // 4. Default: treat as STAFF if phone matches phoneNumber in students (student self-login)
  try {
    const q = query(
      collection(db, 'students'),
      where('tenantId', '==', TENANT_ID),
      where('phoneNumber', '==', phone)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const student = snap.docs[0].data();
      return {
        role: 'STUDENT',
        tenantId: TENANT_ID,
        fullName: student.fullName,
        phone,
        studentId: snap.docs[0].id,
        className: student.className,
        section: student.section,
        admissionNo: student.admissionNo,
      };
    }
  } catch (e) { console.warn('Student lookup failed', e); }

  // 5. Unknown phone — return null so the caller can use the login-screen role
  return null;
}

// ─── Save/update user profile in Firestore ────────────────────────────────────
async function upsertUserProfile(uid, profileData) {
  if (!isFirebaseConfigured || !db) return;
  try {
    await setDoc(doc(db, 'users', uid), {
      ...profileData,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (e) { console.warn('Profile upsert failed', e); }
}

// ─── AuthProvider ─────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // ── Restore session on load ──
  useEffect(() => {
    // Backend OTP sessions are always stored in localStorage — check this first
    const stored = localStorage.getItem('stpauls_session');
    if (stored) {
      try {
        const { u, p } = JSON.parse(stored);
        if (u && p) {
          setUser(u);
          setProfile(p);
          setLoading(false);
          return; // Session restored from localStorage — skip Firebase Auth listener
        }
      } catch {}
    }

    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    // Only fall through to Firebase Auth if no localStorage session
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const phone = fbUser.phoneNumber;
        setUser({ uid: fbUser.uid, phone });
        try {
          const snap = await getDoc(doc(db, 'users', fbUser.uid));
          if (snap.exists()) {
            setProfile(snap.data());
          } else if (phone) {
            const resolved = await resolveRoleByPhone(phone);
            if (resolved) {
              await upsertUserProfile(fbUser.uid, { ...resolved, uid: fbUser.uid, createdAt: serverTimestamp() });
              setProfile(resolved);
            }
          }
        } catch (e) { console.warn('Profile load failed', e); }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Stores the normalised E.164 phone and selected role while waiting for OTP
  const pendingPhoneRef = useRef(null);
  const selectedRoleRef = useRef(null);  // 'admin' | 'staff' | 'parent'

  // Map login-screen role id → Firestore role string
  const ROLE_MAP = { admin: 'SCHOOL_ADMIN', staff: 'STAFF', parent: 'PARENT' };

  // ── Step 1: Send OTP via backend (MSG91/Fast2SMS — no reCAPTCHA needed) ──
  const sendOTP = useCallback(async (rawPhone, selectedRole = null) => {
    setAuthError(null);
    const digits = rawPhone.replace(/\D/g, '');
    const phone = digits.startsWith('91') && digits.length === 12
      ? `+${digits}`
      : digits.length === 10
        ? `+91${digits}`
        : `+${digits}`;

    selectedRoleRef.current = selectedRole;  // remember which role the user picked

    try {
      const res = await otpAPI.sendOTP(phone);
      pendingPhoneRef.current = phone;
      localStorage.setItem('stpauls_pending_phone', phone);
      const devOtp = res.data?.dev ? res.data?.otp : null;
      const channel = res.data?.channel || 'sms';  // 'whatsapp' | 'sms'
      return { ok: true, phone, devOtp, channel };
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || 'Failed to send OTP. Please try again.';
      setAuthError(detail);
      return { ok: false, error: detail };
    }
  }, []);

  // ── Step 2: Verify OTP via backend, then resolve role from Firestore ──
  const verifyOTP = useCallback(async (otp, phone) => {
    setAuthError(null);
    const targetPhone = phone || pendingPhoneRef.current || localStorage.getItem('stpauls_pending_phone');

    if (!targetPhone) {
      return { ok: false, error: 'Session expired. Please request OTP again.' };
    }

    try {
      const res = await otpAPI.verifyOTP(targetPhone, otp);
      if (!res.data?.verified) {
        return { ok: false, error: 'OTP verification failed. Please try again.' };
      }

      const verifiedPhone = res.data.phone || targetPhone;
      const loginRole = selectedRoleRef.current; // 'admin' | 'staff' | 'parent'

      // Strict role validation: phone must match the selected role
      const effectiveRole = loginRole || 'admin';
      const roleProfile = await resolvePhoneAsRole(verifiedPhone, effectiveRole);
      if (!roleProfile) {
        const digits10 = verifiedPhone.replace(/\D/g, '').slice(-10);
        const errors = {
          admin:  'This is not the admin number. Only the registered admin phone can use Admin login.',
          staff:  `Phone ${digits10} is not registered as staff. Please check the number or ask admin to add it in the Employees section.`,
          parent: `Phone ${digits10} is not registered as a parent. Use the father's/mother's phone number given during your child's admission.`,
        };
        selectedRoleRef.current = null;
        return { ok: false, error: errors[effectiveRole] || 'Phone number not recognized for this role.' };
      }

      const uid = `phone_${verifiedPhone.replace(/\D/g, '')}`;
      const u = { uid, phone: verifiedPhone };
      const p = roleProfile;
      selectedRoleRef.current = null;

      // Persist session
      localStorage.setItem('stpauls_session', JSON.stringify({ u, p }));
      localStorage.removeItem('stpauls_pending_phone');
      pendingPhoneRef.current = null;
      selectedRoleRef.current = null;

      await upsertUserProfile(uid, { ...p, uid });

      setUser(u);
      setProfile(p);
      return { ok: true, profile: p };
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || 'Incorrect OTP. Please try again.';
      setAuthError(detail);
      return { ok: false, error: detail };
    }
  }, []);

  // ── Sign out ──
  const signOut = useCallback(async () => {
    localStorage.removeItem('stpauls_session');
    localStorage.removeItem('stpauls_pending_phone');
    pendingPhoneRef.current = null;
    setUser(null); setProfile(null);
    if (isFirebaseConfigured && auth) {
      try { await fbSignOut(auth); } catch {}
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user, profile, loading, authError,
      sendOTP, verifyOTP, signOut,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

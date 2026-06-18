import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  onAuthStateChanged,
  signOut as fbSignOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, query, collection, where, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { otpAPI } from '../services/api';

// ─── Admin phone numbers (E.164 format) — add more numbers to this list ────────
const ADMIN_PHONES = ['+918897245345', '+916304300354', '+919949156948', '+918978186701', '+919553123327'];
const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';

const AuthContext = createContext(null);

// ─── Resolve a phone number strictly as a specific role ───────────────────────
async function resolvePhoneAsRole(phone, loginRole) {
  // Always check admin first — no Firestore needed
  if (loginRole === 'admin') {
    const digits = phone.replace(/\D/g, '');
    const isAdmin = ADMIN_PHONES.some(ap => digits.endsWith(ap.replace(/\D/g, '').slice(-10)));
    if (isAdmin) {
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
        const res = {
          role: emp.role || 'STAFF',
          tenantId: TENANT_ID,
          fullName: emp.fullName || emp.name || 'Staff Member',
          phone, email: emp.email || '',
          employeeId: match.id, department: emp.department,
          designation: emp.designation, className: emp.className,
          salary: emp.salary, displayName: emp.fullName || emp.name,
          permissions: emp.permissions || [],
        };
        Object.keys(res).forEach(key => res[key] === undefined && delete res[key]);
        return res;
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
          ['phoneNumber', 'fatherName'],
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
        const res = {
          role: 'PARENT', tenantId: TENANT_ID,
          fullName: parentFullName, phone,
          linkedStudentId: primary.id, linkedStudentName: primary.name,
          linkedStudentClass: primary.className, section: primary.section,
          linkedStudents: matchedChildren,
          displayName: parentFullName,
        };
        Object.keys(res).forEach(key => res[key] === undefined && delete res[key]);
        return res;
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
  const ADMIN_PHONES = ['+918897245345', '+916304300354', '+919949156948', '+918978186701', '+919553123327', 'admin'];
  if (ADMIN_PHONES.includes(normalised) || ADMIN_PHONES.some(p => p.replace('+91', '') === normalised)) {
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
        const res = {
          role: emp.role || 'STAFF', tenantId: TENANT_ID,
          fullName: emp.fullName || emp.name || 'Staff Member', phone,
          employeeId: empMatch.id, department: emp.department,
          designation: emp.designation, className: emp.className,
          displayName: emp.fullName || emp.name,
          permissions: emp.permissions || [],
        };
        // Strip undefined to avoid Firebase Error
        Object.keys(res).forEach(key => res[key] === undefined && delete res[key]);
        return res;
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
        ['phoneNumber', 'fatherName'],
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

// ─── Check if a phone number has a PIN set in Firestore ─────────────────────
async function checkPinByPhone(phone) {
  if (!isFirebaseConfigured || !db) return null;
  const digits10 = phone.replace(/\D/g, '').slice(-10);
  try {
    // Check users collection — look for any user doc where phone ends with digits10
    const usersSnap = await getDocs(collection(db, 'users'));
    for (const d of usersSnap.docs) {
      const data = d.data();
      const storedPhone = (data.phone || '').replace(/\D/g, '').slice(-10);
      if (storedPhone === digits10 && data.pin) {
        return { uid: d.id, pin: data.pin, profile: data };
      }
    }
  } catch (e) { console.warn('checkPinByPhone failed', e); }
  return null;
}

// ─── AuthProvider ─────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appLocked, setAppLocked] = useState(false);
  const [pinSetSession, setPinSetSession] = useState(false);
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
          if (p?.pin && !pinSetSession) setAppLocked(true);
          
          // We DO NOT set loading to false here. We wait for onAuthStateChanged 
          // to fire so that Firebase Auth is fully initialized before the Dashboard 
          // mounts and fires a dozen Firestore requests.
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
        let phone = fbUser.phoneNumber;
        if (!phone && fbUser.email && fbUser.email.endsWith('@stpauls.edu')) {
          phone = fbUser.email.split('@')[0];
        }
        let p = null;
        try {
          // Force token sync just to be completely safe
          try { await fbUser.getIdToken(true); } catch(err) {}
          
          const snap = await getDoc(doc(db, 'users', fbUser.uid));
          if (snap.exists()) p = snap.data();
          
          if (phone) {
            const loginRole = selectedRoleRef.current || p?.role?.toLowerCase() || 'admin';
            const resolved = await resolvePhoneAsRole(phone, loginRole);
            if (resolved) {
              const merged = p ? { ...p, ...resolved } : { ...resolved, uid: fbUser.uid, createdAt: serverTimestamp() };
              await upsertUserProfile(fbUser.uid, merged);
              p = merged;
            }
          }
        } catch (e) { console.warn('Profile load failed', e); }
        
        setUser({ uid: fbUser.uid, phone });
        if (p) {
          setProfile(p);
          if (p.pin && !pinSetSession) setAppLocked(true);
        }
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

  // ── Step 1: Send OTP via Firebase Phone Auth ──
  const setupRecaptcha = () => {
    // 1. Clean up previous verifier instance
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {
        console.warn('[Auth] Error clearing old reCAPTCHA instance:', e);
      }
      window.recaptchaVerifier = null;
    }

    // 2. Remove any old temporary DOM containers
    const oldTemp = document.getElementById('temp-recaptcha-container');
    if (oldTemp) {
      try {
        oldTemp.remove();
      } catch (e) {}
    }

    // 3. Create a fresh temporary DOM container
    // Do NOT use visibility: hidden or left/top -9999px here!
    // Invisible reCAPTCHA needs to be able to render a visible overlay challenge if it suspects a bot.
    const tempContainer = document.createElement('div');
    tempContainer.id = 'temp-recaptcha-container';
    document.body.appendChild(tempContainer);

    // 4. Instantiate invisible reCAPTCHA — no custom site key so Firebase
    //    uses its own built-in verification (avoids "invalid-app-credential" error)
    window.recaptchaVerifier = new RecaptchaVerifier(auth, tempContainer, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved automatically
      },
      'expired-callback': () => {
        if (window.recaptchaVerifier) {
          try { window.recaptchaVerifier.clear(); } catch (e) {}
          window.recaptchaVerifier = null;
          const t = document.getElementById('temp-recaptcha-container');
          if (t) { try { t.remove(); } catch (err) {} }
        }
      }
    });
  };

  // Friendly messages for Firebase Phone Auth errors
  const _friendlyFirebaseError = (code) => {
    switch (code) {
      case 'auth/too-many-requests':
        return 'Too many OTP requests from this device. Please wait a few minutes and try again.';
      case 'auth/invalid-phone-number':
        return 'Invalid phone number. Please enter a valid 10-digit Indian mobile number.';
      case 'auth/missing-phone-number':
        return 'Please enter your mobile number.';
      case 'auth/quota-exceeded':
        return 'SMS quota exceeded. Please try again after some time.';
      case 'auth/user-disabled':
        return 'This phone number has been disabled. Please contact the school admin.';
      case 'auth/invalid-app-credential':
      case 'auth/captcha-check-failed':
        return 'Verification failed. Please refresh the page and try again.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection and try again.';
      default:
        return null;
    }
  };

  const sendOTP = useCallback(async (rawPhone, selectedRole = null) => {
    setAuthError(null);
    const digits = rawPhone.replace(/\D/g, '');
    const phone = digits.startsWith('91') && digits.length === 12
      ? `+${digits}`
      : digits.length === 10
        ? `+91${digits}`
        : `+${digits}`;

    selectedRoleRef.current = selectedRole;  // remember which role the user picked

    if (Capacitor.isNativePlatform()) {
      console.log('[NativeAuth] Initiating phone auth natively for phone:', phone);
      const nativeAuthPromise = new Promise(async (resolve) => {
        let codeSentListener;
        let verificationFailedListener;

        const cleanupListeners = () => {
          if (codeSentListener) codeSentListener.remove();
          if (verificationFailedListener) verificationFailedListener.remove();
        };

        codeSentListener = await FirebaseAuthentication.addListener('phoneCodeSent', (event) => {
          console.log('[NativeAuth] phoneCodeSent event received:', event);
          window.nativeVerificationId = event.verificationId;
          pendingPhoneRef.current = phone;
          localStorage.setItem('stpauls_pending_phone', phone);
          cleanupListeners();
          resolve({ ok: true, phone, channel: 'sms', native: true });
        });

        verificationFailedListener = await FirebaseAuthentication.addListener('phoneVerificationFailed', (error) => {
          console.error('[NativeAuth] phoneVerificationFailed event received:', error);
          cleanupListeners();
          resolve({ ok: false, fallbackToWeb: true, error });
        });

        try {
          await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: phone });
        } catch (e) {
          console.error('[NativeAuth] Exception during native signInWithPhoneNumber:', e);
          cleanupListeners();
          resolve({ ok: false, fallbackToWeb: true, error: e });
        }
      });

      const nativeResult = await nativeAuthPromise;
      if (nativeResult.ok) {
        return nativeResult; // Native auth succeeded
      } else if (!nativeResult.fallbackToWeb) {
        // Hard failure
        const friendly = _friendlyFirebaseError(nativeResult.error?.code) || nativeResult.error?.message || 'Failed to send OTP. Please try again.';
        setAuthError(friendly);
        return { ok: false, error: friendly };
      }
      // If we reach here, Native Auth failed (e.g. Play Integrity failed), so we fallback to Web SDK below
      console.warn('[NativeAuth] Native auth failed, falling back to Web SDK (reCAPTCHA)...');
    }

    try {
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const confirmationResult = await signInWithPhoneNumber(auth, phone, appVerifier);
      window.confirmationResult = confirmationResult;

      pendingPhoneRef.current = phone;
      localStorage.setItem('stpauls_pending_phone', phone);
      return { ok: true, phone, channel: 'sms', native: false };
    } catch (e) {
      // Clean up the reCAPTCHA widget so fresh one is created on retry
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (err) {}
        window.recaptchaVerifier = null;
      }
      const friendly = _friendlyFirebaseError(e?.code) || e?.message || 'Failed to send OTP. Please try again.';
      setAuthError(friendly);
      return { ok: false, error: friendly };
    }
  }, []);

  // ── Step 2: Verify OTP via Firebase, then resolve role from Firestore ──
  const verifyOTP = useCallback(async (otp, phone) => {
    setAuthError(null);
    const targetPhone = phone || pendingPhoneRef.current || localStorage.getItem('stpauls_pending_phone');

    if (Capacitor.isNativePlatform() && window.nativeVerificationId) {
      const verificationId = window.nativeVerificationId;
      if (!targetPhone || !verificationId) {
        return { ok: false, error: 'Session expired. Please request OTP again.' };
      }

      try {
        console.log('[NativeAuth] Creating web SDK credential and signing in with verificationId:', verificationId);
        const credential = PhoneAuthProvider.credential(verificationId, otp);
        const result = await signInWithCredential(auth, credential);
        const fbUser = result.user;
        const verifiedPhone = fbUser.phoneNumber || targetPhone;

        const loginRole = selectedRoleRef.current; // 'admin' | 'staff' | 'parent'

        // Strict role validation: phone must match the selected role
        const effectiveRole = loginRole || 'admin';
        const roleProfile = await resolvePhoneAsRole(verifiedPhone, effectiveRole);
        if (!roleProfile) {
          await fbSignOut(auth); // Sign out unauthorized user
          try { await FirebaseAuthentication.signOut(); } catch (nativeSignOutError) {
            console.warn('[NativeAuth] Error signing out native user after unauthorized check:', nativeSignOutError);
          }
          const digits10 = verifiedPhone.replace(/\D/g, '').slice(-10);
          const errors = {
            admin:  'This is not the admin number. Only the registered admin phone can use Admin login.',
            staff:  `Phone ${digits10} is not registered as staff. Please check the number or ask admin to add it in the Employees section.`,
            parent: `Phone ${digits10} is not registered as a parent. Use the father's/mother's phone number given during your child's admission.`,
          };
          selectedRoleRef.current = null;
          return { ok: false, error: errors[effectiveRole] || 'Phone number not recognized for this role.' };
        }

        const uid = fbUser.uid;
        const u = { uid, phone: verifiedPhone };
        const p = roleProfile;
        selectedRoleRef.current = null;

        // Persist session
        localStorage.setItem('stpauls_session', JSON.stringify({ u, p }));
        localStorage.removeItem('stpauls_pending_phone');
        pendingPhoneRef.current = null;
        window.nativeVerificationId = null;

        // Force token sync before Firestore calls
        try { await fbUser.getIdToken(true); } catch (err) {}

        await upsertUserProfile(uid, { ...p, uid });

        setUser(u);
        setProfile(p);
        return { ok: true, profile: p };
      } catch (e) {
        console.error('[NativeAuth] Native verifyOTP error:', e);
        let detail;
        switch (e?.code) {
          case 'auth/invalid-verification-code':
          case 'invalid-verification-code':
            detail = 'Incorrect OTP. Please check and try again.'; break;
          case 'auth/code-expired':
            detail = 'OTP has expired. Please request a new one.'; break;
          case 'auth/session-expired':
            detail = 'Session expired. Please request OTP again.'; break;
          case 'auth/too-many-requests':
            detail = 'Too many attempts. Please wait a few minutes and try again.'; break;
          case 'auth/network-request-failed':
            detail = 'Network error. Please check your internet connection.'; break;
          default:
            detail = e?.message || 'Incorrect OTP. Please try again.';
        }
        setAuthError(detail);
        return { ok: false, error: detail };
      }
    }

    if (!targetPhone || !window.confirmationResult) {
      return { ok: false, error: 'Session expired. Please request OTP again.' };
    }

    try {
      const result = await window.confirmationResult.confirm(otp);
      const fbUser = result.user;
      const verifiedPhone = fbUser.phoneNumber || targetPhone;

      const loginRole = selectedRoleRef.current; // 'admin' | 'staff' | 'parent'

      // Strict role validation: phone must match the selected role
      const effectiveRole = loginRole || 'admin';
      const roleProfile = await resolvePhoneAsRole(verifiedPhone, effectiveRole);
      if (!roleProfile) {
        await fbSignOut(auth); // Sign out unauthorized user
        const digits10 = verifiedPhone.replace(/\D/g, '').slice(-10);
        const errors = {
          admin:  'This is not the admin number. Only the registered admin phone can use Admin login.',
          staff:  `Phone ${digits10} is not registered as staff. Please check the number or ask admin to add it in the Employees section.`,
          parent: `Phone ${digits10} is not registered as a parent. Use the father's/mother's phone number given during your child's admission.`,
        };
        selectedRoleRef.current = null;
        return { ok: false, error: errors[effectiveRole] || 'Phone number not recognized for this role.' };
      }

      const uid = fbUser.uid;
      const u = { uid, phone: verifiedPhone };
      const p = roleProfile;
      selectedRoleRef.current = null;

      // Persist session
      localStorage.setItem('stpauls_session', JSON.stringify({ u, p }));
      localStorage.removeItem('stpauls_pending_phone');
      pendingPhoneRef.current = null;
      window.confirmationResult = null;

      // Force token sync before Firestore calls
      try { await fbUser.getIdToken(true); } catch (err) {}

      await upsertUserProfile(uid, { ...p, uid });

      setUser(u);
      setProfile(p);
      return { ok: true, profile: p };
    } catch (e) {
      let detail;
      switch (e?.code) {
        case 'auth/invalid-verification-code':
          detail = 'Incorrect OTP. Please check and try again.'; break;
        case 'auth/code-expired':
          detail = 'OTP has expired. Please request a new one.'; break;
        case 'auth/session-expired':
          detail = 'Session expired. Please request OTP again.'; break;
        case 'auth/too-many-requests':
          detail = 'Too many attempts. Please wait a few minutes and try again.'; break;
        case 'auth/network-request-failed':
          detail = 'Network error. Please check your internet connection.'; break;
        default:
          detail = e?.message || 'Incorrect OTP. Please try again.';
      }
      setAuthError(detail);
      return { ok: false, error: detail };
    }
  }, []);

  // ── Restore session directly (used by PIN login in LoginPage) ──
  const restoreSession = useCallback((u, p) => {
    localStorage.setItem('stpauls_session', JSON.stringify({ u, p }));
    setUser(u);
    setProfile(p);
    setAppLocked(false);
  }, []);

  // ── Sign out ──
  const signOut = useCallback(async () => {
    // Clear local storage and state
    localStorage.removeItem('stpauls_session');
    setUser(null);
    setProfile(null);
    setAppLocked(false);

    // Explicitly sign out of Firebase Auth to prevent auto-login loops
    try {
      await fbSignOut(auth);
      await FirebaseAuthentication.signOut();
    } catch (e) {
      console.warn('Firebase signout error', e);
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user, profile, loading, authError, appLocked, setAppLocked, setPinSetSession,
      sendOTP, verifyOTP, signOut, restoreSession, setLoginRole: (role) => { selectedRoleRef.current = role; },
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

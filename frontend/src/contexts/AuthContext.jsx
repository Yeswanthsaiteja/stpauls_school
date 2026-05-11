import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';

// Demo mode: when Firebase isn't configured, allow local demo accounts so the
// UI can be explored end-to-end without setup.
const DEMO_USERS = {
  'admin@demo.school': { password: 'demo1234', role: 'SCHOOL_ADMIN', fullName: 'Asha Reddy', tenantId: 'demo' },
  'staff@demo.school': { password: 'demo1234', role: 'STAFF', fullName: 'Vikram Rao', tenantId: 'demo' },
  'parent@demo.school': { password: 'demo1234', role: 'PARENT', fullName: 'Priya Iyer', tenantId: 'demo', linkedStudentId: 'demo-stu-1' },
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);   // { uid, email }
  const [profile, setProfile] = useState(null); // { role, tenantId, fullName, ... }
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const fetchProfile = useCallback(async (uid) => {
    if (!isFirebaseConfigured || !db) return null;
    try {
      const ref = doc(db, 'users', uid);
      const snap = await getDoc(ref);
      return snap.exists() ? snap.data() : null;
    } catch (e) {
      console.warn('profile fetch failed', e);
      return null;
    }
  }, []);

  useEffect(() => {
    // Hydrate demo session
    const stored = localStorage.getItem('benita_demo_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser({ uid: parsed.email, email: parsed.email });
        setProfile(parsed.profile);
      } catch {}
    }

    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setUser({ uid: fbUser.uid, email: fbUser.email });
        const p = await fetchProfile(fbUser.uid);
        setProfile(p || { role: 'SCHOOL_ADMIN', tenantId: 'default', fullName: fbUser.email });
      } else if (!localStorage.getItem('benita_demo_user')) {
        setUser(null); setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub && unsub();
  }, [fetchProfile]);

  const signIn = async (email, password) => {
    setAuthError(null);
    const key = String(email || '').trim().toLowerCase();

    // Demo mode shortcut
    if (DEMO_USERS[key] && DEMO_USERS[key].password === password) {
      const demo = DEMO_USERS[key];
      const session = { email: key, profile: demo };
      localStorage.setItem('benita_demo_user', JSON.stringify(session));
      setUser({ uid: key, email: key });
      setProfile(demo);
      return { ok: true };
    }

    if (!isFirebaseConfigured || !auth) {
      const msg = 'Use demo accounts: admin@demo.school / staff@demo.school / parent@demo.school (password: demo1234)';
      setAuthError(msg);
      return { ok: false, error: msg };
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { ok: true };
    } catch (e) {
      const msg = e?.code === 'auth/invalid-credential' ? 'Invalid email or password' : (e?.message || 'Sign-in failed');
      setAuthError(msg);
      return { ok: false, error: msg };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('benita_demo_user');
    setUser(null); setProfile(null);
    if (isFirebaseConfigured && auth) {
      try { await fbSignOut(auth); } catch {}
    }
  };

  const resetPassword = async (email) => {
    if (!isFirebaseConfigured || !auth) {
      return { ok: false, error: 'Firebase not configured' };
    }
    try {
      await sendPasswordResetEmail(auth, email);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e?.message };
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, authError, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

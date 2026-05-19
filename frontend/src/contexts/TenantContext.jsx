import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { isFirebaseConfigured, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const TenantContext = createContext(null);

const DEMO_TENANT = {
  id: 'stpauls',
  name: "St. Paul's High School",
  organizationName: "St. Paul's High School",
  logoUrl: '',
  primaryColor: '#6366f1',
  accentColor: '#a5b4fc',
  subscriptionStartDate: new Date().toISOString(),
  subscriptionEndDate: new Date(Date.now() + 365 * 86400000).toISOString(),
  address: 'Hyderabad, Telangana',
  contactNumber: '+91 9000000000',
  email: 'office@stpauls.edu.in',
};

export function TenantProvider({ children }) {
  const { profile } = useAuth();
  const [tenant, setTenant] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const tid = profile?.tenantId;
      if (!tid) { setTenant(null); return; }
      if (!isFirebaseConfigured || !db) {
        setTenant(DEMO_TENANT);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'tenants', tid));
        if (active) setTenant(snap.exists() ? { id: tid, ...snap.data() } : DEMO_TENANT);
      } catch {
        if (active) setTenant(DEMO_TENANT);
      }
    };
    load();
    return () => { active = false; };
  }, [profile]);

  // Apply tenant primary color
  useEffect(() => {
    if (tenant?.primaryColor) {
      document.documentElement.style.setProperty('--tenant-primary', tenant.primaryColor);
    }
  }, [tenant]);

  // Subscription status
  let subscription = { status: 'active', daysLeft: null };
  if (tenant?.subscriptionEndDate) {
    const end = new Date(tenant.subscriptionEndDate);
    const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
    if (days < 0) subscription = { status: 'expired', daysLeft: 0 };
    else if (days <= 30) subscription = { status: 'expiring', daysLeft: days };
    else subscription = { status: 'active', daysLeft: days };
  }

  return (
    <TenantContext.Provider value={{ tenant, subscription, setTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);

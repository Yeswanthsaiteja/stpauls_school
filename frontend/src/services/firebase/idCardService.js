/**
 * idCardService.js — Firestore CRUD for ID card configurations.
 * Stores per-class theme assignments and school settings.
 */
import {
  doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { safe } from './firestoreHelpers';

const TENANT_ID = process.env.REACT_APP_TENANT_ID || 'stpauls';
const COL = 'id_card_configs';

function configId(academicYear, className, section) {
  return `${TENANT_ID}_${academicYear}_${className}_${section}`.replace(/\s+/g, '_');
}

/**
 * Load a saved ID card config for a given academic year / class / section.
 * Returns { assignments, schoolConfig } or null.
 */
export async function loadIdCardConfig(academicYear, className, section) {
  if (!isFirebaseConfigured || !db) return null;
  return safe(async () => {
    const snap = await getDoc(doc(db, COL, configId(academicYear, className, section)));
    return snap.exists() ? snap.data() : null;
  }, null);
}

/**
 * Save the full ID card config for a given academic year / class / section.
 * @param {string} academicYear
 * @param {string} className
 * @param {string} section
 * @param {Object} assignments  — { [studentId]: { theme, shade, photoDataUrl, name, fatherName, contactNo } }
 * @param {Object} schoolConfig — { logoDataUrl, schoolName, address, signatureDataUrl }
 */
export async function saveIdCardConfig(academicYear, className, section, assignments, schoolConfig) {
  if (!isFirebaseConfigured || !db) return;
  const id = configId(academicYear, className, section);
  const payload = {
    tenantId: TENANT_ID,
    academicYear,
    className,
    section,
    assignments,
    schoolConfig,
    updatedAt: serverTimestamp(),
  };
  await safe(() => setDoc(doc(db, COL, id), payload, { merge: true }));
}

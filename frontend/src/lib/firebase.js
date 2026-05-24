// Firebase initialization. Reads from REACT_APP_FIREBASE_* env vars.
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  RecaptchaVerifier,       // re-export for phone auth
  signInWithPhoneNumber,   // re-export for phone auth
} from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
export { RecaptchaVerifier, signInWithPhoneNumber };


const cfg = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID, // Required for reCAPTCHA Enterprise with Identity Platform
};

const databaseId = process.env.REACT_APP_FIRESTORE_DATABASE_ID || '';

export const isFirebaseConfigured = Boolean(
  cfg.apiKey && cfg.projectId && cfg.appId
);

let app = null;
let auth = null;
let db = null;
let storage = null;

if (isFirebaseConfigured) {
  app = getApps().length ? getApps()[0] : initializeApp(cfg);
  auth = getAuth(app);
  // Use a named Firestore database if provided, else default
  if (databaseId) {
    try {
      db = initializeFirestore(app, {}, databaseId);
    } catch {
      db = getFirestore(app, databaseId);
    }
  } else {
    db = getFirestore(app);
  }
  storage = getStorage(app);
}

export { app, auth, db, storage, databaseId };

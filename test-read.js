require('dotenv').config({ path: 'frontend/.env' });
const { initializeApp } = require('firebase/app');
const { getAuth, signInAnonymously } = require('firebase/auth');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const cfg = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
};

const app = initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  try {
    const cred = await signInAnonymously(auth);
    console.log("Logged in anonymously:", cred.user.uid);
    const snap = await getDocs(collection(db, 'students'));
    console.log("Students:", snap.docs.length);
  } catch (err) {
    console.error("ERROR:", err.message);
  }
  process.exit();
}
run();

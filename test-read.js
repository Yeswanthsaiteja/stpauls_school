require('dotenv').config({ path: 'frontend/.env' });
const { initializeApp } = require('firebase/app');
const { getAuth, signInAnonymously } = require('firebase/auth');
const { getFirestore, collection, getDocs, addDoc } = require('firebase/firestore');

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
    console.log("Logged in anonymously");
    
    // Check if 8897245345 already exists
    const snap = await getDocs(collection(db, 'students'));
    let found = false;
    snap.docs.forEach(d => {
       const data = d.data();
       if (data.fatherPhone === '8897245345' || data.motherPhone === '8897245345') {
           console.log("Found existing student:", data.fullName);
           found = true;
       }
    });
    
    if (!found) {
        console.log("Adding Apple Reviewer student...");
        const docRef = await addDoc(collection(db, 'students'), {
            tenantId: 'stpauls',
            fullName: 'Apple Reviewer Demo Student',
            status: 'ACTIVE',
            fatherPhone: '8897245345',
            className: '1st',
            section: 'A',
            admissionNo: 'STPSTDAPPLE',
            createdAt: new Date().toISOString()
        });
        console.log("Added student with ID:", docRef.id);
    }
    
  } catch (err) {
    console.error("ERROR:", err.message);
  }
  process.exit();
}
run();

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const cfg = {
  apiKey: "AIzaSyBOsw0R1z6fEeD5B-XeqmK_BJKawwVkmds",
  authDomain: "stpauls-erp.firebaseapp.com",
  projectId: "stpauls-erp",
  databaseURL: "https://stpauls-erp-default-rtdb.asia-southeast1.firebasedatabase.app",
};

const app = initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  let user;
  try {
    const cred = await signInWithEmailAndPassword(auth, "test@stpauls.edu", "password123");
    user = cred.user;
    console.log("Logged in existing test user");
  } catch(e) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, "test@stpauls.edu", "password123");
      user = cred.user;
      console.log("Created test user");
    } catch(e2) {
      console.log("Failed to auth:", e2.message);
      process.exit(1);
    }
  }
  
  try {
    const snap = await getDocs(collection(db, 'students'));
    console.log("SUCCESS! Got students:", snap.docs.length);
  } catch(e) {
    console.log("FIRESTORE ERROR:", e.code, e.message);
  }
  process.exit(0);
}
run();

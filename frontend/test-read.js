const { initializeApp } = require('firebase/app');
const { getAuth, signInAnonymously } = require('firebase/auth');
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

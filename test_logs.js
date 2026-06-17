import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";
import fs from "fs";

// Read config from the frontend
const envContent = fs.readFileSync("frontend/.env", "utf-8");
const config = {};
envContent.split("\n").forEach(line => {
  const [k, v] = line.split("=");
  if (k && v) config[k.trim()] = v.trim().replace(/"/g, '');
});

const firebaseConfig = {
  apiKey: config.REACT_APP_FIREBASE_API_KEY,
  authDomain: config.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: config.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: config.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: config.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: config.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  console.log("Fetching biometric logs...");
  const snap = await getDocs(query(collection(db, "biometric_logs")));
  console.log("Total logs found:", snap.size);
  
  if (snap.size > 0) {
    const docs = snap.docs.map(d => d.data());
    console.log("First 5 logs:");
    docs.slice(0, 5).forEach(d => console.log(d));

    // Get today's logs
    const today = "2026-06-15";
    const todayLogs = docs.filter(d => d.timestamp && String(d.timestamp).startsWith(today));
    console.log(`\nLogs for ${today}: ${todayLogs.length}`);
    if (todayLogs.length > 0) {
        console.log("Sample today log:", todayLogs[0]);
    }
  }

  console.log("\nFetching employees...");
  const empSnap = await getDocs(query(collection(db, "employees")));
  console.log("Total employees:", empSnap.size);
  const emps = empSnap.docs.map(d => d.data());
  const withRfid = emps.filter(e => e.rfidNo);
  console.log("Employees with RFID set:", withRfid.length);
  if (withRfid.length > 0) {
      console.log("Sample RFIDs:");
      withRfid.slice(0, 5).forEach(e => console.log(e.fullName, "->", e.rfidNo));
  }
}
check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

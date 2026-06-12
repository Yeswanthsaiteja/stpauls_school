const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const firebaseConfig = { projectId: "stpauls-erp" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
async function run() {
  const s = await getDocs(collection(db, 'employees'));
  s.forEach(d => console.log(d.id, d.data().fullName, d.data().permissions));
  process.exit(0);
}
run();

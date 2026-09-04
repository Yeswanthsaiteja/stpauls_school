const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccountFile = './firebase-admin-key.json';
let serviceAccount;

if (fs.existsSync(serviceAccountFile)) {
    serviceAccount = require(serviceAccountFile);
} else {
    // try to find any json file in backend
    const files = fs.readdirSync('.').filter(f => f.endsWith('.json') && !f.includes('package'));
    if (files.length > 0) {
        serviceAccount = require('./' + files[0]);
    } else {
        console.error("No service account key found");
        process.exit(1);
    }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkDiaries() {
  const snapshot = await db.collection('diary_entries').get();
  console.log(`Total diary entries: ${snapshot.size}`);
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id}, Date: ${data.date}, Year: ${data.academicYear}, Class: ${data.className}-${data.section}, Tenant: ${data.tenantId}`);
  });
}

checkDiaries().catch(console.error);

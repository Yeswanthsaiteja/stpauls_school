const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'stpauls-erp'
});

async function checkLogs() {
  const db = admin.firestore();
  const snapshot = await db.collection('biometric_logs').orderBy('timestamp', 'desc').limit(5).get();
  
  if (snapshot.empty) {
    console.log("No logs received yet. The machine hasn't pushed any data.");
  } else {
    console.log("Found " + snapshot.docs.length + " logs!");
    snapshot.forEach(doc => {
      console.log(doc.id, "=>", doc.data());
    });
  }
}
checkLogs().catch(console.error);

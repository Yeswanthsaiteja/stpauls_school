import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { execSync } from 'child_process';

initializeApp({
  credential: {
    getAccessToken: async () => {
      const token = execSync(
        'npx -y firebase-tools@latest --json tokens:get 2>/dev/null || npx firebase-tools print:token 2>/dev/null',
        { encoding: 'utf8' }
      ).trim();
      return { access_token: token, expires_in: 3600 };
    }
  },
  projectId: 'stpauls-erp',
});

const db = getFirestore();

async function run() {
  const dateStr = "2026-06-15";
  console.log('Querying biometric_logs for', dateStr);
  
  const snap = await db.collection('biometric_logs').get();
  console.log(`Total biometric_logs: ${snap.size}`);
  
  const todayLogs = snap.docs.map(d => d.data()).filter(log => log.timestamp && log.timestamp.startsWith(dateStr));
  console.log(`Logs for ${dateStr}: ${todayLogs.length}`);
  
  if (todayLogs.length > 0) {
    console.log('Sample today log:', todayLogs[0]);
    
    // Group logs by empCode
    const uniqueCodes = new Set(todayLogs.map(l => l.empCode));
    console.log(`Unique empCodes in today logs: ${uniqueCodes.size}`);
    console.log('Some codes:', Array.from(uniqueCodes).slice(0, 10));
  } else if (snap.size > 0) {
    console.log('Sample log (not today):', snap.docs[0].data());
  }

  const empSnap = await db.collection('employees').get();
  const employees = empSnap.docs.map(d => d.data());
  console.log(`\nTotal employees: ${employees.length}`);
  
  const withRfid = employees.filter(e => e.rfidNo);
  console.log(`Employees with rfidNo set: ${withRfid.length}`);
  
  if (withRfid.length > 0) {
    console.log('Sample rfidNo:', withRfid.slice(0, 5).map(e => ({ name: e.fullName, rfidNo: e.rfidNo })));
  }
}

run().catch(console.error);

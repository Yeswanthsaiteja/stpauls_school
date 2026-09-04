import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { execSync } from 'child_process';

initializeApp({
  credential: {
    getAccessToken: async () => {
      const token = execSync(
        'npx -y firebase-tools@latest print:token 2>/dev/null',
        { encoding: 'utf8' }
      ).trim();
      return { access_token: token, expires_in: 3600 };
    }
  },
  projectId: 'stpauls-erp',
});

const db = getFirestore();

async function main() {
  console.log("Fetching employees...");
  const snap = await db.collection("employees").get();
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const name = (data.fullName || data.empName || data.name || "").toLowerCase();
    
    if (
      (name.includes("abhi") && name.includes("46")) ||
      (name.includes("adharsh") && name.includes("47")) ||
      name === "abhi(46)" || name === "adharsh(47)" ||
      name === "abhi (46)" || name === "adharsh (47)"
    ) {
       console.log(`FOUND_DOC: employees/${d.id}`);
       count++;
    }
  }
  console.log(`Found ${count} matching employees.`);
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

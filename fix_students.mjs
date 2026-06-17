#!/usr/bin/env node

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: {
    getAccessToken: async () => {
      const { execSync } = await import('child_process');
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

async function main() {
  console.log('Fetching students...');
  const snap = await db.collection('students').get();
  const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  let count = 0;
  for (const s of students) {
    if (s.academicYear === '2025-26' || !s.academicYear) {
      console.log(`Updating ${s.fullName} (Adm No: ${s.admissionNo}) from ${s.academicYear || 'none'} to 2026-27`);
      await db.collection('students').doc(s.id).update({ academicYear: '2026-27' });
      count++;
    }
  }
  
  console.log(`Updated ${count} students successfully!`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

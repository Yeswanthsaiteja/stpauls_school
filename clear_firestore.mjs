/**
 * clear_firestore.mjs
 * Deletes ALL documents from ALL collections in the stpauls-erp Firestore database.
 * Uses firebase-admin with the project's service account via gcloud ADC or GOOGLE_APPLICATION_CREDENTIALS.
 * 
 * Run: node clear_firestore.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Init using project ID (relies on firebase-tools login or ADC) ──
initializeApp({
  credential: {
    getAccessToken: async () => {
      // Use firebase-tools cached token
      const { execSync } = await import('child_process');
      const token = execSync('npx -y firebase-tools@latest --json tokens:get 2>/dev/null || npx firebase-tools print:token 2>/dev/null', { encoding: 'utf8' }).trim();
      return { access_token: token, expires_in: 3600 };
    }
  },
  projectId: 'stpauls-erp',
});

const db = getFirestore();

const COLLECTIONS = [
  'students',
  'employees',
  'leave_requests',
  'activities',
  'notifications',
  'attendance',
  'fees',
  'fee_structures',
  'classes',
  'subjects',
  'timetable',
  'transport_routes',
  'hostel_rooms',
  'hostel_allocations',
  'transport_allocations',
  'announcements',
  'messages',
  'exam_schedules',
  'results',
  'lesson_plans',
  'promotions',
  'crm_leads',
  'diary_entries',
  'id_cards',
  'rfid_logs',
  'certificates',
];

async function deleteCollection(colName, batchSize = 400) {
  const colRef = db.collection(colName);
  let deleted = 0;
  while (true) {
    const snap = await colRef.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.docs.length;
    process.stdout.write(`  ✓ ${colName}: deleted ${deleted} docs so far...\r`);
  }
  return deleted;
}

async function main() {
  console.log('\n🗑️  St. Paul\'s Firestore — Full Database Wipe');
  console.log('═══════════════════════════════════════════════\n');
  console.log(`Project: stpauls-erp`);
  console.log(`Collections to clear: ${COLLECTIONS.length}\n`);

  let totalDeleted = 0;
  for (const col of COLLECTIONS) {
    process.stdout.write(`  Clearing ${col}...`);
    const n = await deleteCollection(col);
    if (n > 0) {
      console.log(`  ✅ ${col}: ${n} documents deleted`);
    } else {
      console.log(`  ⬜ ${col}: already empty`);
    }
    totalDeleted += n;
  }

  console.log(`\n✅  Done! Total documents deleted: ${totalDeleted}`);
  console.log('   Database is now clean.\n');
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});

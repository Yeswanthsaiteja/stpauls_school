#!/usr/bin/env node
/**
 * import_emp_codes.mjs
 * 
 * Reads the biometric CSV export and matches employee names to ERP employees in Firestore.
 * On match, updates the employee record with empCode and rfidNo.
 * 
 * Run: node import_emp_codes.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, '20260615151933_EmployeeDetails_Export_All.csv');

// ── Init Firebase Admin ─────────────────────────────────────────────────────
initializeApp({
  credential: {
    getAccessToken: async () => {
      const { execSync } = await import('child_process');
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

// ── Parse CSV ───────────────────────────────────────────────────────────────
async function parseCSV() {
  const rows = [];
  const stream = createReadStream(CSV_PATH, { encoding: 'utf8' });
  const rl = createInterface({ input: stream });

  let headers = null;
  for await (const line of rl) {
    const cols = line.split(',');
    if (!headers) { headers = cols; continue; }
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = (cols[i] || '').trim(); });
    // Only process rows with a real name (not "User") and a valid empCode
    if (row.EmployeeName && row.EmployeeName !== 'User' && row.EmployeeCode) {
      rows.push({
        empCode: row.EmployeeCode,
        empName: row.EmployeeName.toUpperCase(),
        rfid:    row.RFID || '',
      });
    }
  }
  return rows;
}

// ── Name matching ────────────────────────────────────────────────────────────
function nameScore(csvName, erpName) {
  if (!csvName || !erpName) return 0;
  const csvWords = csvName.toUpperCase().split(/\s+/).filter(w => w.length > 2);
  const erpWords = erpName.toUpperCase().split(/\s+/).filter(w => w.length > 2);
  let matches = 0;
  for (const cw of csvWords) {
    if (erpWords.some(ew => ew.includes(cw) || cw.includes(ew))) matches++;
  }
  return matches;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n📋 Biometric Employee Code Import Tool');
  console.log('════════════════════════════════════════\n');

  // 1. Load CSV
  console.log('⏳ Reading CSV...');
  const csvRows = await parseCSV();
  console.log(`   Found ${csvRows.length} named employees in biometric CSV.\n`);

  // 2. Load ERP employees
  console.log('⏳ Loading ERP employees from Firestore...');
  const snap = await db.collection('employees').get();
  const erpEmployees = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(e => e.status !== 'REMOVED');
  console.log(`   Found ${erpEmployees.length} active ERP employees.\n`);

  // 3. Match
  console.log('🔍 Matching names...\n');
  const matched = [];
  const unmatched = [];

  for (const csv of csvRows) {
    let best = null;
    let bestScore = 0;

    for (const erp of erpEmployees) {
      const score = nameScore(csv.empName, erp.fullName);
      if (score > bestScore) {
        bestScore = score;
        best = erp;
      }
    }

    if (bestScore >= 1 && best) {
      matched.push({ csv, erp: best, score: bestScore });
    } else {
      unmatched.push(csv);
    }
  }

  // 4. Print matches
  console.log('✅ MATCHES FOUND:\n');
  console.log('   ERP Name                    CSV Name                   EmpCode     RFID');
  console.log('   ─────────────────────────────────────────────────────────────────────────');
  for (const m of matched) {
    const erpName = (m.erp.fullName || '').padEnd(27);
    const csvName = m.csv.empName.padEnd(27);
    console.log(`   ${erpName}  ${csvName}  ${m.csv.empCode.padEnd(12)}  ${m.csv.rfid}`);
  }

  console.log(`\n   Total matched: ${matched.length}`);
  console.log(`   Total unmatched (CSV): ${unmatched.length}\n`);

  if (unmatched.length > 0) {
    console.log('❌ UNMATCHED (CSV employees not found in ERP):');
    for (const u of unmatched) {
      console.log(`   ${u.empName.padEnd(30)} EmpCode: ${u.empCode}`);
    }
  }

  // 5. Confirm and update
  console.log('\n⚠️  About to update Firestore with the matched empCodes and RFID numbers.');
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');
  await new Promise(r => setTimeout(r, 5000));

  console.log('💾 Updating Firestore...');
  let updated = 0;
  for (const m of matched) {
    await db.collection('employees').doc(m.erp.id).update({
      empCode: m.csv.empCode,
      rfidNo:  m.csv.rfid || m.erp.rfidNo || '',
    });
    updated++;
    process.stdout.write(`   Updated ${updated}/${matched.length}: ${m.erp.fullName}\r`);
  }

  console.log(`\n\n✅ Done! Updated ${updated} employees with biometric codes.`);
  console.log('   You can now see their attendance data in the Employee Attendance page!\n');
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});

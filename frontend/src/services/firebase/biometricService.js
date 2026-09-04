/**
 * biometricService.js
 * Fetches biometric punch logs and computes attendance status for employees.
 */
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../lib/firebase';

function guard() { return isFirebaseConfigured && !!db; }

/**
 * Fetch all biometric logs for a given date (YYYY-MM-DD).
 * Returns an array of log objects.
 */
export async function getBiometricLogsForDate(dateStr) {
  if (!guard()) return [];
  try {
    // dateStr = "2026-06-15", we match timestamps that start with this prefix
    // by using a string range query: timestamp >= "2026-06-15" and timestamp < "2026-06-15\uf8ff"
    const endStr = dateStr + '\uf8ff';
    const q = query(
      collection(db, 'biometric_logs'),
      where('timestamp', '>=', dateStr),
      where('timestamp', '<', endStr)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('biometricService: getBiometricLogsForDate error', e);
    return [];
  }
}

/**
 * Fetch all biometric logs for a given month (YYYY-MM).
 */
export async function getBiometricLogsForMonth(monthStr) {
  if (!guard()) return [];
  try {
    const endStr = monthStr + '\uf8ff';
    const q = query(
      collection(db, 'biometric_logs'),
      where('timestamp', '>=', monthStr),
      where('timestamp', '<', endStr)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('biometricService: getBiometricLogsForMonth error', e);
    return [];
  }
}

/**
 * Parse "HH:MM" or "HH:MM:SS" string to total minutes from midnight.
 */
function toMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
}

/**
 * Format a timestamp string to "HH:MM AM/PM".
 */
export function formatPunchTime(ts) {
  if (!ts) return '—';
  try {
    // ts = "2026-06-15 09:23:44" or similar
    const parts = ts.split(' ');
    if (parts.length < 2) return ts;
    const [h, m] = parts[1].split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  } catch {
    return ts;
  }
}

/**
 * Compute attendance summary for each employee given the biometric logs for a date.
 * 
 * @param {Array} employees - List of employee objects from Firestore
 * @param {Array} logs - Biometric logs for the day
 * @returns {Array} - Each employee with added: status, punchIn, punchOut, minutesLate
 */
export function computeAttendance(employees, logs) {
  // Group logs by empCode (primary) or empName (fallback)
  const byEmpCode = {};
  const byEmpName = {};

  for (const log of logs) {
    // Clean code: trim and remove leading zeros for robust matching
    let code = log.empCode ? String(log.empCode).trim().replace(/^0+/, '') : '';
    const name = (log.empName || '').trim().toUpperCase();

    if (code && code !== 'N/A') {
      if (!byEmpCode[code]) byEmpCode[code] = [];
      byEmpCode[code].push(log);
    }
    if (name) {
      if (!byEmpName[name]) byEmpName[name] = [];
      byEmpName[name].push(log);
    }
  }

  return employees.map(emp => {
    // Match by rfidNo (which equals the empCode stored in biometric logs)
    let empLogs = [];

    if (emp.rfidNo) {
      const cleanRfid = String(emp.rfidNo).trim().replace(/^0+/, '');
      empLogs = byEmpCode[cleanRfid] || [];
    }

    // Fallback: match by name
    if (empLogs.length === 0 && emp.fullName) {
      const empNameUpper = emp.fullName.trim().toUpperCase();
      empLogs = byEmpName[empNameUpper] || [];

      if (empLogs.length === 0) {
        const empWords = empNameUpper.split(/\s+/);
        for (const [bioName, bioLogs] of Object.entries(byEmpName)) {
          const bioWords = bioName.split(/\s+/);
          const hasMatch = empWords.some(w => w.length > 3 && bioWords.includes(w));
          if (hasMatch) { empLogs = bioLogs; break; }
        }
      }
    }

    if (empLogs.length === 0) {
      return { ...emp, status: 'ABSENT', punchIn: null, punchOut: null, minutesLate: 0, minutesEarly: 0 };
    }

    // Sort by timestamp ascending
    const sorted = [...empLogs].sort((a, b) =>
      String(a.timestamp).localeCompare(String(b.timestamp))
    );

    const punchIn = sorted[0].timestamp;
    const punchOut = sorted.length > 1 ? sorted[sorted.length - 1].timestamp : null;

    // Check if late or early leave
    let status = 'PRESENT';
    let minutesLate = 0;
    let minutesEarly = 0;

    if (emp.shiftStartTime) {
      const shiftMinutes = toMinutes(emp.shiftStartTime);
      const punchTimePart = punchIn.split(' ')[1] || '';
      const punchMinutes = toMinutes(punchTimePart);

      if (shiftMinutes !== null && punchMinutes !== null && punchMinutes > shiftMinutes) {
        minutesLate = punchMinutes - shiftMinutes;
      }
    }

    if (emp.shiftEndTime) {
      const shiftEndMins = toMinutes(emp.shiftEndTime);
      let outTimePart = null;
      if (punchOut) {
        outTimePart = punchOut.split(' ')[1] || '';
      } else {
        // If they only have one punch, and it's early in the day, do we mark as early leave?
        // Let's assume their first punch is also their only punch
        outTimePart = punchIn.split(' ')[1] || '';
      }
      
      if (outTimePart) {
        const outMinutes = toMinutes(outTimePart);
        if (shiftEndMins !== null && outMinutes !== null && outMinutes < shiftEndMins) {
           // Only mark early leave if they left more than 5 minutes early
           if ((shiftEndMins - outMinutes) > 5) {
               minutesEarly = shiftEndMins - outMinutes;
           }
        }
      }
    }

    if (minutesLate > 0 && minutesEarly > 0) {
      status = 'LATE & EARLY LEAVE';
    } else if (minutesLate > 0) {
      status = 'LATE';
    } else if (minutesEarly > 0) {
      status = 'EARLY LEAVE';
    }

    return { ...emp, status, punchIn, punchOut, minutesLate, minutesEarly };
  });
}

/**
 * Compute monthly attendance summary.
 * Groups logs by day and employee, computing aggregate totals.
 */
export function computeMonthlyAttendance(employees, logs) {
  // 1. Group logs by day (YYYY-MM-DD)
  const logsByDay = {};
  for (const log of logs) {
    if (!log.timestamp) continue;
    const day = String(log.timestamp).split(' ')[0];
    if (!logsByDay[day]) logsByDay[day] = [];
    logsByDay[day].push(log);
  }

  // 2. Initialize employee aggregates
  const agg = {};
  for (const emp of employees) {
    agg[emp.id] = {
      ...emp,
      totalPresent: 0,
      totalAbsent: 0,
      totalLate: 0,
      totalEarly: 0,
      workingDays: 0,
      dailyPunches: {}
    };
  }

  // 3. For each day, compute attendance and update aggregates
  for (const [day, dayLogs] of Object.entries(logsByDay)) {
    const dailyResult = computeAttendance(employees, dayLogs);
    for (const res of dailyResult) {
      agg[res.id].workingDays += 1;
      
      // If they had any punch, they are present for the day
      if (res.status !== 'ABSENT') {
        agg[res.id].totalPresent += 1;
      } else {
        agg[res.id].totalAbsent += 1;
      }

      if (res.minutesLate > 0) agg[res.id].totalLate += 1;
      if (res.minutesEarly > 0) agg[res.id].totalEarly += 1;

      if (res.punchIn) {
        agg[res.id].dailyPunches[day] = String(res.punchIn).split(' ')[1].substring(0, 5);
      }
    }
  }

  return Object.values(agg);
}

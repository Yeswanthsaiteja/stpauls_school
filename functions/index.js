const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const fcm = admin.messaging();

setGlobalOptions({ maxInstances: 10, region: "us-central1" });

/**
 * Helper to write a notification to Firestore and send an FCM push notification.
 * @param {string} tenantId 
 * @param {string} userId - Target user ID (or 'admin')
 * @param {string} title 
 * @param {string} body 
 * @param {string} type 
 * @param {object} data - Optional payload data
 */
async function notifyUser(tenantId, userId, title, body, type, data = {}) {
  try {
    // 1. Create In-App Notification
    await db.collection("notifications").add({
      tenantId,
      userId,
      title,
      body,
      type,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...data,
    });

    // 2. Fetch User to get FCM Tokens (if userId is not 'admin')
    let fcmTokens = [];
    if (userId === "admin") {
      // Find admin users (assuming users with role ADMIN or we store admin tokens somewhere)
      // Since it's hard to know all admin UIDs, we might broadcast to a topic 'admin_tenantId'
      // But for now, let's fetch any users where role == 'ADMIN'
      const adminSnap = await db.collection("users")
        .where("tenantId", "==", tenantId)
        .where("role", "==", "ADMIN")
        .get();
      adminSnap.forEach(doc => {
        const tokens = doc.data().fcmTokens;
        if (Array.isArray(tokens)) fcmTokens.push(...tokens);
      });
    } else {
      // It's a specific user (staff or parent)
      // Check students (parents)
      let userDoc = await db.collection("students").doc(userId).get();
      if (!userDoc.exists) {
        // Maybe employee
        userDoc = await db.collection("employees").doc(userId).get();
      }
      
      if (userDoc.exists) {
        const tokens = userDoc.data().fcmTokens;
        if (Array.isArray(tokens)) fcmTokens = tokens;
      }
    }

    // 3. Send Push Notification
    if (fcmTokens.length > 0) {
      const message = {
        notification: { title, body },
        data: { type, ...data },
        tokens: [...new Set(fcmTokens)], // deduplicate
      };
      await fcm.sendEachForMulticast(message);
    }
  } catch (error) {
    console.error("Error in notifyUser:", error);
  }
}

// ─── 1. Announcements ────────────────────────────────────────────────────────
exports.onAnnouncementCreated = onDocumentCreated("announcements/{docId}", async (event) => {
  const data = event.data.data();
  if (!data) return;

  const tenantId = data.tenantId || "stpauls";
  const targetRole = data.targetRole || "ALL"; // ALL, PARENT, STAFF
  const targetClass = data.targetClass;

  let userIds = [];

  // Notify Parents
  if (targetRole === "ALL" || targetRole === "PARENT") {
    let query = db.collection("students").where("tenantId", "==", tenantId);
    if (targetClass) query = query.where("className", "==", targetClass);
    if (data.targetSection) query = query.where("section", "==", data.targetSection);
    
    const snap = await query.get();
    snap.forEach(doc => userIds.push(doc.id));
  }

  // Notify Staff
  if (targetRole === "ALL" || targetRole === "STAFF") {
    const snap = await db.collection("employees").where("tenantId", "==", tenantId).get();
    snap.forEach(doc => userIds.push(doc.id));
  }

  // Send notifications
  const promises = userIds.map(uid => 
    notifyUser(tenantId, uid, "New Announcement: " + data.title, data.description, "announcement")
  );
  await Promise.all(promises);
});

// ─── 2. Results Released ─────────────────────────────────────────────────────
exports.onResultCreated = onDocumentCreated("results/{docId}", async (event) => {
  const data = event.data.data();
  if (!data || !data.studentId) return;

  await notifyUser(
    data.tenantId || "stpauls",
    data.studentId,
    "New Result Published",
    `Your result for ${data.subject || data.examType} has been published. Grade: ${data.grade}`,
    "result"
  );
});

// ─── 3. CRM Tickets ──────────────────────────────────────────────────────────
exports.onTicketCreated = onDocumentCreated("communication_tickets/{docId}", async (event) => {
  const data = event.data.data();
  if (!data) return;

  await notifyUser(
    data.tenantId || "stpauls",
    "admin",
    `New Support Ticket: ${data.ticketNo}`,
    `${data.parentName || "A parent"} raised a ticket about ${data.category}. Priority: ${data.priority}`,
    "crm_ticket_created",
    { ticketId: event.params.docId }
  );
});

exports.onTicketUpdated = onDocumentUpdated("communication_tickets/{docId}", async (event) => {
  const after = event.data.after.data();
  const before = event.data.before.data();
  if (!after || !before) return;

  // If status changed or resolution added
  if (after.status !== before.status || (!before.resolution && after.resolution)) {
    // Notify the parent
    if (after.studentId) {
      await notifyUser(
        after.tenantId || "stpauls",
        after.studentId,
        `Ticket Updated: ${after.ticketNo}`,
        `Status changed to ${after.status}. ${after.resolution ? "Resolution: " + after.resolution : ""}`,
        "crm_ticket_updated",
        { ticketId: event.params.docId }
      );
    }
  }
});

// ─── 4. Attendance ───────────────────────────────────────────────────────────
exports.onAttendanceUpdated = onDocumentUpdated("attendance/{docId}", async (event) => {
  const after = event.data.after.data();
  const before = event.data.before.data();
  if (!after || !before) return;

  const tenantId = after.tenantId || "stpauls";
  const date = after.date;
  const newRecords = after.records || {};
  const oldRecords = before.records || {};

  // Find newly marked absent students
  const newlyAbsentIds = Object.keys(newRecords).filter(studentId => {
    return newRecords[studentId] === "ABSENT" && oldRecords[studentId] !== "ABSENT";
  });

  const promises = newlyAbsentIds.map(async (studentId) => {
    // Notify Parent
    await notifyUser(
      tenantId,
      studentId,
      "Attendance Alert",
      `Your child is marked ABSENT today (${date}).`,
      "attendance_absent"
    );

    // Get student details to notify Admin & Staff
    const studentDoc = await db.collection("students").doc(studentId).get();
    const studentName = studentDoc.exists ? studentDoc.data().fullName : "A student";

    // Notify Admin
    await notifyUser(
      tenantId,
      "admin",
      "Absentee Alert",
      `${studentName} (Class ${after.className}) is marked ABSENT today.`,
      "attendance_absent_admin"
    );

    // Notify Staff (Find teachers assigned to this class)
    const staffSnap = await db.collection("employees")
      .where("tenantId", "==", tenantId)
      .where("role", "==", "TEACHER")
      .get();
    
    for (const doc of staffSnap.docs) {
      const emp = doc.data();
      if ((emp.classes || "").includes(after.className) || emp.classTeacherOf === after.className) {
        await notifyUser(
          tenantId,
          doc.id,
          "Absentee Alert",
          `${studentName} is marked ABSENT today.`,
          "attendance_absent_staff"
        );
      }
    }
  });

  await Promise.all(promises);
});

// ─── 5. Fee Due Date Checker (Cron) ──────────────────────────────────────────
exports.checkFeeDueDates = onSchedule("0 9 * * *", async (event) => {
  // Runs every day at 9:00 AM UTC
  const tenantId = "stpauls";
  const todayStr = new Date().toISOString().slice(0, 10);
  
  // Get all fee categories with installments
  const catsSnap = await db.collection("fee_categories").where("tenantId", "==", tenantId).get();
  
  for (const catDoc of catsSnap.docs) {
    const cat = catDoc.data();
    const terms = cat.terms || [];
    
    // Find terms that are exactly due today, or overdue by 1 week, etc.
    // For simplicity, let's notify if due date is exactly today or yesterday
    const targetTerms = terms.filter(t => t.dueDate === todayStr);
    
    if (targetTerms.length === 0) continue;

    for (const term of targetTerms) {
      // Find all active students in classes applicable for this fee
      const activeStudentsSnap = await db.collection("students").where("tenantId", "==", tenantId).where("status", "==", "ACTIVE").get();
      
      for (const studentDoc of activeStudentsSnap.docs) {
        const student = studentDoc.data();
        const studentClass = student.className || "";
        const expectedFee = Number(term.amounts?.[studentClass] || term.amounts?.["default"] || 0);
        if (expectedFee <= 0) continue;

        // Check if paid (query transactions)
        const txSnap = await db.collection("transactions")
          .where("studentId", "==", studentDoc.id)
          .where("status", "==", "PAID")
          .get();
        
        let paidAmt = 0;
        txSnap.forEach(tx => {
          const txd = tx.data();
          if (txd.termAllocations) {
            txd.termAllocations.forEach(a => {
              if (a.categoryId === catDoc.id && a.termId === term.id) paidAmt += Number(a.amount || 0);
            });
          } else if (txd.categoryId === catDoc.id) {
            paidAmt += Number(txd.amount || 0);
          }
        });

        // Check concession
        const concSnap = await db.collection("fee_concessions_v2")
          .where("studentId", "==", studentDoc.id)
          .where("categoryId", "==", catDoc.id)
          .where("termId", "==", term.id)
          .get();
        
        let concAmt = 0;
        if (!concSnap.empty) {
          concAmt = Number(concSnap.docs[0].data().amount || 0);
        }

        const dueAmt = expectedFee - concAmt - paidAmt;

        if (dueAmt > 0) {
          await notifyUser(
            tenantId,
            studentDoc.id,
            "Fee Reminder",
            `A fee of ₹${dueAmt} for ${cat.name} (${term.name}) is due today.`,
            "fee_due"
          );
        }
      }
    }
  }
});

// ─── 6. PIN Authentication ───────────────────────────────────────────────────

exports.checkPinExists = onCall({ invoker: "public" }, async (request) => {
  const phone = request.data.phone;
  if (!phone) return { hasPin: false };
  
  const digits10 = phone.replace(/\D/g, "").slice(-10);
  
  const snap = await db.collection("users").where("phone10", "==", digits10).limit(1).get();
  if (!snap.empty && snap.docs[0].data().pin) {
    return { hasPin: true };
  }
  
  return { hasPin: false, digits10 };
});

exports.verifyPinAndLogin = onCall({ invoker: "public" }, async (request) => {
  const { phone, pin } = request.data;
  if (!phone || !pin || pin.length !== 4) {
    throw new HttpsError("invalid-argument", "Missing phone or pin");
  }

  const digits10 = phone.replace(/\D/g, "").slice(-10);
  const hashedPin = Buffer.from(pin + "SP").toString("base64");

  const usersSnap = await db.collection("users").where("phone10", "==", digits10).where("pin", "==", hashedPin).limit(1).get();
  let matchedUid = null;

  if (!usersSnap.empty) {
    matchedUid = usersSnap.docs[0].id;
  }

  if (!matchedUid) {
    throw new HttpsError("permission-denied", "Incorrect PIN or phone number.");
  }

  try {
    const customToken = await admin.auth().createCustomToken(matchedUid);
    return { token: customToken };
  } catch (error) {
    console.error("Error creating custom token:", error);
    throw new HttpsError("internal", "Failed to create authentication token.", error);
  }
});

// ─── 7. ADMS Biometric Machine Listener ───────────────────────────────────────

const { onRequest } = require("firebase-functions/v2/https");
const express = require('express');
const cors = require('cors');

const iclockApp = express();
iclockApp.use(cors({ origin: true }));
iclockApp.use(express.text({ type: '*/*' }));
iclockApp.use(express.urlencoded({ extended: true }));

// Handle machine initialization / registry heartbeat
iclockApp.use(async (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  console.log("ADMS Request:", req.method, req.path, req.query, req.body);
  try {
    const path = req.path;
    
    if (path.includes('getrequest')) {
      return res.send('OK');
    }
    
    if (path.includes('registry')) {
      return res.send('OK');
    }
    
    if (path.includes('cdata')) {
      const rawData = req.body;
      if (!rawData || typeof rawData !== 'string') {
        return res.send('OK: 1');
      }
      
      const lines = rawData.split('\n');
      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        // Typical format: ID YYYY-MM-DD HH:MM:SS State
        // e.g. "1 2023-10-01 08:30:00 1"
        const parts = line.split(/\s+/);
        if (parts.length >= 3) {
          const empId = parts[0];
          const dateStr = parts[1]; // YYYY-MM-DD
          const timeStr = parts[2]; // HH:MM:SS
          
          await db.collection("biometric_logs").add({
            tenantId: "stpauls",
            machineEmpId: empId,
            date: dateStr,
            time: timeStr,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            rawLine: line,
            processed: false
          });
        }
      }
      return res.send('OK: ' + lines.length);
    }
    
    res.send('OK');
  } catch (error) {
    console.error("ADMS Parse Error:", error);
    res.send('OK');
  }
});

exports.iclock = onRequest(iclockApp);

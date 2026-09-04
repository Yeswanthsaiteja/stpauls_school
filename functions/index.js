const functions = require("firebase-admin/functions");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

if (!admin.apps.length) {
    admin.initializeApp();
}

// Helper to hash PIN
function hashPin(pin) {
    return crypto.createHash("sha256").update(pin).digest("hex");
}

// ==========================================
// PIN AUTHENTICATION ENDPOINTS
// ==========================================

exports.checkPinExists = onCall(async (request) => {
    const { phone } = request.data;
    if (!phone) throw new HttpsError("invalid-argument", "Phone number is required");

    const db = admin.firestore();
    const doc = await db.collection("auth_pins").doc(phone).get();
    
    return { hasPin: doc.exists };
});

exports.validatePhoneRole = onCall(async (request) => {
    const { phone, role } = request.data;
    if (!phone || !role) throw new HttpsError("invalid-argument", "Phone and role are required");

    const db = admin.firestore();
    const digits10 = phone.replace(/\D/g, '').slice(-10);
    const TENANT_ID = 'stpauls';

    if (role === 'admin') {
        const ADMIN_PHONES = ['8897245345', '7330706174', '8978186701'];
        return { valid: ADMIN_PHONES.includes(digits10) };
    }

    if (role === 'staff') {
        const snap = await db.collection('employees').get();
        const isValid = snap.docs.some(d => {
            const data = d.data();
            if (data.tenantId && data.tenantId !== TENANT_ID) return false;
            const stored = (data.phoneNumber || data.phone || '').replace(/\D/g, '').slice(-10);
            return stored === digits10;
        });
        return { valid: isValid };
    }

    if (role === 'parent') {
        const snap = await db.collection('students').get();
        const isValid = snap.docs.some(d => {
            const data = d.data();
            if (data.tenantId && data.tenantId !== TENANT_ID) return false;
            if (data.status === 'REMOVED') return false;
            for (const field of ['fatherPhone', 'motherPhone', 'guardianPhone', 'phoneNumber']) {
                const stored = (data[field] || '').replace(/\D/g, '').slice(-10);
                if (stored === digits10) return true;
            }
            return false;
        });
        return { valid: isValid };
    }

    return { valid: false };
});

exports.registerFirstTimePin = onCall(async (request) => {
    const { phone, pin, role } = request.data;
    if (!phone || !pin) throw new HttpsError("invalid-argument", "Phone and PIN are required");

    const db = admin.firestore();
    const pinRef = db.collection("auth_pins").doc(phone);
    
    const doc = await pinRef.get();
    if (doc.exists) {
        throw new HttpsError("already-exists", "PIN is already registered for this phone number");
    }

    // Save hashed PIN
    await pinRef.set({
        hashedPin: hashPin(pin),
        role: role || "parent",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create Firebase Auth user if it doesn't exist
    let uid;
    try {
        const userRecord = await admin.auth().getUserByPhoneNumber(`+91${phone}`);
        uid = userRecord.uid;
    } catch (e) {
        if (e.code === "auth/user-not-found") {
            const userRecord = await admin.auth().createUser({
                phoneNumber: `+91${phone}`
            });
            uid = userRecord.uid;
        } else {
            throw new HttpsError("internal", "Error fetching/creating user");
        }
    }

    // Generate Custom Token
    const customToken = await admin.auth().createCustomToken(uid);
    return { token: customToken };
});

exports.loginWithPin = onCall(async (request) => {
    const { phone, pin } = request.data;
    if (!phone || !pin) throw new HttpsError("invalid-argument", "Phone and PIN are required");

    const db = admin.firestore();
    const doc = await db.collection("auth_pins").doc(phone).get();
    
    if (!doc.exists) {
        throw new HttpsError("not-found", "No PIN registered for this phone number");
    }

    const { hashedPin } = doc.data();
    if (hashPin(pin) !== hashedPin) {
        throw new HttpsError("unauthenticated", "Incorrect PIN");
    }

    // Get or Create Firebase Auth user
    let uid;
    try {
        const userRecord = await admin.auth().getUserByPhoneNumber(`+91${phone}`);
        uid = userRecord.uid;
    } catch (e) {
        if (e.code === 'auth/user-not-found') {
            const newUser = await admin.auth().createUser({
                phoneNumber: `+91${phone}`
            });
            uid = newUser.uid;
        } else {
            throw new HttpsError("internal", "Error fetching Firebase Auth user");
        }
    }

    // Generate Custom Token
    const customToken = await admin.auth().createCustomToken(uid);
    return { token: customToken };
});

exports.setNewPin = onCall(async (request) => {
    const { currentPin, pin } = request.data;
    const uid = request.auth?.uid;
    if (!uid || !pin || !currentPin) throw new HttpsError("invalid-argument", "Missing parameters");

    // Fetch user to get their phone number
    const userRecord = await admin.auth().getUser(uid);
    let phone = userRecord.phoneNumber;
    if (phone.startsWith("+91")) {
        phone = phone.substring(3);
    } else {
        throw new HttpsError("invalid-argument", "Invalid phone number format");
    }

    const db = admin.firestore();
    
    // Verify current PIN
    const doc = await db.collection("auth_pins").doc(phone).get();
    if (!doc.exists) {
        throw new HttpsError("not-found", "No PIN registered");
    }
    if (doc.data().hashedPin !== hashPin(currentPin)) {
        throw new HttpsError("unauthenticated", "Current PIN is incorrect");
    }

    // Set new PIN
    const batch = db.batch();
    batch.set(db.collection("auth_pins").doc(phone), {
        hashedPin: hashPin(pin),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Backwards compatibility for frontend local session checks
    batch.set(db.collection("users").doc(uid), {
        pin: Buffer.from(pin + 'SP').toString('base64')
    }, { merge: true });

    await batch.commit();

    return { success: true };
});

exports.requestPinReset = onCall(async (request) => {
    const { phone, role } = request.data;
    if (!phone || !role) throw new HttpsError("invalid-argument", "Phone and role are required");

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const db = admin.firestore();

    const existing = await db.collection("pin_reset_requests")
        .where("phone", "==", cleanPhone)
        .where("role", "==", role)
        .where("status", "==", "PENDING")
        .get();

    if (!existing.empty) {
        return { success: true, message: "Request already pending" };
    }

    await db.collection("pin_reset_requests").add({
        phone: cleanPhone,
        role,
        status: 'PENDING',
        requestedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
});

exports.adminResetPin = onCall(async (request) => {
    const { phone, requestId } = request.data;
    const uid = request.auth?.uid;
    if (!uid || !phone || !requestId) throw new HttpsError("invalid-argument", "Missing parameters");

    // Verify caller is admin
    const callerUser = await admin.auth().getUser(uid);
    const callerPhone = (callerUser.phoneNumber || '').replace(/\D/g, '').slice(-10);
    const ADMIN_PHONES = ['8897245345', '7330706174', '8978186701'];
    
    if (!ADMIN_PHONES.includes(callerPhone)) {
        throw new HttpsError("permission-denied", "Only admins can perform this action");
    }

    const db = admin.firestore();
    const batch = db.batch();

    // Reset PIN to 1234
    const pinRef = db.collection("auth_pins").doc(phone);
    batch.set(pinRef, {
        hashedPin: hashPin("1234"),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Sync backwards compatibility for frontend local session checks
    try {
        const targetUserRecord = await admin.auth().getUserByPhoneNumber(`+91${phone}`);
        if (targetUserRecord && targetUserRecord.uid) {
            batch.set(db.collection("users").doc(targetUserRecord.uid), {
                pin: Buffer.from('1234SP').toString('base64')
            }, { merge: true });
        }
    } catch (e) {
        console.warn("User not found in Auth when resetting PIN for phone:", phone);
    }

    // Mark request as resolved
    const requestRef = db.collection("pin_reset_requests").doc(requestId);
    batch.update(requestRef, {
        status: 'RESOLVED',
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        resolvedBy: callerPhone
    });

    await batch.commit();

    return { success: true };
});

// ==========================================
// SMART OFFICE SYNC ENDPOINT
// ==========================================
exports.syncSmartOffice = onRequest({ cors: true }, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }

    try {
        const payload = req.body;
        if (!payload || !payload.logs || !Array.isArray(payload.logs)) {
            res.status(400).send("Invalid payload structure");
            return;
        }

        const db = admin.firestore();
        let batch = db.batch();
        let count = 0;
        let totalSynced = 0;

        for (const log of payload.logs) {
            const cleanTime = log.punchTime.replace(/[:.\s]/g, "-");
            const cleanName = log.empName.replace(/\s+/g, "_");
            const docId = `sm_${cleanName}_${cleanTime}`;

            const docRef = db.collection("biometric_logs").doc(docId);
            batch.set(docRef, {
                empName: log.empName,
                empCode: log.empCode || "N/A",
                timestamp: log.punchTime,
                source: "SmartOffice_Sync",
                syncedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            count++;
            totalSynced++;

            if (count === 450) {
                await batch.commit();
                batch = db.batch();
                count = 0;
            }
        }

        if (count > 0) {
            await batch.commit();
        }

        res.status(200).send({ success: true, synced: totalSynced });
    } catch (error) {
        console.error("Error syncing smart office data:", error);
        res.status(500).send({ detail: "Failed to sync data", error: error.message });
    }
});

const https = require('https');

exports.proxyImage = onRequest({ cors: true }, (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send("Missing url parameter");
    
    https.get(imageUrl, (response) => {
        if (response.statusCode !== 200) {
            return res.status(response.statusCode).send("Error fetching image");
        }
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET');
        res.set('Content-Type', response.headers['content-type']);
        response.pipe(res);
    }).on('error', (err) => {
        res.status(500).send(err.message);
    });
});

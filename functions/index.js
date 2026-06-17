const functions = require("firebase-admin/functions");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

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
                empCode: log.empCode || "N/A", // <-- Added Employee Code here!
                timestamp: log.punchTime,
                source: "SmartOffice_Sync",
                syncedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            count++;
            totalSynced++;

            // Firestore batch limit is 500
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

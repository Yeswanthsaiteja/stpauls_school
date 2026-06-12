const admin = require("firebase-admin");
admin.initializeApp({ projectId: "stpauls-erp" });
const db = admin.firestore();

async function run() {
  const snap = await db.collection("users").get();
  snap.docs.forEach(d => {
    const data = d.data();
    if ((data.phone || "").includes("9949156948")) {
      console.log("Found:", d.id, data);
    }
  });
}
run().catch(console.error);

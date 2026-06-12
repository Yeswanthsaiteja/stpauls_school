const admin = require("firebase-admin");
admin.initializeApp({ projectId: "stpauls-erp" });
const db = admin.firestore();

async function test() {
  const snap = await db.collection("users").get();
  console.log("Total users:", snap.docs.length);
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(d.id, "Phone:", data.phone, "PIN:", data.pin);
  });
}
test().catch(console.error);

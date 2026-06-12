const admin = require("firebase-admin");
admin.initializeApp({ projectId: "stpauls-erp" });
const db = admin.firestore();

async function run() {
  const snap = await db.collection("users").get();
  for (let doc of snap.docs) {
    const data = doc.data();
    if ((data.phone || "").includes("9949156948")) {
      console.log("ID:", doc.id);
      console.log("Phone:", data.phone);
      console.log("Stored PIN:", data.pin);
      
      const testPin = "1234";
      const hashedPin = Buffer.from(testPin + "SP").toString("base64");
      console.log("If test pin was 1234, backend hash is:", hashedPin);
      
      // try to base64 decode stored pin
      if (data.pin) {
        const decoded = Buffer.from(data.pin, "base64").toString("utf-8");
        console.log("Decoded stored pin:", decoded);
      }
    }
  }
}
run().catch(console.error);

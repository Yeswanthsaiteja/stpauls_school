const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp({ projectId: "stpauls-erp" });
const db = admin.firestore();

function hashPin(pin) {
    return crypto.createHash("sha256").update(String(pin)).digest("hex");
}

async function check() {
  console.log("Checking pins...");
  const phone = "8897245345";
  const doc = await db.collection("auth_pins").doc(phone).get();
  if (doc.exists) {
    console.log("Admin 8897245345:", doc.data());
    console.log("Hash of 1234:", hashPin("1234"));
  } else {
    console.log("No doc for 8897245345");
  }
  
  const all = await db.collection("auth_pins").limit(5).get();
  all.forEach(d => console.log(d.id, d.data()));
}

check().catch(console.error);

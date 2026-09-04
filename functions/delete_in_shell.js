const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
const phone = "8897245345";
const clean = async () => {
  try {
    const s1 = await db.collection("students").where("fatherPhone", "==", phone).get();
    s1.docs.forEach(d => { d.ref.delete(); console.log("Deleted student father"); });
    const s2 = await db.collection("students").where("motherPhone", "==", phone).get();
    s2.docs.forEach(d => { d.ref.delete(); console.log("Deleted student mother"); });
    const e1 = await db.collection("employees").where("phone", "==", phone).get();
    e1.docs.forEach(d => { d.ref.delete(); console.log("Deleted employee"); });
    const u1 = await db.collection("users").where("phone", "==", phone).get();
    u1.docs.forEach(d => { d.ref.delete(); console.log("Deleted user"); });
    console.log("DELETED DOCUMENTS");
    const u = await admin.auth().getUserByPhoneNumber("+918897245345");
    await admin.auth().deleteUser(u.uid);
    console.log("DELETED AUTH USER");
  } catch(e) { console.log(e); }
};
clean();

const admin = require("firebase-admin");
admin.initializeApp({ projectId: "stpauls-erp" });
const db = admin.firestore();

async function deleteDemoUser() {
  const phone = "8897245345";
  console.log(`Searching for data with phone ${phone}...`);

  try {
    // 1. Delete from Students
    const studentSnap1 = await db.collection("students").where("fatherPhone", "==", phone).get();
    const studentSnap2 = await db.collection("students").where("motherPhone", "==", phone).get();
    
    for (const doc of studentSnap1.docs) {
      console.log(`Deleting student (fatherPhone match): ${doc.id}`);
      await doc.ref.delete();
    }
    for (const doc of studentSnap2.docs) {
      console.log(`Deleting student (motherPhone match): ${doc.id}`);
      await doc.ref.delete();
    }

    // 2. Delete from Employees
    const empSnap = await db.collection("employees").where("phone", "==", phone).get();
    for (const doc of empSnap.docs) {
      console.log(`Deleting employee: ${doc.id}`);
      await doc.ref.delete();
    }

    // 3. Delete from Users
    const userSnap = await db.collection("users").where("phone", "==", phone).get();
    for (const doc of userSnap.docs) {
      console.log(`Deleting user: ${doc.id}`);
      await doc.ref.delete();
    }

    // 4. Delete from Auth (if exists)
    // In Firebase Auth, phone numbers usually have country code like +918897245345
    // Let's try to get user by phone number
    const authPhone = "+91" + phone;
    try {
      const userRecord = await admin.auth().getUserByPhoneNumber(authPhone);
      console.log(`Deleting from Auth: ${userRecord.uid}`);
      await admin.auth().deleteUser(userRecord.uid);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        console.log(`No Auth user found with ${authPhone}`);
      } else {
        console.error(`Error deleting from Auth:`, e);
      }
    }

    console.log("Cleanup complete!");
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}

deleteDemoUser();

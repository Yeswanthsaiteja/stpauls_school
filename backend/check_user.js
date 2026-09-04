const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkUser() {
  const phone = '9505161432';
  
  console.log(`Checking students for parent phone: ${phone}`);
  const studentsSnapshot = await db.collection('students').get();
  let foundParents = [];
  
  studentsSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.phoneNumber === phone || data.parentPhone === phone || data.fatherPhone === phone || data.motherPhone === phone) {
      foundParents.push({ id: doc.id, name: data.fullName || data.name, phone: data.phoneNumber, parentPhone: data.parentPhone, password: data.password, pin: data.pin });
    }
  });
  
  console.log("Found in students:", foundParents);
  
  const usersRef = db.collection('users');
  const userQuery = await usersRef.where('phoneNumber', '==', phone).get();
  
  if (userQuery.empty) {
    console.log("No user found in 'users' collection with this phone.");
  } else {
    userQuery.forEach(doc => {
      console.log("Found in 'users':", doc.id, doc.data());
    });
  }
}

checkUser().catch(console.error);

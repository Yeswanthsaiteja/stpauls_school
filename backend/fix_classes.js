const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixClasses() {
  const snapshot = await db.collection('classes').get();
  const classMap = new Map();
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const name = data.name.trim().toLowerCase();
    
    if (!classMap.has(name)) {
      classMap.set(name, [{ id: doc.id, ...data }]);
    } else {
      classMap.get(name).push({ id: doc.id, ...data });
    }
  });

  for (const [name, docs] of classMap.entries()) {
    if (docs.length > 1) {
      console.log(`Found ${docs.length} duplicates for class ${name}`);
      
      // Merge sections
      const allSections = new Set();
      docs.forEach(d => {
        (d.sections || []).forEach(s => allSections.add(s));
      });
      
      const primary = docs[0];
      const mergedSections = Array.from(allSections).sort();
      
      console.log(`Updating primary ${primary.id} with sections ${mergedSections}`);
      await db.collection('classes').doc(primary.id).update({
        sections: mergedSections
      });
      
      // Delete duplicates
      for (let i = 1; i < docs.length; i++) {
        console.log(`Deleting duplicate ${docs[i].id}`);
        await db.collection('classes').doc(docs[i].id).delete();
      }
    }
  }
  console.log('Done');
}

fixClasses().catch(console.error);

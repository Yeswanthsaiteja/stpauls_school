from google.cloud import firestore

db = firestore.Client(project='stpauls-erp')
docs = db.collection('biometric_logs').order_by('timestamp', direction=firestore.Query.DESCENDING).limit(10).stream()

print("Recent logs:")
found = False
for doc in docs:
    found = True
    print(f"{doc.id} => {doc.to_dict()}")
if not found:
    print("No logs found in biometric_logs collection.")

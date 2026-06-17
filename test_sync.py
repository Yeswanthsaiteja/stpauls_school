from fastapi.testclient import TestClient
from server import app

client = TestClient(app)
payload = {
    "logs": [
        {"empName": "John Doe", "punchTime": "2026-06-13 10:00:00.000"}
    ]
}
response = client.post("/api/attendance/smart-office-sync", json=payload)
print("Status:", response.status_code)
print("Response:", response.text)

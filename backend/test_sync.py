import asyncio
import os
import sys

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from server import app

try:
    client = TestClient(app)
    payload = {
        "logs": [
            {"empName": "John Doe", "punchTime": "2026-06-13 10:00:00.000"}
        ]
    }
    response = client.post("/api/attendance/smart-office-sync", json=payload)
    print("Status:", response.status_code)
    print("Response:", response.text)
except Exception as e:
    import traceback
    traceback.print_exc()

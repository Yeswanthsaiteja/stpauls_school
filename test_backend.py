import requests
import json

backendUrl = "https://stpaulsschool-production.up.railway.app"
print(f"Testing backend: {backendUrl}")

try:
    # Attempt to hit the create-payment-link with dummy data but without auth.
    # It should return 401 Unauthorized if it's reachable and running FastAPI.
    res = requests.post(f"{backendUrl}/api/payments/create-payment-link", json={
        "amount": 100,
        "currency": "INR",
        "studentId": "123",
        "studentName": "Test",
        "feeName": "Test Fee",
        "phone": "",
        "description": "Test"
    })
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text}")
except Exception as e:
    print(f"Error: {e}")

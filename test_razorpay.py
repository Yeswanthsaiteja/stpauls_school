import requests

url = "https://stpaulsschool-production.up.railway.app/api/payments/create-payment-link"
payload = {
    "amount": 100,
    "currency": "INR",
    "studentId": "test",
    "studentName": "test",
    "feeName": "test",
    "phone": "9999999999",
    "description": "test"
}
# We need auth token. Wait, I can't easily get auth token.

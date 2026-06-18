import os
from dotenv import load_dotenv
import razorpay
import json

load_dotenv()
key_id = os.environ.get("RAZORPAY_KEY_ID")
key_secret = os.environ.get("RAZORPAY_KEY_SECRET")
client = razorpay.Client(auth=(key_id, key_secret))

link_data = {
    "amount": 100,
    "currency": "INR",
    "description": "Test UPI Config Realistic Phone",
    "customer": {
        "name": "Test User",
        "contact": "9876543210"
    },
    "notify": {"sms": False, "email": False}
}

try:
    link = client.payment_link.create(link_data)
    print("SUCCESS 9876543210!")
    print(link.get("short_url"))
except Exception as e:
    print("FAILED 9876543210:", str(e))

link_data["customer"]["contact"] = "9988776655"
try:
    link = client.payment_link.create(link_data)
    print("SUCCESS 9988776655!")
    print(link.get("short_url"))
except Exception as e:
    print("FAILED 9988776655:", str(e))

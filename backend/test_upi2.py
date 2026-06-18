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
    "description": "Test UPI Link True",
    "upi_link": True,
    "customer": {
        "name": "Test User",
        "contact": "9988776655"
    },
    "notify": {"sms": False, "email": False}
}

try:
    link = client.payment_link.create(link_data)
    print("SUCCESS!")
    print("short_url:", link.get("short_url"))
    print("upi_link:", link.get("upi_link"))
except Exception as e:
    print("FAILED:", str(e))

"""routers/payments.py — Razorpay order creation & webhook verification"""
import os, hmac, hashlib, logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from middleware.firebase_auth import require_auth

router = APIRouter()
logger = logging.getLogger(__name__)


class CreateOrderRequest(BaseModel):
    amount: int          # in paise (₹1 = 100 paise)
    currency: str = "INR"
    receipt: str         # receiptNo from Firestore transaction
    studentId: str
    studentName: str
    feeName: str
    notes: Optional[dict] = {}


class CreatePaymentLinkRequest(BaseModel):
    amount: int          # in paise
    currency: str = "INR"
    studentId: str
    studentName: str
    feeName: str
    phone: Optional[str] = ""
    description: Optional[str] = ""


class CreatePaymentLinkResponse(BaseModel):
    paymentLinkId: str
    shortUrl: str
    amount: int


class CreateOrderResponse(BaseModel):
    orderId: str
    amount: int
    currency: str
    keyId: str


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    firestoreTransactionId: str  # Firestore doc ID to update


@router.post("/create-order", response_model=CreateOrderResponse)
async def create_order(payload: CreateOrderRequest, user=Depends(require_auth)):
    key_id = os.environ.get("RAZORPAY_KEY_ID")
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        raise HTTPException(status_code=503, detail="Razorpay not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend .env")

    try:
        import razorpay
        client = razorpay.Client(auth=(key_id, key_secret))
        order_data = {
            "amount": payload.amount,
            "currency": payload.currency,
            "receipt": payload.receipt,
            "notes": {
                "studentId": payload.studentId,
                "studentName": payload.studentName,
                "feeName": payload.feeName,
                **(payload.notes or {}),
            },
        }
        order = client.order.create(data=order_data)
        return CreateOrderResponse(
            orderId=order["id"],
            amount=order["amount"],
            currency=order["currency"],
            keyId=key_id,
        )
    except Exception as e:
        logger.exception("Razorpay order creation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-payment-link", response_model=CreatePaymentLinkResponse)
async def create_payment_link(payload: CreatePaymentLinkRequest, user=Depends(require_auth)):
    """Create a Razorpay Payment Link — used by the mobile app (no WebView checkout support)."""
    key_id = os.environ.get("RAZORPAY_KEY_ID")
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        raise HTTPException(status_code=503, detail="Razorpay not configured.")

    try:
        import razorpay
        client = razorpay.Client(auth=(key_id, key_secret))
        link_data = {
            "amount": payload.amount,
            "currency": payload.currency,
            "accept_partial": False,
            "description": payload.description or f"Fee: {payload.feeName} — {payload.studentName}",
            "customer": {
                "name": payload.studentName
            },
            "notify": {"sms": False, "email": False},
            "reminder_enable": False,
            "notes": {
                "studentId": payload.studentId,
                "feeName": payload.feeName,
            },
            "options": {
                "checkout": {
                    "name": "St. Pauls",
                    "config": {
                        "display": {
                            "blocks": {
                                "upi": {
                                    "name": "Pay via UPI",
                                    "instruments": [{"method": "upi"}]
                                }
                            },
                            "sequence": ["block.upi"],
                            "preferences": {"show_default_blocks": False}
                        }
                    }
                }
            }
        }
        
        # Only add contact if it's a valid 10+ digit number, no fallbacks
        if payload.phone and len(payload.phone) >= 10 and payload.phone not in ["9999999999", "9876543210"]:
            link_data["customer"]["contact"] = payload.phone
            
        link = client.payment_link.create(link_data)
        return CreatePaymentLinkResponse(
            paymentLinkId=link["id"],
            shortUrl=link["short_url"],
            amount=link["amount"],
        )
    except Exception as e:
        logger.exception("Razorpay payment link creation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verify")
async def verify_payment(payload: VerifyPaymentRequest, user=Depends(require_auth)):
    """Verify payment signature and update Firestore transaction status."""
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET", "")
    msg = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}"
    expected = hmac.new(key_secret.encode(), msg.encode(), digestmod=hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected, payload.razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    # Update Firestore transaction to PAID
    try:
        from firebase_admin import firestore
        db = firestore.client()
        db.collection("transactions").document(payload.firestoreTransactionId).update({
            "status": "PAID",
            "razorpayOrderId": payload.razorpay_order_id,
            "razorpayPaymentId": payload.razorpay_payment_id,
            "paidAt": firestore.SERVER_TIMESTAMP,
        })
    except Exception as e:
        logger.error("Firestore update failed after payment: %s", e)
        # Don't fail the response — payment is verified, Firestore update is best-effort

    return {"success": True, "paymentId": payload.razorpay_payment_id}


@router.post("/webhook")
async def razorpay_webhook(request: Request):
    """Razorpay webhook endpoint. Verify signature and handle events."""
    webhook_secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    expected = hmac.new(webhook_secret.encode(), body, digestmod=hashlib.sha256).hexdigest()
    if webhook_secret and not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    import json
    event = json.loads(body)
    event_type = event.get("event")
    logger.info("Razorpay webhook: %s", event_type)

    if event_type == "payment.captured":
        payment = event["payload"]["payment"]["entity"]
        order_id = payment.get("order_id")
        payment_id = payment.get("id")
        logger.info("Payment captured: order=%s payment=%s", order_id, payment_id)
        # Firestore update handled by /verify endpoint called from frontend

    return {"received": True}

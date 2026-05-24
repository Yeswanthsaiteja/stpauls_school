"""routers/notifications.py — WhatsApp & SMS via MSG91"""
import os, logging, secrets, time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
from middleware.firebase_auth import require_auth

router = APIRouter()
logger = logging.getLogger(__name__)

# ─── OTP helpers: Firestore-backed with in-memory fallback ───────────────────
# Primary store is Firestore (survives restarts, works across multiple servers).
# Falls back to the in-memory dict when Firebase is unavailable (dev / test).
_otp_fallback: Dict[str, dict] = {}
_OTP_COLLECTION = "otp_store"


def _firestore_client():
    """Return an initialised Firestore client, or None if not available."""
    try:
        import firebase_admin
        if not firebase_admin._apps:
            from firebase_admin import credentials
            cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
            if cred_path and os.path.exists(cred_path):
                firebase_admin.initialize_app(credentials.Certificate(cred_path))
            else:
                firebase_admin.initialize_app(credentials.ApplicationDefault())
        from firebase_admin import firestore
        return firestore.client()
    except Exception as exc:
        logger.warning("Firestore unavailable for OTP store: %s", exc)
        return None


def _otp_set(mobile: str, record: dict) -> None:
    """Write OTP to both Firestore AND in-memory (dual-write for resilience)."""
    # Always keep in-memory copy so verify works even if Firestore is slow
    _otp_fallback[mobile] = record
    db = _firestore_client()
    if db:
        try:
            db.collection(_OTP_COLLECTION).document(mobile).set(record)
        except Exception as exc:
            logger.warning("Firestore OTP write failed (in-memory used): %s", exc)


def _otp_get(mobile: str) -> Optional[dict]:
    """Read OTP — try Firestore first, fall back to in-memory."""
    db = _firestore_client()
    if db:
        try:
            doc = db.collection(_OTP_COLLECTION).document(mobile).get()
            if doc.exists:
                return doc.to_dict()
            # Not in Firestore — fall through to in-memory
        except Exception as exc:
            logger.warning("Firestore OTP read failed, using in-memory: %s", exc)
    return _otp_fallback.get(mobile)


def _otp_delete(mobile: str) -> None:
    """Delete OTP from both stores."""
    _otp_fallback.pop(mobile, None)
    db = _firestore_client()
    if db:
        try:
            db.collection(_OTP_COLLECTION).document(mobile).delete()
        except Exception as exc:
            logger.warning("Firestore OTP delete failed (in-memory cleared): %s", exc)


class WhatsAppMessage(BaseModel):
    to: str                    # Mobile number with country code e.g. 919876543210
    message: str
    templateId: Optional[str] = None


class BulkMessage(BaseModel):
    recipients: List[str]      # List of mobile numbers
    message: str
    templateId: Optional[str] = None


class FeeReminderRequest(BaseModel):
    studentId: str
    studentName: str
    parentPhone: str           # with country code
    feeName: str
    amount: float
    dueDate: str


class AttendanceAlertRequest(BaseModel):
    studentName: str
    parentPhone: str
    date: str
    status: str                # ABSENT | LATE


def get_msg91_client():
    auth_key = os.environ.get("MSG91_AUTH_KEY")
    if not auth_key:
        raise HTTPException(status_code=503, detail="MSG91 not configured. Add MSG91_AUTH_KEY to backend .env")
    return auth_key


def _normalise_mobile(raw: str) -> str:
    """Return 12-digit mobile with country code (e.g. 918897245345)."""
    digits = raw.replace("+", "").replace(" ", "").replace("-", "")
    if digits.startswith("91") and len(digits) == 12:
        return digits
    if len(digits) == 10:
        return f"91{digits}"
    raise HTTPException(status_code=400, detail="Invalid phone number. Please send a 10-digit Indian number.")


# ─── OTP Models ───────────────────────────────────────────────────────────────

class OtpRequest(BaseModel):
    phone: str   # 10-digit or E.164

class OtpVerifyRequest(BaseModel):
    phone: str
    otp: str


# ─── Send OTP (no auth required — user is logging in) ────────────────────────

@router.post("/send-otp")
async def send_otp(payload: OtpRequest):
    mobile = _normalise_mobile(payload.phone)
    import requests as req

    # ── 1. Try 2Factor.in (Primary OTP Provider) ──────────────────────────────
    two_factor_key = os.environ.get("TWO_FACTOR_API_KEY", "40509a3c-5735-11f1-9800-0200cd936042") # Hardcoded from your dashboard for instant access
    if two_factor_key:
        try:
            # We use AUTOGEN so 2Factor generates the OTP and uses their pre-approved DLT SMS template.
            # If we send our own custom OTP, it fails DLT checks in India and falls back to a Voice Call.
            url = f"https://2factor.in/API/V1/{two_factor_key}/SMS/{mobile}/AUTOGEN/OTP1"
            resp = req.get(url, timeout=10)
            data = resp.json()
            if data.get("Status") == "Success":
                logger.info("OTP sent to %s via 2Factor.in AUTOGEN", mobile)
                return {"success": True, "provider": "2factor"}
            else:
                logger.warning("2Factor.in rejected OTP: %s", data)
        except Exception as e:
            logger.warning("2Factor.in OTP failed: %s", e)

    # ── 2. Fall back to MSG91 (if 2Factor fails or isn't used) ────────────────
    
    # If we get here, generate our own OTP and use MSG91
    otp = str(secrets.randbelow(900000) + 100000)
    _otp_set(mobile, {
        "otp": otp,
        "expires_at": time.time() + 600,
        "attempts": 0,
    })

    msg91_key = os.environ.get("MSG91_AUTH_KEY")
    if msg91_key:
        try:
            sender_id = os.environ.get("MSG91_SENDER_ID", "STPAUL")
            message = (
                f"Your St. Paul's High School login OTP is {otp}. "
                f"Valid for 10 minutes. Do not share with anyone."
            )
            url = "https://api.msg91.com/api/v5/flow/"
            headers = {"Content-Type": "application/json", "Authkey": msg91_key}
            body = {
                "sender": sender_id,
                "route": "4",
                "country": "91",
                "sms": [{"message": message, "to": [mobile]}],
            }
            resp = req.post(url, json=body, headers=headers, timeout=10)
            resp.raise_for_status()
            logger.info("OTP sent to %s via MSG91", mobile)
            return {"success": True, "provider": "msg91"}
        except Exception as e:
            logger.exception("MSG91 OTP send failed for %s: %s", mobile, e)

    # ── No SMS provider succeeded — dev mode ──────────────────────────────────
    logger.warning("[DEV] No SMS provider configured or all failed. OTP for %s: %s", mobile, otp)
    return {"success": True, "dev": True, "otp": otp, "hint": "Check provider API keys"}


# ─── Verify OTP (no auth required) ───────────────────────────────────────────

@router.post("/verify-otp")
async def verify_otp(payload: OtpVerifyRequest):
    mobile = _normalise_mobile(payload.phone)
    import requests as req

    # ── 1. Check if 2Factor.in is active ──────────────────────────────────────
    two_factor_key = os.environ.get("TWO_FACTOR_API_KEY", "40509a3c-5735-11f1-9800-0200cd936042")
    if two_factor_key:
        try:
            # Verify the OTP against 2Factor's servers
            url = f"https://2factor.in/API/V1/{two_factor_key}/SMS/VERIFY3/{mobile}/{payload.otp.strip()}"
            resp = req.get(url, timeout=10)
            data = resp.json()
            if data.get("Status") == "Success":
                return {"success": True, "verified": True, "phone": f"+{mobile}"}
            else:
                raise HTTPException(status_code=400, detail="Incorrect OTP or OTP has expired.")
        except HTTPException:
            raise
        except Exception as e:
            logger.warning("2Factor VERIFY3 failed: %s", e)
            raise HTTPException(status_code=500, detail="OTP verification service is currently unavailable.")

    # ── 2. Fall back to internal validation (if MSG91 or Dev mode was used) ───
    stored = _otp_get(mobile)

    if not stored:
        raise HTTPException(status_code=400, detail="OTP not found or already used. Please request a new OTP.")

    if time.time() > stored["expires_at"]:
        _otp_delete(mobile)
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new OTP.")

    stored["attempts"] += 1
    if stored["attempts"] > 5:
        _otp_delete(mobile)
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Please request a new OTP.")

    # Persist updated attempt count before checking correctness
    _otp_set(mobile, stored)

    if stored["otp"] != payload.otp.strip():
        remaining = 5 - stored["attempts"]
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect OTP. {remaining} attempt(s) remaining."
        )

    _otp_delete(mobile)   # consume OTP
    return {"success": True, "verified": True, "phone": f"+{mobile}"}


@router.post("/whatsapp")
async def send_whatsapp(payload: WhatsAppMessage, user=Depends(require_auth)):
    auth_key = get_msg91_client()
    try:
        import requests
        url = "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/send-using-template"
        headers = {"Content-Type": "application/json", "Authkey": auth_key}
        body = {
            "to": payload.to,
            "message": payload.message,
        }
        if payload.templateId:
            body["template_id"] = payload.templateId

        resp = requests.post(url, json=body, headers=headers, timeout=10)
        resp.raise_for_status()
        return {"success": True, "response": resp.json()}
    except Exception as e:
        logger.exception("MSG91 WhatsApp send failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to send WhatsApp message. Please try again later.")


@router.post("/sms")
async def send_sms(payload: WhatsAppMessage, user=Depends(require_auth)):
    auth_key = get_msg91_client()
    sender_id = os.environ.get("MSG91_SENDER_ID", "STPAUL")
    try:
        import requests
        url = "https://api.msg91.com/api/v5/flow/"
        headers = {"Content-Type": "application/json", "Authkey": auth_key}
        body = {
            "sender": sender_id,
            "route": "4",
            "country": "91",
            "sms": [{"message": payload.message, "to": [payload.to]}],
        }
        resp = requests.post(url, json=body, headers=headers, timeout=10)
        resp.raise_for_status()
        return {"success": True, "response": resp.json()}
    except Exception as e:
        logger.exception("MSG91 SMS send failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to send SMS. Please try again later.")


@router.post("/bulk")
async def send_bulk(payload: BulkMessage, user=Depends(require_auth)):
    """Send WhatsApp message to multiple recipients."""
    results = []
    for phone in payload.recipients:
        try:
            msg = WhatsAppMessage(to=phone, message=payload.message, templateId=payload.templateId)
            result = await send_whatsapp(msg, user)
            results.append({"phone": phone, "success": True})
        except Exception as e:
            results.append({"phone": phone, "success": False, "error": "Message delivery failed."})
    sent = sum(1 for r in results if r["success"])
    return {"total": len(results), "sent": sent, "failed": len(results) - sent, "results": results}


@router.post("/fee-reminder")
async def fee_reminder(payload: FeeReminderRequest, user=Depends(require_auth)):
    """Send a formatted fee reminder WhatsApp message to parent."""
    template_id = os.environ.get("MSG91_TEMPLATE_ID_FEE_REMINDER")
    message = (
        f"Dear Parent,\n"
        f"This is a reminder that the *{payload.feeName}* fee of "
        f"*₹{payload.amount:,.0f}* for {payload.studentName} is due on {payload.dueDate}.\n"
        f"Please pay at the school office or online.\n"
        f"— St. Paul's High School"
    )
    msg = WhatsAppMessage(to=payload.parentPhone, message=message, templateId=template_id)
    return await send_whatsapp(msg, user)


@router.post("/attendance-alert")
async def attendance_alert(payload: AttendanceAlertRequest, user=Depends(require_auth)):
    """Send attendance alert to parent when student is absent or late."""
    template_id = os.environ.get("MSG91_TEMPLATE_ID_ATTENDANCE")
    status_text = "absent" if payload.status == "ABSENT" else "late"
    message = (
        f"Dear Parent,\n"
        f"*{payload.studentName}* was marked *{status_text}* on {payload.date}.\n"
        f"If this is an error, please contact the school.\n"
        f"— St. Paul's High School"
    )
    msg = WhatsAppMessage(to=payload.parentPhone, message=message, templateId=template_id)
    return await send_whatsapp(msg, user)

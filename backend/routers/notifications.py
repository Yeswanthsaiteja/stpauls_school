"""routers/notifications.py — WhatsApp & SMS via MSG91"""
import os, logging, secrets, time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
from middleware.firebase_auth import require_auth

router = APIRouter()
logger = logging.getLogger(__name__)

# ─── In-memory OTP store: mobile → {otp, expires_at, attempts} ───────────────
# For production scale, replace with Redis.
_otp_store: Dict[str, dict] = {}


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
    mobile10 = mobile[-10:]   # last 10 digits — used by Fast2SMS

    otp = str(secrets.randbelow(900000) + 100000)   # cryptographically random 6-digit
    _otp_store[mobile] = {
        "otp": otp,
        "expires_at": time.time() + 600,   # 10 minutes
        "attempts": 0,
    }

    import requests as req

    otp_message = (
        f"*St. Paul's High School*\n"
        f"Your login OTP is: *{otp}*\n"
        f"Valid for 10 minutes. Do not share this code with anyone."
    )
    fast2sms_key = os.environ.get("FAST2SMS_API_KEY")

    # ── 1. Try WhatsApp via Fast2SMS ──────────────────────────────────────────
    if fast2sms_key:
        try:
            url = "https://www.fast2sms.com/dev/whatsapp"
            headers = {"authorization": fast2sms_key, "Content-Type": "application/json"}
            body = {"message": otp_message, "language": "english", "numbers": mobile10}
            resp = req.post(url, json=body, headers=headers, timeout=10)
            data = resp.json()
            if data.get("return") is True:
                logger.info("OTP sent to %s via Fast2SMS WhatsApp", mobile10)
                return {"success": True, "channel": "whatsapp"}
            else:
                logger.warning("Fast2SMS WhatsApp rejected: %s — trying SMS", data)
        except Exception as e:
            logger.warning("Fast2SMS WhatsApp failed: %s — trying SMS", e)

    # ── 2. Fall back to Fast2SMS SMS ──────────────────────────────────────────
    if fast2sms_key:
        try:
            sms_message = f"{otp} is your St. Paul's High School OTP. Valid 10 mins. Do not share."
            url = "https://www.fast2sms.com/dev/bulkV2"
            headers = {"authorization": fast2sms_key, "Content-Type": "application/json"}
            body = {"route": "q", "message": sms_message, "language": "english", "flash": 0, "numbers": mobile10}
            resp = req.post(url, json=body, headers=headers, timeout=10)
            data = resp.json()
            if data.get("return") is True:
                logger.info("OTP sent to %s via Fast2SMS SMS", mobile10)
                return {"success": True, "channel": "sms"}
            else:
                logger.warning("Fast2SMS SMS rejected: %s", data)
        except Exception as e:
            logger.warning("Fast2SMS SMS failed: %s", e)

    # ── Try MSG91 next ─────────────────────────────────────────────────────────
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
            return {"success": True}
        except Exception as e:
            logger.exception("MSG91 OTP send failed for %s: %s", mobile, e)
            raise HTTPException(status_code=500, detail=f"SMS delivery failed: {e}. Please try again.")

    # ── No SMS provider configured — dev mode ─────────────────────────────────
    logger.warning("[DEV] No SMS provider configured. OTP for %s: %s", mobile, otp)
    return {"success": True, "dev": True, "otp": otp, "hint": "No SMS provider configured — OTP shown for development only"}


# ─── Verify OTP (no auth required) ───────────────────────────────────────────

@router.post("/verify-otp")
async def verify_otp(payload: OtpVerifyRequest):
    mobile = _normalise_mobile(payload.phone)
    stored = _otp_store.get(mobile)

    if not stored:
        raise HTTPException(status_code=400, detail="OTP not found or already used. Please request a new OTP.")

    if time.time() > stored["expires_at"]:
        _otp_store.pop(mobile, None)
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new OTP.")

    stored["attempts"] += 1
    if stored["attempts"] > 5:
        _otp_store.pop(mobile, None)
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Please request a new OTP.")

    if stored["otp"] != payload.otp.strip():
        remaining = 5 - stored["attempts"]
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect OTP. {remaining} attempt(s) remaining."
        )

    _otp_store.pop(mobile, None)   # consume OTP
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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
            results.append({"phone": phone, "success": False, "error": str(e)})
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

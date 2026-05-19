"""routers/ai.py — AI Insights + Certificate text via Gemini"""
import os, json, re, logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from middleware.firebase_auth import optional_auth

router = APIRouter()
logger = logging.getLogger(__name__)

FALLBACK_INSIGHTS = [
    "Attendance trending steady — recognise top-performing classes weekly.",
    "Outstanding fees concentrated in upper grades; send WhatsApp reminders this week.",
    "Strong admission momentum this month — capture testimonials from new parents.",
]


class InsightsRequest(BaseModel):
    tenantName: Optional[str] = "School"
    stats: Dict[str, Any] = {}
    locale: Optional[str] = "en"


class InsightsResponse(BaseModel):
    insights: List[str]
    generated: bool = True


class CertTextRequest(BaseModel):
    type: str  # "TC" | "BONAFIDE"
    studentName: str
    className: str
    admissionNo: str
    dob: Optional[str] = ""
    reason: Optional[str] = ""
    schoolName: Optional[str] = "St. Paul's High School"


class CertTextResponse(BaseModel):
    text: str
    generated: bool = True


def _gemini_generate(api_key: str, system_msg: str, user_msg: str) -> str:
    """Call Gemini via google-generativeai SDK."""
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        system_instruction=system_msg,
    )
    response = model.generate_content(user_msg)
    return response.text or ""


@router.post("/insights", response_model=InsightsResponse)
async def ai_insights(payload: InsightsRequest, _user=Depends(optional_auth)):
    api_key = os.environ.get("GOOGLE_AI_API_KEY")
    if not api_key:
        return InsightsResponse(insights=FALLBACK_INSIGHTS, generated=False)
    try:
        lang = "Telugu" if (payload.locale or "en").startswith("te") else "English"
        sys_msg = (
            f"You are a senior school operations consultant. Produce concise, "
            f"actionable insights in {lang}. Output ONLY a JSON array of exactly 3 short "
            f"strings (max 18 words each). No preamble, no markdown."
        )
        user_msg = (
            f"School: {payload.tenantName}\n"
            f"Stats: {payload.stats}\n"
            f"Return a JSON array of 3 actionable insights tailored to these numbers."
        )
        text = _gemini_generate(api_key, sys_msg, user_msg).strip()
        m = re.search(r"\[.*\]", text, re.DOTALL)
        if m:
            arr = json.loads(m.group(0))
            arr = [str(x).strip() for x in arr if str(x).strip()][:3]
            if len(arr) >= 3:
                return InsightsResponse(insights=arr, generated=True)
        lines = [ln.strip("-• ").strip() for ln in text.split("\n") if ln.strip()][:3]
        if len(lines) >= 3:
            return InsightsResponse(insights=lines, generated=True)
        return InsightsResponse(insights=FALLBACK_INSIGHTS, generated=False)
    except Exception as e:
        logger.exception("AI insights error: %s", e)
        return InsightsResponse(insights=FALLBACK_INSIGHTS, generated=False)


@router.post("/certificate-text", response_model=CertTextResponse)
async def certificate_text(payload: CertTextRequest, _user=Depends(optional_auth)):
    FALLBACK = f"This is to certify that {payload.studentName} of Class {payload.className} (Adm. No. {payload.admissionNo}) is a bonafide student of {payload.schoolName}."
    api_key = os.environ.get("GOOGLE_AI_API_KEY")
    if not api_key:
        return CertTextResponse(text=FALLBACK, generated=False)
    try:
        cert_type = "Transfer Certificate" if payload.type == "TC" else "Bonafide Certificate"
        sys_msg = "You are a school secretary. Write formal certificate text in English. Output ONLY the certificate body text, no headings or signatures."
        user_msg = (
            f"Write a {cert_type} for:\n"
            f"Student: {payload.studentName}\nClass: {payload.className}\n"
            f"Admission No: {payload.admissionNo}\nDOB: {payload.dob}\n"
            f"School: {payload.schoolName}\nReason: {payload.reason or 'as requested'}"
        )
        text = _gemini_generate(api_key, sys_msg, user_msg).strip()
        return CertTextResponse(text=text or FALLBACK, generated=True)
    except Exception as e:
        logger.exception("Certificate text error: %s", e)
        return CertTextResponse(text=FALLBACK, generated=False)

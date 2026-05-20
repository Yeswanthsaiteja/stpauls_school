"""routers/pdf.py — PDF generation for receipts and certificates"""
import os, logging, io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from middleware.firebase_auth import require_auth

router = APIRouter()
logger = logging.getLogger(__name__)

TENANT_ID = os.environ.get("TENANT_ID", "stpauls")
SCHOOL_NAME = os.environ.get("SCHOOL_NAME", "St. Paul's High School")
SCHOOL_ADDRESS = os.environ.get("SCHOOL_ADDRESS", "Hyderabad, Telangana")
SCHOOL_PHONE = os.environ.get("SCHOOL_PHONE", "+91 9000000000")


def get_firestore():
    from firebase_admin import firestore
    return firestore.client()


def _fit_text(canvas_obj, text: str, x: float, y: float, max_width: float, font: str, size: int) -> None:
    """Draw text, truncating with ellipsis if it exceeds max_width."""
    from reportlab.pdfbase.pdfmetrics import stringWidth
    canvas_obj.setFont(font, size)
    while text and stringWidth(text, font, size) > max_width:
        text = text[:-1]
    if not text:
        return
    # Re-add ellipsis only when we actually truncated
    canvas_obj.drawString(x, y, text)


def _truncate(text: str, canvas_obj, font: str, size: int, max_width: float) -> str:
    """Return text truncated with '…' to fit within max_width points."""
    from reportlab.pdfbase.pdfmetrics import stringWidth
    if stringWidth(text, font, size) <= max_width:
        return text
    ellipsis = "…"
    while text and stringWidth(text + ellipsis, font, size) > max_width:
        text = text[:-1]
    return text + ellipsis


def build_receipt_pdf(txn: dict) -> bytes:
    """Generate a fee receipt PDF using ReportLab."""
    try:
        from reportlab.lib.pagesizes import A5
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas

        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A5)
        w, h = A5

        # Header
        c.setFillColor(colors.HexColor("#6366f1"))
        c.rect(0, h - 50 * mm, w, 50 * mm, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 16)
        c.drawCentredString(w / 2, h - 18 * mm, SCHOOL_NAME)
        c.setFont("Helvetica", 9)
        c.drawCentredString(w / 2, h - 25 * mm, SCHOOL_ADDRESS)
        c.drawCentredString(w / 2, h - 31 * mm, f"Phone: {SCHOOL_PHONE}")
        c.setFont("Helvetica-Bold", 11)
        c.drawCentredString(w / 2, h - 40 * mm, "FEE RECEIPT")

        # Body
        c.setFillColor(colors.black)
        y = h - 58 * mm
        line_h = 8 * mm
        label_x   = 10 * mm
        value_x   = 60 * mm
        value_max = w - value_x - 6 * mm   # available width for values

        def row(label: str, value: str, bold_value: bool = False) -> None:
            nonlocal y
            font = "Helvetica-Bold" if bold_value else "Helvetica"
            c.setFont("Helvetica", 9)
            c.drawString(label_x, y, label)
            c.setFont(font, 9)
            safe_value = _truncate(str(value), c, font, 9, value_max)
            c.drawString(value_x, y, safe_value)
            y -= line_h

        row("Receipt No:", txn.get("receiptNo", "—"))
        row("Date:", txn.get("paymentDate", "")[:10])
        row("Student Name:", txn.get("studentName", "—"))
        row("Admission No:", txn.get("admissionNo", "—"))
        row("Class:", f"{txn.get('className', '')} - {txn.get('section', '')}")
        row("Fee Description:", txn.get("feeName", "—"))
        row("Payment Method:", txn.get("paymentMethod", "—"))

        y -= 3 * mm
        c.setFillColor(colors.HexColor("#f0fdf4"))
        c.rect(8 * mm, y - 4 * mm, w - 16 * mm, 12 * mm, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#166534"))
        c.setFont("Helvetica-Bold", 13)
        amount = txn.get("amount", 0)
        c.drawString(12 * mm, y + 2 * mm, "Amount Paid:")
        c.drawRightString(w - 12 * mm, y + 2 * mm, f"Rs. {amount:,.2f}")

        # Footer
        y -= 20 * mm
        c.setFillColor(colors.grey)
        c.setFont("Helvetica-Oblique", 8)
        c.drawCentredString(w / 2, y, "This is a computer-generated receipt. No signature required.")

        c.save()
        return buf.getvalue()
    except ImportError:
        raise HTTPException(status_code=503, detail="ReportLab not installed. Run: pip install reportlab")


@router.get("/receipt/{txn_id}")
async def get_receipt_pdf(txn_id: str, user=Depends(require_auth)):
    """Fetch a transaction from Firestore and generate a PDF receipt."""
    try:
        db = get_firestore()
        doc = db.collection("transactions").document(txn_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Transaction not found")
        txn = doc.to_dict()
        txn["id"] = txn_id

        pdf_bytes = build_receipt_pdf(txn)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=receipt-{txn.get('receiptNo', txn_id)}.pdf"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Receipt PDF error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to generate receipt PDF. Please try again.")


class CertificateRequest(BaseModel):
    type: str          # "TC" | "BONAFIDE"
    studentId: str
    reason: Optional[str] = ""
    aiText: Optional[str] = None   # pre-generated AI text (optional)


@router.post("/certificate")
async def get_certificate_pdf(payload: CertificateRequest, user=Depends(require_auth)):
    """Generate TC or Bonafide certificate PDF for a student."""
    try:
        db = get_firestore()
        student_doc = db.collection("students").document(payload.studentId).get()
        if not student_doc.exists:
            raise HTTPException(status_code=404, detail="Student not found")
        student = student_doc.to_dict()

        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas

        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        w, h = A4
        cert_title = "TRANSFER CERTIFICATE" if payload.type == "TC" else "BONAFIDE CERTIFICATE"

        # Border
        c.setStrokeColor(colors.HexColor("#6366f1"))
        c.setLineWidth(3)
        c.rect(15 * mm, 15 * mm, w - 30 * mm, h - 30 * mm)

        # School header
        c.setFillColor(colors.HexColor("#6366f1"))
        c.setFont("Helvetica-Bold", 20)
        c.drawCentredString(w / 2, h - 35 * mm, SCHOOL_NAME)
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 11)
        c.drawCentredString(w / 2, h - 44 * mm, SCHOOL_ADDRESS)

        # Title
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(w / 2, h - 60 * mm, cert_title)

        # Body
        body_text = payload.aiText or (
            f"This is to certify that {student.get('fullName', '')} "
            f"(Adm. No. {student.get('admissionNo', '')}) "
            f"is / was a bonafide student of this institution, "
            f"studying in Class {student.get('className', '')} - {student.get('section', '')}. "
            f"{'Reason: ' + payload.reason if payload.reason else ''}"
        )

        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph
        from reportlab.lib.styles import ParagraphStyle

        style = ParagraphStyle("body", fontName="Helvetica", fontSize=12, leading=18, spaceAfter=6)
        p = Paragraph(body_text, style)
        p.wrapOn(c, w - 60 * mm, 100 * mm)
        p.drawOn(c, 30 * mm, h - 130 * mm)

        # Signature line
        c.line(w - 80 * mm, 50 * mm, w - 20 * mm, 50 * mm)
        c.setFont("Helvetica", 10)
        c.drawCentredString(w - 50 * mm, 44 * mm, "Principal / Head of Institution")
        c.drawString(25 * mm, 50 * mm, f"Date: _______________")

        c.save()
        pdf_bytes = buf.getvalue()
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={payload.type.lower()}-{student.get('admissionNo', payload.studentId)}.pdf"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Certificate PDF error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to generate certificate PDF. Please try again.")

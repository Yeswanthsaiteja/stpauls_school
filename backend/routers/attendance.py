"""routers/attendance.py — Attendance CRUD and summaries via Firestore Admin SDK"""
import os, logging, re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from typing import Optional, Dict
from middleware.firebase_auth import require_auth, optional_auth

router = APIRouter()
logger = logging.getLogger(__name__)
TENANT_ID = os.environ.get("TENANT_ID", "stpauls")

_VALID_ATTENDANCE_STATUSES = {"PRESENT", "ABSENT", "LATE"}


def fs():
    from firebase_admin import firestore
    return firestore.client()


class AttendanceSave(BaseModel):
    className: str
    section: str
    date: str                    # YYYY-MM-DD
    records: Dict[str, str]      # { studentId: "PRESENT"|"ABSENT"|"LATE" }
    markedBy: Optional[str] = ""

    @field_validator("date", mode="before")
    @classmethod
    def validate_date(cls, v: str) -> str:
        try:
            datetime.strptime(v.strip(), "%Y-%m-%d")
        except ValueError:
            raise ValueError("Attendance date must be in YYYY-MM-DD format.")
        return v.strip()

    @field_validator("records", mode="before")
    @classmethod
    def validate_records(cls, v: Dict[str, str]) -> Dict[str, str]:
        invalid = {
            sid: status
            for sid, status in v.items()
            if status not in _VALID_ATTENDANCE_STATUSES
        }
        if invalid:
            bad_entries = ", ".join(f"{sid}='{s}'" for sid, s in list(invalid.items())[:5])
            raise ValueError(
                f"Invalid attendance status for: {bad_entries}. "
                f"Allowed values are: {', '.join(sorted(_VALID_ATTENDANCE_STATUSES))}."
            )
        return v


# ─── Get attendance for a class + date ────────────────────────────────────────
@router.get("/{class_name}/{section}/{date}")
async def get_attendance(class_name: str, section: str, date: str, _user=Depends(optional_auth)):
    try:
        db = fs()
        doc_id = f"{TENANT_ID}_{class_name}_{section}_{date}"
        doc = db.collection("attendance").document(doc_id).get()
        if not doc.exists:
            return {"records": {}, "exists": False}
        data = doc.to_dict()
        return {
            "records": data.get("records", {}),
            "present": data.get("present", 0),
            "absent": data.get("absent", 0),
            "late": data.get("late", 0),
            "total": data.get("total", 0),
            "markedBy": data.get("markedBy", ""),
            "exists": True,
        }
    except Exception as e:
        logger.exception("Get attendance error: %s", e)
        return {"records": {}, "exists": False, "error": "An error occurred while fetching attendance."}


# ─── Save attendance ──────────────────────────────────────────────────────────
@router.post("")
async def save_attendance(payload: AttendanceSave, user=Depends(require_auth)):
    try:
        from firebase_admin import firestore as fs_admin
        db = fs()
        doc_id = f"{TENANT_ID}_{payload.className}_{payload.section}_{payload.date}"
        present = sum(1 for v in payload.records.values() if v == "PRESENT")
        absent = sum(1 for v in payload.records.values() if v == "ABSENT")
        late = sum(1 for v in payload.records.values() if v == "LATE")

        db.collection("attendance").document(doc_id).set({
            "tenantId": TENANT_ID,
            "className": payload.className,
            "section": payload.section,
            "date": payload.date,
            "records": payload.records,
            "markedBy": payload.markedBy or user.get("email", ""),
            "markedAt": fs_admin.SERVER_TIMESTAMP,
            "total": len(payload.records),
            "present": present,
            "absent": absent,
            "late": late,
        }, merge=True)

        return {
            "success": True,
            "total": len(payload.records),
            "present": present,
            "absent": absent,
            "late": late,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Save attendance error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save attendance. Please try again.")


# ─── Class attendance summary (last 30 days) ──────────────────────────────────
@router.get("/summary/{class_name}/{section}")
async def attendance_summary(class_name: str, section: str, _user=Depends(optional_auth)):
    try:
        from datetime import date, timedelta
        today = date.today().isoformat()
        thirty_ago = (date.today() - timedelta(days=30)).isoformat()

        db = fs()
        docs = (
            db.collection("attendance")
            .where("tenantId", "==", TENANT_ID)
            .where("className", "==", class_name)
            .where("section", "==", section)
            .where("date", ">=", thirty_ago)
            .where("date", "<=", today)
            .order_by("date", direction="DESCENDING")
            .stream()
        )
        rows = [{"id": d.id, **d.to_dict()} for d in docs]

        # Aggregate
        total_days = len(rows)
        avg_present = round(sum(r.get("present", 0) for r in rows) / total_days, 1) if total_days else 0
        avg_absent = round(sum(r.get("absent", 0) for r in rows) / total_days, 1) if total_days else 0

        return {
            "className": class_name,
            "section": section,
            "totalDays": total_days,
            "avgPresent": avg_present,
            "avgAbsent": avg_absent,
            "records": rows,
        }
    except Exception as e:
        logger.exception("Attendance summary error: %s", e)
        return {"totalDays": 0, "avgPresent": 0, "avgAbsent": 0, "records": [], "error": "An error occurred while fetching the attendance summary."}


# ─── Student attendance history ────────────────────────────────────────────────
@router.get("/student/{student_id}")
async def student_attendance_history(
    student_id: str,
    fromDate: Optional[str] = Query(None),
    toDate: Optional[str] = Query(None),
    _user=Depends(optional_auth),
):
    try:
        from datetime import date, timedelta
        to = toDate or date.today().isoformat()
        frm = fromDate or (date.today() - timedelta(days=30)).isoformat()

        db = fs()
        docs = (
            db.collection("attendance")
            .where("tenantId", "==", TENANT_ID)
            .where("date", ">=", frm)
            .where("date", "<=", to)
            .order_by("date", direction="DESCENDING")
            .stream()
        )

        results = []
        for d in docs:
            data = d.to_dict()
            status = data.get("records", {}).get(student_id)
            if status:
                results.append({
                    "date": data.get("date"),
                    "className": data.get("className"),
                    "section": data.get("section"),
                    "status": status,
                })

        present = sum(1 for r in results if r["status"] == "PRESENT")
        absent = sum(1 for r in results if r["status"] == "ABSENT")
        late = sum(1 for r in results if r["status"] == "LATE")
        total = len(results)

        return {
            "studentId": student_id,
            "fromDate": frm,
            "toDate": to,
            "total": total,
            "present": present,
            "absent": absent,
            "late": late,
            "attendancePercentage": round((present / total * 100) if total else 0, 1),
            "records": results,
        }
    except Exception as e:
        logger.exception("Student attendance history error: %s", e)
        return {"total": 0, "present": 0, "absent": 0, "records": [], "error": "An error occurred while fetching the student's attendance history."}

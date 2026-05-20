"""routers/students.py — Full CRUD for students via Firestore Admin SDK"""
import os, logging, csv, io, re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from typing import Optional, List
from middleware.firebase_auth import require_auth, optional_auth

router = APIRouter()
logger = logging.getLogger(__name__)
TENANT_ID = os.environ.get("TENANT_ID", "stpauls")

_VALID_STATUSES = {"ACTIVE", "INACTIVE", "REMOVED", "TRANSFERRED"}
_VALID_GENDERS  = {"Male", "Female", "Other", ""}
_VALID_BLOOD_GROUPS = {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", ""}


def fs():
    from firebase_admin import firestore
    return firestore.client()


class StudentCreate(BaseModel):
    firstName: str
    lastName: str
    fullName: Optional[str] = None
    admissionNo: Optional[str] = None
    className: str
    section: str
    dateOfBirth: Optional[str] = ""
    gender: Optional[str] = ""
    fatherName: Optional[str] = ""
    motherName: Optional[str] = ""
    phoneNumber: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    bloodGroup: Optional[str] = ""
    category: Optional[str] = "GEN"
    academicYear: Optional[str] = "2025-26"
    mediumOfInstruction: Optional[str] = "English"
    status: Optional[str] = "ACTIVE"

    @field_validator("firstName", "lastName")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name fields cannot be blank.")
        return v

    @field_validator("phoneNumber", mode="before")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        digits = re.sub(r"\D", "", v)
        if len(digits) != 10:
            raise ValueError("Phone number must be exactly 10 digits.")
        return digits

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
        if not re.match(pattern, v.strip()):
            raise ValueError("Invalid email address format.")
        return v.strip().lower()

    @field_validator("dateOfBirth", mode="before")
    @classmethod
    def validate_dob(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        try:
            dt = datetime.strptime(v.strip(), "%Y-%m-%d")
        except ValueError:
            raise ValueError("Date of birth must be in YYYY-MM-DD format.")
        if dt.year < 1950 or dt > datetime.today():
            raise ValueError("Date of birth is out of the valid range.")
        return v.strip()

    @field_validator("gender", mode="before")
    @classmethod
    def validate_gender(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in _VALID_GENDERS:
            raise ValueError(f"Gender must be one of: {', '.join(sorted(_VALID_GENDERS) or ['Male','Female','Other'])}.")
        return v

    @field_validator("bloodGroup", mode="before")
    @classmethod
    def validate_blood_group(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in _VALID_BLOOD_GROUPS:
            raise ValueError(f"Invalid blood group. Valid values: A+, A-, B+, B-, AB+, AB-, O+, O-.")
        return v

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in _VALID_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(_VALID_STATUSES))}.")
        return v


class StudentUpdate(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    fullName: Optional[str] = None
    className: Optional[str] = None
    section: Optional[str] = None
    dateOfBirth: Optional[str] = None
    gender: Optional[str] = None
    fatherName: Optional[str] = None
    motherName: Optional[str] = None
    phoneNumber: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    bloodGroup: Optional[str] = None
    category: Optional[str] = None
    academicYear: Optional[str] = None
    status: Optional[str] = None


# ─── List ─────────────────────────────────────────────────────────────────────
@router.get("")
async def list_students(
    className: Optional[str] = Query(None),
    section: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Search by name or admission number"),
    _user=Depends(optional_auth),
):
    try:
        db = fs()
        ref = db.collection("students").where("tenantId", "==", TENANT_ID)
        if className:
            ref = ref.where("className", "==", className)
        if section:
            ref = ref.where("section", "==", section)
        if status:
            ref = ref.where("status", "==", status)

        docs = ref.stream()
        students = [{"id": d.id, **d.to_dict()} for d in docs]

        if q:
            q_lower = q.lower()
            students = [
                s for s in students
                if q_lower in (s.get("fullName") or "").lower()
                or q_lower in (s.get("admissionNo") or "").lower()
            ]

        return {"students": students, "count": len(students)}
    except Exception as e:
        logger.exception("List students error: %s", e)
        return {"students": [], "count": 0, "error": "An error occurred while fetching students."}


# ─── Get One ──────────────────────────────────────────────────────────────────
@router.get("/{student_id}")
async def get_student(student_id: str, _user=Depends(optional_auth)):
    try:
        db = fs()
        doc = db.collection("students").document(student_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Student not found")
        return {"id": doc.id, **doc.to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Get student error: %s", e)
        raise HTTPException(status_code=500, detail="An unexpected error occurred while fetching the student.")


# ─── Create ───────────────────────────────────────────────────────────────────
@router.post("", status_code=201)
async def create_student(payload: StudentCreate, user=Depends(require_auth)):
    try:
        from firebase_admin import firestore as fs_admin
        db = fs()

        # Auto-generate admissionNo if not provided
        adm_no = (payload.admissionNo or "").strip()
        if not adm_no:
            count = len(list(db.collection("students").where("tenantId", "==", TENANT_ID).stream()))
            adm_no = f"STP{str(count + 1001).zfill(4)}"

        # Duplicate admission number check
        dup_adm = list(
            db.collection("students")
            .where("tenantId", "==", TENANT_ID)
            .where("admissionNo", "==", adm_no)
            .limit(1).stream()
        )
        if dup_adm:
            raise HTTPException(
                status_code=409,
                detail=f"A student with admission number '{adm_no}' already exists.",
            )

        # Duplicate phone number check (only when a phone is provided)
        if payload.phoneNumber:
            dup_phone = list(
                db.collection("students")
                .where("tenantId", "==", TENANT_ID)
                .where("phoneNumber", "==", payload.phoneNumber)
                .where("status", "==", "ACTIVE")
                .limit(1).stream()
            )
            if dup_phone:
                raise HTTPException(
                    status_code=409,
                    detail="A student with this phone number already exists.",
                )

        data = payload.dict()
        data["admissionNo"] = adm_no
        data["fullName"] = data.get("fullName") or f"{payload.firstName} {payload.lastName}"
        data["tenantId"] = TENANT_ID
        data["createdAt"] = fs_admin.SERVER_TIMESTAMP
        data["updatedAt"] = fs_admin.SERVER_TIMESTAMP

        ref = db.collection("students").add(data)
        return {"id": ref[1].id, "admissionNo": adm_no, **data}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Create student error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create student. Please try again.")


# ─── Update ───────────────────────────────────────────────────────────────────
@router.patch("/{student_id}")
async def update_student(student_id: str, payload: StudentUpdate, user=Depends(require_auth)):
    try:
        from firebase_admin import firestore as fs_admin
        db = fs()
        patch = {k: v for k, v in payload.dict().items() if v is not None}
        patch["updatedAt"] = fs_admin.SERVER_TIMESTAMP
        db.collection("students").document(student_id).update(patch)
        return {"success": True, "id": student_id}
    except Exception as e:
        logger.exception("Update student error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update student. Please try again.")


# ─── Soft Delete ──────────────────────────────────────────────────────────────
@router.delete("/{student_id}")
async def remove_student(student_id: str, reason: str = Query(""), user=Depends(require_auth)):
    try:
        from firebase_admin import firestore as fs_admin
        db = fs()
        db.collection("students").document(student_id).update({
            "status": "REMOVED",
            "removalReason": reason,
            "removedAt": fs_admin.SERVER_TIMESTAMP,
            "updatedAt": fs_admin.SERVER_TIMESTAMP,
        })
        return {"success": True}
    except Exception as e:
        logger.exception("Remove student error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to remove student. Please try again.")


# ─── Bulk Import (CSV) ────────────────────────────────────────────────────────
@router.post("/bulk-import")
async def bulk_import(file: UploadFile = File(...), user=Depends(require_auth)):
    """Upload a CSV file with columns: firstName,lastName,className,section,dateOfBirth,gender,fatherName,phoneNumber"""
    try:
        from firebase_admin import firestore as fs_admin
        db = fs()
        content = await file.read()
        reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
        batch = db.batch()
        count = 0
        errors = []
        existing_count = len(list(db.collection("students").where("tenantId", "==", TENANT_ID).stream()))

        for i, row in enumerate(reader):
            try:
                first = row.get("firstName", "").strip()
                last = row.get("lastName", "").strip()
                if not first or not last:
                    errors.append(f"Row {i+2}: Missing firstName or lastName")
                    continue

                adm_no = row.get("admissionNo", "").strip() or f"STP{str(existing_count + count + 1001).zfill(4)}"
                ref = db.collection("students").document()
                batch.set(ref, {
                    "firstName": first,
                    "lastName": last,
                    "fullName": f"{first} {last}",
                    "admissionNo": adm_no,
                    "className": row.get("className", "").strip(),
                    "section": row.get("section", "A").strip(),
                    "dateOfBirth": row.get("dateOfBirth", "").strip(),
                    "gender": row.get("gender", "").strip(),
                    "fatherName": row.get("fatherName", "").strip(),
                    "phoneNumber": row.get("phoneNumber", "").strip(),
                    "status": "ACTIVE",
                    "tenantId": TENANT_ID,
                    "createdAt": fs_admin.SERVER_TIMESTAMP,
                    "updatedAt": fs_admin.SERVER_TIMESTAMP,
                })
                count += 1
                if count % 400 == 0:   # Firestore batch limit is 500
                    batch.commit()
                    batch = db.batch()
            except Exception as row_err:
                errors.append(f"Row {i+2}: Failed to process row — check required fields.")

        if count % 400 != 0:
            batch.commit()

        return {"imported": count, "errors": errors}
    except Exception as e:
        logger.exception("Bulk import error: %s", e)
        raise HTTPException(status_code=500, detail="Bulk import failed. Please check the CSV format and try again.")

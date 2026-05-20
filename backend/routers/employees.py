"""routers/employees.py — Full CRUD for employees + leave management"""
import os, logging, re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from typing import Optional, List
from middleware.firebase_auth import require_auth, optional_auth

router = APIRouter()
logger = logging.getLogger(__name__)
TENANT_ID = os.environ.get("TENANT_ID", "stpauls")

_VALID_EMP_STATUSES = {"ACTIVE", "INACTIVE"}
_VALID_LEAVE_TYPES  = {"CASUAL", "SICK", "EARNED", "MATERNITY", "PATERNITY"}
_VALID_LEAVE_STATUSES = {"APPROVED", "REJECTED"}


def fs():
    from firebase_admin import firestore
    return firestore.client()


def _validate_phone(v: Optional[str]) -> Optional[str]:
    if not v:
        return v
    digits = re.sub(r"\D", "", v)
    if len(digits) != 10:
        raise ValueError("Phone number must be exactly 10 digits.")
    return digits


def _validate_email(v: Optional[str]) -> Optional[str]:
    if not v:
        return v
    pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
    if not re.match(pattern, v.strip()):
        raise ValueError("Invalid email address format.")
    return v.strip().lower()


def _validate_date(v: Optional[str], field_name: str = "Date") -> Optional[str]:
    if not v:
        return v
    try:
        datetime.strptime(v.strip(), "%Y-%m-%d")
    except ValueError:
        raise ValueError(f"{field_name} must be in YYYY-MM-DD format.")
    return v.strip()


class EmployeeCreate(BaseModel):
    fullName: str
    employeeId: Optional[str] = None
    designation: str
    department: str
    qualification: Optional[str] = ""
    experience: Optional[str] = ""
    dateOfJoining: Optional[str] = ""
    dateOfBirth: Optional[str] = ""
    gender: Optional[str] = ""
    phoneNumber: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    salary: Optional[float] = 0
    bankAccount: Optional[str] = ""
    ifsc: Optional[str] = ""
    status: Optional[str] = "ACTIVE"

    @field_validator("fullName")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Full name cannot be blank.")
        return v.strip()

    @field_validator("phoneNumber", mode="before")
    @classmethod
    def validate_phone(cls, v): return _validate_phone(v)

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, v): return _validate_email(v)

    @field_validator("dateOfBirth", mode="before")
    @classmethod
    def validate_dob(cls, v): return _validate_date(v, "Date of birth")

    @field_validator("dateOfJoining", mode="before")
    @classmethod
    def validate_doj(cls, v): return _validate_date(v, "Date of joining")

    @field_validator("salary", mode="before")
    @classmethod
    def validate_salary(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Salary cannot be negative.")
        return v

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in _VALID_EMP_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(_VALID_EMP_STATUSES))}.")
        return v


class EmployeeUpdate(BaseModel):
    fullName: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    qualification: Optional[str] = None
    phoneNumber: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    salary: Optional[float] = None
    status: Optional[str] = None

    @field_validator("phoneNumber", mode="before")
    @classmethod
    def validate_phone(cls, v): return _validate_phone(v)

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, v): return _validate_email(v)

    @field_validator("salary", mode="before")
    @classmethod
    def validate_salary(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Salary cannot be negative.")
        return v

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in _VALID_EMP_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(_VALID_EMP_STATUSES))}.")
        return v


class LeaveRequest(BaseModel):
    employeeId: str
    employeeName: str
    leaveType: str          # CASUAL | SICK | EARNED | MATERNITY | PATERNITY
    fromDate: str
    toDate: str
    reason: str
    totalDays: Optional[int] = 1

    @field_validator("leaveType")
    @classmethod
    def validate_leave_type(cls, v: str) -> str:
        if v not in _VALID_LEAVE_TYPES:
            raise ValueError(f"Leave type must be one of: {', '.join(sorted(_VALID_LEAVE_TYPES))}.")
        return v

    @field_validator("fromDate", "toDate", mode="before")
    @classmethod
    def validate_dates(cls, v: str) -> str:
        result = _validate_date(v, "Leave date")
        if result is None:
            raise ValueError("Leave date is required.")
        return result

    @field_validator("totalDays", mode="before")
    @classmethod
    def validate_total_days(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 1:
            raise ValueError("Total days must be at least 1.")
        return v


class LeaveStatusUpdate(BaseModel):
    status: str             # APPROVED | REJECTED
    remarks: Optional[str] = ""

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in _VALID_LEAVE_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(_VALID_LEAVE_STATUSES))}.")
        return v


# ─── Employees ────────────────────────────────────────────────────────────────
@router.get("")
async def list_employees(
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    _user=Depends(optional_auth),
):
    try:
        db = fs()
        ref = db.collection("employees").where("tenantId", "==", TENANT_ID)
        if department:
            ref = ref.where("department", "==", department)
        if status:
            ref = ref.where("status", "==", status)
        docs = ref.stream()
        employees = [{"id": d.id, **d.to_dict()} for d in docs]
        return {"employees": employees, "count": len(employees)}
    except Exception as e:
        logger.exception("List employees error: %s", e)
        return {"employees": [], "count": 0, "error": "An error occurred while fetching employees."}


@router.get("/{employee_id}")
async def get_employee(employee_id: str, _user=Depends(optional_auth)):
    try:
        db = fs()
        doc = db.collection("employees").document(employee_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Employee not found")
        return {"id": doc.id, **doc.to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Get employee error: %s", e)
        raise HTTPException(status_code=500, detail="An unexpected error occurred while fetching the employee.")


@router.post("", status_code=201)
async def create_employee(payload: EmployeeCreate, user=Depends(require_auth)):
    try:
        from firebase_admin import firestore as fs_admin
        db = fs()
        # Auto-generate employee ID
        emp_id = payload.employeeId
        if not emp_id:
            count = len(list(db.collection("employees").where("tenantId", "==", TENANT_ID).stream()))
            emp_id = f"EMP{str(count + 1001).zfill(4)}"

        data = payload.dict()
        data["employeeId"] = emp_id
        data["tenantId"] = TENANT_ID
        data["createdAt"] = fs_admin.SERVER_TIMESTAMP
        data["updatedAt"] = fs_admin.SERVER_TIMESTAMP

        ref = db.collection("employees").add(data)
        return {"id": ref[1].id, "employeeId": emp_id, **data}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Create employee error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create employee. Please try again.")


@router.patch("/{employee_id}")
async def update_employee(employee_id: str, payload: EmployeeUpdate, user=Depends(require_auth)):
    try:
        from firebase_admin import firestore as fs_admin
        db = fs()
        patch = {k: v for k, v in payload.dict().items() if v is not None}
        patch["updatedAt"] = fs_admin.SERVER_TIMESTAMP
        db.collection("employees").document(employee_id).update(patch)
        return {"success": True}
    except Exception as e:
        logger.exception("Update employee error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update employee. Please try again.")


@router.delete("/{employee_id}")
async def deactivate_employee(employee_id: str, user=Depends(require_auth)):
    try:
        from firebase_admin import firestore as fs_admin
        db = fs()
        db.collection("employees").document(employee_id).update({
            "status": "INACTIVE",
            "updatedAt": fs_admin.SERVER_TIMESTAMP,
        })
        return {"success": True}
    except Exception as e:
        logger.exception("Deactivate employee error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to deactivate employee. Please try again.")


# ─── Leave Requests ───────────────────────────────────────────────────────────
@router.get("/leave/all")
async def list_leave_requests(
    status: Optional[str] = Query(None),
    employeeId: Optional[str] = Query(None),
    _user=Depends(optional_auth),
):
    try:
        db = fs()
        ref = db.collection("leave_requests").where("tenantId", "==", TENANT_ID)
        if status:
            ref = ref.where("status", "==", status)
        if employeeId:
            ref = ref.where("employeeId", "==", employeeId)
        docs = ref.stream()
        leaves = [{"id": d.id, **d.to_dict()} for d in docs]
        return {"leaveRequests": leaves, "count": len(leaves)}
    except Exception as e:
        logger.exception("List leave requests error: %s", e)
        return {"leaveRequests": [], "count": 0}


@router.post("/leave", status_code=201)
async def submit_leave_request(payload: LeaveRequest, user=Depends(require_auth)):
    try:
        from firebase_admin import firestore as fs_admin
        db = fs()
        data = payload.dict()
        data["tenantId"] = TENANT_ID
        data["status"] = "PENDING"
        data["createdAt"] = fs_admin.SERVER_TIMESTAMP
        ref = db.collection("leave_requests").add(data)
        return {"id": ref[1].id, **data}
    except Exception as e:
        logger.exception("Submit leave request error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to submit leave request. Please try again.")


@router.patch("/leave/{leave_id}")
async def update_leave_status(leave_id: str, payload: LeaveStatusUpdate, user=Depends(require_auth)):
    try:
        from firebase_admin import firestore as fs_admin
        db = fs()
        db.collection("leave_requests").document(leave_id).update({
            "status": payload.status,
            "remarks": payload.remarks,
            "reviewedAt": fs_admin.SERVER_TIMESTAMP,
            "reviewedBy": user.get("email", ""),
        })
        return {"success": True, "status": payload.status}
    except Exception as e:
        logger.exception("Update leave status error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update leave status. Please try again.")

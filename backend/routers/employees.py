"""routers/employees.py — Full CRUD for employees + leave management"""
import os, logging
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from middleware.firebase_auth import require_auth, optional_auth

router = APIRouter()
logger = logging.getLogger(__name__)
TENANT_ID = os.environ.get("TENANT_ID", "stpauls")


def fs():
    from firebase_admin import firestore
    return firestore.client()


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


class LeaveRequest(BaseModel):
    employeeId: str
    employeeName: str
    leaveType: str          # CASUAL | SICK | EARNED | MATERNITY | PATERNITY
    fromDate: str
    toDate: str
    reason: str
    totalDays: Optional[int] = 1


class LeaveStatusUpdate(BaseModel):
    status: str             # APPROVED | REJECTED
    remarks: Optional[str] = ""


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
        return {"employees": [], "count": 0, "error": str(e)}


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
        raise HTTPException(status_code=500, detail=str(e))


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
    except Exception as e:
        logger.exception("Create employee error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))

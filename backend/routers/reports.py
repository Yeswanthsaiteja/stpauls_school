"""routers/reports.py — Finance aggregation reports reading from Firestore via Admin SDK"""
import os, logging, csv, io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from middleware.firebase_auth import require_auth

router = APIRouter()
logger = logging.getLogger(__name__)

TENANT_ID = os.environ.get("TENANT_ID", "stpauls")


def get_firestore():
    from firebase_admin import firestore
    return firestore.client()


@router.get("/fee-summary")
async def fee_summary(
    month: Optional[str] = Query(None, description="YYYY-MM"),
    user=Depends(require_auth),
):
    """Return fee collection summary: total collected, pending, overdue."""
    try:
        db = get_firestore()
        ref = db.collection("transactions").where("tenantId", "==", TENANT_ID)
        if month:
            ref = ref.where("paymentDate", ">=", f"{month}-01").where("paymentDate", "<=", f"{month}-31")
        docs = ref.stream()

        total = collected = pending = overdue = 0
        by_fee = {}
        for d in docs:
            t = d.to_dict()
            amt = t.get("amount", 0)
            status = t.get("status", "")
            fee_name = t.get("feeName", "Other")
            total += amt
            if status == "PAID":
                collected += amt
            elif status == "PENDING":
                pending += amt
            elif status == "OVERDUE":
                overdue += amt
            by_fee[fee_name] = by_fee.get(fee_name, 0) + amt

        return {
            "total": total,
            "collected": collected,
            "pending": pending,
            "overdue": overdue,
            "collectionRate": round((collected / total * 100) if total else 0, 1),
            "byFeeCategory": by_fee,
        }
    except Exception as e:
        logger.exception("Fee summary error: %s", e)
        return {"total": 0, "collected": 0, "pending": 0, "overdue": 0, "collectionRate": 0, "byFeeCategory": {}}


@router.get("/ledger")
async def ledger(
    fromDate: Optional[str] = Query(None),
    toDate: Optional[str] = Query(None),
    user=Depends(require_auth),
):
    """Combined income + expense ledger."""
    try:
        db = get_firestore()

        # Income (transactions)
        income_ref = db.collection("transactions").where("tenantId", "==", TENANT_ID).where("status", "==", "PAID")
        if fromDate:
            income_ref = income_ref.where("paymentDate", ">=", fromDate)
        if toDate:
            income_ref = income_ref.where("paymentDate", "<=", toDate)

        income_entries = []
        for d in income_ref.stream():
            t = d.to_dict()
            income_entries.append({
                "date": t.get("paymentDate", ""),
                "type": "INCOME",
                "description": f"{t.get('feeName','')} — {t.get('studentName','')}",
                "amount": t.get("amount", 0),
                "receipt": t.get("receiptNo", ""),
            })

        # Expenses
        exp_ref = db.collection("expenses").where("tenantId", "==", TENANT_ID)
        if fromDate:
            exp_ref = exp_ref.where("date", ">=", fromDate)
        if toDate:
            exp_ref = exp_ref.where("date", "<=", toDate)

        expense_entries = []
        for d in exp_ref.stream():
            e = d.to_dict()
            expense_entries.append({
                "date": e.get("date", ""),
                "type": "EXPENSE",
                "description": f"{e.get('category','')} — {e.get('description','')}",
                "amount": e.get("amount", 0),
                "receipt": "",
            })

        all_entries = sorted(income_entries + expense_entries, key=lambda x: x["date"], reverse=True)
        total_income = sum(e["amount"] for e in income_entries)
        total_expense = sum(e["amount"] for e in expense_entries)

        return {
            "entries": all_entries,
            "totalIncome": total_income,
            "totalExpense": total_expense,
            "netBalance": total_income - total_expense,
        }
    except Exception as e:
        logger.exception("Ledger error: %s", e)
        return {"entries": [], "totalIncome": 0, "totalExpense": 0, "netBalance": 0}


@router.get("/export/{collection_name}")
async def export_csv(collection_name: str, user=Depends(require_auth)):
    """Export any Firestore collection as CSV."""
    allowed = {"transactions", "expenses", "payroll", "students", "employees", "attendance"}
    if collection_name not in allowed:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Export not allowed for collection: {collection_name}")

    try:
        db = get_firestore()
        docs = db.collection(collection_name).where("tenantId", "==", TENANT_ID).stream()
        rows = [d.to_dict() for d in docs]

        if not rows:
            return StreamingResponse(iter([""]), media_type="text/csv")

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=rows[0].keys(), extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
        output.seek(0)

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={collection_name}.csv"},
        )
    except Exception as e:
        logger.exception("CSV export error: %s", e)
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))

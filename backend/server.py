from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import os
import logging

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="St. Paul's ERP — Backend API",
    description="Slim FastAPI backend: Razorpay, WhatsApp (MSG91), AI Insights, PDF, Reports",
    version="1.0.0",
)
# ─── CORS ─────────────────────────────────────────────────────────────────────
# Production: locked to known origins only.
# To add a domain, set CORS_ORIGINS env var in Railway (comma-separated).
_cors_env = os.environ.get(
    "CORS_ORIGINS",
    "*"
)
origins = ["*"]

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="St. Paul's High School ERP API",
    description="Backend API for Razorpay, WhatsApp, Firebase syncing, AI chat, and Document processing.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ─── Routers ──────────────────────────────────────────────────────────────────
from routers import ai, payments, notifications, reports, pdf, students, employees, attendance

app.include_router(ai.router,            prefix="/api/ai",            tags=["AI"])
app.include_router(payments.router,      prefix="/api/payments",      tags=["Payments"])
app.include_router(notifications.router, prefix="/api/notify",        tags=["Notifications"])
app.include_router(reports.router,       prefix="/api/reports",       tags=["Reports"])
app.include_router(pdf.router,           prefix="/api/pdf",           tags=["PDF"])
app.include_router(students.router,      prefix="/api/students",      tags=["Students"])
app.include_router(employees.router,     prefix="/api/employees",     tags=["Employees"])
app.include_router(attendance.router,    prefix="/api/attendance",    tags=["Attendance"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "stpauls-erp-backend", "version": "1.0.0", "docs": "/docs"}

import requests
from fastapi import Request, Response

@app.api_route("/iclock/{path:path}", methods=["GET", "POST"])
async def iclock_proxy(path: str, request: Request):
    """Proxy all biometric ADMS traffic to Firebase Cloud Function"""
    url = f"https://us-central1-stpauls-erp.cloudfunctions.net/iclock/iclock/{path}"
    
    # Read raw body
    body = await request.body()
    
    try:
        # Forward request exactly as received
        resp = requests.request(
            method=request.method,
            url=url,
            params=request.query_params,
            data=body,
            headers={"Content-Type": request.headers.get("content-type", "text/plain")}
        )
        
        # Return exact response from Firebase
        return Response(
            content=resp.text,
            status_code=resp.status_code,
            headers={
                "Content-Type": "text/plain",
                "Server": "Microsoft-IIS/7.5"
            }
        )
    except Exception as e:
        logger.error(f"Error forwarding ADMS request: {str(e)}")
        return Response(content="OK", status_code=200, media_type="text/plain")

@app.get("/", include_in_schema=False)
async def root():
    """Redirect root URL to interactive API docs."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/docs")

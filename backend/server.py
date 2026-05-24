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
# Set CORS_ORIGINS env var in Railway to restrict to your domains.
# e.g. CORS_ORIGINS=https://your-app.vercel.app,https://your-domain.com
# Leave unset (or use *) to allow all origins during development/testing.
_cors_env = os.environ.get("CORS_ORIGINS", "*")
if _cors_env.strip() == "*":
    origins = ["*"]
else:
    origins = [o.strip() for o in _cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=origins != ["*"],  # credentials only work with specific origins
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
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

@app.get("/", include_in_schema=False)
async def root():
    """Redirect root URL to interactive API docs."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/docs")

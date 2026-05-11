from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Benita ERP API")
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class InsightsRequest(BaseModel):
    tenantName: Optional[str] = "School"
    stats: Dict[str, Any] = {}
    locale: Optional[str] = "en"


class InsightsResponse(BaseModel):
    insights: List[str]
    generated: bool = True


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Benita ERP API", "status": "ok"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.model_dump())
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    rows = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for r in rows:
        if isinstance(r.get('timestamp'), str):
            r['timestamp'] = datetime.fromisoformat(r['timestamp'])
    return rows


@api_router.post("/ai/insights", response_model=InsightsResponse)
async def ai_insights(payload: InsightsRequest):
    """Generate 3 short, actionable AI insights for the school dashboard."""
    fallback = [
        "Attendance trending steady — consider weekly recognition for high-performing classes.",
        "Outstanding fees concentrated in upper grades; schedule WhatsApp reminders this week.",
        "Strong admission momentum this month — capture testimonials from new parents.",
    ]
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            return InsightsResponse(insights=fallback, generated=False)

        lang = "Telugu" if (payload.locale or "en").startswith("te") else "English"
        sys_msg = (
            f"You are a senior school operations consultant. Produce concise, "
            f"actionable insights in {lang}. Output ONLY a JSON array of exactly 3 short "
            f"strings (max 18 words each). No preamble, no markdown."
        )
        chat = LlmChat(
            api_key=api_key,
            session_id=f"insights-{uuid.uuid4()}",
            system_message=sys_msg,
        ).with_model("gemini", "gemini-3-flash-preview")

        user_text = (
            f"School: {payload.tenantName}\n"
            f"Stats: {payload.stats}\n"
            f"Return a JSON array of 3 insights tailored to these numbers."
        )
        response = await chat.send_message(UserMessage(text=user_text))

        import json, re
        text = (response or "").strip()
        # extract JSON array
        m = re.search(r"\[.*\]", text, re.DOTALL)
        if m:
            arr = json.loads(m.group(0))
            arr = [str(x).strip() for x in arr if str(x).strip()][:3]
            if len(arr) >= 3:
                return InsightsResponse(insights=arr, generated=True)
        # fallback split lines
        lines = [ln.strip("-• ").strip() for ln in text.split("\n") if ln.strip()][:3]
        if len(lines) >= 3:
            return InsightsResponse(insights=lines, generated=True)
        return InsightsResponse(insights=fallback, generated=False)
    except Exception as e:
        logging.exception("AI insights error: %s", e)
        return InsightsResponse(insights=fallback, generated=False)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

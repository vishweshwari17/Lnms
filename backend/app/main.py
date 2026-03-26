import asyncio
import logging
from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from app.services.ws_manager import ws_manager
from app.database import Base, drop_legacy_alarm_trigger, engine, SessionLocal
from app.models.alarms import Alarm
from app.models.tickets import Ticket

from app.services.lnms_ticket import create_lnms_tickets
from app.routers.tickets import sync_missed_tickets

from app.routers import (
    alarms, tickets, incidents, correlated_alarms,
    major_incidents, sla, admin, audit_logs, highrisk,
    integration, status_alarms, devices, escalation,
)

from fastapi import APIRouter

app = FastAPI(title="LNMS Backend")
logger = logging.getLogger("lnms.backend")

# ── CORS — must be registered before any routers ────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Database ─────────────────────────────────────────────────────────────────
try:
    drop_legacy_alarm_trigger()
    Base.metadata.create_all(bind=engine)
except OperationalError as exc:
    logger.warning("Database unavailable during startup: %s", exc)


@app.exception_handler(OperationalError)
async def operational_error_handler(request: Request, exc: OperationalError):
    logger.error("Database connection error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Database unavailable. Please make sure MySQL is running on 127.0.0.1:7776 and try again."
        },
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError):
    logger.error("Database error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Database operation failed."},
    )

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(admin.router)
app.include_router(alarms.router)
app.include_router(tickets.router)
app.include_router(incidents.router)
app.include_router(correlated_alarms.router)
app.include_router(major_incidents.router)
app.include_router(sla.router)
app.include_router(audit_logs.router)
app.include_router(highrisk.router)
app.include_router(integration.router)
app.include_router(status_alarms.router)
app.include_router(devices.router)
app.include_router(escalation.router)

# ── Dashboard stats router ───────────────────────────────────────────────────
dashboard_router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@dashboard_router.get("/stats")
def get_dashboard_stats():
    db = SessionLocal()
    try:
        return {
            "total_alarms":  db.query(Alarm).count(),
            "total_tickets": db.query(Ticket).count(),
            "open_tickets":  db.query(Ticket).filter(Ticket.status != "Closed").count(),
        }
    finally:
        db.close()

app.include_router(dashboard_router)

# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}

# ── WebSocket: live alarm feed ────────────────────────────────────────────────
clients = []

@app.websocket("/ws/alarms")
async def websocket_alarms(websocket: WebSocket):
    await websocket.accept()
    clients.append(websocket)
    try:
        while True:
            await asyncio.sleep(2)
            await websocket.send_json({
                "device_name": "Cisco-ASR1001",
                "severity":    "Critical",
                "alarm_name":  "Interface Down",
                "problem_time": None,
                "created_at":   None,
            })
    except Exception:
        if websocket in clients:
            clients.remove(websocket)

# ── WebSocket: general ws_manager ────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except Exception:
        ws_manager.disconnect(ws)

# ── Background scheduler: alarm automation ───────────────────────────────────
scheduler = BackgroundScheduler()

def alarm_engine_job():
    print("[ENGINE] -- Cycle start --")
    try:
        create_lnms_tickets()
        asyncio.run(sync_missed_tickets())
        print("[ENGINE] -- Cycle complete --")
    except Exception as e:
        print(f"[ENGINE] Job failed: {e}")

scheduler.add_job(alarm_engine_job, "interval", seconds=30)
scheduler.start()

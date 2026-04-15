import asyncio
import logging
from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy import text

from app.services.ws_manager import ws_manager
from app.database import Base, drop_legacy_alarm_trigger, engine, engine2, SessionLocal
from app.models.alarms import Alarm
from app.models.tickets import Ticket

from app.services.lnms_ticket import create_lnms_tickets
from app.services.spicnms_ticket import create_spicnms_tickets
from app.services.cnms_sync import sync_missed_tickets

from app.routers import (
    alarms, tickets, incidents, correlated_alarms,
    major_incidents, sla, audit_logs, highrisk,
    integration, devices, escalation, chatbot,
    diagnostics, neighbors, metrics, admin

)

from fastapi import APIRouter

app = FastAPI(title="LNMS Backend")
logger = logging.getLogger("lnms.backend")

# ── CORS — must be registered before any routers ────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins to resolve connectivity issues across hostnames
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Database ─────────────────────────────────────────────────────────────────
try:
    drop_legacy_alarm_trigger()
    Base.metadata.create_all(bind=engine)
    Base.metadata.create_all(bind=engine2)
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
app.include_router(alarms.router, prefix="/api")
app.include_router(tickets.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(correlated_alarms.router, prefix="/api")
app.include_router(major_incidents.router, prefix="/api")
app.include_router(sla.router, prefix="/api")
app.include_router(audit_logs.router, prefix="/api")
app.include_router(highrisk.router, prefix="/api")
app.include_router(integration.router, prefix="/api")
app.include_router(devices.router, prefix="/api")
app.include_router(escalation.router, prefix="/api")
app.include_router(chatbot.router, prefix="/api")
app.include_router(diagnostics.router, prefix="/api")
app.include_router(neighbors.router, prefix="/api")
app.include_router(metrics.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


# ── Dashboard stats router ───────────────────────────────────────────────────
dashboard_router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@dashboard_router.get("/stats")
def get_dashboard_stats():
    db = SessionLocal()
    try:
        return {
            "total_alarms":  db.query(Alarm).count(),
            "total_tickets": db.query(Ticket).count(),
            "open_tickets":  db.query(Ticket).filter(Ticket.status.in_(["OPEN", "ACK", "Open", "Ack"])).count(),
            "resolved_tickets": db.query(Ticket).filter(Ticket.status.in_(["RESOLVED", "CLOSED", "Resolved", "Closed"])).count(),
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

from fastapi import WebSocketDisconnect

@app.websocket("/ws/alarms")
async def websocket_alarms(websocket: WebSocket):
    await websocket.accept()
    clients.append(websocket)
    try:
        while True:
            db = SessionLocal()
            try:
                from sqlalchemy import text
                result = db.execute(text("""
                    SELECT * FROM alarms 
                    WHERE status IN ('active', 'new', 'OPEN', 'PENDING') 
                    ORDER BY created_at DESC 
                    LIMIT 10
                """))
                rows = result.fetchall()
                
                alarms_list = []
                for alarm in rows:
                    alarms_list.append({
                        "id": alarm[0],
                        "alarm_id": alarm[1],
                        "device_name": alarm[2],
                        "host_name": alarm[3],
                        "severity": alarm[5],
                        "alarm_name": alarm[6],
                        "status": alarm[7],
                        "created_at": str(alarm[9])
                    })
                
                data = {"type": "ALARM_UPDATE", "alarms": alarms_list}
                await websocket.send_json(data)
            except (WebSocketDisconnect, RuntimeError):
                break
            except Exception as e:
                logger.error(f"Error in alarm websocket query: {e}")
            finally:
                db.close()
                
            await asyncio.sleep(10)
    finally:
        if websocket in clients:
            clients.remove(websocket)
        try:
            await websocket.close()
        except:
            pass

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
        from app.services import alarm_to_ticket
        
        async def _run_async_jobs():
            await alarm_to_ticket.process_all_alarms()
            await sync_missed_tickets()

        asyncio.run(_run_async_jobs())
        print("[ENGINE] -- Cycle complete --")
    except Exception as e:
        print(f"[ENGINE] Job failed: {e}")

scheduler.add_job(alarm_engine_job, "interval", seconds=30)
scheduler.start()

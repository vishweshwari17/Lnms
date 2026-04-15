from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from datetime import datetime
import logging
import json

from app.database import get_lnms_db
from app.models import Alarm
from app.models.audit_logs import AuditLog
from app.schemas import AlarmCreate, AlarmResponse, AlarmStatusUpdate
from app.services import ticket_service

router = APIRouter(prefix="/alarms", tags=["Alarms"])

logger = logging.getLogger(__name__)


# =========================================================
# UTILITY FUNCTIONS
# =========================================================

def normalize_severity(severity: str):
    if not severity:
        return "Minor"

    severity = severity.lower()

    mapping = {
        "critical": "Critical",
        "major": "Major",
        "minor": "Minor",
        "warning": "Warning"
    }

    return mapping.get(severity, "Minor")


def normalize_status(status: str):
    if not status:
        return "Open"

    status = status.lower()

    mapping = {
        "open": "OPEN",
        "ack": "ACK",
        "acknowledged": "ACK",
        "resolved": "RESOLVED",
        "closed": "CLOSED"
    }

    return mapping.get(status, "OPEN")


def parse_parameter_data(value):
    if not value:
        return {}

    if isinstance(value, dict):
        return value

    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return {}

    return {}


# =========================================================
# GET ALL ALARMS  — lnms_db ONLY
# =========================================================

@router.get("/", response_model=dict)
def get_alarms(
    db_lnms: Session = Depends(get_lnms_db),
    start_date: str = None,
    end_date: str = None,
    device_id: int = None,
    device_name: str = None,
    page: int = 1,
    limit: int = 25
):
    """Return alarms with filtering and pagination."""
    try:
        lnms_query = db_lnms.query(Alarm)
        
        if device_id:
            from app.models.devices import Device
            device = db_lnms.query(Device).filter(Device.id == device_id).first()
            if device:
                lnms_query = lnms_query.filter(Alarm.ip_address == device.ip_address)
        
        if device_name:
            lnms_query = lnms_query.filter(Alarm.device_name.ilike(f"%{device_name}%"))

        if start_date:
            lnms_query = lnms_query.filter(Alarm.created_at >= start_date)
        if end_date:
            lnms_query = lnms_query.filter(Alarm.created_at <= end_date)
        
        total = lnms_query.count()
        lnms_alarms = lnms_query.order_by(Alarm.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
        
        # Format
        formatted_alarms = []
        
        for a in lnms_alarms:
            # Check if ticket exists to provide ticket_id
            from app.models.tickets import Ticket
            ticket = db_lnms.query(Ticket).filter(Ticket.alarm_id == a.alarm_id).first()
            
            formatted_alarms.append({
                "alarm_id": f"LNMS-{a.alarm_id}",
                "real_id": a.alarm_id,
                "device_name": a.device_name,
                "host_name": a.host_name,
                "ip_address": a.ip_address,
                "severity": normalize_severity(a.severity),
                "alarm_name": a.alarm_name,
                "status": normalize_status(a.status),
                "parameter_data": parse_parameter_data(a.parameter_data),
                "created_at": a.created_at,
                "source": "LNMS",
                "ticket_created": a.ticket_created,
                "ticket_id": ticket.ticket_id if ticket else None
            })

        return {
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit,
            "alarms": formatted_alarms
        }

    except Exception as e:
        logger.error(f"Error fetching LNMS alarms: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch alarms")


# =========================================================
# CREATE ALARM  — stores into lnms_db
# =========================================================

@router.post("/", response_model=AlarmResponse)
def create_alarm(alarm: AlarmCreate, db: Session = Depends(get_lnms_db)):

    try:
        if isinstance(alarm.parameter_data, dict):
            param_data = alarm.parameter_data or None
        else:
            param_data = alarm.parameter_data or None

        db_alarm = Alarm(
            host_name=alarm.host_name or "Unknown",
            device_name=alarm.device_name or "Unknown",
            ip_address=alarm.ip_address or "N/A",
            severity=normalize_severity(alarm.severity),
            alarm_name=alarm.alarm_name,
            description=alarm.description,
            parameter_data=param_data,
            problem_time=alarm.problem_time,
            status="Open",
            created_at=datetime.utcnow(),
            ticket_created=False,
        )

        db.add(db_alarm)
        db.commit()
        db.refresh(db_alarm)

        logger.info(f"Alarm {db_alarm.alarm_id} saved to lnms_db — ticket engine picks up within 30s")
        return db_alarm

    except OperationalError:
        db.rollback()
        logger.error("Alarm create failed: lnms_db unavailable", exc_info=True)
        raise HTTPException(status_code=503, detail="Alarm database unavailable")
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating alarm: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create alarm")


# =========================================================
# CORRELATED ALARMS (placeholder)
# =========================================================

@router.get("/correlated-alarms")
def get_correlated_alarms():

    return [
        {
            "root_alarm": "Router Down",
            "correlated_count": 12
        }
    ]

# =========================================================
# UPDATE ALARM STATUS (Direct UI action — lnms_db only)
# =========================================================

@router.put("/{alarm_id}/status")
async def update_alarm_status_route(alarm_id: str, payload: AlarmStatusUpdate, db: Session = Depends(get_lnms_db)):
    """Update alarm status in lnms_db. Also called automatically when a ticket status changes."""
    try:
        new_status = normalize_status(payload.status).upper()
        # 1. Determine REAL ID and SOURCE
        real_id = str(alarm_id).replace("LNMS-", "").replace("SPIC-", "")
        source = "SPIC" if "SPIC-" in str(alarm_id) else "LNMS"

        if source == "SPIC":
            from app.database import SessionLocal2
            db_spic = SessionLocal2()
            try:
                spic_status = "RESOLVED" if new_status in ["RESOLVED", "CLOSED"] else "ACTIVE" if new_status == "ACK" else "PROBLEM"
                db_spic.execute(text("UPDATE status_alarms SET status=:st WHERE id=:aid"), {"st": spic_status, "aid": real_id})
                db_spic.commit()
            finally:
                db_spic.close()
        
        # 2. Update Ticket if exists (which updates LNMS alarm too)
        from app.models.tickets import Ticket
        ticket = db.query(Ticket).filter(Ticket.alarm_id == real_id).first()
        
        if ticket:
            await ticket_service.update_ticket_status(db, ticket.ticket_id, new_status, last_updated_by="USER")
        elif source == "LNMS":
            alarm = db.query(Alarm).filter(Alarm.alarm_id == real_id).first()
            if not alarm:
                raise HTTPException(status_code=404, detail=f"Alarm {alarm_id} not found")
            alarm.status = new_status
            if new_status in ("RESOLVED", "CLOSED"):
                alarm.resolved_time = datetime.utcnow()
            db.commit()

        # Audit Logger
        audit = AuditLog(
            user_name="System/Admin",
            action=f"Changed Alarm Status to {new_status}",
            entity_type="Alarm",
            entity_id=int(real_id) if real_id.isdigit() else 0
        )
        db.add(audit)
        db.commit()

        logger.info(f"Alarm {alarm_id} status updated to '{new_status}'")
        return {"message": "Alarm status updated", "status": new_status, "source": source}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating alarm status: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update alarm status")

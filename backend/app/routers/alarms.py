from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from datetime import datetime
import logging
import json

from app.database import get_lnms_db
from app.models import Alarm
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

@router.get("/", response_model=list[AlarmResponse])
def get_alarms(db_lnms: Session = Depends(get_lnms_db)):
    """Return alarms from BOTH lnms_db and snmp_monitor."""
    from app.database import SessionLocal2
    from app.models.status_alarms import StatusAlarm

    db_spic = SessionLocal2()
    try:
        # 1. Fetch from LNMS DB
        lnms_alarms = db_lnms.query(Alarm).all()
        for a in lnms_alarms:
            a.source = "LNMS"
            a.parameter_data = parse_parameter_data(a.parameter_data)
            a.severity = normalize_severity(a.severity)
            a.status = normalize_status(a.status)
            a.alarm_id = f"LNMS-{a.alarm_id}"

        # 2. Fetch from SPIC DB (snmp_monitor)
        spic_alarms = db_spic.query(StatusAlarm).all()
        converted_spic = []
        for s in spic_alarms:
            converted_spic.append({
                "alarm_id": f"SPIC-{s.id}",
                "device_name": s.device_name,
                "severity": normalize_severity(s.severity),
                "alarm_name": s.alarm_type or "SPIC Alarm",
                "status": normalize_status(s.status),
                "created_at": s.timestamp or s.created_at,
                "source": "SPIC",
                "host_name": "Unknown",
                "ip_address": "N/A"
            })

        # Convert LNMS models to dicts/objects with source
        final_lnms = []
        for a in lnms_alarms:
            final_lnms.append({
                "alarm_id": f"LNMS-{a.alarm_id}",
                "device_name": a.device_name,
                "host_name": a.host_name,
                "ip_address": a.ip_address,
                "severity": normalize_severity(a.severity),
                "alarm_name": a.alarm_name,
                "status": normalize_status(a.status),
                "parameter_data": parse_parameter_data(a.parameter_data),
                "created_at": a.created_at,
                "source": "LNMS",
                "ticket_created": a.ticket_created
            })

        return final_lnms + converted_spic

    except Exception as e:
        logger.error(f"Error fetching unified alarms: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch alarms")
    finally:
        db_spic.close()


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

        logger.info(f"Alarm {alarm_id} status updated to '{new_status}'")
        return {"message": "Alarm status updated", "status": new_status, "source": source}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating alarm status: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update alarm status")

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from datetime import datetime
import logging
import json

from app.database import get_db
from app.models import Alarm
from app.schemas import AlarmCreate, AlarmResponse, AlarmStatusUpdate

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
        "open": "Open",
        "ack": "Ack",
        "acknowledged": "Ack",
        "resolved": "Resolved",
        "closed": "Resolved"
    }

    return mapping.get(status, "Open")


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
# GET ALL ALARMS
# =========================================================

@router.get("/", response_model=list[AlarmResponse])
def get_alarms(db: Session = Depends(get_db)):
    try:
        logger.info("Fetching alarms from database...")

        # 1. Fetch LNMS alarms
        lnms_alarms_db = db.query(Alarm).order_by(Alarm.alarm_id.desc()).all()
        final_alarms = []

        for alarm in lnms_alarms_db:
            alarm.parameter_data = parse_parameter_data(alarm.parameter_data)
            alarm.severity = normalize_severity(alarm.severity)
            alarm.status = normalize_status(alarm.status)
            alarm.host_name = alarm.host_name or "Unknown"
            alarm.device_name = alarm.device_name or "Unknown"
            alarm.ip_address = alarm.ip_address or "N/A"
            alarm_name_lower = (alarm.alarm_name or "").lower()
            alarm.alarm_type = "ICMP" if "ping" in alarm_name_lower or "icmp" in alarm_name_lower else "SNMP"
            alarm.source = "LNMS"
            alarm.alarm_id = f"LNMS-{alarm.alarm_id}"
            
            final_alarms.append(alarm)

        # 2. Fetch SPIC-NMS alarms
        from app.database import SessionLocal2
        from app.models.status_alarms import StatusAlarm
        db2 = SessionLocal2()
        try:
            spic_alarms_db = db2.query(StatusAlarm).order_by(StatusAlarm.id.desc()).all()
            for sa in spic_alarms_db:
                # Build an object mimicking AlarmResponse
                spic_obj = {
                    "alarm_id": f"SPIC-{sa.id}",
                    "source": "SPIC-NMS",
                    "host_name": sa.device_name or "Unknown",
                    "device_name": sa.device_name or "Unknown",
                    "ip_address": "N/A",
                    "severity": normalize_severity(sa.severity),
                    "alarm_name": "SPIC Alert",
                    "description": f"Imported SPIC-NMS Alarm ({sa.alarm_type})",
                    "parameter_data": {},
                    "problem_time": sa.start_time or sa.timestamp or sa.created_at,
                    "status": "Resolved" if sa.status == "RESOLVED" else "Open",
                    "ticket_created": False,
                    "alarm_type": sa.alarm_type or "SNMP",
                    "created_at": sa.created_at or sa.timestamp,
                    "resolved_at": sa.resolved_at
                }
                final_alarms.append(spic_obj)
        finally:
            db2.close()

        logger.info(f"Found {len(final_alarms)} alarms total")

        return final_alarms

    except Exception as e:
        logger.error(f"Error fetching alarms: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch alarms")


# =========================================================
# CREATE ALARM
# =========================================================

@router.post("/", response_model=AlarmResponse)
def create_alarm(alarm: AlarmCreate, db: Session = Depends(get_db)):

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

        logger.info(f"Alarm {db_alarm.alarm_id} saved - ticket engine picks up within 30s")
        return db_alarm

    except OperationalError:
        db.rollback()
        logger.error("Alarm create failed: source database unavailable", exc_info=True)
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
# UPDATE ALARM STATUS (Direct UI action)
# =========================================================

@router.put("/{alarm_id}/status")
def update_alarm_status(alarm_id: str, payload: AlarmStatusUpdate, db: Session = Depends(get_db)):
    try:
        new_status = normalize_status(payload.status)
        is_resolved = new_status in ("Resolved", "Closed")

        if str(alarm_id).startswith("SPIC-"):
            real_id = int(str(alarm_id).replace("SPIC-", ""))
            from app.database import SessionLocal2
            from app.models.status_alarms import StatusAlarm
            db2 = SessionLocal2()
            try:
                sa = db2.query(StatusAlarm).filter(StatusAlarm.id == real_id).first()
                if not sa:
                    raise HTTPException(status_code=404, detail="SPIC Alarm not found")
                sa.status = "RESOLVED" if is_resolved else "PROBLEM"
                if is_resolved:
                    sa.resolved_at = datetime.utcnow()
                db2.commit()
            finally:
                db2.close()
        else:
            real_id = str(alarm_id).replace("LNMS-", "")
            alarm = db.query(Alarm).filter(Alarm.alarm_id == real_id).first()
            if not alarm:
                raise HTTPException(status_code=404, detail="LNMS Alarm not found")
            
            alarm.status = new_status
            if is_resolved:
                alarm.resolved_time = datetime.utcnow()
            db.commit()
            db.refresh(alarm)
        
        return {"message": "Alarm status updated", "status": new_status}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating alarm status: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update alarm status")

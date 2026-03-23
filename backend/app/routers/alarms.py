from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import logging
import json

from app.database import get_db
from app.models import Alarm
from app.schemas import AlarmCreate, AlarmResponse

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

        alarms = db.query(Alarm).order_by(Alarm.alarm_id.asc()).all()

        for alarm in alarms:

            # Fix JSON field
            alarm.parameter_data = parse_parameter_data(alarm.parameter_data)

            # Normalize severity
            alarm.severity = normalize_severity(alarm.severity)

            # Normalize status
            alarm.status = normalize_status(alarm.status)

            # Prevent NULL fields breaking frontend
            alarm.host_name = alarm.host_name or "Unknown"
            alarm.device_name = alarm.device_name or "Unknown"
            alarm.ip_address = alarm.ip_address or "N/A"

        logger.info(f"Found {len(alarms)} alarms")

        return alarms

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

    except Exception as e:
        db.rollback()
        logger.error(f"Error creating alarm: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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
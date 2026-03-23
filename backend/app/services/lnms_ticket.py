from datetime import datetime
import uuid

from sqlalchemy import or_

from app.database import SessionLocal, SessionLocal2
from app.models.alarms import Alarm
from app.models.tickets import Ticket

PRIORITY_MAP = {
    "Critical": "P1",
    "Major": "P2",
    "Minor": "P3",
    "Warning": "P4",
}

ACTIVE_STATUSES = ("OPEN", "Open", "ACK", "Ack")


def _ticket_payload(alarm):
    severity = alarm.severity or "Minor"
    return {
        "ticket_id": str(uuid.uuid4()),
        "alarm_id": alarm.alarm_id,
        "title": alarm.alarm_name or "Unknown Alarm",
        "device_name": alarm.device_name,
        "host_name": alarm.host_name,
        "ip_address": alarm.ip_address,
        "severity_original": severity,
        "severity_calculated": severity,
        "priority_level": PRIORITY_MAP.get(severity, "P3"),
        "status": "OPEN",
        "occurrence_count": 1,
        "reopen_count": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }


def create_lnms_tickets():
    db1 = SessionLocal()
    db2 = SessionLocal2()
    created = []

    try:
        alarms = db2.query(Alarm).filter(
            Alarm.status == "Open",
            or_(Alarm.ticket_created == False, Alarm.ticket_created.is_(None)),
        ).all()

        for alarm in alarms:
            existing = db1.query(Ticket).filter(
                Ticket.alarm_id == alarm.alarm_id,
                Ticket.device_name == alarm.device_name,
                Ticket.status.in_(ACTIVE_STATUSES),
            ).first()

            if existing:
                alarm.ticket_created = True
                continue

            payload = _ticket_payload(alarm)
            ticket = Ticket(**payload)
            db1.add(ticket)
            alarm.ticket_created = True
            created.append(payload)

        db1.commit()
        db2.commit()
        return created

    except Exception:
        db1.rollback()
        db2.rollback()
        raise
    finally:
        db1.close()
        db2.close()

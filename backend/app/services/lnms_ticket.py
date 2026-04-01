from datetime import datetime

from sqlalchemy import func

from app.database import SessionLocal, SessionLocal2
from app.models.alarms import Alarm
from app.models.tickets import Ticket

PRIORITY_MAP = {
    "Critical": "P1",
    "Major": "P2",
    "Minor": "P3",
    "Warning": "P4",
}

SOURCE_OPEN_STATUSES = ("open", "ack")
DB_OPEN_STATUS = "Open"


def _build_global_ticket_id(alarm):
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    alarm_part = str(alarm.alarm_id) if alarm.alarm_id is not None else "NA"
    return f"TKT-{alarm_part}-{timestamp}"


def _ticket_payload(alarm):
    ticket_id = _build_global_ticket_id(alarm)
    severity = alarm.severity or "Minor"
    return {
        "ticket_id": ticket_id,
        "global_ticket_id": ticket_id,
        "alarm_id": alarm.alarm_id,
        "title": alarm.alarm_name or "Unknown Alarm",
        "device_name": alarm.device_name,
        "host_name": alarm.host_name,
        "ip_address": alarm.ip_address,
        "severity_original": severity,
        "severity_calculated": severity,
        "priority_level": PRIORITY_MAP.get(severity, "P3"),
        "status": DB_OPEN_STATUS,
        "occurrence_count": 1,
        "reopen_count": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "last_updated_by": "LNMS",
        "sync_version": 1,
        "sync_status": "pending",
    }


def create_lnms_tickets():
    db1 = SessionLocal()  # lnms_db
    created = []

    try:
        existing_alarm_ids = {
            alarm_id
            for (alarm_id,) in db1.query(Ticket.alarm_id).filter(
                Ticket.alarm_id.is_not(None),
                Ticket.lnms_node_id == "LNMS-LOCAL-01"
            ).all()
        }
        alarms = db1.query(Alarm).filter(
            func.lower(Alarm.status).in_(SOURCE_OPEN_STATUSES),
        ).all()

        for alarm in alarms:
            if alarm.alarm_id in existing_alarm_ids:
                if not alarm.ticket_created:
                    alarm.ticket_created = True
                continue

            payload = _ticket_payload(alarm)
            payload["lnms_node_id"] = "LNMS-LOCAL-01"
            ticket = Ticket(**payload)
            db1.add(ticket)
            alarm.ticket_created = True
            created.append(ticket)
            existing_alarm_ids.add(alarm.alarm_id)

        db1.commit()
        
        if created:
            from app.routers.tickets import send_ticket_to_cnms
            import asyncio
            for new_ticket in created:
                try:
                    asyncio.run(send_ticket_to_cnms(new_ticket))
                except Exception as e:
                    print(f"Failed to auto-forward LNMS ticket to CNMS: {e}")

        return [t.ticket_id for t in created]

    except Exception:
        db1.rollback()
        raise
    finally:
        db1.close()

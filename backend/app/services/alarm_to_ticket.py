import logging
import asyncio
from datetime import datetime
from sqlalchemy import text, func, cast, Integer
from app.database import SessionLocal, SessionLocal2
from app.models.alarms import Alarm
from app.models.tickets import Ticket
from app.models.status_alarms import StatusAlarm
from app.models.status_tickets import StatusTicket

logger = logging.getLogger("lnms.alarm_to_ticket")

PRIORITY_MAP = {
    "Critical": "P1",
    "Major": "P2",
    "Minor": "P3",
    "Warning": "P4",
}

LNMS_NODE_ID = "local-company-01"

def _build_ticket_id():
    return f"TKT-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"

def _build_correlation_id(alarm_id, source="LNMS"):
    return f"{source}-ALM-{alarm_id}"

async def process_all_alarms():
    """Entry point to process alarms from both databases."""
    await process_lnms_alarms()
    await process_spic_alarms()
    await sync_resolutions_from_sources()

async def sync_resolutions_from_sources():
    """
    Checks if source alarms are resolved and updates corresponding tickets.
    This handles 'Manual' resolutions in the LNMS or SPIC source databases.
    """
    db_lnms = SessionLocal()
    db_spic = SessionLocal2()
    try:
        # 1. Sync LNMS Alarm Resolutions
        open_lnms_tickets = db_lnms.query(Ticket).filter(
            Ticket.status.in_(["Open", "Ack"]),
            Ticket.lnms_node_id == LNMS_NODE_ID,
            Ticket.alarm_id != None
        ).all()

        from app.services.ticket_service import update_ticket_status

        for ticket in open_lnms_tickets:
            alarm = db_lnms.query(Alarm).filter(Alarm.alarm_id == ticket.alarm_id).first()
            if alarm and alarm.status.upper() == "RESOLVED":
                logger.info(f"Auto-resolving ticket {ticket.ticket_id} as LNMS alarm {alarm.alarm_id} was resolved")
                await update_ticket_status(
                    db_lnms, 
                    ticket.ticket_id, 
                    "RESOLVED", 
                    resolution_note="Resolved by LNMS (Source Alarm)", 
                    last_updated_by="LNMS"
                )

        # 2. Sync SPIC-NMS Alarm Resolutions
        from app.models.status_tickets import StatusTicket
        open_spic_tickets = db_spic.query(StatusTicket).filter(
            StatusTicket.status.in_(["Open", "Acknowledged"]),
            StatusTicket.alarm_id != None
        ).all()

        from app.services.cnms_sync import push_spic_status_to_cnms

        for ticket in open_spic_tickets:
            alarm = db_spic.query(StatusAlarm).filter(StatusAlarm.id == ticket.alarm_id).first()
            if alarm and alarm.status.upper() == "RESOLVED":
                logger.info(f"Auto-resolving SPIC ticket {ticket.unique_ticket_id} as alarm {alarm.id} was resolved")
                # Update local SPIC ticket
                ticket.status = "Closed"
                ticket.resolution = "Resolved by SPIC-NMS (Source Alarm)"
                ticket.updated_at = datetime.utcnow()
                db_spic.commit()
                
                # Push to CNMS
                await push_spic_status_to_cnms(ticket.unique_ticket_id)

    except Exception as e:
        logger.error(f"Error syncing resolutions: {e}")
    finally:
        db_lnms.close()
        db_spic.close()

async def process_lnms_alarms():
    db = SessionLocal()
    try:
        # Fetch open alarms that haven't been ticketed
        alarms = db.query(Alarm).filter(
            func.lower(Alarm.status).in_(["open", "ack", "active"]),
            (Alarm.ticket_created == 0) | (Alarm.ticket_created == None)
        ).all()

        for alarm in alarms:
            correlation_id = _build_correlation_id(alarm.alarm_id, "LNMS")
            
            # Strict double check: ensure no ticket with this correlation_id or alarm_id exists
            existing = db.query(Ticket).filter(
                (Ticket.correlation_id == correlation_id) | 
                (Ticket.alarm_id == alarm.alarm_id)
            ).first()

            if existing:
                alarm.ticket_created = True
                continue

            # Create Ticket
            severity = alarm.severity or "Minor"
            tid = _build_ticket_id()
            new_ticket = Ticket(
                ticket_id = tid,
                alarm_id = alarm.alarm_id,
                correlation_id = correlation_id,
                title = alarm.alarm_name or "LNMS Alarm",
                device_name = alarm.device_name,
                host_name = alarm.host_name,
                ip_address = alarm.ip_address,
                severity_original = severity,
                severity_calculated = severity,
                priority_level = PRIORITY_MAP.get(severity, "P3"),
                status = "Open",
                lnms_node_id = LNMS_NODE_ID,
                created_at = datetime.utcnow(),
                updated_at = datetime.utcnow(),
                sync_status = "pending",
                last_updated_by = "SYSTEM",
                global_ticket_id = tid
            )
            # AI classification & Priority prediction
            from app.services.ai_service import classify_ticket, predict_priority
            from app.services.notification_service import send_mobile_notification
            
            new_ticket.category = classify_ticket(new_ticket.title, "")
            new_ticket.priority_level = predict_priority(new_ticket.lnms_node_id or "LNMS", new_ticket.severity_calculated)

            db.add(new_ticket)
            alarm.ticket_created = True
            db.commit()
            
            # Mobile notifications for critical items
            if new_ticket.priority_level in ["P1", "P2"]:
                asyncio.create_task(send_mobile_notification(new_ticket.ticket_id, new_ticket.title, new_ticket.priority_level))

            # Send to CNMS
            from app.services.cnms_sync import send_ticket_to_cnms
            try:
                await send_ticket_to_cnms(new_ticket.ticket_id)
            except Exception as e:
                logger.error(f"Failed to trigger CNMS sync for {new_ticket.ticket_id}: {e}")

            logger.info(f"Created ticket {new_ticket.ticket_id} for LNMS alarm {alarm.alarm_id}")
    except Exception as e:
        db.rollback()
        logger.error(f"Error processing LNMS alarms: {e}")
    finally:
        db.close()

async def process_spic_alarms():
    db_lnms = SessionLocal()
    db_spic = SessionLocal2()
    try:
        # Fetch open alarms from snmp_monitor
        alarms = db_spic.query(StatusAlarm).filter(
            func.lower(StatusAlarm.status).in_(["problem", "active"])
        ).all()

        for alarm in alarms:
            correlation_id = _build_correlation_id(alarm.id, "SPIC")
            
            # Check if ticket already exists in SPIC db instead of LNMS db
            existing = db_spic.query(StatusTicket).filter(
                StatusTicket.alarm_id == alarm.id
            ).first()

            if existing:
                continue

            # Calculate next unique_ticket_id (TKTxxxxxxx)
            # Find the max numeric part of existing 'TKT...' unique IDs
            try:
                max_serial_str = db_spic.query(func.max(func.substring(StatusTicket.unique_ticket_id, 4))).filter(StatusTicket.unique_ticket_id.like('TKT%')).scalar()
                max_serial = int(max_serial_str) if max_serial_str and str(max_serial_str).isdigit() else 0
                if max_serial < 20260000: # Reset or handle legacy
                    max_serial = 20260000
            except Exception:
                max_serial = 20260000
            
            new_serial = max_serial + 1
            unique_id = f"TKT{new_serial}"[0:11] # Ensure 11 chars

            # Create Ticket in SPIC db (snmp_monitor.tickets)
            severity = alarm.severity or "Minor"
            
            # Map severity to SPIC Enum ('Major','Minor','Warning')
            spic_sev = severity if severity in ['Major', 'Minor', 'Warning'] else 'Major'

            new_ticket = StatusTicket(
                unique_ticket_id = unique_id,
                alarm_id = alarm.id,
                title = alarm.alarm_type or "SPIC Alarm",
                device_name = alarm.device_name,
                ip_address = getattr(alarm, 'ip_address', 'N/A'),
                severity = spic_sev,
                description = f"SPIC Alarm: {alarm.alarm_type}. Automatic ticket from LNMS sync.",
                status = "Open",
                created_at = datetime.utcnow(),
                updated_at = datetime.utcnow(),
                node_id = 1,
                ticket_serial_4d = 1
            )
            
            db_spic.add(new_ticket)
            
            # Mark processed in SPIC DB (status_alarms)
            alarm.exported_to_central = 1
            alarm.exported_timestamp = datetime.utcnow()
            
            db_spic.commit()

            # Trigger CNMS Sync
            from app.services.cnms_sync import send_status_ticket_to_cnms
            try:
                await send_status_ticket_to_cnms(unique_id)
            except Exception as e:
                logger.error(f"Failed to trigger CNMS sync for SPIC {unique_id}: {e}")

            logger.info(f"Created SPIC ticket {unique_id} in snmp_monitor for alarm {alarm.id}")

    except Exception as e:
        db_lnms.rollback()
        logger.error(f"Error processing SPIC alarms: {e}")
    finally:
        db_lnms.close()
        db_spic.close()



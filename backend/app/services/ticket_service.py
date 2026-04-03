import logging
import asyncio
from datetime import datetime
from sqlalchemy import text
from app.database import SessionLocal, SessionLocal2
from app.models.tickets import Ticket
from app.models.alarms import Alarm
from app.services.cnms_sync import push_status_to_cnms

logger = logging.getLogger("lnms.ticket_service")

async def update_ticket_status(db, ticket_id, new_status, resolution_note=None, last_updated_by="SYSTEM"):
    """
    Updates ticket status locally and pushes to CNMS.
    Also updates the linked alarm status.
    """
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        return None

    status = new_status.upper()
    ticket.status = status
    ticket.updated_at = datetime.utcnow()
    ticket.last_updated_by = last_updated_by
    ticket.sync_status = "pending"

    if status == "ACK":
        ticket.acknowledged_at = datetime.utcnow()
    elif status in ["RESOLVED", "CLOSED"]:
        ticket.resolved_at = datetime.utcnow()
        ticket.resolution_note = resolution_note or ticket.resolution_note
        if status == "CLOSED":
            ticket.closed_at = datetime.utcnow()

    # Update Alarm Status
    if ticket.alarm_id:
        try:
            # Check which node it belongs to
            if "LNMS-LOCAL" in (ticket.lnms_node_id or ""):
                db.execute(text("UPDATE alarms SET status=:st WHERE alarm_id=:aid"), {"st": status, "aid": ticket.alarm_id})
            elif "SPIC" in (ticket.lnms_node_id or ""):
                db2 = SessionLocal2() # snmp_monitor
                try:
                    spic_status = "RESOLVED" if status in ["RESOLVED", "CLOSED"] else "ACTIVE" if status == "ACK" else "PROBLEM"
                    db2.execute(text("UPDATE status_alarms SET status=:st WHERE id=:aid"), {"st": spic_status, "aid": ticket.alarm_id})
                    db2.commit()
                finally:
                    db2.close()
        except Exception as e:
            logger.error(f"Failed to update linked alarm status for {ticket_id}: {e}")

    from app.services.ai_service import classify_ticket, predict_priority
    from app.services.notification_service import send_mobile_notification

    ticket.category = classify_ticket(ticket.title, resolution_note or "")
    ticket.priority_level = predict_priority(ticket.lnms_node_id, ticket.severity_calculated)

    db.commit()
    
    # Push to CNMS in background
    await push_status_to_cnms(ticket_id)

    # Mobile notifications for critical items
    if ticket.priority_level in ["P1", "P2"]:
        asyncio.create_task(send_mobile_notification(ticket_id, ticket.title, ticket.priority_level))
    
    return ticket

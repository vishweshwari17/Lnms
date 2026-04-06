import asyncio
import logging
from datetime import datetime
from sqlalchemy import func
from app.database import SessionLocal
from app.models.alarms import Alarm
from app.models.tickets import Ticket
from app.services.alarm_to_ticket import _build_ticket_id, LNMS_NODE_ID
from app.services.cnms_sync import send_ticket_to_cnms

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lnms.cleanup")

async def cleanup_database():
    db = SessionLocal()
    try:
        # 1. Delete tickets with no corresponding alarms
        logger.info("Checking for dangling tickets (no matching alarm)...")
        dangling_tickets = db.query(Ticket).filter(
            ~Ticket.alarm_id.in_(db.query(Alarm.alarm_id))
        ).all()
        
        if dangling_tickets:
            logger.info(f"Found {len(dangling_tickets)} dangling tickets. Deleting...")
            for t in dangling_tickets:
                logger.info(f"Deleting ticket {t.ticket_id} (Alarm ID {t.alarm_id} not found)")
                db.delete(t)
            db.commit()
        else:
            logger.info("No dangling tickets found.")

        # 2. Create tickets for orphaned alarms (ticket_created=0 but status is active)
        logger.info("Checking for orphaned alarms (no ticket created)...")
        orphaned_alarms = db.query(Alarm).filter(
            (Alarm.ticket_created == 0) | (Alarm.ticket_created == None)
        ).all()

        if orphaned_alarms:
            logger.info(f"Found {len(orphaned_alarms)} orphaned alarms. Creating tickets...")
            for a in orphaned_alarms:
                ticket_id = _build_ticket_id()
                new_ticket = Ticket(
                    ticket_id=ticket_id,
                    alarm_id=a.alarm_id,
                    lnms_node_id=LNMS_NODE_ID,
                    title=f"{a.alarm_name} on {a.device_name}",
                    device_name=a.device_name,
                    status="Open",
                    severity_calculated=a.severity,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                db.add(new_ticket)
                a.ticket_created = 1
                logger.info(f"Created ticket {ticket_id} for alarm {a.alarm_id}")
                
            db.commit()
            
            # Sync new tickets to CNMS
            logger.info("Syncing newly created tickets to CNMS...")
            for a in orphaned_alarms:
                # Re-fetch ticket to get ID if needed, or just use the one we have
                # In this case, we have the ID.
                # Note: send_ticket_to_cnms uses its own SessionLocal
                pass
            
            # We'll trigger a separate sync run for all unsynced tickets
            from app.services.cnms_sync import send_ticket_to_cnms
            unsynced = db.query(Ticket).filter(Ticket.sent_to_cnms_at == None).all()
            for t in unsynced:
                logger.info(f"Syncing ticket {t.ticket_id} to CNMS...")
                try:
                    await send_ticket_to_cnms(t.ticket_id)
                except Exception as e:
                    logger.error(f"Failed to sync {t.ticket_id}: {e}")
        else:
            logger.info("No orphaned alarms found.")

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(cleanup_database())

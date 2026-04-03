
import asyncio
import logging
import sys
from datetime import datetime
from pathlib import Path
import httpx

# Add backend to sys.path
backend_path = str(Path(__file__).resolve().parent.parent)
if backend_path not in sys.path:
    sys.path.append(backend_path)

from app.database import SessionLocal
from app.models.tickets import Ticket
from app.services.cnms_sync import CNMS_BASE_URL, _headers

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("manual_sync")

async def sync_pending():
    db = SessionLocal()
    try:
        # Find all tickets that have not been sent to CNMS
        pending_tickets = db.query(Ticket).filter(
            (Ticket.sent_to_cnms_at == None) | (Ticket.sync_status == "pending")
        ).all()
        
        logger.info(f"Found {len(pending_tickets)} pending tickets to sync.")
        
        async with httpx.AsyncClient(timeout=10) as client:
            for ticket in pending_tickets:
                logger.info(f"Syncing ticket {ticket.ticket_id}...")
                try:
                    payload = {
                        "msg_type": "ALARM_NEW",
                        "lnms_node_id": ticket.lnms_node_id or "LNMS-LOCAL-01",
                        "alarm_uid": ticket.correlation_id,
                        "ticket_id": ticket.ticket_id,
                        "device_name": ticket.device_name,
                        "alarm_type": ticket.title or "General Alarm",
                        "title": ticket.title,
                        "severity": ticket.severity_calculated or "Major",
                        "status": "OPEN",
                        "description": f"Ticket created for {ticket.title}",
                        "created_at": ticket.created_at.isoformat() if ticket.created_at else datetime.utcnow().isoformat(),
                        "last_updated_by": "LNMS",
                        "sync_version": ticket.sync_version or 1
                    }
                    
                    response = await client.post(
                        f"{CNMS_BASE_URL}/webhook/lnms", 
                        json=payload, 
                        headers=_headers()
                    )
                    if response.status_code != 200:
                        logger.error(f"Sync failed for {ticket.ticket_id}: {response.status_code} - {response.text}")
                    else:
                        ticket.sent_to_cnms_at = datetime.utcnow()
                        ticket.sync_status = "synced"
                        db.commit()
                        logger.info(f"Successfully synced {ticket.ticket_id}")
                except Exception as e:
                    logger.error(f"Failed to sync {ticket.ticket_id}: {e}")
        
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(sync_pending())

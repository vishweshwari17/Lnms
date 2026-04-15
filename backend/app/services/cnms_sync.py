import httpx
import logging
import asyncio
from datetime import datetime
from app.database import SessionLocal, SessionLocal2
from app.models.tickets import Ticket
from app.models.status_tickets import StatusTicket

logger = logging.getLogger("lnms.cnms_sync")

CNMS_BASE_URL = "http://127.0.0.1:8001"
CNMS_WEBHOOK_SECRET = "cnms-secret-2026"

def _headers():
    return {"X-LNMS-Secret": CNMS_WEBHOOK_SECRET}

def _build_spic_uid(ticket) -> str:
    # For SPIC, we use SPIC-ALM-{{alarm_id}}
    if ticket.alarm_id is not None:
        return f"SPIC-ALM-{ticket.alarm_id}"
    return ticket.unique_ticket_id

def _build_alarm_uid(ticket) -> str:
    node_id = getattr(ticket, "lnms_node_id", "")
    prefix = "COMPANY-ALM" if node_id in ["local-company-01", "LNMS-COMPANY-01"] else "LOCAL-ALM"
    if ticket.alarm_id is not None:
        return f"{prefix}-{ticket.alarm_id}"
    return ticket.ticket_id

async def _find_cnms_ticket_id(ticket):
    """Try to find the CNMS internal ID for this ticket."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            res = await client.get(f"{CNMS_BASE_URL}/tickets")
            if res.status_code != 200:
                return None
            tickets = res.json()
            # Try matching by various fields
            uid = _build_alarm_uid(ticket)
            for t in tickets:
                if str(t.get("ticket_uid")) == uid or str(t.get("alarm_uid")) == uid:
                    return t.get("id")
    except Exception:
        pass
    return None

async def send_ticket_to_cnms(ticket_id: str):
    """Sends a new ticket to CNMS."""
    db = SessionLocal()
    try:
        ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
        if not ticket:
            logger.error(f"Ticket {ticket_id} not found for CNMS sync")
            return

        alarm_uid = _build_alarm_uid(ticket)
        payload = {
            "msg_type": "ALARM_NEW",
            "lnms_node_id": ticket.lnms_node_id or "local-company-01",
            "alarm_uid": alarm_uid,
            "ticket_id": alarm_uid,
            "device_name": ticket.device_name,
            "title": ticket.title,
            "severity": getattr(ticket, "severity_calculated", "Minor"),
            "status": "OPEN",
            "description": ticket.resolution_note or f"Ticket created for {ticket.title}",
            "created_at": ticket.created_at.isoformat() if ticket.created_at else datetime.utcnow().isoformat(),
            "last_updated_by": "LNMS",
            "sync_version": ticket.sync_version or 1
        }

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                f"{CNMS_BASE_URL}/webhook/lnms", 
                json=payload, 
                headers=_headers()
            )
            response.raise_for_status()
            
            # Update local ticket state
            ticket.sent_to_cnms_at = datetime.utcnow()
            ticket.sync_status = "synced"
            ticket.last_synced_at = datetime.utcnow()
            
            # Try to get the CNMS internal ID for future direct updates
            cnms_id = await _find_cnms_ticket_id(ticket)
            if cnms_id:
                ticket.cnms_ticket_id = str(cnms_id)
                
            db.commit()
            logger.info(f"Successfully synced ticket {ticket_id} to CNMS as {alarm_uid}")

    except Exception as e:
        logger.error(f"Failed to sync ticket {ticket_id} to CNMS: {e}")
        # Re-fetch in case of detached instance if needed, but db.commit() failed so it should be fine
        try:
            ticket.sync_status = "failed"
            db.commit()
        except:
            pass
    finally:
        db.close()

async def send_status_ticket_to_cnms(unique_ticket_id: str):
    """Sends a new SPIC ticket to CNMS."""
    db = SessionLocal2()
    try:
        ticket = db.query(StatusTicket).filter(StatusTicket.unique_ticket_id == unique_ticket_id).first()
        if not ticket:
            logger.error(f"SPIC Ticket {unique_ticket_id} not found for CNMS sync")
            return

        alarm_uid = _build_spic_uid(ticket)
        payload = {
            "msg_type": "ALARM_NEW",
            "lnms_node_id": "LOCAL-COMPANY-01",
            "alarm_uid": alarm_uid,
            "ticket_id": alarm_uid,
            "device_name": ticket.device_name,
            "title": ticket.title,
            "severity": (ticket.severity or "Major").upper(),
            "status": "OPEN",
            "description": ticket.description or f"SPIC Ticket created for {ticket.title}",
            "created_at": ticket.created_at.isoformat() if ticket.created_at else datetime.utcnow().isoformat(),
            "last_updated_by": "SPIC-NMS",
            "sync_version": 1
        }

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                f"{CNMS_BASE_URL}/webhook/lnms", 
                json=payload, 
                headers=_headers()
            )
            response.raise_for_status()
            
            # Update local ticket state
            ticket.sent_to_central = 1
            ticket.sent_at = datetime.utcnow()
            
            db.commit()
            logger.info(f"Successfully synced SPIC ticket {unique_ticket_id} to CNMS as {alarm_uid}")

    except Exception as e:
        logger.error(f"Failed to sync SPIC ticket {unique_ticket_id} to CNMS: {e}")
    finally:
        db.close()


async def push_spic_status_to_cnms(unique_ticket_id: str):
    """Pushes a status update for a SPIC ticket to CNMS."""
    db = SessionLocal2()
    try:
        ticket = db.query(StatusTicket).filter(StatusTicket.unique_ticket_id == unique_ticket_id).first()
        if not ticket:
            return

        status = (ticket.status or "").upper()
        cnms_status = "OPEN"
        if "ACK" in status: cnms_status = "ACK"
        elif "CLOSE" in status or "RESOLVE" in status: cnms_status = "RESOLVED"

        alarm_uid = _build_spic_uid(ticket)
        
        payload = {
            "msg_type": "ALARM_RESOLVED" if cnms_status == "RESOLVED" else "ALARM_UPDATE",
            "lnms_node_id": "LOCAL-COMPANY-01",
            "alarm_uid": alarm_uid,
            "ticket_id": unique_ticket_id,
            "status": cnms_status,
            "resolution_note": ticket.resolution or "Resolved from SPIC-NMS",
            "last_updated_by": "SPIC-NMS"
        }

        async with httpx.AsyncClient(timeout=10) as client:
            url = f"{CNMS_BASE_URL}/webhook/lnms"
            res = await client.post(url, json=payload, headers=_headers())
            res.raise_for_status()
            
            # Update local sync state
            ticket.sent_to_central = 1
            ticket.sent_at = datetime.utcnow()
            db.commit()
            logger.info(f"Successfully pushed SPIC status '{cnms_status}' for {unique_ticket_id} to CNMS via webhook")

    except Exception as e:
        logger.error(f"Failed to push SPIC status for {unique_ticket_id} to CNMS: {e}")
    finally:
        db.close()

async def push_status_to_cnms(ticket_id: str):
    """Pushes a status update to CNMS."""
    db = SessionLocal()
    try:
        ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
        if not ticket:
            return

        status = (ticket.status or "").upper()
        cnms_status = status
        # CNMS expects standard status
        if status in ["ACKNOWLEDGED", "ACK"]: cnms_status = "ACK"
        elif status in ["RESOLVED", "CLOSED"]: cnms_status = "RESOLVED"

        # If we have a CNMS ticket ID, we use the specific update endpoints
        cnms_id = ticket.cnms_ticket_id
        if not cnms_id:
            cnms_id = await _find_cnms_ticket_id(ticket)
            if cnms_id:
                ticket.cnms_ticket_id = str(cnms_id)
                db.commit()

        async with httpx.AsyncClient(timeout=10) as client:
            if cnms_id:
                # Use refined CNMS endpoints
                if cnms_status == "ACK":
                    url = f"{CNMS_BASE_URL}/tickets/{cnms_id}/ack"
                    res = await client.put(url)
                elif cnms_status == "RESOLVED":
                    url = f"{CNMS_BASE_URL}/tickets/{cnms_id}/resolve"
                    res = await client.put(url, json={"resolution_note": ticket.resolution_note or "Resolved from LNMS"})
                else:
                    # Fallback to general update
                    url = f"{CNMS_BASE_URL}/tickets/ticket-status"
                    payload = {
                        "ticket_id": ticket.ticket_id,
                        "alarm_uid": _build_alarm_uid(ticket),
                        "status": cnms_status,
                        "resolution_note": ticket.resolution_note or "",
                        "last_updated_by": ticket.last_updated_by or "LNMS"
                    }
                    res = await client.post(url, json=payload, headers=_headers())
            else:
                # Fallback if no CNMS ID found
                url = f"{CNMS_BASE_URL}/tickets/ticket-status"
                payload = {
                    "ticket_id": ticket.ticket_id,
                    "alarm_uid": _build_alarm_uid(ticket),
                    "status": cnms_status,
                    "resolution_note": ticket.resolution_note or "",
                    "last_updated_by": ticket.last_updated_by or "LNMS"
                }
                res = await client.post(url, json=payload, headers=_headers())

            res.raise_for_status()
            
            # Update local ticket state
            if not ticket.sent_to_cnms_at:
                ticket.sent_to_cnms_at = datetime.utcnow()
                
            ticket.sync_status = "synced"
            ticket.last_synced_at = datetime.utcnow()
            db.commit()
            logger.info(f"Successfully pushed status '{cnms_status}' for {ticket_id} to CNMS")

    except Exception as e:
        logger.error(f"Failed to push status for {ticket_id} to CNMS: {e}")
        try:
            ticket.sync_status = "failed"
            db.commit()
        except:
            pass
    finally:
        db.close()

async def push_message_to_cnms(ticket_id: str, sender: str, message: str):
    """Pushes a chat message to CNMS."""
    db = SessionLocal()
    db_spic = SessionLocal2()
    try:
        # Try finding in LNMS Tickets first
        ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
        
        # If not found, look in SPIC Tickets (snmp_monitor)
        is_spic = False
        if not ticket:
            ticket = db_spic.query(StatusTicket).filter(StatusTicket.unique_ticket_id == ticket_id).first()
            if not ticket:
                return
            is_spic = True

        cnms_id = getattr(ticket, "cnms_ticket_id", None)
        if not cnms_id:
            # Need a custom build_uid for SPIC if it's a spic ticket
            if is_spic:
                uid = _build_spic_uid(ticket)
            else:
                uid = _build_alarm_uid(ticket)
                
            # Internal helper to find by that UID
            try:
                async with httpx.AsyncClient(timeout=5) as client:
                    res = await client.get(f"{CNMS_BASE_URL}/tickets")
                    if res.status_code == 200:
                        tickets_json = res.json()
                        match = next((t for t in tickets_json if str(t.get("ticket_uid")) == uid or str(t.get("alarm_uid")) == uid), None)
                        if match:
                            cnms_id = match.get("id")
                            if not is_spic: # Can't save to StatusTicket yet as it lacks the column
                                ticket.cnms_ticket_id = str(cnms_id)
                                db.commit()
            except Exception:
                pass

        if not cnms_id:
            logger.warning(f"Cannot push message for {ticket_id}: No CNMS ID found")
            return

        payload = {
            "sender": sender,
            "message": message,
            "created_at": datetime.utcnow().isoformat()
        }

        async with httpx.AsyncClient(timeout=10) as client:
            url = f"{CNMS_BASE_URL}/tickets/{cnms_id}/comment"
            res = await client.post(url, json=payload, headers=_headers())
            res.raise_for_status()
            
            if is_spic:
                ticket.sent_to_central = 1
                ticket.sent_at = datetime.utcnow()
                db_spic.commit()
            else:
                if not ticket.sent_to_cnms_at:
                    ticket.sent_to_cnms_at = datetime.utcnow()
                ticket.sync_status = "synced"
                ticket.last_synced_at = datetime.utcnow()
                db.commit()
            
            logger.info(f"Successfully pushed message for {ticket_id} to CNMS")

    except Exception as e:
        logger.error(f"Failed to push message for {ticket_id} to CNMS: {e}")
        try:
            if not is_spic:
                ticket.sync_status = "failed"
                db.commit()
        except:
            pass
    finally:
        db.close()
        db_spic.close()

async def sync_missed_tickets():
    """Periodically fetch missed ticket statuses from CNMS."""
    db = SessionLocal()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(f"{CNMS_BASE_URL}/tickets")
            if res.status_code != 200:
                return
            cnms_tickets = res.json()

        # Fetch status for open tickets in LNMS
        open_tickets = db.query(Ticket).filter(~Ticket.status.in_(("Resolved", "Closed"))).all()
        
        for ticket in open_tickets:
            try:
                uid = _build_alarm_uid(ticket)
                match = next((t for t in cnms_tickets if str(t.get("ticket_uid")) == uid or str(t.get("alarm_uid")) == uid), None)
                
                if not match: continue
                
                cnms_status = (match.get("status") or "").upper()
                if cnms_status in ["ACK", "RESOLVED", "CLOSED"] and cnms_status != (ticket.status or "").upper():
                    # Update local status
                    ticket.status = cnms_status
                    if cnms_status == "ACK": ticket.acknowledged_at = datetime.utcnow()
                    elif cnms_status in ["RESOLVED", "CLOSED"]: 
                        res_str = match.get("resolved_at") or match.get("updated_at")
                        ticket.resolved_at = datetime.fromisoformat(res_str.replace('Z', '+00:00')) if res_str else datetime.utcnow()
                        if cnms_status == "CLOSED": ticket.closed_at = datetime.utcnow()
                        ticket.resolution_note = match.get("resolution_note") or match.get("resolution") or ticket.resolution_note
                    
                    if not ticket.sent_to_cnms_at:
                        ticket.sent_to_cnms_at = datetime.utcnow()
                    ticket.sync_status = "synced"
                    ticket.last_synced_at = datetime.utcnow()
                    
                    # Generate chat message for local sync log
                    try:
                        from app.models.ticket_messages import TicketMessage
                        note = match.get("resolution_note", "")
                        msg_text = f"CNMS status sync: {cnms_status}"
                        if note: msg_text += f" - Note: {note}"
                            
                        t_msg = TicketMessage(
                            ticket_id=ticket.ticket_id,
                            sender="CNMS",
                            message=msg_text,
                            created_at=datetime.utcnow()
                        )
                        db.add(t_msg)
                    except Exception as ex:
                        logger.error(f"Failed to save matched missed-sync CNMS message: {ex}")
                        
                    logger.info(f"Retroactively synced {ticket.ticket_id} to {cnms_status}")
            except Exception:
                continue
        db.commit()
    except (httpx.ConnectError, httpx.ConnectTimeout) as e:
        logger.warning(f"CNMS unavailable at {CNMS_BASE_URL}: {e}")
    except Exception as e:
        logger.error(f"Sync missed tickets failed: {e}")
    finally:
        db.close()
async def send_incident_to_cnms(incident_id: int):
    """Sends a new or updated incident to CNMS."""
    db = SessionLocal()
    try:
        from app.models.incidents import Incident
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if not incident:
            logger.error(f"Incident {incident_id} not found for CNMS sync")
            return

        payload = {
            "msg_type": "INCIDENT_SYNC",
            "lnms_node_id": "LOCAL-COMPANY-01",
            "incident_id": incident.ticket_id or f"INC-{incident.id}",
            "title": incident.title,
            "device_name": incident.device,
            "ip_address": incident.ip_address,
            "severity": incident.severity,
            "status": incident.status,
            "occurrence_count": incident.occurrence_count,
            "description": incident.description,
            "created_at": incident.created_time.isoformat() if incident.created_time else datetime.utcnow().isoformat(),
            "last_updated_by": "LNMS-INCIDENT-ENGINE"
        }

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                f"{CNMS_BASE_URL}/webhook/lnms", 
                json=payload, 
                headers=_headers()
            )
            response.raise_for_status()
            
            incident.sync_status = "SYNCED"
            db.commit()
            logger.info(f"Successfully synced incident {incident_id} to CNMS")

    except Exception as e:
        logger.error(f"Failed to sync incident {incident_id} to CNMS: {e}")
        try:
            incident.sync_status = "FAILED"
            db.commit()
        except:
            pass
    finally:
        db.close()

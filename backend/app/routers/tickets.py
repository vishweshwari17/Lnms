# ============================================================
# tickets.py  ─  LNMS BACKEND
# ============================================================
# LNMS = Local Network Management System  (this server)
# CNMS = Central Network Management System (remote server)
#
# Flow:
#   LNMS creates ticket  →  sends to CNMS via HTTP
#   CNMS acknowledges    →  POSTs to LNMS /tickets/ticket-status
#   CNMS resolves        →  POSTs to LNMS /tickets/ticket-status
#   CNMS sends message   →  POSTs to LNMS /tickets/ticket-message
#   LNMS sends message   →  POSTs to CNMS /tickets/ticket-message
# ============================================================

import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
import asyncio
import httpx

from app.database import get_lnms_db, SessionLocal, SessionLocal2
from app.models import Ticket
from app.models.ticket_messages import TicketMessage
from app.schemas import (
    TicketCreate,
    TicketResponse,
    TicketStatusUpdate,
    MessageCreate,
)
from app.services import ticket_service, cnms_sync

router = APIRouter(prefix="/tickets", tags=["Tickets"])

# ── Change these to match this LNMS node and the real CNMS server ──
CNMS_BASE_URL = "http://127.0.0.1:8001"
LNMS_NODE_ID = "LNMS-LOCAL-01"
CNMS_WEBHOOK_SECRET = os.getenv("CNMS_WEBHOOK_SECRET", "supersecret123")
# Example for company node: LNMS_NODE_ID = "COMPANY-SERVER"
# ───────────────────────────────────────────────────────────────

# Allowed status values (always stored UPPERCASE in LNMS DB)
VALID_STATUSES = {"OPEN", "ACK", "RESOLVED", "CLOSED"}
STATUS_TO_DB = {
    "OPEN": "Open",
    "ACK": "Ack",
    "RESOLVED": "Resolved",
    "CLOSED": "Closed",
}


def _build_ticket_id():
    return f"TKT-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"


def _build_alarm_uid(ticket) -> str:
    prefix = "COMPANY-ALM" if getattr(ticket, "lnms_node_id", "") == "LNMS-COMPANY-01" else "LOCAL-ALM"
    return f"{prefix}-{ticket.alarm_id}" if ticket.alarm_id is not None else ticket.ticket_id


def _alarm_id_from_identifier(identifier: str | None):
    if not identifier:
        return None
    text = str(identifier).strip()
    if "-ALM-" not in text:
        return None
    try:
        return int(text.rsplit("-", 1)[-1])
    except ValueError:
        return None


def _normalize_status(status: str | None) -> str:
    value = (status or "").strip().upper()
    if value in {"ACKNOWLEDGED", "ACK"}:
        return "ACK"
    if value in {"RESOLVE", "RESOLVED"}:
        return "RESOLVED"
    if value == "CLOSE":
        return "CLOSED"
    if value == "REOPENED":
        return "OPEN"
    return value or "OPEN"


def _status_for_db(status: str | None) -> str:
    normalized = _normalize_status(status)
    return STATUS_TO_DB.get(normalized, STATUS_TO_DB["OPEN"])


def _parse_dt(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _serialize_ticket(ticket: Ticket) -> dict:
    result = {c.name: getattr(ticket, c.name) for c in ticket.__table__.columns}
    result["status"] = _normalize_status(ticket.status)
    result["global_ticket_id"] = ticket.global_ticket_id or ticket.ticket_id
    result["resolution_notes"] = ticket.resolution_note
    return result


def _cnms_headers() -> dict:
    headers = {}
    if CNMS_WEBHOOK_SECRET:
        headers["X-LNMS-Secret"] = CNMS_WEBHOOK_SECRET
    return headers


def _extract_cnms_tickets(payload) -> list:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        tickets = payload.get("tickets", [])
        return tickets if isinstance(tickets, list) else []
    return []


def _get_ticket_by_identifier(db: Session, ticket_id: str | None):
    if not ticket_id:
        return None
    
    # If the tag is strictly COMPANY, do not match local LNMS db alarm_id
    is_company = str(ticket_id).startswith("COMPANY-")
    
    filters = [
        Ticket.ticket_id == ticket_id,
        Ticket.global_ticket_id == ticket_id,
        Ticket.correlation_id == ticket_id,
        Ticket.cnms_ticket_id == ticket_id,
    ]
    
    if not is_company:
        alarm_id = _alarm_id_from_identifier(ticket_id)
        if alarm_id is not None:
            filters.append(Ticket.alarm_id == alarm_id)

    return db.query(Ticket).filter(or_(*filters)).order_by(Ticket.created_at.desc()).first()


def _update_ticket_sync_state(
    ticket_id: str,
    *,
    sync_status: str | None = None,
    sent_to_cnms: bool = False,
    synced_now: bool = False,
):
    db = SessionLocal()
    try:
        ticket = _get_ticket_by_identifier(db, ticket_id)
        if not ticket:
            return
        now = datetime.utcnow()
        if sync_status:
            ticket.sync_status = sync_status
        if sent_to_cnms and not ticket.sent_to_cnms_at:
            ticket.sent_to_cnms_at = now
        if synced_now:
            ticket.last_synced_at = now
        ticket.updated_at = now
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _cache_cnms_ticket_id(ticket_id: str, cnms_ticket_id):
    if not cnms_ticket_id:
        return
    db = SessionLocal()
    try:
        ticket = _get_ticket_by_identifier(db, ticket_id)
        if not ticket:
            return
        ticket.cnms_ticket_id = str(cnms_ticket_id)
        ticket.updated_at = datetime.utcnow()
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


async def _find_cnms_ticket(ticket: Ticket):
    async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
        response = await client.get(f"{CNMS_BASE_URL}/tickets", timeout=10)
        response.raise_for_status()
        tickets = response.json()

    ticket_refs = {
        str(ticket.ticket_id),
        str(ticket.global_ticket_id or ""),
        str(ticket.cnms_ticket_id or ""),
        str(ticket.correlation_id or ""),
        _build_alarm_uid(ticket),
    }

    for item in tickets:
        if str(item.get("id")) == str(ticket.cnms_ticket_id or ""):
            return item
        if str(item.get("ticket_uid") or "") in ticket_refs:
            return item
        if str(item.get("alarm_uid") or "") == _build_alarm_uid(ticket):
            return item
    return None


# ============================================================
# ❗ ROUTE ORDER IS CRITICAL IN FASTAPI
#    Static routes  (/update_from_cnms, /ticket-status …)
#    MUST be defined BEFORE dynamic routes (/{ticket_id})
#    otherwise FastAPI treats the static segment as a value
#    for ticket_id and the real handler is never reached.
# ============================================================


# ============================================================
# [LNMS] GET ALL TICKETS
# ============================================================
@router.get("/")
def get_all_tickets(db: Session = Depends(get_lnms_db)):
    """Return every ticket stored in the LNMS database."""
    tickets = db.query(Ticket).order_by(Ticket.created_at.desc()).all()
    return {"tickets": [_serialize_ticket(ticket) for ticket in tickets]}


# ============================================================
# [LNMS] CREATE TICKET  →  forward to CNMS
# ============================================================
@router.post("/", response_model=TicketResponse)
async def create_ticket(ticket: TicketCreate, db: Session = Depends(get_lnms_db)):
    """
    LNMS creates a new ticket and fires it off to CNMS asynchronously.
    """
    new_ticket = Ticket(
        **ticket.model_dump(),
        ticket_id=_build_ticket_id(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        last_updated_by="LNMS",
        sync_version=1,
        sync_status="pending",
        lnms_node_id=LNMS_NODE_ID,
        status="OPEN",
    )
    new_ticket.global_ticket_id = new_ticket.ticket_id
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)

    # Push to CNMS
    asyncio.create_task(cnms_sync.send_ticket_to_cnms(new_ticket.ticket_id))

    return new_ticket


# ============================================================
# [CNMS → LNMS]  Receive status update from CNMS
#   e.g. CNMS acknowledges or resolves a ticket
#   CNMS POSTs here: POST /tickets/ticket-status
# ============================================================
@router.post("/ticket-status")           # ← STATIC — must be above /{ticket_id}
async def receive_status_from_cnms(payload: dict, db: Session = Depends(get_lnms_db)):
    """
    Called BY CNMS to push a status change (ACK / RESOLVED / CLOSED)
    into the LNMS database so both sides stay in sync.
    """
    import json
    print(f"DEBUG CNMS STATUS PAYLOAD: {json.dumps(payload)}")
    global_ticket_id = (
        payload.get("global_ticket_id")
        or payload.get("ticket_id")
        or payload.get("lnms_ticket_id")
        or payload.get("cnms_ticket_id")
        or payload.get("alarm_uid")
    )
    status = _normalize_status(payload.get("status"))
    note = payload.get("resolution_note") or payload.get("resolution_notes") or payload.get("note") or ""

    if status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status '{status}'")

    ticket = _get_ticket_by_identifier(db, global_ticket_id)

    if not ticket:
        # Fallback for SPIC alarms if not found in LNMS Tickets
        if global_ticket_id:
            try:
                from app.database import SessionLocal2
                db_spic = SessionLocal2()
                try:
                    spic_status = "RESOLVED" if status in ["RESOLVED", "CLOSED"] else "ACTIVE" if status == "ACK" else "PROBLEM"
                    db_spic.execute(text("UPDATE status_alarms SET status=:st WHERE id=:aid OR device_name=:dn"), {
                        "st": spic_status,
                        "aid": _alarm_id_from_identifier(global_ticket_id),
                        "dn": global_ticket_id
                    })
                    db_spic.commit()
                finally:
                    db_spic.close()
            except Exception as e:
                logger.error(f"Failed to update legacy SPIC alarm: {e}")
        
        raise HTTPException(404, "Ticket not found")

    # Use ticket_service for consistent update
    await ticket_service.update_ticket_status(
        db, 
        ticket.ticket_id, 
        status, 
        resolution_note=note, 
        last_updated_by="CNMS"
    )

    # Save CNMS message if note provided
    if note:
        msg = TicketMessage(
            ticket_id  = ticket.ticket_id,
            sender     = "CNMS",
            message    = note,
            created_at = datetime.utcnow(),
        )
        db.add(msg)
        db.commit()

    return {"ok": True, "status": status}


@router.api_route("/update_from_cnms", methods=["PUT", "POST"])
async def update_from_cnms(payload: dict, db: Session = Depends(get_lnms_db)):
    return await receive_status_from_cnms(payload, db)


# ============================================================
# [CNMS → LNMS]  Receive a chat message from CNMS
#   CNMS POSTs here: POST /tickets/ticket-message
# ============================================================
@router.post("/ticket-message")          # ← STATIC — must be above /{ticket_id}
def receive_message_from_cnms(payload: dict, db: Session = Depends(get_lnms_db)):
    """
    Called BY CNMS when a CNMS operator sends a chat message.
    Saves it into LNMS so the LNMS chat panel shows it on the LEFT (white bubble).
    """
    global_ticket_id = payload.get("global_ticket_id")
    message          = payload.get("message")
    sender           = payload.get("sender", "CNMS")
    created_at       = _parse_dt(payload.get("created_at")) or datetime.utcnow()

    ticket = _get_ticket_by_identifier(db, global_ticket_id)

    if not ticket:
        raise HTTPException(404, "Ticket not found in LNMS")

    new_msg = TicketMessage(
        ticket_id  = ticket.ticket_id,
        sender     = sender,
        message    = message,
        created_at = created_at,
    )
    db.add(new_msg)
    ticket.last_updated_by = sender
    ticket.sync_status = "synced"
    ticket.last_synced_at = datetime.utcnow()
    ticket.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(new_msg)

    return {"ok": True}


# ============================================================
# [LNMS] UPDATE TICKET STATUS  (LNMS operator changes status)
#   Then pushes the change to CNMS
# ============================================================
@router.put("/{ticket_id}")
async def update_local_ticket_status(
    ticket_id: str,
    data: TicketStatusUpdate,
    db: Session = Depends(get_lnms_db),
):
    """
    LNMS operator updates ticket status.
    """
    ticket = await ticket_service.update_ticket_status(
        db, 
        ticket_id, 
        data.status, 
        resolution_note=data.resolution_notes, 
        last_updated_by="LNMS"
    )
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    return {"message": "Ticket updated", "ticket": ticket}


# ============================================================
# [LNMS] GET SINGLE TICKET  (with messages attached)
# ============================================================
@router.get("/{ticket_id}")              # ← DYNAMIC
def get_ticket(ticket_id: str, db: Session = Depends(get_lnms_db)):
    """
    Returns the ticket AND its messages array so the frontend
    can populate the chat panel without a second API call.
    """
    ticket = _get_ticket_by_identifier(db, ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found in LNMS")

    # Fetch all chat messages ordered oldest → newest
    messages = (
        db.query(TicketMessage)
        .filter(TicketMessage.ticket_id == ticket.ticket_id)
        .order_by(TicketMessage.created_at.asc())
        .all()
    )

    # Build response dict from the ORM model
    result = _serialize_ticket(ticket)

    # Attach messages so frontend t.messages works
    result["messages"] = [
        {
            "id":         m.id,
            "sender":     m.sender,
            "message":    m.message,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]

    return result


# ============================================================
# [LNMS] GET MESSAGES for a ticket  (standalone endpoint)
# ============================================================
@router.get("/{ticket_id}/messages")     # ← DYNAMIC
def get_messages(ticket_id: str, db: Session = Depends(get_lnms_db)):
    """Returns chat messages for a ticket, oldest first."""
    ticket = _get_ticket_by_identifier(db, ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found in LNMS")

    return (
        db.query(TicketMessage)
        .filter(TicketMessage.ticket_id == ticket.ticket_id)
        .order_by(TicketMessage.created_at.asc())
        .all()
    )


# ============================================================
# [LNMS] ADD MESSAGE  (LNMS operator sends a chat message)
#   After saving locally, forwards the message to CNMS
# ============================================================
@router.post("/{ticket_id}/messages")    # ← DYNAMIC
async def add_message(
    ticket_id: str,
    message: MessageCreate,
    db: Session = Depends(get_lnms_db),
):
    """
    LNMS operator sends a chat message.
    Saved to LNMS DB then forwarded to CNMS so CNMS chat shows it on the LEFT.
    """
    ticket = _get_ticket_by_identifier(db, ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found in LNMS")

    new_msg = TicketMessage(
        ticket_id  = ticket.ticket_id,
        sender     = message.sender,
        message    = message.message,
        created_at = datetime.utcnow(),
    )
    db.add(new_msg)
    ticket.last_updated_by = message.sender
    ticket.updated_at = datetime.utcnow()
    ticket.sync_status = "pending"
    db.commit()
    db.refresh(new_msg)

    # Forward this LNMS message to CNMS (non-blocking)
    asyncio.create_task(
        cnms_sync.push_message_to_cnms(
            ticket_id = ticket.ticket_id,
            sender    = message.sender,
            message   = message.message,
        )
    )

    return new_msg


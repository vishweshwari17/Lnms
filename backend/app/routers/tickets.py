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

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
import asyncio
import httpx

from app.database import get_db
from app.models import Ticket
from app.models.ticket_messages import TicketMessage
from app.schemas import (
    TicketCreate,
    TicketResponse,
    TicketStatusUpdate,
    MessageCreate,
)

router = APIRouter(prefix="/tickets", tags=["Tickets"])

# ── Change these to match this LNMS node and the real CNMS server ──
CNMS_BASE_URL = "http://127.0.0.1:8001"
LNMS_NODE_ID = "LNMS-LOCAL-01"
# Example for company node: LNMS_NODE_ID = "COMPANY-SERVER"
# ───────────────────────────────────────────────────────────────

# Allowed status values (always stored UPPERCASE in LNMS DB)
VALID_STATUSES = {"OPEN", "ACK", "RESOLVED", "CLOSED"}


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
def get_all_tickets(db: Session = Depends(get_db)):
    """Return every ticket stored in the LNMS database."""
    tickets = db.query(Ticket).order_by(Ticket.created_at.desc()).all()
    return {"tickets": tickets}


# ============================================================
# [LNMS] CREATE TICKET  →  forward to CNMS
# ============================================================
@router.post("/", response_model=TicketResponse)
def create_ticket(ticket: TicketCreate, db: Session = Depends(get_db)):
    """
    LNMS creates a new ticket and fires it off to CNMS asynchronously.
    Status is always initialised as OPEN (uppercase).
    """
    new_ticket = Ticket(
        **ticket.model_dump(),
        created_at=datetime.utcnow(),
        status="OPEN",          # ← always uppercase
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)

    # Send to CNMS in the background (non-blocking)
    asyncio.create_task(send_ticket_to_cnms(new_ticket))

    return new_ticket


# ============================================================
# [CNMS → LNMS]  Receive status update from CNMS
#   e.g. CNMS acknowledges or resolves a ticket
#   CNMS POSTs here: POST /tickets/ticket-status
# ============================================================
@router.post("/ticket-status")           # ← STATIC — must be above /{ticket_id}
def receive_status_from_cnms(payload: dict, db: Session = Depends(get_db)):
    """
    Called BY CNMS to push a status change (ACK / RESOLVED / CLOSED)
    into the LNMS database so both sides stay in sync.
    """
    global_ticket_id = payload.get("global_ticket_id")
    status           = (payload.get("status") or "").upper()
    note             = payload.get("resolution_note", "")
    resolved_at      = payload.get("resolved_at")

    if status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status '{status}'")

    # LNMS looks up by global_ticket_id (shared key between LNMS + CNMS)
    ticket = db.query(Ticket).filter(
        Ticket.global_ticket_id == global_ticket_id
    ).first()

    if not ticket:
        raise HTTPException(404, "Ticket not found in LNMS")

    ticket.status       = status
    ticket.sync_version = (ticket.sync_version or 0) + 1

    if status == "ACK":
        ticket.acknowledged_at = datetime.utcnow()

    elif status in ("RESOLVED", "CLOSED"):
        parsed_time = (
            datetime.fromisoformat(resolved_at.replace("Z", "+00:00"))
            if resolved_at else datetime.utcnow()
        )
        ticket.resolved_at    = parsed_time
        ticket.resolution_note = note
        if status == "CLOSED":
            ticket.closed_at = parsed_time

    db.commit()

    # If CNMS included a resolution note, save it as a CNMS message bubble
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


# ============================================================
# [CNMS → LNMS]  Receive a chat message from CNMS
#   CNMS POSTs here: POST /tickets/ticket-message
# ============================================================
@router.post("/ticket-message")          # ← STATIC — must be above /{ticket_id}
def receive_message_from_cnms(payload: dict, db: Session = Depends(get_db)):
    """
    Called BY CNMS when a CNMS operator sends a chat message.
    Saves it into LNMS so the LNMS chat panel shows it on the LEFT (white bubble).
    """
    global_ticket_id = payload.get("global_ticket_id")
    message          = payload.get("message")
    sender           = payload.get("sender", "CNMS")
    created_at       = payload.get("created_at", datetime.utcnow())

    ticket = db.query(Ticket).filter(
        Ticket.global_ticket_id == global_ticket_id
    ).first()

    if not ticket:
        raise HTTPException(404, "Ticket not found in LNMS")

    new_msg = TicketMessage(
        ticket_id  = ticket.ticket_id,
        sender     = sender,
        message    = message,
        created_at = created_at,
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    return {"ok": True}


# ============================================================
# [LNMS] UPDATE TICKET STATUS  (LNMS operator changes status)
#   Then pushes the change to CNMS
# ============================================================
@router.put("/{ticket_id}")              # ← DYNAMIC — must be below all static routes
def update_ticket_status(
    ticket_id: str,
    data: TicketStatusUpdate,
    db: Session = Depends(get_db),
):
    """
    LNMS operator updates ticket status.
    After saving locally, sends the change to CNMS asynchronously.
    """
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(404, "Ticket not found in LNMS")

    new_status = (data.status or "").upper()
    if new_status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status '{new_status}'")

    ticket.status          = new_status
    ticket.last_updated_by = "LNMS"
    ticket.sync_version    = (ticket.sync_version or 0) + 1

    if new_status == "ACK":
        ticket.acknowledged_at = datetime.utcnow()
    elif new_status == "RESOLVED":
        ticket.resolved_at = datetime.utcnow()
    elif new_status == "CLOSED":
        ticket.closed_at = datetime.utcnow()

    db.commit()
    db.refresh(ticket)

    # Notify CNMS about the status change (non-blocking)
    asyncio.create_task(push_status_to_cnms(ticket))

    return {"message": "Ticket updated", "ticket": ticket}


# ============================================================
# [LNMS] GET SINGLE TICKET  (with messages attached)
# ============================================================
@router.get("/{ticket_id}")              # ← DYNAMIC
def get_ticket(ticket_id: str, db: Session = Depends(get_db)):
    """
    Returns the ticket AND its messages array so the frontend
    can populate the chat panel without a second API call.
    """
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(404, "Ticket not found in LNMS")

    # Fetch all chat messages ordered oldest → newest
    messages = (
        db.query(TicketMessage)
        .filter(TicketMessage.ticket_id == ticket_id)
        .order_by(TicketMessage.created_at.asc())
        .all()
    )

    # Build response dict from the ORM model
    result = {c.name: getattr(ticket, c.name) for c in ticket.__table__.columns}

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
def get_messages(ticket_id: str, db: Session = Depends(get_db)):
    """Returns chat messages for a ticket, oldest first."""
    return (
        db.query(TicketMessage)
        .filter(TicketMessage.ticket_id == ticket_id)
        .order_by(TicketMessage.created_at.asc())
        .all()
    )


# ============================================================
# [LNMS] ADD MESSAGE  (LNMS operator sends a chat message)
#   After saving locally, forwards the message to CNMS
# ============================================================
@router.post("/{ticket_id}/messages")    # ← DYNAMIC
def add_message(
    ticket_id: str,
    message: MessageCreate,
    db: Session = Depends(get_db),
):
    """
    LNMS operator sends a chat message.
    Saved to LNMS DB then forwarded to CNMS so CNMS chat shows it on the LEFT.
    """
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(404, "Ticket not found in LNMS")

    new_msg = TicketMessage(
        ticket_id  = ticket_id,
        sender     = message.sender,
        message    = message.message,
        created_at = datetime.utcnow(),
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    # Forward this LNMS message to CNMS (non-blocking)
    asyncio.create_task(
        push_message_to_cnms(
            global_ticket_id = ticket.global_ticket_id or ticket.ticket_id,
            sender           = message.sender,
            message_text     = message.message,
            created_at       = new_msg.created_at.isoformat(),
        )
    )

    return new_msg


# ============================================================
# ASYNC HELPERS  ─  LNMS → CNMS outbound calls
# ============================================================

async def send_ticket_to_cnms(ticket):
    """
    [LNMS → CNMS]
    Called after a new ticket is created in LNMS.
    Sends full ticket payload to CNMS webhook so CNMS can create its own record.
    """
    try:
        url     = f"{CNMS_BASE_URL}/webhook/ticket"
        payload = {
            "global_ticket_id": ticket.global_ticket_id or ticket.ticket_id,
            "alarm_id":         ticket.alarm_id,
            "device_name":      ticket.device_name,
            "title":            ticket.title,
            "severity":         ticket.severity_calculated,
            "status":           ticket.status,
            "created_at":       ticket.created_at.isoformat(),
            "last_updated_by":  "LNMS",
            "sync_version":     1,
            "lnms_node_id":     LNMS_NODE_ID,
        }
        async with httpx.AsyncClient() as client:
            await client.post(url, json=payload, timeout=5)
        print(f"✅ [LNMS→CNMS] Ticket {ticket.ticket_id} sent to CNMS")
    except Exception as e:
        print(f"❌ [LNMS→CNMS] Failed to send ticket: {e}")


async def push_status_to_cnms(ticket):
    """
    [LNMS → CNMS]
    Called after LNMS updates a ticket status.
    Notifies CNMS so its copy stays in sync.
    """
    try:
        url     = f"{CNMS_BASE_URL}/tickets/ticket-status"
        payload = {
            "global_ticket_id": ticket.global_ticket_id or ticket.ticket_id,
            "status":           ticket.status,
            "resolved_at":      ticket.resolved_at.isoformat() if ticket.resolved_at else None,
            "resolution_note":  getattr(ticket, "resolution_note", None),
            "last_updated_by":  "LNMS",
            "sync_version":     ticket.sync_version,
        }
        async with httpx.AsyncClient() as client:
            await client.post(url, json=payload, timeout=5)
        print(f"✅ [LNMS→CNMS] Status '{ticket.status}' synced for {ticket.ticket_id}")
    except Exception as e:
        print(f"❌ [LNMS→CNMS] Status sync failed: {e}")


async def push_message_to_cnms(global_ticket_id, sender, message_text, created_at):
    """
    [LNMS → CNMS]
    Called after an LNMS operator sends a chat message.
    Forwards it to CNMS so CNMS shows it as an incoming LNMS message (white bubble, left side).
    """
    try:
        url     = f"{CNMS_BASE_URL}/tickets/ticket-message"
        payload = {
            "global_ticket_id": global_ticket_id,
            "sender":           sender,
            "message":          message_text,
            "created_at":       created_at,
        }
        async with httpx.AsyncClient() as client:
            await client.post(url, json=payload, timeout=5)
        print(f"✅ [LNMS→CNMS] Message forwarded to CNMS")
    except Exception as e:
        print(f"❌ [LNMS→CNMS] Message forward failed: {e}")
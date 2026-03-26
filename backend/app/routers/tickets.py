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

from app.database import get_lnms_db, SessionLocal
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


def _build_alarm_uid(ticket: Ticket) -> str:
    return f"LOCAL-ALM-{ticket.alarm_id}" if ticket.alarm_id is not None else ticket.ticket_id


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
    filters = [
        Ticket.ticket_id == ticket_id,
        Ticket.global_ticket_id == ticket_id,
        Ticket.correlation_id == ticket_id,
        Ticket.cnms_ticket_id == ticket_id,
    ]
    alarm_id = _alarm_id_from_identifier(ticket_id)
    if alarm_id is not None:
        filters.append(Ticket.alarm_id == alarm_id)

    return db.query(Ticket).filter(or_(*filters)).first()


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
def create_ticket(ticket: TicketCreate, db: Session = Depends(get_lnms_db)):
    """
    LNMS creates a new ticket and fires it off to CNMS asynchronously.
    Status is always initialised as OPEN (uppercase).
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
        status=_status_for_db("OPEN"),
    )
    new_ticket.global_ticket_id = new_ticket.ticket_id
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
def receive_status_from_cnms(payload: dict, db: Session = Depends(get_lnms_db)):
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
    status           = _normalize_status(payload.get("status"))
    note             = payload.get("resolution_note") or payload.get("resolution_notes") or payload.get("note") or ""
    resolved_at      = payload.get("resolved_at")

    if status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status '{status}'")

    # LNMS looks up by ticket_id OR correlation_id (which stores the CNMS TKT-xxx id)
    ticket = _get_ticket_by_identifier(db, global_ticket_id)

    if not ticket:
        raise HTTPException(404, "Ticket not found in LNMS")

    ticket.status       = _status_for_db(status)
    ticket.sync_version = (ticket.sync_version or 0) + 1
    ticket.last_updated_by = payload.get("last_updated_by") or "CNMS"
    ticket.sync_status = "synced"
    ticket.last_synced_at = datetime.utcnow()
    ticket.updated_at = datetime.utcnow()
    if global_ticket_id and not ticket.global_ticket_id:
        ticket.global_ticket_id = global_ticket_id
    if payload.get("cnms_ticket_id"):
        ticket.cnms_ticket_id = payload.get("cnms_ticket_id")

    if status == "ACK":
        ticket.acknowledged_at = datetime.utcnow()

    elif status in ("RESOLVED", "CLOSED"):
        parsed_time = _parse_dt(resolved_at) or datetime.utcnow()
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


@router.api_route("/update_from_cnms", methods=["PUT", "POST"])
def update_from_cnms(payload: dict, db: Session = Depends(get_lnms_db)):
    return receive_status_from_cnms(payload, db)


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
@router.put("/{ticket_id}")              # ← DYNAMIC — must be below all static routes
def update_ticket_status(
    ticket_id: str,
    data: TicketStatusUpdate,
    db: Session = Depends(get_lnms_db),
):
    """
    LNMS operator updates ticket status.
    After saving locally, sends the change to CNMS asynchronously.
    """
    ticket = _get_ticket_by_identifier(db, ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found in LNMS")

    new_status = (data.status or "").upper()
    if new_status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status '{new_status}'")

    ticket.status          = _status_for_db(new_status)
    ticket.last_updated_by = "LNMS"
    ticket.sync_version    = (ticket.sync_version or 0) + 1
    ticket.updated_at      = datetime.utcnow()
    ticket.sync_status     = "pending"

    if new_status == "ACK":
        ticket.acknowledged_at = datetime.utcnow()
    elif new_status == "RESOLVED":
        ticket.resolved_at = datetime.utcnow()
        ticket.resolution_note = data.resolution_notes or ticket.resolution_note
    elif new_status == "CLOSED":
        ticket.closed_at = datetime.utcnow()
        ticket.resolution_note = data.resolution_notes or ticket.resolution_note

    db.commit()
    db.refresh(ticket)

    # Notify CNMS about the status change (non-blocking)
    asyncio.create_task(push_status_to_cnms(ticket))

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
def add_message(
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
        push_message_to_cnms(
            global_ticket_id = ticket.ticket_id,
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
        url     = f"{CNMS_BASE_URL}/webhook/lnms"
        payload = {
            "msg_type":        "ALARM_NEW",
            "lnms_node_id":    LNMS_NODE_ID,
            "alarm_uid":       _build_alarm_uid(ticket),
            "ticket_id":       _build_alarm_uid(ticket),
            "device_name":     ticket.device_name,
            "alarm_type":      ticket.title,
            "title":           ticket.title,
            "severity":        ticket.severity_calculated,
            "status":          _normalize_status(ticket.status),
            "description":     ticket.resolution_note or "",
            "created_at":      ticket.created_at.isoformat(),
            "last_updated_by": "LNMS",
            "sync_version":    ticket.sync_version or 1,
        }
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.post(url, json=payload, headers=_cnms_headers(), timeout=10)
            response.raise_for_status()
        match = await _find_cnms_ticket(ticket)
        if match:
            _cache_cnms_ticket_id(ticket.ticket_id, match.get("id"))
        _update_ticket_sync_state(ticket.ticket_id, sync_status="synced", sent_to_cnms=True, synced_now=True)
        print(f"✅ [LNMS→CNMS] Ticket {ticket.ticket_id} sent to CNMS")
    except Exception as e:
        try:
            _update_ticket_sync_state(ticket.ticket_id, sync_status="pending")
        except Exception:
            pass
        print(f"❌ [LNMS→CNMS] Failed to send ticket: {e}")


async def push_status_to_cnms(ticket):
    """
    [LNMS → CNMS]
    Called after LNMS updates a ticket status.
    Notifies CNMS so its copy stays in sync.
    """
    try:
        cnms_ticket = await _find_cnms_ticket(ticket)
        if not cnms_ticket:
            raise RuntimeError(f"CNMS ticket not found for {ticket.ticket_id}")

        cnms_id = cnms_ticket.get("id")
        _cache_cnms_ticket_id(ticket.ticket_id, cnms_id)

        status = _normalize_status(ticket.status)
        if status == "ACK":
            method = "PUT"
            url = f"{CNMS_BASE_URL}/tickets/{cnms_id}/ack"
            kwargs = {}
        elif status in {"RESOLVED", "CLOSED"}:
            method = "PUT"
            url = f"{CNMS_BASE_URL}/tickets/{cnms_id}/resolve"
            kwargs = {
                "json": {
                    "resolution_note": getattr(ticket, "resolution_note", None) or "Resolved from LNMS",
                }
            }
        else:
            _update_ticket_sync_state(ticket.ticket_id, sync_status="synced", synced_now=True)
            return

        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.request(method, url, timeout=10, **kwargs)
            response.raise_for_status()
        _update_ticket_sync_state(ticket.ticket_id, sync_status="synced", synced_now=True)
        print(f"✅ [LNMS→CNMS] Status '{ticket.status}' synced for {ticket.ticket_id}")
    except Exception as e:
        try:
            _update_ticket_sync_state(ticket.ticket_id, sync_status="pending")
        except Exception:
            pass
        print(f"❌ [LNMS→CNMS] Status sync failed: {e}")


async def push_message_to_cnms(global_ticket_id, sender, message_text, created_at):
    """
    [LNMS → CNMS]
    Called after an LNMS operator sends a chat message.
    Forwards it to CNMS so CNMS shows it as an incoming LNMS message (white bubble, left side).
    """
    try:
        db = SessionLocal()
        try:
            ticket = _get_ticket_by_identifier(db, global_ticket_id)
            if not ticket:
                raise RuntimeError(f"Ticket not found for message sync: {global_ticket_id}")
            cnms_ticket = await _find_cnms_ticket(ticket)
            if not cnms_ticket:
                raise RuntimeError(f"CNMS ticket not found for {ticket.ticket_id}")
            cnms_id = cnms_ticket.get("id")
            _cache_cnms_ticket_id(ticket.ticket_id, cnms_id)
        finally:
            db.close()

        payload = {
            "sender": sender,
            "message": message_text,
            "created_at": created_at,
        }
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.post(f"{CNMS_BASE_URL}/tickets/{cnms_id}/comment", json=payload, timeout=10)
            response.raise_for_status()
        _update_ticket_sync_state(global_ticket_id, sync_status="synced", synced_now=True)
        print(f"✅ [LNMS→CNMS] Message forwarded to CNMS")
    except Exception as e:
        try:
            _update_ticket_sync_state(global_ticket_id, sync_status="pending")
        except Exception:
            pass
        print(f"❌ [LNMS→CNMS] Message forward failed: {e}")

async def sync_missed_tickets():
    """
    [LNMS] Periodically fetch missed ticket statuses from CNMS.
    Updates LNMS tickets that were modified in CNMS while LNMS was offline.
    """
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        # Fetch all CNMS tickets once to reduce overhead
        async with httpx.AsyncClient() as client:
            try:
                res = await client.get(f"{CNMS_BASE_URL}/tickets", follow_redirects=True, timeout=10)
                if res.status_code != 200:
                    return
                cnms_tickets = _extract_cnms_tickets(res.json())
            except Exception as e:
                print(f"❌ [LNMS] Failed to fetch CNMS tickets: {e}")
                return

        # Fetch status for open tickets or ACKed tickets
        open_tickets = db.query(Ticket).filter(~Ticket.status.in_(("Resolved", "Closed"))).all()
        
        for ticket in open_tickets:
            try:
                # Find corresponding ticket in CNMS
                match = None
                for ct in cnms_tickets:
                    au = str(ct.get("alarm_uid", ""))
                    # CNMS may include the LNMS ticket identifier inside alarm_uid.
                    if ticket.ticket_id in au or (ticket.alarm_id and str(ticket.alarm_id) in au):
                        match = ct
                        break
                
                if not match:
                    continue
                    
                cnms_status = _normalize_status(match.get("status"))
                cnms_global_id = match.get("global_ticket_id")
                
                # Match ticket id in LNMS and CNMS!
                if cnms_global_id:
                    if not ticket.global_ticket_id:
                        ticket.global_ticket_id = cnms_global_id
                    if not ticket.correlation_id:
                        ticket.correlation_id = cnms_global_id
                if match.get("cnms_ticket_id"):
                    ticket.cnms_ticket_id = match.get("cnms_ticket_id")
                
                if cnms_status and cnms_status != _normalize_status(ticket.status) and cnms_status in VALID_STATUSES:
                    ticket.status = _status_for_db(cnms_status)
                    ticket.sync_version = (ticket.sync_version or 0) + 1
                    ticket.last_updated_by = match.get("last_updated_by") or "CNMS"
                    ticket.sync_status = "synced"
                    ticket.last_synced_at = datetime.utcnow()
                    ticket.updated_at = datetime.utcnow()
                    
                    if cnms_status == "ACK":
                        ticket.acknowledged_at = datetime.utcnow()
                    elif cnms_status in ("RESOLVED", "CLOSED"):
                        resolved_at_str = match.get("resolved_at")
                        parsed_time = _parse_dt(resolved_at_str) or datetime.utcnow()
                        ticket.resolved_at = parsed_time
                        ticket.resolution_note = match.get("resolution_note", match.get("resolution_notes", ""))
                        if cnms_status == "CLOSED":
                            ticket.closed_at = parsed_time
                    
                    print(f"✅ [LNMS] Retroactively synced {ticket.ticket_id} to status {cnms_status}")
                
            except Exception as e:
                print(f"❌ [LNMS] Failed to retroactively sync ticket {ticket.ticket_id}: {e}")
                
        db.commit()
    except Exception as e:
        print(f"❌ [LNMS] Sync job failed: {e}")
    finally:
        db.close()

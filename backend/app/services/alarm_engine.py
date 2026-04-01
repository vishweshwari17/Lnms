"""
spicnms_ticket_service.py
Unified Flow:
- Automated alarms → LNMS → SPIC → CNMS
- Manual tickets → LNMS → SPIC → CNMS
- Status updates, resolved time, resolution note synced
"""

import html
import re
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.database import SessionLocal, SessionLocal2
from app.models.tickets import Ticket

# ── DATABASE CONNECTIONS ───────────────────────────────────────────────
SPIC_DB_URL   = "mysql+pymysql://root:user_123@192.78.10.115:3306/snmp_monitor"
spic_engine   = create_engine(SPIC_DB_URL, pool_pre_ping=True)
SessionLocal3 = sessionmaker(bind=spic_engine)

SEVERITY_MAP = {"critical": "Major", "major": "Major", "minor": "Minor", "warning": "Warning"}

# ── PUBLIC ENTRY POINT ───────────────────────────────────────────────────
def process_tickets(tickets: list):
    """
    tickets: list of dicts or objects with at least:
    - alarm_id
    - device_name
    - host_name
    - severity
    - status (PROBLEM / ACTIVE / RESOLVED)
    - problem_time / resolved_time / resolution_note (optional)
    Handles both automated alarms and manual tickets.
    """
    for ticket in tickets:
        try:
            lnms_ticket_id = ensure_lnms_ticket(ticket)
            spic_ticket_id = ensure_spic_ticket(ticket, lnms_ticket_id)
            sync_to_cnms(ticket, lnms_ticket_id, spic_ticket_id)
        except Exception as e:
            print(f"[SPIC] Failed processing ticket {getattr(ticket,'alarm_id',None)}: {e}")

# ── LNMS TICKET ────────────────────────────────────────────────────────
def ensure_lnms_ticket(ticket):
    db1 = SessionLocal()
    try:
        lnms_ticket = db1.query(Ticket).filter(Ticket.alarm_id == ticket.alarm_id).first()
        if lnms_ticket:
            return lnms_ticket.ticket_id
        # Manual or auto creation
        new_ticket = Ticket(
            ticket_id = f"LNMS{int(datetime.utcnow().timestamp())}",
            alarm_id = ticket.alarm_id,
            device_name = ticket.device_name,
            host_name = getattr(ticket, "host_name", None),
            severity = ticket.severity,
            status = ticket.status or "PROBLEM",
            created_at = datetime.utcnow()
        )
        db1.add(new_ticket)
        db1.commit()
        return new_ticket.ticket_id
    finally:
        db1.close()

# ── SPIC TICKET ────────────────────────────────────────────────────────
def ensure_spic_ticket(ticket, lnms_ticket_id):
    db3 = SessionLocal3()
    try:
        # Check if SPIC ticket already exists
        row = db3.execute(text("SELECT unique_ticket_id FROM tickets WHERE global_ticket_id=:gid"), {"gid": lnms_ticket_id}).fetchone()
        if row:
            return row[0]
        # Insert SPIC ticket
        severity = SEVERITY_MAP.get((ticket.severity or "").lower(), "Minor")
        title = html.escape(getattr(ticket, "alarm_name", "Unknown Alarm"))
        device_name = html.escape(ticket.device_name or "")
        ip_address = getattr(ticket, "ip_address", None)
        description = (
            f"Ticket from LNMS alarm. Alarm ID: {ticket.alarm_id} | "
            f"Host: {getattr(ticket,'host_name','')} | Device: {ticket.device_name} | "
            f"Severity: {ticket.severity} | Detected: {getattr(ticket,'problem_time',datetime.utcnow())}"
        )
        node_id_num, node_pad = _get_node_id(db3)
        unique_ticket_id, serial = _generate_unique_ticket_id(db3, node_pad)
        db3.execute(text("""
            INSERT INTO tickets (
                unique_ticket_id,node_id,ticket_serial_4d,
                title,device_name,ip_address,severity,description,
                status,global_ticket_id,sent_to_central,created_at,updated_at
            ) VALUES (
                :uid,:node_id,:serial,:title,:device,:ip,:sev,:desc,'Open',:gid,0,NOW(),NOW()
            )
        """), {
            "uid": unique_ticket_id,
            "node_id": node_id_num,
            "serial": serial,
            "title": title,
            "device": device_name,
            "ip": ip_address,
            "sev": severity,
            "desc": description,
            "gid": lnms_ticket_id
        })
        db3.commit()
        _write_back_global_id(lnms_ticket_id, unique_ticket_id)
        return unique_ticket_id
    finally:
        db3.close()

# ── CNMS SYNC ─────────────────────────────────────────────────────────
def sync_to_cnms(ticket, lnms_ticket_id, spic_ticket_id):
    db2 = SessionLocal2()
    try:
        cnms_ticket = db2.query(Ticket).filter(Ticket.ticket_id == lnms_ticket_id).first()
        if not cnms_ticket:
            cnms_ticket = Ticket(
                ticket_id = lnms_ticket_id,
                global_ticket_id = spic_ticket_id,
                device_name = ticket.device_name,
                host_name = getattr(ticket, "host_name", None),
                severity = ticket.severity,
                status = ticket.status or "PROBLEM",
                created_at = datetime.utcnow()
            )
            db2.add(cnms_ticket)
        else:
            cnms_ticket.status = ticket.status or cnms_ticket.status
            if cnms_ticket.status.upper() == "RESOLVED":
                cnms_ticket.resolved_time = getattr(ticket, "resolved_time", datetime.utcnow())
                cnms_ticket.resolution_note = getattr(ticket, "resolution_note", "Auto-resolved")
        db2.commit()
    finally:
        db2.close()

# ── HELPERS ───────────────────────────────────────────────────────────
def _write_back_global_id(ticket_id, spic_ticket_id):
    db1 = SessionLocal()
    db2 = SessionLocal2()
    try:
        db1.query(Ticket).filter(Ticket.ticket_id==ticket_id).update({"global_ticket_id":spic_ticket_id})
        db1.commit()
        db2.query(Ticket).filter(Ticket.ticket_id==ticket_id).update({"global_ticket_id":spic_ticket_id})
        db2.commit()
    finally:
        db1.close()
        db2.close()

def _get_node_id(db3):
    for table in ("nodal_helpdesk_encryption_settings","nodal_encryption_settings"):
        try:
            row=db3.execute(text(f"SELECT node_id FROM {table} ORDER BY updated_at DESC LIMIT 1")).fetchone()
            if row and row[0]:
                n=int(re.search(r"(\d+)",str(row[0])).group(1))
                return n,str(n).zfill(3)
        except: continue
    return 123,"123"

def _generate_unique_ticket_id(db3,node_pad):
    row=db3.execute(text("SELECT MAX(ticket_serial_4d) FROM tickets WHERE unique_ticket_id LIKE :p"),{"p":f"TKT{node_pad}%"}).fetchone()
    last_serial=int(row[0]) if row and row[0] else 0
    for _ in range(10000):
        serial=(last_serial%9999)+1
        candidate=f"TKT{node_pad}{str(serial).zfill(4)}"
        exists=db3.execute(text("SELECT 1 FROM tickets WHERE unique_ticket_id=:uid"),{"uid":candidate}).fetchone()
        if not exists: return candidate,serial
        last_serial=serial
    raise Exception(f"Cannot allocate unique_ticket_id for node {node_pad}")
import sys
import time
from datetime import datetime
from pathlib import Path

import httpx
from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal2
from app.services.spicnms_ticket import sync_manual_spicnms_tickets

CNMS_BASE_URL = "http://127.0.0.1:8001"

def wait_for(predicate, *, timeout=30, interval=2, label="condition"):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = predicate()
        if last:
            return last
        time.sleep(interval)
    raise RuntimeError(f"Timed out waiting for {label}")

def fetch_cnms_tickets():
    with httpx.Client(timeout=10, follow_redirects=True) as client:
        response = client.get(f"{CNMS_BASE_URL}/tickets")
        response.raise_for_status()
        return response.json()

def find_cnms_ticket_for_alarm(alarm_uid: str):
    tickets = fetch_cnms_tickets()
    for ticket in tickets:
        if (
            ticket.get("alarm_uid") == alarm_uid
            or ticket.get("ticket_uid") == alarm_uid
            or ticket.get("short_id") == alarm_uid
        ):
            return ticket
    return None

def resolve_from_cnms(cnms_ticket_id: int, note: str):
    with httpx.Client(timeout=10, follow_redirects=True) as client:
        ack_response = client.put(f"{CNMS_BASE_URL}/tickets/{cnms_ticket_id}/ack")
        ack_response.raise_for_status()
        resolve_response = client.put(
            f"{CNMS_BASE_URL}/tickets/{cnms_ticket_id}/resolve",
            json={"resolution_note": note},
        )
        resolve_response.raise_for_status()

def fetch_verified_resolved_ticket(unique_ticket_id: str):
    db2 = SessionLocal2()
    try:
        row = db2.execute(
            text("SELECT status FROM tickets WHERE unique_ticket_id = :uid"),
            {"uid": unique_ticket_id}
        ).fetchone()
        if row and row[0].lower() in ("resolved", "closed"):
            return {"status": row[0]}
        return None
    finally:
        db2.close()

def main():
    manual_uid = f"TKT12300{int(time.time() % 100):02d}"
    print(f"Generating test manual ticket: {manual_uid}")
    
    db2 = SessionLocal2()
    try:
        db2.execute(text("""
            INSERT INTO tickets (
                unique_ticket_id, title, device_name, severity, status, 
                sent_to_central, alarm_id, node_id, ticket_serial_4d, description, created_at, updated_at
            ) VALUES (
                :uid, 'hardware issue', 'Cisco_Router', 'Major', 'Open', 0, NULL, 1, 1, 'Manual ticket text', NOW(), NOW()
            )
        """), {"uid": manual_uid})
        db2.commit()
    finally:
        db2.close()
    
    # Process it
    synced_ids = sync_manual_spicnms_tickets()
    print(f"Engine processed manual sync ids: {synced_ids}")
    
    # Check CNMS tracking
    alarm_uid = manual_uid  # Because alarm_id is null, it falls back to ticket_id which is manual_uid
    cnms_ticket = wait_for(
        lambda: find_cnms_ticket_for_alarm(alarm_uid),
        timeout=40,
        interval=2,
        label="Manual SPIC-NMS ticket in CNMS",
    )
    print(f"CNMS ticket id: {cnms_ticket['id']}, status={cnms_ticket['status']}")

    # Resolve from CNMS
    note = "Testing manual ticket resolution from CNMS sync loop"
    resolve_from_cnms(int(cnms_ticket["id"]), note)

    # Verify SPIC-NMS legacy ticket updated natively
    verified = wait_for(
        lambda: fetch_verified_resolved_ticket(manual_uid),
        timeout=40,
        interval=2,
        label="Manual SPIC LNMS legacy resolve sync",
    )
    print(f"Verified legacy manual LNMS sync: status={verified['status']}")

if __name__ == "__main__":
    main()

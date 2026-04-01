import sys
import time
from datetime import datetime
from pathlib import Path

import httpx
from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal2, drop_legacy_alarm_trigger
from app.routers.alarms import create_alarm
from app.schemas import AlarmCreate
from app.services.spicnms_ticket import create_spicnms_tickets

CNMS_BASE_URL = "http://127.0.0.1:8001"

def now_marker() -> str:
    return datetime.utcnow().strftime("%Y%m%d%H%M%S")

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

def create_alarm_via_json(marker: str) -> dict:
    db = SessionLocal2()
    try:
        alarm = AlarmCreate(
            host_name=f"json-host-{marker}",
            device_name=f"json-device-{marker}",
            ip_address="10.10.10.10",
            severity="critical",
            alarm_name=f"JSON Alarm {marker}",
            description=f"automation-json-{marker}",
            parameter_data={"source": "json", "marker": marker},
            status="open",
        )
        result = create_alarm(alarm, db)
        return {"alarm_id": result.alarm_id}
    finally:
        db.close()

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
    drop_legacy_alarm_trigger()
    marker = now_marker()
    print(f"marker={marker}")
    
    # 1. Create alarm
    json_alarm = create_alarm_via_json(marker)
    alarm_id = int(json_alarm["alarm_id"])
    print(f"[SPIC-NMS flow] alarm_id={alarm_id}")
    
    # 2. Process SPIC-NMS ticket generator directly
    created_ids = create_spicnms_tickets()
    print(f"[SPIC-NMS flow] engine created ticket ids: {created_ids}")
    if not created_ids:
        raise RuntimeError("No tickets created")
    
    ticket_id = created_ids[0]
    print(f"[SPIC-NMS flow] SPIC unique_ticket_id: {ticket_id}")
    
    # 3. Wait for CNMS ticket
    alarm_uid = f"COMPANY-ALM-{alarm_id}"
    cnms_ticket = wait_for(
        lambda: find_cnms_ticket_for_alarm(alarm_uid),
        timeout=40,
        interval=2,
        label="SPIC-NMS CNMS ticket",
    )
    print(f"[SPIC-NMS flow] CNMS ticket id: {cnms_ticket['id']}, status={cnms_ticket['status']}")

    # 4. Resolve from CNMS
    note = "SPIC-NMS flow resolved via CNMS webhook test"
    resolve_from_cnms(int(cnms_ticket["id"]), note)

    # 5. Verify local legacy SPIC ticket is resolved
    verified = wait_for(
        lambda: fetch_verified_resolved_ticket(ticket_id),
        timeout=40,
        interval=2,
        label="SPIC LNMS legacy resolve sync",
    )
    print(f"[SPIC-NMS flow] verified LNMS sync: status={verified['status']}")

if __name__ == "__main__":
    main()

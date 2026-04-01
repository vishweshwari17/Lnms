"""Exercise LNMS ticket automation against the live LNMS/CNMS services.

What it tests:
1. SPIC-NMS Flow: alarm inserted via JSON API (to snmp_monitor db2) -> SPIC ticket created -> CNMS ticket created
2. LNMS Flow: alarm inserted via raw SQL (to lnms_db db1) -> LNMS ticket created -> CNMS ticket created
3. CNMS ACK / RESOLVE flows push status, resolution note, and resolved time back into LNMS tickets table
"""

import sys
import time
from datetime import datetime
from pathlib import Path

import httpx
from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal, SessionLocal2, drop_legacy_alarm_trigger  # noqa: E402
from app.routers.alarms import create_alarm  # noqa: E402
from app.schemas import AlarmCreate  # noqa: E402
from app.services.lnms_ticket import create_lnms_tickets  # noqa: E402
from app.services.spicnms_ticket import create_spicnms_tickets  # noqa: E402

LNMS_BASE_URL = "http://127.0.0.1:8000"
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


def fetch_lnms_tickets():
    with httpx.Client(timeout=10) as client:
        response = client.get(f"{LNMS_BASE_URL}/tickets/")
        response.raise_for_status()
        return response.json()["tickets"]


def fetch_cnms_tickets():
    with httpx.Client(timeout=10, follow_redirects=True) as client:
        response = client.get(f"{CNMS_BASE_URL}/tickets")
        response.raise_for_status()
        return response.json()


def create_alarm_via_json(marker: str) -> dict:
    # This simulates SPIC-NMS flow (since routers currently save alarms to db2)
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
        return {
            "alarm_id": result.alarm_id,
            "alarm_name": result.alarm_name,
            "ticket_created": result.ticket_created,
        }
    finally:
        db.close()


def insert_alarm_in_lnms_db(marker: str) -> int:
    # This simulates LNMS flow (alarms coming into lnms_db / db1)
    db = SessionLocal()
    try:
        db.execute(
            text(
                """
                INSERT INTO alarms
                    (host_name, device_name, ip_address, severity, alarm_name,
                     description, parameter_data, problem_time, status, created_at, ticket_created)
                VALUES
                    (:host_name, :device_name, :ip_address, :severity, :alarm_name,
                     :description, :parameter_data, NOW(), :status, NOW(), 0)
                """
            ),
            {
                "host_name": f"db-host-{marker}",
                "device_name": f"db-device-{marker}",
                "ip_address": "10.20.20.20",
                "severity": "Critical",
                "alarm_name": f"DB Alarm {marker}",
                "description": f"automation-db-{marker}",
                "parameter_data": '{"source":"db","marker":"%s"}' % marker,
                "status": "OPEN",
            },
        )
        db.commit()
        from sqlalchemy.orm import Session
        result = db.execute(
            text("SELECT alarm_id FROM alarms WHERE parameter_data LIKE :marker ORDER BY alarm_id DESC LIMIT 1"),
            {"marker": f'%{marker}%'}
        ).scalar()
        return int(result)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def find_lnms_ticket_for_alarm(alarm_id: int):
    tickets = fetch_lnms_tickets()
    for ticket in tickets:
        if ticket.get("alarm_id") == alarm_id:
            return ticket
    return None


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


def fetch_lnms_ticket(ticket_id: str):
    with httpx.Client(timeout=10) as client:
        response = client.get(f"{LNMS_BASE_URL}/tickets/{ticket_id}")
        response.raise_for_status()
        return response.json()


def fetch_verified_resolved_ticket(ticket_id: str, note: str):
    ticket = fetch_lnms_ticket(ticket_id)
    if (
        ticket.get("status") == "RESOLVED"
        and ticket.get("resolution_note") == note
        and ticket.get("resolved_at")
    ):
        return ticket
    return None


def run_case(label: str, alarm_id: int, processor_func, alarm_uid_prefix: str):
    print(f"\n[{label}] alarm_id={alarm_id}")
    created = processor_func()
    print(f"[{label}] engine created ticket ids: {created}")

    lnms_ticket = wait_for(
        lambda: find_lnms_ticket_for_alarm(alarm_id),
        timeout=40,
        interval=2,
        label=f"{label} LNMS ticket",
    )
    print(f"[{label}] LNMS unified ticket: {lnms_ticket['ticket_id']} with node: {lnms_ticket.get('lnms_node_id')}")
    
    # Notice that we expect LNMS to prefix with LOCAL-ALM- followed by ticket_id or alarm_id 
    # depending on what router does. Actually routers/tickets.py logic uses LOCAL-ALM-{alarm_id}
    # For SPIC, we expect the same logic `LOCAL-ALM-{alarm_id}` since they all go through `send_ticket_to_cnms`.
    alarm_uid = f"LOCAL-ALM-{alarm_id}"

    cnms_ticket = wait_for(
        lambda: find_cnms_ticket_for_alarm(alarm_uid),
        timeout=40,
        interval=2,
        label=f"{label} CNMS ticket",
    )
    print(f"[{label}] CNMS ticket id: {cnms_ticket['id']}, status={cnms_ticket['status']}, origing_node={cnms_ticket.get('lnms_node_id', 'unknown')}")

    note = f"{label} resolved via CNMS"
    resolve_from_cnms(int(cnms_ticket["id"]), note)

    verified = wait_for(
        lambda: fetch_verified_resolved_ticket(lnms_ticket["ticket_id"], note),
        timeout=40,
        interval=2,
        label=f"{label} LNMS resolve sync",
    )
    print(
        f"[{label}] verified LNMS sync:"
        f" status={verified['status']},"
        f" resolved_at={verified['resolved_at']},"
        f" resolution_note={verified['resolution_note']}"
    )
    return {
        "alarm_id": alarm_id,
        "ticket_id": lnms_ticket["ticket_id"],
        "cnms_ticket_id": cnms_ticket["id"],
        "status": verified["status"],
        "resolved_at": verified["resolved_at"],
        "resolution_note": verified["resolution_note"],
    }


def main():
    drop_legacy_alarm_trigger()
    marker = now_marker()
    print(f"marker={marker}")

    # Flow 1: SPIC NMS simulating alarms via API inserting into snmp_monitor
    json_alarm = create_alarm_via_json(marker)
    json_result = run_case("SPIC-NMS flow", int(json_alarm["alarm_id"]), create_spicnms_tickets, "LOCAL-ALM-")

    # Flow 2: LNMS simulating alarms in lnms_db
    db_alarm_id = insert_alarm_in_lnms_db(marker)
    db_result = run_case("LNMS flow", db_alarm_id, create_lnms_tickets, "LOCAL-ALM-")

    print("\nSUMMARY")
    for item in (json_result, db_result):
        print(item)


if __name__ == "__main__":
    main()

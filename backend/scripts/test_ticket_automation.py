"""Exercise LNMS ticket automation against the live LNMS/CNMS services.

What it tests:
1. alarm inserted via LNMS JSON API -> LNMS ticket auto-created -> CNMS ticket created
2. alarm inserted directly into snmp_monitor DB -> LNMS ticket auto-created -> CNMS ticket created
3. CNMS ACK / RESOLVE flows push status, resolution note, and resolved time back into LNMS

This script intentionally creates real test alarms/tickets with a unique marker.
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

from app.database import SessionLocal2, drop_legacy_alarm_trigger  # noqa: E402
from app.routers.alarms import create_alarm  # noqa: E402
from app.schemas import AlarmCreate  # noqa: E402
from app.services.lnms_ticket import create_lnms_tickets  # noqa: E402

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


def insert_alarm_in_db(marker: str) -> int:
    db = SessionLocal2()
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
        alarm_id = db.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        return int(alarm_id)
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


def find_cnms_ticket_for_alarm(alarm_id: int):
    alarm_uid = f"LOCAL-ALM-{alarm_id}"
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


def run_case(label: str, alarm_id: int):
    print(f"\n[{label}] alarm_id={alarm_id}")
    created = create_lnms_tickets()
    print(f"[{label}] engine created ticket ids: {created}")

    lnms_ticket = wait_for(
        lambda: find_lnms_ticket_for_alarm(alarm_id),
        timeout=40,
        interval=2,
        label=f"{label} LNMS ticket",
    )
    print(f"[{label}] LNMS ticket: {lnms_ticket['ticket_id']}")

    cnms_ticket = wait_for(
        lambda: find_cnms_ticket_for_alarm(alarm_id),
        timeout=40,
        interval=2,
        label=f"{label} CNMS ticket",
    )
    print(f"[{label}] CNMS ticket id: {cnms_ticket['id']}, status={cnms_ticket['status']}")

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

    json_alarm = create_alarm_via_json(marker)
    json_result = run_case("json", int(json_alarm["alarm_id"]))

    db_alarm_id = insert_alarm_in_db(marker)
    db_result = run_case("db", db_alarm_id)

    print("\nSUMMARY")
    for item in (json_result, db_result):
        print(item)


if __name__ == "__main__":
    main()

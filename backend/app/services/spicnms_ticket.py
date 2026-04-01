import re
import html
from types import SimpleNamespace
from datetime import datetime
from sqlalchemy import func, text
from app.database import SessionLocal2
from app.models.status_alarms import StatusAlarm

SOURCE_OPEN_STATUSES = ("open", "ack")
SEVERITY_MAP = {"critical": "Major", "major": "Major", "minor": "Minor", "warning": "Warning"}

def _get_node_id(db):
    for table in ("nodal_helpdesk_encryption_settings", "nodal_encryption_settings"):
        try:
            row = db.execute(text(f"SELECT node_id FROM {table} ORDER BY updated_at DESC LIMIT 1")).fetchone()
            if row and row[0]:
                n = int(re.search(r"(\d+)", str(row[0])).group(1))
                return n, str(n).zfill(3)
        except:
            continue
    return 123, "123"

def _generate_unique_ticket_id(db, node_pad):
    row = db.execute(text("SELECT MAX(ticket_serial_4d) FROM tickets WHERE unique_ticket_id LIKE :p"), {"p": f"TKT{node_pad}%"}).fetchone()
    last_serial = int(row[0]) if row and row[0] else 0
    for _ in range(10000):
        serial = (last_serial % 9999) + 1
        candidate = f"TKT{node_pad}{str(serial).zfill(4)}"
        exists = db.execute(text("SELECT 1 FROM tickets WHERE unique_ticket_id=:uid"), {"uid": candidate}).fetchone()
        if not exists:
            return candidate, serial
        last_serial = serial
    raise Exception(f"Cannot allocate unique_ticket_id for node {node_pad}")

def create_spicnms_tickets():
    db2 = SessionLocal2() # snmp_monitor
    created = []

    try:
        existing_alarm_ids = {
            str(alarm_id)
            for (alarm_id,) in db2.execute(text("SELECT DISTINCT alarm_id FROM tickets WHERE alarm_id IS NOT NULL")).fetchall()
        }
        alarms = db2.query(StatusAlarm).filter(
            func.lower(StatusAlarm.status) == "problem",
        ).all()

        for alarm in alarms:
            alarm_id_str = str(alarm.id)
            if alarm_id_str in existing_alarm_ids:
                continue

            node_id_num, node_pad = _get_node_id(db2)
            unique_ticket_id, serial = _generate_unique_ticket_id(db2, node_pad)

            severity = SEVERITY_MAP.get((alarm.severity or "").lower(), "Minor")
            title = html.escape(getattr(alarm, "alarm_type", "Unknown Alarm") or "Unknown Alarm")
            device_name = html.escape(alarm.device_name or "")
            ip_address = None
            description = (
                f"Ticket from SPIC-NMS alarm. Alarm ID: {alarm.id} | "
                f"Device: {alarm.device_name} | "
                f"Severity: {alarm.severity} | Detected: {getattr(alarm,'timestamp',datetime.utcnow())}"
            )
            
            db2.execute(text("""
                INSERT INTO tickets (
                    unique_ticket_id, node_id, ticket_serial_4d,
                    title, device_name, ip_address, severity, description,
                    status, alarm_id, sent_to_central, created_at, updated_at
                ) VALUES (
                    :uid, :node_id, :serial, :title, :device, :ip, :sev, :desc, 'Open', :aid, 0, NOW(), NOW()
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
                "aid": alarm.id
            })
            
            # Mock object for sync
            ticket_obj = SimpleNamespace(
                ticket_id = unique_ticket_id,
                alarm_id = alarm.id,
                global_ticket_id = unique_ticket_id,
                device_name = device_name,
                title = title,
                severity_calculated = severity,
                status = "Open",
                resolution_note = "",
                created_at = datetime.utcnow(),
                sync_version = 1,
                lnms_node_id = "LNMS-COMPANY-01",
                cnms_ticket_id = None,
                correlation_id = None
            )
            created.append(ticket_obj)
            existing_alarm_ids.add(alarm_id_str)

        db2.commit()
        
        if created:
            from app.routers.tickets import send_ticket_to_cnms
            import asyncio
            for ticket_obj in created:
                try:
                    asyncio.run(send_ticket_to_cnms(ticket_obj))
                except Exception as e:
                    print(f"Failed to auto-forward SPIC legacy ticket to CNMS: {e}")

        return [t.ticket_id for t in created]

    except Exception:
        db2.rollback()
        raise
    finally:
        db2.close()

def sync_manual_spicnms_tickets():
    """Polls snmp_monitor for tickets generated manually via the PHP Helpdesk (sent_to_central=0)"""
    db2 = SessionLocal2()
    synced_ids = []

    try:
        # Fetch tickets not yet sent to central
        manual_tickets = db2.execute(text("SELECT unique_ticket_id, title, device_name, severity, status, created_at, alarm_id FROM tickets WHERE sent_to_central = 0 OR sent_to_central IS NULL")).fetchall()

        if not manual_tickets:
            return []

        from app.routers.tickets import send_ticket_to_cnms
        import asyncio

        for row in manual_tickets:
            unique_ticket_id = row[0]
            title = row[1] or "Manual SPIC Ticket"
            device_name = row[2] or ""
            severity = row[3] or "Minor"
            status = row[4] or "Open"
            created_at = row[5] or datetime.utcnow()
            alarm_id = row[6]

            # Mock object for sync
            ticket_obj = SimpleNamespace(
                ticket_id = unique_ticket_id,
                alarm_id = alarm_id,
                global_ticket_id = unique_ticket_id,
                device_name = device_name,
                title = title,
                severity_calculated = severity,
                status = status,
                resolution_note = "",
                created_at = created_at,
                sync_version = 1,
                lnms_node_id = "LNMS-COMPANY-01",
                cnms_ticket_id = None,
                correlation_id = None
            )

            try:
                asyncio.run(send_ticket_to_cnms(ticket_obj))
                
                # Mark as sent
                db2.execute(text("UPDATE tickets SET sent_to_central = 1 WHERE unique_ticket_id = :uid"), {"uid": unique_ticket_id})
                synced_ids.append(unique_ticket_id)
            except Exception as e:
                print(f"Failed to auto-forward manual SPIC legacy ticket {unique_ticket_id} to CNMS: {e}")

        db2.commit()
        return synced_ids

    except Exception:
        db2.rollback()
        raise
    finally:
        db2.close()

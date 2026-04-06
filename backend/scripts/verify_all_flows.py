import sys
import os
import asyncio
from datetime import datetime
from sqlalchemy import text

# Add the backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal, SessionLocal2
from app.models.alarms import Alarm
from app.models.status_alarms import StatusAlarm
from app.models.tickets import Ticket
from app.models.status_tickets import StatusTicket
from app.services.alarm_to_ticket import process_all_alarms

async def verify_flows():
    db_lnms = SessionLocal()
    db_spic = SessionLocal2()
    
    try:
        print("--- Verifying Flow 1 (LNMS) ---")
        # 1. Insert LNMS Alarm
        lnms_alarm = Alarm(
            host_name="TEST-HOST-LNMS",
            device_name="TEST-DEVICE-LNMS",
            ip_address="1.1.1.1",
            severity="Major",
            alarm_name="LNMS Test Alarm",
            status="Open",
            created_at=datetime.utcnow(),
            ticket_created=False
        )
        db_lnms.add(lnms_alarm)
        db_lnms.commit()
        db_lnms.refresh(lnms_alarm)
        print(f"Inserted LNMS alarm {lnms_alarm.alarm_id}")

        print("\n--- Verifying Flow 2 (SPIC) ---")
        # 2. Insert SPIC Alarm
        spic_alarm = StatusAlarm(
            device_id=11202, # Valid ID from previous check
            device_name="OTU_Fiber",
            timestamp=datetime.utcnow(),
            alarm_type="SNMP",
            status="PROBLEM",
            severity="major",
            exported_to_central=0
        )
        db_spic.add(spic_alarm)
        db_spic.commit()
        db_spic.refresh(spic_alarm)
        print(f"Inserted SPIC alarm {spic_alarm.id}")

        print("\n--- Processing Alarms ---")
        await process_all_alarms()

        print("\n--- Checking Results ---")
        
        # Check Flow 1 Result
        lnms_tkt = db_lnms.query(Ticket).filter(Ticket.alarm_id == lnms_alarm.alarm_id).first()
        if lnms_tkt:
            print(f"Flow 1 Success: Ticket {lnms_tkt.ticket_id} created in LNMS DB.")
            print(f"Flow 1 CNMS Sync Status: {lnms_tkt.sync_status}, Sent At: {lnms_tkt.sent_to_cnms_at}")
        else:
            print("Flow 1 Failure: No ticket found in LNMS DB.")

        # Check Flow 2 Result
        spic_tkt = db_spic.query(StatusTicket).filter(StatusTicket.alarm_id == spic_alarm.id).first()
        if spic_tkt:
            print(f"Flow 2 Success: Ticket {spic_tkt.unique_ticket_id} created in SPIC DB (snmp_monitor).")
            print(f"Flow 2 CNMS Sync Status: Sent At: {spic_tkt.sent_at}")
        else:
            print("Flow 2 Failure: No ticket found in SPIC DB.")

    except Exception as e:
        print(f"Verification Error: {e}")
    finally:
        db_lnms.close()
        db_spic.close()

if __name__ == "__main__":
    asyncio.run(verify_flows())

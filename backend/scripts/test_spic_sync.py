import sys
import os
from datetime import datetime
from sqlalchemy import text

# Add the backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal2
from app.models.status_alarms import StatusAlarm

def test_insertion():
    db = SessionLocal2()
    try:
        # 1. Insert a test alarm into status_alarms
        new_alarm = StatusAlarm(
            device_id=11202,
            device_name="OTU_Fiber",
            timestamp=datetime.utcnow(),
            alarm_type="ICMP",
            status="PROBLEM",
            severity="critical",
            exported_to_central=0
        )
        db.add(new_alarm)
        db.commit()
        db.refresh(new_alarm)
        print(f"Inserted test alarm with ID: {new_alarm.id}")

        # 2. Re-import and run the processing logic manually to see it happen immediately
        from app.services.alarm_to_ticket import process_spic_alarms
        import asyncio
        
        # We need an event loop
        loop = asyncio.get_event_loop()
        loop.run_until_complete(process_spic_alarms())
        
        # 3. Check if ticket exists in snmp_monitor.tickets
        from app.models.status_tickets import StatusTicket
        ticket = db.query(StatusTicket).filter(StatusTicket.alarm_id == new_alarm.id).first()
        
        if ticket:
            print(f"Success! Ticket created in SPIC database: {ticket.unique_ticket_id}")
        else:
            print("Failure: No ticket found in SPIC database.")

    except Exception as e:
        print(f"Error during test: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_insertion()

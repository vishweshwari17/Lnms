import sys
import os
from sqlalchemy.orm import Session
from datetime import datetime

# Add the backend directory to sys.path to import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models import Alarm, Ticket
from app.services.alarm_engine import process_tickets

def rectify():
    db = SessionLocal()
    try:
        # Get all alarms
        alarms = db.query(Alarm).all()
        print(f"Found {len(alarms)} total alarms.")

        alarms_without_tickets = []
        for alarm in alarms:
            # Check if ticket exists
            ticket_exists = db.query(Ticket).filter(Ticket.alarm_id == alarm.alarm_id).first()
            if not ticket_exists:
                alarms_without_tickets.append(alarm)

        print(f"Found {len(alarms_without_tickets)} alarms without tickets.")

        if not alarms_without_tickets:
            print("Everything is in sync.")
            return

        # Prepare for process_tickets
        # The alarm_engine expects objects/dicts with specific fields
        # process_tickets(tickets: list)
        
        process_tickets(alarms_without_tickets)
        
        # Mark as ticket_created in alarms table
        for alarm in alarms_without_tickets:
            alarm.ticket_created = True
        
        db.commit()
        print(f"Successfully processed {len(alarms_without_tickets)} alarms.")

    except Exception as e:
        print(f"Error during rectification: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    rectify()

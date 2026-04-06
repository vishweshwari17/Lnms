import sys
import os

# Add the backend directory to sys.path to import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models import Alarm, Ticket

def count():
    db = SessionLocal()
    try:
        alarm_count = db.query(Alarm).count()
        ticket_count = db.query(Ticket).count()
        
        # Count alarms without tickets
        alarms_without_tickets = 0
        alarms = db.query(Alarm).all()
        for alarm in alarms:
            ticket_exists = db.query(Ticket).filter(Ticket.alarm_id == alarm.alarm_id).first()
            if not ticket_exists:
                alarms_without_tickets += 1
                
        print(f"Total Alarms: {alarm_count}")
        print(f"Total Tickets: {ticket_count}")
        print(f"Alarms without Tickets: {alarms_without_tickets}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    count()

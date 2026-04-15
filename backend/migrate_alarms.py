import os
import sys

# Add backend directory to sys path so app can be imported properly
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

import asyncio
from app.database import SessionLocal
from app.models.alarms import Alarm
from app.services.incident_service import IncidentService

def migrate():
    db = SessionLocal()
    alarms = db.query(Alarm).all()
    print(f"Found {len(alarms)} historical alarms in DB. Migrating to Incidents Engine...")
    
    for a in alarms:
        try:
            IncidentService.process_alarm(db, a)
        except Exception as e:
            print(f"Failed migration for alarm {a.alarm_id}: {e}")
            
    print("Migration complete. Incident Dashboard should be populated.")
    db.close()

if __name__ == "__main__":
    migrate()

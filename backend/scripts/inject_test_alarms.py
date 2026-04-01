import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from app.database import SessionLocal, SessionLocal2
from app.models.alarms import Alarm
from app.models.status_alarms import StatusAlarm

def inject():
    db = SessionLocal()
    db2 = SessionLocal2()

    try:
        # 1. LNMS
        new_lnms = Alarm(
            host_name="TEST-LNMS-HOST",
            device_name="TEST-LNMS-DEVICE",
            ip_address="192.168.10.10",
            severity="Critical",
            alarm_name="TEST PING FAIL",
            status="Open",
            problem_time=datetime.utcnow(),
            ticket_created=False
        )
        db.add(new_lnms)
        db.commit()
        db.refresh(new_lnms)
        print(f"✅ Injected LNMS Alarm ID: {new_lnms.alarm_id}")

        # 2. SPIC-NMS
        new_spic = StatusAlarm(
            device_name="TEST-SPIC-DEVICE",
            alarm_type="ICMP",
            severity="Major",
            status="PROBLEM",
            timestamp=datetime.utcnow()
        )
        db2.add(new_spic)
        db2.commit()
        db2.refresh(new_spic)
        print(f"✅ Injected SPIC Alarm ID: {new_spic.id}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        db.close()
        db2.close()

if __name__ == "__main__":
    inject()

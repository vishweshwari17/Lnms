#!/usr/bin/env python
import sys
sys.path.insert(0, '/home/nms/LNMS_PROJECT/backend')

try:
    from app.database import SessionLocal
    from app.models import Alarm
    
    print("✓ Imports successful")
    
    db = SessionLocal()
    print("✓ Database connection created")
    
    alarms = db.query(Alarm).all()
    print(f"✓ Query successful. Found {len(alarms)} alarms")
    
    for alarm in alarms[:3]:
        print(f"  - {alarm.alarm_id}: {alarm.device_name}")
    
    db.close()
    
except Exception as e:
    print(f"✗ Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from app.database import SessionLocal, SessionLocal2
from app.models.tickets import Ticket
from sqlalchemy import text
import uuid

def inject_manual():
    db = SessionLocal()
    db2 = SessionLocal2()

    try:
        # LNMS Manual Ticket
        lnms_uid = f"TKT-MANUAL-LNMS-{str(uuid.uuid4())[:6].upper()}"
        db.execute(text("""
            INSERT INTO tickets (
                ticket_id, global_ticket_id, title, device_name, host_name, ip_address,
                severity_original, severity_calculated, status, priority_level,
                occurrence_count, sent_to_cnms_at, created_at
            ) VALUES (
                :uid, :uid, 'Manual LNMS User Report', 'OFFICE-ROUTER-1', 'OFFICE-ROUTER-1', '10.10.20.1',
                'High', 'High', 'Open', 'P2',
                1, NULL, NOW()
            )
        """), {"uid": lnms_uid})
        db.commit()
        print(f"✅ Injected Manual LNMS Ticket: {lnms_uid}")

        # SPIC-NMS Manual Ticket
        spic_uid = f"TKT-MAN{str(uuid.uuid4())[:4].upper()}"
        db2.execute(text("""
            INSERT INTO tickets (
                unique_ticket_id, node_id, ticket_serial_4d, 
                title, device_name, severity, status, description,
                sent_to_central, created_at, updated_at
            ) VALUES (
                :uid, 123, 9999,
                'Manual SPIC PHP Report', 'SPIC-SWITCH-02', 'Major', 'Open', '',
                0, NOW(), NOW()
            )
        """), {"uid": spic_uid})
        db2.commit()
        print(f"✅ Injected Manual SPIC-NMS Ticket: {spic_uid}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        db.close()
        db2.close()

if __name__ == "__main__":
    inject_manual()

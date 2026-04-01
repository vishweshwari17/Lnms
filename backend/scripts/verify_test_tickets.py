import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, SessionLocal2
from app.models.tickets import Ticket
from sqlalchemy import text
from app.main import alarm_engine_job

def verify():
    db = SessionLocal()
    db2 = SessionLocal2()

    try:
        # LNMS Tickets
        lnms_tickets = db.query(Ticket).filter(Ticket.device_name == "TEST-LNMS-DEVICE").all()
        print(f"--- LNMS Tickets ({len(lnms_tickets)}) ---")
        for t in lnms_tickets:
            print(f"Ticket ID: {t.ticket_id} | Alarm ID: {t.alarm_id} | Status: {t.status} | SentToCentral: {t.sent_to_cnms_at}")

        # SPIC Tickets
        spic_tickets = db2.execute(text("SELECT unique_ticket_id, alarm_id, status, sent_to_central FROM tickets WHERE device_name = 'TEST-SPIC-DEVICE'")).fetchall()
        print(f"\n--- SPIC Tickets ({len(spic_tickets)}) ---")
        for t in spic_tickets:
            print(f"Ticket ID: {t[0]} | Alarm ID: {t[1]} | Status: {t[2]} | SentToCentral: {t[3]}")

    finally:
        db.close()
        db2.close()

if __name__ == "__main__":
    verify()

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, SessionLocal2
from app.models.tickets import Ticket
from sqlalchemy import text
from app.main import alarm_engine_job

def verify():
    # Force the ticketing loop to run
    print("Forcing ticket engine to process missed/manual tickets...")
    alarm_engine_job()

    db = SessionLocal()
    db2 = SessionLocal2()

    try:
        # LNMS Tickets
        lnms_tickets = db.query(Ticket).filter(Ticket.device_name == "OFFICE-ROUTER-1").all()
        print(f"\n--- LNMS Manual Tickets ({len(lnms_tickets)}) ---")
        for t in lnms_tickets:
            print(f"Ticket ID: {t.ticket_id} | Status: {t.status} | SentToCentral: {t.sent_to_cnms_at}")

        # SPIC Tickets
        spic_tickets = db2.execute(text("SELECT unique_ticket_id, status, sent_to_central FROM tickets WHERE device_name = 'SPIC-SWITCH-02'")).fetchall()
        print(f"\n--- SPIC-NMS Manual Tickets ({len(spic_tickets)}) ---")
        for t in spic_tickets:
            print(f"Ticket ID: {t[0]} | Status: {t[1]} | SentToCentral: {t[2]}")

    finally:
        db.close()
        db2.close()

if __name__ == "__main__":
    verify()

import asyncio
import sys
import os
from datetime import datetime
import logging
import httpx

# Add paths
sys.path.append("/home/nms/LNMS_PROJECT/backend")
from app.database import SessionLocal, SessionLocal2, engine
from app.models.alarms import Alarm
from app.models.tickets import Ticket
from app.services.alarm_to_ticket import process_all_alarms
from app.services.cnms_sync import sync_missed_tickets

# For CNMS DB access
from sqlalchemy import create_engine, text
CNMS_DB_URL = "mysql+pymysql://cnms_user:cnms1234@localhost/cnms_db?unix_socket=/var/lib/mysql/mysql.sock"
cnms_engine = create_engine(CNMS_DB_URL)

async def simulate_flow():
    print("🚀 Starting Simulation: LNMS -> CNMS -> LNMS (Resolution Flow)")
    
    # 1. Inject Alarm in LNMS
    db = SessionLocal()
    try:
        alarm = Alarm(
            host_name="SIM-SWITCH-01",
            device_name="SIM-SWITCH-01",
            ip_address="10.0.0.101",
            severity="Major",
            alarm_name="Packet Loss High",
            status="Open",
            problem_time=datetime.utcnow(),
            ticket_created=False
        )
        db.add(alarm)
        db.commit()
        db.refresh(alarm)
        curr_alarm_id = alarm.alarm_id
        db.close() # Close session before engine starts its own
        print(f"✅ LNMS Alarm {curr_alarm_id} injected and committed.")
        
        # 2. Process Alarms (Create Ticket & Sync to CNMS)
        print("⚙️  Running LNMS Engine...")
        await process_all_alarms()
        print("⚙️  Engine cycle done.")
        
        # Open new session to check results
        db = SessionLocal()
        ticket = db.query(Ticket).filter(Ticket.alarm_id == curr_alarm_id).first()
        if not ticket:
            print(f"❌ Failed to find ticket in LNMS for alarm {curr_alarm_id}.")
            # Check if alarm state changed
            alarm_check = db.query(Alarm).filter(Alarm.alarm_id == curr_alarm_id).first()
            print(f"   ℹ️ Alarm {curr_alarm_id} ticket_created: {alarm_check.ticket_created if alarm_check else 'N/A'}")
            return
        
        print(f"✅ LNMS Ticket {ticket.ticket_id} created.")
        
        # 3. Verify in CNMS and Resolve
        # The UID in CNMS is likely COMPANY-ALM-{alarm_id} 
        # Based on _build_alarm_uid in cnms_sync.py and LNMS_NODE_ID in alarm_to_ticket.py
        uid = f"COMPANY-ALM-{alarm.alarm_id}"
        
        print(f"🔍 Looking for Ticket UID {uid} in CNMS...")
        with cnms_engine.connect() as conn:
            # Check if ticket exists in CNMS
            res = conn.execute(text("SELECT id, status FROM tickets WHERE ticket_uid=:uid OR alarm_uid=:uid"), {"uid": uid}).fetchone()
            if not res:
                print(f"❌ Ticket {uid} NOT found in CNMS DB.")
                return
            
            cnms_id, status = res
            print(f"✅ Found CNMS Ticket ID {cnms_id} with status {status}.")
            
            # Resolve it in CNMS
            print("🛠  Resolving Ticket in CNMS...")
            conn.execute(text("UPDATE tickets SET status='RESOLVED', resolved_at=NOW(), resolution_note='Resolved by E2E Simulation' WHERE id=:id"), {"id": cnms_id})
            conn.commit()
            print("✅ Ticket resolved in CNMS DB.")
            
        # 4. LNMS Sync Back (Polling)
        print("⚙️  Running LNMS Sync Missed Tickets (Polling CNMS)...")
        await sync_missed_tickets()
        
        # 5. Final Verification in LNMS (Wait a bit for commit and use fresh session)
        await asyncio.sleep(1)
        db_final = SessionLocal()
        ticket_final = db_final.query(Ticket).filter(Ticket.alarm_id == curr_alarm_id).first()
        print(f"🔍 Final LNMS Ticket Status: {ticket_final.status if ticket_final else 'N/A'}")
        
        if ticket_final and ticket_final.status.upper() in ["RESOLVED", "CLOSED"]:
            print("🏆 SUCCESS: Complete end-to-end flow verified!")
        else:
            print("❌ FAILURE: Ticket status not updated in LNMS.")
            if ticket_final:
                print(f"   ℹ️ Sync Status: {ticket_final.sync_status}, Sent At: {ticket_final.sent_to_cnms_at}")

    finally:
        if 'db' in locals(): db.close()
        if 'db_final' in locals(): db_final.close()

if __name__ == "__main__":
    asyncio.run(simulate_flow())

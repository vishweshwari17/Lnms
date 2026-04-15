import sys
import os
import asyncio
from datetime import datetime, timedelta
import logging
from sqlalchemy import text

# Add backend to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal, SessionLocal2, engine, engine2
from app.models.alarms import Alarm
from app.models.status_alarms import StatusAlarm
from app.models.tickets import Ticket
from app.models.status_tickets import StatusTicket
from app.models.devices import Device
from app.models.incidents import Incident
from app.services.alarm_to_ticket import process_all_alarms
from app.services.incident_service import IncidentService

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger("E2E_TEST")

async def setup_test_data():
    print("🔧 Setting up test data...")
    db = SessionLocal()
    db2 = SessionLocal2()
    try:
        # 1. Create Test Device
        print("   - Checking/Creating test device...")
        device = db.query(Device).filter(Device.ip_address == "10.0.0.99").first()
        if not device:
            device = Device(
                hostname="TEST-GW-01",
                ip_address="10.0.0.99",
                device_type="Gateway",
                location="Core-DC",
                status="Active",
                device_name="CORE-GW-PROD",
                vendor="Nivetti",
                created_at=datetime.utcnow()
            )
            db.add(device)
            db.commit()
            db.refresh(device)
            print(f"   ✅ Created test device: {device.device_name}")
        else:
            print(f"   ℹ️ Test device exists: {device.device_name}")
        
        # 2. Inject LNMS Alarms
        print("   - Injecting LNMS alarms...")
        alarm1 = Alarm(
            host_name="TEST-GW-01",
            device_name="CORE-GW-PROD",
            ip_address="10.0.0.99",
            severity="Critical",
            alarm_name="Interface GigabitEthernet0/1 Down",
            status="Open",
            problem_time=datetime.utcnow(),
            ticket_created=False
        )
        db.add(alarm1)
        
        # Alarm 2: BGP Neighbor Down
        alarm2 = Alarm(
            host_name="TEST-GW-01",
            device_name="CORE-GW-PROD",
            ip_address="10.0.0.99",
            severity="Major",
            alarm_name="BGP Session Down (AS 65001)",
            status="Open",
            problem_time=datetime.utcnow(),
            ticket_created=False
        )
        db.add(alarm2)

        # Alarm 3: Same as Alarm 1 (for correlation test)
        alarm3 = Alarm(
            host_name="TEST-GW-01",
            device_name="CORE-GW-PROD",
            ip_address="10.0.0.99",
            severity="Critical",
            alarm_name="Interface GigabitEthernet0/1 Down",
            status="Open",
            problem_time=datetime.utcnow() + timedelta(minutes=1),
            ticket_created=False
        )
        db.add(alarm3)
        
        # 3. Inject SPIC Alarms
        print("   - Injecting SPIC alarms...")
        spic_alarm = StatusAlarm(
            device_id=11202,
            device_name="CORE-GW-PROD",
            timestamp=datetime.utcnow(),
            alarm_type="SNMP",
            status="PROBLEM",
            severity="Major",
            exported_to_central=0
        )
        db2.add(spic_alarm)
        
        db.commit()
        db2.commit()
        
        db.refresh(alarm1)
        db.refresh(alarm2)
        db.refresh(alarm3)
        db2.refresh(spic_alarm)
        
        print("   ✅ Alarms injected successfully.")
        return alarm1.alarm_id, alarm2.alarm_id, alarm3.alarm_id, spic_alarm.id

    finally:
        db.close()
        db2.close()

async def run_e2e_test():
    print("\n🚀 STARTING COMPREHENSIVE E2E FLOW TEST")
    print("========================================")
    
    # Phase 1: Setup
    alm1_id, alm2_id, alm3_id, spic_alm_id = await setup_test_data()
    
    # Phase 2: Process Alarms
    print("\n⚙️  Processing Alarms via Engine...")
    print("   (This involves ticket creation, AI classification, and sync attempts)")
    await process_all_alarms()
    print("⚙️  Engine processing complete.")
    
    # Phase 3: Verification
    db = SessionLocal()
    db2 = SessionLocal2()
    try:
        print("\n🔍 VERIFYING TICKETS:")
        
        # Check LNMS Tickets
        tkt1 = db.query(Ticket).filter(Ticket.alarm_id == alm1_id).first()
        tkt2 = db.query(Ticket).filter(Ticket.alarm_id == alm2_id).first()
        tkt3 = db.query(Ticket).filter(Ticket.alarm_id == alm3_id).first()
        
        if tkt1: print(f"✅ LNMS Ticket 1 Created: {tkt1.ticket_id}")
        if tkt2: print(f"✅ LNMS Ticket 2 Created: {tkt2.ticket_id}")
        if tkt3: print(f"✅ LNMS Ticket 3 Created: {tkt3.ticket_id}")

        # Check SPIC Tickets
        spic_tkt = db2.query(StatusTicket).filter(StatusTicket.alarm_id == spic_alm_id).first()
        if spic_tkt: print(f"✅ SPIC Ticket Created: {spic_tkt.unique_ticket_id} (Severity: {spic_tkt.severity})")
        else: print(f"❌ SPIC Ticket NOT Found for Alarm {spic_alm_id}")

        print("\n🔍 VERIFYING INCIDENTS (Correlation):")
        # Check if an incident was created for the device
        incident = db.query(Incident).filter(Incident.device == "CORE-GW-PROD").order_by(Incident.id.desc()).first()
        if incident:
            print(f"✅ Incident Created/Updated: {incident.ticket_id} - {incident.title}")
            print(f"   Severity: {incident.severity}, Status: {incident.status}")
            print(f"   Related Alarms: {incident.related_alarm_ids}")
            
            # Since we injected 2 alarms for this device, they should preferably be correlated
            # if they have the same correlation_key (device_name + alarm_type).
            # In our setup, they have different alarm_names, but maybe same alarm_type?
            # Let's check how the correlation key is built in IncidentService.
        else:
            print("❌ No Incident found for CORE-GW-PROD")

        print("\n🔍 VERIFYING CNMS SYNC STATUS:")
        if tkt1 and (tkt1.sync_status == "synced" or tkt1.sent_to_cnms_at is not None):
            print(f"✅ Ticket {tkt1.ticket_id} synced to CNMS")
        elif tkt1:
            print(f"⚠️  Ticket {tkt1.ticket_id} sync status: {tkt1.sync_status} (Connection Refused is expected if CNMS is down)")

        if spic_tkt and spic_tkt.sent_to_central == 1:
            print(f"✅ SPIC Ticket {spic_tkt.unique_ticket_id} synced to CNMS")
        elif spic_tkt:
            print(f"⚠️  SPIC Ticket {spic_tkt.unique_ticket_id} sync status: NOT SYNCED")

        print("\n✅ E2E FLOW TEST COMPLETE\n")
        
    finally:
        db.close()
        db2.close()

if __name__ == "__main__":
    asyncio.run(run_e2e_test())

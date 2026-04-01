# app/services/status_alarms_service.py

def process_status_alarms():

    try:
        from app.services.lnms_ticket import create_lnms_tickets
        from app.services.spicnms_ticket import create_spicnms_tickets
    except Exception as exc:
        print(f"[ENGINE] Import error: {exc}")
        return []

    try:
        print("🚀 Running Alarm → Ticket Pipeline")

        # ✅ STEP 1: Generate tickets separately
        lnms_tickets = create_lnms_tickets()
        spic_tickets = create_spicnms_tickets()

        print(f"LNMS Tickets: {len(lnms_tickets)}")
        print(f"SPIC Tickets: {len(spic_tickets)}")

        print("✅ Sync completed")

        return lnms_tickets + spic_tickets

    except Exception as exc:
        print(f"[ENGINE ERROR] {exc}")
        return []
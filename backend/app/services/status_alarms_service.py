def process_status_alarms():
    """
    Temporary alarm-engine entry point.

    The app expects this function from main.py. If the split ticket
    services are available, run them in sequence; otherwise fail soft so
    the backend can still start.
    """
    try:
        from app.services.lnms_ticket import create_lnms_tickets
        from app.services.spicnms_ticket import create_spicnms_tickets
        from app.services.cnms_sync import sync_tickets_to_cnms
    except Exception as exc:
        print(f"[ENGINE] Ticket pipeline modules not ready: {exc}")
        return []

    try:
        new_tickets = create_lnms_tickets()
        create_spicnms_tickets(new_tickets)
        sync_tickets_to_cnms(new_tickets)
        return new_tickets
    except Exception as exc:
        print(f"[ENGINE] Ticket pipeline failed: {exc}")
        raise

import httpx

CNMS_BASE_URL = "http://<CNMS_HOST>:<CNMS_PORT>"
LNMS_NODE_ID = "LNMS-LOCAL-01"


def sync_tickets_to_cnms(new_tickets):
    tickets = list(new_tickets or [])
    if not tickets:
        return []

    if "<" in CNMS_BASE_URL:
        print("[ENGINE] CNMS sync skipped: CNMS_BASE_URL is not configured")
        return tickets

    synced = []
    with httpx.Client(timeout=5) as client:
        for ticket in tickets:
            payload = {
                "global_ticket_id": ticket.get("ticket_id"),
                "alarm_id": ticket.get("alarm_id"),
                "device_name": ticket.get("device_name"),
                "title": ticket.get("title"),
                "severity": ticket.get("severity_calculated"),
                "status": ticket.get("status"),
                "created_at": ticket.get("created_at").isoformat() if ticket.get("created_at") else None,
                "last_updated_by": "LNMS",
                "sync_version": 1,
                "lnms_node_id": LNMS_NODE_ID,
            }
            try:
                response = client.post(f"{CNMS_BASE_URL}/webhook/ticket", json=payload)
                response.raise_for_status()
                synced.append(ticket)
            except Exception as exc:
                print(f"[ENGINE] CNMS sync failed for {ticket.get('ticket_id')}: {exc}")

    return synced

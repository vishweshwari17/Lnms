from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Ticket
from datetime import datetime

router = APIRouter(prefix="/major-incidents", tags=["Major Incidents"])

@router.get("/")
def get_major_incidents(db: Session = Depends(get_db)):

    incidents = db.query(Ticket).filter(
        Ticket.severity_calculated == "Critical",
        Ticket.status != "Resolved"
    ).all()

    response = []

    for ticket in incidents:
        sla_remaining = None
        if ticket.closed_at:
            sla_remaining = 0
        else:
            # Example SLA: 30 min
            created_time = ticket.created_at
            elapsed = (datetime.utcnow() - created_time).total_seconds() / 60
            sla_remaining = max(0, 30 - int(elapsed))

        response.append({
            "ticket_id": ticket.ticket_id,
            "device_name": ticket.device_name,
            "host_name": ticket.host_name,
            "severity": ticket.severity_calculated,
            "status": ticket.status,
            "assigned_to": ticket.assigned_to,
            "sla_remaining": sla_remaining
        })

    return response
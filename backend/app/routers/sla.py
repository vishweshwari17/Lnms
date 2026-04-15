from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_lnms_db
from app.models.tickets import Ticket

router = APIRouter(prefix="/sla", tags=["SLA"])

@router.get("/risk")
def get_sla_risk(db: Session = Depends(get_lnms_db)):
    # Only include tickets that are OPEN or IN_PROGRESS
    active_statuses = ["OPEN", "IN_PROGRESS", "ACK", "Open", "In Progress", "Ack"]
    tickets = db.query(Ticket).filter(
        Ticket.status.in_(active_statuses),
        Ticket.is_deleted == False
    ).all()

    now = datetime.now() # Match the database created_at (usually local or consistent)
    # If the database uses UTC, use datetime.utcnow()
    # Let's assume naive datetime for simplicity as seen in main.py jobs

    results = []
    for ticket in tickets:
        if not ticket.created_at:
            continue

        # SLA Limits in minutes
        sev = (ticket.severity_original or "Minor").lower()
        if sev == "critical":
            sla_limit = 30
        elif sev == "major":
            sla_limit = 60
        else:
            sla_limit = 120

        elapsed_time = int((now - ticket.created_at).total_seconds() / 60)
        remaining_time = max(0, sla_limit - elapsed_time)
        risk_percentage = min(100, int((elapsed_time / sla_limit) * 100))

        if risk_percentage >= 100:
            risk_level = "Breached"
        elif risk_percentage >= 80:
            risk_level = "High"
        elif risk_percentage >= 50:
            risk_level = "Medium"
        else:
            risk_level = "Low"

        results.append({
            "ticket_id": ticket.ticket_id,
            "alarm_id": ticket.alarm_id,
            "device_name": ticket.device_name,
            "severity_original": ticket.severity_original,
            "priority": ticket.priority_level,
            "status": ticket.status,
            "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
            "sla_limit": sla_limit,
            "elapsed_time": elapsed_time,
            "remaining_time": remaining_time,
            "risk_percentage": risk_percentage,
            "risk_level": risk_level,
            "sla_breached": elapsed_time >= sla_limit,
            "is_escalated": risk_percentage >= 85,
            "sync_status": ticket.sync_status,
            "source_system": "SPIC" if ticket.lnms_node_id == "LOCAL-COMPANY-01" else "LNMS"
        })

    return results

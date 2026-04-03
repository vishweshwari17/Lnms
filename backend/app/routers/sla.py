from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_lnms_db
from app.models import Ticket

router = APIRouter(prefix="/sla", tags=["SLA"])


@router.get("/risk")
def get_sla_risk(db: Session = Depends(get_lnms_db)):
    tickets = db.query(Ticket).all()

    critical = 0
    warning = 0
    safe = 0
    skipped = 0

    now = datetime.utcnow()

    for ticket in tickets:
        if ticket.closed_at:
            continue

        if ticket.created_at is None:
            skipped += 1
            continue

        elapsed = (now - ticket.created_at).total_seconds() / 60

        if elapsed > 30:
            critical += 1
        elif elapsed > 20:
            warning += 1
        else:
            safe += 1

    return {
        "total": critical + warning + safe,
        "critical_risk": critical,
        "warning_risk": warning,
        "safe": safe,
        "skipped": skipped,
    }

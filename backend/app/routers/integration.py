from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services import alarm_to_ticket

router = APIRouter(prefix="/integration", tags=["Integration"])

@router.post("/sync-status-alarms")
def sync_status_alarms(db: Session = Depends(get_db)):

    alarm_to_ticket.process_all_alarms()

    return {"message": "Status alarms synced and tickets created"}
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.status_alarms_service import process_status_alarms

router = APIRouter(prefix="/integration", tags=["Integration"])

@router.post("/sync-status-alarms")
def sync_status_alarms(db: Session = Depends(get_db)):

    process_status_alarms()

    return {"message": "Status alarms synced and tickets created"}
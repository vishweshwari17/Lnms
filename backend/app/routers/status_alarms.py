from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.alarms import Alarm
from app.services import alarm_to_ticket

router = APIRouter(prefix="/status-alarms", tags=["Status Alarms"])

@router.get("/")
def get_status_alarms(db: Session = Depends(get_db)):
    try:
        from app.models.status_alarms import StatusAlarm
        alarms = db.query(StatusAlarm).filter(
            func.lower(StatusAlarm.status).in_(["problem", "active"])
        ).all()
        return alarms
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch status alarms: {e}")

@router.post("/process")
def process_status_alarm_tickets():
    try:
        alarm_to_ticket.process_all_alarms()
        return {"message": "Alarm to Ticket processing completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {e}")

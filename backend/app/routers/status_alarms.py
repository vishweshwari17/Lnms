from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.alarms import Alarm
from app.services.status_alarms_service import process_status_alarms

router = APIRouter(prefix="/status-alarms", tags=["Status Alarms"])


@router.get("/")
def get_status_alarms(db: Session = Depends(get_db)):
    try:
        alarms = db.query(Alarm).filter(
            Alarm.status == "Open",
            Alarm.severity.in_(["Critical", "Major"]),
            (Alarm.ticket_created == 0) | (Alarm.ticket_created == None),
        ).order_by(Alarm.alarm_id.asc()).all()

        return alarms
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch status alarms: {e}")


@router.post("/process")
def process_status_alarm_tickets():
    try:
        process_status_alarms()
        return {"message": "Status alarm processing completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Status alarm processing failed: {e}")

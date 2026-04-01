from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.alarms import Alarm

router = APIRouter(prefix="/correlated-alarms", tags=["Correlated Alarms"])

@router.get("/")
def get_correlated_alarms(db: Session = Depends(get_db)):
    # Find all OPEN/ACK alarms, grouped by device_name
    results = db.query(
        Alarm.device_name,
        func.count(Alarm.alarm_id).label("total_alarms"),
        func.max(Alarm.severity).label("max_severity"),
        func.min(Alarm.problem_time).label("first_seen")
    ).filter(
        func.lower(Alarm.status).in_(["open", "ack", "acknowledged"])
    ).group_by(Alarm.device_name).having(func.count(Alarm.alarm_id) > 1).all()

    correlated = []
    for i, row in enumerate(results):
        correlated.append({
            "correlation_id": i + 1,
            "root_alarm_name": f"Multiple Alarms on {row.device_name or 'Unknown'}",
            "device_name": row.device_name,
            "severity": row.max_severity or "Critical",
            "total_alarms": row.total_alarms
        })
    return correlated
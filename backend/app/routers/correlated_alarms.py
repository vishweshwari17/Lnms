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
        func.lower(Alarm.status).in_(["open", "ack", "acknowledged", "problem", "active"])
    ).group_by(Alarm.device_name).having(func.count(Alarm.alarm_id) > 1).all()

    correlated = []
    for i, row in enumerate(results):
        # Fetch related alarms for this group
        related = db.query(Alarm).filter(
            Alarm.device_name == row.device_name,
            func.lower(Alarm.status).in_(["open", "ack", "acknowledged", "problem", "active"])
        ).all()

        correlated.append({
            "correlation_id": i + 1,
            "root_alarm_name": f"Multiple Faults on {row.device_name or 'Node'}",
            "device_name": row.device_name,
            "severity": row.max_severity or "Critical",
            "total_alarms": row.total_alarms,
            "first_seen": row.first_seen.isoformat() if row.first_seen else None,
            "related_alarms": [
                {
                    "alarm_id": a.alarm_id,
                    "alarm_name": a.alarm_name or "Unknown",
                    "severity": a.severity,
                    "device_name": a.device_name,
                    "timestamp": a.problem_time.isoformat() if a.problem_time else None
                } for a in related
            ]
        })
    return correlated
from fastapi import APIRouter

router = APIRouter(prefix="/correlated-alarms", tags=["Correlated Alarms"])

@router.get("/")
def get_correlated_alarms():
    return [
        {
            "correlation_id": 1,
            "root_alarm_name": "Link Down",
            "device_name": "Router-01",
            "severity": "Critical",
            "total_alarms": 5
        }
    ]
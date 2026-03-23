from fastapi import APIRouter
from datetime import datetime, timedelta
import random

router = APIRouter(prefix="/escalation", tags=["Escalation"])


@router.get("/test")
def escalation_test():
    return {"message": "Escalation router working"}


@router.get("/breach-tracker")
def breach_tracker():
    """
    Returns tickets that are close to SLA breach or already breached
    """

    mock_data = []

    for i in range(5):
        risk = random.randint(50, 95)

        mock_data.append({
            "ticket_id": 100 + i,
            "severity": random.choice(["Critical", "Major", "Minor"]),
            "risk_percentage": risk,
            "remaining_time": random.randint(5, 120),
            "status": "Breached" if risk > 90 else "At Risk",
            "breach_time": (
                datetime.now() + timedelta(minutes=random.randint(1, 60))
            ).strftime("%Y-%m-%d %H:%M:%S")
        })

    return mock_data
from sqlalchemy.orm import Session
from app.models import Alarm, Ticket


def process_alarms(db: Session):
    unprocessed_alarms = db.query(Alarm).filter(Alarm.processed == "no").all()

    for alarm in unprocessed_alarms:
        new_ticket = Ticket(
            title=f"Alarm from {alarm.source}",
            description=alarm.message,
            severity=alarm.severity,
            status="open"
        )
        db.add(new_ticket)
        alarm.processed = "yes"

    db.commit()
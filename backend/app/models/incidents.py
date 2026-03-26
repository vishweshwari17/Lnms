from sqlalchemy import Column, String, Integer, DateTime
from datetime import datetime
from app.database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(String(64), unique=True, index=True)

    host = Column(String(100))
    device = Column(String(100))
    severity = Column(String(20))
    status = Column(String(20))
    assigned_to = Column(String(100))

    created_time = Column(DateTime, default=datetime.utcnow)
    sla_deadline = Column(DateTime)

    occurrence_count = Column(Integer, default=1)
    risk_score = Column(Integer, default=0)

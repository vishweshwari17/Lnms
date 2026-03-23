from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON
from app.database import Base

class Alarm(Base):
    __tablename__ = "alarms"

    alarm_id = Column(Integer, primary_key=True, index=True)

    host_name = Column(String(255))
    device_name = Column(String(255))
    ip_address = Column(String(50))

    severity = Column(String(50))
    alarm_name = Column(String(255))

    description = Column(Text)

    # ✅ CHANGE THIS
    parameter_data = Column(JSON)

    problem_time = Column(DateTime)
    resolved_time = Column(DateTime)

    status = Column(String(50))
    created_at = Column(DateTime)

    ticket_created = Column(Boolean)
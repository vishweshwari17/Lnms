from sqlalchemy import Column, Integer, String, Enum, TIMESTAMP, Boolean
from app.database import Base


class StatusAlarm(Base):
    __tablename__ = "status_alarms"
    __table_args__ = {"schema": "snmp_monitor"}   # important

    id = Column(Integer, primary_key=True, index=True)

    device_id = Column(Integer)
    device_name = Column(String(255))

    timestamp = Column(TIMESTAMP)
    alarm_type = Column(Enum("ICMP", "SNMP"))

    start_time = Column(TIMESTAMP)
    end_time = Column(TIMESTAMP)

    status = Column(Enum("PROBLEM", "RESOLVED"))

    created_at = Column(TIMESTAMP)
    resolved_at = Column(TIMESTAMP)
    resolved_by = Column(String(100))

    exported_to_central = Column(Integer)
    exported_timestamp = Column(TIMESTAMP)

    severity = Column(String(50))

    # ⭐ ADD THIS
    ticket_created = Column(Boolean, default=False)
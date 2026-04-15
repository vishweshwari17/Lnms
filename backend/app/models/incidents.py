from sqlalchemy import Column, String, Integer, DateTime, JSON, Boolean, Text, ForeignKey, TIMESTAMP, func
from datetime import datetime
from app.database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(String(64), unique=True, index=True)
    title = Column(String(255))
    description = Column(Text)

    # Device Info
    device_id = Column(Integer)
    device = Column(String(100)) # device_name
    host = Column(String(100))   # hostname
    ip_address = Column(String(45))
    device_type = Column(String(50))
    location = Column(String(255))

    # Alarm Mapping
    related_alarm_ids = Column(JSON) # List of alarm IDs
    occurrence_count = Column(Integer, default=1) # alarm_count
    primary_alarm_type = Column(String(100))

    # Severity & Priority
    severity = Column(String(20)) # Critical, Major, Minor, Warning
    priority = Column(String(20))

    # Status Tracking
    status = Column(String(20), default="OPEN") # OPEN, IN_PROGRESS, RESOLVED, CLOSED
    acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(String(100))
    ack_time = Column(DateTime)

    # Time Fields
    created_time = Column(DateTime, default=datetime.utcnow) # created_at
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    first_occurrence = Column(DateTime)
    last_occurrence = Column(DateTime)
    resolved_at = Column(DateTime)

    # Correlation
    correlation_key = Column(String(255), index=True)
    root_cause = Column(Text)
    symptoms = Column(Text)

    # Assignment
    assigned_to = Column(String(100), default="Unassigned")
    team = Column(String(100))

    # CNMS Sync
    cnms_incident_id = Column(String(64))
    sync_status = Column(String(20), default="PENDING") # PENDING, SYNCED, FAILED

    # Metadata
    tags = Column(JSON)
    notes = Column(Text)
    auto_created = Column(Boolean, default=True)

    risk_score = Column(Integer, default=0)
    sla_deadline = Column(DateTime)

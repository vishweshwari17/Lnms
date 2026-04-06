from sqlalchemy import Column, Integer, String, Enum, TIMESTAMP, Text, SmallInteger, CHAR, Boolean
from app.database import Base

class StatusTicket(Base):
    __tablename__ = "tickets"
    __table_args__ = {"schema": "snmp_monitor"}

    ticket_id = Column(Integer, primary_key=True, autoincrement=True)
    unique_ticket_id = Column(CHAR(11), unique=True, nullable=False)
    node_id = Column(SmallInteger, nullable=False, default=1)
    ticket_serial_4d = Column(SmallInteger, nullable=False, default=1)
    
    title = Column(String(255), nullable=False)
    device_name = Column(String(100))
    ip_address = Column(String(45))
    
    severity = Column(Enum('Major', 'Minor', 'Warning'), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(Enum('Open', 'Acknowledged', 'Closed', 'Acknowledged by Central', 'Closed by Central'), default='Open')
    
    tags = Column(Text)
    resolution = Column(Text)
    
    sent_to_central = Column(Boolean, default=False)
    sent_at = Column(TIMESTAMP)
    
    created_at = Column(TIMESTAMP)
    updated_at = Column(TIMESTAMP)
    
    alarm_id = Column(Integer)

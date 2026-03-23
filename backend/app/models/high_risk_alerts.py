from sqlalchemy import Column, Integer, String, DateTime
from app.database import Base


class HighRiskAlert(Base):
    __tablename__ = "high_risk_alerts"

    risk_id = Column(Integer, primary_key=True, index=True)
    device_name = Column(String(100))
    device_ip = Column(String(50))
    location = Column(String(100))
    risk_type = Column(String(100))
    risk_level = Column(String(50))
    value = Column(String(100))
    threshold = Column(String(100))
    status = Column(String(50))
    detected_at = Column(DateTime)

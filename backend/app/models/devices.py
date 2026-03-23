from sqlalchemy import Column, Integer, String, DateTime
from app.database import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    hostname = Column(String(100))
    ip_address = Column(String(50))
    device_type = Column(String(50))
    location = Column(String(100))
    status = Column(String(20))
    device_name = Column(String(50))
    created_at = Column(DateTime)
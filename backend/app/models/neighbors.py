from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base

class Neighbor(Base):
    __tablename__ = "neighbors"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    neighbor_name = Column(String(100))
    neighbor_ip = Column(String(50))
    local_interface = Column(String(50))
    remote_interface = Column(String(50))
    status = Column(String(20), default="UP")

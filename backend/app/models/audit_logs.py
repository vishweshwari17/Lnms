from sqlalchemy import Column, Integer, String, DateTime, func
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    log_id = Column(Integer, primary_key=True, index=True)
    user_name = Column(String(100))
    action = Column(String(255))
    entity_type = Column(String(50))
    entity_id = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())

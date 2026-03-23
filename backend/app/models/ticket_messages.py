from sqlalchemy import Column, Integer, String, DateTime, func
from app.database import Base


class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(String(100), index=True)
    sender = Column(String(100))
    message = Column(String(1000))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
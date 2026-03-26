# The Ticket model was introduced after the original LNMS schema
# shipped with an existing ``tickets`` table.  the legacy table has a
# completely different column layout (see ``inspect(engine).get_columns('tickets')``)
# which means that ``Base.metadata.create_all`` will not modify it once
# it exists.  Accessing the model against the old table therefore results
# in errors such as "Unknown column 'tickets.alarm_id'".
#
# During development you can either adapt the model to the legacy columns,
# or reset the database so that a fresh table matching this model is
# created.  a small helper script ``scripts/reset_tickets_table.py`` is
# provided for the latter case.

from sqlalchemy import Column, Integer, String, DateTime, BigInteger, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
from pydantic import BaseModel
from datetime import datetime

class TicketDetail(BaseModel):
    ticket_id: str
    alarm_id: str
    device_name: str
    title: str
    severity: str
    status: str
    created_at: datetime
    resolved_at: datetime | None = None
    resolution_note: str | None = None


class Ticket(Base):
    __tablename__ = "tickets"

    # Ticket IDs now use a shared/global TKT-based format instead of UUIDs.
    ticket_id = Column(String(64), primary_key=True, index=True)

    alarm_id = Column(BigInteger)
    correlation_id = Column(String(64))

    title = Column(String(255))
    device_name = Column(String(100))
    host_name = Column(String(100))
    ip_address = Column(String(50))

    severity_original = Column(String(20))
    severity_calculated = Column(String(20))
    priority_level = Column(String(10))

    status = Column(String(20))

    assigned_to = Column(Integer)
    
    occurrence_count = Column(Integer, default=1)
    reopen_count = Column(Integer, default=0)
    sent_to_cnms_at = Column(DateTime, nullable=True)
    first_response_time = Column(DateTime)
    resolved_at = Column(DateTime)
    resolution_note = Column(Text)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    closed_at = Column(DateTime)
    last_updated_by = Column(String(20))
    sync_version = Column(Integer, default=1)
    global_ticket_id = Column(String(50))
    last_synced_at = Column(DateTime)
    acknowledged_at = Column(DateTime)
    lnms_node_id = Column(String(50))
    sync_status = Column(String(20), default="pending")
    cnms_ticket_id = Column(String(50))
    is_deleted = Column(Boolean, default=False)

    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="tickets")

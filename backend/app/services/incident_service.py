import json
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.incidents import Incident
from app.models.status_alarms import StatusAlarm
import logging

logger = logging.getLogger(__name__)

class IncidentService:
    @staticmethod
    async def process_alarm(db: Session, alarm):
        """
        Process a new or updated alarm and correlate it into an incident.
        Supports both Alarm (from LNMS) and StatusAlarm (from SPIC).
        """
        try:
            device_name = alarm.device_name
            alarm_id = getattr(alarm, "alarm_id", getattr(alarm, "id", None))
            alarm_type = getattr(alarm, "alarm_type", getattr(alarm, "alarm_name", "Unknown Alarm"))
            
            correlation_key = f"{device_name}_{alarm_type}"
            
            existing_incident = db.query(Incident).filter(
                Incident.correlation_key == correlation_key,
                Incident.status.in_(["OPEN", "IN_PROGRESS", "Open", "In Progress"])
            ).first()

            if existing_incident:
                existing_incident.occurrence_count += 1
                existing_incident.last_occurrence = datetime.utcnow()
                
                related_ids = existing_incident.related_alarm_ids or []
                if isinstance(related_ids, str):
                    related_ids = json.loads(related_ids)
                
                if alarm_id not in related_ids:
                    # Create a completely new list to ensure mutation tracking
                    new_list = list(related_ids)
                    new_list.append(alarm_id)
                    existing_incident.related_alarm_ids = new_list
                
                sev_map = {"critical": 3, "major": 2, "minor": 1, "warning": 0, "clear": -1, 
                           "Critical": 3, "Major": 2, "Minor": 1, "Warning": 0, "Clear": -1}
                current_sev = sev_map.get(existing_incident.severity, 0)
                new_sev = sev_map.get(alarm.severity, 0)
                if new_sev > current_sev:
                    existing_incident.severity = alarm.severity

                db.commit()
                
                from app.services.cnms_sync import send_incident_to_cnms
                await send_incident_to_cnms(existing_incident.id)
                
                return existing_incident
            else:
                new_incident = Incident(
                    ticket_id=f"INC-{datetime.now().strftime('%Y%m%d%H%M%S')}-{alarm_id}",
                    title=f"Incident: {alarm_type} on {device_name}",
                    description=getattr(alarm, "description", None) or f"Aggregated alarms for {alarm_type}",
                    device=device_name,
                    host=getattr(alarm, "host_name", device_name),
                    ip_address=getattr(alarm, "ip_address", "N/A"),
                    device_id=getattr(alarm, "device_id", None),
                    related_alarm_ids=[alarm_id],
                    occurrence_count=1,
                    primary_alarm_type=alarm_type,
                    severity=alarm.severity or "Minor",
                    status="OPEN",
                    created_time=datetime.utcnow(),
                    first_occurrence=datetime.utcnow(),
                    last_occurrence=datetime.utcnow(),
                    correlation_key=correlation_key,
                    sync_status="PENDING",
                    auto_created=True
                )
                
                if "unreachable" in alarm_type.lower() or "down" in alarm_type.lower():
                    new_incident.severity = "Critical"
                    new_incident.priority = "High"
                else:
                    new_incident.priority = "Medium"

                db.add(new_incident)
                db.commit()
                db.refresh(new_incident)
                
                from app.services.cnms_sync import send_incident_to_cnms
                await send_incident_to_cnms(new_incident.id)
                
                return new_incident
                
        except Exception as e:
            logger.error(f"Error processing alarm in IncidentService: {e}")
            db.rollback()
            return None

    @staticmethod
    async def acknowledge_incident(db: Session, incident_id: int, user: str):
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if incident:
            incident.acknowledged = True
            incident.acknowledged_by = user
            incident.ack_time = datetime.utcnow()
            incident.status = "IN_PROGRESS"
            db.commit()
            
            from app.services.cnms_sync import send_incident_to_cnms
            await send_incident_to_cnms(incident.id)
            return True
        return False

    @staticmethod
    async def update_status(db: Session, incident_id: int, status: str):
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if incident:
            incident.status = status
            if status in ["RESOLVED", "CLOSED"]:
                incident.resolved_at = datetime.utcnow()
            db.commit()
            
            from app.services.cnms_sync import send_incident_to_cnms
            await send_incident_to_cnms(incident.id)
            return True
        return False

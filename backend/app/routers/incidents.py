from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_lnms_db
from app.models.incidents import Incident
from app.schemas import IncidentResponse, IncidentUpdate
from app.services.incident_service import IncidentService
from app.models.audit_logs import AuditLog
from typing import List, Optional

router = APIRouter(prefix="/incidents", tags=["Incidents"])

@router.get("/", response_model=dict)
async def get_incidents(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    device_name: Optional[str] = None,
    limit: int = 25,
    offset: int = 0,
    db: Session = Depends(get_lnms_db)
):
    query = db.query(Incident)
    
    # Filtering
    if status and status != "All":
        query = query.filter(Incident.status == status)
    if severity and severity != "All":
        query = query.filter(Incident.severity == severity)
    if device_name:
        query = query.filter(Incident.device.ilike(f"%{device_name}%"))
    
    total = query.count()
    incidents = query.order_by(Incident.created_time.desc()).offset(offset).limit(limit).all()
    
    # Calculate SLA and format
    formatted = []
    for inc in incidents:
        sla_remaining = 0
        sla_status = "Green"
        
        if inc.sla_deadline:
            delta = inc.sla_deadline - datetime.utcnow()
            sla_remaining = int(delta.total_seconds() / 60)
            
            if sla_remaining <= 0:
                sla_status = "Red" # Breached
            elif sla_remaining < 60: # Less than 1 hour (example logic)
                sla_status = "Yellow"
        
        formatted.append({
            **IncidentResponse.model_validate(inc).model_dump(),
            "sla_remaining": sla_remaining,
            "sla_status": sla_status
        })
    
    # Summary stats
    summary = {
        "total": db.query(Incident).count(),
        "critical": db.query(Incident).filter(Incident.severity == "Critical").count(),
        "breached": db.query(Incident).filter(Incident.sla_deadline < datetime.utcnow()).count()
    }
    
    return {
        "incidents": formatted,
        "total": total,
        "summary": summary
    }

@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(incident_id: int, db: Session = Depends(get_lnms_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@router.put("/{incident_id}", response_model=IncidentResponse)
async def update_incident(
    incident_id: int, 
    update_data: IncidentUpdate, 
    db: Session = Depends(get_lnms_db)
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(incident, key, value)
    
    db.commit()
    db.refresh(incident)
    
    audit = AuditLog(
        user_name="Admin",
        action="Updated Incident Status",
        entity_type="Incident",
        entity_id=incident_id
    )
    db.add(audit)
    db.commit()
    
    return incident

@router.put("/{incident_id}/acknowledge")
async def acknowledge_incident(incident_id: int, user: str, db: Session = Depends(get_lnms_db)):
    success = await IncidentService.acknowledge_incident(db, incident_id, user)
    if not success:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    audit = AuditLog(
        user_name=user,
        action="Acknowledged Incident",
        entity_type="Incident",
        entity_id=incident_id
    )
    db.add(audit)
    db.commit()
    
    return {"message": "Incident acknowledged", "user": user}

@router.put("/{incident_id}/status")
async def update_incident_status(incident_id: int, status: str, db: Session = Depends(get_lnms_db)):
    success = await IncidentService.update_status(db, incident_id, status)
    if not success:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    audit = AuditLog(
        user_name="Admin",
        action=f"Changed Incident Status to {status}",
        entity_type="Incident",
        entity_id=incident_id
    )
    db.add(audit)
    db.commit()
    
    return {"message": "Incident status updated", "status": status}
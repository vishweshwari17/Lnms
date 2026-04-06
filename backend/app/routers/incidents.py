from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_lnms_db
from app.models.incidents import Incident
from app.schemas import IncidentResponse

router = APIRouter()


@router.get("/incidents/", response_model=list[IncidentResponse])
def get_incidents(db: Session = Depends(get_lnms_db)):
    incidents = db.query(Incident).all()
    return incidents


@router.get("/incidents/high-risk", response_model=list[IncidentResponse])
def get_high_risk_incidents(db: Session = Depends(get_lnms_db)):
    incidents = db.query(Incident).filter(Incident.risk_score > 70).all()
    return incidents 
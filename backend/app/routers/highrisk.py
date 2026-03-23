from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import HighRiskAlert

router = APIRouter(prefix="/incidents", tags=["Incidents"])

@router.get("/high-risk")
def get_high_risk(db: Session = Depends(get_db)):
    risks = db.query(HighRiskAlert).all()
    return risks
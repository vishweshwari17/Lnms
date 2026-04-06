from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_lnms_db
from app.models import HighRiskAlert

router = APIRouter(prefix="/high-risk", tags=["High Risk"])

@router.get("/")
def get_high_risk(db: Session = Depends(get_lnms_db)):
    risks = db.query(HighRiskAlert).all()
    return risks
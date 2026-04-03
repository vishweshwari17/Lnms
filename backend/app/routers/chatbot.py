from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_lnms_db
from app.models.tickets import Ticket

router = APIRouter(prefix="/chatbot", tags=["AI Chatbot"])

@router.post("/ask")
async def ask_chatbot(question: str, db: Session = Depends(get_lnms_db)):
    """
    Provides guided solutions for common issues without escalation.
    Accesses LNMS ticket history for relevant solutions.
    """
    q = question.lower()
    
    # Simple keyword-based response logic
    if "down" in q or "link" in q:
        return {"answer": "It seems like a connectivity issue. Please check the physical link and interface status on the device dashboard."}
    if "password" in q or "access" in q:
        return {"answer": "For security reasons, password resets must be handled by the administrator. Please check the 'Administration' tab."}
    
    # Try to find a similar resolved ticket
    similar = db.query(Ticket).filter(
        Ticket.status.in_(["RESOLVED", "CLOSED"]),
        Ticket.resolution_note != None
    ).limit(3).all()
    
    if similar:
        solutions = [t.resolution_note for t in similar if t.resolution_note]
        if solutions:
            return {"answer": f"Based on history, common solutions include: {'; '.join(solutions[:2])}"}
            
    return {"answer": "I'm not sure about that. Let me connect you with a senior operator or search the knowledge base."}

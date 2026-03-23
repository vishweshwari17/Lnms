from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from sqlalchemy import text

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("")
def get_audit_logs(db: Session = Depends(get_db)):

    query = text("""
        SELECT log_id,user_name,action,entity_type,entity_id,created_at
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 100
    """)

    result = db.execute(query)

    logs = []

    for row in result:

        logs.append({
            "log_id": row.log_id,
            "user_name": row.user_name,
            "action": row.action,
            "entity_type": row.entity_type,
            "entity_id": row.entity_id,
            "created_at": row.created_at
        })

    return logs
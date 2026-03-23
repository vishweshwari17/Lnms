from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
import asyncio

router = APIRouter()

@router.websocket("/ws/alarms")
async def websocket_alarms(websocket: WebSocket, db: Session = Depends(get_db)):

    await websocket.accept()
    print("WebSocket connected")

    try:
        while True:

            alarms = db.execute(text("""
                SELECT device_name, alarm_name, severity, created_at
                FROM snmp_monitor.alarms
                ORDER BY created_at DESC
                LIMIT 1
            """))

            row = alarms.fetchone()

            if row:
                await websocket.send_json({
                    "device_name": row.device_name,
                    "alarm_name": row.alarm_name,
                    "severity": row.severity,
                    "time": str(row.created_at)
                })

            await asyncio.sleep(3)

    except WebSocketDisconnect:
        print("WebSocket disconnected")
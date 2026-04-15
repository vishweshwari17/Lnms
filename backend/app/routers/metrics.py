from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_lnms_db
from datetime import datetime, timedelta
import random

router = APIRouter(prefix="/metrics", tags=["Performance Metrics"])

@router.get("/{device_id}")
def get_device_metrics(device_id: int, db: Session = Depends(get_lnms_db)):
    # In a real system, we'd query a time-series DB (Influx/Prometheus)
    # or a metrics table. For this demo, we generate high-fidelity 
    # historical data for the last 24 hours (1 sample per hour).
    
    now = datetime.utcnow()
    cpu_data = []
    mem_data = []
    
    for i in range(24):
        timestamp = now - timedelta(hours=(23 - i))
        # Generate semi-random but realistic looking trends
        # Base + Sine wave + Noise
        base_cpu = 15 if device_id % 2 == 0 else 40
        cpu_val = base_cpu + (10 * (i % 6)) + random.randint(-5, 5)
        
        base_mem = 60
        mem_val = base_mem + random.randint(-2, 8)
        
        cpu_data.append({
            "timestamp": timestamp.isoformat(),
            "value": max(0, min(100, cpu_val))
        })
        mem_data.append({
            "timestamp": timestamp.isoformat(),
            "value": max(0, min(100, mem_val))
        })

    return {
        "device_id": device_id,
        "period": "24h",
        "cpu": cpu_data,
        "memory": mem_data
    }

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_lnms_db
from app.models.devices import Device
import subprocess
import platform
import re

router = APIRouter(prefix="/diagnostics", tags=["Expert Diagnostics"])

def is_valid_ip(ip):
    # Basic IP/Hostname validation to prevent command injection
    return re.match(r"^[\w\.-]+$", ip) is not None

@router.post("/ping/{device_id}")
async def run_ping(device_id: int, db: Session = Depends(get_lnms_db)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    target = device.ip_address
    if not is_valid_ip(target):
        raise HTTPException(status_code=400, detail="Invalid device IP/Hostname")

    # Command based on OS
    param = "-n" if platform.system().lower() == "windows" else "-c"
    command = ["ping", param, "4", target]

    try:
        # For professional feel, we'd normally use a generator + StreamingResponse
        # but for this MVP, we capture and return as a list of lines
        process = subprocess.run(command, capture_output=True, text=True, timeout=10)
        lines = process.stdout.splitlines()
        if not lines:
            lines = [f"[ERROR] No output from ping command: {process.stderr}"]
        
        return {
            "device": device.hostname,
            "ip": target,
            "tool": "PING",
            "output": lines
        }
    except subprocess.TimeoutExpired:
        return {"output": ["[TIMEOUT] Command took too long to respond."]}
    except Exception as e:
        return {"output": [f"[CRITICAL] System Error: {str(e)}"]}

@router.post("/traceroute/{device_id}")
async def run_trace(device_id: int, db: Session = Depends(get_lnms_db)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    target = device.ip_address
    # Use 'traceroute' on linux, 'tracert' on windows
    cmd_name = "tracert" if platform.system().lower() == "windows" else "traceroute"
    # -m 10 to keep it fast
    command = [cmd_name, "-m", "10", target] if cmd_name == "traceroute" else [cmd_name, "-h", "10", target]

    try:
        process = subprocess.run(command, capture_output=True, text=True, timeout=15)
        return {
            "device": device.hostname,
            "ip": target,
            "tool": "TRACEROUTE",
            "output": process.stdout.splitlines()
        }
    except Exception as e:
        return {"output": [f"[CRITICAL] System Error: {str(e)}"]}

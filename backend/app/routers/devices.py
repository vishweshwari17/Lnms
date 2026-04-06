from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_lnms_db
from app.models import Device, AuditLog
from app.schemas import DeviceCreate, DeviceResponse

router = APIRouter(prefix="/devices", tags=["Devices"])


# GET ALL DEVICES
@router.get("/", response_model=list[DeviceResponse])
def get_devices(db: Session = Depends(get_lnms_db)):
    devices = db.query(Device).all()
    return devices


# CREATE DEVICE
@router.post("/")
def create_device(device: DeviceCreate, db: Session = Depends(get_lnms_db)):

    new_device = Device(
        hostname=device.hostname,
        ip_address=device.ip_address,
        device_type=device.device_type,
        location=device.location,
        device_name=device.device_name,
        status="ACTIVE",
        created_at=datetime.now()
    )

    db.add(new_device)
    db.commit()
    db.refresh(new_device)

    # Audit log
    log = AuditLog(
        user_name="admin",
        action=f"Added device {device.hostname}",
        entity_type="device",
        entity_id=new_device.id
    )

    db.add(log)
    db.commit()

    return {
        "message": "Device added successfully",
        "device": new_device
    }
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime
from app.database import get_lnms_db
from app.models import Device, AuditLog, Alarm
from app.schemas import DeviceCreate, DeviceResponse, DeviceListResponse

router = APIRouter(prefix="/devices", tags=["Devices"])

# GET ALL DEVICES
@router.get("/", response_model=DeviceListResponse)
def get_devices(
    search: str | None = None,
    type: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_lnms_db)
):
    query = db.query(Device)
    if search:
        query = query.filter(
            or_(
                Device.hostname.ilike(f"%{search}%"),
                Device.ip_address.ilike(f"%{search}%")
            )
        )
    if type and type != "All":
        query = query.filter(Device.device_type.ilike(f"%{type}%"))
    if status and status != "All":
        query = query.filter(Device.status == status)
        
    devices = query.all()
    return {"count": len(devices), "devices": devices}

# SYNC DEVICES FROM ALARMS
@router.post("/sync")
def sync_devices(db: Session = Depends(get_lnms_db)):
    # Extract unique devices from alarms
    alarms = db.query(Alarm.host_name, Alarm.device_name, Alarm.ip_address).distinct().all()
    
    upserted_count = 0
    for a in alarms:
        hostname = a.host_name or a.device_name or "Unknown"
        ip = a.ip_address or "0.0.0.0"
        
        # Check if exists
        existing = db.query(Device).filter(Device.hostname == hostname, Device.ip_address == ip).first()
        if existing:
            # Update status if needed, or leave alone
            existing.status = "ACTIVE"
        else:
            # Insert new
            new_dev = Device(
                hostname=hostname,
                device_name=a.device_name or hostname,
                ip_address=ip,
                device_type="SNMP Device", # Placeholder
                location="Data Center",
                status="ACTIVE",
                created_at=datetime.now()
            )
            db.add(new_dev)
        upserted_count += 1
        
    db.commit()
    
    # Audit log
    log = AuditLog(
        user_name="system",
        action=f"Synchronized {upserted_count} devices",
        entity_type="devices",
        entity_id=0
    )
    db.add(log)
    db.commit()
    return {"message": "Sync complete", "synced": upserted_count}


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


@router.get("/{device_id}", response_model=DeviceResponse)
def get_device(device_id: int, db: Session = Depends(get_lnms_db)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Device not found")
    return device
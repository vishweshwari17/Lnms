from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_lnms_db
from app.models.users import User
from app.models.devices import Device
from app.schemas import UserCreate, DeviceCreate

router = APIRouter(prefix="/admin", tags=["Administration"])


# ---------------- USERS ----------------

@router.get("/users")
def get_users(db: Session = Depends(get_lnms_db)):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
        }
        for u in users
    ]

@router.post("/users")
def create_user(data: UserCreate, db: Session = Depends(get_lnms_db)):
    # Check both email AND username for duplicates
    existing = db.query(User).filter(
        (User.email == data.email) | (User.username == data.username)
    ).first()
    if existing:
        if existing.username == data.username:
            raise HTTPException(status_code=400, detail=f"Username '{data.username}' already exists")
        raise HTTPException(status_code=400, detail=f"Email '{data.email}' already registered")

    user = User(
        username=data.username,
        email=data.email,
        role=data.role,
        hashed_password="defaultpassword"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "message": "User created successfully",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
        }
    }
@router.put("/users/{user_id}")
def update_user(user_id: int, data: UserCreate, db: Session = Depends(get_lnms_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.username = data.username
    user.email = data.email
    user.role = data.role
    db.commit()
    return {"message": "User updated successfully"}

@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_lnms_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}


# ---------------- DEVICES ----------------

@router.get("/devices")
def get_devices(db: Session = Depends(get_lnms_db)):
    devices = db.query(Device).all()
    return [
        {
            "id": d.id,
            "device_name": d.device_name,
            "hostname": d.hostname,
            "ip_address": d.ip_address,
            "device_type": d.device_type,
            "location": d.location,
            "status": d.status,
        }
        for d in devices
    ]

@router.post("/devices")
def create_device(data: DeviceCreate, db: Session = Depends(get_lnms_db)):
    existing = db.query(Device).filter(Device.ip_address == data.ip_address).first()
    if existing:
        raise HTTPException(status_code=400, detail="Device with this IP already exists")
    device = Device(
        device_name=data.device_name,
        hostname=data.hostname,
        ip_address=data.ip_address,
        device_type=data.device_type,
        location=data.location,
        status="ACTIVE"
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return {
        "message": "Device added successfully",
        "device": {
            "id": device.id,
            "device_name": device.device_name,
            "hostname": device.hostname,
            "ip_address": device.ip_address,
            "device_type": device.device_type,
            "location": device.location,
            "status": device.status,
        }
    }

@router.put("/devices/{device_id}")
def update_device(device_id: int, data: DeviceCreate, db: Session = Depends(get_lnms_db)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    device.device_name = data.device_name
    device.hostname = data.hostname
    device.ip_address = data.ip_address
    device.device_type = data.device_type
    device.location = data.location
    db.commit()
    return {"message": "Device updated successfully"}

@router.delete("/devices/{device_id}")
def delete_device(device_id: int, db: Session = Depends(get_lnms_db)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    db.delete(device)
    db.commit()
    return {"message": "Device deleted successfully"}
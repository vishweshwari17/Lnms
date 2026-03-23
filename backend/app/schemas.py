from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from typing import Optional, Dict, Any, Union
from datetime import datetime
from sqlalchemy import Boolean, Column, String, Integer, BigInteger, DateTime, Enum, ForeignKey, Text, JSON
from app.database import Base
import json
class TicketCreate(BaseModel):
    alarm_id: Optional[int] = None
    correlation_id: Optional[str] = None

    title: str
    device_name: str
    host_name: str
    ip_address: str

    severity_original: str
    severity_calculated: str
    priority_level: int

    assigned_to: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

class IncidentResponse(BaseModel):
    id: int
    ticket_id: str
    host: str
    device: str
    severity: str
    status: str
    assigned_to: Optional[str] = None
    created_time: datetime
    sla_deadline: Optional[datetime] = None
    occurrence_count: int
    risk_score: int

    model_config = ConfigDict(from_attributes=True)

class AlarmCreate(BaseModel):
    host_name: str
    device_name: str
    ip_address: str
    severity: str
    alarm_name: str
    description: Optional[str] = None
    parameter_data: Union[str, Dict[str, Any]] = {}
    problem_time: Optional[datetime] = None
    status: str
    ticket_created: Optional[bool] = False

    @field_validator('parameter_data', mode='before')
    @classmethod
    def parse_parameter_data(cls, v):
        if v is None:
            return {}
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return {}
        if isinstance(v, dict):
            return v
        return {}

class AlarmResponse(BaseModel):
    alarm_id: int
    host_name: str
    device_name: str
    # many of these columns are nullable; make them optional to prevent
    # validation errors when records are incomplete
    ip_address: Optional[str] = None
    severity: str
    alarm_name: Optional[str] = None
    description: Optional[str] = None
    parameter_data: Optional[Dict[str, Any]] = {}
    problem_time: Optional[datetime] = None
    status: str
    ticket_created: Optional[bool] = False
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

    @field_validator('parameter_data', mode='before')
    @classmethod
    def parse_parameter_data(cls, v):
        if v is None:
            return {}
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return {}
        if isinstance(v, dict):
            return v
        return {}

class TicketStatusUpdate(BaseModel):
    status: str
    resolution_notes: str | None = None
    

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[int] = None
    closed_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

# USER SCHEMAS
class UserCreate(BaseModel):
    username: str
    email: str
    role: Optional[str] = "NOC"  # ← was missing in models/users.py version

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    model_config = ConfigDict(from_attributes=True)


# DEVICE SCHEMAS
class DeviceCreate(BaseModel):
    device_name: str   # ← THIS was missing, causing the 500
    hostname: str
    ip_address: str
    device_type: str
    location: str

class DeviceResponse(BaseModel):
    id: int
    device_name: Optional[str] = None
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    device_type: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class TicketMessageCreate(BaseModel):
    ticket_id: str
    sender: str
    message: str

class MessageCreate(BaseModel):
    sender: str
    message: str
    
class TicketResponse(BaseModel):
    ticket_id: str
    title: Optional[str] = None
    device_name: str
    host_name: str
    ip_address: str

    severity_original: str
    severity_calculated: str

    status: str
    priority_level: str

    occurrence_count: Optional[int] = 1

    assigned_to: Optional[int] = None
   
    sent_to_cnms_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    created_at: datetime
    
    severity_calculated: str

    model_config = ConfigDict(from_attributes=True)
    
class TicketMessageResponse(BaseModel):
    id: int
    ticket_id: str
    sender: str
    message: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)



class HighRiskCreate(BaseModel):
    device_name: str
    device_ip: str
    location: str
    risk_type: str
    risk_level: str
    value: str
    threshold: str
    status: str

class HighRiskResponse(HighRiskCreate):
    risk_id: int
    detected_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HighRiskAlertResponse(BaseModel):
    id: int
    device_name: str
    ip_address: str
    location: str
    metric: str
    severity: str
    current_value: str
    threshold_value: str
    status: str
    created_at: datetime

    
    model_config = ConfigDict(from_attributes=True)


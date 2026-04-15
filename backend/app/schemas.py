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

class IncidentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    device_id: Optional[int] = None
    device: str
    host: str
    ip_address: Optional[str] = None
    device_type: Optional[str] = None
    location: Optional[str] = None
    severity: str
    priority: Optional[str] = "Medium"
    correlation_key: Optional[str] = None

class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    severity: Optional[str] = None
    priority: Optional[str] = None
    acknowledged: Optional[bool] = None
    assigned_to: Optional[str] = None
    team: Optional[str] = None
    notes: Optional[str] = None

class IncidentResponse(BaseModel):
    id: int
    ticket_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    
    device_id: Optional[int] = None
    device: Optional[str] = None
    host: Optional[str] = None
    ip_address: Optional[str] = None
    device_type: Optional[str] = None
    location: Optional[str] = None

    related_alarm_ids: Optional[list[int]] = []
    occurrence_count: int
    primary_alarm_type: Optional[str] = None

    severity: str
    priority: Optional[str] = None
    status: str
    acknowledged: bool
    acknowledged_by: Optional[str] = None
    ack_time: Optional[datetime] = None

    created_time: datetime
    updated_at: datetime
    first_occurrence: Optional[datetime] = None
    last_occurrence: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    correlation_key: Optional[str] = None
    root_cause: Optional[str] = None
    symptoms: Optional[str] = None

    assigned_to: Optional[str] = None
    team: Optional[str] = None
    
    cnms_incident_id: Optional[str] = None
    sync_status: str
    
    tags: Optional[list[str]] = []
    notes: Optional[str] = None
    auto_created: bool

    risk_score: int
    sla_deadline: Optional[datetime] = None

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

class AlarmStatusUpdate(BaseModel):
    status: str

class AlarmResponse(BaseModel):
    alarm_id: Union[int, str]
    source: Optional[str] = "LNMS"
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
    alarm_type: Optional[str] = None
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
    vendor: Optional[str] = "Nivetti"

class DeviceResponse(BaseModel):
    id: int
    device_name: Optional[str] = None
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    device_type: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    vendor: Optional[str] = "Nivetti"
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class DeviceListResponse(BaseModel):
    count: int
    devices: list[DeviceResponse]

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


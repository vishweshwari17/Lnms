from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_lnms_db
from app.models.neighbors import Neighbor
from typing import List

router = APIRouter(prefix="/neighbors", tags=["Topology"])

@router.get("/{device_id}")
def get_neighbors(device_id: int, db: Session = Depends(get_lnms_db)):
    neighbors = db.query(Neighbor).filter(Neighbor.device_id == device_id).all()
    
    # If no neighbors found, return some seed/mock data for the demo
    # In a real system, these would have been discovered via SNMP/LLDP
    if not neighbors:
       return [
           {
               "id": 0,
               "device_id": device_id,
               "neighbor_name": "NX-CORE-01",
               "neighbor_ip": "10.0.1.1",
               "local_interface": "Eth1/1",
               "remote_interface": "Eth1/5",
               "status": "UP"
           },
           {
               "id": 0,
               "device_id": device_id,
               "neighbor_name": "DIST-SW-04",
               "neighbor_ip": "10.0.1.4",
               "local_interface": "Eth1/2",
               "remote_interface": "Eth1/1",
               "status": "UP"
           }
       ]
    return neighbors

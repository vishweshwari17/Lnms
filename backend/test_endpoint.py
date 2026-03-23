#!/usr/bin/env python
import sys
sys.path.insert(0, '/home/nms/LNMS_PROJECT/backend')

try:
    from fastapi.testclient import TestClient
    from app.main import app
    
    print("✓ FastAPI app loaded")
    client = TestClient(app)
    print("✓ TestClient created")
    
    response = client.get("/alarms/")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    
except Exception as e:
    print(f"✗ Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

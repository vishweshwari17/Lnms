import httpx
import time

payload = {
    "ticket_id": "LOCAL-ALM-12",
    "status": "RESOLVED",
    "resolution_note": "Local webhook trace test"
}

print("Firing HTTP PUT against LNMS localhost to force update alarm_id 12...")
try:
    response = httpx.put("http://127.0.0.1:8000/tickets/update_from_cnms", json=payload, timeout=10)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Failed: {e}")

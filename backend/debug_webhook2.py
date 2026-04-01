import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.routers.tickets import _status_for_db, _alarm_id_from_identifier
from app.database import SessionLocal2
from sqlalchemy import text

uid = "LOCAL-ALM-11"
aid = _alarm_id_from_identifier(uid)
st = _status_for_db("RESOLVED")

spic_status = {
    "Resolved": "Closed",
    "Closed": "Closed",
    "Ack": "Acknowledged",
    "Open": "Open"
}.get(st, "Open")

print(f"uid: {uid}, aid: {aid}, st: {st}, spic_status: {spic_status}")

db2 = SessionLocal2()
try:
    res = db2.execute(text("UPDATE tickets SET status=:st, updated_at=NOW() WHERE unique_ticket_id=:uid OR alarm_id=:aid"), {
        "st": spic_status, "uid": uid, "aid": aid
    })
    print(f"rowcount: {res.rowcount}")
    db2.commit()
except Exception as e:
    print(f"Error: {e}")
finally:
    db2.close()

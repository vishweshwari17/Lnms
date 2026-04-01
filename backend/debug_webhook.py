import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.routers.tickets import _status_for_db, _alarm_id_from_identifier
from app.database import SessionLocal2
from sqlalchemy import text

uid = "LOCAL-ALM-10"
aid = _alarm_id_from_identifier(uid)
print(f"uid: {uid}, aid: {aid}")

db2 = SessionLocal2()
st = _status_for_db("RESOLVED")
print(f"st: {st}")

try:
    res = db2.execute(text("UPDATE tickets SET status=:st, updated_at=NOW() WHERE unique_ticket_id=:uid OR alarm_id=:aid"), {"st": st, "uid": uid, "aid": aid})
    print(f"rowcount: {res.rowcount}")
    db2.commit()
except Exception as e:
    print(f"Error: {e}")
finally:
    db2.close()

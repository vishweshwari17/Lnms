import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from app.database import SessionLocal, engine
from sqlalchemy import text, inspect

db = SessionLocal()
try:
    insp = inspect(engine)
    indices = [ix['name'] for ix in insp.get_indexes('tickets')]
    if 'alarm_id' in indices:
        db.execute(text("ALTER TABLE tickets DROP INDEX alarm_id"))
        db.commit()
        print("Dropped unique index 'alarm_id'")
    else:
        print("Index 'alarm_id' not found in tickets table")
except Exception as e:
    print(f"Error dropping index: {e}")
finally:
    db.close()

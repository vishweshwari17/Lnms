import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import engine2
from sqlalchemy import text

with engine2.connect() as c:
    rows = c.execute(text("DESCRIBE status_alarms")).fetchall()
    for r in rows:
        print(r)

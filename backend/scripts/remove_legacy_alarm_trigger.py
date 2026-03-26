"""Remove the legacy alarms trigger that bypasses LNMS ticket automation."""

import sys
from pathlib import Path

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal2  # noqa: E402


TRIGGER_NAME = "before_alarm_insert"


def main():
    db = SessionLocal2()
    try:
        exists = db.execute(
            text(
                """
                SELECT COUNT(*)
                FROM information_schema.TRIGGERS
                WHERE TRIGGER_SCHEMA = DATABASE()
                  AND TRIGGER_NAME = :trigger_name
                """
            ),
            {"trigger_name": TRIGGER_NAME},
        ).scalar()

        if not exists:
            print(f"Trigger {TRIGGER_NAME} not found.")
            return

        db.execute(text(f"DROP TRIGGER {TRIGGER_NAME}"))
        db.commit()
        print(f"Dropped trigger {TRIGGER_NAME}.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()

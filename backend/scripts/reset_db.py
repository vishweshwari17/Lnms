from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

DB_USER = "root"
DB_PASS = "user_123"
DB_HOST = "127.0.0.1"
DB_PORT = "7776"

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/lnms_db"
DATABASE_URL2 = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/snmp_monitor"

engine1 = create_engine(DATABASE_URL)
engine2 = create_engine(DATABASE_URL2)

def reset_db():
    print("--- Resetting LNMS Database (lnms_db) ---")
    try:
        with engine1.begin() as conn:
            # Drop foreign key constraints if any (tickets might have one to alarms)
            # Actually, standard SQL TRUNCATE might fail if FK exists.
            # We'll use DELETE + ALTER TABLE if needed, or just TRUNCATE with foreign_key_checks off.
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
            
            print("Truncating tickets table...")
            conn.execute(text("TRUNCATE TABLE tickets;"))
            
            print("Truncating alarms table...")
            conn.execute(text("TRUNCATE TABLE alarms;"))
            
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            print("Successfully reset lnms_db.")
    except SQLAlchemyError as e:
        print(f"Error resetting lnms_db: {e}")

    print("\n--- Resetting SPIC-NMS Database (snmp_monitor) ---")
    try:
        with engine2.begin() as conn:
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
            
            print("Truncating tickets table...")
            conn.execute(text("TRUNCATE TABLE tickets;"))
            
            # SPIC-NMS might use status_alarms instead of alarms
            print("Truncating status_alarms table...")
            conn.execute(text("TRUNCATE TABLE status_alarms;"))
            
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            print("Successfully reset snmp_monitor.")
    except SQLAlchemyError as e:
        print(f"Error resetting snmp_monitor: {e}")

if __name__ == "__main__":
    reset_db()

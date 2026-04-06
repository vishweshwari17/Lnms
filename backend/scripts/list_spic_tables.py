import sys
import os
from sqlalchemy import create_engine, inspect

# Add the backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import DATABASE_URL2

def list_tables():
    engine = create_engine(DATABASE_URL2)
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"Tables in snmp_monitor: {tables}")
    
    for table in tables:
        columns = [c['name'] for c in inspector.get_columns(table)]
        print(f"Table {table} columns: {columns}")

if __name__ == "__main__":
    list_tables()

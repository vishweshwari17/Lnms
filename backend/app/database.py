from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DB_USER = "root"
DB_PASS = "user_123"
DB_HOST = "127.0.0.1"
DB_PORT = "7776"

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/lnms_db"
DATABASE_URL2 = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/snmp_monitor"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600
)

engine2 = create_engine(
    DATABASE_URL2,
    pool_pre_ping=True,
    pool_recycle=3600
)

SessionLocal = sessionmaker(bind=engine)
SessionLocal2 = sessionmaker(bind=engine2)

Base = declarative_base()
# FastAPI dependency
def get_db():
    db = SessionLocal2()
    try:
        yield db
    finally:
        db.close()
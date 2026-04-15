import logging

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker, declarative_base

DB_USER = "root"
DB_PASS = "user_123"
DB_HOST = "127.0.0.1"
DB_PORT = "7776"

UNIX_SOCKET = "/var/lib/mysql/mysql.sock"
DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASS}@localhost/lnms_db?unix_socket={UNIX_SOCKET}"
DATABASE_URL2 = f"mysql+pymysql://{DB_USER}:{DB_PASS}@localhost/snmp_monitor?unix_socket={UNIX_SOCKET}"

engine = create_engine(
    DATABASE_URL,
    pool_size=100,
    max_overflow=200,
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args={"connect_timeout": 5},
)

engine2 = create_engine(
    DATABASE_URL2,
    pool_size=100,
    max_overflow=200,
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args={"connect_timeout": 5},
)

SessionLocal = sessionmaker(bind=engine)
SessionLocal2 = sessionmaker(bind=engine2)

Base = declarative_base()
logger = logging.getLogger("lnms.database")


def drop_legacy_alarm_trigger():
    try:
        with engine2.begin() as connection:
            connection.execute(text("DROP TRIGGER IF EXISTS before_alarm_insert"))
    except SQLAlchemyError as exc:
        logger.warning("Unable to drop legacy alarm trigger: %s", exc)

# FastAPI dependency
def get_db():
    db = SessionLocal2()
    try:
        yield db
    finally:
        db.close()

def get_lnms_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

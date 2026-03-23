import mysql.connector
from fastapi import Depends

# LNMS DB config
lnms_db_config = {
    "host": "localhost",
    "user": "lnms_user",
    "password": "user_123",
    "database": "lnms_db",
    "port": 7776
}

# CNMS DB config
cnms_db_config = {
    "host": "localhost",
    "user": "cnms_user",
    "password": "user_123",
    "database": "cnms_db",
    "port": 7776
}

def get_lnms_conn():
    conn = mysql.connector.connect(**lnms_db_config)
    try:
        yield conn
    finally:
        conn.close()

def get_cnms_conn():
    conn = mysql.connector.connect(**cnms_db_config)
    try:
        yield conn
    finally:
        conn.close()
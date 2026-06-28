# Python Database Connection Pool Module
# Supports connection string parsing and individual parameters

import os
from urllib.parse import urlparse
import mysql.connector
from mysql.connector import pooling
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize variables
db_config = {}

# Check for unified connection string (Railway standard)
connection_url = os.getenv('MYSQL_URL') or os.getenv('DATABASE_URL')

if connection_url:
    print("Database URL detected. Parsing connection details...")
    try:
        parsed_url = urlparse(connection_url)
        # Handle cases where username, password, or port are missing or encoded
        username = parsed_url.username or 'root'
        password = parsed_url.password or ''
        hostname = parsed_url.hostname or 'localhost'
        port = parsed_url.port or 3306
        database = parsed_url.path.lstrip('/') or 'capstone_db'
        
        db_config = {
            'user': username,
            'password': password,
            'host': hostname,
            'port': port,
            'database': database
        }
    except Exception as e:
        print(f"Error parsing database URL: {e}. Falling back to individual parameters.")
        connection_url = None

if not connection_url:
    print("No database URL detected. Initializing using individual parameters...")
    db_config = {
        'host': os.getenv('MYSQLHOST', 'localhost'),
        'user': os.getenv('MYSQLUSER', 'root'),
        'password': os.getenv('MYSQLPASSWORD', ''),
        'database': os.getenv('MYSQLDATABASE', 'capstone_db'),
        'port': int(os.getenv('MYSQLPORT', 3306))
    }

# Create connection pool
try:
    connection_pool = mysql.connector.pooling.MySQLConnectionPool(
        pool_name="capstone_pool",
        pool_size=5,
        pool_reset_mode='session',
        **db_config
    )
    print("MySQL Connection Pool initialized successfully!")
except mysql.connector.Error as err:
    print(f"CRITICAL: Failed to initialize MySQL Connection Pool: {err}")
    connection_pool = None

def get_connection():
    """
    Get a connection from the pool.
    """
    if connection_pool:
        return connection_pool.get_connection()
    else:
        # Fallback to direct connection if pool initialization failed
        return mysql.connector.connect(**db_config)

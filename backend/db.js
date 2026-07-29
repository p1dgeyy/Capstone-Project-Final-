// Node.js Database Connection Pool Module
// Utilizes mysql2 library for connection pooling and promise-based interface
// Hardened for Railway deployment — safe startup initialization without process exits

const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

// Detect connection string or individual environment variables (Railway / standard MySQL)
const connectionUri = process.env.MYSQL_URL || process.env.DATABASE_URL || process.env.MYSQLPUBLICURL || process.env.MYSQL_PRIVATE_URL;

if (connectionUri) {
  console.log('[DB] Connection string detected. Initializing MySQL pool...');
  pool = mysql.createPool({
    uri: connectionUri,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
  });
} else {
  const host = process.env.MYSQLHOST || process.env.DB_HOST || 'localhost';
  const user = process.env.MYSQLUSER || process.env.DB_USER || 'root';
  const password = process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '';
  const database = process.env.MYSQLDATABASE || process.env.DB_NAME || 'capstone';
  const port = parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306', 10);

  console.log(`[DB] Initializing MySQL pool (host: ${host}, port: ${port}, db: ${database})`);
  pool = mysql.createPool({
    host,
    user,
    password,
    database,
    port,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
  });
}

// Export the pool to be used throughout the application
module.exports = pool;

// Non-fatal database connection test on start
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('[DB] ✅ MySQL connection successfully established!');
    connection.release();
  } catch (error) {
    console.warn('[DB] Notice: MySQL connection pending or unavailable on startup:', error.message);
  }
})();

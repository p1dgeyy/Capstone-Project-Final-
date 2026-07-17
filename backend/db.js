// Node.js Database Connection Pool Module
// Utilizes mysql2 library for connection pooling and promise-based interface
// Hardened for Railway deployment — no silent fallbacks to localhost

const mysql = require('mysql2/promise');
require('dotenv').config(); // Load environment variables from .env file

let pool;

// Check for unified connection string first (Railway standard)
const connectionUri = process.env.MYSQL_URL || process.env.DATABASE_URL;

if (connectionUri) {
  console.log('[DB] Connection string detected. Initializing MySQL pool...');
  pool = mysql.createPool({
    uri: connectionUri,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Railway MySQL requires SSL in production
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
  });
} else {
  // Require ALL individual env vars — never silently fall back to localhost/root
  const requiredVars = ['MYSQLHOST', 'MYSQLUSER', 'MYSQLPASSWORD', 'MYSQLDATABASE'];
  const missing = requiredVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    console.error(`[DB] CRITICAL: Missing required environment variables: ${missing.join(', ')}`);
    console.error('[DB] Set MYSQL_URL / DATABASE_URL, or provide all individual MYSQL* variables.');
    console.error('[DB] Refusing to fall back to localhost/root to prevent silent data loss.');
    process.exit(1);
  }

  console.log(`[DB] Initializing MySQL pool via individual env vars (host: ${process.env.MYSQLHOST}, port: ${process.env.MYSQLPORT || 3306}, db: ${process.env.MYSQLDATABASE})`);
  pool = mysql.createPool({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: parseInt(process.env.MYSQLPORT || '3306', 10),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
  });
}

// Export the pool to be used throughout the application
module.exports = pool;

// Test the database connection on start — FATAL on failure
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('[DB] MySQL connection successfully established!');

    // Log the actual database target for deployment visibility
    const [dbResult] = await connection.query('SELECT DATABASE() AS db, USER() AS user');
    console.log(`[DB] Connected to database: "${dbResult[0].db}" as user: "${dbResult[0].user}"`);

    connection.release();
  } catch (error) {
    console.error('[DB] ═══════════════════════════════════════════════════════');
    console.error('[DB] CRITICAL: Failed to connect to MySQL database!');
    console.error('[DB] Error:', error.message);
    console.error('[DB] Code:', error.code || 'N/A');
    console.error('[DB] Connection details — check your MYSQL_URL or MYSQL* environment variables.');
    console.error('[DB] The server CANNOT start without a working database connection.');
    console.error('[DB] ═══════════════════════════════════════════════════════');
    process.exit(1);
  }
})();

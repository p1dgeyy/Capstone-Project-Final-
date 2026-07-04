// Node.js Database Connection Pool Module
// Utilizes mysql2 library for connection pooling and promise-based interface

const mysql = require('mysql2/promise');
require('dotenv').config(); // Load environment variables from .env file

let pool;

// Check for unified connection string first
const connectionUri = process.env.MYSQL_URL || process.env.DATABASE_URL;

if (connectionUri) {
  console.log('Database URL detected. Initializing MySQL pool via connection string...');
  pool = mysql.createPool({
    uri: connectionUri,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
} else {
  console.log('No connection string detected. Initializing MySQL pool via fallback environment parameters...');
  pool = mysql.createPool({
    host: process.env.MYSQLHOST || 'localhost',
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || '',
    database: process.env.MYSQLDATABASE || 'capstone_db',
    port: parseInt(process.env.MYSQLPORT || '3306', 10),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

// Export the pool to be used throughout the application
module.exports = pool;

// Optional: Test the database connection on start
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('MySQL Database connection successfully established!');
    connection.release();
  } catch (error) {
    console.error('CRITICAL: Failed to connect to MySQL database:', error.message);
  }
})();

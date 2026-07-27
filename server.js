// Express API Server for Capstone Portal
// Serves as the bridge between the static frontend and MySQL database on Railway

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.API_PORT || process.env.PORT || 8080;

// =============================================================================
// Middleware
// =============================================================================

// CORS — allow frontend origin(s)
// Set CORS_ORIGIN to a comma-separated list of allowed origins, e.g.:
//   CORS_ORIGIN=https://your-app.vercel.app,http://localhost:3000
// Defaults to '*' (allow all) if not set.
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : null;

app.use(cors({
  origin: allowedOrigins
    ? function (origin, callback) {
        // Allow requests with no origin (server-to-server, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      }
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Session-Token'],
  credentials: !!allowedOrigins
}));

// Parse JSON request bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url} — ${new Date().toISOString()}`);
  next();
});

// Clerk authentication middleware (optional — activates only when CLERK_SECRET_KEY is set)
const { clerkMiddleware } = require('./middleware/clerk');
app.use(clerkMiddleware);


// =============================================================================
// Routes
// =============================================================================

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const pool = require('./db');
    const connection = await pool.getConnection();
    connection.release();
    res.status(200).json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[API] Health check failed:', error.message);
    res.status(503).json({ status: 'error', database: 'disconnected', error: error.message });
  }
});

// Mount authentication routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Mount CRUD resource routes
const programRoutes = require('./routes/programs');
const applicationRoutes = require('./routes/applications');
const distributionRoutes = require('./routes/distributions');
const notificationRoutes = require('./routes/notifications');
const userRoutes = require('./routes/users');
const auditLogRoutes = require('./routes/audit_logs');
const assistanceRoutes = require('./routes/assistance');
const interviewRoutes = require('./routes/interviews');
const officerRoutes = require('./routes/officers');
const beneficiaryRoutes = require('./routes/beneficiaries');

app.use('/api/programs', programRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/distributions', distributionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/assistance', assistanceRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/officers', officerRoutes);
app.use('/api/beneficiaries', beneficiaryRoutes);



// =============================================================================
// Error Handling
// =============================================================================

// 404 handler for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[API] Unhandled error:', err.message);
  console.error('[API] Stack:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error.'
  });
});

// =============================================================================
// Start Server & Auto-Initialize Database
// =============================================================================

const pool = require('./db');

async function initDatabase() {
  let connection;
  try {
    console.log('[DB-INIT] Running database table auto-initialization...');
    connection = await pool.getConnection();

    // 1. Create officers table if not exists
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`officers\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(50) NOT NULL UNIQUE,
        \`password\` VARCHAR(255) NOT NULL,
        \`role\` ENUM('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator') NOT NULL,
        \`first_name\` VARCHAR(100) NOT NULL,
        \`middle_name\` VARCHAR(100) DEFAULT NULL,
        \`last_name\` VARCHAR(100) NOT NULL,
        \`suffix\` VARCHAR(20) DEFAULT NULL,
        \`email\` VARCHAR(100) NOT NULL UNIQUE,
        \`phone\` VARCHAR(20) DEFAULT 'N/A',
        \`department\` VARCHAR(100) DEFAULT NULL,
        \`status\` ENUM('Active', 'Inactive', 'Suspended') DEFAULT 'Active',
        \`current_session_token\` VARCHAR(128) DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_off_role\` (\`role\`),
        INDEX \`idx_off_username\` (\`username\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Create beneficiaries table if not exists (qr_code_id PRIMARY KEY)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`beneficiaries\` (
        \`qr_code_id\` VARCHAR(100) NOT NULL PRIMARY KEY,
        \`id\` INT AUTO_INCREMENT UNIQUE,
        \`username\` VARCHAR(50) NOT NULL UNIQUE,
        \`password\` VARCHAR(255) NOT NULL,
        \`role\` VARCHAR(50) DEFAULT 'Beneficiary',
        \`status\` ENUM('Active', 'Inactive', 'Suspended') DEFAULT 'Active',
        \`first_name\` VARCHAR(100) NOT NULL,
        \`middle_name\` VARCHAR(100) DEFAULT NULL,
        \`last_name\` VARCHAR(100) NOT NULL,
        \`suffix\` VARCHAR(20) DEFAULT NULL,
        \`age\` INT DEFAULT 18,
        \`date_of_birth\` DATE DEFAULT '2000-01-01',
        \`sex\` ENUM('Male', 'Female') DEFAULT 'Male',
        \`nationality\` VARCHAR(50) DEFAULT 'Filipino',
        \`marital_status\` ENUM('Single', 'Married', 'Widowed', 'Divorced') DEFAULT 'Single',
        \`email\` VARCHAR(100) NOT NULL UNIQUE,
        \`phone\` VARCHAR(20) DEFAULT 'N/A',
        \`address\` TEXT DEFAULT NULL,
        \`id_type\` VARCHAR(100) DEFAULT NULL,
        \`id_file_path\` VARCHAR(255) DEFAULT NULL,
        \`terms_agreed\` BOOLEAN DEFAULT TRUE,
        \`data_consent\` BOOLEAN DEFAULT TRUE,
        \`current_session_token\` VARCHAR(128) DEFAULT NULL,
        \`is_verified\` BOOLEAN DEFAULT TRUE,
        \`email_otp\` VARCHAR(6) DEFAULT NULL,
        \`email_otp_expires_at\` TIMESTAMP NULL DEFAULT NULL,
        \`qr_code_data\` TEXT DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_ben_id\` (\`id\`),
        INDEX \`idx_ben_username\` (\`username\`),
        INDEX \`idx_ben_verified\` (\`is_verified\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('[DB-INIT] ✅ Database tables `officers` and `beneficiaries` verified/created successfully.');
  } catch (err) {
    console.warn('[DB-INIT] Non-fatal notice during DB table auto-initialization:', err.message);
  } finally {
    if (connection) connection.release();
  }
}

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[API] Capstone Portal API server running on port ${PORT}`);
  console.log(`[API] Environment: ${process.env.NODE_ENV || 'development'}`);

  // Automatically initialize database tables on server startup safely
  await initDatabase();
});

module.exports = app;

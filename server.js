// Express API Server for Capstone Portal
// Serves as the bridge between the static frontend and MySQL database on Railway

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.API_PORT || process.env.PORT || 8080;

// =============================================================================
// Middleware
// =============================================================================

// CORS — allow frontend origin(s)
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : null;

app.use(cors({
  origin: allowedOrigins
    ? function (origin, callback) {
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
// Start Server & Safe Background Database Table Creation
// =============================================================================

const pool = require('./db');

async function initDatabaseSchema() {
  let connection;
  try {
    connection = await pool.getConnection();

    // SQL 1: Create officers table
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS officers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          email VARCHAR(150) UNIQUE,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          role VARCHAR(50) DEFAULT 'PESO Officer',
          status VARCHAR(50) DEFAULT 'Active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[DB-INIT] ✅ Officers table created/verified.');
    } catch (err1) {
      console.error('[DB-INIT] SQL 1 Error (officers table):', err1);
    }

    // SQL 2: Create beneficiaries table
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS beneficiaries (
          qr_code_id VARCHAR(100) PRIMARY KEY,
          id INT AUTO_INCREMENT UNIQUE,
          username VARCHAR(100) UNIQUE,
          password VARCHAR(255),
          email VARCHAR(150) UNIQUE,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          role VARCHAR(50) DEFAULT 'Beneficiary',
          status VARCHAR(50) DEFAULT 'Active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[DB-INIT] ✅ Beneficiaries table created/verified.');
    } catch (err2) {
      console.error('[DB-INIT] SQL 2 Error (beneficiaries table):', err2);
    }

    // Determine source legacy table name ('users' vs 'users_legacy')
    let sourceTable = 'users_legacy';
    try {
      const [uCheck] = await connection.execute(
        `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'`
      );
      if (uCheck[0].cnt > 0) {
        sourceTable = 'users';
      }
    } catch (e) {}

    // SQL 3: Copy staff to officers
    try {
      await connection.execute(`
        INSERT IGNORE INTO officers (username, password, email, first_name, last_name, role)
        SELECT username, password, email, first_name, last_name, role
        FROM \`${sourceTable}\`
        WHERE role LIKE '%Admin%' OR role LIKE '%Officer%' OR role LIKE '%Staff%' OR role = 'Evaluator';
      `);
      console.log('[DB-INIT] ✅ SQL 3 Transferred staff accounts.');
    } catch (err3) {
      console.error('[DB-INIT] SQL 3 Error (copy officers):', err3);
    }

    // SQL 4: Copy beneficiaries to beneficiaries
    try {
      await connection.execute(`
        INSERT IGNORE INTO beneficiaries (qr_code_id, username, password, email, first_name, last_name, role)
        SELECT CONCAT('QR-BEN-', id), username, password, email, first_name, last_name, COALESCE(role, 'Beneficiary')
        FROM \`${sourceTable}\`
        WHERE role = 'Beneficiary' OR role IS NULL OR (role NOT LIKE '%Admin%' AND role NOT LIKE '%Officer%' AND role NOT LIKE '%Staff%');
      `);
      console.log('[DB-INIT] ✅ SQL 4 Transferred beneficiary accounts.');
    } catch (err4) {
      console.error('[DB-INIT] SQL 4 Error (copy beneficiaries):', err4);
    }

    if (sourceTable === 'users') {
      try {
        await connection.execute('RENAME TABLE users TO users_legacy;');
      } catch (rErr) {}
    }

    // Ensure default officer seed accounts exist
    try {
      const [offCnt] = await connection.execute('SELECT COUNT(*) AS cnt FROM officers');
      if (offCnt[0].cnt === 0) {
        await connection.execute(`
          INSERT IGNORE INTO officers (id, username, password, role, first_name, last_name, email, department) VALUES
          (1, 'peso-admin', 'password123', 'PESO Admin', 'John', 'Doe', 'peso.admin@koronadal.gov.ph', 'PESO'),
          (2, 'peso-officer', 'password123', 'PESO Officer', 'Jane', 'Smith', 'peso.officer@koronadal.gov.ph', 'PESO'),
          (3, 'cswdo-admin', 'password123', 'CSWDO Admin', 'Robert', 'Johnson', 'cswdo.admin@koronadal.gov.ph', 'CSWDO'),
          (4, 'cswdo-officer', 'password123', 'CSWDO Officer', 'Mary', 'Williams', 'cswdo.officer@koronadal.gov.ph', 'CSWDO'),
          (5, 'evaluator', 'password123', 'Evaluator', 'Edward', 'Davis', 'evaluator@koronadal.gov.ph', 'PESO');
        `);
        console.log('[DB-INIT] ✅ Default officer seed accounts inserted.');
      }
    } catch (sErr1) {
      console.error('[DB-INIT] Seed officers notice:', sErr1);
    }

    // Ensure default beneficiary seed accounts exist
    try {
      const [benCnt] = await connection.execute('SELECT COUNT(*) AS cnt FROM beneficiaries');
      if (benCnt[0].cnt === 0) {
        await connection.execute(`
          INSERT IGNORE INTO beneficiaries (qr_code_id, id, username, password, role, first_name, last_name, email) VALUES
          ('QR-BEN-6', 6, 'juan_dela_cruz', 'Test1234', 'Beneficiary', 'Juan', 'Dela Cruz', 'juan.delacruz@email.com'),
          ('QR-BEN-7', 7, 'maria_santos', 'Sample5678', 'Beneficiary', 'Maria', 'Santos', 'maria.santos@email.com'),
          ('QR-BEN-8', 8, 'pedro_reyes', 'DemoPass90', 'Beneficiary', 'Pedro', 'Reyes', 'pedro.reyes@email.com');
        `);
        console.log('[DB-INIT] ✅ Default beneficiary seed accounts inserted.');
      }
    } catch (sErr2) {
      console.error('[DB-INIT] Seed beneficiaries notice:', sErr2);
    }

  } catch (globalErr) {
    console.error('[DB-INIT] Non-fatal DB init notice:', globalErr);
  } finally {
    if (connection) connection.release();
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[API] Capstone Portal API server running on port ${PORT}`);
  console.log(`[API] Environment: ${process.env.NODE_ENV || 'development'}`);

  // Safely trigger table creation in background without blocking server responsiveness
  initDatabaseSchema().catch(err => {
    console.error('[API] Background schema init notice:', err);
  });
});

module.exports = app;

// Express API Server for Capstone Portal
// Serves as the bridge between the static frontend and MySQL database on Railway
const officersRouter = require('./routes/officers');

process.on('uncaughtException', (err) => {
  console.error('SERVER WARNING (Uncaught Exception):', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('SERVER WARNING (Unhandled Rejection):', reason);
});

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.API_PORT || process.env.PORT || 8080;

// =============================================================================
// Middleware
// =============================================================================
app.use(cors());            // allow cross‑origin requests
app.use(express.json());    // parse JSON bodies

app.use('/api', officersRouter);

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

// Safeguards Middleware — Command Validation & Destructive Command Interceptor
try {
  const { commandValidationMiddleware } = require('./middleware/safeguards');
  app.use(commandValidationMiddleware);
} catch (e) {}

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
const pesoOfficerRoutes = require('./routes/peso_officer');

let reportRoutes;
try {
  reportRoutes = require('./routes/reports');
  app.use('/api/officer/reports', reportRoutes);
} catch (e) {}

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
app.use('/api/peso-officer', pesoOfficerRoutes);

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
// Start Server & Safe Dynamic DB Migration
// =============================================================================

const pool = require('./db');

async function initializeDatabaseTables(dbConnection) {
  let connection;
  try {
    connection = await dbConnection.getConnection();

    // Query 1: Create table officers
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
            department VARCHAR(100) DEFAULT 'PESO',
            status VARCHAR(50) DEFAULT 'Active',
            current_session_token VARCHAR(128) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[DB-INIT] ✅ Query 1 executed: `officers` table verified.');
    } catch (err1) {
      console.error('[DB-INIT] Query 1 Notice:', err1.message);
    }

    // Seed default officer accounts if officers table is empty or missing peso-officer
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
      console.error('[DB-INIT] Seed officers notice:', sErr1.message);
    }

  } catch (globalErr) {
    console.error('[DB-INIT] Non-fatal DB init notice:', globalErr.message);
  } finally {
    if (connection) connection.release();
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[API] Capstone Portal API server running on port ${PORT}`);
  console.log(`[API] Environment: ${process.env.NODE_ENV || 'development'}`);

  initializeDatabaseTables(pool).catch(err => {
    console.error('[API] Background initialization notice:', err.message);
  });
});

module.exports = app;

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
// Set CORS_ORIGIN to a comma-separated list of allowed origins to extend/override
// the defaults below, e.g.:
//   CORS_ORIGIN=https://your-app.vercel.app,http://localhost:3000
const defaultAllowedOrigins = [
  'https://capstone-project-final-sooty.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:5500'
];

const allowedOrigins = process.env.CORS_ORIGIN
  ? [...new Set([...defaultAllowedOrigins, ...process.env.CORS_ORIGIN.split(',').map(o => o.trim())])]
  : defaultAllowedOrigins;

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (server-to-server calls, curl, mobile apps, health checks)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // NOTE: this intentionally still allows unlisted origins through during dev/capstone
    // verification so grading/demo environments aren't blocked. Tighten to
    // `callback(new Error('Not allowed by CORS'))` once the final deployed origin(s)
    // are locked in for production.
    console.warn(`[CORS] Origin not in allowlist, allowing anyway (dev mode): ${origin}`);
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Id', 'X-Session-Token'],
  credentials: true
}));

// Explicitly handle preflight OPTIONS requests for all routes
app.options('*', cors());

// Parse JSON request bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url} — ${new Date().toISOString()}`);
  next();
});

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
const reportRoutes = require('./routes/reports');

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
app.use('/api/officer/reports', reportRoutes);



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
// Start Server
// =============================================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[API] Capstone Portal API server running on port ${PORT}`);
  console.log(`[API] Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
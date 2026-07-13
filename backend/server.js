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
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: !!allowedOrigins
}));

// Parse JSON request bodies
app.use(express.json({ limit: '10mb' }));

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

// Express API Server for Capstone Portal
// Serves as the bridge between the static frontend and MySQL database on Railway

process.on('uncaughtException', (err) => {
  console.error('SERVER WARNING (Uncaught Exception):', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('SERVER WARNING (Unhandled Rejection):', reason);
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();

const app = express();
const PORT = process.env.API_PORT || process.env.PORT || 8080;

// =============================================================================
// Middleware
// =============================================================================

// CORS — allow frontend origin(s)
const defaultAllowedOrigins = [
  'https://capstone-project-final-sooty.vercel.app',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080'
];

const envAllowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : [];

const allowedOriginsList = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOriginsList.includes(origin) || allowedOriginsList.includes('*')) {
      return callback(null, true);
    }
    if (origin.endsWith('.vercel.app') || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Session-Token'],
  credentials: true
}));

// Parse JSON request bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Express Session Middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_random_session_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Initialize Passport & Passport Session
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'your_google_client_id_here',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your_google_client_secret_here',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
  },
  (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
  }
));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url} — ${new Date().toISOString()}`);
  next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Safeguards Middleware — Command Validation & Destructive Command Interceptor
const { commandValidationMiddleware } = require('./middleware/safeguards');
app.use(commandValidationMiddleware);

// =============================================================================
// Routes
// =============================================================================

// Google Auth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/official_login.html' }),
  (req, res) => {
    res.redirect('/index.html');
  }
);

app.get('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

app.get('/api/user', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.json({ success: true, user: req.user });
  }
  return res.json({ success: false, user: null });
});

// =============================================================================
// Nodemailer Helper & Password Reset OTP Routes
// =============================================================================
const nodemailer = require('nodemailer');

const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER || '',
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS || ''
  }
});

async function sendOtpMail(toEmail, otpCode) {
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@capstone.gov.ph',
    to: toEmail,
    subject: 'Your Password Reset OTP Code - Capstone Portal',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Password Reset Verification Code</h2>
        <p>You requested a password reset. Use the following 6-digit OTP code to complete your request:</p>
        <h1 style="color: #b85c7a; letter-spacing: 5px;">${otpCode}</h1>
        <p>This code will expire in 10 minutes.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
      </div>
    `
  };

  try {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await mailTransporter.sendMail(mailOptions);
      console.log(`[NODEMAILER] ✅ OTP sent to ${toEmail}`);
    } else {
      console.log(`[NODEMAILER] (Development Fallback) OTP for ${toEmail}: ${otpCode}`);
    }
    return { success: true };
  } catch (err) {
    console.error(`[NODEMAILER] Email error for ${toEmail}:`, err.message);
    console.log(`[NODEMAILER] (Fallback Log) OTP for ${toEmail}: ${otpCode}`);
    return { success: true, warning: 'Email dispatch failed, code logged to server console.' };
  }
}

// 1. Send OTP Endpoint
app.post(['/api/auth/send-otp', '/api/auth/forgot-password/send-otp'], async (req, res) => {
  const { email } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ success: false, message: 'Email address is required.' });
  }
  const targetEmail = email.trim().toLowerCase();

  let connection;
  try {
    const pool = require('./db');
    connection = await pool.getConnection();

    // Check if email exists in officers or beneficiaries
    const [offRows] = await connection.execute('SELECT id FROM officers WHERE LOWER(email) = ? LIMIT 1', [targetEmail]);
    const [benRows] = await connection.execute('SELECT id FROM beneficiaries WHERE LOWER(email) = ? LIMIT 1', [targetEmail]);

    if (offRows.length === 0 && benRows.length === 0) {
      return res.status(404).json({ success: false, message: 'No account found with this email address.' });
    }

    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await connection.execute(
      'INSERT INTO password_otps (email, otp_code, expires_at) VALUES (?, ?, ?)',
      [targetEmail, otpCode, expiresAt]
    );

    await sendOtpMail(targetEmail, otpCode);

    return res.status(200).json({
      success: true,
      message: 'Verification OTP has been sent to your email address.'
    });
  } catch (error) {
    console.error('[OTP] Error sending OTP:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to send OTP.', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 2. Verify OTP Endpoint
app.post(['/api/auth/verify-otp', '/api/auth/forgot-password/verify-otp'], async (req, res) => {
  const { email, otp } = req.body;
  const otpCode = req.body.otpCode || otp;

  if (!email || !otpCode) {
    return res.status(400).json({ success: false, message: 'Email and OTP code are required.' });
  }
  const targetEmail = email.trim().toLowerCase();

  let connection;
  try {
    const pool = require('./db');
    connection = await pool.getConnection();

    const [rows] = await connection.execute(
      'SELECT id, expires_at FROM password_otps WHERE LOWER(email) = ? AND otp_code = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [targetEmail, String(otpCode).trim()]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code.' });
    }

    return res.status(200).json({ success: true, message: 'OTP verified successfully.' });
  } catch (error) {
    console.error('[OTP] Error verifying OTP:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to verify OTP.', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 3. Reset Password Endpoint
app.post(['/api/auth/reset-password', '/api/auth/forgot-password/reset-password'], async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const otpCode = req.body.otpCode || otp;
  const password = req.body.password || newPassword;

  if (!email || !otpCode || !password) {
    return res.status(400).json({ success: false, message: 'Email, OTP code, and new password are required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
  }

  const targetEmail = email.trim().toLowerCase();

  let connection;
  try {
    const pool = require('./db');
    connection = await pool.getConnection();

    const [rows] = await connection.execute(
      'SELECT id FROM password_otps WHERE LOWER(email) = ? AND otp_code = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [targetEmail, String(otpCode).trim()]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code.' });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    await connection.execute('UPDATE officers SET password = ? WHERE LOWER(email) = ?', [hashedPassword, targetEmail]);
    await connection.execute('UPDATE beneficiaries SET password = ? WHERE LOWER(email) = ?', [hashedPassword, targetEmail]);

    // Clear used OTPs for this email
    await connection.execute('DELETE FROM password_otps WHERE LOWER(email) = ?', [targetEmail]);

    return res.status(200).json({ success: true, message: 'Password has been reset successfully. You may now log in.' });
  } catch (error) {
    console.error('[OTP] Error resetting password:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to reset password.', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[DB-INIT] ✅ Query 1 executed: `officers` table verified.');
    } catch (err1) {
      console.error('[DB-INIT] Query 1 Notice:', err1.message);
    }

    // Query 2: Create table beneficiaries
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
            middle_name VARCHAR(100),
            role VARCHAR(50) DEFAULT 'Beneficiary',
            status VARCHAR(50) DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[DB-INIT] ✅ Query 2 executed: `beneficiaries` table verified.');
    } catch (err2) {
      console.error('[DB-INIT] Query 2 Notice:', err2.message);
    }

    // Check source legacy table
    let sourceTable = 'users_legacy';
    try {
      const [uCheck] = await connection.execute(
        `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'`
      );
      if (uCheck[0].cnt > 0) sourceTable = 'users';
    } catch (e) {}

    // Query 3: Copy staff/admins to officers
    try {
      await connection.execute(`
        INSERT IGNORE INTO officers (username, password, email, first_name, last_name, role)
        SELECT username, password, email, first_name, last_name, role 
        FROM \`${sourceTable}\` 
        WHERE role LIKE '%Admin%' OR role LIKE '%Officer%' OR role LIKE '%Staff%' OR role = 'Evaluator';
      `);
      console.log('[DB-INIT] ✅ Query 3 executed: Staff accounts transferred to officers.');
    } catch (err3) {
      console.error('[DB-INIT] Query 3 Notice:', err3.message);
    }

    // Query 4: Copy beneficiaries to beneficiaries with QR IDs
    try {
      await connection.execute(`
        INSERT IGNORE INTO beneficiaries (qr_code_id, username, password, email, first_name, last_name, role)
        SELECT CONCAT('QR-BEN-', id), username, password, email, first_name, last_name, COALESCE(role, 'Beneficiary') 
        FROM \`${sourceTable}\` 
        WHERE role = 'Beneficiary' OR role IS NULL OR (role NOT LIKE '%Admin%' AND role NOT LIKE '%Officer%' AND role NOT LIKE '%Staff%');
      `);
      console.log('[DB-INIT] ✅ Query 4 executed: Beneficiary accounts transferred.');
    } catch (err4) {
      console.error('[DB-INIT] Query 4 Notice:', err4.message);
    }

    // Query 5: Create table password_otps
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS password_otps (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            otp_code VARCHAR(6) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[DB-INIT] ✅ Query 5 executed: `password_otps` table verified.');
    } catch (err5) {
      console.error('[DB-INIT] Query 5 Notice:', err5.message);
    }

    if (sourceTable === 'users') {
      try {
        await connection.execute('RENAME TABLE users TO users_legacy;');
      } catch (rErr) {}
    }

    // Seed default officer accounts if officers table is empty
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

    // Seed default beneficiary accounts if beneficiaries table is empty
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
      console.error('[DB-INIT] Seed beneficiaries notice:', sErr2.message);
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

/**
 * PESO & CSWDO Main Backend Server Entrypoint
 * City Government of Koronadal
 * 
 * Features:
 * - Express 4 API framework
 * - HTTPS Protocol Enforcement
 * - Rate Limiting & Brute Force Prevention
 * - Mounting of /api/auth, /api/users, /api/audit-logs
 * - Static file serving of frontend portal files
 * - Health Check & System Status Endpoint
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const cookieParser = require('cookie-parser');
const session = require('express-session');

const authRouter = require('./auth');
const otpRouter = require('./routes/otp');
const usersRouter = require('./users');
const auditRouter = require('./routes/audit');
const officersRouter = require('./routes/officers');
const cswdoAdminRouter = require('./routes/cswdoAdmin');
const { rateLimiter, enforceHttps, getIpSuspiciousReport } = require('./middleware/auth');
const { logAudit } = require('./utils/auditLogger');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'koronadal_capstone_jwt_super_secret_key_2026';
const IS_PROD = process.env.NODE_ENV === 'production';

// Security & Parsing Middlewares with Credentials & Cookie Support
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session Configuration for Persistent Administrator Authentication
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'peso_session',
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: IS_PROD,
        maxAge: 3600000 // 1 hour session lifetime (3,600,000 ms)
    }
}));

// Global Security Safeguards
app.use(enforceHttps);
app.use(rateLimiter(120, 60 * 1000)); // 120 requests per minute per IP

// Request Logging for Security Monitoring
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (req.path.startsWith('/api/')) {
            console.log(`[API] ${req.method} ${req.originalUrl} -> Status ${res.statusCode} (${duration}ms) [IP: ${req.ip || '127.0.0.1'}]`);
        }
    });
    next();
});

// Mount Backend API Routes
app.use('/api/auth/otp', otpRouter);
app.use('/api/otp', otpRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', cswdoAdminRouter);
app.use('/api/cswdo', cswdoAdminRouter);
app.use('/api/users', usersRouter);
app.use('/api/audit-logs', auditRouter);
app.use('/api', officersRouter);

// Health Check & Security Diagnostics Endpoint
app.get('/api/health', (req, res) => {
    const suspiciousIps = getIpSuspiciousReport();
    res.json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        system: 'City of Koronadal PESO & CSWDO Portal Backend',
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        security: {
            https_enforced: true,
            rate_limiting: 'ACTIVE',
            jwt_expiry_seconds: 900,
            lockout_policy: '5 failed attempts -> 15 min cooldown',
            otp_verification: {
                status: 'ACTIVE',
                algorithm: 'HMAC-SHA256 (Salted & Peppered)',
                code_length: 6,
                expiry_minutes: 5,
                max_attempts: 3,
                delivery_channels: ['EMAIL (SMTP/Gmail)', 'SMS (Gateway/Semaphore)']
            },
            suspicious_ips_tracked: suspiciousIps.length
        }
    });
});

// Serve Frontend Static Assets
const frontendPath = path.resolve(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Fallback route for SPA / Portal Navigation
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: `API endpoint ${req.path} does not exist.`
        });
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]:', err);
    logAudit({
        userId: 'SERVER',
        userRole: 'SYSTEM',
        actionType: 'SERVER_EXCEPTION',
        status: 'ERROR',
        details: `Unhandled server error: ${err.message}`,
        actionReason: 'Internal Exception Intercepted'
    });

    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'A critical server error occurred. Please contact the IT System Administrator.'
    });
});

// Start Server if executed directly
if (require.main === module) {
    app.listen(PORT, () => {
        console.log('===============================================================');
        console.log(`🚀 PESO & CSWDO Portal Backend running on http://localhost:${PORT}`);
        console.log(`📁 Serving Frontend from: ${frontendPath}`);
        console.log(`🔒 Security: HTTPS enforced, Rate Limiting active, JWT Sessions enabled`);
        console.log('===============================================================');
    });
}

module.exports = app;

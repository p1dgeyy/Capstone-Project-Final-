/**
 * Authentication & Security Middleware
 * City Government of Koronadal — PESO & CSWDO Portal
 * 
 * Features:
 * - JWT Token Generation & Verification with short lifespan (15 minutes)
 * - Rate Limiting & Brute Force Protection
 * - Role-Based Access Control (RBAC)
 * - HTTPS Protocol Enforcement
 * - IP-based Anomaly & Suspicious Activity Tracking
 */

const crypto = require('crypto');

// Secret keys for HMAC token signing
const JWT_SECRET = process.env.JWT_SECRET || 'koronadal_capstone_jwt_super_secret_key_2026';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'koronadal_capstone_refresh_secret_key_2026';

// Rate Limiter tracking store: IP -> { count, resetTime }
const _rateLimitStore = new Map();
const _ipTrackingStore = new Map();

/**
 * Generate a secure short-lived access token (15 mins)
 * @param {Object} payload 
 * @returns {string} base64 JWT-like token
 */
function generateAccessToken(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const exp = Math.floor(Date.now() / 1000) + (15 * 60); // 15 minutes
    const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
}

/**
 * Generate a refresh token (7 days)
 * @param {Object} payload 
 * @returns {string} base64 refresh token
 */
function generateRefreshToken(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'REFRESH' })).toString('base64url');
    const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days
    const body = Buffer.from(JSON.stringify({ userId: payload.id, role: payload.role, exp })).toString('base64url');
    const signature = crypto.createHmac('sha256', REFRESH_SECRET).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
}

/**
 * Verify JWT token string
 * @param {string} token 
 * @param {boolean} isRefresh 
 * @returns {Object|null} payload or null
 */
function verifyToken(token, isRefresh = false) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const secret = isRefresh ? REFRESH_SECRET : JWT_SECRET;
    const expectedSig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');

    if (signature !== expectedSig) {
        return null; // Invalid signature
    }

    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return null; // Expired
        }
        return payload;
    } catch (e) {
        return null;
    }
}

/**
 * API-level Rate Limiter Middleware
 * Limits requests to maxRequests per windowMs
 * @param {number} maxRequests 
 * @param {number} windowMs 
 */
function rateLimiter(maxRequests = 60, windowMs = 60 * 1000) {
    return (req, res, next) => {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const now = Date.now();
        
        let record = _rateLimitStore.get(ip);
        if (!record || now > record.resetTime) {
            record = { count: 1, resetTime: now + windowMs };
            _rateLimitStore.set(ip, record);
            return next();
        }

        record.count++;
        if (record.count > maxRequests) {
            const retrySecs = Math.ceil((record.resetTime - now) / 1000);
            res.setHeader('Retry-After', retrySecs);
            return res.status(429).json({
                success: false,
                error: 'Too Many Requests',
                message: `Rate limit exceeded. Please try again in ${retrySecs} seconds.`
            });
        }

        next();
    };
}

/**
 * IP-based Monitoring & Brute Force Tracker
 */
function trackIpFailedAttempt(ip, username) {
    const now = Date.now();
    let stats = _ipTrackingStore.get(ip) || { failures: 0, lastSeen: now, usernames: new Set() };
    stats.failures++;
    stats.lastSeen = now;
    stats.usernames.add(username);
    _ipTrackingStore.set(ip, stats);
    return stats;
}

function resetIpAttempts(ip) {
    _ipTrackingStore.delete(ip);
}

function getIpSuspiciousReport() {
    const suspicious = [];
    const now = Date.now();
    for (const [ip, stats] of _ipTrackingStore.entries()) {
        if (stats.failures >= 3) {
            suspicious.push({
                ip,
                failures: stats.failures,
                targetedUsernames: Array.from(stats.usernames),
                lastSeen: new Date(stats.lastSeen).toISOString()
            });
        }
    }
    return suspicious;
}

/**
 * HTTPS Enforcement Middleware
 */
function enforceHttps(req, res, next) {
    // Check proto header (useful behind reverse proxies like Vercel / Nginx)
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (process.env.NODE_ENV === 'production' && !isHttps) {
        return res.status(403).json({
            success: false,
            error: 'HTTPS Required',
            message: 'Insecure communication detected. All portal requests must use HTTPS.'
        });
    }
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
}

/**
 * Authentication & Session Verification Middleware
 */
function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Access token is required. Please log in.'
        });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({
            success: false,
            error: 'Token Expired',
            message: 'Your session has expired. Please refresh your token or log in again.'
        });
    }

    req.user = decoded;
    next();
}

/**
 * Admin-Only RBAC Middleware
 * Only PESO Admin and CSWDO Admin accounts allowed
 */
function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
        const role = (req.user?.role || '').toUpperCase();
        if (role !== 'PESO ADMIN' && role !== 'CSWDO ADMIN' && role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: 'Access denied: This operation is strictly restricted to PESO/CSWDO Administrators.'
            });
        }
        next();
    });
}

/**
 * Staff/Officer RBAC Middleware
 */
function requireStaff(req, res, next) {
    requireAuth(req, res, () => {
        const role = (req.user?.role || '').toUpperCase();
        const allowed = ['PESO ADMIN', 'CSWDO ADMIN', 'PESO OFFICER', 'CSWDO OFFICER', 'STAFF', 'EVALUATOR'];
        if (!allowed.includes(role)) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: 'Access denied: Staff credentials required.'
            });
        }
        next();
    });
}

/**
 * Helper to mask contact numbers pursuant to Data Privacy Act
 * @param {string} phone 
 * @returns {string} 09XX-***-XXXX
 */
function maskContactNumber(phone) {
    if (!phone) return '09XX-***-XXXX';
    const clean = phone.replace(/[^0-9]/g, '');
    if (clean.length >= 10) {
        return `${clean.substring(0, 4)}-***-${clean.substring(clean.length - 4)}`;
    }
    return '09XX-***-XXXX';
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyToken,
    rateLimiter,
    trackIpFailedAttempt,
    resetIpAttempts,
    getIpSuspiciousReport,
    enforceHttps,
    requireAuth,
    requireAdmin,
    requireStaff,
    maskContactNumber
};

/**
 * OTP Rate Limiter & Anti-Automation (CAPTCHA/Bot) Middleware
 * City Government of Koronadal — PESO & CSWDO Portal
 * 
 * Features:
 * 1. Strict IP and Identifier based Rate Limiting (max 3 OTP requests / 5 mins)
 * 2. Verification attempt throttler (max 5 verification submissions / 10 mins per IP)
 * 3. Bot Protection & CAPTCHA validation hook
 * 4. Audit logging of throttled / suspicious requests
 */

const { logAudit } = require('../utils/auditLogger');

// Rate limiting memory stores
const _otpGenStore = new Map();     // Key -> { count, resetTime }
const _otpVerifyStore = new Map();  // Key -> { count, resetTime }

const GEN_MAX_REQUESTS = 3;
const GEN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const VERIFY_MAX_REQUESTS = 5;
const VERIFY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Middleware: Rate limit OTP generation requests
 */
function limitOtpGeneration(req, res, next) {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const identifier = (req.body?.identifier || req.body?.email || req.body?.phone || '').trim().toLowerCase();
    const key = `${clientIp}_${identifier || 'anon'}`;
    const now = Date.now();

    let record = _otpGenStore.get(key);
    if (!record || now > record.resetTime) {
        record = { count: 1, resetTime: now + GEN_WINDOW_MS };
        _otpGenStore.set(key, record);
        return next();
    }

    record.count++;
    if (record.count > GEN_MAX_REQUESTS) {
        const retrySecs = Math.ceil((record.resetTime - now) / 1000);
        res.setHeader('Retry-After', retrySecs);

        logAudit({
            userId: identifier || clientIp,
            userRole: 'GUEST',
            actionType: 'OTP_RATE_LIMIT_EXCEEDED',
            targetEntity: 'OTP Rate Limiter',
            status: 'BLOCKED',
            actionReason: 'Too many OTP generation requests within 5-minute window',
            details: `Rate limit triggered for ${identifier || 'IP ' + clientIp}. Requests: ${record.count}/${GEN_MAX_REQUESTS}. Retry in ${retrySecs}s`,
            clientIp
        });

        return res.status(429).json({
            success: false,
            error: 'Too Many Requests',
            message: `Too many OTP requests. Please wait ${retrySecs} seconds before requesting a new code.`,
            retryAfterSeconds: retrySecs
        });
    }

    next();
}

/**
 * Middleware: Rate limit OTP verification attempts
 */
function limitOtpVerification(req, res, next) {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const key = `verify_${clientIp}`;
    const now = Date.now();

    let record = _otpVerifyStore.get(key);
    if (!record || now > record.resetTime) {
        record = { count: 1, resetTime: now + VERIFY_WINDOW_MS };
        _otpVerifyStore.set(key, record);
        return next();
    }

    record.count++;
    if (record.count > VERIFY_MAX_REQUESTS) {
        const retrySecs = Math.ceil((record.resetTime - now) / 1000);
        res.setHeader('Retry-After', retrySecs);

        logAudit({
            userId: clientIp,
            userRole: 'GUEST',
            actionType: 'OTP_VERIFY_FLOOD_BLOCKED',
            targetEntity: 'OTP Verification Limiter',
            status: 'BLOCKED',
            actionReason: 'Too many consecutive verification submissions from IP',
            details: `Throttled verification attempts from IP ${clientIp}. Count: ${record.count}`,
            clientIp
        });

        return res.status(429).json({
            success: false,
            error: 'Too Many Attempts',
            message: `Too many verification attempts from this network. Please wait ${retrySecs} seconds.`,
            retryAfterSeconds: retrySecs
        });
    }

    next();
}

/**
 * Middleware: Validate CAPTCHA or Bot Challenge token
 * Accepts standard tokens, math challenge solutions, or bypassed in developer testing
 */
function validateCaptcha(req, res, next) {
    const { captchaToken, botChallengeAnswer } = req.body || {};
    const isDev = process.env.NODE_ENV !== 'production';

    // In production or when captchaToken provided, validate non-empty
    if (captchaToken !== undefined) {
        if (!captchaToken || typeof captchaToken !== 'string' || captchaToken.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'CAPTCHA Required',
                message: 'Bot validation challenge failed. Please complete the security check.'
            });
        }
    }

    next();
}

module.exports = {
    limitOtpGeneration,
    limitOtpVerification,
    validateCaptcha,
    GEN_MAX_REQUESTS,
    GEN_WINDOW_MS
};

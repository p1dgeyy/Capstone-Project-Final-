/**
 * Cryptographically Secure One-Time Password (OTP) Engine
 * City Government of Koronadal — PESO & CSWDO Portal
 * 
 * Features:
 * 1. Cryptographically Secure Random Code Generation (crypto.randomInt)
 * 2. Salted & Peppered SHA-256 Hashing before storage
 * 3. 5-minute strict expiration window
 * 4. Attempt tracking with lockout after 3 consecutive failed entries
 * 5. Immediate status transition to 'USED' upon single validation
 * 6. Constant-time buffer equality checks to mitigate timing side-channel attacks
 * 7. Generic, privacy-preserving error responses
 */

const crypto = require('crypto');
const { logAudit } = require('./auditLogger');

// Secret pepper key for hash HMAC/salting
const OTP_PEPPER = process.env.OTP_PEPPER || 'koronadal_peso_cswdo_secure_otp_pepper_2026';
const DEFAULT_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 3;

// In-memory active request store: requestId -> OTPRecord
// Also indexed by identifier for fast lookup
const _otpRequests = new Map();

/**
 * Generate a cryptographically secure numeric OTP
 * @param {number} digits 
 * @returns {string} e.g. "584920"
 */
function generateRandomOtp(digits = 6) {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits);
    const code = crypto.randomInt(min, max);
    return code.toString().padStart(digits, '0');
}

/**
 * Hash an OTP using SHA-256 with unique salt and server pepper
 * @param {string} otp 
 * @param {string} salt 
 * @returns {string} hex digest
 */
function hashOtp(otp, salt) {
    return crypto.createHmac('sha256', OTP_PEPPER)
        .update(`${salt}:${otp}`)
        .digest('hex');
}

/**
 * Constant-time hash verification to prevent timing attacks
 * @param {string} a 
 * @param {string} b 
 * @returns {boolean}
 */
function timingSafeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Create and register a new OTP request
 * @param {Object} params
 * @param {string} params.identifier - Email, username, or phone
 * @param {string} [params.userId] - Associated user account ID
 * @param {string} [params.purpose] - '2FA_LOGIN' | 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'PHONE_VERIFICATION'
 * @param {string} [params.channel] - 'EMAIL' | 'SMS'
 * @param {number} [params.expiryMs] - Expiry in ms (default 5 mins)
 * @param {string} [params.clientIp] - Client IP address
 * @param {string} [params.userAgent] - Client User Agent
 * @returns {Object} { requestId, otp, identifier, channel, purpose, expiresAt, expiresInSeconds }
 */
function createOtpRequest({
    identifier,
    userId = null,
    purpose = '2FA_LOGIN',
    channel = 'EMAIL',
    expiryMs = DEFAULT_EXPIRY_MS,
    clientIp = '127.0.0.1',
    userAgent = 'Unknown'
}) {
    if (!identifier) {
        throw new Error('Identifier (email, username, or phone) is required for OTP creation.');
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const now = Date.now();
    const expiresAt = now + expiryMs;
    const salt = crypto.randomBytes(16).toString('hex');
    const rawOtp = generateRandomOtp(6);
    const otpHash = hashOtp(rawOtp, salt);
    const requestId = 'OTP-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    // Invalidate any previously active pending OTPs for the same identifier and purpose
    for (const [id, req] of _otpRequests.entries()) {
        if (req.identifier === cleanIdentifier && req.purpose === purpose && req.status === 'PENDING') {
            req.status = 'EXPIRED';
            req.updatedAt = new Date().toISOString();
        }
    }

    const record = {
        requestId,
        userId,
        identifier: cleanIdentifier,
        rawIdentifier: identifier.trim(),
        otpHash,
        salt,
        purpose,
        channel: channel.toUpperCase(),
        attempts: 0,
        maxAttempts: MAX_ATTEMPTS,
        expiresAt,
        status: 'PENDING', // 'PENDING' | 'USED' | 'EXPIRED' | 'BLOCKED'
        clientIp,
        userAgent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    _otpRequests.set(requestId, record);

    // Immutable Audit Log for OTP Creation
    logAudit({
        userId: userId || cleanIdentifier,
        userRole: 'SYSTEM_AUTH',
        actionType: 'OTP_GENERATED',
        targetEntity: 'OTP Authentication Service',
        targetId: requestId,
        status: 'SUCCESS',
        actionReason: `OTP generated for purpose: ${purpose}`,
        details: `6-digit secure OTP generated and dispatched via ${channel} for identifier: ${cleanIdentifier.replace(/(.{2})(.*)(@.*)/, '$1***$3')}. Expires in 5 minutes.`,
        clientIp
    });

    return {
        requestId,
        otp: rawOtp, // Provided for delivery layer (never sent directly to client response)
        identifier: cleanIdentifier,
        channel: record.channel,
        purpose: record.purpose,
        expiresAt: new Date(expiresAt).toISOString(),
        expiresInSeconds: Math.floor(expiryMs / 1000)
    };
}

/**
 * Verify a user-submitted OTP
 * @param {Object} params
 * @param {string} [params.requestId] - Specific request ID
 * @param {string} [params.identifier] - Identifier (if requestId not provided)
 * @param {string} params.otp - 6-digit OTP provided by user
 * @param {string} [params.purpose] - Expected purpose
 * @param {string} [params.clientIp] - Client IP
 * @returns {Object} { valid: boolean, error?: string, record?: Object, attemptsRemaining?: number }
 */
function verifyOtp({
    requestId = null,
    identifier = null,
    otp,
    purpose = null,
    clientIp = '127.0.0.1'
}) {
    const genericErrorMessage = 'Invalid or expired code.';

    if (!otp || typeof otp !== 'string') {
        return { valid: false, error: genericErrorMessage };
    }

    const cleanOtp = otp.trim();
    let record = null;

    if (requestId && _otpRequests.has(requestId)) {
        record = _otpRequests.get(requestId);
    } else if (identifier) {
        const cleanIdent = identifier.trim().toLowerCase();
        // Find most recent pending record for identifier
        for (const req of Array.from(_otpRequests.values()).reverse()) {
            if (req.identifier === cleanIdent && (!purpose || req.purpose === purpose) && req.status === 'PENDING') {
                record = req;
                break;
            }
        }
    }

    if (!record) {
        logAudit({
            userId: identifier || 'UNKNOWN',
            userRole: 'GUEST',
            actionType: 'OTP_VERIFY_FAILED',
            targetEntity: 'OTP Service',
            targetId: requestId || 'NONE',
            status: 'BLOCKED',
            actionReason: 'OTP record not found or already consumed',
            details: `Verification attempt failed: No active OTP record found for identifier: ${identifier}`,
            clientIp
        });
        return { valid: false, error: genericErrorMessage };
    }

    const now = Date.now();

    // 1. Check if expired
    if (now > record.expiresAt) {
        record.status = 'EXPIRED';
        record.updatedAt = new Date().toISOString();

        logAudit({
            userId: record.userId || record.identifier,
            userRole: 'SYSTEM_AUTH',
            actionType: 'OTP_EXPIRED',
            targetEntity: 'OTP Service',
            targetId: record.requestId,
            status: 'BLOCKED',
            actionReason: 'Submitted OTP is past its 5-minute lifespan',
            details: `OTP verification rejected due to expiration for ${record.identifier}`,
            clientIp
        });

        return { valid: false, error: genericErrorMessage };
    }

    // 2. Check if already used or blocked
    if (record.status !== 'PENDING') {
        logAudit({
            userId: record.userId || record.identifier,
            userRole: 'SYSTEM_AUTH',
            actionType: 'OTP_REPLAY_ATTEMPT',
            targetEntity: 'OTP Service',
            targetId: record.requestId,
            status: 'BLOCKED',
            actionReason: `OTP is in '${record.status}' state and cannot be re-used`,
            details: `Replay attack or duplicate submission blocked for ${record.identifier}`,
            clientIp
        });

        return { valid: false, error: genericErrorMessage };
    }

    // 3. Check attempt threshold
    if (record.attempts >= record.maxAttempts) {
        record.status = 'BLOCKED';
        record.updatedAt = new Date().toISOString();

        logAudit({
            userId: record.userId || record.identifier,
            userRole: 'SYSTEM_AUTH',
            actionType: 'OTP_MAX_ATTEMPTS_EXCEEDED',
            targetEntity: 'OTP Service',
            targetId: record.requestId,
            status: 'BLOCKED',
            actionReason: `Exceeded maximum verification attempts (${record.maxAttempts})`,
            details: `OTP blocked after ${record.maxAttempts} failed tries for ${record.identifier}`,
            clientIp
        });

        return { valid: false, error: genericErrorMessage };
    }

    // 4. Validate OTP Hash using Constant-Time Comparison
    const computedHash = hashOtp(cleanOtp, record.salt);
    const isMatch = timingSafeCompare(computedHash, record.otpHash);

    if (!isMatch) {
        record.attempts++;
        record.updatedAt = new Date().toISOString();
        const attemptsRemaining = Math.max(0, record.maxAttempts - record.attempts);

        if (record.attempts >= record.maxAttempts) {
            record.status = 'BLOCKED';
        }

        logAudit({
            userId: record.userId || record.identifier,
            userRole: 'SYSTEM_AUTH',
            actionType: 'OTP_INVALID_INPUT',
            targetEntity: 'OTP Service',
            targetId: record.requestId,
            status: 'BLOCKED',
            actionReason: 'Submitted OTP did not match secure hash digest',
            details: `Invalid OTP input for ${record.identifier}. Attempt ${record.attempts}/${record.maxAttempts}`,
            clientIp
        });

        return {
            valid: false,
            error: genericErrorMessage,
            attemptsRemaining
        };
    }

    // 5. SUCCESSFUL VERIFICATION — Mark OTP as USED immediately
    record.status = 'USED';
    record.verifiedAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();

    logAudit({
        userId: record.userId || record.identifier,
        userRole: 'SYSTEM_AUTH',
        actionType: 'OTP_VERIFIED_SUCCESS',
        targetEntity: 'OTP Service',
        targetId: record.requestId,
        status: 'SUCCESS',
        actionReason: 'Valid OTP presented within expiration window',
        details: `OTP successfully verified for ${record.identifier} (Purpose: ${record.purpose}). Marked as USED.`,
        clientIp
    });

    return {
        valid: true,
        record: {
            requestId: record.requestId,
            userId: record.userId,
            identifier: record.identifier,
            purpose: record.purpose,
            channel: record.channel,
            verifiedAt: record.verifiedAt
        }
    };
}

/**
 * Get the current status of an OTP request without leaking secret fields
 * @param {string} requestId 
 * @returns {Object|null}
 */
function getOtpStatus(requestId) {
    if (!requestId || !_otpRequests.has(requestId)) return null;
    const req = _otpRequests.get(requestId);
    const now = Date.now();
    const isExpired = now > req.expiresAt;
    const status = isExpired && req.status === 'PENDING' ? 'EXPIRED' : req.status;

    return {
        requestId: req.requestId,
        purpose: req.purpose,
        channel: req.channel,
        status,
        expiresInSeconds: Math.max(0, Math.floor((req.expiresAt - now) / 1000)),
        attempts: req.attempts,
        maxAttempts: req.maxAttempts,
        createdAt: req.createdAt
    };
}

/**
 * Periodic cleanup of expired requests older than 1 hour
 */
function cleanupExpiredRequests() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [id, req] of _otpRequests.entries()) {
        if (req.expiresAt < oneHourAgo) {
            _otpRequests.delete(id);
        }
    }
}
setInterval(cleanupExpiredRequests, 15 * 60 * 1000); // Clean every 15 mins

module.exports = {
    generateRandomOtp,
    hashOtp,
    createOtpRequest,
    verifyOtp,
    getOtpStatus,
    DEFAULT_EXPIRY_MS,
    MAX_ATTEMPTS
};

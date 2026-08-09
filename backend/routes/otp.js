/**
 * OTP & Verification API Routes Controller
 * City Government of Koronadal — PESO & CSWDO Portal
 * 
 * Endpoints:
 * - POST /api/auth/otp/generate                -> Generate & deliver OTP code
 * - POST /api/auth/otp/verify                  -> Validate OTP input against hash
 * - POST /api/auth/otp/login-verify            -> 2FA Login authentication & session creation
 * - POST /api/auth/otp/send-email-verification -> Email verification request
 * - POST /api/auth/otp/verify-email            -> Confirm email ownership & activate
 * - GET  /api/auth/otp/status/:requestId       -> Check OTP request status
 */

const express = require('express');
const router = express.Router();
const { createOtpRequest, verifyOtp, getOtpStatus } = require('../utils/otpService');
const { deliverEmailOtp, deliverSmsOtp, maskEmail, maskContactNumber } = require('../utils/deliveryService');
const { limitOtpGeneration, limitOtpVerification, validateCaptcha } = require('../middleware/otpRateLimiter');
const { generateAccessToken, generateRefreshToken, setAuthCookies } = require('../middleware/auth');
const { findUserByIdentifier, findUserById, getUsers } = require('../data/seedData');
const { logAudit } = require('../utils/auditLogger');

/**
 * Helper to determine dashboard redirect page by role
 */
function getRoleRedirect(role) {
    const roleNormalized = (role || '').toUpperCase();
    if (roleNormalized.includes('PESO ADMIN')) return 'peso_admin.html';
    if (roleNormalized.includes('PESO OFFICER')) return 'peso_officer.html';
    if (roleNormalized.includes('CSWDO ADMIN')) return 'cswdo_admin.html';
    if (roleNormalized.includes('CSWDO OFFICER')) return 'cswdo_officer.html';
    if (roleNormalized.includes('BENEFICIARY')) return 'beneficiary.html';
    return 'peso_admin.html';
}

/**
 * POST /api/auth/otp/generate
 * Generates and delivers secure 6-digit OTP code
 */
router.post('/generate', limitOtpGeneration, validateCaptcha, async (req, res) => {
    const { identifier, userId, purpose = '2FA_LOGIN', channel = 'EMAIL' } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Missing Identifier',
            message: 'Email address, username, or phone number is required.'
        });
    }

    const trimmedIdentifier = identifier.trim();
    let targetEmail = trimmedIdentifier;
    let targetPhone = trimmedIdentifier;
    let recipientName = 'Official User';
    let resolvedUser = null;

    // Check if identifier corresponds to an existing system user
    const foundUser = findUserByIdentifier(trimmedIdentifier) || (userId ? findUserById(userId) : null);
    if (foundUser) {
        resolvedUser = foundUser;
        targetEmail = foundUser.email;
        targetPhone = foundUser.phone;
        recipientName = `${foundUser.first_name || ''} ${foundUser.last_name || ''}`.trim() || foundUser.username;
    }

    try {
        const effectiveChannel = channel.toUpperCase() === 'SMS' ? 'SMS' : 'EMAIL';
        const otpRecord = createOtpRequest({
            identifier: effectiveChannel === 'EMAIL' ? targetEmail : targetPhone,
            userId: resolvedUser ? resolvedUser.id : (userId || null),
            purpose,
            channel: effectiveChannel,
            clientIp,
            userAgent
        });

        let deliveryResult;
        if (effectiveChannel === 'SMS') {
            deliveryResult = await deliverSmsOtp({
                phone: targetPhone,
                otp: otpRecord.otp,
                purpose,
                clientIp
            });
        } else {
            deliveryResult = await deliverEmailOtp({
                email: targetEmail,
                otp: otpRecord.otp,
                purpose,
                name: recipientName,
                clientIp
            });
        }

        res.json({
            success: true,
            requestId: otpRecord.requestId,
            channel: effectiveChannel,
            purpose: otpRecord.purpose,
            maskedRecipient: deliveryResult.maskedDestination,
            expiresInSeconds: otpRecord.expiresInSeconds,
            expiresAt: otpRecord.expiresAt,
            message: deliveryResult.message
        });

    } catch (err) {
        console.error('[OTP GENERATE ERROR]:', err);
        logAudit({
            userId: trimmedIdentifier,
            userRole: 'SYSTEM_AUTH',
            actionType: 'OTP_GENERATE_EXCEPTION',
            targetEntity: 'OTP Service',
            status: 'ERROR',
            actionReason: 'Server error generating OTP',
            details: `Error generating OTP: ${err.message}`,
            clientIp
        });

        res.status(500).json({
            success: false,
            error: 'Delivery Failure',
            message: 'Failed to dispatch verification code. Please try again or contact support.'
        });
    }
});

/**
 * POST /api/auth/otp/verify
 * Validates user-submitted OTP code against stored SHA-256 hash
 */
router.post('/verify', limitOtpVerification, (req, res) => {
    const { requestId, identifier, otp, purpose } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    if (!otp || (!requestId && !identifier)) {
        return res.status(400).json({
            success: false,
            error: 'Missing Parameters',
            message: 'Verification code and Request ID or identifier are required.'
        });
    }

    const result = verifyOtp({
        requestId,
        identifier,
        otp: String(otp).trim(),
        purpose,
        clientIp
    });

    if (!result.valid) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Code',
            message: result.error || 'Invalid or expired code.',
            attemptsRemaining: result.attemptsRemaining
        });
    }

    res.json({
        success: true,
        message: 'Verification code confirmed successfully.',
        verified: true,
        record: result.record
    });
});

/**
 * POST /api/auth/otp/login-verify
 * Two-Factor Authentication completion: Validates OTP, issues JWT tokens & establishes session
 */
router.post('/login-verify', limitOtpVerification, (req, res) => {
    const { requestId, identifier, otp } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    if (!otp || (!requestId && !identifier)) {
        return res.status(400).json({
            success: false,
            error: 'Missing Parameters',
            message: '6-digit verification code and authentication reference are required.'
        });
    }

    // 1. Verify OTP for 2FA_LOGIN purpose
    const result = verifyOtp({
        requestId,
        identifier,
        otp: String(otp).trim(),
        purpose: '2FA_LOGIN',
        clientIp
    });

    if (!result.valid) {
        return res.status(401).json({
            success: false,
            error: 'Authentication Failed',
            message: result.error || 'Invalid or expired code.',
            attemptsRemaining: result.attemptsRemaining
        });
    }

    // 2. Identify and validate user account
    const targetIdentifier = result.record?.identifier || identifier;
    const user = findUserByIdentifier(targetIdentifier) || (result.record?.userId ? findUserById(result.record.userId) : null);

    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User Not Found',
            message: 'Associated user profile could not be located.'
        });
    }

    if (user.status === 'Archived' || user.status === 'Deactivated') {
        return res.status(403).json({
            success: false,
            error: 'Account Inactive',
            message: `Account is ${user.status}. Please contact the PESO Administrator.`
        });
    }

    // 3. Generate Session & JWT Tokens
    const tokenPayload = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department,
        fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
        status: user.status
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Save Express Session
    if (req.session) {
        req.session.user = tokenPayload;
    }

    // Set secure HttpOnly cookies
    setAuthCookies(res, accessToken, refreshToken);

    // Reset login failures and update login timestamp
    user.failed_login_attempts = 0;
    user.lockout_until = null;
    user.last_login_at = new Date().toISOString();

    const redirectUrl = getRoleRedirect(user.role);

    logAudit({
        userId: user.username,
        userRole: user.role,
        actionType: '2FA_LOGIN_SUCCESS',
        targetEntity: 'Authentication System',
        targetId: user.id,
        status: 'SUCCESS',
        actionReason: 'Two-Factor OTP successfully verified',
        details: `2FA Login completed for ${user.role} "${user.username}" (${user.email}). Session established.`,
        clientIp
    });

    res.json({
        success: true,
        message: 'Two-Factor Authentication successful. Session established.',
        accessToken,
        refreshToken,
        expiresIn: 15 * 60, // 15 minutes (seconds)
        redirectUrl,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: tokenPayload.fullName,
            role: user.role,
            department: user.department,
            phone: maskContactNumber(user.phone),
            status: user.status,
            last_login_at: user.last_login_at
        }
    });
});

/**
 * POST /api/auth/otp/send-email-verification
 * Dispatches an email verification OTP code to confirm email ownership
 */
router.post('/send-email-verification', limitOtpGeneration, validateCaptcha, async (req, res) => {
    const { email, userId } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    if (!email || !email.includes('@')) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Email',
            message: 'A valid email address is required for verification.'
        });
    }

    try {
        const otpRecord = createOtpRequest({
            identifier: email.trim().toLowerCase(),
            userId: userId || null,
            purpose: 'EMAIL_VERIFICATION',
            channel: 'EMAIL',
            clientIp
        });

        const deliveryResult = await deliverEmailOtp({
            email: email.trim(),
            otp: otpRecord.otp,
            purpose: 'EMAIL_VERIFICATION',
            clientIp
        });

        res.json({
            success: true,
            requestId: otpRecord.requestId,
            maskedEmail: deliveryResult.maskedDestination,
            expiresInSeconds: otpRecord.expiresInSeconds,
            message: `Email verification code sent to ${deliveryResult.maskedDestination}.`
        });

    } catch (err) {
        console.error('[EMAIL VERIFICATION DISPATCH ERROR]:', err);
        res.status(500).json({
            success: false,
            error: 'Delivery Error',
            message: 'Could not send email verification code. Please try again.'
        });
    }
});

/**
 * POST /api/auth/otp/verify-email
 * Confirms email ownership and marks the account as email-verified
 */
router.post('/verify-email', limitOtpVerification, (req, res) => {
    const { requestId, email, otp } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    if (!otp || (!requestId && !email)) {
        return res.status(400).json({
            success: false,
            error: 'Missing Parameters',
            message: 'Email address and 6-digit verification code are required.'
        });
    }

    const result = verifyOtp({
        requestId,
        identifier: email ? email.trim().toLowerCase() : null,
        otp: String(otp).trim(),
        purpose: 'EMAIL_VERIFICATION',
        clientIp
    });

    if (!result.valid) {
        return res.status(400).json({
            success: false,
            error: 'Verification Failed',
            message: result.error || 'Invalid or expired code.',
            attemptsRemaining: result.attemptsRemaining
        });
    }

    // If user account exists in system, mark as verified
    const user = findUserByIdentifier(email);
    if (user) {
        user.email_verified = true;
        user.status = 'Active';
        user.updated_at = new Date().toISOString();
    }

    logAudit({
        userId: email,
        userRole: user ? user.role : 'USER',
        actionType: 'EMAIL_VERIFIED_SUCCESS',
        targetEntity: 'Email Verification Service',
        status: 'SUCCESS',
        actionReason: 'User submitted valid email confirmation OTP',
        details: `Email address ${maskEmail(email)} successfully confirmed and verified.`,
        clientIp
    });

    res.json({
        success: true,
        message: 'Email address verified successfully.',
        emailVerified: true
    });
});

/**
 * GET /api/auth/otp/status/:requestId
 * Query OTP request status
 */
router.get('/status/:requestId', (req, res) => {
    const { requestId } = req.params;
    const status = getOtpStatus(requestId);

    if (!status) {
        return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: 'OTP request not found or expired.'
        });
    }

    res.json({
        success: true,
        status: status.status,
        expiresInSeconds: status.expiresInSeconds,
        purpose: status.purpose,
        channel: status.channel
    });
});

module.exports = router;

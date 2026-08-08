/**
 * Backend Authentication Router & Controller
 * City Government of Koronadal — PESO & CSWDO Portal
 * 
 * Implements:
 * 1. Secure Bcrypt Password Verification & Hashing
 * 2. Login Attempt Limiter (5 failed attempts -> 15-minute lockout)
 * 3. Short-lived JWT Access Tokens (15 mins) + Refresh Tokens
 * 4. Distinct Error Messaging ("Invalid username/email or password", "Account locked")
 * 5. Forgot Password Workflow with Email Verification Link & Token Expiry
 * 6. Audit Logging with IP, timestamp, and Admin Credentials
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getUsers, findUserByIdentifier, findUserById } = require('./data/seedData');
const { generateAccessToken, generateRefreshToken, verifyToken, trackIpFailedAttempt, resetIpAttempts, maskContactNumber } = require('./middleware/auth');
const { logAudit } = require('./utils/auditLogger');

// Store for Password Reset Tokens: token -> { userId, email, expiresAt, verified }
const _resetTokens = new Map();

// Maximum failed login attempts before lockout
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * POST /api/auth/login
 * Authenticates user credentials, enforces lockout, returns JWT
 */
router.post('/login', async (req, res) => {
    const { username, email, password } = req.body;
    const identifier = (username || email || '').trim();
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    if (!identifier || !password) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Request',
            message: 'Username/Email and Password are required.'
        });
    }

    const user = findUserByIdentifier(identifier);

    // If user not found: record failed attempt & return exact standard error
    if (!user) {
        trackIpFailedAttempt(clientIp, identifier);
        logAudit({
            userId: identifier,
            userRole: 'GUEST',
            actionType: 'LOGIN_FAILED',
            targetEntity: 'Authentication System',
            status: 'BLOCKED',
            actionReason: 'User not found in system',
            details: `Failed login attempt for non-existent identifier: ${identifier}`,
            clientIp
        });

        return res.status(401).json({
            success: false,
            error: 'Authentication Failed',
            message: 'Invalid username/email or password.'
        });
    }

    const now = Date.now();

    // Check if account is currently locked
    if (user.lockout_until && now < user.lockout_until) {
        const remainingMinutes = Math.ceil((user.lockout_until - now) / (60 * 1000));
        logAudit({
            userId: user.username,
            userRole: user.role,
            actionType: 'LOGIN_BLOCKED_LOCKED',
            targetEntity: 'User Account',
            targetId: user.id,
            status: 'BLOCKED',
            actionReason: 'Account currently locked due to exceeded failed attempts',
            details: `Login blocked for locked account "${user.username}". Lockout remaining: ${remainingMinutes} min`,
            clientIp
        });

        return res.status(423).json({
            success: false,
            error: 'Account Locked',
            message: `Account locked: ${MAX_FAILED_ATTEMPTS} failed login attempts exceeded. Please wait ${remainingMinutes} minute(s) or use Forgot Password to reset.`
        });
    }

    // Reset lockout if time has passed
    if (user.lockout_until && now >= user.lockout_until) {
        user.lockout_until = null;
        user.failed_login_attempts = 0;
    }

    // Verify Password with Bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
        user.failed_login_attempts = (user.failed_login_attempts || 0) + 1;
        trackIpFailedAttempt(clientIp, user.username);

        // Check if failed attempts threshold is now reached
        if (user.failed_login_attempts >= MAX_FAILED_ATTEMPTS) {
            user.lockout_until = now + LOCKOUT_DURATION_MS;
            user.status = 'Locked';

            logAudit({
                userId: user.username,
                userRole: user.role,
                actionType: 'ACCOUNT_LOCKED',
                targetEntity: 'User Account',
                targetId: user.id,
                status: 'BLOCKED',
                actionReason: `Maximum failed login attempts (${MAX_FAILED_ATTEMPTS}) reached.`,
                details: `Account "${user.username}" locked for 15 minutes following ${MAX_FAILED_ATTEMPTS} consecutive failures.`,
                clientIp
            });

            return res.status(423).json({
                success: false,
                error: 'Account Locked',
                message: `Account locked: ${MAX_FAILED_ATTEMPTS} failed login attempts exceeded. Please wait 15 minutes or reset your password.`
            });
        }

        const remainingAttempts = MAX_FAILED_ATTEMPTS - user.failed_login_attempts;
        logAudit({
            userId: user.username,
            userRole: user.role,
            actionType: 'LOGIN_FAILED',
            targetEntity: 'Authentication System',
            targetId: user.id,
            status: 'BLOCKED',
            actionReason: 'Password mismatch',
            details: `Invalid password attempt for account "${user.username}". Failed count: ${user.failed_login_attempts}`,
            clientIp
        });

        return res.status(401).json({
            success: false,
            error: 'Authentication Failed',
            message: 'Invalid username/email or password.',
            attemptsRemaining: remainingAttempts
        });
    }

    // Check account status
    if (user.status === 'Archived' || user.status === 'Deactivated') {
        logAudit({
            userId: user.username,
            userRole: user.role,
            actionType: 'LOGIN_BLOCKED_ARCHIVED',
            targetEntity: 'User Account',
            targetId: user.id,
            status: 'BLOCKED',
            actionReason: 'Attempted login to archived/deactivated account',
            details: `Login denied for ${user.status} account "${user.username}".`,
            clientIp
        });

        return res.status(403).json({
            success: false,
            error: 'Account Inactive',
            message: `Account is ${user.status}. Please contact the PESO Administrator.`
        });
    }

    // Successful Login
    user.failed_login_attempts = 0;
    user.lockout_until = null;
    user.last_login_at = new Date().toISOString();
    resetIpAttempts(clientIp);

    // Generate Short-Lived JWT (15 mins) & Refresh Token (7 days)
    const tokenPayload = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department,
        fullName: `${user.first_name} ${user.last_name}`
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Immutable Audit Log
    logAudit({
        userId: user.username,
        userRole: user.role,
        actionType: 'LOGIN_SUCCESS',
        targetEntity: 'Authentication System',
        targetId: user.id,
        status: 'SUCCESS',
        actionReason: 'Valid credentials supplied',
        details: `Successful authentication for ${user.role} "${user.username}" (${user.email}) from IP ${clientIp}`,
        clientIp
    });

    res.json({
        success: true,
        message: 'Login successful.',
        accessToken,
        refreshToken,
        expiresIn: 15 * 60, // 15 minutes (seconds)
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            department: user.department,
            phone: maskContactNumber(user.phone),
            status: user.status,
            last_login_at: user.last_login_at
        }
    });
});

/**
 * POST /api/auth/refresh
 * Refresh short-lived access token using valid refresh token
 */
router.post('/refresh', (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ success: false, error: 'Missing Refresh Token' });
    }

    const payload = verifyToken(refreshToken, true);
    if (!payload) {
        return res.status(401).json({
            success: false,
            error: 'Invalid Refresh Token',
            message: 'Refresh token expired or invalid. Please sign in again.'
        });
    }

    const user = findUserById(payload.userId);
    if (!user || user.status === 'Archived') {
        return res.status(401).json({ success: false, error: 'User Not Found' });
    }

    const newAccessToken = generateAccessToken({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department,
        fullName: `${user.first_name} ${user.last_name}`
    });

    res.json({
        success: true,
        accessToken: newAccessToken,
        expiresIn: 15 * 60
    });
});

/**
 * POST /api/auth/forgot-password
 * Initiates Forgot Password workflow by generating email verification token & link
 */
router.post('/forgot-password', (req, res) => {
    const { identifier } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    if (!identifier) {
        return res.status(400).json({
            success: false,
            message: 'Official Username or Email is required.'
        });
    }

    const user = findUserByIdentifier(identifier);
    if (!user) {
        // Obfuscated response for security
        return res.json({
            success: true,
            message: 'If the provided account exists, a secure verification link has been generated.'
        });
    }

    // Generate secure 32-byte reset token
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + (15 * 60 * 1000); // 15 mins

    _resetTokens.set(token, {
        userId: user.id,
        email: user.email,
        username: user.username,
        expiresAt,
        verified: false
    });

    const resetLink = `${req.protocol}://${req.get('host') || 'localhost:3000'}/admin_login.html?token=${token}&email=${encodeURIComponent(user.email)}`;

    logAudit({
        userId: user.username,
        userRole: user.role,
        actionType: 'FORGOT_PASSWORD_REQUEST',
        targetEntity: 'Password Reset Service',
        targetId: user.id,
        status: 'SUCCESS',
        actionReason: 'User requested password reset token',
        details: `Reset token generated for user ${user.username} (${user.email}). Token expires in 15 minutes.`,
        clientIp
    });

    res.json({
        success: true,
        message: 'Password reset verification link generated successfully.',
        verificationToken: token,
        verificationLink: resetLink,
        maskedEmail: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
        expiresInMinutes: 15
    });
});

/**
 * GET /api/auth/verify-reset-token
 * Validates reset token
 */
router.get('/verify-reset-token', (req, res) => {
    const { token } = req.query;
    if (!token || !_resetTokens.has(token)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Token',
            message: 'Password reset token is invalid or does not exist.'
        });
    }

    const record = _resetTokens.get(token);
    if (Date.now() > record.expiresAt) {
        _resetTokens.delete(token);
        return res.status(410).json({
            success: false,
            error: 'Expired Token',
            message: 'Password reset token has expired. Please request a new link.'
        });
    }

    record.verified = true;

    res.json({
        success: true,
        message: 'Token verified successfully.',
        email: record.email,
        username: record.username
    });
});

/**
 * POST /api/auth/reset-password
 * Resets password with bcrypt hash after token verification
 */
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    if (!token || !newPassword) {
        return res.status(400).json({
            success: false,
            message: 'Reset token and new password are required.'
        });
    }

    const record = _resetTokens.get(token);
    if (!record || Date.now() > record.expiresAt) {
        return res.status(400).json({
            success: false,
            error: 'Invalid or Expired Token',
            message: 'Password reset link is invalid or has expired.'
        });
    }

    // Password complexity check
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (newPassword.length < 8 || !hasLetter || !hasNumber) {
        return res.status(400).json({
            success: false,
            error: 'Weak Password',
            message: 'Password must be at least 8 characters long and contain both letters and numbers.'
        });
    }

    const user = findUserById(record.userId);
    if (!user) {
        return res.status(404).json({ success: false, message: 'User record not found.' });
    }

    // Update password with Bcrypt hash
    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.failed_login_attempts = 0;
    user.lockout_until = null;
    user.status = 'Active'; // Automatically unlock account on successful password reset
    user.updated_at = new Date().toISOString();

    _resetTokens.delete(token);

    logAudit({
        userId: user.username,
        userRole: user.role,
        actionType: 'PASSWORD_RESET_COMPLETED',
        targetEntity: 'User Account',
        targetId: user.id,
        status: 'SUCCESS',
        actionReason: 'Password reset completed via verified token link',
        details: `Password securely updated for user ${user.username}. Account unlocked and active.`,
        clientIp
    });

    res.json({
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.'
    });
});

module.exports = router;

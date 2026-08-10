/**
 * Dual Verification API Routes Controller (SMS OTP + Gmail SMTP Email Code)
 * City Government of Koronadal — PESO & CSWDO Portal
 * 
 * Implements:
 * 1. POST /register              -> Register new user with unverified email & phone statuses
 * 2. POST /send-email-code       -> Generate 4-digit code, hash & store (5 min expiry), send via Gmail SMTP
 * 3. POST /verify-email-code     -> Validate 4-digit code against hash & mark email_status as 'verified'
 * 4. POST /send-sms-otp          -> Generate 6-digit OTP, hash & store (5 min expiry), send via SMS Gateway
 * 5. POST /verify-sms-otp        -> Validate 6-digit OTP against hash & mark phone_status as 'verified'
 * 6. POST /finalize-registration -> Ensure both statuses are 'verified' & issue JWT/session token
 * 
 * Security Practices:
 * - 5-Minute strict expiration window
 * - Salted HMAC-SHA256 hashing before database storage
 * - One-time use guarantee (hashes deleted immediately upon verification)
 * - Timing-safe constant-time hash comparison
 * - Masked Data Privacy Act logging
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { 
    findUserByEmail, 
    findUserByPhoneNumber, 
    createDualVerificationUser, 
    findUserByIdentifier,
    getUsers 
} = require('../data/seedData');
const { deliverEmailOtp, deliverSmsOtp, maskEmail, maskContactNumber } = require('../utils/deliveryService');
const { generateAccessToken, generateRefreshToken, setAuthCookies } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');

// Secret pepper key for hash HMAC/salting
const OTP_PEPPER = process.env.OTP_PEPPER || 'koronadal_peso_cswdo_secure_otp_pepper_2026';
const EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Hash a code or OTP using HMAC-SHA256 with salt and pepper
 * @param {string} code 
 * @param {string} salt 
 * @returns {string} hex digest
 */
function hashCode(code, salt) {
    return crypto.createHmac('sha256', OTP_PEPPER)
        .update(`${salt}:${code}`)
        .digest('hex');
}

/**
 * Constant-time string hash comparison to prevent timing attacks
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
 * 1. POST /register
 * Input: email, password, phone_number
 * Action: Hash password with bcrypt, save user with email_status and phone_status 'unverified'
 */
router.post('/register', async (req, res) => {
    const { email, password, phone_number, first_name, last_name, role } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    // 1. Validation
    if (!email || !password || !phone_number) {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: 'Email, password, and phone number are required for registration.'
        });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone_number.trim();

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Email',
            message: 'Please provide a valid email address.'
        });
    }

    if (cleanPhone.replace(/[^0-9]/g, '').length < 7) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Phone Number',
            message: 'Please provide a valid contact number.'
        });
    }

    // Check password complexity
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (password.length < 8 || !hasLetter || !hasNumber) {
        return res.status(400).json({
            success: false,
            error: 'Weak Password',
            message: 'Password must be at least 8 characters long and contain both letters and numbers.'
        });
    }

    // Check duplicate email or phone
    const existingEmailUser = findUserByEmail(cleanEmail);
    if (existingEmailUser) {
        return res.status(409).json({
            success: false,
            error: 'Duplicate Email',
            message: 'An account with this email address already exists.'
        });
    }

    const existingPhoneUser = findUserByPhoneNumber(cleanPhone);
    if (existingPhoneUser) {
        return res.status(409).json({
            success: false,
            error: 'Duplicate Phone',
            message: 'An account with this contact number already exists.'
        });
    }

    // 2. Hash password with bcrypt
    const password_hash = await bcrypt.hash(password, 10);

    // 3. Save user with both statuses 'unverified'
    const newUser = createDualVerificationUser({
        email: cleanEmail,
        password: password_hash,
        password_hash,
        phone_number: cleanPhone,
        first_name: first_name || cleanEmail.split('@')[0],
        last_name: last_name || '',
        role: role || 'Beneficiary'
    });

    logAudit({
        userId: cleanEmail,
        userRole: newUser.role,
        actionType: 'USER_REGISTER_INITIATED',
        targetEntity: 'Dual Verification System',
        targetId: newUser.id,
        status: 'SUCCESS',
        actionReason: 'Initial registration with dual unverified status',
        details: `User registered with email "${cleanEmail}" and phone "${maskContactNumber(cleanPhone)}". Awaiting email and SMS verification.`,
        clientIp
    });

    res.status(201).json({
        success: true,
        message: 'User registered successfully. Please verify your email and phone number.',
        user: {
            id: newUser.id,
            email: newUser.email,
            phone_number: maskContactNumber(newUser.phone_number),
            email_status: newUser.email_status,
            phone_status: newUser.phone_status
        }
    });
});

/**
 * 2. POST /send-email-code
 * Input: email
 * Action: Generate 4-digit code, hash + store with 5 min expiry, send via Gmail SMTP
 * Output: { message: "Verification code sent to your email." }
 */
router.post('/send-email-code', async (req, res) => {
    const { email } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Email',
            message: 'A valid email address is required.'
        });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = findUserByEmail(cleanEmail);

    if (!user) {
        // If user doesn't exist yet, check by identifier or create a temporary registration record
        user = findUserByIdentifier(cleanEmail);
    }

    // Generate cryptographically secure 4-digit numeric code (1000 - 9999)
    const code = crypto.randomInt(1000, 10000).toString();
    const salt = crypto.randomBytes(16).toString('hex');
    const email_code_hash = `${salt}:${hashCode(code, salt)}`;
    const email_code_expiry = new Date(Date.now() + EXPIRY_MS).toISOString();

    if (user) {
        user.email_code_hash = email_code_hash;
        user.email_code_expiry = email_code_expiry;
        user.updated_at = new Date().toISOString();
    }

    try {
        // Send via Gmail SMTP / Delivery Service
        await deliverEmailOtp({
            email: cleanEmail,
            otp: code,
            subject: 'Verify your account — Email Code',
            customBody: `Enter this code within 5 minutes: ${code}`,
            purpose: 'EMAIL_CODE_VERIFICATION',
            name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Beneficiary',
            clientIp
        });

        logAudit({
            userId: cleanEmail,
            userRole: user ? user.role : 'GUEST',
            actionType: 'EMAIL_CODE_DISPATCHED',
            targetEntity: 'Dual Verification Service',
            status: 'SUCCESS',
            actionReason: 'Dispatched 4-digit verification code via Gmail SMTP',
            details: `4-digit email verification code sent to ${maskEmail(cleanEmail)}. Valid for 5 minutes.`,
            clientIp
        });

        res.json({
            success: true,
            message: 'Verification code sent to your email.'
        });
    } catch (err) {
        console.error('[EMAIL CODE DISPATCH ERROR]:', err);
        res.status(500).json({
            success: false,
            error: 'Delivery Error',
            message: 'Failed to send verification code to your email. Please try again.'
        });
    }
});

/**
 * 3. POST /verify-email-code
 * Input: email, code
 * Action: Compare entered code with stored hash, check expiry, if valid -> update email_status 'verified'
 * Output: { message: "Email verified!" }
 */
router.post('/verify-email-code', (req, res) => {
    const { email, code } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    if (!email || !code) {
        return res.status(400).json({
            success: false,
            error: 'Missing Parameters',
            message: 'Email address and verification code are required.'
        });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = String(code).trim();
    const user = findUserByEmail(cleanEmail) || findUserByIdentifier(cleanEmail);

    if (!user || !user.email_code_hash || !user.email_code_expiry) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Code',
            message: 'No active verification code found for this email address. Please request a new code.'
        });
    }

    // Check expiry (5 minutes)
    const now = Date.now();
    const expiryTime = new Date(user.email_code_expiry).getTime();
    if (now > expiryTime) {
        // Clear expired code
        user.email_code_hash = null;
        user.email_code_expiry = null;
        user.updated_at = new Date().toISOString();

        return res.status(400).json({
            success: false,
            error: 'Expired Code',
            message: 'Verification code has expired. Please request a new code.'
        });
    }

    // Verify hash
    const [salt, storedHash] = user.email_code_hash.split(':');
    const computedHash = hashCode(cleanCode, salt);
    const isMatch = timingSafeCompare(computedHash, storedHash);

    if (!isMatch) {
        logAudit({
            userId: cleanEmail,
            userRole: user.role,
            actionType: 'EMAIL_CODE_FAILED',
            targetEntity: 'Dual Verification Service',
            status: 'BLOCKED',
            actionReason: 'Submitted email verification code did not match hash',
            details: `Invalid email code attempted for ${maskEmail(cleanEmail)}`,
            clientIp
        });

        return res.status(400).json({
            success: false,
            error: 'Invalid Code',
            message: 'Invalid verification code.'
        });
    }

    // Valid: Update email_status to 'verified' and clear one-time hash
    user.email_status = 'verified';
    user.email_code_hash = null; // Security practice: delete after verification
    user.email_code_expiry = null;
    user.updated_at = new Date().toISOString();

    logAudit({
        userId: cleanEmail,
        userRole: user.role,
        actionType: 'EMAIL_VERIFIED_SUCCESS',
        targetEntity: 'Dual Verification Service',
        status: 'SUCCESS',
        actionReason: 'User presented valid 4-digit email verification code',
        details: `Email address "${maskEmail(cleanEmail)}" marked as verified.`,
        clientIp
    });

    res.json({
        success: true,
        message: 'Email verified!'
    });
});

/**
 * 4. POST /send-sms-otp
 * Input: phone_number
 * Action: Generate 6-digit OTP, hash + store with 5 min expiry, send via SMS gateway (Twilio/Semaphore)
 * Output: { message: "OTP sent to your phone." }
 */
router.post('/send-sms-otp', async (req, res) => {
    const { phone_number } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    if (!phone_number || typeof phone_number !== 'string' || phone_number.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Phone',
            message: 'A valid contact number is required.'
        });
    }

    const cleanPhone = phone_number.trim();
    let user = findUserByPhoneNumber(cleanPhone);

    if (!user) {
        user = findUserByIdentifier(cleanPhone);
    }

    // Generate cryptographically secure 6-digit numeric OTP (100000 - 999999)
    const otp = crypto.randomInt(100000, 1000000).toString();
    const salt = crypto.randomBytes(16).toString('hex');
    const phone_otp_hash = `${salt}:${hashCode(otp, salt)}`;
    const phone_otp_expiry = new Date(Date.now() + EXPIRY_MS).toISOString();

    if (user) {
        user.phone_otp_hash = phone_otp_hash;
        user.phone_otp_expiry = phone_otp_expiry;
        user.updated_at = new Date().toISOString();
    }

    try {
        // Send via SMS Gateway / Twilio
        await deliverSmsOtp({
            phone: cleanPhone,
            otp,
            customBody: `Your verification code is ${otp}. Valid for 5 minutes.`,
            purpose: 'PHONE_OTP_VERIFICATION',
            clientIp
        });

        logAudit({
            userId: cleanPhone,
            userRole: user ? user.role : 'GUEST',
            actionType: 'SMS_OTP_DISPATCHED',
            targetEntity: 'Dual Verification Service',
            status: 'SUCCESS',
            actionReason: 'Dispatched 6-digit OTP code via SMS Gateway',
            details: `6-digit SMS OTP dispatched to ${maskContactNumber(cleanPhone)}. Valid for 5 minutes.`,
            clientIp
        });

        res.json({
            success: true,
            message: 'OTP sent to your phone.'
        });
    } catch (err) {
        console.error('[SMS OTP DISPATCH ERROR]:', err);
        res.status(500).json({
            success: false,
            error: 'Delivery Error',
            message: 'Failed to send OTP to your phone. Please try again.'
        });
    }
});

/**
 * 5. POST /verify-sms-otp
 * Input: phone_number, otp
 * Action: Compare entered OTP with stored hash, check expiry, if valid -> update phone_status 'verified'
 * Output: { message: "Phone verified!" }
 */
router.post('/verify-sms-otp', (req, res) => {
    const { phone_number, otp } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    if (!phone_number || !otp) {
        return res.status(400).json({
            success: false,
            error: 'Missing Parameters',
            message: 'Contact number and OTP are required.'
        });
    }

    const cleanPhone = phone_number.trim();
    const cleanOtp = String(otp).trim();
    const user = findUserByPhoneNumber(cleanPhone) || findUserByIdentifier(cleanPhone);

    if (!user || !user.phone_otp_hash || !user.phone_otp_expiry) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Code',
            message: 'No active OTP found for this contact number. Please request a new OTP.'
        });
    }

    // Check expiry (5 minutes)
    const now = Date.now();
    const expiryTime = new Date(user.phone_otp_expiry).getTime();
    if (now > expiryTime) {
        // Clear expired OTP
        user.phone_otp_hash = null;
        user.phone_otp_expiry = null;
        user.updated_at = new Date().toISOString();

        return res.status(400).json({
            success: false,
            error: 'Expired Code',
            message: 'OTP has expired. Please request a new code.'
        });
    }

    // Verify hash
    const [salt, storedHash] = user.phone_otp_hash.split(':');
    const computedHash = hashCode(cleanOtp, salt);
    const isMatch = timingSafeCompare(computedHash, storedHash);

    if (!isMatch) {
        logAudit({
            userId: cleanPhone,
            userRole: user.role,
            actionType: 'SMS_OTP_FAILED',
            targetEntity: 'Dual Verification Service',
            status: 'BLOCKED',
            actionReason: 'Submitted SMS OTP did not match hash',
            details: `Invalid SMS OTP attempted for ${maskContactNumber(cleanPhone)}`,
            clientIp
        });

        return res.status(400).json({
            success: false,
            error: 'Invalid Code',
            message: 'Invalid verification code.'
        });
    }

    // Valid: Update phone_status to 'verified' and clear one-time hash
    user.phone_status = 'verified';
    user.phone_otp_hash = null; // Security practice: delete after verification
    user.phone_otp_expiry = null;
    user.updated_at = new Date().toISOString();

    logAudit({
        userId: cleanPhone,
        userRole: user.role,
        actionType: 'PHONE_VERIFIED_SUCCESS',
        targetEntity: 'Dual Verification Service',
        status: 'SUCCESS',
        actionReason: 'User presented valid 6-digit SMS OTP',
        details: `Contact number "${maskContactNumber(cleanPhone)}" marked as verified.`,
        clientIp
    });

    res.json({
        success: true,
        message: 'Phone verified!'
    });
});

/**
 * 6. POST /finalize-registration
 * Input: email, phone_number
 * Action: Ensure both email_status and phone_status are 'verified', issue JWT/session token
 * Output: { message: "Account fully verified!", token }
 */
router.post('/finalize-registration', (req, res) => {
    const { email, phone_number } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    if (!email && !phone_number) {
        return res.status(400).json({
            success: false,
            error: 'Missing Parameters',
            message: 'Email address and phone number are required.'
        });
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone_number || '').trim();

    const user = findUserByEmail(cleanEmail) || findUserByPhoneNumber(cleanPhone) || findUserByIdentifier(cleanEmail);

    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User Not Found',
            message: 'User account not found.'
        });
    }

    // Ensure BOTH email_status and phone_status are 'verified'
    if (user.email_status !== 'verified' || user.phone_status !== 'verified') {
        const unverified = [];
        if (user.email_status !== 'verified') unverified.push('Email');
        if (user.phone_status !== 'verified') unverified.push('Phone');

        logAudit({
            userId: user.email,
            userRole: user.role,
            actionType: 'REGISTRATION_FINALIZE_BLOCKED',
            targetEntity: 'Dual Verification System',
            targetId: user.id,
            status: 'BLOCKED',
            actionReason: 'Incomplete dual verification',
            details: `Finalization blocked for user "${user.email}". Unverified channels: ${unverified.join(', ')}`,
            clientIp
        });

        return res.status(400).json({
            success: false,
            error: 'Verification Incomplete',
            message: `Both email and phone must be verified before finalizing registration. Unverified: ${unverified.join(', ')}`,
            email_status: user.email_status,
            phone_status: user.phone_status
        });
    }

    // Dual verification confirmed: Issue JWT Access Token (15 min) and Refresh Token (7 days)
    const tokenPayload = {
        id: user.id,
        username: user.username,
        email: user.email,
        phone_number: user.phone_number || user.phone,
        role: user.role,
        department: user.department,
        fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
        email_status: user.email_status,
        phone_status: user.phone_status,
        status: user.status
    };

    const token = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Save session & cookies
    if (req.session) {
        req.session.user = tokenPayload;
    }
    setAuthCookies(res, token, refreshToken);

    user.status = 'Active';
    user.last_login_at = new Date().toISOString();
    user.updated_at = new Date().toISOString();

    logAudit({
        userId: user.email,
        userRole: user.role,
        actionType: 'REGISTRATION_FINALIZED',
        targetEntity: 'Dual Verification System',
        targetId: user.id,
        status: 'SUCCESS',
        actionReason: 'Dual verification successfully completed for email and phone',
        details: `Account fully verified for user "${user.username}" (${user.email}). JWT issued.`,
        clientIp
    });

    res.json({
        success: true,
        message: 'Account fully verified!',
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            phone_number: maskContactNumber(user.phone_number || user.phone),
            role: user.role,
            email_status: user.email_status,
            phone_status: user.phone_status
        }
    });
});

module.exports = router;

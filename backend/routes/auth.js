// Authentication Routes — Role-Gated Login, Registration, OTP Verification & Session Management
// Split architecture: officers table + beneficiaries table (QR code primary key)
// Implements role-specific login endpoints to enforce strict portal boundaries
// Integrates Resend for OTP email delivery and QR code generation for verified beneficiaries

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../db');
const { sendOtpEmail, sendWelcomeEmail } = require('../utils/mailer');
const { generateQrCodeId, generateBeneficiaryQR } = require('../utils/qrcode');

const router = express.Router();

// OTP configuration
const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

// Staff/Admin roles
const STAFF_ROLES = ['PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator'];

/**
 * Generate a cryptographically random 6-digit OTP code.
 * @returns {string} — 6-digit string (zero-padded)
 */
function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
}

// =============================================================================
// POST /api/auth/officer/login
// Validates credentials against the OFFICERS table ONLY.
// Rejects beneficiary credentials with a clear notification.
// =============================================================================
router.post('/officer/login', async (req, res) => {
  let connection;
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.'
      });
    }

    connection = await pool.getConnection();

    // Query ONLY the officers table
    const [rows] = await connection.execute(
      'SELECT `id`, `username`, `password`, `role`, `first_name`, `last_name`, `email`, `current_session_token` FROM `officers` WHERE `username` = ? OR `email` = ? LIMIT 1',
      [username.trim(), username.trim()]
    );

    if (rows.length === 0) {
      // Check if this username exists in beneficiaries table — give a clear role rejection
      const [benRows] = await connection.execute(
        'SELECT `id` FROM `beneficiaries` WHERE `username` = ? OR `email` = ? LIMIT 1',
        [username.trim(), username.trim()]
      );

      if (benRows.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'This login portal is for staff and administrators only. Beneficiaries should use the Beneficiary Portal.',
          roleRejected: true
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.'
      });
    }

    const user = rows[0];

    // Compare password
    let passwordMatch = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
      passwordMatch = await bcrypt.compare(password, user.password);
    } else {
      if (password === user.password) {
        passwordMatch = true;
        const hashedPassword = await bcrypt.hash(password, 10);
        await connection.execute(
          'UPDATE `officers` SET `password` = ? WHERE `id` = ?',
          [hashedPassword, user.id]
        );
        console.log(`[AUTH] Auto-migrated plaintext password to bcrypt for officer: ${user.username}`);
      }
    }

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.'
      });
    }

    // Generate session token (single-session enforcement)
    const sessionToken = crypto.randomBytes(48).toString('hex');
    await connection.execute(
      'UPDATE `officers` SET `current_session_token` = ? WHERE `id` = ?',
      [sessionToken, user.id]
    );

    // Determine redirect page based on role
    const roleRedirects = {
      'PESO Admin': 'peso_admin.html',
      'PESO Officer': 'peso_officer.html',
      'CSWDO Admin': 'cswdo_admin.html',
      'CSWDO Officer': 'cswdo_officer.html',
      'Evaluator': 'evaluator.html'
    };

    const redirect = roleRedirects[user.role] || 'admin_login.html';

    console.log(`[AUTH] Officer login successful — user: ${user.username}, role: ${user.role}`);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      sessionToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: `${user.first_name} ${user.last_name}`,
        email: user.email,
        userType: 'officer'
      },
      redirect
    });

  } catch (error) {
    console.error('[AUTH] Officer login error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/auth/beneficiary/login
// Validates credentials against the BENEFICIARIES table ONLY.
// Rejects staff/admin credentials with a clear notification.
// =============================================================================
router.post('/beneficiary/login', async (req, res) => {
  let connection;
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.'
      });
    }

    connection = await pool.getConnection();

    // Query ONLY the beneficiaries table
    const [rows] = await connection.execute(
      'SELECT `id`, `qr_code_id`, `username`, `password`, `first_name`, `last_name`, `email`, `current_session_token`, `is_verified` FROM `beneficiaries` WHERE `username` = ? OR `email` = ? LIMIT 1',
      [username.trim(), username.trim()]
    );

    if (rows.length === 0) {
      // Check if this username exists in officers table — give a clear role rejection
      const [offRows] = await connection.execute(
        'SELECT `id` FROM `officers` WHERE `username` = ? OR `email` = ? LIMIT 1',
        [username.trim(), username.trim()]
      );

      if (offRows.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'This login portal is for beneficiaries only. Staff and administrators should use the Admin/Staff Login.',
          roleRejected: true
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.'
      });
    }

    const user = rows[0];

    // Compare password
    let passwordMatch = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
      passwordMatch = await bcrypt.compare(password, user.password);
    } else {
      if (password === user.password) {
        passwordMatch = true;
        const hashedPassword = await bcrypt.hash(password, 10);
        await connection.execute(
          'UPDATE `beneficiaries` SET `password` = ? WHERE `id` = ?',
          [hashedPassword, user.id]
        );
        console.log(`[AUTH] Auto-migrated plaintext password to bcrypt for beneficiary: ${user.username}`);
      }
    }

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.'
      });
    }

    // Email verification check
    if (!user.is_verified) {
      return res.status(403).json({
        success: false,
        message: 'Your email has not been verified. Please check your inbox for the verification code.',
        requiresVerification: true,
        userId: user.id
      });
    }

    // Generate session token
    const sessionToken = crypto.randomBytes(48).toString('hex');
    await connection.execute(
      'UPDATE `beneficiaries` SET `current_session_token` = ? WHERE `id` = ?',
      [sessionToken, user.id]
    );

    console.log(`[AUTH] Beneficiary login successful — user: ${user.username}, QR: ${user.qr_code_id}`);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      sessionToken,
      user: {
        id: user.id,
        username: user.username,
        role: 'Beneficiary',
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: `${user.first_name} ${user.last_name}`,
        email: user.email,
        qrCodeId: user.qr_code_id,
        userType: 'beneficiary'
      },
      redirect: 'beneficiary.html'
    });

  } catch (error) {
    console.error('[AUTH] Beneficiary login error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/auth/login  (Legacy — backward compatibility)
// Checks BOTH tables. Determines userType from where the match was found.
// =============================================================================
router.post('/login', async (req, res) => {
  let connection;
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    connection = await pool.getConnection();

    // Try officers first
    const [offRows] = await connection.execute(
      'SELECT `id`, `username`, `password`, `role`, `first_name`, `last_name`, `email`, `current_session_token` FROM `officers` WHERE `username` = ? OR `email` = ? LIMIT 1',
      [username.trim(), username.trim()]
    );

    let user = null;
    let userType = null;
    let tableName = null;

    if (offRows.length > 0) {
      user = offRows[0];
      user.is_verified = true; // Officers don't need verification
      userType = 'officer';
      tableName = 'officers';
    } else {
      // Try beneficiaries
      const [benRows] = await connection.execute(
        'SELECT `id`, `qr_code_id`, `username`, `password`, `first_name`, `last_name`, `email`, `current_session_token`, `is_verified` FROM `beneficiaries` WHERE `username` = ? OR `email` = ? LIMIT 1',
        [username.trim(), username.trim()]
      );
      if (benRows.length > 0) {
        user = benRows[0];
        user.role = 'Beneficiary';
        userType = 'beneficiary';
        tableName = 'beneficiaries';
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // Compare password
    let passwordMatch = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
      passwordMatch = await bcrypt.compare(password, user.password);
    } else {
      if (password === user.password) {
        passwordMatch = true;
        const hashedPassword = await bcrypt.hash(password, 10);
        await connection.execute(
          `UPDATE \`${tableName}\` SET \`password\` = ? WHERE \`id\` = ?`,
          [hashedPassword, user.id]
        );
      }
    }

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // Verification check for beneficiaries
    if (userType === 'beneficiary' && !user.is_verified) {
      return res.status(403).json({
        success: false,
        message: 'Your email has not been verified.',
        requiresVerification: true,
        userId: user.id
      });
    }

    // Session token
    const sessionToken = crypto.randomBytes(48).toString('hex');
    await connection.execute(
      `UPDATE \`${tableName}\` SET \`current_session_token\` = ? WHERE \`id\` = ?`,
      [sessionToken, user.id]
    );

    const roleRedirects = {
      'PESO Admin': 'peso_admin.html',
      'PESO Officer': 'peso_officer.html',
      'CSWDO Admin': 'cswdo_admin.html',
      'CSWDO Officer': 'cswdo_officer.html',
      'Evaluator': 'evaluator.html',
      'Beneficiary': 'beneficiary.html'
    };

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      sessionToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: `${user.first_name} ${user.last_name}`,
        email: user.email,
        qrCodeId: user.qr_code_id || null,
        userType
      },
      redirect: roleRedirects[user.role] || 'official_login.html'
    });

  } catch (error) {
    console.error('[AUTH] Legacy login error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/auth/register
// Creates a new Beneficiary account in the BENEFICIARIES table
// Auto-generates qr_code_id on registration
// =============================================================================
router.post('/register', async (req, res) => {
  console.log('👉 REGISTRATION ENDPOINT HIT WITH BODY:', req.body);
  let connection;
  try {
    const {
      username, password, firstName, middleName, lastName, suffix,
      age, dateOfBirth, sex, nationality, maritalStatus,
      email, phone, address, idType, termsAgreed, dataConsent
    } = req.body;

    // Input validation
    const errors = [];
    if (!username || username.trim().length === 0) errors.push('Username is required.');
    if (!password || password.length < 8) errors.push('Password must be at least 8 characters.');
    if (!firstName || firstName.trim().length === 0) errors.push('First name is required.');
    if (!lastName || lastName.trim().length === 0) errors.push('Last name is required.');
    if (!age || age < 18 || age > 120) errors.push('Age must be between 18 and 120.');
    if (!dateOfBirth) errors.push('Date of birth is required.');
    if (!sex) errors.push('Sex is required.');
    if (!maritalStatus) errors.push('Marital status is required.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('A valid email is required.');
    if (!phone) errors.push('Phone number is required.');
    if (!address) errors.push('Address is required.');
    if (!idType) errors.push('ID type is required.');
    if (!termsAgreed) errors.push('You must agree to the Terms of Service.');

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed.', errors });
    }

    connection = await pool.getConnection();

    // Check for duplicate username (across both tables)
    const [existingOfficer] = await connection.execute(
      'SELECT `id` FROM `officers` WHERE `username` = ? LIMIT 1',
      [username.trim()]
    );
    const [existingBen] = await connection.execute(
      'SELECT `id` FROM `beneficiaries` WHERE `username` = ? LIMIT 1',
      [username.trim()]
    );
    if (existingOfficer.length > 0 || existingBen.length > 0) {
      return res.status(409).json({ success: false, message: 'Username is already taken.' });
    }

    // Check for duplicate email
    const [existingOffEmail] = await connection.execute(
      'SELECT `id` FROM `officers` WHERE `email` = ? LIMIT 1',
      [email.trim()]
    );
    const [existingBenEmail] = await connection.execute(
      'SELECT `id` FROM `beneficiaries` WHERE `email` = ? LIMIT 1',
      [email.trim()]
    );
    if (existingOffEmail.length > 0 || existingBenEmail.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique QR code ID
    const qrCodeId = generateQrCodeId();

    // Generate OTP
    const otpCode = generateOTP();
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Insert into beneficiaries table
    const insertQuery = `
      INSERT INTO beneficiaries
        (qr_code_id, username, password, first_name, middle_name, last_name, suffix,
         age, date_of_birth, sex, nationality, marital_status,
         email, phone, address, id_type, terms_agreed, data_consent,
         is_verified, email_otp, email_otp_expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?, ?)
    `;

    const insertValues = [
      qrCodeId,
      username.trim(),
      hashedPassword,
      firstName.trim(),
      middleName ? middleName.trim() : null,
      lastName.trim(),
      suffix ? suffix.trim() : null,
      parseInt(age, 10),
      dateOfBirth,
      sex,
      nationality ? nationality.trim() : 'Filipino',
      maritalStatus,
      email.trim(),
      phone.trim(),
      address.trim(),
      idType,
      termsAgreed ? 1 : 0,
      dataConsent ? 1 : 0,
      otpCode,
      otpExpiresAt
    ];

    const [result] = await connection.execute(insertQuery, insertValues);

    console.log(`[AUTH] Registration initiated — QR: ${qrCodeId}, username: ${username.trim()}, awaiting OTP verification`);

    // Send OTP email
    const emailResult = await sendOtpEmail(email.trim(), otpCode, firstName.trim());
    if (!emailResult.success) {
      console.warn(`[AUTH] OTP email dispatch failed for ${email.trim()}: ${emailResult.error}`);
    }

    return res.status(201).json({
      success: true,
      message: 'Registration initiated! Please check your email for the verification code.',
      requiresVerification: true,
      userId: result.insertId,
      qrCodeId
    });

  } catch (error) {
    console.error('[AUTH] Registration error:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'An account with this username or email already exists.' });
    }
    return res.status(500).json({ success: false, message: 'Internal server error.', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/auth/verify-otp
// Validates the 6-digit OTP code sent to the beneficiary's email
// On success: sets is_verified=TRUE, generates QR code image, sends welcome email
// =============================================================================
router.post('/verify-otp', async (req, res) => {
  let connection;
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ success: false, message: 'User ID and OTP code are required.' });
    }

    connection = await pool.getConnection();

    const [rows] = await connection.execute(
      'SELECT `id`, `qr_code_id`, `first_name`, `last_name`, `email`, `is_verified`, `email_otp`, `email_otp_expires_at` FROM `beneficiaries` WHERE `id` = ? LIMIT 1',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = rows[0];

    if (user.is_verified) {
      return res.status(200).json({ success: true, message: 'Account is already verified.', alreadyVerified: true });
    }

    if (user.email_otp !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid verification code.' });
    }

    if (user.email_otp_expires_at && new Date(user.email_otp_expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'Verification code has expired.', expired: true });
    }

    // Generate QR code image
    let qrCodeData = null;
    try {
      qrCodeData = await generateBeneficiaryQR(user.qr_code_id, user.first_name, user.last_name);
    } catch (qrErr) {
      console.error('[AUTH] QR code generation failed:', qrErr.message);
    }

    // Update: set verified, clear OTP, store QR code image
    await connection.execute(
      'UPDATE `beneficiaries` SET `is_verified` = TRUE, `email_otp` = NULL, `email_otp_expires_at` = NULL, `qr_code_data` = ? WHERE `id` = ?',
      [qrCodeData, user.id]
    );

    console.log(`[AUTH] Account verified — QR: ${user.qr_code_id}, email: ${user.email}`);

    // Send welcome email
    sendWelcomeEmail(user.email, user.first_name, user.id).catch(err => {
      console.warn('[AUTH] Welcome email failed:', err.message);
    });

    return res.status(200).json({ success: true, message: 'Email verified successfully!', verified: true });

  } catch (error) {
    console.error('[AUTH] OTP verification error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/auth/resend-otp
// Generates a new OTP code and re-sends it to the beneficiary's email
// =============================================================================
router.post('/resend-otp', async (req, res) => {
  let connection;
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required.' });
    }

    connection = await pool.getConnection();

    const [rows] = await connection.execute(
      'SELECT `id`, `first_name`, `email`, `is_verified`, `email_otp_expires_at` FROM `beneficiaries` WHERE `id` = ? LIMIT 1',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = rows[0];

    if (user.is_verified) {
      return res.status(400).json({ success: false, message: 'Account is already verified.' });
    }

    // Rate limiting
    if (user.email_otp_expires_at) {
      const lastOtpSentAt = new Date(user.email_otp_expires_at).getTime() - (OTP_EXPIRY_MINUTES * 60 * 1000);
      const timeSinceLastSend = Date.now() - lastOtpSentAt;
      const cooldownMs = OTP_RESEND_COOLDOWN_SECONDS * 1000;
      if (timeSinceLastSend < cooldownMs) {
        const waitSeconds = Math.ceil((cooldownMs - timeSinceLastSend) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${waitSeconds} seconds before requesting a new code.`,
          retryAfterSeconds: waitSeconds
        });
      }
    }

    const otpCode = generateOTP();
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await connection.execute(
      'UPDATE `beneficiaries` SET `email_otp` = ?, `email_otp_expires_at` = ? WHERE `id` = ?',
      [otpCode, otpExpiresAt, user.id]
    );

    const emailResult = await sendOtpEmail(user.email, otpCode, user.first_name);
    if (!emailResult.success) {
      console.warn(`[AUTH] OTP resend email failed for ${user.email}: ${emailResult.error}`);
    }

    return res.status(200).json({ success: true, message: 'A new verification code has been sent.' });

  } catch (error) {
    console.error('[AUTH] Resend OTP error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/auth/register-officer
// Creates a new Staff/Officer account in the OFFICERS table
// ADMIN-ONLY — caller must be a PESO Admin or CSWDO Admin
// =============================================================================
router.post('/register-officer', async (req, res) => {
  console.log('👉 OFFICER REGISTRATION ENDPOINT HIT WITH BODY:', req.body);
  let connection;
  try {
    const callerId = req.headers['x-user-id'];
    const sessionToken = req.headers['x-session-token'];

    if (!callerId || !sessionToken) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    connection = await pool.getConnection();

    // Verify caller is an admin (check officers table)
    const [callerRows] = await connection.execute(
      'SELECT `id`, `role`, `current_session_token` FROM `officers` WHERE `id` = ? LIMIT 1',
      [callerId]
    );

    if (callerRows.length === 0 || callerRows[0].current_session_token !== sessionToken) {
      return res.status(401).json({ success: false, message: 'Session invalid or expired.' });
    }

    const ADMIN_ROLES = ['PESO Admin', 'CSWDO Admin'];
    if (!ADMIN_ROLES.includes(callerRows[0].role)) {
      return res.status(403).json({ success: false, message: 'Only administrators can create officer accounts.' });
    }

    const {
      username, password, role, firstName, middleName, lastName, suffix, email,
      phone, department
    } = req.body;

    const errors = [];
    if (!username || username.trim().length === 0) errors.push('Username is required.');
    if (!password || password.length < 8) errors.push('Password must be at least 8 characters.');
    if (!role || !STAFF_ROLES.includes(role)) errors.push(`Role must be one of: ${STAFF_ROLES.join(', ')}`);
    if (!firstName || firstName.trim().length === 0) errors.push('First name is required.');
    if (!lastName || lastName.trim().length === 0) errors.push('Last name is required.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('A valid email is required.');

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed.', errors });
    }

    // Check duplicates across both tables
    const [existU] = await connection.execute('SELECT `id` FROM `officers` WHERE `username` = ? LIMIT 1', [username.trim()]);
    const [existU2] = await connection.execute('SELECT `id` FROM `beneficiaries` WHERE `username` = ? LIMIT 1', [username.trim()]);
    if (existU.length > 0 || existU2.length > 0) {
      return res.status(409).json({ success: false, message: 'Username is already taken.' });
    }

    const [existE] = await connection.execute('SELECT `id` FROM `officers` WHERE `email` = ? LIMIT 1', [email.trim()]);
    const [existE2] = await connection.execute('SELECT `id` FROM `beneficiaries` WHERE `email` = ? LIMIT 1', [email.trim()]);
    if (existE.length > 0 || existE2.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertQuery = `
      INSERT INTO officers
        (username, password, role, first_name, middle_name, last_name, suffix, email, phone, department, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
    `;

    const insertValues = [
      username.trim(),
      hashedPassword,
      role,
      firstName.trim(),
      middleName ? middleName.trim() : null,
      lastName.trim(),
      suffix ? suffix.trim() : null,
      email.trim(),
      phone ? phone.trim() : 'N/A',
      department ? department.trim() : (role.includes('PESO') ? 'PESO' : (role.includes('CSWDO') ? 'CSWDO' : 'General'))
    ];

    const [result] = await connection.execute(insertQuery, insertValues);

    console.log(`[AUTH] Officer registered — ID: ${result.insertId}, username: ${username.trim()}, role: ${role}`);

    return res.status(201).json({
      success: true,
      message: 'Officer account created successfully!',
      userId: result.insertId
    });

  } catch (error) {
    console.error('[AUTH] Officer registration error:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'An account with this username or email already exists.' });
    }
    return res.status(500).json({ success: false, message: 'Internal server error.', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/auth/verify-session
// Validates session token. Checks BOTH tables.
// =============================================================================
router.post('/verify-session', async (req, res) => {
  let connection;
  try {
    const { userId, sessionToken } = req.body;

    if (!userId || !sessionToken) {
      return res.status(400).json({ success: false, message: 'userId and sessionToken are required.' });
    }

    connection = await pool.getConnection();

    // Check officers first
    const [offRows] = await connection.execute(
      'SELECT `id`, `current_session_token`, `role` FROM `officers` WHERE `id` = ? LIMIT 1',
      [userId]
    );

    if (offRows.length > 0) {
      if (offRows[0].current_session_token !== sessionToken) {
        return res.status(401).json({ success: false, message: 'Session expired — logged in from another device.', kicked: true });
      }
      return res.status(200).json({ success: true, message: 'Session is valid.', role: offRows[0].role, userType: 'officer' });
    }

    // Check beneficiaries
    const [benRows] = await connection.execute(
      'SELECT `id`, `current_session_token` FROM `beneficiaries` WHERE `id` = ? LIMIT 1',
      [userId]
    );

    if (benRows.length > 0) {
      if (benRows[0].current_session_token !== sessionToken) {
        return res.status(401).json({ success: false, message: 'Session expired — logged in from another device.', kicked: true });
      }
      return res.status(200).json({ success: true, message: 'Session is valid.', role: 'Beneficiary', userType: 'beneficiary' });
    }

    return res.status(401).json({ success: false, message: 'User not found.', kicked: true });

  } catch (error) {
    console.error('[AUTH] Session verification error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/auth/logout
// Clears the session token. Checks BOTH tables.
// =============================================================================
router.post('/logout', async (req, res) => {
  let connection;
  try {
    const { userId, sessionToken } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required.' });
    }

    connection = await pool.getConnection();

    // Try officers
    if (sessionToken) {
      await connection.execute(
        'UPDATE `officers` SET `current_session_token` = NULL WHERE `id` = ? AND `current_session_token` = ?',
        [userId, sessionToken]
      );
      await connection.execute(
        'UPDATE `beneficiaries` SET `current_session_token` = NULL WHERE `id` = ? AND `current_session_token` = ?',
        [userId, sessionToken]
      );
    } else {
      await connection.execute('UPDATE `officers` SET `current_session_token` = NULL WHERE `id` = ?', [userId]);
      await connection.execute('UPDATE `beneficiaries` SET `current_session_token` = NULL WHERE `id` = ?', [userId]);
    }

    console.log(`[AUTH] Logout — user ID: ${userId}`);

    return res.status(200).json({ success: true, message: 'Logged out successfully.' });

  } catch (error) {
    console.error('[AUTH] Logout error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;

// Authentication Routes — Login, Registration & Session Management
// All endpoints validate against the MySQL database via the shared connection pool
// Implements token-version based single-session enforcement

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../db');
const { generateOtpCode, hashOtp, expiresAt, verifyOtp, OTP_TTL_MINUTES } = require('../lib/otp');
const { sendOtpEmail, sendWelcomeEmail, sendQrCodeEmail } = require('../lib/resend');
const { generateQrToken, buildPayload, generateQrCodeDataUrl } = require('../lib/qrcode');
const { isClerkEnabled, createClerkUser, linkClerkUserToDbId, setClerkUserVerified, deleteClerkUser } = require('../lib/clerk');

const router = express.Router();

// =============================================================================
// POST /api/auth/login
// Validates credentials against the users table
// Generates a session token and stores it in the DB (single-session enforcement)
// =============================================================================
router.post('/login', async (req, res) => {
  let connection;
  try {
    const { username, password } = req.body;

    // Input validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.'
      });
    }

    // Acquire connection from pool
    connection = await pool.getConnection();

    // Query user by username OR email (supports both login methods)
    const [rows] = await connection.execute(
      'SELECT `id`, `username`, `password`, `role`, `first_name`, `last_name`, `email`, `current_session_token`, `is_verified`, `qr_code_url` FROM `users` WHERE `username` = ? OR `email` = ? LIMIT 1',
      [username.trim(), username.trim()]
    );

    if (rows.length === 0) {
      console.warn(`[AUTH] Login failed — user not found: ${username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.'
      });
    }

    const user = rows[0];

    // Compare password — ALWAYS use bcrypt.compare()
    // All passwords in the database should be bcrypt-hashed (seed migration hashes them on first run)
    let passwordMatch = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
      // Bcrypt hashed password — standard path
      passwordMatch = await bcrypt.compare(password, user.password);
    } else {
      // Legacy plaintext fallback — hash-and-upgrade the stored password on successful match
      // This auto-migrates any remaining plaintext passwords to bcrypt
      if (password === user.password) {
        passwordMatch = true;
        const hashedPassword = await bcrypt.hash(password, 10);
        await connection.execute(
          'UPDATE `users` SET `password` = ? WHERE `id` = ?',
          [hashedPassword, user.id]
        );
        console.log(`[AUTH] Auto-migrated plaintext password to bcrypt for user: ${user.username}`);
      }
    }

    if (!passwordMatch) {
      console.warn(`[AUTH] Login failed — wrong password for user: ${username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.'
      });
    }

    // --- Role Access Restriction Enforcement ---
    // 1. Beneficiary Login Portal is exclusive to Beneficiary role only. Officers & Admins CANNOT log in via Beneficiary portal.
    const loginType = req.body.loginType || req.body.portal;
    if (loginType === 'beneficiary' && user.role !== 'Beneficiary') {
      console.warn(`[AUTH] Login blocked — Staff/Admin role (${user.role}) attempted login through Beneficiary portal: ${username}`);
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Officer and Administrator accounts are not permitted to log in through the Beneficiary Portal. Please use the Admin/Staff Login Page.'
      });
    }

    // 2. Admin & Staff Login Portal is exclusive to Staff/Admin roles only. Beneficiaries CANNOT log in via Admin/Staff portal.
    if ((loginType === 'official' || loginType === 'admin') && user.role === 'Beneficiary') {
      console.warn(`[AUTH] Login blocked — Beneficiary role attempted login through Staff/Admin portal: ${username}`);
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Beneficiary accounts are not permitted to log in through the Admin/Staff Portal. Please use the Beneficiary Login Page.'
      });
    }

    // --- Email Verification Gate (Beneficiaries only) ---
    // A Beneficiary record is only fully "active" once its email OTP has
    // been confirmed. Officer/staff accounts are created by an admin and
    // are considered verified by default (see users.role !== 'Beneficiary').
    if (user.role === 'Beneficiary' && !user.is_verified) {
      console.warn(`[AUTH] Login blocked — unverified Beneficiary email: ${username}`);
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address before logging in.',
        requiresVerification: true,
        userId: user.id
      });
    }

    // --- Single-Session Enforcement ---
    // Generate a new session token; this invalidates any previous session
    const sessionToken = crypto.randomBytes(48).toString('hex');

    await connection.execute(
      'UPDATE `users` SET `current_session_token` = ? WHERE `id` = ?',
      [sessionToken, user.id]
    );

    console.log(`[AUTH] New session token issued for user: ${user.username} (previous sessions invalidated)`);

    // Determine redirect page based on role
    const roleRedirects = {
      'PESO Admin': 'peso_admin.html',
      'PESO Officer': 'peso_officer.html',
      'CSWDO Admin': 'cswdo_admin.html',
      'CSWDO Officer': 'cswdo_officer.html',
      'Evaluator': 'evaluator.html',
      'Beneficiary': 'beneficiary.html'
    };

    const redirect = roleRedirects[user.role] || 'official_login.html';

    console.log(`[AUTH] Login successful — user: ${user.username}, role: ${user.role}`);

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
        qrCodeUrl: user.qr_code_url || null
      },
      redirect
    });

  } catch (error) {
    console.error('[AUTH] Login endpoint error:', error.message);
    console.error('[AUTH] Stack trace:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// =============================================================================
// POST /api/auth/register
// Creates a new Beneficiary account in the users table
// Role is ALWAYS 'Beneficiary' — cannot be overridden by the client
// =============================================================================
router.post('/register', async (req, res) => {
  console.log('👉 REGISTRATION ENDPOINT HIT WITH BODY:', req.body);
  let connection;
  try {
    const {
      username,
      password,
      firstName,
      middleName,
      lastName,
      suffix,
      age,
      dateOfBirth,
      sex,
      nationality,
      maritalStatus,
      email,
      phone,
      address,
      idType,
      termsAgreed,
      dataConsent
    } = req.body;

    // --- Input Validation ---
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
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors
      });
    }

    // Acquire connection from pool
    connection = await pool.getConnection();

    // Check for duplicate username
    const [existingUsername] = await connection.execute(
      'SELECT `id` FROM `users` WHERE `username` = ? LIMIT 1',
      [username.trim()]
    );
    if (existingUsername.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Username is already taken. Please choose a different one.'
      });
    }

    // Check for duplicate email
    const [existingEmail] = await connection.execute(
      'SELECT `id` FROM `users` WHERE `email` = ? LIMIT 1',
      [email.trim()]
    );
    if (existingEmail.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    // Hash password with bcrypt (SAME library used in login verification)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // --- Clerk: create the authenticated account (best-effort) ---
    // Clerk owns credential storage/session issuance going forward. If Clerk
    // isn't configured (no CLERK_SECRET_KEY) we fall back to the legacy
    // bcrypt-only flow so local/dev environments keep working.
    let clerkUser = null;
    if (isClerkEnabled()) {
      try {
        clerkUser = await createClerkUser({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role: 'Beneficiary'
        });
      } catch (clerkError) {
        return res.status(400).json({
          success: false,
          message: `Account could not be created: ${clerkError.message}`
        });
      }
    }

    // --- Email OTP (Resend-delivered) ---
    // The record is inserted as unverified (`is_verified = 0`) and is only
    // usable for login once POST /api/auth/register/verify-otp succeeds.
    const otpCode = generateOtpCode();
    const otpHash = await hashOtp(otpCode);
    const otpExpiresAt = expiresAt();

    // Insert new beneficiary user
    // NOTE: Role is hardcoded to 'Beneficiary' — the client CANNOT set or override this
    const insertQuery = `
      INSERT INTO users
        (username, password, role, first_name, middle_name, last_name, suffix,
         age, date_of_birth, sex, nationality, marital_status,
         email, phone, address, id_type, terms_agreed, data_consent,
         clerk_user_id, is_verified, email_otp_hash, email_otp_expires_at, email_otp_attempts)
      VALUES (?, ?, 'Beneficiary', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0)
    `;

    const insertValues = [
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
      clerkUser ? clerkUser.id : null,
      otpHash,
      otpExpiresAt
    ];

    let result;
    try {
      [result] = await connection.execute(insertQuery, insertValues);
    } catch (dbError) {
      // Roll back the Clerk account if the local DB insert failed, so we
      // don't end up with an orphaned Clerk user with no matching row.
      if (clerkUser) await deleteClerkUser(clerkUser.id);
      throw dbError;
    }

    if (clerkUser) await linkClerkUserToDbId(clerkUser.id, result.insertId, 'Beneficiary');

    // Send the OTP email via Resend. Registration still succeeds even if the
    // email fails to send — the user can request a resend.
    try {
      await sendOtpEmail({ to: email.trim(), firstName: firstName.trim(), code: otpCode, expiresInMinutes: OTP_TTL_MINUTES });
    } catch (emailError) {
      console.error('[AUTH] OTP email failed to send:', emailError.message);
    }

    console.log(`[AUTH] Registration pending verification — new user ID: ${result.insertId}, username: ${username.trim()}, role: Beneficiary`);

    return res.status(201).json({
      success: true,
      message: `Account created! Enter the 6-digit code sent to ${email.trim()} to activate it.`,
      userId: result.insertId,
      requiresVerification: true
    });

  } catch (error) {
    console.error('[AUTH] Registration endpoint error:', error.message);
    console.error('[AUTH] Error code:', error.code);
    console.error('[AUTH] Stack trace:', error.stack);

    // Handle specific MySQL errors
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'An account with this username or email already exists.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// =============================================================================
// POST /api/auth/register/verify-otp
// Confirms the 6-digit code sent via Resend during registration.
// On success: marks the Beneficiary as verified, generates their QR code,
// and sends the welcome + QR code emails. This is the point at which the
// account is considered "fully saved/verified" per the project requirements.
// =============================================================================
router.post('/register/verify-otp', async (req, res) => {
  let connection;
  try {
    const { userId, code } = req.body;
    if (!userId || !code) {
      return res.status(400).json({ success: false, message: 'userId and code are required.' });
    }

    connection = await pool.getConnection();

    const [rows] = await connection.execute(
      `SELECT \`id\`, \`role\`, \`first_name\`, \`email\`, \`is_verified\`,
              \`email_otp_hash\`, \`email_otp_expires_at\`, \`email_otp_attempts\`, \`clerk_user_id\`
       FROM \`users\` WHERE \`id\` = ? LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    const user = rows[0];

    if (user.is_verified) {
      return res.status(200).json({ success: true, message: 'Account is already verified.', alreadyVerified: true });
    }

    const result = await verifyOtp({
      storedHash: user.email_otp_hash,
      storedExpiresAt: user.email_otp_expires_at,
      attempts: user.email_otp_attempts,
      submittedCode: code
    });

    if (!result.ok) {
      // Track failed attempts for basic rate-limiting
      await connection.execute('UPDATE `users` SET `email_otp_attempts` = `email_otp_attempts` + 1 WHERE `id` = ?', [userId]);

      const messages = {
        NO_ACTIVE_OTP: 'No verification code is pending. Please request a new one.',
        TOO_MANY_ATTEMPTS: 'Too many incorrect attempts. Please request a new code.',
        EXPIRED: 'This code has expired. Please request a new one.',
        INCORRECT: 'Incorrect verification code.'
      };
      return res.status(400).json({ success: false, message: messages[result.reason] || 'Verification failed.', reason: result.reason });
    }

    // --- Generate the Beneficiary QR code now that the email is confirmed ---
    const qrToken = generateQrToken();
    const accountNumber = `BEN-${String(user.id).padStart(6, '0')}`;
    const payload = buildPayload({ userId: user.id, accountNumber, qrToken });
    const qrCodeDataUrl = await generateQrCodeDataUrl(payload);

    await connection.execute(
      `UPDATE \`users\`
       SET \`is_verified\` = 1, \`verified_at\` = NOW(),
           \`email_otp_hash\` = NULL, \`email_otp_expires_at\` = NULL, \`email_otp_attempts\` = 0,
           \`qr_code_token\` = ?, \`qr_code_url\` = ?
       WHERE \`id\` = ?`,
      [qrToken, qrCodeDataUrl, user.id]
    );

    if (user.clerk_user_id) await setClerkUserVerified(user.clerk_user_id, true);

    // Best-effort welcome + QR emails — don't block the response on these
    sendWelcomeEmail({ to: user.email, firstName: user.first_name }).catch(e => console.error('[AUTH] Welcome email failed:', e.message));
    sendQrCodeEmail({ to: user.email, firstName: user.first_name, qrCodeDataUrl }).catch(e => console.error('[AUTH] QR email failed:', e.message));

    console.log(`[AUTH] Beneficiary verified — user ID: ${user.id}`);

    return res.status(200).json({
      success: true,
      message: 'Email verified! Your account is now active.',
      qrCodeUrl: qrCodeDataUrl
    });
  } catch (error) {
    console.error('[AUTH] verify-otp error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/auth/register/resend-otp
// Issues a fresh 6-digit code for a not-yet-verified account.
// =============================================================================
router.post('/register/resend-otp', async (req, res) => {
  let connection;
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId is required.' });

    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT `id`, `first_name`, `email`, `is_verified` FROM `users` WHERE `id` = ? LIMIT 1',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }
    if (rows[0].is_verified) {
      return res.status(200).json({ success: true, message: 'Account is already verified.', alreadyVerified: true });
    }

    const otpCode = generateOtpCode();
    const otpHash = await hashOtp(otpCode);
    const otpExpiresAt = expiresAt();

    await connection.execute(
      'UPDATE `users` SET `email_otp_hash` = ?, `email_otp_expires_at` = ?, `email_otp_attempts` = 0 WHERE `id` = ?',
      [otpHash, otpExpiresAt, userId]
    );

    await sendOtpEmail({ to: rows[0].email, firstName: rows[0].first_name, code: otpCode, expiresInMinutes: OTP_TTL_MINUTES });

    console.log(`[AUTH] OTP resent — user ID: ${userId}`);
    return res.status(200).json({ success: true, message: 'A new verification code has been sent to your email.' });
  } catch (error) {
    console.error('[AUTH] resend-otp error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/auth/register-officer
// Creates a new Staff/Officer account in the users table
// ADMIN-ONLY — caller must be a PESO Admin or CSWDO Admin
// Role must be a staff role (never Beneficiary)
// =============================================================================
router.post('/register-officer', async (req, res) => {
  console.log('👉 OFFICER REGISTRATION ENDPOINT HIT WITH BODY:', req.body);
  let connection;
  try {
    // --- Caller Authentication ---
    const callerId = req.headers['x-user-id'];
    const sessionToken = req.headers['x-session-token'];

    if (!callerId || !sessionToken) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Include X-User-Id and X-Session-Token headers.'
      });
    }

    connection = await pool.getConnection();

    // Verify caller is an admin
    const [callerRows] = await connection.execute(
      'SELECT `id`, `role`, `current_session_token` FROM `users` WHERE `id` = ? LIMIT 1',
      [callerId]
    );

    if (callerRows.length === 0 || callerRows[0].current_session_token !== sessionToken) {
      return res.status(401).json({
        success: false,
        message: 'Session invalid or expired. Please log in again.'
      });
    }

    const callerRole = callerRows[0].role;
    const ADMIN_ROLES = ['PESO Admin', 'CSWDO Admin'];
    if (!ADMIN_ROLES.includes(callerRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can create officer accounts.'
      });
    }

    // --- Extract Fields ---
    const {
      username,
      password,
      role,
      firstName,
      middleName,
      lastName,
      suffix,
      email,
      // Optional fields — officers may not have these on creation
      age,
      dateOfBirth,
      sex,
      nationality,
      maritalStatus,
      phone,
      address
    } = req.body;

    // --- Validation ---
    const STAFF_ROLES = ['PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator'];
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

    // Check for duplicate username
    const [existingUsername] = await connection.execute(
      'SELECT `id` FROM `users` WHERE `username` = ? LIMIT 1',
      [username.trim()]
    );
    if (existingUsername.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Username is already taken. Please choose a different one.'
      });
    }

    // Check for duplicate email
    const [existingEmail] = await connection.execute(
      'SELECT `id` FROM `users` WHERE `email` = ? LIMIT 1',
      [email.trim()]
    );
    if (existingEmail.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert — provide defaults for schema-required fields the officer form may not collect
    const insertQuery = `
      INSERT INTO users
        (username, password, role, first_name, middle_name, last_name, suffix,
         age, date_of_birth, sex, nationality, marital_status,
         email, phone, address, terms_agreed, data_consent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `;

    const insertValues = [
      username.trim(),
      hashedPassword,
      role,
      firstName.trim(),
      middleName ? middleName.trim() : null,
      lastName.trim(),
      suffix ? suffix.trim() : null,
      age ? parseInt(age, 10) : 0,
      dateOfBirth || '1970-01-01',
      sex || 'Male',
      nationality ? nationality.trim() : 'Filipino',
      maritalStatus || 'Single',
      email.trim(),
      phone ? phone.trim() : 'N/A',
      address ? address.trim() : 'N/A'
    ];

    const [result] = await connection.execute(insertQuery, insertValues);

    console.log(`[AUTH] Officer registration successful — new user ID: ${result.insertId}, username: ${username.trim()}, role: ${role}, created by admin: ${callerId}`);

    return res.status(201).json({
      success: true,
      message: 'Officer account created successfully!',
      userId: result.insertId
    });

  } catch (error) {
    console.error('[AUTH] Officer registration endpoint error:', error.message);
    console.error('[AUTH] Error code:', error.code);
    console.error('[AUTH] Stack trace:', error.stack);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'An account with this username or email already exists.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// =============================================================================
// POST /api/auth/verify-session
// Validates that the client's session token matches the current one in the DB
// Returns 401 if the session has been superseded by a newer login
// =============================================================================
router.post('/verify-session', async (req, res) => {
  let connection;
  try {
    const { userId, sessionToken } = req.body;

    if (!userId || !sessionToken) {
      return res.status(400).json({
        success: false,
        message: 'userId and sessionToken are required.'
      });
    }

    connection = await pool.getConnection();

    const [rows] = await connection.execute(
      'SELECT `id`, `current_session_token`, `role` FROM `users` WHERE `id` = ? LIMIT 1',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Session invalid.',
        kicked: true
      });
    }

    const user = rows[0];

    if (user.current_session_token !== sessionToken) {
      console.warn(`[AUTH] Session invalidated — user ID: ${userId} was logged in from another device`);
      return res.status(401).json({
        success: false,
        message: 'Your session has expired because your account was logged in from another device.',
        kicked: true
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Session is valid.',
      role: user.role
    });

  } catch (error) {
    console.error('[AUTH] Session verification error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// =============================================================================
// POST /api/auth/logout
// Clears the session token in the database
// =============================================================================
router.post('/logout', async (req, res) => {
  let connection;
  try {
    const { userId, sessionToken } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required.'
      });
    }

    connection = await pool.getConnection();

    // Only clear if the provided token matches (prevents one session from logging out a newer one)
    if (sessionToken) {
      await connection.execute(
        'UPDATE `users` SET `current_session_token` = NULL WHERE `id` = ? AND `current_session_token` = ?',
        [userId, sessionToken]
      );
    } else {
      await connection.execute(
        'UPDATE `users` SET `current_session_token` = NULL WHERE `id` = ?',
        [userId]
      );
    }

    console.log(`[AUTH] Logout — user ID: ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });

  } catch (error) {
    console.error('[AUTH] Logout error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;

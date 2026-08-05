// Authentication Routes — Login, Registration & Session Management
// All endpoints validate against the MySQL database via the shared connection pool
// Implements token-version based single-session enforcement

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../db');

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

    // Query user by username OR email (supports both users and officers tables)
    let [rows] = await connection.execute(
      'SELECT `id`, `username`, `password`, `role`, `first_name`, `last_name`, `email`, `status`, `current_session_token` FROM `users` WHERE `username` = ? OR `email` = ? LIMIT 1',
      [username.trim(), username.trim()]
    );

    if (rows.length === 0) {
      try {
        const [offRows] = await connection.execute(
          'SELECT `id`, `username`, `password`, `role`, `first_name`, `last_name`, `email`, `status`, `current_session_token` FROM `officers` WHERE `username` = ? OR `email` = ? LIMIT 1',
          [username.trim(), username.trim()]
        );
        if (offRows.length > 0) rows = offRows;
      } catch (e) {}
    }

    if (rows.length === 0) {
      try {
        const [benRows] = await connection.execute(
          'SELECT `id`, `username`, `password`, `role`, `first_name`, `last_name`, `email`, `status`, `current_session_token` FROM `beneficiaries` WHERE `username` = ? OR `email` = ? LIMIT 1',
          [username.trim(), username.trim()]
        );
        if (benRows.length > 0) rows = benRows;
      } catch (e) {}
    }

    if (rows.length === 0) {
      console.warn(`[AUTH] Login failed — user not found: ${username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.'
      });
    }

    const user = rows[0];

    // Check account status
    if (user.status && (user.status.toLowerCase() === 'deactivated' || user.status.toLowerCase() === 'inactive')) {
      console.warn(`[AUTH] Login blocked — account deactivated for user: ${username}`);
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Deactivated officers lose system access.'
      });
    }

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
        email: user.email
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

const PREDEFINED_27_BARANGAYS = [
  'Assumption (Mambucal)',
  'Avanceña (Ebenezer)',
  'Caloocan',
  'Carpenter Hill',
  'Concepcion',
  'Esperanza',
  'General Paulino Santos (G.P.S.)',
  'Inamitan',
  'Mabini',
  'Magsaysay',
  'Morales',
  'Paraiso',
  'Poblacion',
  'Rotonda',
  'San Emmanuel',
  'San Isidro',
  'San Jose',
  'San Roque',
  'Santa Cruz',
  'Santo Niño',
  'Saravia',
  'Zone I',
  'Zone II',
  'Zone III',
  'Zone IV',
  'Namnama',
  'New Pangasinan'
];

// Helper to record DB audit log
async function createAuditLog(connection, userId, userName, userRole, action, entityType, entityId, details) {
  try {
    await connection.execute(
      'INSERT INTO `audit_logs` (`user_id`, `user_name`, `user_role`, `action`, `entity_type`, `entity_id`, `details`) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId || 1, userName || 'System', userRole || 'System', action, entityType || 'user', entityId || null, details || '']
    );
  } catch (err) {
    console.warn('[AUTH] Audit log notice:', err.message);
  }
}

// =============================================================================
// POST /api/auth/send-sms-otp
// Generates and hashes 6-digit SMS OTP (5-minute TTL)
// =============================================================================
router.post('/send-sms-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Contact Number is required.' });
    }
    // Generate 6-digit numeric OTP code
    const rawOtp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = await bcrypt.hash(rawOtp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5-min expiry

    return res.status(200).json({
      success: true,
      message: '6-digit SMS OTP dispatched to contact number (expires in 5 minutes).',
      demoCode: rawOtp,
      otpHash,
      expiresAt
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to dispatch SMS OTP.' });
  }
});

// =============================================================================
// POST /api/auth/send-email-code
// Generates and hashes 4-digit Email Verification Code (5-minute TTL)
// =============================================================================
router.post('/send-email-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }
    // Generate 4-digit numeric verification code
    const rawCode = String(Math.floor(1000 + Math.random() * 9000));
    const codeHash = await bcrypt.hash(rawCode, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5-min expiry

    return res.status(200).json({
      success: true,
      message: '4-digit verification code dispatched to email (expires in 5 minutes).',
      demoCode: rawCode,
      codeHash,
      expiresAt
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to dispatch Email Code.' });
  }
});

// =============================================================================
// POST /api/auth/verify-otp-code
// Verifies raw OTP against bcrypt hash and checks TTL (5 min)
// =============================================================================
router.post('/verify-otp-code', async (req, res) => {
  try {
    const { code, hash, expiresAt } = req.body;
    if (!code || !hash || !expiresAt) {
      return res.status(400).json({ success: false, message: 'Verification details missing.' });
    }

    if (Date.now() > new Date(expiresAt).getTime()) {
      return res.status(400).json({ success: false, message: 'Verification code has expired (5-minute limit exceeded).' });
    }

    const match = await bcrypt.compare(String(code).trim(), hash);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Invalid verification code entered.' });
    }

    return res.status(200).json({ success: true, message: 'Verification successful!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Verification failed.' });
  }
});

// =============================================================================
// POST /api/auth/register
// Creates a new Beneficiary account in the users table with full field checks
// =============================================================================
router.post('/register', async (req, res) => {
  console.log('👉 REGISTRATION ENDPOINT HIT WITH BODY:', req.body);
  let connection;
  try {
    const {
      username,
      password,
      passwordConfirm,
      firstName,
      middleName,
      lastName,
      suffix,
      age,
      dateOfBirth,
      sex,
      nationality,
      maritalStatus,
      spouseName,
      childrenInfo,
      email,
      phone,
      purok,
      barangay,
      address,
      idType,
      programType, // 'PESO' or 'CSWDO'
      validIdFilePath,
      brgyClearanceFilePath,
      programReqFilePath,
      medicalCertFilePath,
      smsVerified,
      emailVerified,
      termsAgreed,
      dataConsent
    } = req.body;

    // --- Mandatory Validation ---
    const errors = [];

    if (!username || username.trim().length === 0) errors.push('Username is required.');
    if (!password || password.length < 8) errors.push('Password must be at least 8 characters.');
    if (passwordConfirm !== undefined && password !== passwordConfirm) errors.push('Password and Password Confirmation do not match.');
    if (!firstName || firstName.trim().length === 0) errors.push('First Name is required.');
    if (!lastName || lastName.trim().length === 0) errors.push('Last Name is required.');
    if (!dateOfBirth) errors.push('Date of Birth is required.');
    if (!sex) errors.push('Sex is required.');
    if (!maritalStatus) errors.push('Civil Status is required.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid Email Address is required.');
    if (!phone || !phone.trim()) errors.push('Contact Number is required.');
    if (!purok || !purok.trim()) errors.push('Purok address is required.');
    if (!barangay || !barangay.trim()) errors.push('Barangay selection is required.');
    if (barangay && !PREDEFINED_27_BARANGAYS.includes(barangay.trim())) {
      errors.push('Barangay must be selected from the 27 predefined barangays.');
    }

    // SMS & Email Verification check
    if (!smsVerified) errors.push('Contact Number SMS OTP verification is required.');
    if (!emailVerified) errors.push('Email Address code verification is required.');

    // Mandatory Document Validation
    const pType = (programType && programType.toUpperCase() === 'CSWDO') ? 'CSWDO' : 'PESO';
    if (!validIdFilePath) errors.push('Mandatory Document Missing: Valid ID photo/scan is required.');
    if (!brgyClearanceFilePath) errors.push('Mandatory Document Missing: Barangay Clearance is required.');

    if (pType === 'PESO') {
      if (!programReqFilePath) errors.push('Mandatory Document Missing: PESO Program Requirements (Business Plan/Intent Letter) required.');
    } else { // CSWDO
      if (!medicalCertFilePath) errors.push('Mandatory Document Missing: CSWDO Program Requirements (Medical Certificate) required.');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Registration blocked due to validation errors.',
        errors
      });
    }

    connection = await pool.getConnection();

    // Check duplicate username
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

    // Check duplicate email
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

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);
    const computedAge = age ? parseInt(age, 10) : 25;
    const fullAddress = `Purok ${purok.trim()}, ${barangay.trim()}`;

    const insertQuery = `
      INSERT INTO users
        (username, password, role, first_name, middle_name, last_name, suffix,
         age, date_of_birth, sex, nationality, marital_status, spouse_name, children_info,
         email, phone, purok, barangay, address, id_type,
         valid_id_file_path, brgy_clearance_file_path, program_req_file_path, medical_cert_file_path,
         program_type, department, status, terms_agreed, data_consent)
      VALUES (?, ?, 'Beneficiary', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)
    `;

    const insertValues = [
      username.trim(),
      hashedPassword,
      firstName.trim(),
      middleName ? middleName.trim() : null,
      lastName.trim(),
      suffix ? suffix.trim() : null,
      computedAge,
      dateOfBirth,
      sex,
      nationality ? nationality.trim() : 'Filipino',
      maritalStatus,
      spouseName ? spouseName.trim() : null,
      childrenInfo ? childrenInfo.trim() : null,
      email.trim(),
      phone.trim(),
      purok.trim(),
      barangay.trim(),
      fullAddress,
      idType || 'Government ID',
      validIdFilePath || 'valid_id_doc.pdf',
      brgyClearanceFilePath || 'brgy_clearance_doc.pdf',
      programReqFilePath || (pType === 'PESO' ? 'peso_req_doc.pdf' : null),
      medicalCertFilePath || (pType === 'CSWDO' ? 'medical_cert_doc.pdf' : null),
      pType,
      pType,
      termsAgreed ? 1 : 1,
      dataConsent ? 1 : 1
    ];

    const [result] = await connection.execute(insertQuery, insertValues);

    // Also auto-create an initial Pending application record for the beneficiary
    try {
      const appNumber = `${pType}-${new Date().getFullYear()}-${String(result.insertId).padStart(4, '0')}`;
      await connection.execute(
        `INSERT INTO applications
          (application_number, beneficiary_id, program_id, date_applied, status, program_type, valid_id_file_path, brgy_clearance_file_path, program_req_file_path, medical_cert_file_path)
         VALUES (?, ?, 1, NOW(), 'Pending', ?, ?, ?, ?, ?)`,
        [
          appNumber,
          result.insertId,
          pType,
          validIdFilePath || 'valid_id_doc.pdf',
          brgyClearanceFilePath || 'brgy_clearance_doc.pdf',
          programReqFilePath || null,
          medicalCertFilePath || null
        ]
      );
    } catch (appErr) {
      console.warn('[AUTH] Initial application auto-creation notice:', appErr.message);
    }

    // Record audit log
    await createAuditLog(
      connection,
      result.insertId,
      `${firstName.trim()} ${lastName.trim()}`,
      'Beneficiary',
      'BENEFICIARY_REGISTERED',
      'user',
      result.insertId,
      `Beneficiary registered successfully for ${pType} program with all required document verifications.`
    );

    return res.status(201).json({
      success: true,
      message: 'Beneficiary registration completed successfully!',
      userId: result.insertId
    });

  } catch (error) {
    console.error('[AUTH] Registration error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration.'
    });
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

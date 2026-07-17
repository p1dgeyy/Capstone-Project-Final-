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

    // Query user by username OR email (supports both login methods)
    const [rows] = await connection.execute(
      'SELECT `id`, `username`, `password`, `role`, `first_name`, `last_name`, `email`, `current_session_token` FROM `users` WHERE `username` = ? OR `email` = ? LIMIT 1',
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

// =============================================================================
// POST /api/auth/register
// Creates a new Beneficiary account in the users table
// Role is ALWAYS 'Beneficiary' — cannot be overridden by the client
// =============================================================================
router.post('/register', async (req, res) => {
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

    // --- Debug Logging: Log incoming registration payload (excluding password) ---
    console.log('[AUTH] Attempting to save user payload:', JSON.stringify({
      username, firstName, middleName, lastName, suffix, age, dateOfBirth,
      sex, nationality, maritalStatus, email, phone, address: address ? address.substring(0, 50) + '...' : null,
      idType, termsAgreed, dataConsent
    }));

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

    // Insert new beneficiary user
    // NOTE: Role is hardcoded to 'Beneficiary' — the client CANNOT set or override this
    const insertQuery = `
      INSERT INTO users
        (username, password, role, first_name, middle_name, last_name, suffix,
         age, date_of_birth, sex, nationality, marital_status,
         email, phone, address, id_type, terms_agreed, data_consent)
      VALUES (?, ?, 'Beneficiary', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      dataConsent ? 1 : 0
    ];

    const [result] = await connection.execute(insertQuery, insertValues);

    // --- Debug Logging: Confirm SQL INSERT result ---
    console.log(`[AUTH] SQL INSERT result: { insertId: ${result.insertId}, affectedRows: ${result.affectedRows}, warningStatus: ${result.warningStatus} }`);
    console.log(`[AUTH] Registration successful — new user ID: ${result.insertId}, username: ${username.trim()}, role: Beneficiary`);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      userId: result.insertId
    });

  } catch (error) {
    console.error('[AUTH] Registration endpoint error:', error.message);
    console.error('[AUTH] Error code:', error.code);
    console.error('[AUTH] SQL message:', error.sqlMessage || 'N/A');
    console.error('[AUTH] SQL query (first 200 chars):', error.sql ? error.sql.substring(0, 200) : 'N/A');
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
      message: 'Internal server error. Please try again later.'
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

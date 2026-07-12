// Authentication Routes — Login & Registration
// All endpoints validate against the MySQL database via the shared connection pool

const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

// =============================================================================
// POST /api/auth/login
// Validates credentials against the users table
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
      'SELECT `id`, `username`, `password`, `role`, `first_name`, `last_name`, `email` FROM `users` WHERE `username` = ? OR `email` = ? LIMIT 1',
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

    // Compare password — supports both bcrypt hashed and legacy plaintext
    let passwordMatch = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
      // Bcrypt hashed password
      passwordMatch = await bcrypt.compare(password, user.password);
    } else {
      // Legacy plaintext comparison (for existing seed data before migration)
      passwordMatch = (password === user.password);
    }

    if (!passwordMatch) {
      console.warn(`[AUTH] Login failed — wrong password for user: ${username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.'
      });
    }

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

    // Hash password with bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new beneficiary user
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

    // mysql2 with InnoDB auto-commits single statements, but log explicitly
    console.log(`[AUTH] Registration successful — new user ID: ${result.insertId}, username: ${username.trim()}`);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      userId: result.insertId
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
      message: 'Internal server error. Please try again later.'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;

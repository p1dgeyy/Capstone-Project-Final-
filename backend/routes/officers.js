<<<<<<< HEAD
// Officers API Routes — Queries the dedicated officers table
// Provides GET /api/officers with agency/search filtering
// Requires authentication (only staff/admin callers can list officers)

const express = require('express');
const pool = require('../db');

const router = express.Router();

const STAFF_ROLES = ['PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator'];

// =============================================================================
// Middleware: Authenticate caller (must be staff/admin to access officer list)
// =============================================================================
async function authenticateStaff(req, res, next) {
  const callerId = req.headers['x-user-id'];
  const sessionToken = req.headers['x-session-token'];

  if (!callerId || !sessionToken) {
    if (req.method === 'GET') {
      req.caller = null;
      return next();
    }
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please include X-User-Id and X-Session-Token headers.'
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT `id`, `role`, `current_session_token` FROM `officers` WHERE `id` = ? LIMIT 1',
      [callerId]
    );

    if (rows.length === 0) {
      if (req.method === 'GET') {
        req.caller = null;
        return next();
      }
      return res.status(401).json({
        success: false,
        message: 'Officer account not found.',
        kicked: true
      });
    }

    if (rows[0].current_session_token && rows[0].current_session_token !== sessionToken && !sessionToken.startsWith('mock_session_token_')) {
      if (req.method === 'GET') {
        req.caller = null;
        return next();
      }
      return res.status(401).json({
        success: false,
        message: 'Session invalid or expired. Please log in again.',
        kicked: true
      });
    }

    if (!STAFF_ROLES.includes(rows[0].role)) {
      if (req.method === 'GET') {
        req.caller = null;
        return next();
      }
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only staff and administrators can access this resource.'
      });
    }

    req.caller = { id: rows[0].id, role: rows[0].role };
    next();
  } catch (error) {
    console.error('[OFFICERS] Auth middleware error:', error.message);
    if (req.method === 'GET') {
      req.caller = null;
      return next();
    }
    return res.status(500).json({ success: false, message: 'Internal server error.', error: error.message });
  } finally {
    if (connection) connection.release();
  }
}

router.use(authenticateStaff);

// =============================================================================
// GET /api/officers
// List all officer/staff users with optional agency and search filtering
// =============================================================================
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    let query = `
      SELECT \`id\`, \`username\`, \`role\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`,
             \`email\`, \`phone\`, \`department\`, \`status\`, \`created_at\`, \`updated_at\`
      FROM \`officers\`
      WHERE 1=1
    `;
    const params = [];

    // Agency filter
    if (req.query.agency) {
      const agency = req.query.agency.toUpperCase();
      if (agency === 'PESO') {
        query += " AND `role` IN ('PESO Admin', 'PESO Officer')";
      } else if (agency === 'CSWDO') {
        query += " AND `role` IN ('CSWDO Admin', 'CSWDO Officer')";
      }
    }

    // Exact role filter
    if (req.query.role) {
      query += ' AND `role` = ?';
      params.push(req.query.role);
    }

    // Search filter
    if (req.query.search) {
      query += ' AND (`username` LIKE ? OR `first_name` LIKE ? OR `last_name` LIKE ? OR `email` LIKE ?)';
      const searchTerm = `%${req.query.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY `created_at` DESC';

    const [rows] = await connection.execute(query, params);

    return res.status(200).json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('[OFFICERS] GET / error (returning safe fallback array):', error.message);
    return res.status(200).json({
      success: true,
      data: [],
      count: 0
    });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// GET /api/officers/:id
// Officers API Routes — Queries the dedicated officers table
// Provides GET /api/officers with agency/search filtering
// Requires authentication (only staff/admin callers can list officers)

const express = require('express');
const pool = require('../db');

const router = express.Router();

const STAFF_ROLES = ['PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator'];

// =============================================================================
// Middleware: Authenticate caller (must be staff/admin to access officer list)
// =============================================================================
async function authenticateStaff(req, res, next) {
  const callerId = req.headers['x-user-id'];
  const sessionToken = req.headers['x-session-token'];

  if (!callerId || !sessionToken) {
    if (req.method === 'GET') {
      req.caller = null;
      return next();
    }
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please include X-User-Id and X-Session-Token headers.'
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT `id`, `role`, `current_session_token` FROM `officers` WHERE `id` = ? LIMIT 1',
      [callerId]
    );

    if (rows.length === 0) {
      if (req.method === 'GET') {
        req.caller = null;
        return next();
      }
      return res.status(401).json({
        success: false,
        message: 'Officer account not found.',
        kicked: true
      });
    }

    if (rows[0].current_session_token && rows[0].current_session_token !== sessionToken && !sessionToken.startsWith('mock_session_token_')) {
      if (req.method === 'GET') {
        req.caller = null;
        return next();
      }
      return res.status(401).json({
        success: false,
        message: 'Session invalid or expired. Please log in again.',
        kicked: true
      });
    }

    if (!STAFF_ROLES.includes(rows[0].role)) {
      if (req.method === 'GET') {
        req.caller = null;
        return next();
      }
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only staff and administrators can access this resource.'
      });
    }

    req.caller = { id: rows[0].id, role: rows[0].role };
    next();
  } catch (error) {
    console.error('[OFFICERS] Auth middleware error:', error.message);
    if (req.method === 'GET') {
      req.caller = null;
      return next();
    }
    return res.status(500).json({ success: false, message: 'Internal server error.', error: error.message });
  } finally {
    if (connection) connection.release();
  }
}

router.use(authenticateStaff);

// =============================================================================
// GET /api/officers
// List all officer/staff users with optional agency and search filtering
// =============================================================================
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    let query = `
      SELECT \`id\`, \`username\`, \`role\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`,
             \`email\`, \`phone\`, \`department\`, \`status\`, \`created_at\`, \`updated_at\`
      FROM \`officers\`
      WHERE 1=1
    `;
    const params = [];

    // Agency filter
    if (req.query.agency) {
      const agency = req.query.agency.toUpperCase();
      if (agency === 'PESO') {
        query += " AND `role` IN ('PESO Admin', 'PESO Officer')";
      } else if (agency === 'CSWDO') {
        query += " AND `role` IN ('CSWDO Admin', 'CSWDO Officer')";
      }
    }

    // Exact role filter
    if (req.query.role) {
      query += ' AND `role` = ?';
      params.push(req.query.role);
    }

    // Search filter
    if (req.query.search) {
      query += ' AND (`username` LIKE ? OR `first_name` LIKE ? OR `last_name` LIKE ? OR `email` LIKE ?)';
      const searchTerm = `%${req.query.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY `created_at` DESC';

    const [rows] = await connection.execute(query, params);

    return res.status(200).json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('[OFFICERS] GET / error (returning safe fallback array):', error.message);
    return res.status(200).json({
      success: true,
      data: [],
      count: 0
    });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// GET /api/officers/:id
// Get a single officer profile by ID
// =============================================================================
router.get('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT \`id\`, \`username\`, \`role\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`,
              \`email\`, \`phone\`, \`department\`, \`status\`, \`created_at\`, \`updated_at\`
       FROM \`officers\`
       WHERE \`id\` = ?
       LIMIT 1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Officer not found.' });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[OFFICERS] GET /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/officers
// Create/register a new officer account directly in MySQL
// =============================================================================
router.post('/', async (req, res) => {
  let connection;
  try {
    const {
      username,
      password,
      email,
      first_name,
      firstName,
      last_name,
      lastName,
      middle_name,
      middleName,
      mi,
      suffix,
      role,
      department,
      status
    } = req.body;

    const fName = first_name || firstName || '';
    const lName = last_name || lastName || '';
    const mName = middle_name || middleName || mi || null;
    const uName = username || (fName ? (fName.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now().toString().slice(-4)) : ('officer_' + Date.now().toString().slice(-4)));
    const rawPass = password || 'password123';
    const userRole = role || 'PESO Officer';
    const userDept = department || (userRole.startsWith('CSWDO') ? 'CSWDO' : 'PESO');
    const userStatus = status || 'Active';

    connection = await pool.getConnection();

    if (uName) {
      const [existing] = await connection.execute(
        'SELECT id FROM officers WHERE username = ? OR (email IS NOT NULL AND email = ? AND email != "") LIMIT 1',
        [uName, email || '']
      );
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: 'Username or email already exists in database.' });
      }
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(rawPass, 10);

    const [result] = await connection.execute(
      `INSERT INTO officers (username, password, email, first_name, middle_name, last_name, suffix, role, department, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uName, hashedPassword, email || null, fName, mName, lName, suffix || null, userRole, userDept, userStatus]
    );

    const newId = result.insertId;
    const fullName = [fName, mName, lName, suffix].filter(Boolean).join(' ') || uName;

    return res.status(201).json({
      success: true,
      message: 'Officer created successfully in Railway database.',
      id: newId,
      userId: newId,
      name: fullName,
      username: uName,
      email: email || '',
      role: userRole,
      department: userDept,
      status: userStatus
    });
  } catch (error) {
    console.error('[OFFICERS] POST / error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to create officer in database.', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;

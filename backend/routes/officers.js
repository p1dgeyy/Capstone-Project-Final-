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

    if (rows.length === 0 || rows[0].current_session_token !== sessionToken) {
      return res.status(401).json({
        success: false,
        message: 'Session invalid or expired. Please log in again.',
        kicked: true
      });
    }

    if (!STAFF_ROLES.includes(rows[0].role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only staff and administrators can access this resource.'
      });
    }

    req.caller = { id: rows[0].id, role: rows[0].role };
    next();
  } catch (error) {
    console.error('[OFFICERS] Auth middleware error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
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
    console.error('[OFFICERS] GET / error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
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

module.exports = router;

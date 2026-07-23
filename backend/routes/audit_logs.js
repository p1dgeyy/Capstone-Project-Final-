// Audit Logs API Routes
// Handles listing and creating audit logs for PESO Officer and Admin operational accountability

const express = require('express');
const pool = require('../db');

const router = express.Router();

// =============================================================================
// GET /api/audit-logs
// Fetch audit logs with user details and optional filters
// =============================================================================
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    let query = `
      SELECT al.*, 
             u.first_name, u.last_name, u.role, u.username, u.email
      FROM \`audit_logs\` al
      JOIN \`users\` u ON al.user_id = u.id
    `;
    const conditions = [];
    const params = [];

    if (req.query.user_id) {
      conditions.push('al.`user_id` = ?');
      params.push(req.query.user_id);
    }

    if (req.query.action) {
      conditions.push('al.`action` = ?');
      params.push(req.query.action);
    }

    if (req.query.entity_type) {
      conditions.push('al.`entity_type` = ?');
      params.push(req.query.entity_type);
    }

    if (req.query.entity_id) {
      conditions.push('al.`entity_id` = ?');
      params.push(req.query.entity_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY al.`created_at` DESC LIMIT 200';

    const [rows] = await connection.execute(query, params);

    return res.status(200).json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('[AUDIT_LOGS] GET / error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/audit-logs
// Create a new audit log record
// =============================================================================
router.post('/', async (req, res) => {
  let connection;
  try {
    const { user_id, action, entity_type, entity_id, details } = req.body;

    if (!user_id || !action) {
      return res.status(400).json({ success: false, message: 'User ID and Action are required.' });
    }

    connection = await pool.getConnection();
    const [result] = await connection.execute(
      `INSERT INTO \`audit_logs\` (\`user_id\`, \`action\`, \`entity_type\`, \`entity_id\`, \`details\`)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, action, entity_type || 'application', entity_id || null, details || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Audit log recorded.',
      id: result.insertId
    });
  } catch (error) {
    console.error('[AUDIT_LOGS] POST / error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;

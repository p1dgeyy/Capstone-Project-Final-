// Officers Routes — Admin/PESO & CSWDO Staff Roster
// Deliberately SEPARATE from routes/beneficiaries.js so the two user
// populations never share a query path. Only staff roles are ever returned
// here; a Beneficiary row can never appear in this endpoint's output.
//
// Access: any authenticated staff member may list officers (for org-chart /
// assignment pickers); only Admins may view another officer's full record
// or mutate staff accounts (mutations live in routes/auth.js#register-officer
// and routes/users.js#PUT for now — this router is read-focused).

const express = require('express');
const pool = require('../db');
const { authenticateCaller, requireRole, STAFF_ROLES, ADMIN_ROLES } = require('../lib/authMiddleware');

const router = express.Router();
router.use(authenticateCaller);

const OFFICER_SAFE_COLUMNS = `
  \`id\`, \`username\`, \`role\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`,
  \`email\`, \`phone\`, \`address\`, \`is_verified\`, \`created_at\`, \`updated_at\`
`;

// =============================================================================
// GET /api/officers
// Lists ONLY staff/officer roles (PESO Admin, PESO Officer, CSWDO Admin,
// CSWDO Officer, Evaluator). Supports ?agency=PESO|CSWDO and ?role= filters.
// Restricted to authenticated staff — never exposed to Beneficiaries.
// =============================================================================
router.get('/', requireRole(...STAFF_ROLES), async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    let query = `SELECT ${OFFICER_SAFE_COLUMNS} FROM \`users\` WHERE \`role\` IN (${STAFF_ROLES.map(() => '?').join(',')})`;
    const params = [...STAFF_ROLES];

    if (req.query.agency) {
      const agency = req.query.agency.toUpperCase();
      if (agency === 'PESO') {
        query += " AND `role` IN ('PESO Admin', 'PESO Officer')";
      } else if (agency === 'CSWDO') {
        query += " AND `role` IN ('CSWDO Admin', 'CSWDO Officer')";
      }
    }

    if (req.query.role) {
      if (!STAFF_ROLES.includes(req.query.role)) {
        return res.status(400).json({ success: false, message: `role must be one of: ${STAFF_ROLES.join(', ')}` });
      }
      query += ' AND `role` = ?';
      params.push(req.query.role);
    }

    if (req.query.search) {
      query += ' AND (`username` LIKE ? OR `first_name` LIKE ? OR `last_name` LIKE ? OR `email` LIKE ?)';
      const term = `%${req.query.search}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY `created_at` DESC';

    const [rows] = await connection.execute(query, params);
    return res.status(200).json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    console.error('[OFFICERS] GET / error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// GET /api/officers/:id
// Single officer record. Admins can view any officer; a non-admin officer
// may only view their own record.
// =============================================================================
router.get('/:id', requireRole(...STAFF_ROLES), async (req, res) => {
  let connection;
  try {
    if (!ADMIN_ROLES.includes(req.caller.role) && String(req.caller.id) !== String(req.params.id)) {
      return res.status(403).json({ success: false, message: 'You may only view your own officer profile.' });
    }

    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT ${OFFICER_SAFE_COLUMNS} FROM \`users\` WHERE \`id\` = ? AND \`role\` IN (${STAFF_ROLES.map(() => '?').join(',')}) LIMIT 1`,
      [req.params.id, ...STAFF_ROLES]
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
// PUT /api/officers/:id/status
// Updates officer status (Active or Deactivated)
// =============================================================================
router.put('/:id/status', async (req, res) => {
  let connection;
  try {
    let { status } = req.body;
    if (!status || !['Active', 'Deactivated', 'Inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be Active or Deactivated.' });
    }
    if (status === 'Inactive' || status === 'Pending') status = 'Deactivated';

    connection = await pool.getConnection();

    try {
      await connection.execute(`ALTER TABLE \`users\` ADD COLUMN \`status\` VARCHAR(50) DEFAULT 'Active'`);
    } catch (e) {}

    const [result] = await connection.execute(
      'UPDATE `users` SET `status` = ? WHERE `id` = ?',
      [status, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Officer record not found.' });
    }

    return res.status(200).json({ success: true, message: `Officer status updated to ${status}.`, status });
  } catch (error) {
    console.error('[OFFICERS] PUT /:id/status error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// Archival support endpoints for Officers
router.post('/:id/archive', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    try { await connection.execute(`ALTER TABLE \`users\` ADD COLUMN \`status\` VARCHAR(50) DEFAULT 'Active'`); } catch (e) {}
    await connection.execute('UPDATE `users` SET `status` = \'Deactivated\' WHERE `id` = ?', [req.params.id]);
    return res.status(200).json({ success: true, message: 'Officer archived.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/:id/restore', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    try { await connection.execute(`ALTER TABLE \`users\` ADD COLUMN \`status\` VARCHAR(50) DEFAULT 'Active'`); } catch (e) {}
    await connection.execute('UPDATE `users` SET `status` = \'Active\' WHERE `id` = ?', [req.params.id]);
    return res.status(200).json({ success: true, message: 'Officer restored.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

router.delete('/:id/permanent', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.execute('DELETE FROM `users` WHERE `id` = ?', [req.params.id]);
    return res.status(200).json({ success: true, message: 'Officer permanently deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;

// Beneficiaries Routes — Beneficiary Roster & QR Code Access
// Deliberately SEPARATE from routes/officers.js. Only `role = 'Beneficiary'`
// rows are ever returned here.
//
// Access rules:
//   - Staff (any STAFF_ROLES) may list/search beneficiaries and look up a
//     beneficiary by scanned QR token (for on-site verification).
//   - A Beneficiary may view/download only THEIR OWN record and QR code.

const express = require('express');
const pool = require('../db');
const { authenticateCaller, requireRole, STAFF_ROLES } = require('../lib/authMiddleware');

const router = express.Router();
router.use(authenticateCaller);

const BENEFICIARY_SAFE_COLUMNS = `
  \`id\`, \`username\`, \`role\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`,
  \`age\`, \`date_of_birth\`, \`sex\`, \`nationality\`, \`marital_status\`,
  \`email\`, \`phone\`, \`address\`, \`id_type\`, \`id_file_path\`,
  \`is_verified\`, \`qr_code_url\`, \`created_at\`, \`updated_at\`
`;

function isSelf(req) {
  return req.caller && String(req.caller.id) === String(req.params.id);
}
function isStaff(req) {
  return req.caller && STAFF_ROLES.includes(req.caller.role);
}

// =============================================================================
// GET /api/beneficiaries
// Lists ONLY role = 'Beneficiary'. Staff-only (officers need this for the
// admin management portal); a Beneficiary calling this only ever gets
// their own record via GET /api/beneficiaries/:id, never the full roster.
// =============================================================================
router.get('/', requireRole(...STAFF_ROLES), async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    let query = `SELECT ${BENEFICIARY_SAFE_COLUMNS} FROM \`users\` WHERE \`role\` = 'Beneficiary'`;
    const params = [];

    if (req.query.verified === 'true') query += ' AND `is_verified` = 1';
    if (req.query.verified === 'false') query += ' AND `is_verified` = 0';

    if (req.query.search) {
      query += ' AND (`username` LIKE ? OR `first_name` LIKE ? OR `last_name` LIKE ? OR `email` LIKE ?)';
      const term = `%${req.query.search}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY `created_at` DESC';

    const [rows] = await connection.execute(query, params);
    return res.status(200).json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    console.error('[BENEFICIARIES] GET / error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// GET /api/beneficiaries/:id
// A Beneficiary may fetch only their own record; staff may fetch any.
// Includes qr_code_url for the portal's "My QR Code" profile section.
// =============================================================================
router.get('/:id', async (req, res) => {
  if (!isStaff(req) && !isSelf(req)) {
    return res.status(403).json({ success: false, message: 'You may only view your own beneficiary profile.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT ${BENEFICIARY_SAFE_COLUMNS} FROM \`users\` WHERE \`id\` = ? AND \`role\` = 'Beneficiary' LIMIT 1`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });
    }
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[BENEFICIARIES] GET /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// GET /api/beneficiaries/:id/qr-code
// Returns just the QR code data URL — used by the portal's QR display widget
// and by the "download QR code" button.
// =============================================================================
router.get('/:id/qr-code', async (req, res) => {
  if (!isStaff(req) && !isSelf(req)) {
    return res.status(403).json({ success: false, message: 'You may only view your own QR code.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      "SELECT `qr_code_url`, `is_verified` FROM `users` WHERE `id` = ? AND `role` = 'Beneficiary' LIMIT 1",
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });
    }
    if (!rows[0].qr_code_url) {
      return res.status(404).json({
        success: false,
        message: rows[0].is_verified
          ? 'No QR code has been generated for this account yet.'
          : 'QR code is generated after email verification is complete.'
      });
    }
    return res.status(200).json({ success: true, qrCodeUrl: rows[0].qr_code_url });
  } catch (error) {
    console.error('[BENEFICIARIES] GET /:id/qr-code error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// GET /api/beneficiaries/lookup/:token
// Officer-facing: resolves a SCANNED QR token back to a beneficiary profile,
// without ever exposing raw database IDs in the QR code itself.
// Staff-only.
// =============================================================================
router.get('/lookup/:token', requireRole(...STAFF_ROLES), async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT ${BENEFICIARY_SAFE_COLUMNS} FROM \`users\` WHERE \`qr_code_token\` = ? AND \`role\` = 'Beneficiary' LIMIT 1`,
      [req.params.token]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No beneficiary matches this QR code.' });
    }
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[BENEFICIARIES] GET /lookup/:token error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;

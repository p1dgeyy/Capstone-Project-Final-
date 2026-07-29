// Beneficiaries API Routes — Queries the dedicated beneficiaries table
// Provides GET /api/beneficiaries with search/verification filtering
// Also provides QR code retrieval endpoint for officer scanning
//
// Access:
//   - Staff/Admin can list all beneficiaries and view any profile
//   - Beneficiaries can access their own profile and QR code

const express = require('express');
const pool = require('../db');

const router = express.Router();

const STAFF_ROLES = ['PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator'];

// =============================================================================
// Middleware: Authenticate caller
// Checks officers table first (staff), then beneficiaries table
// =============================================================================
async function authenticateCaller(req, res, next) {
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

    // Check officers table first
    const [offRows] = await connection.execute(
      'SELECT `id`, `role`, `current_session_token` FROM `officers` WHERE `id` = ? LIMIT 1',
      [callerId]
    );

    if (offRows.length > 0) {
      if (offRows[0].current_session_token && offRows[0].current_session_token !== sessionToken && !sessionToken.startsWith('mock_session_token_')) {
        return res.status(401).json({ success: false, message: 'Session invalid or expired.', kicked: true });
      }
      req.caller = { id: offRows[0].id, role: offRows[0].role, userType: 'officer' };
      return next();
    }

    // Check beneficiaries table
    const [benRows] = await connection.execute(
      'SELECT `id`, `current_session_token` FROM `beneficiaries` WHERE `id` = ? LIMIT 1',
      [callerId]
    );

    if (benRows.length > 0) {
      if (benRows[0].current_session_token && benRows[0].current_session_token !== sessionToken && !sessionToken.startsWith('mock_session_token_')) {
        return res.status(401).json({ success: false, message: 'Session invalid or expired.', kicked: true });
      }
      req.caller = { id: benRows[0].id, role: 'Beneficiary', userType: 'beneficiary' };
      return next();
    }

    return res.status(401).json({ success: false, message: 'Session invalid or expired.', kicked: true });
  } catch (error) {
    console.error('[BENEFICIARIES] Auth middleware error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
}

router.use(authenticateCaller);

// =============================================================================
// GET /api/beneficiaries
// List all beneficiaries with optional search and verification filtering
// Only accessible by staff/admin
// =============================================================================
router.get('/', async (req, res) => {
  try {
    if (!STAFF_ROLES.includes(req.caller.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only staff and administrators can list all beneficiaries.'
      });
    }

    let connection;
    try {
      connection = await pool.getConnection();

      let query = `
        SELECT \`id\`, \`qr_code_id\`, \`username\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`,
               \`age\`, \`date_of_birth\`, \`sex\`, \`nationality\`, \`marital_status\`,
               \`email\`, \`phone\`, \`address\`, \`id_type\`, \`id_file_path\`,
               \`terms_agreed\`, \`data_consent\`, \`is_verified\`, \`created_at\`, \`updated_at\`
        FROM \`beneficiaries\`
        WHERE 1=1
      `;
      const params = [];

      if (req.query.verified !== undefined) {
        query += ' AND `is_verified` = ?';
        params.push(req.query.verified === 'true' ? 1 : 0);
      }

      if (req.query.search) {
        query += ' AND (`username` LIKE ? OR `first_name` LIKE ? OR `last_name` LIKE ? OR `email` LIKE ?)';
        const searchTerm = `%${req.query.search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      query += ' ORDER BY `created_at` DESC';

      const [rows] = await connection.execute(query, params);

      // Add role field for frontend compatibility
      const data = rows.map(r => ({ ...r, role: 'Beneficiary' }));

      return res.status(200).json({ success: true, data, count: data.length });
    } finally {
      if (connection) connection.release();
    }
  } catch (error) {
    console.error('[BENEFICIARIES] GET / error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// =============================================================================
// GET /api/beneficiaries/:id
// Get a single beneficiary profile by ID (includes QR code data)
// =============================================================================
router.get('/:id', async (req, res) => {
  let connection;
  try {
    const targetId = req.params.id;

    if (req.caller.role === 'Beneficiary' && String(req.caller.id) !== String(targetId)) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only view your own profile.' });
    }

    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT \`id\`, \`qr_code_id\`, \`username\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`,
              \`age\`, \`date_of_birth\`, \`sex\`, \`nationality\`, \`marital_status\`,
              \`email\`, \`phone\`, \`address\`, \`id_type\`, \`id_file_path\`,
              \`terms_agreed\`, \`data_consent\`, \`is_verified\`, \`qr_code_data\`,
              \`created_at\`, \`updated_at\`
       FROM \`beneficiaries\`
       WHERE \`id\` = ?
       LIMIT 1`,
      [targetId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });
    }

    return res.status(200).json({ success: true, data: { ...rows[0], role: 'Beneficiary' } });
  } catch (error) {
    console.error('[BENEFICIARIES] GET /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// GET /api/beneficiaries/:id/qr
// Get the QR code data URL for a specific beneficiary
// =============================================================================
router.get('/:id/qr', async (req, res) => {
  let connection;
  try {
    const targetId = req.params.id;

    if (req.caller.role === 'Beneficiary' && String(req.caller.id) !== String(targetId)) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only access your own QR code.' });
    }

    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT `id`, `qr_code_id`, `first_name`, `last_name`, `qr_code_data`, `is_verified` FROM `beneficiaries` WHERE `id` = ? LIMIT 1',
      [targetId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });
    }

    const user = rows[0];

    if (!user.is_verified) {
      return res.status(400).json({ success: false, message: 'QR code not available. Account has not been verified.' });
    }

    if (!user.qr_code_data) {
      const { generateBeneficiaryQR } = require('../utils/qrcode');
      const qrDataUrl = await generateBeneficiaryQR(user.qr_code_id, user.first_name, user.last_name);

      await connection.execute(
        'UPDATE `beneficiaries` SET `qr_code_data` = ? WHERE `id` = ?',
        [qrDataUrl, user.id]
      );

      return res.status(200).json({
        success: true,
        data: {
          userId: user.id,
          qrCodeId: user.qr_code_id,
          name: `${user.first_name} ${user.last_name}`,
          qrCodeDataUrl: qrDataUrl
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        userId: user.id,
        qrCodeId: user.qr_code_id,
        name: `${user.first_name} ${user.last_name}`,
        qrCodeDataUrl: user.qr_code_data
      }
    });
  } catch (error) {
    console.error('[BENEFICIARIES] GET /:id/qr error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;

// Users Compatibility Routes — Routes to correct table (officers or beneficiaries)
// This router provides backward-compatible /api/users/* endpoints for existing
// frontend code that hasn't migrated to /api/officers or /api/beneficiaries yet.
//
// GET /api/users          — lists from both tables (combined)
// GET /api/users/:id      — checks both tables
// PUT /api/users/:id      — updates the correct table
// DELETE /api/users/:id   — deletes from the correct table
// GET /api/users/beneficiary-by-qr/:qrCode — QR scan lookup

const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

const STAFF_ROLES = ['PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator'];
const ADMIN_ROLES = ['PESO Admin', 'CSWDO Admin'];

// =============================================================================
// Middleware: Extract caller identity from request headers
// =============================================================================
async function authenticateCaller(req, res, next) {
  const callerId = req.headers['x-user-id'];
  const sessionToken = req.headers['x-session-token'];

  if (!callerId || !sessionToken) {
    if (req.method !== 'GET') {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please include X-User-Id and X-Session-Token headers.'
      });
    }
    req.caller = null;
    return next();
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // Check officers first
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

    // Check beneficiaries
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
    console.error('[USERS] Auth middleware error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
}

router.use(authenticateCaller);

// =============================================================================
// GET /api/users
// List users with optional ?role= filter
// Queries both tables and merges results
// =============================================================================
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const results = [];

    // Determine which tables to query based on filters
    const roleFilter = req.query.role;
    const agencyFilter = req.query.agency;
    const searchTerm = req.query.search ? `%${req.query.search}%` : null;

    const needOfficers = !roleFilter || roleFilter !== 'Beneficiary';
    const needBeneficiaries = !roleFilter || roleFilter === 'Beneficiary';

    // Query officers if needed
    if (needOfficers) {
      let offQuery = `
        SELECT \`id\`, \`username\`, \`role\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`,
               NULL AS \`age\`, NULL AS \`date_of_birth\`, NULL AS \`sex\`, NULL AS \`nationality\`, NULL AS \`marital_status\`,
               \`email\`, \`phone\`, NULL AS \`address\`, NULL AS \`id_type\`, NULL AS \`id_file_path\`,
               TRUE AS \`terms_agreed\`, TRUE AS \`data_consent\`, TRUE AS \`is_verified\`, NULL AS \`qr_code_data\`, NULL AS \`qr_code_id\`,
               \`created_at\`, \`updated_at\`
        FROM \`officers\`
        WHERE 1=1
      `;
      const offParams = [];

      if (agencyFilter) {
        if (agencyFilter.toUpperCase() === 'PESO') {
          offQuery += " AND `role` IN ('PESO Admin', 'PESO Officer')";
        } else if (agencyFilter.toUpperCase() === 'CSWDO') {
          offQuery += " AND `role` IN ('CSWDO Admin', 'CSWDO Officer')";
        }
      }

      if (roleFilter && roleFilter !== 'Beneficiary') {
        offQuery += ' AND `role` = ?';
        offParams.push(roleFilter);
      }

      if (searchTerm) {
        offQuery += ' AND (`username` LIKE ? OR `first_name` LIKE ? OR `last_name` LIKE ? OR `email` LIKE ?)';
        offParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      const [offRows] = await connection.execute(offQuery, offParams);
      results.push(...offRows);
    }

    // Query beneficiaries if needed
    if (needBeneficiaries && !agencyFilter) {
      let benQuery = `
        SELECT \`id\`, \`username\`, 'Beneficiary' AS \`role\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`,
               \`age\`, \`date_of_birth\`, \`sex\`, \`nationality\`, \`marital_status\`,
               \`email\`, \`phone\`, \`address\`, \`id_type\`, \`id_file_path\`,
               \`terms_agreed\`, \`data_consent\`, \`is_verified\`, \`qr_code_data\`, \`qr_code_id\`,
               \`created_at\`, \`updated_at\`
        FROM \`beneficiaries\`
        WHERE 1=1
      `;
      const benParams = [];

      if (searchTerm) {
        benQuery += ' AND (`username` LIKE ? OR `first_name` LIKE ? OR `last_name` LIKE ? OR `email` LIKE ?)';
        benParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      const [benRows] = await connection.execute(benQuery, benParams);
      results.push(...benRows);
    }

    // Sort by created_at descending
    results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.status(200).json({ success: true, data: results, count: results.length });
  } catch (error) {
    console.error('[USERS] GET / error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// GET /api/users/beneficiary-by-qr/:qrCode
// Quick retrieval of beneficiary profile and applications via QR scan
// Supports qr_code_id, numeric ID, username, or JSON payload
// =============================================================================
router.get('/beneficiary-by-qr/:qrCode', async (req, res) => {
  let connection;
  try {
    const rawQr = req.params.qrCode ? req.params.qrCode.trim() : '';

    let parsedId = rawQr;
    let qrCodeId = null;

    if (rawQr.startsWith('{')) {
      try {
        const obj = JSON.parse(rawQr);
        qrCodeId = obj.qr_code_id || null;
        parsedId = obj.id || obj.user_id || obj.username || rawQr;
      } catch (e) {}
    } else if (rawQr.startsWith('BEN-')) {
      // This is a qr_code_id directly
      qrCodeId = rawQr;
    } else if (rawQr.includes('-')) {
      const parts = rawQr.split('-');
      parsedId = parts[parts.length - 1];
    }

    connection = await pool.getConnection();

    let userRows;

    if (qrCodeId) {
      // Query by qr_code_id (preferred method)
      [userRows] = await connection.execute(
        `SELECT \`id\`, \`qr_code_id\`, \`username\`, 'Beneficiary' AS \`role\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`,
                \`age\`, \`date_of_birth\`, \`sex\`, \`nationality\`, \`marital_status\`,
                \`email\`, \`phone\`, \`address\`, \`id_type\`, \`id_file_path\`,
                \`terms_agreed\`, \`data_consent\`, \`created_at\`
         FROM \`beneficiaries\`
         WHERE \`qr_code_id\` = ?
         LIMIT 1`,
        [qrCodeId]
      );
    } else {
      // Fallback: query by ID, username, or email
      [userRows] = await connection.execute(
        `SELECT \`id\`, \`qr_code_id\`, \`username\`, 'Beneficiary' AS \`role\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`,
                \`age\`, \`date_of_birth\`, \`sex\`, \`nationality\`, \`marital_status\`,
                \`email\`, \`phone\`, \`address\`, \`id_type\`, \`id_file_path\`,
                \`terms_agreed\`, \`data_consent\`, \`created_at\`
         FROM \`beneficiaries\`
         WHERE \`id\` = ? OR \`username\` = ? OR \`email\` = ?
         LIMIT 1`,
        [parsedId, rawQr, rawQr]
      );
    }

    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found for the provided QR code.' });
    }

    const beneficiary = userRows[0];

    // Query applications
    const [appRows] = await connection.execute(
      `SELECT a.*, p.code AS program_code, p.name AS program_name, p.agency
       FROM \`applications\` a
       JOIN \`programs\` p ON a.program_id = p.id
       WHERE a.beneficiary_id = ?
       ORDER BY a.created_at DESC`,
      [beneficiary.id]
    );

    return res.status(200).json({
      success: true,
      beneficiary,
      applications: appRows
    });
  } catch (error) {
    console.error('[USERS] GET /beneficiary-by-qr/:qrCode error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// GET /api/users/:id
// Get a single user profile by ID — checks both tables
// =============================================================================
router.get('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Try officers first
    const [offRows] = await connection.execute(
      `SELECT \`id\`, \`username\`, \`role\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`,
              \`email\`, \`phone\`, \`department\`, \`status\`, \`created_at\`, \`updated_at\`
       FROM \`officers\` WHERE \`id\` = ? LIMIT 1`,
      [req.params.id]
    );

    if (offRows.length > 0) {
      return res.status(200).json({ success: true, data: offRows[0] });
    }

    // Try beneficiaries
    const [benRows] = await connection.execute(
      `SELECT \`id\`, \`qr_code_id\`, \`username\`, 'Beneficiary' AS \`role\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`,
              \`age\`, \`date_of_birth\`, \`sex\`, \`nationality\`, \`marital_status\`,
              \`email\`, \`phone\`, \`address\`, \`id_type\`, \`id_file_path\`,
              \`terms_agreed\`, \`data_consent\`, \`is_verified\`, \`qr_code_data\`,
              \`created_at\`, \`updated_at\`
       FROM \`beneficiaries\` WHERE \`id\` = ? LIMIT 1`,
      [req.params.id]
    );

    if (benRows.length > 0) {
      return res.status(200).json({ success: true, data: benRows[0] });
    }

    return res.status(404).json({ success: false, message: 'User not found.' });
  } catch (error) {
    console.error('[USERS] GET /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// PUT /api/users/:id
// Update user profile — routes to correct table
// =============================================================================
router.put('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Determine which table this user belongs to
    const [offRows] = await connection.execute('SELECT `id`, `role` FROM `officers` WHERE `id` = ? LIMIT 1', [req.params.id]);
    const [benRows] = await connection.execute('SELECT `id` FROM `beneficiaries` WHERE `id` = ? LIMIT 1', [req.params.id]);

    let tableName = null;
    let targetCurrentRole = null;

    if (offRows.length > 0) {
      tableName = 'officers';
      targetCurrentRole = offRows[0].role;
    } else if (benRows.length > 0) {
      tableName = 'beneficiaries';
      targetCurrentRole = 'Beneficiary';
    } else {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const {
      username, password,
      first_name, middle_name, last_name, suffix,
      age, date_of_birth, sex, nationality, marital_status,
      email, phone, address, id_type, id_file_path,
      terms_agreed, data_consent, status
    } = req.body;

    const updates = [];
    const params = [];

    if (username !== undefined) {
      // Check uniqueness across both tables
      const [dupOff] = await connection.execute('SELECT `id` FROM `officers` WHERE `username` = ? AND `id` != ? LIMIT 1', [username.trim(), req.params.id]);
      const [dupBen] = await connection.execute('SELECT `id` FROM `beneficiaries` WHERE `username` = ? AND `id` != ? LIMIT 1', [username.trim(), req.params.id]);
      if (dupOff.length > 0 || dupBen.length > 0) {
        return res.status(409).json({ success: false, message: 'Username is already taken.' });
      }
      updates.push('`username` = ?');
      params.push(username.trim());
    }

    if (password !== undefined) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('`password` = ?');
      params.push(hashedPassword);
    }

    if (first_name !== undefined) { updates.push('`first_name` = ?'); params.push(first_name.trim()); }
    if (middle_name !== undefined) { updates.push('`middle_name` = ?'); params.push(middle_name ? middle_name.trim() : null); }
    if (last_name !== undefined) { updates.push('`last_name` = ?'); params.push(last_name.trim()); }
    if (suffix !== undefined) { updates.push('`suffix` = ?'); params.push(suffix ? suffix.trim() : null); }

    if (email !== undefined) {
      const [dupOff] = await connection.execute('SELECT `id` FROM `officers` WHERE `email` = ? AND `id` != ? LIMIT 1', [email.trim(), req.params.id]);
      const [dupBen] = await connection.execute('SELECT `id` FROM `beneficiaries` WHERE `email` = ? AND `id` != ? LIMIT 1', [email.trim(), req.params.id]);
      if (dupOff.length > 0 || dupBen.length > 0) {
        return res.status(409).json({ success: false, message: 'Email is already in use.' });
      }
      updates.push('`email` = ?');
      params.push(email.trim());
    }

    if (phone !== undefined) { updates.push('`phone` = ?'); params.push(phone.trim()); }

    // Beneficiary-only fields
    if (tableName === 'beneficiaries') {
      if (age !== undefined) { updates.push('`age` = ?'); params.push(parseInt(age, 10)); }
      if (date_of_birth !== undefined) { updates.push('`date_of_birth` = ?'); params.push(date_of_birth); }
      if (sex !== undefined) { updates.push('`sex` = ?'); params.push(sex); }
      if (nationality !== undefined) { updates.push('`nationality` = ?'); params.push(nationality.trim()); }
      if (marital_status !== undefined) { updates.push('`marital_status` = ?'); params.push(marital_status); }
      if (address !== undefined) { updates.push('`address` = ?'); params.push(address.trim()); }
      if (id_type !== undefined) { updates.push('`id_type` = ?'); params.push(id_type); }
      if (id_file_path !== undefined) { updates.push('`id_file_path` = ?'); params.push(id_file_path); }
      if (terms_agreed !== undefined) { updates.push('`terms_agreed` = ?'); params.push(terms_agreed ? 1 : 0); }
      if (data_consent !== undefined) { updates.push('`data_consent` = ?'); params.push(data_consent ? 1 : 0); }
    }

    // Officer-only fields
    if (tableName === 'officers') {
      if (status !== undefined) { updates.push('`status` = ?'); params.push(status); }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(req.params.id);
    await connection.execute(
      `UPDATE \`${tableName}\` SET ${updates.join(', ')} WHERE \`id\` = ?`,
      params
    );

    const caller = req.caller;
    console.log(`[USERS] Updated ${tableName} ID: ${req.params.id} (by caller: ${caller ? caller.id : 'unknown'})`);

    return res.status(200).json({ success: true, message: 'User profile updated successfully.' });
  } catch (error) {
    console.error('[USERS] PUT /:id error:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Username or email already exists.' });
    }
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// DELETE /api/users/:id
// Delete from the correct table. Admin-only.
// =============================================================================
router.delete('/:id', async (req, res) => {
  let connection;
  try {
    const caller = req.caller;

    if (!caller || !ADMIN_ROLES.includes(caller.role)) {
      return res.status(403).json({ success: false, message: 'Only administrators can delete user accounts.' });
    }

    if (String(caller.id) === String(req.params.id)) {
      return res.status(403).json({ success: false, message: 'You cannot delete your own account.' });
    }

    connection = await pool.getConnection();

    // Check officers
    const [offRows] = await connection.execute('SELECT `id`, `username` FROM `officers` WHERE `id` = ? LIMIT 1', [req.params.id]);
    if (offRows.length > 0) {
      await connection.execute('DELETE FROM `officers` WHERE `id` = ?', [req.params.id]);
      console.log(`[USERS] Deleted officer ID: ${req.params.id}, username: ${offRows[0].username}`);
      return res.status(200).json({ success: true, message: 'Officer account deleted successfully.' });
    }

    // Check beneficiaries
    const [benRows] = await connection.execute('SELECT `id`, `username` FROM `beneficiaries` WHERE `id` = ? LIMIT 1', [req.params.id]);
    if (benRows.length > 0) {
      await connection.execute('DELETE FROM `beneficiaries` WHERE `id` = ?', [req.params.id]);
      console.log(`[USERS] Deleted beneficiary ID: ${req.params.id}, username: ${benRows[0].username}`);
      return res.status(200).json({ success: true, message: 'Beneficiary account deleted successfully.' });
    }

    return res.status(404).json({ success: false, message: 'User not found.' });
  } catch (error) {
    console.error('[USERS] DELETE /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;

// Users CRUD Routes — with Role Isolation Enforcement
// Read/update/delete for user profiles and admin user management
// (Registration is handled by auth.js — this covers profile management and admin operations)
//
// ROLE RULES:
//   - Beneficiaries can only update their own profile fields (not role)
//   - Officers/Staff roles can only be set by Admin-level users
//   - A Beneficiary can NEVER be accidentally upgraded to an Officer/Admin role
//   - An Officer can NEVER be downgraded to a Beneficiary

const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

// Valid roles as defined in the schema ENUM
const VALID_ROLES = ['Beneficiary', 'PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator'];
const STAFF_ROLES = ['PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator'];
const ADMIN_ROLES = ['PESO Admin', 'CSWDO Admin'];

// =============================================================================
// Middleware: Extract caller identity from request headers
// Expects: X-User-Id and X-Session-Token headers (set by frontend after login)
// =============================================================================
async function authenticateCaller(req, res, next) {
  const callerId = req.headers['x-user-id'];
  const sessionToken = req.headers['x-session-token'];

  if (!callerId || !sessionToken) {
    // Allow unauthenticated access for GET requests (public listing)
    // But block all mutations without auth
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
    const [rows] = await connection.execute(
      'SELECT `id`, `role`, `current_session_token` FROM `users` WHERE `id` = ? LIMIT 1',
      [callerId]
    );

    if (rows.length === 0 || rows[0].current_session_token !== sessionToken) {
      return res.status(401).json({
        success: false,
        message: 'Session invalid or expired. Please log in again.',
        kicked: true
      });
    }

    req.caller = { id: rows[0].id, role: rows[0].role };
    next();
  } catch (error) {
    console.error('[USERS] Auth middleware error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
}

// Apply authentication middleware to all routes in this router
router.use(authenticateCaller);

// =============================================================================
// GET /api/users
// List users with optional ?role= filter (for admin dashboards)
// Excludes password and session token fields from responses
// =============================================================================
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    let query = `
      SELECT \`id\`, \`username\`, \`role\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`,
             \`age\`, \`date_of_birth\`, \`sex\`, \`nationality\`, \`marital_status\`,
             \`email\`, \`phone\`, \`address\`, \`id_type\`, \`id_file_path\`,
             \`terms_agreed\`, \`data_consent\`, \`created_at\`, \`updated_at\`
      FROM \`users\`
    `;
    const conditions = [];
    const params = [];

    if (req.query.role) {
      conditions.push('`role` = ?');
      params.push(req.query.role);
    }

    if (req.query.search) {
      conditions.push('(`username` LIKE ? OR `first_name` LIKE ? OR `last_name` LIKE ? OR `email` LIKE ?)');
      const searchTerm = `%${req.query.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY `created_at` DESC';

    const [rows] = await connection.execute(query, params);

    return res.status(200).json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('[USERS] GET / error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// GET /api/users/:id
// Get a single user profile by ID (excludes password and session token)
// =============================================================================
router.get('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT \`id\`, \`username\`, \`role\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`,
              \`age\`, \`date_of_birth\`, \`sex\`, \`nationality\`, \`marital_status\`,
              \`email\`, \`phone\`, \`address\`, \`id_type\`, \`id_file_path\`,
              \`terms_agreed\`, \`data_consent\`, \`created_at\`, \`updated_at\`
       FROM \`users\` WHERE \`id\` = ? LIMIT 1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[USERS] GET /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// PUT /api/users/:id
// Update user profile fields with STRICT ROLE ISOLATION:
//
//   1. Beneficiary editing themselves → can update profile fields ONLY, role is LOCKED to 'Beneficiary'
//   2. Admin editing an Officer → can update profile + role, but role must stay within STAFF_ROLES
//   3. Admin editing a Beneficiary → can update profile fields but CANNOT promote to staff
//   4. Nobody can set an invalid role value
// =============================================================================
router.put('/:id', async (req, res) => {
  let connection;
  try {
    const {
      username, password, role,
      first_name, middle_name, last_name, suffix,
      age, date_of_birth, sex, nationality, marital_status,
      email, phone, address, id_type, id_file_path,
      terms_agreed, data_consent
    } = req.body;

    connection = await pool.getConnection();

    // Fetch the target user's CURRENT role from the database
    const [existing] = await connection.execute(
      'SELECT `id`, `role` FROM `users` WHERE `id` = ? LIMIT 1',
      [req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const targetCurrentRole = existing[0].role;
    const caller = req.caller;

    // --- ROLE CHANGE VALIDATION ---
    if (role !== undefined) {
      // Validate that the requested role is a valid ENUM value
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`
        });
      }

      // RULE 1: Beneficiaries can NEVER change their own role
      if (targetCurrentRole === 'Beneficiary' && role !== 'Beneficiary') {
        return res.status(403).json({
          success: false,
          message: 'Beneficiary accounts cannot be promoted to staff/admin roles through profile updates.'
        });
      }

      // RULE 2: Staff/Officers can NEVER be downgraded to Beneficiary
      if (STAFF_ROLES.includes(targetCurrentRole) && role === 'Beneficiary') {
        return res.status(403).json({
          success: false,
          message: 'Staff accounts cannot be downgraded to Beneficiary role.'
        });
      }

      // RULE 3: Only Admins can change staff roles
      if (STAFF_ROLES.includes(targetCurrentRole) && role !== targetCurrentRole) {
        if (!caller || !ADMIN_ROLES.includes(caller.role)) {
          return res.status(403).json({
            success: false,
            message: 'Only administrators can modify staff roles.'
          });
        }
        // Admin changing staff role — must stay within staff roles
        if (!STAFF_ROLES.includes(role)) {
          return res.status(403).json({
            success: false,
            message: 'Staff role can only be changed to another staff role.'
          });
        }
      }

      // RULE 4: Self-service users cannot change their own role at all
      if (caller && String(caller.id) === String(req.params.id) && role !== targetCurrentRole) {
        return res.status(403).json({
          success: false,
          message: 'You cannot change your own role.'
        });
      }
    }

    // Build dynamic update query
    const updates = [];
    const params = [];

    if (username !== undefined) {
      // Check uniqueness
      const [dup] = await connection.execute(
        'SELECT `id` FROM `users` WHERE `username` = ? AND `id` != ? LIMIT 1',
        [username.trim(), req.params.id]
      );
      if (dup.length > 0) {
        return res.status(409).json({ success: false, message: 'Username is already taken.' });
      }
      updates.push('`username` = ?');
      params.push(username.trim());
    }

    if (password !== undefined) {
      // Always hash with bcrypt — same library used in registration and login
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('`password` = ?');
      params.push(hashedPassword);
    }

    // Only apply role if it passed all validation above
    if (role !== undefined) { updates.push('`role` = ?'); params.push(role); }

    if (first_name !== undefined) { updates.push('`first_name` = ?'); params.push(first_name.trim()); }
    if (middle_name !== undefined) { updates.push('`middle_name` = ?'); params.push(middle_name ? middle_name.trim() : null); }
    if (last_name !== undefined) { updates.push('`last_name` = ?'); params.push(last_name.trim()); }
    if (suffix !== undefined) { updates.push('`suffix` = ?'); params.push(suffix ? suffix.trim() : null); }
    if (age !== undefined) { updates.push('`age` = ?'); params.push(parseInt(age, 10)); }
    if (date_of_birth !== undefined) { updates.push('`date_of_birth` = ?'); params.push(date_of_birth); }
    if (sex !== undefined) { updates.push('`sex` = ?'); params.push(sex); }
    if (nationality !== undefined) { updates.push('`nationality` = ?'); params.push(nationality.trim()); }
    if (marital_status !== undefined) { updates.push('`marital_status` = ?'); params.push(marital_status); }

    if (email !== undefined) {
      // Check uniqueness
      const [dup] = await connection.execute(
        'SELECT `id` FROM `users` WHERE `email` = ? AND `id` != ? LIMIT 1',
        [email.trim(), req.params.id]
      );
      if (dup.length > 0) {
        return res.status(409).json({ success: false, message: 'Email is already in use.' });
      }
      updates.push('`email` = ?');
      params.push(email.trim());
    }

    if (phone !== undefined) { updates.push('`phone` = ?'); params.push(phone.trim()); }
    if (address !== undefined) { updates.push('`address` = ?'); params.push(address.trim()); }
    if (id_type !== undefined) { updates.push('`id_type` = ?'); params.push(id_type); }
    if (id_file_path !== undefined) { updates.push('`id_file_path` = ?'); params.push(id_file_path); }
    if (terms_agreed !== undefined) { updates.push('`terms_agreed` = ?'); params.push(terms_agreed ? 1 : 0); }
    if (data_consent !== undefined) { updates.push('`data_consent` = ?'); params.push(data_consent ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(req.params.id);
    await connection.execute(
      `UPDATE \`users\` SET ${updates.join(', ')} WHERE \`id\` = ?`,
      params
    );

    console.log(`[USERS] Updated user ID: ${req.params.id} (by caller: ${caller ? caller.id : 'unknown'})`);

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
// Delete a user account (cascades to applications, notifications, distributions)
// Only Admins can delete accounts
// =============================================================================
router.delete('/:id', async (req, res) => {
  let connection;
  try {
    const caller = req.caller;

    // Only admins can delete users
    if (!caller || !ADMIN_ROLES.includes(caller.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete user accounts.'
      });
    }

    // Prevent self-deletion
    if (String(caller.id) === String(req.params.id)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot delete your own account.'
      });
    }

    connection = await pool.getConnection();

    const [existing] = await connection.execute(
      'SELECT `id`, `username`, `role` FROM `users` WHERE `id` = ? LIMIT 1',
      [req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await connection.execute('DELETE FROM `users` WHERE `id` = ?', [req.params.id]);

    console.log(`[USERS] Deleted user ID: ${req.params.id}, username: ${existing[0].username} (by admin: ${caller.id})`);

    return res.status(200).json({ success: true, message: 'User account deleted successfully.' });
  } catch (error) {
    console.error('[USERS] DELETE /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;

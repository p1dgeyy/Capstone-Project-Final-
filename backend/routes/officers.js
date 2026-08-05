// Officers Routes — Admin/PESO & CSWDO Staff Management
// Full CRUD capabilities for Officer accounts in the PESO Admin Portal

const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authenticateCaller, requireRole, STAFF_ROLES, ADMIN_ROLES } = require('../lib/authMiddleware');

const router = express.Router();
router.use(authenticateCaller);

// Helper to record DB audit log
async function createAuditLog(connection, userId, action, entityId, details) {
  try {
    await connection.execute(
      'INSERT INTO `audit_logs` (`user_id`, `action`, `entity_type`, `entity_id`, `details`) VALUES (?, ?, ?, ?, ?)',
      [userId || 1, action, 'officer_account', entityId || null, details || '']
    );
  } catch (err) {
    console.warn('[OFFICERS] Audit log notice:', err.message);
  }
}

const OFFICER_SELECT_FIELDS = `
  \`id\`, \`username\`, \`email\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`,
  \`sex\`, \`address\`, \`phone\`, \`role\`, \`department\`, \`status\`, \`created_at\`
`;

// =============================================================================
// GET /api/officers
// Lists officer accounts. Supports search and filters: role, department, status.
// =============================================================================
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Check if `officers` table exists
    const [tables] = await connection.execute(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'officers'`
    );

    let rows = [];
    if (tables[0].cnt > 0) {
      let query = `SELECT ${OFFICER_SELECT_FIELDS} FROM \`officers\` WHERE 1=1`;
      const params = [];

      if (req.query.role && req.query.role !== 'ALL') {
        query += ' AND `role` = ?';
        params.push(req.query.role);
      }

      if (req.query.department && req.query.department !== 'ALL') {
        query += ' AND `department` = ?';
        params.push(req.query.department);
      }

      if (req.query.status && req.query.status !== 'ALL') {
        let st = req.query.status;
        if (st === 'Inactive' || st === 'Pending') st = 'Deactivated';
        query += ' AND `status` = ?';
        params.push(st);
      }

      if (req.query.search) {
        query += ' AND (`username` LIKE ? OR `first_name` LIKE ? OR `last_name` LIKE ? OR `email` LIKE ? OR `phone` LIKE ?)';
        const term = `%${req.query.search}%`;
        params.push(term, term, term, term, term);
      }

      query += ' ORDER BY `id` DESC';
      const [offRows] = await connection.execute(query, params);
      rows = offRows;
    } else {
      // Fallback to users table for staff roles
      let query = `SELECT id, username, email, first_name, middle_name, last_name, suffix, sex, address, phone, role, COALESCE(department, 'PESO') as department, COALESCE(status, 'Active') as status, created_at FROM \`users\` WHERE \`role\` IN (${STAFF_ROLES.map(() => '?').join(',')})`;
      const params = [...STAFF_ROLES];

      if (req.query.role && req.query.role !== 'ALL') {
        query += ' AND `role` = ?';
        params.push(req.query.role);
      }

      if (req.query.search) {
        query += ' AND (`username` LIKE ? OR `first_name` LIKE ? OR `last_name` LIKE ? OR `email` LIKE ?)';
        const term = `%${req.query.search}%`;
        params.push(term, term, term, term);
      }

      query += ' ORDER BY `created_at` DESC';
      const [uRows] = await connection.execute(query, params);
      rows = uRows;
    }

    // Normalize status values (Active / Deactivated)
    rows = rows.map(r => ({
      ...r,
      status: (r.status === 'Deactivated' || r.status === 'Inactive') ? 'Deactivated' : 'Active',
      suffix: r.suffix || 'N/A',
      department: r.department || 'PESO',
      phone: r.phone || 'N/A'
    }));

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
// Single officer profile
// =============================================================================
router.get('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [rows] = await connection.execute(
      `SELECT ${OFFICER_SELECT_FIELDS} FROM \`officers\` WHERE \`id\` = ? LIMIT 1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      const [uRows] = await connection.execute(
        `SELECT id, username, email, first_name, middle_name, last_name, suffix, sex, address, phone, role, COALESCE(department, 'PESO') as department, COALESCE(status, 'Active') as status, created_at FROM \`users\` WHERE \`id\` = ? LIMIT 1`,
        [req.params.id]
      );
      if (uRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Officer account not found.' });
      }
      rows.push(uRows[0]);
    }

    const officer = {
      ...rows[0],
      status: (rows[0].status === 'Deactivated' || rows[0].status === 'Inactive') ? 'Deactivated' : 'Active'
    };

    return res.status(200).json({ success: true, data: officer });
  } catch (error) {
    console.error('[OFFICERS] GET /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/officers
// Create a new Officer account with full structured fields and bcrypt hashing
// =============================================================================
router.post('/', async (req, res) => {
  let connection;
  try {
    const {
      first_name,
      middle_name,
      last_name,
      suffix,
      username,
      password,
      password_confirm,
      email,
      role,
      sex,
      address,
      phone,
      department
    } = req.body;

    // Front-end / Back-end field validations
    const errors = [];
    if (!first_name || !first_name.trim()) errors.push('First Name is required.');
    if (!last_name || !last_name.trim()) errors.push('Last Name is required.');
    if (!username || !username.trim()) errors.push('Username is required.');
    if (!password || password.length < 6) errors.push('Password must be at least 6 characters.');
    if (password !== password_confirm) errors.push('Password and Password Confirmation do not match.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.push('Valid Email Address is required.');
    if (!role) errors.push('Assigned Role is required.');
    if (!department) errors.push('Department is required.');
    if (!sex) errors.push('Gender/Sex is required.');
    if (!address || !address.trim()) errors.push('Address is required.');
    if (!phone || !phone.trim()) errors.push('Contact Number is required.');

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed.', errors });
    }

    connection = await pool.getConnection();

    // Check duplicate username or email
    const [existingUsername] = await connection.execute(
      'SELECT id FROM officers WHERE username = ? UNION SELECT id FROM users WHERE username = ? LIMIT 1',
      [username.trim(), username.trim()]
    );
    if (existingUsername.length > 0) {
      return res.status(409).json({ success: false, message: 'Username is already taken.' });
    }

    const [existingEmail] = await connection.execute(
      'SELECT id FROM officers WHERE email = ? UNION SELECT id FROM users WHERE email = ? LIMIT 1',
      [email.trim(), email.trim()]
    );
    if (existingEmail.length > 0) {
      return res.status(409).json({ success: false, message: 'Email address is already in use.' });
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    const suffixVal = suffix || 'N/A';
    const midVal = middle_name ? middle_name.trim() : '';

    // Insert into `officers` table
    const [result] = await connection.execute(
      `INSERT INTO officers
        (username, password, email, first_name, middle_name, last_name, suffix, sex, address, phone, role, department, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
      [
        username.trim(),
        hashedPassword,
        email.trim(),
        first_name.trim(),
        midVal,
        last_name.trim(),
        suffixVal,
        sex,
        address.trim(),
        phone.trim(),
        role,
        department
      ]
    );

    // Also mirror to `users` table for session/login compatibility
    try {
      await connection.execute(
        `INSERT INTO users
          (username, password, role, first_name, middle_name, last_name, suffix, age, date_of_birth, sex, nationality, marital_status, email, phone, address, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 30, '1995-01-01', ?, 'Filipino', 'Single', ?, ?, ?, 'Active')`,
        [
          username.trim(),
          hashedPassword,
          role,
          first_name.trim(),
          midVal,
          last_name.trim(),
          suffixVal,
          sex === 'Female' ? 'Female' : 'Male',
          email.trim(),
          phone.trim(),
          address.trim()
        ]
      );
    } catch (uErr) {
      console.warn('[OFFICERS] Sync to users table notice:', uErr.message);
    }

    // Log audit event
    const adminId = req.caller ? req.caller.id : 1;
    await createAuditLog(
      connection,
      adminId,
      'CREATE_OFFICER_ACCOUNT',
      result.insertId,
      `Created officer account "${username.trim()}" (${first_name.trim()} ${last_name.trim()}), Role: ${role}, Dept: ${department}`
    );

    return res.status(201).json({
      success: true,
      message: 'Officer account created successfully.',
      data: {
        id: result.insertId,
        username: username.trim(),
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email.trim(),
        role,
        department,
        status: 'Active'
      }
    });

  } catch (error) {
    console.error('[OFFICERS] POST / error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// PUT /api/officers/:id
// Updates officer account profile (contact info, role, username, department, etc.)
// =============================================================================
router.put('/:id', async (req, res) => {
  let connection;
  try {
    const {
      first_name,
      middle_name,
      last_name,
      suffix,
      username,
      email,
      role,
      sex,
      address,
      phone,
      department
    } = req.body;

    const officerId = req.params.id;
    connection = await pool.getConnection();

    // Check if officer exists
    const [existing] = await connection.execute('SELECT id, username FROM officers WHERE id = ?', [officerId]);
    if (existing.length === 0) {
      // Check in users table
      const [uEx] = await connection.execute('SELECT id FROM users WHERE id = ?', [officerId]);
      if (uEx.length === 0) {
        return res.status(404).json({ success: false, message: 'Officer account not found.' });
      }
    }

    const updates = [];
    const params = [];

    if (first_name) { updates.push('`first_name` = ?'); params.push(first_name.trim()); }
    if (middle_name !== undefined) { updates.push('`middle_name` = ?'); params.push(middle_name.trim()); }
    if (last_name) { updates.push('`last_name` = ?'); params.push(last_name.trim()); }
    if (suffix) { updates.push('`suffix` = ?'); params.push(suffix); }
    if (username) { updates.push('`username` = ?'); params.push(username.trim()); }
    if (email) { updates.push('`email` = ?'); params.push(email.trim()); }
    if (role) { updates.push('`role` = ?'); params.push(role); }
    if (sex) { updates.push('`sex` = ?'); params.push(sex); }
    if (address) { updates.push('`address` = ?'); params.push(address.trim()); }
    if (phone) { updates.push('`phone` = ?'); params.push(phone.trim()); }
    if (department) { updates.push('`department` = ?'); params.push(department); }

    if (updates.length > 0) {
      params.push(officerId);
      await connection.execute(`UPDATE officers SET ${updates.join(', ')} WHERE id = ?`, params);
      try {
        await connection.execute(`UPDATE users SET ${updates.filter(u => !u.includes('department')).join(', ')} WHERE id = ?`, params.filter((p, i) => !updates[i]?.includes('department')));
      } catch (uErr) {}
    }

    // Audit Log
    const adminId = req.caller ? req.caller.id : 1;
    await createAuditLog(
      connection,
      adminId,
      'UPDATE_OFFICER_ACCOUNT',
      officerId,
      `Updated officer account details for ID ${officerId} (${username || 'Officer'})`
    );

    return res.status(200).json({ success: true, message: 'Officer account details updated successfully.' });

  } catch (error) {
    console.error('[OFFICERS] PUT /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// PUT /api/officers/:id/status
// Updates officer status (Active or Deactivated) directly from the table toggle
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
    const officerId = req.params.id;

    await connection.execute('UPDATE officers SET status = ? WHERE id = ?', [status, officerId]);
    try {
      await connection.execute('UPDATE users SET status = ? WHERE id = ?', [status, officerId]);
    } catch (e) {}

    // Record audit log
    const adminId = req.caller ? req.caller.id : 1;
    const action = status === 'Active' ? 'ACTIVATE_OFFICER_ACCOUNT' : 'DEACTIVATE_OFFICER_ACCOUNT';
    await createAuditLog(
      connection,
      adminId,
      action,
      officerId,
      `Updated status for officer account ID ${officerId} to ${status}`
    );

    return res.status(200).json({ success: true, message: `Officer status updated to ${status}.`, status });

  } catch (error) {
    console.error('[OFFICERS] PUT /:id/status error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// Archival endpoints
router.post('/:id/archive', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const officerId = req.params.id;

    await connection.execute('UPDATE officers SET status = \'Deactivated\' WHERE id = ?', [officerId]);
    try { await connection.execute('UPDATE users SET status = \'Deactivated\' WHERE id = ?', [officerId]); } catch (e) {}

    const adminId = req.caller ? req.caller.id : 1;
    await createAuditLog(connection, adminId, 'DEACTIVATE_OFFICER_ACCOUNT', officerId, `Deactivated officer account ID ${officerId}`);

    return res.status(200).json({ success: true, message: 'Officer account deactivated and moved to archive.' });
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
    const officerId = req.params.id;

    await connection.execute('UPDATE officers SET status = \'Active\' WHERE id = ?', [officerId]);
    try { await connection.execute('UPDATE users SET status = \'Active\' WHERE id = ?', [officerId]); } catch (e) {}

    const adminId = req.caller ? req.caller.id : 1;
    await createAuditLog(connection, adminId, 'ACTIVATE_OFFICER_ACCOUNT', officerId, `Restored officer account ID ${officerId} to Active status`);

    return res.status(200).json({ success: true, message: 'Officer account restored to active roster.' });
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
    const officerId = req.params.id;

    await connection.execute('DELETE FROM officers WHERE id = ?', [officerId]);
    try { await connection.execute('DELETE FROM users WHERE id = ?', [officerId]); } catch (e) {}

    const adminId = req.caller ? req.caller.id : 1;
    await createAuditLog(connection, adminId, 'PERMANENT_DELETE_OFFICER_ACCOUNT', officerId, `Permanently deleted officer account ID ${officerId}`);

    return res.status(200).json({ success: true, message: 'Officer account permanently deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;

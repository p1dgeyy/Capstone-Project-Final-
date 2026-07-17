// Users CRUD Routes
// Read/update/delete for user profiles and admin user management
// (Registration is handled by auth.js — this covers profile management and admin operations)

const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

// =============================================================================
// GET /api/users
// List users with optional ?role= filter (for admin dashboards)
// Excludes password field from responses
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
// Get a single user profile by ID (excludes password)
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
// Update user profile fields
// Supports updating any combination of profile fields
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

    // Verify user exists
    const [existing] = await connection.execute(
      'SELECT `id` FROM `users` WHERE `id` = ? LIMIT 1',
      [req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
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
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('`password` = ?');
      params.push(hashedPassword);
    }

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

    console.log(`[USERS] Updated user ID: ${req.params.id}`);

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
// =============================================================================
router.delete('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [existing] = await connection.execute(
      'SELECT `id`, `username`, `role` FROM `users` WHERE `id` = ? LIMIT 1',
      [req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await connection.execute('DELETE FROM `users` WHERE `id` = ?', [req.params.id]);

    console.log(`[USERS] Deleted user ID: ${req.params.id}, username: ${existing[0].username}`);

    return res.status(200).json({ success: true, message: 'User account deleted successfully.' });
  } catch (error) {
    console.error('[USERS] DELETE /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;

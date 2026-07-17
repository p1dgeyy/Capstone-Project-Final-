// Programs CRUD Routes
// Full create/read/update/delete for the programs table

const express = require('express');
const pool = require('../db');

const router = express.Router();

// =============================================================================
// GET /api/programs
// List all programs, with optional ?agency=PESO or ?status=Active filters
// =============================================================================
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    let query = 'SELECT * FROM `programs`';
    const conditions = [];
    const params = [];

    if (req.query.agency) {
      conditions.push('`agency` = ?');
      params.push(req.query.agency);
    }

    if (req.query.status) {
      conditions.push('`status` = ?');
      params.push(req.query.status);
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
    console.error('[PROGRAMS] GET / error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// GET /api/programs/:id
// Get a single program by ID
// =============================================================================
router.get('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM `programs` WHERE `id` = ? LIMIT 1',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Program not found.' });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[PROGRAMS] GET /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/programs
// Create a new program
// =============================================================================
router.post('/', async (req, res) => {
  let connection;
  try {
    const { code, name, description, agency, status } = req.body;

    // Validation
    const errors = [];
    if (!code || code.trim().length === 0) errors.push('Program code is required.');
    if (!name || name.trim().length === 0) errors.push('Program name is required.');
    if (!agency || !['PESO', 'CSWDO'].includes(agency)) errors.push('Agency must be PESO or CSWDO.');

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed.', errors });
    }

    connection = await pool.getConnection();

    // Check for duplicate code
    const [existing] = await connection.execute(
      'SELECT `id` FROM `programs` WHERE `code` = ? LIMIT 1',
      [code.trim()]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'A program with this code already exists.' });
    }

    const [result] = await connection.execute(
      `INSERT INTO \`programs\` (\`code\`, \`name\`, \`description\`, \`agency\`, \`status\`)
       VALUES (?, ?, ?, ?, ?)`,
      [
        code.trim(),
        name.trim(),
        description ? description.trim() : null,
        agency,
        status || 'Active'
      ]
    );

    console.log(`[PROGRAMS] Created program ID: ${result.insertId}, code: ${code.trim()}`);

    return res.status(201).json({
      success: true,
      message: 'Program created successfully.',
      programId: result.insertId
    });
  } catch (error) {
    console.error('[PROGRAMS] POST / error:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Duplicate program code.' });
    }
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// PUT /api/programs/:id
// Update an existing program
// =============================================================================
router.put('/:id', async (req, res) => {
  let connection;
  try {
    const { code, name, description, agency, status } = req.body;

    connection = await pool.getConnection();

    // Verify program exists
    const [existing] = await connection.execute(
      'SELECT `id` FROM `programs` WHERE `id` = ? LIMIT 1',
      [req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Program not found.' });
    }

    // Build dynamic update query
    const updates = [];
    const params = [];

    if (code !== undefined) { updates.push('`code` = ?'); params.push(code.trim()); }
    if (name !== undefined) { updates.push('`name` = ?'); params.push(name.trim()); }
    if (description !== undefined) { updates.push('`description` = ?'); params.push(description ? description.trim() : null); }
    if (agency !== undefined) { updates.push('`agency` = ?'); params.push(agency); }
    if (status !== undefined) { updates.push('`status` = ?'); params.push(status); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(req.params.id);
    await connection.execute(
      `UPDATE \`programs\` SET ${updates.join(', ')} WHERE \`id\` = ?`,
      params
    );

    console.log(`[PROGRAMS] Updated program ID: ${req.params.id}`);

    return res.status(200).json({ success: true, message: 'Program updated successfully.' });
  } catch (error) {
    console.error('[PROGRAMS] PUT /:id error:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Duplicate program code.' });
    }
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// DELETE /api/programs/:id
// Delete a program
// =============================================================================
router.delete('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [existing] = await connection.execute(
      'SELECT `id` FROM `programs` WHERE `id` = ? LIMIT 1',
      [req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Program not found.' });
    }

    await connection.execute('DELETE FROM `programs` WHERE `id` = ?', [req.params.id]);

    console.log(`[PROGRAMS] Deleted program ID: ${req.params.id}`);

    return res.status(200).json({ success: true, message: 'Program deleted successfully.' });
  } catch (error) {
    console.error('[PROGRAMS] DELETE /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;

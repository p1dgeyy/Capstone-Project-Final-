// Distributions CRUD Routes
// Full create/read/update/delete for the distributions table

const express = require('express');
const pool = require('../db');

const router = express.Router();

// =============================================================================
// GET /api/distributions
// List distributions with optional filters:
//   ?application_id=1  — filter by application
//   ?status=Pending     — filter by status
// =============================================================================
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    let query = `
      SELECT d.*,
             a.application_number, a.beneficiary_id, a.program_id, a.status AS application_status,
             u.first_name, u.last_name, u.username,
             p.code AS program_code, p.name AS program_name
      FROM \`distributions\` d
      JOIN \`applications\` a ON d.application_id = a.id
      JOIN \`users\` u ON a.beneficiary_id = u.id
      JOIN \`programs\` p ON a.program_id = p.id
    `;
    const conditions = [];
    const params = [];

    if (req.query.application_id) {
      conditions.push('d.`application_id` = ?');
      params.push(req.query.application_id);
    }

    if (req.query.status) {
      conditions.push('d.`status` = ?');
      params.push(req.query.status);
    }

    if (req.query.beneficiary_id) {
      conditions.push('a.`beneficiary_id` = ?');
      params.push(req.query.beneficiary_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY d.`distribution_date` DESC';

    const [rows] = await connection.execute(query, params);

    return res.status(200).json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('[DISTRIBUTIONS] GET / error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// GET /api/distributions/:id
// Get a single distribution by ID
// =============================================================================
router.get('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT d.*,
              a.application_number, a.beneficiary_id, a.program_id,
              u.first_name, u.last_name, u.username,
              p.code AS program_code, p.name AS program_name
       FROM \`distributions\` d
       JOIN \`applications\` a ON d.application_id = a.id
       JOIN \`users\` u ON a.beneficiary_id = u.id
       JOIN \`programs\` p ON a.program_id = p.id
       WHERE d.\`id\` = ? LIMIT 1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Distribution record not found.' });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[DISTRIBUTIONS] GET /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/distributions
// Create a new distribution record
// =============================================================================
router.post('/', async (req, res) => {
  let connection;
  try {
    const { application_id, distribution_date, distribution_time, location, amount, status } = req.body;

    // Validation
    const errors = [];
    if (!application_id) errors.push('Application ID is required.');
    if (!distribution_date) errors.push('Distribution date is required.');
    if (!distribution_time) errors.push('Distribution time is required.');
    if (!location || (typeof location === 'string' && location.trim().length === 0)) errors.push('Location is required.');
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) errors.push('A valid positive amount is required.');

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed.', errors });
    }

    connection = await pool.getConnection();

    // Verify application exists
    const [application] = await connection.execute(
      'SELECT `id` FROM `applications` WHERE `id` = ? LIMIT 1',
      [application_id]
    );
    if (application.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const [result] = await connection.execute(
      `INSERT INTO \`distributions\`
        (\`application_id\`, \`distribution_date\`, \`distribution_time\`, \`location\`, \`amount\`, \`status\`)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        application_id,
        distribution_date,
        distribution_time.trim(),
        location.trim(),
        parseFloat(amount),
        status || 'Pending'
      ]
    );

    console.log(`[DISTRIBUTIONS] Created distribution ID: ${result.insertId} for application: ${application_id}`);

    return res.status(201).json({
      success: true,
      message: 'Distribution record created successfully.',
      distributionId: result.insertId
    });
  } catch (error) {
    console.error('[DISTRIBUTIONS] POST / error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// PUT /api/distributions/:id
// Update a distribution record (e.g., mark as Claimed, update date/location)
// =============================================================================
router.put('/:id', async (req, res) => {
  let connection;
  try {
    const { distribution_date, distribution_time, location, amount, status } = req.body;

    connection = await pool.getConnection();

    // Verify distribution exists
    const [existing] = await connection.execute(
      'SELECT `id` FROM `distributions` WHERE `id` = ? LIMIT 1',
      [req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Distribution record not found.' });
    }

    // Build dynamic update query
    const updates = [];
    const params = [];

    if (distribution_date !== undefined) { updates.push('`distribution_date` = ?'); params.push(distribution_date); }
    if (distribution_time !== undefined) { updates.push('`distribution_time` = ?'); params.push(distribution_time.trim()); }
    if (location !== undefined) { updates.push('`location` = ?'); params.push(location.trim()); }
    if (amount !== undefined) { updates.push('`amount` = ?'); params.push(parseFloat(amount)); }
    if (status !== undefined) { updates.push('`status` = ?'); params.push(status); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(req.params.id);
    await connection.execute(
      `UPDATE \`distributions\` SET ${updates.join(', ')} WHERE \`id\` = ?`,
      params
    );

    console.log(`[DISTRIBUTIONS] Updated distribution ID: ${req.params.id}`);

    return res.status(200).json({ success: true, message: 'Distribution record updated successfully.' });
  } catch (error) {
    console.error('[DISTRIBUTIONS] PUT /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// DELETE /api/distributions/:id
// Delete a distribution record
// =============================================================================
router.delete('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [existing] = await connection.execute(
      'SELECT `id` FROM `distributions` WHERE `id` = ? LIMIT 1',
      [req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Distribution record not found.' });
    }

    await connection.execute('DELETE FROM `distributions` WHERE `id` = ?', [req.params.id]);

    console.log(`[DISTRIBUTIONS] Deleted distribution ID: ${req.params.id}`);

    return res.status(200).json({ success: true, message: 'Distribution record deleted successfully.' });
  } catch (error) {
    console.error('[DISTRIBUTIONS] DELETE /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;

// Applications CRUD Routes
// Full create/read/update/delete for the applications table

const express = require('express');
const pool = require('../db');

const router = express.Router();

// =============================================================================
// GET /api/applications
// List applications with optional filters:
//   ?beneficiary_id=6  — filter by beneficiary
//   ?program_id=2      — filter by program
//   ?status=Pending     — filter by status
// =============================================================================
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    let query = `
      SELECT a.*, 
             u.first_name, u.last_name, u.username, u.email AS beneficiary_email,
             p.code AS program_code, p.name AS program_name, p.agency
      FROM \`applications\` a
      JOIN \`users\` u ON a.beneficiary_id = u.id
      JOIN \`programs\` p ON a.program_id = p.id
    `;
    const conditions = [];
    const params = [];

    if (req.query.beneficiary_id) {
      conditions.push('a.`beneficiary_id` = ?');
      params.push(req.query.beneficiary_id);
    }

    if (req.query.program_id) {
      conditions.push('a.`program_id` = ?');
      params.push(req.query.program_id);
    }

    if (req.query.status) {
      conditions.push('a.`status` = ?');
      params.push(req.query.status);
    }

    if (req.query.agency) {
      conditions.push('p.`agency` = ?');
      params.push(req.query.agency);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY a.`created_at` DESC';

    const [rows] = await connection.execute(query, params);

    return res.status(200).json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('[APPLICATIONS] GET / error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// GET /api/applications/:id
// Get a single application by ID (with joined program and beneficiary info)
// =============================================================================
router.get('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT a.*,
              u.first_name, u.last_name, u.username, u.email AS beneficiary_email,
              u.phone AS beneficiary_phone, u.address AS beneficiary_address,
              p.code AS program_code, p.name AS program_name, p.agency
       FROM \`applications\` a
       JOIN \`users\` u ON a.beneficiary_id = u.id
       JOIN \`programs\` p ON a.program_id = p.id
       WHERE a.\`id\` = ? LIMIT 1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[APPLICATIONS] GET /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/applications
// Submit a new application
// =============================================================================
router.post('/', async (req, res) => {
  let connection;
  try {
    const { beneficiary_id, program_id, remarks } = req.body;

    // Validation
    const errors = [];
    if (!beneficiary_id) errors.push('Beneficiary ID is required.');
    if (!program_id) errors.push('Program ID is required.');

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed.', errors });
    }

    connection = await pool.getConnection();

    // Verify beneficiary exists and has Beneficiary role
    const [beneficiary] = await connection.execute(
      'SELECT `id`, `role` FROM `users` WHERE `id` = ? LIMIT 1',
      [beneficiary_id]
    );
    if (beneficiary.length === 0) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });
    }

    // Verify program exists and is active
    const [program] = await connection.execute(
      'SELECT `id`, `code`, `agency`, `status` FROM `programs` WHERE `id` = ? LIMIT 1',
      [program_id]
    );
    if (program.length === 0) {
      return res.status(404).json({ success: false, message: 'Program not found.' });
    }
    if (program[0].status !== 'Active') {
      return res.status(400).json({ success: false, message: 'This program is currently inactive.' });
    }

    // Generate application number: AGENCY-YEAR-SEQUENCE
    const year = new Date().getFullYear();
    const sequence = String(Math.floor(1000 + Math.random() * 9000));
    const applicationNumber = `${program[0].agency}-${year}-${sequence}`;
    const dateApplied = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const [result] = await connection.execute(
      `INSERT INTO \`applications\`
        (\`application_number\`, \`beneficiary_id\`, \`program_id\`, \`date_applied\`, \`status\`, \`progress_percent\`, \`remarks\`)
       VALUES (?, ?, ?, ?, 'Pending', 0, ?)`,
      [applicationNumber, beneficiary_id, program_id, dateApplied, remarks || null]
    );

    console.log(`[APPLICATIONS] Created application ID: ${result.insertId}, number: ${applicationNumber}`);

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully.',
      applicationId: result.insertId,
      applicationNumber
    });
  } catch (error) {
    console.error('[APPLICATIONS] POST / error:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Duplicate application number. Please try again.' });
    }
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// PUT /api/applications/:id
// Update application status, progress, or remarks
// =============================================================================
router.put('/:id', async (req, res) => {
  let connection;
  try {
    const { status, progress_percent, remarks } = req.body;

    connection = await pool.getConnection();

    // Verify application exists
    const [existing] = await connection.execute(
      'SELECT `id` FROM `applications` WHERE `id` = ? LIMIT 1',
      [req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    // Build dynamic update query
    const updates = [];
    const params = [];

    if (status !== undefined) { updates.push('`status` = ?'); params.push(status); }
    if (progress_percent !== undefined) { updates.push('`progress_percent` = ?'); params.push(parseInt(progress_percent, 10)); }
    if (remarks !== undefined) { updates.push('`remarks` = ?'); params.push(remarks); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(req.params.id);
    await connection.execute(
      `UPDATE \`applications\` SET ${updates.join(', ')} WHERE \`id\` = ?`,
      params
    );

    console.log(`[APPLICATIONS] Updated application ID: ${req.params.id}, status: ${status || '(unchanged)'}`);

    return res.status(200).json({ success: true, message: 'Application updated successfully.' });
  } catch (error) {
    console.error('[APPLICATIONS] PUT /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// DELETE /api/applications/:id
// Delete an application
// =============================================================================
router.delete('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [existing] = await connection.execute(
      'SELECT `id` FROM `applications` WHERE `id` = ? LIMIT 1',
      [req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    await connection.execute('DELETE FROM `applications` WHERE `id` = ?', [req.params.id]);

    console.log(`[APPLICATIONS] Deleted application ID: ${req.params.id}`);

    return res.status(200).json({ success: true, message: 'Application deleted successfully.' });
  } catch (error) {
    console.error('[APPLICATIONS] DELETE /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;

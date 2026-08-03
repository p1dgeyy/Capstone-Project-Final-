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
    const {
      code, name, description, agency, status,
      budget, beneficiaries_count, target_beneficiaries,
      eligibility_criteria, assistance_type, limitations,
      restrictions, ordinance, program_type
    } = req.body;

    // Validation
    const errors = [];
    if (!code || code.trim().length === 0) errors.push('Program code is required.');
    if (!name || name.trim().length === 0) errors.push('Program name is required.');

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed.', errors });
    }

    const progAgency = agency || 'PESO';

    connection = await pool.getConnection();

    // Check for duplicate code
    const [existing] = await connection.execute(
      'SELECT `id` FROM `programs` WHERE `code` = ? LIMIT 1',
      [code.trim()]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'A program with this code already exists.' });
    }

    // Try executing insert with extended fields, fall back to basic if column missing
    try {
      const [result] = await connection.execute(
        `INSERT INTO \`programs\` 
         (\`code\`, \`name\`, \`description\`, \`agency\`, \`status\`, \`budget\`, \`beneficiaries_count\`, \`target_beneficiaries\`, \`eligibility_criteria\`, \`assistance_type\`, \`limitations\`, \`restrictions\`, \`ordinance\`, \`program_type\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          code.trim(),
          name.trim(),
          description ? description.trim() : null,
          progAgency,
          status || 'Active',
          budget || 0,
          beneficiaries_count || 0,
          target_beneficiaries || null,
          eligibility_criteria || null,
          assistance_type || null,
          limitations || null,
          restrictions || null,
          ordinance || 'Appropriation Ordinance No. 6, Series of 2025',
          program_type || 'Livelihood'
        ]
      );
      console.log(`[PROGRAMS] Created program ID: ${result.insertId}, code: ${code.trim()}`);
      return res.status(201).json({
        success: true,
        message: 'Program created successfully.',
        programId: result.insertId
      });
    } catch (insertErr) {
      // Fallback for standard columns if extended columns don't exist yet
      const [result] = await connection.execute(
        `INSERT INTO \`programs\` (\`code\`, \`name\`, \`description\`, \`agency\`, \`status\`)
         VALUES (?, ?, ?, ?, ?)`,
        [code.trim(), name.trim(), description ? description.trim() : null, progAgency, status || 'Active']
      );
      return res.status(201).json({
        success: true,
        message: 'Program created successfully.',
        programId: result.insertId
      });
    }
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
    const {
      code, name, description, agency, status,
      budget, beneficiaries_count, target_beneficiaries,
      eligibility_criteria, assistance_type, limitations,
      restrictions, ordinance, program_type
    } = req.body;

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

    if (budget !== undefined) { updates.push('`budget` = ?'); params.push(budget); }
    if (beneficiaries_count !== undefined) { updates.push('`beneficiaries_count` = ?'); params.push(beneficiaries_count); }
    if (target_beneficiaries !== undefined) { updates.push('`target_beneficiaries` = ?'); params.push(target_beneficiaries); }
    if (eligibility_criteria !== undefined) { updates.push('`eligibility_criteria` = ?'); params.push(eligibility_criteria); }
    if (assistance_type !== undefined) { updates.push('`assistance_type` = ?'); params.push(assistance_type); }
    if (limitations !== undefined) { updates.push('`limitations` = ?'); params.push(limitations); }
    if (restrictions !== undefined) { updates.push('`restrictions` = ?'); params.push(restrictions); }
    if (ordinance !== undefined) { updates.push('`ordinance` = ?'); params.push(ordinance); }
    if (program_type !== undefined) { updates.push('`program_type` = ?'); params.push(program_type); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(req.params.id);

    try {
      await connection.execute(
        `UPDATE \`programs\` SET ${updates.join(', ')} WHERE \`id\` = ?`,
        params
      );
    } catch (uErr) {
      console.warn('[PROGRAMS] PUT /:id partial schema update fallback:', uErr.message);
    }

    console.log(`[PROGRAMS] Updated program ID: ${req.params.id}`);

    return res.status(200).json({ success: true, message: 'Program updated successfully.' });

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

// =============================================================================
// GET /api/programs/:id/active-assignments-check
// Check count of active beneficiaries / applications linked to this program
// =============================================================================
router.get('/:id/active-assignments-check', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT COUNT(*) AS count FROM `applications` WHERE `program_id` = ? AND `status` NOT IN (\'Rejected\', \'Officer Denied\', \'Completed\')',
      [req.params.id]
    );
    const activeCount = rows[0] ? rows[0].count : 0;
    return res.status(200).json({ success: true, activeCount });
  } catch (error) {
    console.error('[PROGRAMS] GET /:id/active-assignments-check error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.', activeCount: 0 });
  } finally {
    if (connection) connection.release();
  }
});

// Archival endpoints
router.post('/:id/archive', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.execute('UPDATE `programs` SET `status` = \'Deactivated\' WHERE `id` = ?', [req.params.id]);
    return res.status(200).json({ success: true, message: 'Program archived/deactivated.' });
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
    await connection.execute('UPDATE `programs` SET `status` = \'Active\' WHERE `id` = ?', [req.params.id]);
    return res.status(200).json({ success: true, message: 'Program restored.' });
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
    await connection.execute('DELETE FROM `programs` WHERE `id` = ?', [req.params.id]);
    return res.status(200).json({ success: true, message: 'Program permanently deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;

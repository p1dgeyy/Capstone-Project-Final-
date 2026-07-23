// Approved Assistance CRUD & Reporting Routes
// REQ082: Record approved assistance type, quantity, conditions, timestamp, officer identity
// REQ083: View & filter approved assistance records for monitoring and reporting

const express = require('express');
const pool = require('../db');

const router = express.Router();

// =============================================================================
// GET /api/assistance
// REQ083: View & filter record of all approved assistance
// Filters: ?program_id=...&beneficiary_id=...&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
// =============================================================================
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    let query = `
      SELECT ast.*,
             u_ben.first_name AS beneficiary_first_name, u_ben.last_name AS beneficiary_last_name, u_ben.email AS beneficiary_email, u_ben.phone AS beneficiary_phone,
             p.code AS program_code, p.name AS program_name,
             u_off.first_name AS officer_first_name, u_off.last_name AS officer_last_name
      FROM \`approved_assistance\` ast
      JOIN \`users\` u_ben ON ast.beneficiary_id = u_ben.id
      JOIN \`programs\` p ON ast.program_id = p.id
      JOIN \`users\` u_off ON ast.officer_id = u_off.id
    `;
    const conditions = [];
    const params = [];

    if (req.query.program_id) {
      conditions.push('ast.`program_id` = ?');
      params.push(req.query.program_id);
    }

    if (req.query.beneficiary_id) {
      conditions.push('ast.`beneficiary_id` = ?');
      params.push(req.query.beneficiary_id);
    }

    if (req.query.date_from) {
      conditions.push('ast.`approval_date` >= ?');
      params.push(req.query.date_from);
    }

    if (req.query.date_to) {
      conditions.push('ast.`approval_date` <= ?');
      params.push(req.query.date_to);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY ast.`approval_date` DESC, ast.`created_at` DESC';

    const [rows] = await connection.execute(query, params);

    return res.status(200).json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('[ASSISTANCE] GET / error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/assistance
// REQ082: Record approved assistance (type, quantity/amount, conditions, date, officer identity)
// =============================================================================
router.post('/', async (req, res) => {
  let connection;
  try {
    const { application_id, beneficiary_id, program_id, assistance_type, quantity_amount, conditions, approval_date, officer_id } = req.body;
    const callerId = req.headers['x-user-id'] || officer_id || 2;

    if (!beneficiary_id || !program_id || !assistance_type || !quantity_amount) {
      return res.status(400).json({
        success: false,
        message: 'Beneficiary ID, Program ID, Assistance Type, and Quantity/Amount are required.'
      });
    }

    connection = await pool.getConnection();

    // Verify beneficiary
    const [bene] = await connection.execute(
      'SELECT `id`, `first_name`, `last_name` FROM `users` WHERE `id` = ? LIMIT 1',
      [beneficiary_id]
    );
    if (bene.length === 0) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });
    }

    // Verify program
    const [prog] = await connection.execute(
      'SELECT `id`, `code`, `name` FROM `programs` WHERE `id` = ? LIMIT 1',
      [program_id]
    );
    if (prog.length === 0) {
      return res.status(404).json({ success: false, message: 'Program not found.' });
    }

    const appDate = approval_date || new Date().toISOString().split('T')[0];

    const [result] = await connection.execute(
      `INSERT INTO \`approved_assistance\`
        (\`application_id\`, \`beneficiary_id\`, \`program_id\`, \`assistance_type\`, \`quantity_amount\`, \`conditions\`, \`approval_date\`, \`officer_id\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [application_id || null, beneficiary_id, program_id, assistance_type, quantity_amount, conditions || null, appDate, callerId]
    );

    // Send notification to beneficiary
    const notifMsg = `Your approved assistance (${assistance_type}: ${quantity_amount}) for ${prog[0].name} has been recorded by PESO Officer.`;
    await connection.execute(
      `INSERT INTO \`notifications\` (\`user_id\`, \`title\`, \`message\`, \`is_read\`) VALUES (?, 'Approved Assistance Recorded', ?, FALSE)`,
      [beneficiary_id, notifMsg]
    );

    // Log to Audit Trail
    const auditDetails = `PESO Officer (ID: ${callerId}) recorded approved assistance ID #${result.insertId} for Beneficiary #${beneficiary_id} (${bene[0].first_name} ${bene[0].last_name}): ${assistance_type} - ${quantity_amount}. Conditions: ${conditions || 'None'}`;
    await connection.execute(
      `INSERT INTO \`audit_logs\` (\`user_id\`, \`action\`, \`entity_type\`, \`entity_id\`, \`details\`) VALUES (?, 'OFFICER_RECORD_ASSISTANCE', 'assistance', ?, ?)`,
      [callerId, result.insertId, auditDetails]
    );

    console.log(`[ASSISTANCE] Recorded assistance ID: ${result.insertId} for Beneficiary: ${beneficiary_id}`);

    return res.status(201).json({
      success: true,
      message: 'Approved assistance record saved successfully.',
      assistanceId: result.insertId
    });
  } catch (error) {
    console.error('[ASSISTANCE] POST / error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;

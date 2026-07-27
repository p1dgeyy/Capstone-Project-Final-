// Approved Assistance API Routes — Records and lists approved assistance grants
// Updated for split tables architecture: beneficiaries and officers

const express = require('express');
const pool = require('../db');

const router = express.Router();

// =============================================================================
// GET /api/assistance
// REQ083: Return list of approved assistance records (optionally filtered by agency, program, beneficiary, date range)
// =============================================================================
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    let query = `
      SELECT ast.*,
             u_ben.username AS beneficiary_username,
             u_ben.first_name AS beneficiary_first_name,
             u_ben.last_name AS beneficiary_last_name,
             u_ben.qr_code_id AS beneficiary_qr_code_id,
             p.code AS program_code,
             p.name AS program_name,
             p.agency AS program_agency,
             u_off.username AS officer_username,
             u_off.first_name AS officer_first_name,
             u_off.last_name AS officer_last_name
      FROM \`approved_assistance\` ast
      JOIN \`beneficiaries\` u_ben ON ast.beneficiary_id = u_ben.id
      JOIN \`programs\` p ON ast.program_id = p.id
      LEFT JOIN \`officers\` u_off ON ast.officer_id = u_off.id
    `;
    const conditions = [];
    const params = [];

    if (req.query.agency) {
      conditions.push('p.`agency` = ?');
      params.push(req.query.agency);
    }

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
    const { application_id, beneficiary_id, program_id, assistance_type, quantity_amount, conditions, approval_date, officer_id, status } = req.body;
    const callerId = req.headers['x-user-id'] || officer_id || 1;

    if (!beneficiary_id || !program_id || !assistance_type || !quantity_amount) {
      return res.status(400).json({
        success: false,
        message: 'Beneficiary ID, Program ID, Assistance Type, and Quantity/Amount are required.'
      });
    }

    connection = await pool.getConnection();

    // Verify beneficiary in beneficiaries table
    const [bene] = await connection.execute(
      'SELECT `id`, `first_name`, `last_name` FROM `beneficiaries` WHERE `id` = ? LIMIT 1',
      [beneficiary_id]
    );
    if (bene.length === 0) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });
    }

    // Verify program
    const [prog] = await connection.execute(
      'SELECT `id`, `code`, `name`, `agency` FROM `programs` WHERE `id` = ? LIMIT 1',
      [program_id]
    );
    if (prog.length === 0) {
      return res.status(404).json({ success: false, message: 'Program not found.' });
    }

    const appDate = approval_date || new Date().toISOString().split('T')[0];
    const initialStatus = status || 'Completed';

    const [result] = await connection.execute(
      `INSERT INTO \`approved_assistance\`
        (\`application_id\`, \`beneficiary_id\`, \`program_id\`, \`assistance_type\`, \`quantity_amount\`, \`conditions\`, \`approval_date\`, \`officer_id\`, \`status\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [application_id || null, beneficiary_id, program_id, assistance_type, quantity_amount, conditions || null, appDate, callerId, initialStatus]
    );

    // Send notification to beneficiary
    const agencyName = prog[0].agency || 'Department';
    const notifMsg = `Your assistance payout grant (${assistance_type}: ${quantity_amount}) for ${prog[0].name} has been processed by ${agencyName}. Status: ${initialStatus}.`;
    await connection.execute(
      `INSERT INTO \`notifications\` (\`user_id\`, \`user_type\`, \`title\`, \`message\`, \`is_read\`) VALUES (?, 'beneficiary', 'Assistance Transaction Update', ?, FALSE)`,
      [beneficiary_id, notifMsg]
    );

    // Log to Audit Trail
    const auditDetails = `Officer/Admin (ID: ${callerId}) recorded assistance grant ID #${result.insertId} for Beneficiary #${beneficiary_id} (${bene[0].first_name} ${bene[0].last_name}): ${assistance_type} - ${quantity_amount}. Status: ${initialStatus}. Conditions: ${conditions || 'None'}`;
    await connection.execute(
      `INSERT INTO \`audit_logs\` (\`user_id\`, \`user_type\`, \`action\`, \`entity_type\`, \`entity_id\`, \`details\`) VALUES (?, 'officer', 'RECORD_ASSISTANCE', 'assistance', ?, ?)`,
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

// =============================================================================
// PUT /api/assistance/:id/status
// Update assistance grant transaction status (e.g. Pending -> Disbursed / Released / Completed)
// =============================================================================
router.put('/:id/status', async (req, res) => {
  let connection;
  try {
    const { status, conditions } = req.body;
    const callerId = req.headers['x-user-id'] || 1;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    connection = await pool.getConnection();

    const [existing] = await connection.execute(
      `SELECT ast.*, p.name AS program_name, u.first_name, u.last_name 
       FROM \`approved_assistance\` ast 
       JOIN \`programs\` p ON ast.program_id = p.id 
       JOIN \`beneficiaries\` u ON ast.beneficiary_id = u.id 
       WHERE ast.\`id\` = ? LIMIT 1`,
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Assistance record not found.' });
    }

    const astRecord = existing[0];

    await connection.execute(
      `UPDATE \`approved_assistance\` SET \`status\` = ?, \`conditions\` = COALESCE(?, \`conditions\`) WHERE \`id\` = ?`,
      [status, conditions || null, req.params.id]
    );

    // Notify Beneficiary
    const notifMsg = `Your assistance payout grant (#${astRecord.id}) status has been updated to '${status}'. Remarks: ${conditions || 'No additional remarks.'}`;
    await connection.execute(
      `INSERT INTO \`notifications\` (\`user_id\`, \`user_type\`, \`title\`, \`message\`, \`is_read\`) VALUES (?, 'beneficiary', 'Assistance Payout Status Update', ?, FALSE)`,
      [astRecord.beneficiary_id, notifMsg]
    );

    // Write Audit Log
    const auditDetails = `User (ID: ${callerId}) updated assistance grant ID #${req.params.id} status to ${status}.`;
    await connection.execute(
      `INSERT INTO \`audit_logs\` (\`user_id\`, \`user_type\`, \`action\`, \`entity_type\`, \`entity_id\`, \`details\`) VALUES (?, 'officer', 'UPDATE_ASSISTANCE_STATUS', 'assistance', ?, ?)`,
      [callerId, req.params.id, auditDetails]
    );

    return res.status(200).json({
      success: true,
      message: `Assistance record status updated to ${status}.`,
      status
    });
  } catch (error) {
    console.error('[ASSISTANCE] PUT /:id/status error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;

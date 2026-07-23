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
             u.first_name, u.last_name, u.username, u.email AS beneficiary_email, u.phone AS beneficiary_phone, u.address AS beneficiary_address,
             p.code AS program_code, p.name AS program_name, p.agency,
             u_off.first_name AS officer_first_name, u_off.last_name AS officer_last_name,
             u_adm.first_name AS admin_first_name, u_adm.last_name AS admin_last_name
      FROM \`applications\` a
      JOIN \`users\` u ON a.beneficiary_id = u.id
      JOIN \`programs\` p ON a.program_id = p.id
      LEFT JOIN \`users\` u_off ON a.officer_id = u_off.id
      LEFT JOIN \`users\` u_adm ON a.admin_id = u_adm.id
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

    if (req.query.officer_decision) {
      conditions.push('a.`officer_decision` = ?');
      params.push(req.query.officer_decision);
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

// =============================================================================
// PUT /api/applications/:id/officer-evaluate
// REQ076, REQ077, REQ078: PESO Officer Evaluation (Approve/Deny for admin review, or Pending Requirements)
// =============================================================================
router.put('/:id/officer-evaluate', async (req, res) => {
  let connection;
  try {
    const { action, notes, officer_id } = req.body;
    const callerId = req.headers['x-user-id'] || officer_id || 2; // Default to PESO Officer (id 2) if not specified

    if (!['approve', 'deny', 'pending'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action. Must be approve, deny, or pending.' });
    }

    if ((action === 'deny' || action === 'pending') && (!notes || !notes.trim())) {
      return res.status(400).json({ success: false, message: 'Notes are mandatory when denying or marking pending requirements.' });
    }

    connection = await pool.getConnection();

    // Check application exists
    const [existing] = await connection.execute(
      `SELECT a.*, p.name AS program_name, u.first_name, u.last_name
       FROM \`applications\` a
       JOIN \`programs\` p ON a.program_id = p.id
       JOIN \`users\` u ON a.beneficiary_id = u.id
       WHERE a.\`id\` = ? LIMIT 1`,
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const app = existing[0];
    let newStatus = 'Under Review';
    let officerDecision = 'None';

    if (action === 'approve') {
      newStatus = 'Officer Approved';
      officerDecision = 'Approved';
    } else if (action === 'deny') {
      newStatus = 'Officer Denied';
      officerDecision = 'Denied';
    } else if (action === 'pending') {
      newStatus = 'Pending Requirements';
      officerDecision = 'Pending Requirements';
    }

    // Update application
    await connection.execute(
      `UPDATE \`applications\` 
       SET \`status\` = ?, \`officer_decision\` = ?, \`officer_notes\` = ?, \`officer_id\` = ?, \`officer_action_at\` = NOW() 
       WHERE \`id\` = ?`,
      [newStatus, officerDecision, notes || null, callerId, req.params.id]
    );

    // Notify Beneficiary automatically
    let notifTitle = 'Application Status Update';
    let notifMsg = `Your application ${app.application_number} for ${app.program_name} has been evaluated by the PESO Officer.`;

    if (action === 'pending') {
      notifTitle = 'Missing Requirements Notification';
      notifMsg = `Your application ${app.application_number} requires additional details/documents: ${notes}`;
    } else if (action === 'approve') {
      notifMsg = `Your application ${app.application_number} was marked as Approved by PESO Officer and forwarded to PESO Admin for final decision.`;
    } else if (action === 'deny') {
      notifMsg = `Your application ${app.application_number} was marked as Denied by PESO Officer for Admin review. Reason: ${notes}`;
    }

    await connection.execute(
      `INSERT INTO \`notifications\` (\`user_id\`, \`title\`, \`message\`, \`is_read\`) VALUES (?, ?, ?, FALSE)`,
      [app.beneficiary_id, notifTitle, notifMsg]
    );

    // Write to Audit Log
    const auditAction = `OFFICER_EVALUATE_${action.toUpperCase()}`;
    const auditDetails = `Officer (ID: ${callerId}) evaluated application ${app.application_number} -> ${newStatus}. Notes: ${notes || 'None'}`;
    await connection.execute(
      `INSERT INTO \`audit_logs\` (\`user_id\`, \`action\`, \`entity_type\`, \`entity_id\`, \`details\`) VALUES (?, ?, 'application', ?, ?)`,
      [callerId, auditAction, req.params.id, auditDetails]
    );

    console.log(`[APPLICATIONS] Officer evaluated App #${req.params.id} -> ${newStatus}`);

    return res.status(200).json({
      success: true,
      message: `Application marked as ${newStatus} for Admin oversight. Beneficiary notified.`,
      status: newStatus,
      officer_decision: officerDecision
    });
  } catch (error) {
    console.error('[APPLICATIONS] PUT /:id/officer-evaluate error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// PUT /api/applications/:id/admin-finalize
// Integration with PESO Admin: Admin final decision (Approve/Reject)
// =============================================================================
router.put('/:id/admin-finalize', async (req, res) => {
  let connection;
  try {
    const { action, notes, admin_id } = req.body;
    const callerId = req.headers['x-user-id'] || admin_id || 1; // Default to PESO Admin (id 1) if not specified

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action. Must be approve or reject.' });
    }

    connection = await pool.getConnection();

    const [existing] = await connection.execute(
      `SELECT a.*, p.name AS program_name 
       FROM \`applications\` a 
       JOIN \`programs\` p ON a.program_id = p.id 
       WHERE a.\`id\` = ? LIMIT 1`,
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const app = existing[0];
    const newStatus = action === 'approve' ? 'Approved' : 'Rejected';
    const progressPercent = action === 'approve' ? 100 : app.progress_percent;

    await connection.execute(
      `UPDATE \`applications\` 
       SET \`status\` = ?, \`admin_notes\` = ?, \`admin_id\` = ?, \`progress_percent\` = ? 
       WHERE \`id\` = ?`,
      [newStatus, notes || null, callerId, progressPercent, req.params.id]
    );

    // Notify Beneficiary
    const notifTitle = action === 'approve' ? 'Application Final Approval' : 'Application Final Decision';
    const notifMsg = `Your application ${app.application_number} for ${app.program_name} has been officially ${newStatus} by PESO Admin. ${notes ? 'Remarks: ' + notes : ''}`;

    await connection.execute(
      `INSERT INTO \`notifications\` (\`user_id\`, \`title\`, \`message\`, \`is_read\`) VALUES (?, ?, ?, FALSE)`,
      [app.beneficiary_id, notifTitle, notifMsg]
    );

    // Write to Audit Log
    const auditAction = `ADMIN_FINALIZE_${action.toUpperCase()}`;
    const auditDetails = `PESO Admin (ID: ${callerId}) finalized application ${app.application_number} -> ${newStatus}. Remarks: ${notes || 'None'}`;
    await connection.execute(
      `INSERT INTO \`audit_logs\` (\`user_id\`, \`action\`, \`entity_type\`, \`entity_id\`, \`details\`) VALUES (?, ?, 'application', ?, ?)`,
      [callerId, auditAction, req.params.id, auditDetails]
    );

    console.log(`[APPLICATIONS] Admin finalized App #${req.params.id} -> ${newStatus}`);

    return res.status(200).json({
      success: true,
      message: `Application status finalized as ${newStatus}.`,
      status: newStatus
    });
  } catch (error) {
    console.error('[APPLICATIONS] PUT /:id/admin-finalize error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/applications/record
// REQ079: PESO Officer records a new application on behalf of a beneficiary
// =============================================================================
router.post('/record', async (req, res) => {
  let connection;
  try {
    const { beneficiary_id, program_id, remarks, documents_json, officer_id } = req.body;
    const callerId = req.headers['x-user-id'] || officer_id || 2;

    if (!beneficiary_id || !program_id) {
      return res.status(400).json({ success: false, message: 'Beneficiary ID and Program ID are required.' });
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
      'SELECT `id`, `code`, `name`, `agency` FROM `programs` WHERE `id` = ? LIMIT 1',
      [program_id]
    );
    if (prog.length === 0) {
      return res.status(404).json({ success: false, message: 'Program not found.' });
    }

    // Generate application number: AGENCY-YEAR-SEQUENCE
    const year = new Date().getFullYear();
    const sequence = String(Math.floor(1000 + Math.random() * 9000));
    const applicationNumber = `${prog[0].agency}-${year}-${sequence}`;
    const dateApplied = new Date().toISOString().split('T')[0];

    const docsString = typeof documents_json === 'object' ? JSON.stringify(documents_json) : (documents_json || null);

    const [result] = await connection.execute(
      `INSERT INTO \`applications\`
        (\`application_number\`, \`beneficiary_id\`, \`program_id\`, \`date_applied\`, \`status\`, \`progress_percent\`, \`remarks\`, \`officer_id\`, \`documents_json\`)
       VALUES (?, ?, ?, ?, 'Submitted', 10, ?, ?, ?)`,
      [applicationNumber, beneficiary_id, program_id, dateApplied, remarks || null, callerId, docsString]
    );

    // Notify beneficiary
    await connection.execute(
      `INSERT INTO \`notifications\` (\`user_id\`, \`title\`, \`message\`, \`is_read\`) VALUES (?, ?, ?, FALSE)`,
      [beneficiary_id, 'New Application Recorded', `Your application ${applicationNumber} for ${prog[0].name} has been recorded by PESO Officer.`]
    );

    // Write audit log
    const auditDetails = `PESO Officer (ID: ${callerId}) recorded new application ${applicationNumber} for Beneficiary #${beneficiary_id} (${bene[0].first_name} ${bene[0].last_name}).`;
    await connection.execute(
      `INSERT INTO \`audit_logs\` (\`user_id\`, \`action\`, \`entity_type\`, \`entity_id\`, \`details\`) VALUES (?, 'OFFICER_RECORD_APPLICATION', 'application', ?, ?)`,
      [callerId, result.insertId, auditDetails]
    );

    console.log(`[APPLICATIONS] Officer recorded application ID: ${result.insertId}, number: ${applicationNumber}`);

    return res.status(201).json({
      success: true,
      message: 'New application recorded successfully.',
      applicationId: result.insertId,
      applicationNumber
    });
  } catch (error) {
    console.error('[APPLICATIONS] POST /record error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// PUT /api/applications/:id/status
// REQ080: Update application lifecycle status (e.g., 'Completed', 'Approved', etc.)
// =============================================================================
router.put('/:id/status', async (req, res) => {
  let connection;
  try {
    const { status, remarks, officer_id } = req.body;
    const callerId = req.headers['x-user-id'] || officer_id || 2;

    const validStatuses = ['Submitted', 'Pending', 'Pending Requirements', 'Under Review', 'Interview Scheduled', 'Training Scheduled', 'Officer Approved', 'Officer Denied', 'Approved', 'Rejected', 'Completed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing status.' });
    }

    connection = await pool.getConnection();

    const [existing] = await connection.execute(
      `SELECT a.*, p.name AS program_name FROM \`applications\` a JOIN \`programs\` p ON a.program_id = p.id WHERE a.\`id\` = ? LIMIT 1`,
      [req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const app = existing[0];
    const progressPercent = status === 'Completed' ? 100 : (status === 'Approved' ? 90 : app.progress_percent);

    await connection.execute(
      `UPDATE \`applications\` SET \`status\` = ?, \`progress_percent\` = ?, \`remarks\` = COALESCE(?, \`remarks\`) WHERE \`id\` = ?`,
      [status, progressPercent, remarks || null, req.params.id]
    );

    // Notify beneficiary
    await connection.execute(
      `INSERT INTO \`notifications\` (\`user_id\`, \`title\`, \`message\`, \`is_read\`) VALUES (?, ?, ?, FALSE)`,
      [app.beneficiary_id, 'Application Lifecycle Update', `Your application ${app.application_number} status updated to ${status}.`]
    );

    // Log audit
    const auditDetails = `User (ID: ${callerId}) updated application ${app.application_number} status to ${status}.`;
    await connection.execute(
      `INSERT INTO \`audit_logs\` (\`user_id\`, \`action\`, \`entity_type\`, \`entity_id\`, \`details\`) VALUES (?, 'APPLICATION_STATUS_UPDATE', 'application', ?, ?)`,
      [callerId, req.params.id, auditDetails]
    );

    console.log(`[APPLICATIONS] Updated status of App #${req.params.id} -> ${status}`);

    return res.status(200).json({
      success: true,
      message: `Application status updated to ${status}.`,
      status
    });
  } catch (error) {
    console.error('[APPLICATIONS] PUT /:id/status error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;


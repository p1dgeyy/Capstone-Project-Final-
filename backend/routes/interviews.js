const express = require('express');
const router = express.Router();
const pool = require('../db');

// =============================================================================
// REQ084, REQ085, REQ086, REQ087, REQ088: INTERVIEW SCHEDULES & ATTENDANCE API
// =============================================================================

/**
 * GET /api/interviews
 * Fetches interview schedules joined with beneficiary, program, application, and officer.
 * Supports query params: agency, date, program_id, officer_id, beneficiary_id, status, attendance_status
 */
router.get('/', async (req, res) => {
  try {
    const { agency, date, program_id, officer_id, beneficiary_id, status, attendance_status } = req.query;

    let query = `
      SELECT 
        i.id,
        i.application_id,
        i.beneficiary_id,
        i.program_id,
        i.officer_id,
        i.interview_date,
        i.interview_time,
        i.venue_location,
        i.status,
        i.attendance_status,
        i.remarks,
        i.created_at,
        i.updated_at,
        u_ben.first_name AS beneficiary_first_name,
        u_ben.last_name AS beneficiary_last_name,
        u_ben.email AS beneficiary_email,
        u_ben.phone AS beneficiary_phone,
        u_ben.address AS beneficiary_address,
        p.name AS program_name,
        p.code AS program_code,
        p.agency AS program_agency,
        app.application_number,
        app.status AS application_status,
        u_off.first_name AS officer_first_name,
        u_off.last_name AS officer_last_name
      FROM interview_schedules i
      JOIN users u_ben ON i.beneficiary_id = u_ben.id
      JOIN programs p ON i.program_id = p.id
      LEFT JOIN applications app ON i.application_id = app.id
      LEFT JOIN users u_off ON i.officer_id = u_off.id
      WHERE 1=1
    `;

    const params = [];

    if (agency) {
      query += ` AND p.agency = ?`;
      params.push(agency);
    }
    if (date) {
      query += ` AND i.interview_date = ?`;
      params.push(date);
    }
    if (program_id) {
      query += ` AND i.program_id = ?`;
      params.push(program_id);
    }
    if (officer_id) {
      query += ` AND i.officer_id = ?`;
      params.push(officer_id);
    }
    if (beneficiary_id) {
      query += ` AND i.beneficiary_id = ?`;
      params.push(beneficiary_id);
    }
    if (status) {
      query += ` AND i.status = ?`;
      params.push(status);
    }
    if (attendance_status) {
      query += ` AND i.attendance_status = ?`;
      params.push(attendance_status);
    }

    query += ` ORDER BY i.interview_date ASC, i.interview_time ASC`;

    const [rows] = await pool.query(query, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Error fetching interview schedules:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve interview schedules', error: error.message });
  }
});

/**
 * POST /api/interviews
 * PESO Officer schedules a new interview (REQ084)
 */
router.post('/', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      application_id,
      beneficiary_id,
      program_id,
      interview_date,
      interview_time,
      venue_location,
      remarks,
      officer_id
    } = req.body;

    const actingOfficerId = officer_id || req.headers['x-user-id'] || 2;

    if (!beneficiary_id || !program_id || !interview_date || !interview_time) {
      return res.status(400).json({
        success: false,
        message: 'beneficiary_id, program_id, interview_date, and interview_time are required'
      });
    }

    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO interview_schedules 
        (application_id, beneficiary_id, program_id, officer_id, interview_date, interview_time, venue_location, status, attendance_status, remarks) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Scheduled', 'Unmarked', ?)`,
      [
        application_id || null,
        beneficiary_id,
        program_id,
        actingOfficerId,
        interview_date,
        interview_time,
        venue_location || 'PESO Main Office - Interview Room A',
        remarks || null
      ]
    );

    const scheduleId = result.insertId;

    // Optional: update application status if linked
    if (application_id) {
      await connection.query(
        `UPDATE applications SET status = 'Interview Scheduled' WHERE id = ?`,
        [application_id]
      );
    }

    // Insert Notification for Beneficiary
    await connection.query(
      `INSERT INTO notifications (user_id, title, message, type, is_read) 
       VALUES (?, 'Interview Scheduled', ?, 'info', 0)`,
      [
        beneficiary_id,
        `Your interview for the Livelihood Program is scheduled on ${interview_date} at ${interview_time}. Venue: ${venue_location || 'PESO Main Office'}.`
      ]
    );

    // Audit log entry
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'OFFICER_SCHEDULE_INTERVIEW', 'interview_schedules', ?, ?)`,
      [
        actingOfficerId,
        scheduleId,
        `PESO Officer scheduled interview #${scheduleId} for beneficiary ID #${beneficiary_id} on ${interview_date} ${interview_time}.`
      ]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Interview schedule created successfully',
      scheduleId: scheduleId
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error creating interview schedule:', error);
    res.status(500).json({ success: false, message: 'Failed to create interview schedule', error: error.message });
  } finally {
    connection.release();
  }
});

/**
 * PUT /api/interviews/:id/attendance
 * Updates attendance status (Present / Absent) (REQ086, REQ087)
 */
router.put('/:id/attendance', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const scheduleId = req.params.id;
    const { attendance_status, remarks, officer_id } = req.body;
    const actingOfficerId = officer_id || req.headers['x-user-id'] || 2;

    if (!['Present', 'Absent', 'Unmarked'].includes(attendance_status)) {
      return res.status(400).json({ success: false, message: 'Invalid attendance_status value. Must be Present, Absent, or Unmarked.' });
    }

    await connection.beginTransaction();

    // Check existing
    const [existing] = await connection.query(`SELECT * FROM interview_schedules WHERE id = ?`, [scheduleId]);
    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Interview schedule not found' });
    }

    const current = existing[0];

    // Auto-update schedule status if marked Present -> Completed or Absent -> Pending/Missed
    let newStatus = current.status;
    if (attendance_status === 'Present') {
      newStatus = 'Completed';
    } else if (attendance_status === 'Absent') {
      newStatus = 'Missed';
    }

    await connection.query(
      `UPDATE interview_schedules 
       SET attendance_status = ?, status = ?, remarks = COALESCE(?, remarks), updated_at = NOW() 
       WHERE id = ?`,
      [attendance_status, newStatus, remarks || null, scheduleId]
    );

    // Notify Beneficiary
    await connection.query(
      `INSERT INTO notifications (user_id, title, message, type, is_read) 
       VALUES (?, 'Interview Attendance Updated', ?, 'info', 0)`,
      [
        current.beneficiary_id,
        `Your attendance for interview #${scheduleId} on ${current.interview_date} was recorded as: ${attendance_status.toUpperCase()}.`
      ]
    );

    // Log to Audit Trail
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'OFFICER_UPDATE_ATTENDANCE', 'interview_schedules', ?, ?)`,
      [
        actingOfficerId,
        scheduleId,
        `Officer marked attendance as ${attendance_status} for interview #${scheduleId} (Beneficiary ID: #${current.beneficiary_id}).`
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: `Attendance marked as ${attendance_status}`,
      scheduleId: scheduleId,
      attendance_status: attendance_status,
      status: newStatus
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error updating attendance:', error);
    res.status(500).json({ success: false, message: 'Failed to update attendance', error: error.message });
  } finally {
    connection.release();
  }
});

/**
 * PUT /api/interviews/:id/status
 * Updates interview status (Completed, Pending, Missed, Cancelled) (REQ088)
 */
router.put('/:id/status', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const scheduleId = req.params.id;
    const { status, remarks, officer_id } = req.body;
    const actingOfficerId = officer_id || req.headers['x-user-id'] || 2;

    const validStatuses = ['Scheduled', 'Pending', 'Completed', 'Missed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    await connection.beginTransaction();

    const [existing] = await connection.query(`SELECT * FROM interview_schedules WHERE id = ?`, [scheduleId]);
    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Interview schedule not found' });
    }

    const current = existing[0];

    await connection.query(
      `UPDATE interview_schedules 
       SET status = ?, remarks = COALESCE(?, remarks), updated_at = NOW() 
       WHERE id = ?`,
      [status, remarks || null, scheduleId]
    );

    // Log Audit Event
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'OFFICER_UPDATE_INTERVIEW_STATUS', 'interview_schedules', ?, ?)`,
      [
        actingOfficerId,
        scheduleId,
        `Officer updated interview #${scheduleId} status from '${current.status}' to '${status}'. Remarks: ${remarks || 'None'}`
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: `Interview status updated to ${status}`,
      scheduleId: scheduleId,
      status: status
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error updating interview status:', error);
    res.status(500).json({ success: false, message: 'Failed to update interview status', error: error.message });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/interviews/:id/cancel
 * Cancels schedule with mandatory cancellation reason logged into audit_logs (REQ088)
 */
router.post('/:id/cancel', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const scheduleId = req.params.id;
    const { reason, officer_id } = req.body;
    const actingOfficerId = officer_id || req.headers['x-user-id'] || 1;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Cancellation reason is mandatory.' });
    }

    await connection.beginTransaction();

    const [existing] = await connection.query(`SELECT * FROM interview_schedules WHERE id = ?`, [scheduleId]);
    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Interview schedule not found' });
    }

    const current = existing[0];

    // Update status to Cancelled
    await connection.query(
      `UPDATE interview_schedules SET status = 'Cancelled', remarks = ?, updated_at = NOW() WHERE id = ?`,
      [reason.trim(), scheduleId]
    );

    // Audit Log Entry for cancellation
    const auditDetails = `Cancelled Schedule #${scheduleId} (${current.interview_date} ${current.interview_time}). Reason: ${reason.trim()}`;
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'OFFICER_CANCEL_SCHEDULE', 'schedule_cancellations', ?, ?)`,
      [actingOfficerId, scheduleId, auditDetails]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Schedule cancelled and logged to audit trail successfully.',
      scheduleId: scheduleId,
      reason: reason.trim()
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error cancelling schedule:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel schedule', error: error.message });
  } finally {
    connection.release();
  }
});

// Archival support endpoints for schedules
router.post('/:id/archive', async (req, res) => {
  try {
    await pool.query('UPDATE interview_schedules SET status = \'Cancelled\' WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Schedule archived.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/restore', async (req, res) => {
  try {
    await pool.query('UPDATE interview_schedules SET status = \'Scheduled\' WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Schedule restored.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id/permanent', async (req, res) => {
  try {
    await pool.query('DELETE FROM interview_schedules WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Schedule permanently deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/interviews/attendance or /api/schedules/attendance
 * Records interview attendance (Present/Absent) and interview outcome (Completed/Pending/Missed)
 */
router.post('/attendance', async (req, res) => {
  let connection;
  try {
    const { scheduleId, beneficiaryId, attendance, outcome, remarks } = req.body;
    if (!scheduleId || !attendance) {
      return res.status(400).json({ success: false, message: 'Schedule ID and attendance status are required.' });
    }

    connection = await pool.getConnection();
    const finalOutcome = outcome || (attendance === 'Present' ? 'Completed' : 'Missed');

    await connection.execute(
      `UPDATE interview_schedules SET status = ?, remarks = ?, updated_at = NOW() WHERE id = ?`,
      [finalOutcome, remarks || `Attendance: ${attendance}`, scheduleId]
    );

    return res.status(200).json({
      success: true,
      message: `Interview attendance marked as ${attendance} (${finalOutcome}).`,
      data: { scheduleId, attendance, outcome: finalOutcome, remarks }
    });
  } catch (error) {
    console.error('[INTERVIEWS] POST /attendance error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;

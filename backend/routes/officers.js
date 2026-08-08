/**
 * Backend PESO Officer & Daily Interview Schedule Router & Controller
 * City Government of Koronadal — PESO & CSWDO Portal
 * 
 * Endpoints:
 * - GET  /api/officer/:id/schedule      -> Fetch assigned daily interviews for an officer
 * - GET  /api/interview/:id             -> Fetch detailed interview record with beneficiary & program
 * - PUT  /api/interview/:id/attendance  -> Mark interview attendance (Present / Absent)
 * - PUT  /api/interview/:id/status      -> Update interview status (Completed, Pending, Missed)
 * - POST /api/interview/schedule        -> Schedule new interview with conflict validation
 * - GET  /api/interview/check-conflicts -> Validate date/time for overlapping schedules
 * 
 * Restrictions & Safeguards:
 * 1. Past Date Restriction: Cannot update past interview without explicit audit justification.
 * 2. Conflict Restriction: Prevents overlapping interview time slots for the same officer.
 * 3. Audit Restriction: All updates trigger immutable audit logging with officer credentials.
 * 4. Data Privacy Restriction: Beneficiary contact numbers are masked (09XX-***-XXXX).
 * 5. Read-only Details: Beneficiary profile details are view-only.
 */

const express = require('express');
const router = express.Router();
const { 
    getInterviews, 
    findInterviewById, 
    getInterviewsByOfficer, 
    updateInterviewAttendance, 
    updateInterviewStatus, 
    checkOfficerScheduleConflict, 
    addInterview,
    getAttendanceRecords 
} = require('../data/seedData');
const { requireAuth, requireStaff, maskContactNumber } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');

/**
 * Helper to get today's date string (YYYY-MM-DD)
 */
function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Format interview record for output with data privacy masking
 */
function formatInterviewOutput(i) {
    return {
        id: i.id,
        interview_id: i.interview_id,
        officer_id: i.officer_id,
        officer_name: i.officer_name,
        beneficiary_id: i.beneficiary_id,
        beneficiary_name: i.beneficiary_name,
        beneficiary_phone: maskContactNumber(i.beneficiary_phone),
        beneficiary_email: i.beneficiary_email,
        beneficiary_address: i.beneficiary_address,
        barangay: i.barangay,
        sex: i.sex,
        age: i.age,
        documents_verified: i.documents_verified,
        program_id: i.program_id,
        program_code: i.program_code,
        program_name: i.program_name,
        project_type: i.project_type,
        application_id: i.application_id,
        date_applied: i.date_applied,
        interview_date: i.interview_date,
        schedule_time: i.schedule_time,
        time_slot: i.time_slot,
        venue_location: i.venue_location,
        status: i.status, // 'Pending', 'Completed', 'Missed', 'Scheduled', 'Cancelled'
        attendance_status: i.attendance_status || i.presence_flag || 'Unmarked', // 'Unmarked', 'Present', 'Absent'
        presence_flag: i.presence_flag || i.attendance_status || 'Unmarked',
        remarks: i.remarks || '',
        justification: i.justification || null,
        is_past_date: i.interview_date < getTodayString(),
        created_at: i.created_at,
        updated_at: i.updated_at
    };
}

/**
 * GET /api/officer/:id/schedule
 * Fetch assigned interviews for an officer with optional date, status, search filters
 */
router.get('/officer/:id/schedule', (req, res) => {
    const officerId = req.params.id;
    const { date, status, search } = req.query;

    const list = getInterviewsByOfficer(officerId, { date, status, search });
    const formatted = list.map(formatInterviewOutput);

    res.json({
        success: true,
        count: formatted.length,
        officer_id: officerId,
        date_filter: date || 'ALL',
        data: formatted
    });
});

/**
 * GET /api/interview/check-conflicts
 * Conflict Validation Restriction: Checks if an officer has an overlapping schedule
 */
router.get('/interview/check-conflicts', (req, res) => {
    const { officer_id, date, schedule_time, time, exclude_id } = req.query;
    const timeToCheck = schedule_time || time;

    if (!officer_id || !date || !timeToCheck) {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: 'officer_id, date (YYYY-MM-DD), and schedule_time are required.'
        });
    }

    const conflict = checkOfficerScheduleConflict(officer_id, date, timeToCheck, exclude_id);

    if (conflict) {
        return res.json({
            success: true,
            conflict: true,
            hasConflict: true,
            message: `Conflict detected: Officer is already scheduled with "${conflict.beneficiary_name}" at ${conflict.schedule_time} on ${conflict.interview_date}.`,
            existingSchedule: formatInterviewOutput(conflict),
            conflictInterview: formatInterviewOutput(conflict)
        });
    }

    res.json({
        success: true,
        conflict: false,
        hasConflict: false,
        message: 'No scheduling conflicts found. Time slot is available.'
    });
});

/**
 * GET /api/interview/:id
 * Fetch single interview details with beneficiary & applied program details
 */
router.get('/interview/:id', (req, res) => {
    const interview = findInterviewById(req.params.id);
    if (!interview) {
        return res.status(404).json({
            success: false,
            error: 'Interview Not Found',
            message: `Interview with identifier "${req.params.id}" does not exist.`
        });
    }

    const attendanceHistory = getAttendanceRecords({ interview_id: interview.interview_id });

    res.json({
        success: true,
        data: {
            ...formatInterviewOutput(interview),
            attendance_history: attendanceHistory
        }
    });
});

/**
 * PUT /api/interview/:id/attendance
 * Mark beneficiary attendance as Present or Absent with remarks and past-date justification
 */
router.put('/interview/:id/attendance', (req, res) => {
    const interview = findInterviewById(req.params.id);
    if (!interview) {
        return res.status(404).json({
            success: false,
            error: 'Interview Not Found',
            message: `Interview "${req.params.id}" does not exist.`
        });
    }

    const { presence_flag, attendance, remarks, justification } = req.body;
    const flag = (presence_flag || attendance || '').trim();

    if (!flag || !['Present', 'Absent', 'Unmarked'].includes(flag)) {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: 'Presence flag must be either "Present", "Absent", or "Unmarked".'
        });
    }

    const today = getTodayString();
    const isPastDate = interview.interview_date < today;

    // Past Date Restriction: If interview is scheduled in the past, require explicit audit justification
    if (isPastDate && (!justification || !justification.trim())) {
        return res.status(400).json({
            success: false,
            error: 'Past Date Restriction',
            message: 'Past Date Restriction: Officers cannot mark attendance for past-dated interviews without explicit audit justification.'
        });
    }

    const officerUser = req.user?.username || interview.officer_name || 'PESO Officer';
    const officerRole = req.user?.role || 'PESO Officer';
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const reasonText = justification || remarks || 'Routine daily interview attendance monitoring';

    const result = updateInterviewAttendance(
        interview.id, 
        flag, 
        remarks || interview.remarks, 
        justification || null
    );

    // If attendance is marked Present and status is Pending, optionally advance or keep updated
    if (flag === 'Present' && interview.status === 'Missed') {
        interview.status = 'Completed';
    } else if (flag === 'Absent' && interview.status === 'Completed') {
        interview.status = 'Missed';
    }

    // Immutable Audit Trail
    logAudit({
        userId: officerUser,
        userRole: officerRole,
        actionType: 'MARK_ATTENDANCE',
        targetEntity: 'Interview Schedule',
        targetId: interview.interview_id,
        status: 'SUCCESS',
        actionReason: reasonText,
        details: `Officer "${officerUser}" marked attendance for interview "${interview.interview_id}" (${interview.beneficiary_name}) as "${flag}". Remarks: "${remarks || 'None'}". Past-Date Justification: "${justification || 'N/A'}"`,
        clientIp
    });

    res.json({
        success: true,
        message: `Attendance for interview ${interview.interview_id} successfully marked as ${flag}.`,
        data: formatInterviewOutput(result.interview),
        attendance_record: result.attendanceRecord
    });
});

/**
 * PUT /api/interview/:id/status
 * Update interview status (Completed, Pending, Missed, Scheduled, Cancelled)
 */
router.put('/interview/:id/status', (req, res) => {
    const interview = findInterviewById(req.params.id);
    if (!interview) {
        return res.status(404).json({
            success: false,
            error: 'Interview Not Found',
            message: `Interview "${req.params.id}" does not exist.`
        });
    }

    const { status, remarks, justification } = req.body;
    const validStatuses = ['Completed', 'Pending', 'Missed', 'Scheduled', 'Cancelled'];

    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: `Status must be one of: ${validStatuses.join(', ')}`
        });
    }

    const today = getTodayString();
    const isPastDate = interview.interview_date < today;

    // Past Date Restriction: Updating status for past dates requires explicit justification
    if (isPastDate && (!justification || !justification.trim())) {
        return res.status(400).json({
            success: false,
            error: 'Past Date Restriction',
            message: 'Past Date Restriction: Updating status for past-dated interviews requires explicit audit justification.'
        });
    }

    const officerUser = req.user?.username || interview.officer_name || 'PESO Officer';
    const officerRole = req.user?.role || 'PESO Officer';
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const reasonText = justification || remarks || `Status transition to ${status}`;

    const oldStatus = interview.status;
    const updated = updateInterviewStatus(
        interview.id, 
        status, 
        remarks || interview.remarks, 
        justification || null
    );

    // Sync presence flag logically if needed
    if (status === 'Completed' && updated.presence_flag === 'Unmarked') {
        updated.presence_flag = 'Present';
        updated.attendance_status = 'Present';
    } else if (status === 'Missed' && updated.presence_flag === 'Unmarked') {
        updated.presence_flag = 'Absent';
        updated.attendance_status = 'Absent';
    }

    // Immutable Audit Trail
    logAudit({
        userId: officerUser,
        userRole: officerRole,
        actionType: 'UPDATE_INTERVIEW_STATUS',
        targetEntity: 'Interview Schedule',
        targetId: updated.interview_id,
        status: 'SUCCESS',
        actionReason: reasonText,
        details: `Officer "${officerUser}" transitioned status for interview "${updated.interview_id}" (${updated.beneficiary_name}) from "${oldStatus}" to "${status}". Remarks: "${remarks || 'None'}". Past-Date Justification: "${justification || 'N/A'}"`,
        clientIp
    });

    res.json({
        success: true,
        message: `Interview ${updated.interview_id} status updated to ${status}.`,
        data: formatInterviewOutput(updated)
    });
});

/**
 * GET /api/interview/check-conflicts
 * Conflict Validation Restriction: Checks if an officer has an overlapping schedule
 */
router.get('/interview/check-conflicts', (req, res) => {
    const { officer_id, date, schedule_time, exclude_id } = req.query;

    if (!officer_id || !date || !schedule_time) {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: 'officer_id, date (YYYY-MM-DD), and schedule_time are required.'
        });
    }

    const conflict = checkOfficerScheduleConflict(officer_id, date, schedule_time, exclude_id);

    if (conflict) {
        return res.json({
            success: true,
            hasConflict: true,
            message: `Conflict detected: Officer is already scheduled with "${conflict.beneficiary_name}" at ${conflict.schedule_time} on ${conflict.interview_date}.`,
            conflictInterview: formatInterviewOutput(conflict)
        });
    }

    res.json({
        success: true,
        hasConflict: false,
        message: 'No scheduling conflicts found. Time slot is available.'
    });
});

/**
 * POST /api/interview/schedule
 * Schedules a new interview with conflict validation & audit trail
 */
router.post('/interview/schedule', (req, res) => {
    const {
        officer_id,
        beneficiary_name,
        beneficiary_phone,
        beneficiary_email,
        beneficiary_address,
        barangay,
        program_code,
        program_name,
        project_type,
        interview_date,
        schedule_time,
        venue_location,
        remarks
    } = req.body;

    const officerUser = req.user?.username || 'PESO Officer';
    const officerRole = req.user?.role || 'PESO Officer';
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    if (!beneficiary_name || !interview_date || !schedule_time) {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: 'Beneficiary name, interview date, and schedule time are required.'
        });
    }

    // Conflict Validation Restriction
    const conflict = checkOfficerScheduleConflict(officer_id || 2, interview_date, schedule_time);
    if (conflict) {
        return res.status(409).json({
            success: false,
            error: 'Conflict Restriction',
            message: `Scheduling Conflict: Officer already has an interview scheduled with "${conflict.beneficiary_name}" at ${conflict.schedule_time} on ${interview_date}. Overlapping schedules are prevented.`
        });
    }

    const newInterview = addInterview({
        officer_id: officer_id || 2,
        beneficiary_name: beneficiary_name.trim(),
        beneficiary_phone: beneficiary_phone || '0917-111-2222',
        beneficiary_email: (beneficiary_email || 'beneficiary@koronadal.ph').trim(),
        beneficiary_address: beneficiary_address || 'Koronadal City',
        barangay: barangay || 'Poblacion',
        program_code: program_code || 'TUPAD',
        program_name: program_name || 'TUPAD (Emergency Employment Assistance)',
        project_type: project_type || 'Community Assistance',
        interview_date: interview_date,
        schedule_time: schedule_time,
        venue_location: venue_location || 'PESO Main Office - Interview Room A',
        status: 'Pending',
        remarks: remarks || 'Interview scheduled.'
    });

    logAudit({
        userId: officerUser,
        userRole: officerRole,
        actionType: 'SCHEDULE_INTERVIEW',
        targetEntity: 'Interview Schedule',
        targetId: newInterview.interview_id,
        status: 'SUCCESS',
        actionReason: 'Officer scheduled beneficiary interview session',
        details: `Officer "${officerUser}" scheduled interview "${newInterview.interview_id}" for beneficiary "${newInterview.beneficiary_name}" on ${newInterview.interview_date} at ${newInterview.schedule_time}.`,
        clientIp
    });

    res.status(201).json({
        success: true,
        message: `Interview "${newInterview.interview_id}" scheduled successfully for ${newInterview.beneficiary_name}.`,
        data: formatInterviewOutput(newInterview)
    });
});

module.exports = router;

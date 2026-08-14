/**
 * Backend PESO Officer & Unified Schedule Slots Router & Controller
 * City Government of Koronadal — PESO & CSWDO Portal
 * 
 * Endpoints:
 * - GET  /api/schedule-slots              -> Fetch all program schedule slots with Admin filters & summary metrics
 * - POST /api/schedule-slots              -> Admin creates new program schedule slot with program linkage & officer assignment
 * - PUT  /api/schedule-slots/:id          -> Admin updates schedule slot details / reassigns officer (when unlocked)
 * - PUT  /api/schedule-slots/:id/lock     -> Admin locks/unlocks slot (prevents officer reassignment)
 * - PUT  /api/schedule-slots/:id/complete -> Admin marks slot finalized/completed
 * - PUT  /api/schedule-slots/:id/cancel   -> Admin cancels slot (retains red label visibility & audit log)
 * - POST /api/schedule-slots/:id/assign   -> Officer assigns beneficiary (Individual or Batch mode with metadata)
 * - GET  /api/schedule-slots/export/combined -> Combined Admin + Officer data export for LGU reporting
 * - GET  /api/officer/:id/schedule        -> Fetch assigned interviews/slots for an officer
 * - GET  /api/interview/:id               -> Fetch detailed interview record with beneficiary & program
 * - PUT  /api/interview/:id/attendance    -> Mark interview attendance (Present / Absent)
 * - PUT  /api/interview/:id/status        -> Update interview status (Completed, Pending, Missed)
 * - POST /api/interview/schedule          -> Schedule new interview with conflict validation
 * - GET  /api/interview/check-conflicts   -> Validate date/time for overlapping officer schedules
 * 
 * Restrictions & Safeguards:
 * 1. Past Date Restriction: Cannot create slots or update past interviews without explicit audit justification.
 * 2. Conflict Restriction: Prevents overlapping time slots for the same officer.
 * 3. Double-Booking Restriction: Prevents scheduling the same beneficiary in overlapping slots.
 * 4. Lock Restriction: Prevents officer reassignment or beneficiary modifications on locked slots.
 * 5. Program Linkage Immutability: Officers cannot change Admin-linked program types.
 * 6. Audit Restriction: All actions trigger immutable audit logging with credentials.
 * 7. Data Privacy: Beneficiary contact numbers are masked (09XX-***-XXXX).
 * 8. Read-only Details: Modals are strictly view-only.
 */

const express = require('express');
const router = express.Router();
const { 
    getInterviews, 
    findInterviewById, 
    getInterviewsByOfficer,
    getScheduleSlots,
    createScheduleSlot,
    updateScheduleSlot,
    lockScheduleSlot,
    completeScheduleSlot,
    cancelScheduleSlot,
    assignBeneficiariesToSlot,
    checkBeneficiaryDoubleBooking,
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
 * Format interview/slot record for output with data privacy masking
 */
function formatInterviewOutput(i) {
    if (!i) return null;
    return {
        id: i.id,
        slot_id: i.slot_id || `SLOT-2026-${String(i.id).padStart(3, '0')}`,
        interview_id: i.interview_id || `INT-2026-${String(i.id).padStart(3, '0')}`,
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
        program_sub_category: i.program_sub_category || 'General Livelihood Program',
        barangay_cluster: i.barangay_cluster || 'Cluster 1 - Urban (Poblacion, Zone I, Zone II)',
        application_id: i.application_id,
        date_applied: i.date_applied,
        interview_date: i.interview_date,
        slot_date: i.interview_date,
        schedule_time: i.schedule_time,
        time_slot: i.time_slot,
        venue_location: i.venue_location,
        status: i.status || 'Pending', // 'Pending', 'Completed', 'Missed', 'Scheduled', 'Cancelled'
        slot_status: i.slot_status || (i.is_locked ? 'Locked' : (i.status === 'Completed' ? 'Completed' : (i.status === 'Cancelled' ? 'Cancelled' : 'Active'))),
        is_locked: Boolean(i.is_locked),
        lock_status: i.is_locked ? 'Locked' : 'Unlocked',
        scheduling_mode: i.scheduling_mode || (i.batch_name ? 'Batch' : (i.beneficiary_id ? 'Individual' : 'Unassigned')),
        batch_id: i.batch_id || null,
        batch_name: i.batch_name || null,
        batch_count: i.batch_count || (i.scheduling_mode === 'Individual' ? 1 : 0),
        batch_members: Array.isArray(i.batch_members) ? i.batch_members.map(m => typeof m === 'object' ? { ...m, phone: maskContactNumber(m.phone) } : m) : [],
        attendance_status: i.attendance_status || i.presence_flag || 'Unmarked', // 'Unmarked', 'Present', 'Absent'
        presence_flag: i.presence_flag || i.attendance_status || 'Unmarked',
        remarks: i.remarks || '',
        justification: i.justification || null,
        cancellation_reason: i.cancellation_reason || null,
        is_past_date: i.interview_date < getTodayString(),
        created_at: i.created_at,
        updated_at: i.updated_at
    };
}

// =============================================================================
// ADMIN SCHEDULE SLOTS CRUD & WORKFLOW ENDPOINTS
// =============================================================================

/**
 * GET /api/schedule-slots
 * Admin list view of all program schedule slots with filters and summary counters
 */
router.get('/schedule-slots', (req, res) => {
    const { 
        program_type, 
        date, 
        date_from, 
        date_to, 
        venue, 
        officer_id, 
        status, 
        is_locked, 
        search 
    } = req.query;

    const result = getScheduleSlots({
        program_type,
        date,
        date_from,
        date_to,
        venue,
        officer_id,
        status,
        is_locked,
        search
    });

    const formattedSlots = result.slots.map(formatInterviewOutput);

    res.json({
        success: true,
        count: formattedSlots.length,
        metrics: result.metrics,
        data: formattedSlots
    });
});

/**
 * POST /api/schedule-slots
 * PESO Admin creates a program schedule slot with program linkage and officer assignment
 */
router.post('/schedule-slots', (req, res) => {
    const {
        program_type,
        program_code,
        program_name,
        program_sub_category,
        barangay_cluster,
        date,
        interview_date,
        time,
        schedule_time,
        venue,
        venue_location,
        officer_id,
        officer_name,
        remarks,
        project_type
    } = req.body;

    const adminUser = req.user?.username || req.headers['x-admin-username'] || 'PESO Administrator';
    const adminRole = req.user?.role || 'PESO Admin';
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const slotProgram = program_code || program_type || 'TUPAD';
    const slotDate = interview_date || date;
    const slotTime = schedule_time || time;
    const slotVenue = venue_location || venue;
    const slotOfficerId = Number(officer_id) || 2;

    if (!slotProgram || !slotDate || !slotTime || !slotVenue) {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: 'Program Type, Date, Time Slot, and Venue Location are mandatory fields.'
        });
    }

    // Past Date Restriction: Cannot schedule slots in the past
    const today = getTodayString();
    if (slotDate < today) {
        return res.status(400).json({
            success: false,
            error: 'Past Date Restriction',
            message: `Past Date Restriction: Cannot create program schedule slots for past dates (${slotDate}). Please select today or a future date.`
        });
    }

    // Conflict Validation Restriction: Prevent overlapping slots for same officer
    const conflict = checkOfficerScheduleConflict(slotOfficerId, slotDate, slotTime);
    if (conflict) {
        return res.status(409).json({
            success: false,
            error: 'Conflict Restriction',
            message: `Scheduling Conflict: Assigned officer is already scheduled on ${slotDate} at ${conflict.schedule_time} (${conflict.slot_id || conflict.interview_id}). Overlapping slots are prevented.`,
            existingSchedule: formatInterviewOutput(conflict)
        });
    }

    const newSlot = createScheduleSlot({
        program_code: slotProgram,
        program_name: program_name,
        program_sub_category: program_sub_category,
        barangay_cluster: barangay_cluster,
        interview_date: slotDate,
        schedule_time: slotTime,
        venue_location: slotVenue,
        officer_id: slotOfficerId,
        officer_name: officer_name,
        remarks: remarks || 'Admin scheduled program slot.',
        project_type: project_type
    });

    logAudit({
        userId: adminUser,
        userRole: adminRole,
        actionType: 'CREATE_SCHEDULE_SLOT',
        targetEntity: 'Program Schedule Slot',
        targetId: newSlot.slot_id,
        status: 'SUCCESS',
        actionReason: 'PESO Admin created program schedule slot with LGU program linkage',
        details: `Admin "${adminUser}" created slot "${newSlot.slot_id}" for program "${newSlot.program_code}" on ${newSlot.interview_date} (${newSlot.schedule_time}) assigned to officer "${newSlot.officer_name}". Venue: "${newSlot.venue_location}".`,
        clientIp
    });

    res.status(201).json({
        success: true,
        message: `Program schedule slot "${newSlot.slot_id}" created successfully with program linkage to ${newSlot.program_code}.`,
        data: formatInterviewOutput(newSlot)
    });
});

/**
 * PUT /api/schedule-slots/:id
 * Admin edits slot details or reassigns officer (flexibility prior to lock)
 */
router.put('/schedule-slots/:id', (req, res) => {
    const slotId = req.params.id;
    const slot = findInterviewById(slotId);
    if (!slot) {
        return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: `Schedule slot "${slotId}" does not exist.`
        });
    }

    const adminUser = req.user?.username || 'PESO Administrator';
    const adminRole = req.user?.role || 'PESO Admin';
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const {
        program_code,
        program_name,
        program_sub_category,
        barangay_cluster,
        date,
        interview_date,
        time,
        schedule_time,
        venue,
        venue_location,
        officer_id,
        officer_name,
        remarks,
        status
    } = req.body;

    const newDate = interview_date || date || slot.interview_date;
    const newTime = schedule_time || time || slot.schedule_time;
    const newOfficerId = officer_id !== undefined ? Number(officer_id) : slot.officer_id;

    // Check lock restriction on officer reassignment
    if (slot.is_locked && newOfficerId !== slot.officer_id) {
        return res.status(403).json({
            success: false,
            error: 'Lock Restriction',
            message: 'Lock Restriction: This slot is locked by Admin. Unlock the slot first before reassigning the PESO Officer.'
        });
    }

    // Check schedule conflict for officer if date, time, or officer changed
    if (newOfficerId !== slot.officer_id || newDate !== slot.interview_date || newTime !== slot.schedule_time) {
        const conflict = checkOfficerScheduleConflict(newOfficerId, newDate, newTime, slot.id);
        if (conflict) {
            return res.status(409).json({
                success: false,
                error: 'Conflict Restriction',
                message: `Scheduling Conflict: Officer is already scheduled on ${newDate} at ${conflict.schedule_time}. Overlapping slot prevented.`,
                existingSchedule: formatInterviewOutput(conflict)
            });
        }
    }

    const updated = updateScheduleSlot(slot.id, {
        program_code,
        program_name,
        program_sub_category,
        barangay_cluster,
        interview_date: newDate,
        schedule_time: newTime,
        venue_location: venue_location || venue,
        officer_id: newOfficerId,
        officer_name,
        remarks,
        status
    });

    logAudit({
        userId: adminUser,
        userRole: adminRole,
        actionType: 'UPDATE_SCHEDULE_SLOT',
        targetEntity: 'Program Schedule Slot',
        targetId: updated.slot_id,
        status: 'SUCCESS',
        actionReason: 'Admin updated schedule slot configuration and officer assignment',
        details: `Admin "${adminUser}" updated slot "${updated.slot_id}". Officer: "${updated.officer_name}", Date: ${updated.interview_date} (${updated.schedule_time}), Venue: "${updated.venue_location}".`,
        clientIp
    });

    res.json({
        success: true,
        message: `Schedule slot "${updated.slot_id}" updated successfully.`,
        data: formatInterviewOutput(updated)
    });
});

/**
 * PUT /api/schedule-slots/:id/lock
 * Admin locks or unlocks slot to prevent further officer reassignment
 */
router.put('/schedule-slots/:id/lock', (req, res) => {
    const slotId = req.params.id;
    const slot = findInterviewById(slotId);
    if (!slot) {
        return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: `Schedule slot "${slotId}" does not exist.`
        });
    }

    const { is_locked } = req.body;
    const lockBool = is_locked !== undefined ? Boolean(is_locked) : !slot.is_locked;

    const adminUser = req.user?.username || 'PESO Administrator';
    const adminRole = req.user?.role || 'PESO Admin';
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const updated = lockScheduleSlot(slot.id, lockBool);

    logAudit({
        userId: adminUser,
        userRole: adminRole,
        actionType: lockBool ? 'LOCK_SCHEDULE_SLOT' : 'UNLOCK_SCHEDULE_SLOT',
        targetEntity: 'Program Schedule Slot',
        targetId: updated.slot_id,
        status: 'SUCCESS',
        actionReason: lockBool ? 'Admin locked slot to prevent further officer reassignment' : 'Admin unlocked slot to allow modification',
        details: `Admin "${adminUser}" ${lockBool ? 'LOCKED' : 'UNLOCKED'} slot "${updated.slot_id}" (${updated.program_code}). Officer: "${updated.officer_name}".`,
        clientIp
    });

    res.json({
        success: true,
        message: `Schedule slot "${updated.slot_id}" is now ${lockBool ? 'LOCKED (officer reassignment prevented)' : 'UNLOCKED'}.`,
        data: formatInterviewOutput(updated)
    });
});

/**
 * PUT /api/schedule-slots/:id/complete
 * Admin finalizes slot as Completed
 */
router.put('/schedule-slots/:id/complete', (req, res) => {
    const slotId = req.params.id;
    const slot = findInterviewById(slotId);
    if (!slot) {
        return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: `Schedule slot "${slotId}" does not exist.`
        });
    }

    const { remarks } = req.body;
    const adminUser = req.user?.username || 'PESO Administrator';
    const adminRole = req.user?.role || 'PESO Admin';
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const updated = completeScheduleSlot(slot.id, { remarks });

    logAudit({
        userId: adminUser,
        userRole: adminRole,
        actionType: 'COMPLETE_SCHEDULE_SLOT',
        targetEntity: 'Program Schedule Slot',
        targetId: updated.slot_id,
        status: 'SUCCESS',
        actionReason: 'Admin finalized slot lifecycle as Completed for LGU reporting',
        details: `Admin "${adminUser}" marked slot "${updated.slot_id}" (${updated.program_code}) as COMPLETED. Remarks: "${remarks || 'None'}".`,
        clientIp
    });

    res.json({
        success: true,
        message: `Schedule slot "${updated.slot_id}" marked as COMPLETED.`,
        data: formatInterviewOutput(updated)
    });
});

/**
 * PUT /api/schedule-slots/:id/cancel
 * Admin cancels slot (retains red label visibility & audit log)
 */
router.put('/schedule-slots/:id/cancel', (req, res) => {
    const slotId = req.params.id;
    const slot = findInterviewById(slotId);
    if (!slot) {
        return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: `Schedule slot "${slotId}" does not exist.`
        });
    }

    const { reason, remarks } = req.body;
    const cancellationReason = (reason || remarks || '').trim();

    if (!cancellationReason) {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: 'Cancellation reason is mandatory for auditing compliance.'
        });
    }

    const adminUser = req.user?.username || 'PESO Administrator';
    const adminRole = req.user?.role || 'PESO Admin';
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const updated = cancelScheduleSlot(slot.id, cancellationReason);

    logAudit({
        userId: adminUser,
        userRole: adminRole,
        actionType: 'CANCEL_SCHEDULE_SLOT',
        targetEntity: 'Program Schedule Slot',
        targetId: updated.slot_id,
        status: 'SUCCESS',
        actionReason: cancellationReason,
        details: `Admin "${adminUser}" CANCELLED schedule slot "${updated.slot_id}" (${updated.program_code}). Reason: "${cancellationReason}". Record retained with red status label.`,
        clientIp
    });

    res.json({
        success: true,
        message: `Schedule slot "${updated.slot_id}" cancelled. Retained with red label for reporting compliance.`,
        data: formatInterviewOutput(updated)
    });
});

// =============================================================================
// OFFICER BENEFICIARY ASSIGNMENT & EXECUTION ENDPOINTS
// =============================================================================

/**
 * POST /api/schedule-slots/:id/assign
 * Officer assigns beneficiary (Individual or Batch mode with metadata)
 */
router.post('/schedule-slots/:id/assign', (req, res) => {
    const slotId = req.params.id;
    const slot = findInterviewById(slotId);
    if (!slot) {
        return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: `Schedule slot "${slotId}" does not exist.`
        });
    }

    // Lock check: Cannot assign or reassign if slot is locked by Admin
    if (slot.is_locked) {
        return res.status(403).json({
            success: false,
            error: 'Lock Restriction',
            message: 'Lock Restriction: This slot has been locked by PESO Admin. Reassignment or beneficiary modifications are prevented.'
        });
    }

    const {
        mode, // 'Individual' or 'Batch'
        beneficiary_name,
        beneficiary_phone,
        beneficiary_email,
        beneficiary_address,
        barangay,
        sex,
        age,
        batch_name,
        batch_count,
        batch_members,
        barangay_cluster,
        program_sub_category,
        remarks
    } = req.body;

    const officerUser = req.user?.username || req.headers['x-officer-username'] || slot.officer_name || 'PESO Officer';
    const officerRole = req.user?.role || 'PESO Officer';
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const assignMode = mode || (batch_name ? 'Batch' : 'Individual');

    const result = assignBeneficiariesToSlot(slot.id, {
        mode: assignMode,
        beneficiary_name,
        beneficiary_phone,
        beneficiary_email,
        beneficiary_address,
        barangay,
        sex,
        age,
        batch_name,
        batch_count,
        batch_members,
        barangay_cluster,
        program_sub_category,
        remarks
    });

    if (result.error) {
        const isConflict = result.error.includes('Double-Booking') || result.error.includes('Conflict');
        return res.status(isConflict ? 409 : 400).json({
            success: false,
            error: isConflict ? 'Double-Booking Restriction' : 'Validation Error',
            message: result.error,
            conflictSlot: result.conflictSlot ? formatInterviewOutput(result.conflictSlot) : null
        });
    }

    logAudit({
        userId: officerUser,
        userRole: officerRole,
        actionType: assignMode === 'Batch' ? 'ASSIGN_BENEFICIARY_BATCH' : 'ASSIGN_BENEFICIARY_INDIVIDUAL',
        targetEntity: 'Program Schedule Slot',
        targetId: slot.slot_id,
        status: 'SUCCESS',
        actionReason: `Officer assigned ${assignMode} beneficiary to Admin program slot (${slot.program_code})`,
        details: `Officer "${officerUser}" assigned [Mode: ${assignMode}] "${assignMode === 'Batch' ? batch_name : beneficiary_name}" to slot "${slot.slot_id}". Linked Program: "${slot.program_code}". Cluster: "${result.slot.barangay_cluster || 'N/A'}", Sub-Category: "${result.slot.program_sub_category || 'N/A'}".`,
        clientIp
    });

    res.json({
        success: true,
        message: `${assignMode} beneficiary successfully assigned to slot ${slot.slot_id} under program ${slot.program_code}.`,
        data: formatInterviewOutput(result.slot)
    });
});

/**
 * GET /api/schedule-slots/export/combined
 * Combined export of Admin slot allocation + Officer beneficiary execution for LGU reporting
 */
router.get('/schedule-slots/export/combined', (req, res) => {
    const { program_type, date_from, date_to, officer_id, status } = req.query;

    const result = getScheduleSlots({
        program_type,
        date_from,
        date_to,
        officer_id,
        status
    });

    const exportRows = result.slots.map(s => ({
        slot_id: s.slot_id,
        interview_id: s.interview_id,
        program_code: s.program_code,
        program_name: s.program_name,
        program_sub_category: s.program_sub_category || 'General Livelihood',
        barangay_cluster: s.barangay_cluster || 'Urban Cluster',
        slot_date: s.interview_date,
        time_slot: s.schedule_time,
        venue: s.venue_location,
        assigned_officer: s.officer_name,
        slot_lifecycle: s.slot_status || 'Active',
        is_locked: s.is_locked ? 'YES' : 'NO',
        scheduling_mode: s.scheduling_mode || 'Unassigned',
        beneficiary_or_batch: s.beneficiary_name,
        masked_contact: maskContactNumber(s.beneficiary_phone),
        barangay: s.barangay,
        attendance_status: s.attendance_status || 'Unmarked',
        interview_outcome: s.status || 'Pending',
        remarks: s.remarks || '',
        cancellation_reason: s.cancellation_reason || 'N/A'
    }));

    res.json({
        success: true,
        generated_at: new Date().toISOString(),
        reporting_authority: 'City Government of Koronadal — PESO & CSWDO',
        ordinance_reference: 'Appropriation Ordinance No. 6, Series of 2025 (BY 2026)',
        total_records: exportRows.length,
        metrics: result.metrics,
        data: exportRows
    });
});

// =============================================================================
// BACKWARDS-COMPATIBLE OFFICER & INTERVIEW ENDPOINTS
// =============================================================================

/**
 * GET /api/officer/:id/schedule
 * Fetch assigned interviews for an officer with optional date, status, search filters
 */
router.get('/officer/:id/schedule', (req, res) => {
    const officerId = req.params.id;
    const { date, status, search, program_type, attendance } = req.query;

    const list = getInterviewsByOfficer(officerId, { date, status, search, program_type, attendance });
    const formatted = list.map(formatInterviewOutput);

    // Compute Officer Summary Metrics
    const total_assigned = formatted.length;
    const pending = formatted.filter(i => i.status === 'Pending').length;
    const completed = formatted.filter(i => i.status === 'Completed').length;
    const missed = formatted.filter(i => i.status === 'Missed' || i.attendance_status === 'Absent').length;

    res.json({
        success: true,
        count: formatted.length,
        officer_id: officerId,
        date_filter: date || 'ALL',
        metrics: {
            total_assigned,
            pending,
            completed,
            missed
        },
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

    // If attendance is marked Present and status is Pending/Missed, optionally advance
    if (flag === 'Present' && interview.status === 'Missed') {
        interview.status = 'Completed';
        interview.slot_status = 'Completed';
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

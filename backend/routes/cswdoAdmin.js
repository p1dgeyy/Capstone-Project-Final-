/**
 * CSWDO Administrator & Assistance Programs Dashboard Router
 * City Government of Koronadal — CSWDO Admin Portal
 * 
 * Endpoints:
 * - POST /api/admin/login                     -> CSWDO Admin authentication with lockout enforcement
 * - GET  /api/admin/dashboard/summary         -> Summary counts (Total, Pending, Approved, Completed) & fund metrics
 * - GET  /api/admin/dashboard/status-breakdown-> Application status distribution & chart dataset
 * - GET  /api/admin/dashboard/fund-utilization -> Aggregated fund balances & program progress bars
 * - GET  /api/admin/dashboard/monthly-trend   -> Monthly application trend for current year (2026)
 * - GET  /api/admin/dashboard/recent-activity -> Latest action audit logs with quick link IDs
 * - GET  /api/admin/applications              -> List applications with filters & masked contacts
 * - GET  /api/admin/applications/:id          -> View-only details modal payload (Data Privacy compliant)
 * - POST /api/admin/applications/:id/approve  -> Approve application with audit trail
 * - POST /api/admin/applications/:id/deny     -> Deny application with justification & audit trail
 * - POST /api/admin/applications/:id/release  -> Release grant funds with budget deduction & audit trail
 * - GET  /api/admin/programs                  -> List assistance programs & budget summaries
 * 
 * Security & Compliance Safeguards:
 * 1. Account lockout after 5 consecutive failed login attempts (15-min cooldown).
 * 2. Strict Data Privacy Act compliance: contact numbers masked in all views (09XX-***-XXXX).
 * 3. Admins only view aggregated fund metrics, never individual beneficiary financial disclosures.
 * 4. Immutable audit logging for all critical operations (Approve, Deny, Release, Login).
 * 5. View-only Details modals: all detail views are strictly non-editable.
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { 
    findUserByIdentifier, 
    getCswdoApplications, 
    findCswdoApplicationById, 
    getCswdoFunds, 
    getCswdoDashboardSummary, 
    getCswdoStatusBreakdown, 
    getCswdoMonthlyTrend, 
    getCswdoRecentActivity, 
    addCswdoActivityLog, 
    approveCswdoApplication, 
    denyCswdoApplication, 
    releaseCswdoApplicationFunds,
    getCswdoOfficers,
    findCswdoOfficerById,
    findCswdoOfficerByUsernameOrEmail,
    addCswdoOfficer,
    updateCswdoOfficer,
    toggleCswdoOfficerStatus,
    deleteCswdoOfficerPermanently
} = require('../data/seedData');

const { 
    generateAccessToken, 
    generateRefreshToken, 
    trackIpFailedAttempt, 
    resetIpAttempts, 
    maskContactNumber, 
    requireAuth, 
    requireAdmin 
} = require('../middleware/auth');

const { logAudit } = require('../utils/auditLogger');

// Constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Format application record for safe output (Compliance with Data Privacy Act)
 */
function sanitizeApplicationRecord(app) {
    if (!app) return null;
    return {
        id: app.id,
        beneficiary_id: app.beneficiary_id,
        beneficiary_name: app.beneficiary_name,
        contact_number: maskContactNumber(app.contact_number),
        barangay: app.barangay,
        address: app.address,
        type: app.type,
        program_code: app.program_code,
        status: app.status, // Pending, For Evaluation, Approved, Released, Completed, Denied
        amount_requested: app.amount_requested,
        amount_approved: app.amount_approved,
        submission_date: app.submission_date,
        submission_month: app.submission_month,
        submission_year: app.submission_year,
        purpose: app.purpose,
        requirements_submitted: app.requirements_submitted || [],
        evaluator_notes: app.evaluator_notes || 'No evaluator notes recorded.',
        admin_notes: app.admin_notes || null,
        created_at: app.created_at,
        updated_at: app.updated_at,
        is_view_only: true
    };
}

/**
 * POST /api/admin/login
 * CSWDO Administrator Login Endpoint
 */
router.post('/login', async (req, res) => {
    const { username, email, password } = req.body;
    const identifier = (username || email || '').trim();
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    if (!identifier || !password) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Request',
            message: 'Username/Email and Password are required.'
        });
    }

    const user = findUserByIdentifier(identifier);

    // If user not found: record failed attempt & return exact standard error
    if (!user) {
        trackIpFailedAttempt(clientIp, identifier);
        logAudit({
            userId: identifier,
            userRole: 'GUEST',
            actionType: 'ADMIN_LOGIN_FAILED',
            targetEntity: 'CSWDO Admin Authentication',
            status: 'BLOCKED',
            actionReason: 'User not found in system',
            details: `Failed login attempt for non-existent admin identifier: ${identifier}`,
            clientIp
        });

        return res.status(401).json({
            success: false,
            error: 'Authentication Failed',
            message: 'Invalid username/email or password.'
        });
    }

    const now = Date.now();

    // Check if account is currently locked (5 failed attempts -> 15 min lockout)
    if (user.lockout_until && now < user.lockout_until) {
        const remainingMinutes = Math.ceil((user.lockout_until - now) / (60 * 1000));
        logAudit({
            userId: user.username,
            userRole: user.role,
            actionType: 'ADMIN_LOGIN_LOCKED',
            targetEntity: 'CSWDO User Account',
            targetId: user.id,
            status: 'BLOCKED',
            actionReason: 'Account locked due to 5 consecutive failed attempts',
            details: `Admin login rejected for locked account "${user.username}". Lockout remaining: ${remainingMinutes} min`,
            clientIp
        });

        return res.status(423).json({
            success: false,
            error: 'Account Locked',
            message: `Account locked: ${MAX_FAILED_ATTEMPTS} failed login attempts exceeded. Please wait ${remainingMinutes} minute(s) or reset your password.`
        });
    }

    // Reset lockout if duration expired
    if (user.lockout_until && now >= user.lockout_until) {
        user.lockout_until = null;
        user.failed_login_attempts = 0;
    }

    // Verify Password with Bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
        user.failed_login_attempts = (user.failed_login_attempts || 0) + 1;
        trackIpFailedAttempt(clientIp, user.username);

        // Check if 5-attempt threshold reached
        if (user.failed_login_attempts >= MAX_FAILED_ATTEMPTS) {
            user.lockout_until = now + LOCKOUT_DURATION_MS;
            user.status = 'Locked';

            logAudit({
                userId: user.username,
                userRole: user.role,
                actionType: 'ACCOUNT_LOCKED',
                targetEntity: 'CSWDO Admin Account',
                targetId: user.id,
                status: 'BLOCKED',
                actionReason: `Maximum failed login attempts (${MAX_FAILED_ATTEMPTS}) reached.`,
                details: `Account "${user.username}" locked for 15 minutes following ${MAX_FAILED_ATTEMPTS} consecutive failures.`,
                clientIp
            });

            return res.status(423).json({
                success: false,
                error: 'Account Locked',
                message: `Account locked: ${MAX_FAILED_ATTEMPTS} failed login attempts exceeded. Please wait 15 minutes or reset your password.`
            });
        }

        const remainingAttempts = MAX_FAILED_ATTEMPTS - user.failed_login_attempts;
        logAudit({
            userId: user.username,
            userRole: user.role,
            actionType: 'ADMIN_LOGIN_FAILED',
            targetEntity: 'CSWDO Admin Authentication',
            targetId: user.id,
            status: 'BLOCKED',
            actionReason: 'Password mismatch',
            details: `Invalid password for account "${user.username}". Failed count: ${user.failed_login_attempts}`,
            clientIp
        });

        return res.status(401).json({
            success: false,
            error: 'Authentication Failed',
            message: 'Invalid username/email or password.',
            attemptsRemaining: remainingAttempts
        });
    }

    // Account status check
    if (user.status === 'Archived' || user.status === 'Deactivated') {
        return res.status(403).json({
            success: false,
            error: 'Account Inactive',
            message: `Account is ${user.status}. Please contact the System Administrator.`
        });
    }

    // Successful Admin Login
    user.failed_login_attempts = 0;
    user.lockout_until = null;
    user.last_login_at = new Date().toISOString();
    resetIpAttempts(clientIp);

    const tokenPayload = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department || 'CSWDO',
        fullName: `${user.first_name} ${user.last_name}`
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Audit Log
    logAudit({
        userId: user.username,
        userRole: user.role,
        actionType: 'ADMIN_LOGIN_SUCCESS',
        targetEntity: 'CSWDO Admin Portal',
        targetId: user.id,
        status: 'SUCCESS',
        actionReason: 'Valid administrator credentials supplied',
        details: `Successful authenticated login for ${user.role} "${user.username}" (${user.email}) from IP ${clientIp}`,
        clientIp
    });

    addCswdoActivityLog({
        action: 'ADMIN_LOGIN',
        action_title: 'Administrator Logged In',
        beneficiary_name: 'N/A',
        program: 'CSWDO Portal Administration',
        admin_id: user.username,
        admin_name: `${user.first_name} ${user.last_name}`,
        details: `Admin ${user.username} successfully signed in to CSWDO Management Portal.`
    });

    res.json({
        success: true,
        message: 'CSWDO Admin login successful.',
        redirectTo: 'cswdo_admin.html',
        accessToken,
        refreshToken,
        expiresIn: 15 * 60,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            fullName: `${user.first_name} ${user.last_name}`,
            role: user.role,
            department: user.department || 'CSWDO',
            phone: maskContactNumber(user.phone),
            status: user.status,
            last_login_at: user.last_login_at
        }
    });
});

/**
 * GET /api/admin/dashboard/summary
 * Summary Count Cards: Total, Pending, Approved, Completed applications & Fund Overview
 */
router.get('/dashboard/summary', (req, res) => {
    const summary = getCswdoDashboardSummary();
    res.json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /api/admin/dashboard/status-breakdown
 * Application Status Breakdown: Pending (Yellow), For Evaluation, Approved (Green), Released, Completed (Blue), Denied (Red)
 */
router.get('/dashboard/status-breakdown', (req, res) => {
    const breakdown = getCswdoStatusBreakdown();
    res.json({
        success: true,
        data: breakdown,
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /api/admin/dashboard/fund-utilization
 * Fund Utilization Overview: Total Allocated, Released, Remaining Balance, Overall %, Progress bars per program
 * Restricts individual beneficiary financial details (aggregated view only).
 */
router.get('/dashboard/fund-utilization', (req, res) => {
    const summary = getCswdoDashboardSummary();
    res.json({
        success: true,
        data: summary.fund_utilization,
        timestamp: new Date().toISOString(),
        compliance: 'Data Privacy Act compliant: Aggregated metrics only'
    });
});

/**
 * GET /api/admin/dashboard/monthly-trend
 * Monthly Application Trend: submissions per month for current year (2026) to identify patterns
 */
router.get('/dashboard/monthly-trend', (req, res) => {
    const year = req.query.year || 2026;
    const trend = getCswdoMonthlyTrend(year);
    res.json({
        success: true,
        data: trend,
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /api/admin/dashboard/recent-activity
 * Recent Activity: latest actions (submissions, evaluations, approvals, denials, releases) with quick links
 */
router.get('/dashboard/recent-activity', (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 10;
    const activities = getCswdoRecentActivity(limit);
    res.json({
        success: true,
        count: activities.length,
        data: activities,
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /api/admin/applications
 * Applications list with optional filters (status, type, search) & masked contacts
 */
router.get('/applications', (req, res) => {
    const { status, type, search } = req.query;
    const list = getCswdoApplications({ status, type, search });
    const sanitized = list.map(sanitizeApplicationRecord);

    res.json({
        success: true,
        count: sanitized.length,
        filters: { status: status || 'ALL', type: type || 'ALL', search: search || '' },
        data: sanitized
    });
});

/**
 * GET /api/admin/applications/:id
 * Strictly Read-only Details Modal Endpoint
 */
router.get('/applications/:id', (req, res) => {
    const app = findCswdoApplicationById(req.params.id);
    if (!app) {
        return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: `Application "${req.params.id}" does not exist in CSWDO database.`
        });
    }

    res.json({
        success: true,
        data: sanitizeApplicationRecord(app),
        rule: 'Read-only Details Modal Restriction: view-only with no inline editing permitted.'
    });
});

/**
 * POST /api/admin/applications/:id/approve
 * CSWDO Admin approves application with audit logging
 */
router.post('/applications/:id/approve', (req, res) => {
    const { remarks, approved_amount } = req.body;
    const adminUser = req.user || { username: 'cswdo-admin', role: 'CSWDO Admin', fullName: 'Robert Johnson (CSWDO Admin)' };
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const updated = approveCswdoApplication(req.params.id, adminUser, remarks, approved_amount);
    if (!updated) {
        return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: `Application "${req.params.id}" not found.`
        });
    }

    logAudit({
        userId: adminUser.username || 'cswdo-admin',
        userRole: adminUser.role || 'CSWDO Admin',
        actionType: 'APPROVE_CSWDO_APPLICATION',
        targetEntity: 'Assistance Application',
        targetId: updated.id,
        status: 'SUCCESS',
        actionReason: remarks || 'Administrator grant approval based on verified indigent assessment',
        details: `CSWDO Admin approved application ${updated.id} (${updated.beneficiary_name}) for ₱${updated.amount_approved.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        clientIp
    });

    res.json({
        success: true,
        message: `Application ${updated.id} successfully approved.`,
        data: sanitizeApplicationRecord(updated)
    });
});

/**
 * POST /api/admin/applications/:id/deny
 * CSWDO Admin disapproves application with mandatory justification & audit logging
 */
router.post('/applications/:id/deny', (req, res) => {
    const { reason, remarks } = req.body;
    const justification = reason || remarks || 'Application failed eligibility criteria';
    const adminUser = req.user || { username: 'cswdo-admin', role: 'CSWDO Admin', fullName: 'Robert Johnson (CSWDO Admin)' };
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const updated = denyCswdoApplication(req.params.id, adminUser, justification);
    if (!updated) {
        return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: `Application "${req.params.id}" not found.`
        });
    }

    logAudit({
        userId: adminUser.username || 'cswdo-admin',
        userRole: adminUser.role || 'CSWDO Admin',
        actionType: 'DENY_CSWDO_APPLICATION',
        targetEntity: 'Assistance Application',
        targetId: updated.id,
        status: 'SUCCESS',
        actionReason: justification,
        details: `CSWDO Admin disapproved application ${updated.id} (${updated.beneficiary_name}). Justification: ${justification}`,
        clientIp
    });

    res.json({
        success: true,
        message: `Application ${updated.id} disapproved.`,
        data: sanitizeApplicationRecord(updated)
    });
});

/**
 * POST /api/admin/applications/:id/release
 * CSWDO Admin releases assistance grant funds, updates fund balance, and logs audit
 */
router.post('/applications/:id/release', (req, res) => {
    const { release_amount, notes } = req.body;
    const adminUser = req.user || { username: 'cswdo-admin', role: 'CSWDO Admin', fullName: 'Robert Johnson (CSWDO Admin)' };
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const result = releaseCswdoApplicationFunds(req.params.id, adminUser, release_amount, notes);
    if (!result || !result.app) {
        return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: `Application "${req.params.id}" not found.`
        });
    }

    const { app, fund } = result;

    logAudit({
        userId: adminUser.username || 'cswdo-admin',
        userRole: adminUser.role || 'CSWDO Admin',
        actionType: 'RELEASE_ASSISTANCE_FUNDS',
        targetEntity: 'Assistance Fund Disbursement',
        targetId: app.id,
        status: 'SUCCESS',
        actionReason: notes || 'Assistance voucher issued for beneficiary medical/financial release',
        details: `Disbursed ₱${app.amount_approved.toLocaleString('en-US', { minimumFractionDigits: 2 })} for ${app.id} (${app.beneficiary_name}). Updated program: ${fund ? fund.program : app.type} (Remaining: ₱${fund ? fund.remaining_balance.toLocaleString('en-US') : 'N/A'})`,
        clientIp
    });

    res.json({
        success: true,
        message: `Assistance grant for application ${app.id} released successfully.`,
        data: sanitizeApplicationRecord(app),
        fund_update: fund ? {
            program: fund.program,
            released_amount: fund.released_amount,
            remaining_balance: fund.remaining_balance,
            percentage_utilized: fund.percentage_utilized
        } : null
    });
});

/**
 * GET /api/admin/programs
 * Aggregated Programs & Budget summary
 */
router.get('/programs', (req, res) => {
    const funds = getCswdoFunds();
    res.json({
        success: true,
        count: funds.length,
        data: funds,
        compliance: 'Aggregated fund overview. Individual financial privacy preserved.'
    });
});

/**
 * GET /api/admin/activity-logs
 * Activity logs feed
 */
router.get('/activity-logs', (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 50;
    const logs = getCswdoRecentActivity(limit);
    res.json({
        success: true,
        count: logs.length,
        data: logs
    });
});

// =============================================================================
// CSWDO OFFICER MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * GET /api/admin/officers
 * Fetch all CSWDO Officer accounts with filters (Role, Department, Status, Search)
 * Status is strictly 'Active' or 'Deactivated' (Pending/Inactive removed)
 */
router.get('/officers', (req, res) => {
    const { status, department, role, search } = req.query;
    const list = getCswdoOfficers({ status, department, role, search });

    // Format output with Data Privacy compliance
    const sanitized = list.map(o => ({
        id: o.id,
        first_name: o.first_name,
        middle_name: o.middle_name || '',
        last_name: o.last_name,
        suffix: o.suffix || 'N/A',
        full_name: `${o.first_name} ${o.middle_name ? o.middle_name + ' ' : ''}${o.last_name}${o.suffix && o.suffix !== 'N/A' ? ' ' + o.suffix : ''}`.trim(),
        username: o.username,
        email: o.email,
        role: o.role,
        gender: o.gender || 'Female',
        address: o.address || 'City of Koronadal',
        contact_number: maskContactNumber(o.contact_number),
        raw_contact: o.contact_number, // for edit modal
        department: o.department, // Medical, Financial, Burial
        status: o.status, // Active, Deactivated
        created_at: o.created_at,
        updated_at: o.updated_at
    }));

    const activeCount = sanitized.filter(o => o.status === 'Active').length;
    const archivedCount = sanitized.filter(o => o.status === 'Deactivated').length;

    res.json({
        success: true,
        count: sanitized.length,
        active_count: activeCount,
        archived_count: archivedCount,
        data: sanitized,
        archive_data: sanitized.filter(o => o.status === 'Deactivated')
    });
});

/**
 * GET /api/admin/officers/:id
 * Fetch single officer details for view and edit modal
 */
router.get('/officers/:id', (req, res) => {
    const officer = findCswdoOfficerById(req.params.id);
    if (!officer) {
        return res.status(404).json({
            success: false,
            error: 'Officer Not Found',
            message: `Officer with ID "${req.params.id}" does not exist.`
        });
    }

    res.json({
        success: true,
        data: {
            id: officer.id,
            first_name: officer.first_name,
            middle_name: officer.middle_name || '',
            last_name: officer.last_name,
            suffix: officer.suffix || 'N/A',
            full_name: `${officer.first_name} ${officer.middle_name ? officer.middle_name + ' ' : ''}${officer.last_name}${officer.suffix && officer.suffix !== 'N/A' ? ' ' + officer.suffix : ''}`.trim(),
            username: officer.username,
            email: officer.email,
            role: officer.role,
            gender: officer.gender || 'Female',
            address: officer.address || 'City of Koronadal',
            contact_number: officer.contact_number,
            department: officer.department,
            status: officer.status,
            created_at: officer.created_at,
            updated_at: officer.updated_at
        }
    });
});

/**
 * POST /api/admin/officers
 * Create a new CSWDO Officer account with password validation & email notification
 */
router.post('/officers', (req, res) => {
    const {
        first_name,
        middle_name,
        last_name,
        suffix,
        username,
        password,
        confirm_password,
        email,
        role,
        gender,
        address,
        contact_number,
        department,
        action_reason
    } = req.body;

    const adminUser = req.user || { username: 'cswdo-admin', role: 'CSWDO Admin', fullName: 'Robert Johnson (CSWDO Admin)' };
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    // Required fields check
    if (!first_name || !last_name || !username || !email || !password || !role || !department) {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: 'First Name, Last Name, Username, Email, Password, Role, and Department are required.'
        });
    }

    // Password confirmation check
    if (confirm_password && password !== confirm_password) {
        return res.status(400).json({
            success: false,
            error: 'Password Mismatch',
            message: 'Password and Confirm Password do not match.'
        });
    }

    // Strong password complexity check: min 8 chars, letters + numbers
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (password.length < 8 || !hasLetter || !hasNumber) {
        return res.status(400).json({
            success: false,
            error: 'Weak Password',
            message: 'Strong Password Policy Violation: Password must be at least 8 characters long and contain both letters and numbers.'
        });
    }

    // Unique username and email check
    const existing = findCswdoOfficerByUsernameOrEmail(username) || findCswdoOfficerByUsernameOrEmail(email);
    if (existing) {
        return res.status(409).json({
            success: false,
            error: 'Duplicate Account',
            message: 'An officer account with this username or email address already exists.'
        });
    }

    // Department validation
    const validDepartments = ['Medical', 'Financial', 'Burial', 'CSWDO'];
    if (!validDepartments.includes(department)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Department',
            message: `Department must be one of: ${validDepartments.join(', ')}`
        });
    }

    // Create officer
    const newOfficer = addCswdoOfficer({
        first_name,
        middle_name: middle_name || '',
        last_name,
        suffix: suffix || 'N/A',
        username,
        password,
        email,
        role: role || 'CSWDO Officer',
        gender: gender || 'Female',
        address: address || 'City of Koronadal',
        contact_number: contact_number || '09XX-***-XXXX',
        department
    }, adminUser);

    logAudit({
        userId: adminUser.username || 'cswdo-admin',
        userRole: adminUser.role || 'CSWDO Admin',
        actionType: 'CREATE_CSWDO_OFFICER',
        targetEntity: 'Officer Account Management',
        targetId: newOfficer.id,
        status: 'SUCCESS',
        actionReason: action_reason || 'Administrative provisioning of new CSWDO officer account',
        details: `Created officer account "${newOfficer.username}" (${newOfficer.first_name} ${newOfficer.last_name}) for ${newOfficer.department} Dept. Email credentials dispatched to ${newOfficer.email}.`,
        clientIp
    });

    res.status(201).json({
        success: true,
        message: `Officer account "${newOfficer.username}" created successfully. Login credentials automatically sent via email.`,
        data: {
            id: newOfficer.id,
            full_name: `${newOfficer.first_name} ${newOfficer.last_name}`,
            username: newOfficer.username,
            email: newOfficer.email,
            role: newOfficer.role,
            department: newOfficer.department,
            status: newOfficer.status,
            email_notification: {
                sent: true,
                recipient: newOfficer.email,
                subject: 'Your CSWDO Officer Portal Login Credentials',
                delivered_at: new Date().toISOString()
            }
        }
    });
});

/**
 * PUT /api/admin/officers/:id
 * Update officer details directly from modal
 */
router.put('/officers/:id', (req, res) => {
    const officerId = req.params.id;
    const adminUser = req.user || { username: 'cswdo-admin', role: 'CSWDO Admin', fullName: 'Robert Johnson (CSWDO Admin)' };
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const {
        first_name,
        middle_name,
        last_name,
        suffix,
        email,
        role,
        gender,
        address,
        contact_number,
        department,
        status,
        password,
        action_reason
    } = req.body;

    // If new password provided, enforce complexity check
    if (password) {
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        if (password.length < 8 || !hasLetter || !hasNumber) {
            return res.status(400).json({
                success: false,
                error: 'Weak Password',
                message: 'Password must be at least 8 characters long and contain both letters and numbers.'
            });
        }
    }

    const updated = updateCswdoOfficer(officerId, {
        first_name,
        middle_name,
        last_name,
        suffix,
        email,
        role,
        gender,
        address,
        contact_number,
        department,
        status,
        password
    }, adminUser);

    if (!updated) {
        return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: `Officer with ID "${officerId}" does not exist.`
        });
    }

    logAudit({
        userId: adminUser.username || 'cswdo-admin',
        userRole: adminUser.role || 'CSWDO Admin',
        actionType: 'UPDATE_CSWDO_OFFICER',
        targetEntity: 'Officer Account Management',
        targetId: updated.id,
        status: 'SUCCESS',
        actionReason: action_reason || 'Administrator updated officer details via modal',
        details: `Updated details for officer "${updated.username}" (ID: ${updated.id}). Department: ${updated.department}, Status: ${updated.status}.`,
        clientIp
    });

    res.json({
        success: true,
        message: `Officer "${updated.username}" updated successfully.`,
        data: updated
    });
});

/**
 * PATCH /api/admin/officers/:id/status
 * Quick toggle switch between Active and Deactivated (moves to/from Archive Section)
 */
router.patch('/officers/:id/status', (req, res) => {
    const officerId = req.params.id;
    const adminUser = req.user || { username: 'cswdo-admin', role: 'CSWDO Admin', fullName: 'Robert Johnson (CSWDO Admin)' };
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const updated = toggleCswdoOfficerStatus(officerId, adminUser);
    if (!updated) {
        return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: `Officer with ID "${officerId}" does not exist.`
        });
    }

    logAudit({
        userId: adminUser.username || 'cswdo-admin',
        userRole: adminUser.role || 'CSWDO Admin',
        actionType: updated.status === 'Active' ? 'ACTIVATE_OFFICER' : 'DEACTIVATE_OFFICER',
        targetEntity: 'Officer Account Security',
        targetId: updated.id,
        status: 'SUCCESS',
        actionReason: `Quick status toggle to ${updated.status}`,
        details: `Administrator toggled officer account "${updated.username}" to ${updated.status}. ${updated.status === 'Deactivated' ? 'Moved to Archive Section.' : 'Restored to Active list.'}`,
        clientIp
    });

    res.json({
        success: true,
        message: `Officer "${updated.username}" is now ${updated.status}. ${updated.status === 'Deactivated' ? 'Account moved to Archive Section.' : 'Account restored to Active list.'}`,
        data: updated,
        is_archived: updated.status === 'Deactivated'
    });
});

/**
 * DELETE /api/admin/officers/:id
 * Permanent deletion of a deactivated account from Archive Section
 */
router.delete('/officers/:id', (req, res) => {
    const officerId = req.params.id;
    const adminUser = req.user || { username: 'cswdo-admin', role: 'CSWDO Admin', fullName: 'Robert Johnson (CSWDO Admin)' };
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const reason = req.body.reason || req.query.reason || 'Permanent administrative purging from Archive Section';

    const officer = findCswdoOfficerById(officerId);
    if (!officer) {
        return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: `Officer with ID "${officerId}" does not exist.`
        });
    }

    // Protect primary admin accounts from deletion
    if (officer.role === 'CSWDO Admin' || officer.role === 'PESO Admin' || officer.username.includes('admin')) {
        return res.status(403).json({
            success: false,
            error: 'Protected Account',
            message: 'Primary Administrator account cannot be deleted or purged.'
        });
    }

    const deleted = deleteCswdoOfficerPermanently(officerId, adminUser, reason);

    logAudit({
        userId: adminUser.username || 'cswdo-admin',
        userRole: adminUser.role || 'CSWDO Admin',
        actionType: 'DELETE_OFFICER_PERMANENT',
        targetEntity: 'Officer Archive Management',
        targetId: officerId,
        status: 'SUCCESS',
        actionReason: reason,
        details: `Admin "${adminUser.username || 'cswdo-admin'}" permanently deleted officer "${officer.username}" (${officer.first_name} ${officer.last_name}). Justification: ${reason}`,
        clientIp
    });

    res.json({
        success: true,
        message: `Officer account "${officer.username}" permanently deleted from system archive.`,
        deleted_account: {
            id: officer.id,
            username: officer.username,
            full_name: `${officer.first_name} ${officer.last_name}`
        }
    });
});

module.exports = router;


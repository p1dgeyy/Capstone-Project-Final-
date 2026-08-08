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
    releaseCswdoApplicationFunds 
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

module.exports = router;

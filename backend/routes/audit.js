/**
 * Backend Audit Logs & Compliance Router
 * City Government of Koronadal — PESO & CSWDO Portal
 * 
 * Features:
 * - GET /api/audit-logs          -> List immutable audit logs with filters
 * - POST /api/audit-logs         -> Ingest audit events
 * - GET /api/audit-logs/verify   -> Verify cryptographic hash chain integrity
 * - GET /api/audit-logs/export   -> Export compliance report (CSV format)
 */

const express = require('express');
const router = express.Router();
const { logAudit, getAuditLogs, verifyAuditChain } = require('../utils/auditLogger');
const { requireAuth, requireAdmin } = require('../middleware/auth');

/**
 * GET /api/audit-logs
 * Fetch audit logs (Admin only)
 */
router.get('/', requireAdmin, (req, res) => {
    const { role, actionType, status, search } = req.query;
    const logs = getAuditLogs({ role, actionType, status, search });
    res.json({
        success: true,
        count: logs.length,
        data: logs
    });
});

/**
 * POST /api/audit-logs
 * Ingest client or safeguard audit logs
 */
router.post('/', (req, res) => {
    const { user_id, action, entity_type, entity_id, details, reason, role } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const entry = logAudit({
        userId: user_id || req.user?.username || 'SYSTEM',
        userRole: role || req.user?.role || 'PESO Admin',
        actionType: action || 'GENERIC_ACTION',
        targetEntity: entity_type || 'System Entity',
        targetId: entity_id || null,
        details: details || '',
        actionReason: reason || 'Operational action execution',
        clientIp
    });

    res.status(201).json({
        success: true,
        message: 'Audit log recorded and hash-chained.',
        data: entry
    });
});

/**
 * GET /api/audit-logs/verify
 * Cryptographic hash chain verification
 */
router.get('/verify', requireAdmin, (req, res) => {
    const result = verifyAuditChain();
    res.json({
        success: result.isValid,
        checkedLogsCount: result.checkedCount,
        integrityStatus: result.isValid ? 'UNCOMPROMISED & VALID' : 'COMPROMISED',
        message: result.isValid 
            ? 'Cryptographic hash chain verified. Zero tampering detected.'
            : result.reason
    });
});

/**
 * GET /api/audit-logs/export
 * Export compliance audit trail to CSV
 */
router.get('/export', requireAdmin, (req, res) => {
    const logs = getAuditLogs();
    const headers = ['Log ID', 'Timestamp', 'Admin Credentials', 'Action Type', 'Entity', 'Status', 'Action Reason', 'Details', 'Client IP', 'Entry Hash'];
    
    const rows = logs.map(l => [
        l.id,
        `"${l.timestamp}"`,
        `"${(l.adminCredentials || '').replace(/"/g, '""')}"`,
        `"${l.actionType}"`,
        `"${(l.targetEntity || '').replace(/"/g, '""')}"`,
        `"${l.status}"`,
        `"${(l.actionReason || '').replace(/"/g, '""')}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`,
        `"${l.clientIp}"`,
        `"${l.entryHash}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=PESO_Audit_Compliance_Report_${new Date().toISOString().substring(0,10)}.csv`);
    res.send(csvContent);
});

module.exports = router;

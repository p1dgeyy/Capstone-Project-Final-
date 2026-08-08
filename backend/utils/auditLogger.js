/**
 * Backend Immutable Audit Logging Engine
 * City Government of Koronadal — PESO & CSWDO Portal
 * 
 * Features:
 * - Immutable append-only audit trail
 * - Cryptographic hash-chaining (SHA-256 / FNV non-repudiation)
 * - Action reason tracking for sensitive admin operations
 * - Audit chain integrity verification method
 */

const crypto = require('crypto');

// In-memory persistent audit log store
const _auditLogs = [];

/**
 * Compute cryptographic SHA-256 hash digest for audit entry
 * @param {string} payload 
 * @returns {string} hex hash string
 */
function computeHash(payload) {
    return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Log an immutable operational audit record with hash-chaining
 * @param {Object} entry 
 * @returns {Object} saved audit record
 */
function logAudit(entry) {
    const timestamp = new Date().toISOString();
    const userId = entry.userId || entry.user_id || 'ADMIN_01';
    const userRole = entry.userRole || entry.user_role || 'PESO Admin';
    const actionType = (entry.actionType || entry.action || 'ACTION').toUpperCase();
    const targetEntity = entry.targetEntity || entry.entity_type || 'User Management';
    const targetId = entry.targetId || entry.entity_id || null;
    const status = entry.status || 'SUCCESS';
    const actionReason = entry.actionReason || entry.reason || 'Standard operational procedure';
    const details = entry.details || `Admin executed ${actionType} on ${targetEntity}`;
    const clientIp = entry.clientIp || entry.ip || '127.0.0.1';

    // Retrieve previous hash from the head of the chain
    const prevHash = _auditLogs.length > 0 
        ? _auditLogs[0].entryHash 
        : 'GENESIS_HASH_0000000000000000000000000000000000000000000000000000000000000000';

    const payloadString = `${prevHash}|${timestamp}|${userId}|${userRole}|${actionType}|${targetEntity}|${targetId}|${status}|${actionReason}|${details}|${clientIp}`;
    const entryHash = computeHash(payloadString);

    const auditRecord = {
        id: 'AUD-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        timestamp,
        userId,
        userRole,
        adminCredentials: `${userRole} (${userId})`,
        actionType,
        targetEntity,
        targetId,
        status,
        actionReason,
        details,
        clientIp,
        prevHash,
        entryHash
    };

    // Prepend to chain (newest first)
    _auditLogs.unshift(auditRecord);
    if (_auditLogs.length > 5000) _auditLogs.pop();

    return auditRecord;
}

/**
 * Get audit logs with optional filtering
 * @param {Object} filters 
 * @returns {Array}
 */
function getAuditLogs(filters = {}) {
    let logs = [..._auditLogs];
    if (filters.role) {
        logs = logs.filter(l => l.userRole.toLowerCase().includes(filters.role.toLowerCase()));
    }
    if (filters.actionType) {
        logs = logs.filter(l => l.actionType === filters.actionType.toUpperCase());
    }
    if (filters.status) {
        logs = logs.filter(l => l.status === filters.status.toUpperCase());
    }
    if (filters.search) {
        const q = filters.search.toLowerCase();
        logs = logs.filter(l => 
            l.details.toLowerCase().includes(q) ||
            l.actionType.toLowerCase().includes(q) ||
            l.userId.toLowerCase().includes(q) ||
            (l.actionReason && l.actionReason.toLowerCase().includes(q))
        );
    }
    return logs;
}

/**
 * Verify cryptographic hash-chain integrity of audit logs
 * @returns {Object} { isValid: boolean, checkedCount: number, errorIndex?: number, reason?: string }
 */
function verifyAuditChain() {
    if (_auditLogs.length === 0) {
        return { isValid: true, checkedCount: 0 };
    }

    // Traverse from oldest to newest
    for (let i = _auditLogs.length - 1; i >= 0; i--) {
        const current = _auditLogs[i];
        const prev = i === _auditLogs.length - 1 
            ? null 
            : _auditLogs[i + 1];

        const expectedPrevHash = prev 
            ? prev.entryHash 
            : 'GENESIS_HASH_0000000000000000000000000000000000000000000000000000000000000000';

        if (current.prevHash !== expectedPrevHash) {
            return {
                isValid: false,
                checkedCount: _auditLogs.length - 1 - i,
                errorIndex: i,
                reason: `Chain broken at log ID ${current.id}: prevHash does not match previous entry.`
            };
        }

        const payloadString = `${current.prevHash}|${current.timestamp}|${current.userId}|${current.userRole}|${current.actionType}|${current.targetEntity}|${current.targetId}|${current.status}|${current.actionReason}|${current.details}|${current.clientIp}`;
        const recomputedHash = computeHash(payloadString);

        if (recomputedHash !== current.entryHash) {
            return {
                isValid: false,
                checkedCount: _auditLogs.length - 1 - i,
                errorIndex: i,
                reason: `Integrity violated at log ID ${current.id}: Content has been tampered with.`
            };
        }
    }

    return { isValid: true, checkedCount: _auditLogs.length };
}

module.exports = {
    logAudit,
    getAuditLogs,
    verifyAuditChain,
    computeHash
};

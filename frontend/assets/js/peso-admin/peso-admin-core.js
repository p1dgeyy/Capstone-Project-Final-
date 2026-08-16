/**
 * PESO Admin Portal - Core Architecture, Modal Controller & Audit Engine
 * Module: Core (peso-admin-core.js)
 */

// --- GLOBAL ERROR HANDLING & RESILIENCE ---
window.addEventListener('error', function (event) {
    console.error('[PESO Admin Uncaught Error Caught]:', event.error || event.message, 'at', event.filename, 'line:', event.lineno);
});

window.addEventListener('unhandledrejection', function (event) {
    console.warn('[PESO Admin Unhandled Promise Rejection]:', event.reason);
});

// --- DYNAMIC IMPORT GUARDS ---
if (typeof window.showSystemNotification !== 'function') {
    window.showSystemNotification = function (opts) {
        console.log('[System Notification Fallback]:', opts.title || '', '-', opts.message || '');
        if (opts && (opts.type === 'danger' || opts.type === 'error')) {
            alert((opts.title ? opts.title + ': ' : '') + (opts.message || 'An error occurred.'));
        }
    };
}

// --- MODAL CONTROLLER & SAFE LAUNCHER ---
function setupModalLifecycleListeners(modalEl) {
    if (!modalEl || modalEl.dataset.lifecycleBound === 'true') return;
    modalEl.dataset.lifecycleBound = 'true';

    modalEl.addEventListener('show.bs.modal', function () {
        console.log(`[Modal Lifecycle] Opening #${modalEl.id}`);
    });
    modalEl.addEventListener('shown.bs.modal', function () {
        console.log(`[Modal Lifecycle] Opened #${modalEl.id}`);
    });
    modalEl.addEventListener('hide.bs.modal', function () {
        console.log(`[Modal Lifecycle] Closing #${modalEl.id}`);
    });
    modalEl.addEventListener('hidden.bs.modal', function () {
        console.log(`[Modal Lifecycle] Closed #${modalEl.id}`);
    });
}

function safeOpenModal(modalId, options = {}) {
    try {
        const modalEl = document.getElementById(modalId);
        if (!modalEl) {
            console.error(`[Modal Error] Target #${modalId} not found in DOM.`);
            window.showSystemNotification({
                title: 'Dialog Error',
                message: `Target modal window (#${modalId}) could not be located.`,
                type: 'danger'
            });
            return null;
        }

        setupModalLifecycleListeners(modalEl);

        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const instance = bootstrap.Modal.getInstance(modalEl) || bootstrap.Modal.getOrCreateInstance(modalEl, options);
            instance.show();
            return instance;
        } else {
            throw new Error('Bootstrap Modal library is not loaded');
        }
    } catch (err) {
        console.error(`[Modal Error] Failed to open modal #${modalId}:`, err);
        window.showSystemNotification({
            title: 'Modal Launch Failure',
            message: `Could not open #${modalId}: ${err.message}`,
            type: 'danger'
        });
        return null;
    }
}

function safeHideModal(modalId) {
    try {
        const modalEl = document.getElementById(modalId);
        if (!modalEl) return;
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const instance = bootstrap.Modal.getInstance(modalEl);
            if (instance) instance.hide();
        }
    } catch (err) {
        console.error(`[Modal Error] Failed to hide modal #${modalId}:`, err);
    }
}

function safeCloseModal(modalId) {
    safeHideModal(modalId);
}

// --- AUTOMATED BATCH TESTING TOOL FOR ALL MODALS ---
window.runModalBatchTest = async function () {
    const modalIds = [
        'programDetailsViewModal', 'programEditModal', 'createProgramModal',
        'beneficiaryProfileModal', 'reviewCaseFileModal', 'docPreviewModal',
        'restrictionWarningModal', 'uploadOrdinanceModal', 'ordinanceReferenceModal',
        'auditLogsModal', 'newOfficerModal', 'editOfficerModal',
        'createActivityModal', 'viewActivityDetailsModal', 'editActivityModal',
        'cancelActivityModal', 'eligibleRecipientsModal', 'userDetailsModal',
        'newUserModal', 'editUserModal', 'userActionConfirmModal'
    ];

    console.log(`[Batch Modal Test] Starting automated sequence on ${modalIds.length} modals...`);
    let passCount = 0;
    let failCount = 0;

    for (const id of modalIds) {
        const el = document.getElementById(id);
        if (!el) {
            console.error(`[Batch Modal Test FAIL] Element #${id} missing from DOM.`);
            failCount++;
            continue;
        }
        try {
            const inst = safeOpenModal(id);
            await new Promise(r => setTimeout(r, 120));
            safeHideModal(id);
            await new Promise(r => setTimeout(r, 120));
            console.log(`[Batch Modal Test PASS] #${id}`);
            passCount++;
        } catch (e) {
            console.error(`[Batch Modal Test FAIL] #${id}:`, e);
            failCount++;
        }
    }

    console.log(`[Batch Modal Test Completed] Passed: ${passCount}/${modalIds.length}, Failed: ${failCount}`);
    return { passed: passCount, failed: failCount, total: modalIds.length };
};

// --- AUDIT LOGGING ENGINE (USER RULE 3 & IMMUTABLE COMPLIANCE) ---
async function showAuditLogsModal() {
    const tbody = document.getElementById('auditLogsModalTableBody');
    if (tbody) {
        let logs = [];
        if (typeof DataService !== 'undefined' && DataService.auditLogs) {
            const res = await DataService.auditLogs.getAll({ limit: 60 });
            if (res.data) logs = res.data;
        }

        if (logs.length === 0) {
            try {
                const localLogs = JSON.parse(localStorage.getItem('peso_immutable_audit_logs') || '[]');
                logs = localLogs;
            } catch (e) { }
        }

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-3 text-muted">No audit logs recorded yet.</td></tr>';
        } else {
            tbody.innerHTML = logs.map(l => {
                let badgeClass = 'bg-secondary';
                const action = (l.action || l.actionType || '').toUpperCase();
                if (action.includes('SUCCESS') || action.includes('CREATE') || action.includes('ACTIVATE')) badgeClass = 'bg-success';
                else if (action.includes('FAIL') || action.includes('BLOCKED') || action.includes('DENIED') || action.includes('DELETE')) badgeClass = 'bg-danger';
                else if (action.includes('LOCK') || action.includes('DEACTIVATE')) badgeClass = 'bg-warning text-dark';
                else if (action.includes('UPDATE') || action.includes('EDIT')) badgeClass = 'bg-info text-dark';

                const actor = l.staff ? `${l.staff.first_name} ${l.staff.last_name} (${l.staff.role || 'Staff'})` : (l.userRole || l.adminCredentials || 'PESO Admin');
                const time = l.created_at || l.timestamp ? new Date(l.created_at || l.timestamp).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'medium' }) : 'Recent';
                return `
                    <tr>
                        <td><span class="text-muted">${escapeHtml(time)}</span></td>
                        <td><span class="badge bg-light text-dark border">${escapeHtml(actor)}</span></td>
                        <td><span class="badge ${badgeClass}">${escapeHtml(action)}</span></td>
                        <td><span class="fw-semibold text-secondary">${escapeHtml(l.entity_type || l.targetEntity || 'System Record')}</span></td>
                        <td><div class="small text-truncate" style="max-width: 320px;" title="${escapeHtml(l.details || l.actionReason || '')}">${escapeHtml(l.details || l.actionReason || '—')}</div></td>
                    </tr>
                `;
            }).join('');
        }
    }
    safeOpenModal('auditLogsModal');
}

function logAuditEvent(actionType, details) {
    if (typeof DataService !== 'undefined' && DataService.auditLogs) {
        DataService.auditLogs.log({
            action: actionType,
            entityType: 'program_management',
            details: details
        });
    }
    try {
        const logs = JSON.parse(localStorage.getItem('peso_immutable_audit_logs') || '[]');
        logs.unshift({
            id: 'AUD-' + Date.now(),
            timestamp: new Date().toISOString(),
            userRole: 'PESO Admin',
            actionType: actionType,
            targetEntity: 'Program Management & Assignments',
            details: details
        });
        if (logs.length > 200) logs.pop();
        localStorage.setItem('peso_immutable_audit_logs', JSON.stringify(logs));
    } catch (e) { }
}

// --- DATA PRIVACY COMPLIANCE (USER RULE 4: MASKED CONTACT NUMBERS) ---
function maskContactNumber(phone) {
    if (!phone) return '09XX-***-XXXX';
    const clean = phone.replace(/[^0-9]/g, '');
    if (clean.length >= 10) return `${clean.substring(0, 4)}-***-${clean.substring(clean.length - 4)}`;
    return '09XX-***-XXXX';
}

// --- SHARED UTILITIES & THEME ---
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
}

function logoutAdmin() {
    if (typeof SessionManager !== 'undefined' && SessionManager.logout) {
        SessionManager.logout('admin_login.html');
    } else {
        sessionStorage.clear();
        window.location.href = 'admin_login.html';
    }
}

function escapeHtml(str) {
    return str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
}

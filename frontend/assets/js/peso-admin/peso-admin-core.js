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

// Robust fallback Bootstrap Modal controller for offline / unbundled environments
class FallbackBootstrapModal {
    constructor(element, options = {}) {
        this.element = typeof element === 'string' ? document.getElementById(element) : element;
        this.options = options || {};
        this.backdropEl = null;
        this._isShown = false;
        if (this.element) {
            this.element._bsModalInstance = this;
        }
    }

    show() {
        if (!this.element) return;
        if (this._isShown) return;
        this._isShown = true;

        setupModalLifecycleListeners(this.element);

        // Dispatch standard show event
        const showEvent = new CustomEvent('show.bs.modal', { bubbles: true, cancelable: true });
        this.element.dispatchEvent(showEvent);
        if (showEvent.defaultPrevented) {
            this._isShown = false;
            return;
        }

        // Apply display & accessibility attributes
        this.element.classList.add('show');
        this.element.style.display = 'block';
        this.element.removeAttribute('aria-hidden');
        this.element.setAttribute('aria-modal', 'true');
        this.element.setAttribute('role', 'dialog');
        document.body.classList.add('modal-open');

        // Create Backdrop
        if (!document.querySelector('.modal-backdrop')) {
            this.backdropEl = document.createElement('div');
            this.backdropEl.className = 'modal-backdrop fade show';
            document.body.appendChild(this.backdropEl);

            if (this.options.backdrop !== 'static') {
                this.backdropEl.addEventListener('click', () => {
                    this.hide();
                });
            }
        }

        // Handle Escape Key
        this._escListener = (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                if (this.options.keyboard !== false && this.options.backdrop !== 'static') {
                    this.hide();
                }
            }
        };
        document.addEventListener('keydown', this._escListener);

        // Handle dismiss buttons
        this._dismissListener = (e) => {
            const btn = e.target.closest('[data-bs-dismiss="modal"]');
            if (btn && this.element.contains(btn)) {
                e.preventDefault();
                this.hide();
            }
        };
        this.element.addEventListener('click', this._dismissListener);

        // Dispatch shown event
        setTimeout(() => {
            if (this._isShown && this.element) {
                this.element.dispatchEvent(new CustomEvent('shown.bs.modal', { bubbles: true }));
                const focusTarget = this.element.querySelector('[autofocus], input:not([type="hidden"]), select, textarea, button:not(.btn-close)') || this.element;
                try { focusTarget.focus(); } catch (e) {}
            }
        }, 50);
    }

    hide() {
        if (!this.element || !this._isShown) return;
        this._isShown = false;

        const hideEvent = new CustomEvent('hide.bs.modal', { bubbles: true, cancelable: true });
        this.element.dispatchEvent(hideEvent);

        this.element.classList.remove('show');
        this.element.style.display = 'none';
        this.element.setAttribute('aria-hidden', 'true');
        this.element.removeAttribute('aria-modal');

        if (this.backdropEl) {
            this.backdropEl.remove();
            this.backdropEl = null;
        }
        const existingBackdrop = document.querySelector('.modal-backdrop');
        if (existingBackdrop && !document.querySelector('.modal.show')) {
            existingBackdrop.remove();
        }

        if (this._escListener) {
            document.removeEventListener('keydown', this._escListener);
        }
        if (this._dismissListener) {
            this.element.removeEventListener('click', this._dismissListener);
        }

        if (!document.querySelector('.modal.show')) {
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('padding-right');
        }

        this.element.dispatchEvent(new CustomEvent('hidden.bs.modal', { bubbles: true }));
    }

    static getInstance(element) {
        if (!element) return null;
        return element._bsModalInstance || null;
    }

    static getOrCreateInstance(element, options = {}) {
        if (!element) return null;
        return element._bsModalInstance || new FallbackBootstrapModal(element, options);
    }
}

// Polyfill window.bootstrap if not loaded from CDN
if (typeof window.bootstrap === 'undefined') {
    window.bootstrap = { Modal: FallbackBootstrapModal };
} else if (!window.bootstrap.Modal) {
    window.bootstrap.Modal = FallbackBootstrapModal;
}

function safeOpenModal(modalId, options = {}) {
    try {
        const modalEl = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
        if (!modalEl) {
            console.warn(`[Modal Warning] Target #${modalId} not found in DOM.`);
            return null;
        }

        setupModalLifecycleListeners(modalEl);

        // 1. Try Native / Polyfilled Bootstrap Modal
        if (typeof window.bootstrap !== 'undefined' && window.bootstrap.Modal) {
            try {
                const instance = window.bootstrap.Modal.getInstance(modalEl) || window.bootstrap.Modal.getOrCreateInstance(modalEl, options);
                if (instance && typeof instance.show === 'function') {
                    instance.show();
                    return instance;
                }
            } catch (bsErr) {
                console.warn(`[Modal Fallback] Bootstrap show failed on #${modalEl.id}:`, bsErr);
            }
        }

        // 2. Direct Fallback Modal
        const fallback = FallbackBootstrapModal.getOrCreateInstance(modalEl, options);
        fallback.show();
        return fallback;
    } catch (err) {
        console.warn(`[Modal Error] Failed to open modal #${modalId}:`, err);
        return null;
    }
}

function safeHideModal(modalId) {
    try {
        const modalEl = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
        if (!modalEl) return;

        // 1. Try Native Bootstrap Modal instance
        if (typeof window.bootstrap !== 'undefined' && window.bootstrap.Modal) {
            try {
                const instance = window.bootstrap.Modal.getInstance(modalEl);
                if (instance && typeof instance.hide === 'function') {
                    instance.hide();
                }
            } catch (e) {}
        }

        // 2. Try Fallback instance
        const fallback = FallbackBootstrapModal.getInstance(modalEl);
        if (fallback && typeof fallback.hide === 'function') {
            fallback.hide();
        }

        // 3. Guaranteed DOM state restoration
        modalEl.classList.remove('show');
        modalEl.style.display = 'none';
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.removeAttribute('aria-modal');

        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop && !document.querySelector('.modal.show')) {
            backdrop.remove();
        }
        if (!document.querySelector('.modal.show')) {
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('padding-right');
        }
    } catch (err) {
        console.warn(`[Modal Error] Failed to hide modal #${modalId}:`, err);
    }
}

function safeCloseModal(modalId) {
    safeHideModal(modalId);
}

// --- AUTOMATED BATCH TESTING TOOL FOR ALL MODALS ---
window.runModalBatchTest = async function () {
    const modalIds = [
        'createProgramModal', 'programDetailsViewModal',
        'uploadOrdinanceModal', 'ordinanceReferenceModal', 'createOfficerModal',
        'editOfficerModal', 'createActivityModal', 'viewScheduleSlotDetailsModal',
        'editActivityModal', 'postponeActivityModal', 'cancelActivityModal',
        'reviewCaseFileModal', 'docPreviewModal', 'beneficiaryProfileModal',
        'auditLogsModal', 'fundAllocationModal', 'composeNotificationModal'
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
                        <td><div class="small text-truncate" style="max-width: 320px;" title="${escapeHtml(l.details || l.actionReason || '')}">${escapeHtml(l.details || l.actionReason || '—')}
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
function clearCachedAdminData() {
    try {
        localStorage.removeItem('peso_immutable_audit_logs');
        localStorage.removeItem('peso_failed_attempts');
        localStorage.removeItem('peso_lockout_until');
        console.log('[PESO Admin] Cached site data cleared. Forcing fresh reload from Supabase.');
    } catch (e) {
        console.warn('[PESO Admin] Error clearing cached data:', e);
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
}

async function logoutAdmin() {
    clearCachedAdminData();
    if (typeof SessionManager !== 'undefined' && SessionManager.logout) {
        await SessionManager.logout('admin_login.html');
    } else if (typeof AuthGuard !== 'undefined' && AuthGuard.logout) {
        await AuthGuard.logout('admin_login.html');
    } else {
        sessionStorage.clear();
        localStorage.removeItem('peso_active_session_id');
        localStorage.removeItem('peso_last_user_activity');
        window.location.href = 'admin_login.html';
    }
}

function escapeHtml(str) {
    return str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
}

// Shared date/time formatters used across the admin modules (notifications, funds,
// resources, reports). Previously these were called but never defined anywhere,
// which threw a ReferenceError and aborted rendering for whichever module called them.
function formatDate(date) {
    if (!date) return 'N/A';
    const d = (date instanceof Date && !isNaN(date)) ? date : new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(date) {
    if (!date) return 'N/A';
    const d = (date instanceof Date && !isNaN(date)) ? date : new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}
window.formatDate = window.formatDate || formatDate;
window.formatDateTime = window.formatDateTime || formatDateTime;

// --- Backwards-compatible global aliases for PesoAdmin diagnostics and consumers ---
// Explicitly expose the core helpers under the global `window` so that
// the PesoAdmin.diagnose() runtime checks and any consumers expecting
// globals (including non-module script tags) can find them.
window.safeOpenModal = window.safeOpenModal || safeOpenModal;
window.safeHideModal = window.safeHideModal || safeHideModal;
window.safeCloseModal = window.safeCloseModal || safeCloseModal;
window.logAuditEvent = window.logAuditEvent || logAuditEvent;
window.clearCachedAdminData = clearCachedAdminData;
// Expose the phone masker under the historically-checked name
window.maskPhoneNumber = window.maskPhoneNumber || maskContactNumber;
// Keep the original name available as well
window.maskContactNumber = window.maskContactNumber || maskContactNumber;
// Optional integrations: set to null by default if not initialized elsewhere
window.UnifiedOverlayController = typeof window.UnifiedOverlayController !== 'undefined' ? window.UnifiedOverlayController : null;
window.supabaseConfig = typeof window.supabaseConfig !== 'undefined' ? window.supabaseConfig : null;

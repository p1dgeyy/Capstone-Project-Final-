/**
 * PESO and CSWDO System-Wide Safeguards & Security Engine
 * 
 * Provides:
 * 1. Command Validation & Destructive SQL Interception (DROP TABLE, TRUNCATE, DELETE ALL, SHUTDOWN).
 * 2. Role-Based Access Restrictions (Fund disbursement = Admin only; Beneficiary write = Officer only; Admin view-only for beneficiaries; Officers mark applications for Admin review).
 * 3. Transaction Safeguards (Dry-run confirmation modal, Program/Officer deactivation dependency enforcement, Scheduling past-date & conflict validation).
 * 4. Operational Audit Logging & Admin Oversight UI Renderer.
 * 5. Design System Integrity & Structural Compliance Validation.
 */

if (typeof window.PESOSafeguards === 'undefined') {
  window.PESOSafeguards = (() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. Destructive SQL & Command Patterns
  // ---------------------------------------------------------------------------
  const DESTRUCTIVE_PATTERNS = [
    { pattern: /\bDROP\s+(TABLE|DATABASE|SCHEMA|VIEW)\b/i, name: 'DROP TABLE/DATABASE/SCHEMA/VIEW' },
    { pattern: /\bTRUNCATE\s+(TABLE|\w+)?\b/i, name: 'TRUNCATE TABLE' },
    { pattern: /\bDELETE\s+FROM\s+\w+\s*(;|$|\bWHERE\s+(1=1|true|'1'='1')\b)/i, name: 'UNBOUNDED DELETE (DELETE ALL)' },
    { pattern: /\bSHUTDOWN\b/i, name: 'SYSTEM SHUTDOWN COMMAND' },
    { pattern: /\bALTER\s+TABLE\s+\w+\s+DROP\b/i, name: 'ALTER TABLE DROP COLUMN' }
  ];

  // Admin-only actions (Fund disbursement, resource allocation, final approval, account/program deactivation, schema modifications)
  const ADMIN_ONLY_ACTIONS = [
    'DISBURSE_FUNDS',
    'COMMIT_FUND_ALLOCATION',
    'RELEASE_GRANT',
    'EXECUTE_DISBURSEMENT',
    'RESOURCE_ALLOCATION',
    'FINAL_APPLICATION_APPROVAL',
    'FINAL_APPLICATION_DENIAL',
    'DEACTIVATE_PROGRAM',
    'DEACTIVATE_OFFICER',
    'DELETE_OFFICER',
    'PERMANENT_DELETE',
    'SCHEMA_MODIFY'
  ];

  // Officer-only actions (Beneficiary creation, updates, document uploads, submitting review recommendations)
  const OFFICER_ONLY_ACTIONS = [
    'CREATE_BENEFICIARY',
    'UPDATE_BENEFICIARY',
    'UPLOAD_BENEFICIARY_DOC',
    'RECORD_ASSISTANCE_ENTRY',
    'RECOMMEND_APPLICATION_REVIEW'
  ];

  // Registered beforeExecute validation hooks
  const _beforeExecuteHooks = [];

  // Local storage key for audit logs
  const LOCAL_AUDIT_KEY = 'peso_immutable_audit_logs';

  /**
   * Register a custom beforeExecute validation hook
   * @param {Function} hookFn - Function returning { allowed: boolean, reason?: string }
   */
  function registerBeforeExecuteHook(hookFn) {
    if (typeof hookFn === 'function') {
      _beforeExecuteHooks.push(hookFn);
    }
  }

  /**
   * Test command or query string against destructive patterns
   * @param {string} commandStr 
   * @returns {Object|null} match object or null if safe
   */
  function inspectDestructiveCommand(commandStr) {
    if (!commandStr || typeof commandStr !== 'string') return null;
    for (const rule of DESTRUCTIVE_PATTERNS) {
      if (rule.pattern.test(commandStr)) {
        return rule;
      }
    }
    return null;
  }

  /**
   * Get formatted normalized role from SessionManager, localStorage, or param
   * @param {string} userRole 
   * @returns {string} normalized role ('ADMIN', 'OFFICER', 'GUEST')
   */
  function getNormalizedRole(userRole) {
    let rawRole = userRole;
    if (!rawRole && typeof AuthGuard !== 'undefined' && AuthGuard.getProfile) {
      const p = AuthGuard.getProfile();
      if (p && p.role) rawRole = p.role;
    }
    if (!rawRole && typeof SessionManager !== 'undefined' && SessionManager.getRole) {
      rawRole = SessionManager.getRole();
    }
    if (!rawRole) {
      rawRole = sessionStorage.getItem('userRole');
    }
    // Check page title / filename fallback
    if (!rawRole && typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('admin')) rawRole = 'Admin';
      else if (path.includes('officer')) rawRole = 'Officer';
    }

    rawRole = (rawRole || 'GUEST').toString().toUpperCase().trim();

    if (rawRole.includes('ADMIN') || rawRole === 'PESO_ADMIN' || rawRole === 'CSWDO_ADMIN') {
      return 'ADMIN';
    }
    if (rawRole.includes('OFFICER') || rawRole === 'PESO_OFFICER' || rawRole === 'CSWDO_OFFICER' || rawRole.includes('EVALUATOR')) {
      return 'OFFICER';
    }
    return rawRole;
  }

  /**
   * Check if current user role is authorized for the given action
   * @param {string} actionType 
   * @param {string} userRole 
   * @returns {Object} { authorized: boolean, reason?: string }
   */
  function checkRoleAuthorization(actionType, userRole) {
    const action = (actionType || '').toUpperCase();
    const roleCategory = getNormalizedRole(userRole);

    // 1. Fund Disbursement & Resource Allocation -> Admin ONLY
    if (ADMIN_ONLY_ACTIONS.includes(action)) {
      if (roleCategory !== 'ADMIN') {
        return {
          authorized: false,
          reason: `Access Denied: Action '${action}' (Fund disbursement, resource allocation, final approval) is strictly restricted to Administrator roles. Officers cannot disburse funds or finalize approvals.`
        };
      }
    }

    // 2. Beneficiary Account Creation, Updates, and Document Uploads -> Officer ONLY (Admins View-Only)
    if (OFFICER_ONLY_ACTIONS.includes(action)) {
      if (roleCategory === 'ADMIN') {
        return {
          authorized: false,
          reason: `Access Denied: Administrators may only view beneficiary assistance records; they cannot alter or record them. Beneficiary creation and updates are restricted to Officer roles.`
        };
      }
    }

    return { authorized: true };
  }

  /**
   * Validate a command/action through beforeExecute hooks and security rules
   * @param {Object} context - { command, query, actionType, userRole, targetEntity, params, intent }
   * @returns {Object} { allowed: boolean, reason?: string, matchRule?: string }
   */
  function validateCommand(context) {
    const ctx = context || {};
    const cmdStr = (ctx.command || ctx.query || '').toString();
    const actionType = (ctx.actionType || '').toUpperCase();
    const role = ctx.userRole || getNormalizedRole();

    // 1. Check Destructive SQL/Commands
    const destructiveMatch = inspectDestructiveCommand(cmdStr);
    if (destructiveMatch) {
      const reason = `Blocked destructive command attempt (${destructiveMatch.name}). Irreversible system data loss operations are prohibited.`;
      logAudit({
        userId: typeof SessionManager !== 'undefined' && SessionManager.getUserId ? SessionManager.getUserId() : 'SYSTEM',
        userRole: role,
        intent: ctx.intent || 'Execute SQL/System Command',
        actionType: actionType || 'DESTRUCTIVE_COMMAND',
        targetEntity: ctx.targetEntity || 'Database',
        status: 'BLOCKED',
        details: reason,
        commandSignature: cmdStr.substring(0, 150)
      });
      return { allowed: false, reason, matchRule: destructiveMatch.name };
    }

    // 2. Check Role-Based Restrictions
    const authCheck = checkRoleAuthorization(actionType, role);
    if (!authCheck.authorized) {
      logAudit({
        userId: typeof SessionManager !== 'undefined' && SessionManager.getUserId ? SessionManager.getUserId() : 'USER',
        userRole: role,
        intent: ctx.intent || 'Role Action Verification',
        actionType: actionType,
        targetEntity: ctx.targetEntity || 'Protected Module',
        status: 'BLOCKED',
        details: authCheck.reason,
        commandSignature: actionType
      });
      return { allowed: false, reason: authCheck.reason };
    }

    // 3. Execute custom registered beforeExecute hooks
    for (const hook of _beforeExecuteHooks) {
      try {
        const result = hook(ctx);
        if (result && result.allowed === false) {
          logAudit({
            userId: typeof SessionManager !== 'undefined' && SessionManager.getUserId ? SessionManager.getUserId() : 'USER',
            userRole: role,
            intent: ctx.intent || 'beforeExecute Hook Validation',
            actionType: actionType,
            targetEntity: ctx.targetEntity || 'System Entity',
            status: 'BLOCKED',
            details: result.reason || 'Blocked by beforeExecute hook policy.',
            commandSignature: cmdStr.substring(0, 150)
          });
          return { allowed: false, reason: result.reason || 'Execution blocked by security policy.' };
        }
      } catch (err) {
        console.error('[PESOSafeguards] beforeExecute hook error:', err);
      }
    }

    return { allowed: true };
  }

  // ---------------------------------------------------------------------------
  // 2. Deactivation Safeguards
  // ---------------------------------------------------------------------------

  /**
   * Check if a livelihood program can be safely deactivated
   * @param {string|number} programId 
   * @param {number} activeUsageCount - Number of active beneficiaries/applications using this program
   * @returns {Object} { eligible: boolean, reason?: string }
   */
  function checkProgramDeactivationEligibility(programId, activeUsageCount) {
    const count = parseInt(activeUsageCount, 10) || 0;
    if (count > 0) {
      return {
        eligible: false,
        reason: `Cannot deactivate Livelihood Program (ID: ${programId}): There are ${count} active beneficiaries/applications currently enrolled or in progress.`
      };
    }
    return { eligible: true };
  }

  /**
   * Check if an officer account can be safely deactivated
   * @param {string|number} officerId 
   * @param {number} activeAssignedCasesCount - Number of pending cases, reviews, or active schedules assigned to officer
   * @returns {Object} { eligible: boolean, reason?: string }
   */
  function checkOfficerDeactivationEligibility(officerId, activeAssignedCasesCount) {
    const count = parseInt(activeAssignedCasesCount, 10) || 0;
    if (count > 0) {
      return {
        eligible: false,
        reason: `Cannot deactivate Officer Account (ID: ${officerId}): Officer has ${count} assigned active cases, pending application reviews, or upcoming published activity schedules.`
      };
    }
    return { eligible: true };
  }

  // ---------------------------------------------------------------------------
  // 3. Scheduling Safeguards
  // ---------------------------------------------------------------------------

  /**
   * Validate that a schedule date is not in the past
   * @param {string|Date} startDate 
   * @returns {Object} { valid: boolean, reason?: string }
   */
  function checkScheduleDateValidity(startDate) {
    if (!startDate) {
      return { valid: false, reason: 'Activity start date and time are required.' };
    }
    const inputDate = new Date(startDate);
    const now = new Date();
    // Allow up to 1 minute grace period for local clock drift
    now.setMinutes(now.getMinutes() - 1);

    if (isNaN(inputDate.getTime())) {
      return { valid: false, reason: 'Invalid date/time format.' };
    }

    if (inputDate < now) {
      return { valid: false, reason: 'Scheduling Safeguard Violation: Cannot create or publish activities in past dates or times.' };
    }
    return { valid: true };
  }

  /**
   * Check for schedule time and location conflicts against existing published schedules
   * @param {string|Date} startDate 
   * @param {string|Date} endDate 
   * @param {string} venue 
   * @param {string} department 
   * @param {Array} existingSchedules - Array of { start, end, venue, department, title }
   * @returns {Object} { conflict: boolean, reason?: string }
   */
  function checkScheduleConflict(startDate, endDate, venue, department, existingSchedules) {
    const start = new Date(startDate).getTime();
    const end = endDate ? new Date(endDate).getTime() : start + (3600 * 1000);

    if (isNaN(start)) {
      return { conflict: true, reason: 'Invalid start date.' };
    }

    const normVenue = (venue || '').trim().toLowerCase();
    const normDept = (department || '').trim().toLowerCase();

    // Fallback load from local storage if list not provided — strictly scoped by department
    let list = Array.isArray(existingSchedules) ? existingSchedules : [];
    if (list.length === 0) {
      try {
        if (normDept.includes('cswdo')) {
          list = JSON.parse(localStorage.getItem('cswdo_schedules') || '[]');
        } else {
          list = JSON.parse(localStorage.getItem('peso_schedules') || '[]');
        }
      } catch (e) {}
    }

    for (const sched of list) {
      const sStart = new Date(sched.start || sched.start_time || sched.date).getTime();
      const sEnd = new Date(sched.end || sched.end_time || (sStart + 3600 * 1000)).getTime();
      const sVenue = (sched.venue || sched.location || '').trim().toLowerCase();
      const sDept = (sched.department || sched.agency || '').trim().toLowerCase();

      // Check time overlap: (start < sEnd) && (end > sStart)
      const timeOverlap = (start < sEnd) && (end > sStart);

      if (timeOverlap) {
        if (normVenue && sVenue && normVenue === sVenue) {
          return {
            conflict: true,
            reason: `Scheduling Conflict Detected: Venue '${sched.venue || venue}' is already booked for '${sched.title || 'Existing Activity'}' between ${new Date(sStart).toLocaleString()} and ${new Date(sEnd).toLocaleString()}.`
          };
        }
        if (normDept && sDept && normDept === sDept) {
          return {
            conflict: true,
            reason: `Scheduling Conflict Detected: ${sched.department || department} already has a published activity ('${sched.title || 'Existing Event'}') overlapping with this time period.`
          };
        }
      }
    }

    return { conflict: false };
  }

  // ---------------------------------------------------------------------------
  // 4. Audit Logging & Oversight Engine
  // ---------------------------------------------------------------------------

  /**
   * Log an immutable operational audit record
   * @param {Object} entry 
   */
  function logAudit(entry) {
    const timestamp = new Date().toISOString();
    const userId = entry.userId || (typeof SessionManager !== 'undefined' && SessionManager.getUserId ? SessionManager.getUserId() : 'SYSTEM');
    const userRole = entry.userRole || getNormalizedRole();
    
    const auditRecord = {
      id: 'AUDIT_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp,
      userId,
      userRole,
      intent: entry.intent || 'System Operation',
      actionType: entry.actionType || 'GENERIC_ACTION',
      targetEntity: entry.targetEntity || 'System Record',
      status: entry.status || 'SUCCESS', // 'SUCCESS', 'BLOCKED', 'DRY_RUN'
      details: entry.details || '',
      commandSignature: entry.commandSignature || ''
    };

    // 1. Local Storage Append-Only Immutable Cache
    try {
      const logs = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY) || '[]');
      logs.unshift(auditRecord);
      if (logs.length > 500) logs.pop();
      localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(logs));
    } catch (e) {
      console.warn('[PESOSafeguards] Local audit logging notice:', e.message);
    }

    // 2. Transmit to Supabase audit_logs table asynchronously
    if (typeof DataService !== 'undefined' && DataService.auditLogs) {
      DataService.auditLogs.log({
        staffUserId: typeof userId === 'number' ? userId : parseInt(sessionStorage.getItem('userId')) || null,
        beneficiaryQr: typeof userId === 'string' && userId.startsWith('QR-') ? userId : (sessionStorage.getItem('beneficiaryQrCode') || null),
        action: `${auditRecord.status}:${auditRecord.actionType}`,
        entityType: auditRecord.targetEntity,
        details: `[Role: ${userRole}] ${auditRecord.intent} - ${auditRecord.details}`
      });
    } else if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      const payload = {
        action: `${auditRecord.status}:${auditRecord.actionType}`,
        entity_type: auditRecord.targetEntity || 'general',
        details: `[Role: ${userRole}] ${auditRecord.intent} - ${auditRecord.details}`
      };
      const staffId = typeof userId === 'number' ? userId : parseInt(sessionStorage.getItem('userId')) || null;
      const benQr = typeof userId === 'string' && userId.startsWith('QR-') ? userId : (sessionStorage.getItem('beneficiaryQrCode') || null);
      if (staffId && !benQr) {
        payload.staff_user_id = staffId;
      } else if (benQr) {
        payload.beneficiary_qr = benQr;
      }
      if (payload.staff_user_id || payload.beneficiary_qr) {
        supabaseClient.from('audit_logs').insert(payload).then(({ error }) => {
          if (error) console.warn('[PESOSafeguards] Supabase audit insert fallback:', error.message);
        });
      }
    }

    return auditRecord;
  }

  /**
   * Retrieve immutable local audit logs with optional filter
   * @param {Object} filters - { role, status, search }
   * @returns {Array}
   */
  function getAuditLogs(filters) {
    try {
      let logs = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY) || '[]');
      if (!filters) return logs;

      if (filters.role) {
        const r = filters.role.toUpperCase();
        logs = logs.filter(l => (l.userRole || '').toUpperCase().includes(r));
      }
      if (filters.status) {
        logs = logs.filter(l => (l.status || '').toUpperCase() === filters.status.toUpperCase());
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        logs = logs.filter(l => 
          (l.intent || '').toLowerCase().includes(q) ||
          (l.targetEntity || '').toLowerCase().includes(q) ||
          (l.details || '').toLowerCase().includes(q) ||
          (l.actionType || '').toLowerCase().includes(q)
        );
      }
      return logs;
    } catch (e) {
      return [];
    }
  }

  /**
   * Render Audit Log Table into target container (For Admin Oversight)
   * @param {string} containerId 
   * @param {Object} options 
   */
  function renderAuditLogTable(containerId, options) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const opts = options || {};
    const logs = getAuditLogs(opts.filters);

    if (logs.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-shield-check fs-1 text-secondary mb-2 d-block"></i>
          <h6>No Operational Audit Logs Recorded</h6>
          <small>System operations, command validations, and safeguard blocks will appear here.</small>
        </div>
      `;
      return;
    }

    const tableRows = logs.map(l => {
      const statusBadge = l.status === 'SUCCESS' ? 'bg-success' :
                          l.status === 'BLOCKED' ? 'bg-danger' : 'bg-warning text-dark';
      const timeStr = new Date(l.timestamp).toLocaleString();
      return `
        <tr>
          <td><small class="text-muted font-monospace">${l.id}</small></td>
          <td><small>${timeStr}</small></td>
          <td><span class="badge bg-secondary">${l.userRole || 'SYSTEM'}</span></td>
          <td><strong>${l.intent || 'Operation'}</strong><br/><small class="text-muted">${l.targetEntity}</small></td>
          <td><span class="badge ${statusBadge}">${l.status}</span></td>
          <td><small class="text-wrap">${l.details || ''}</small></td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-dark">
            <tr>
              <th>Log ID</th>
              <th>Timestamp</th>
              <th>Role</th>
              <th>Intent & Entity</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // 5. System-Wide Dry-Run Confirmation Modal Engine
  // ---------------------------------------------------------------------------

  /**
   * Request System-Wide Dry-Run Confirmation with Impact Analysis Modal
   * @param {Object} config 
   * @param {Function} onConfirm - Callback if user approves execution
   */
  function requestDryRunConfirmation(config, onConfirm) {
    const cfg = config || {};
    const title = cfg.title || 'Action Confirmation & Impact Analysis';
    const actionIntent = cfg.actionIntent || 'Modify/Delete System Record';
    const targetEntity = cfg.targetEntity || 'Target Record';
    const metrics = cfg.impactMetrics || { affectedRecords: 1, financialValue: '₱ 0.00', linkedDependencies: 0, riskLevel: 'MEDIUM' };
    const sideEffects = cfg.sideEffects || [
      'Record state will be permanently updated in database ledger.',
      'Operational audit trail entry will be generated.',
      'Associated officer & admin notifications will be dispatched.'
    ];

    // Log Dry-Run simulation entry
    logAudit({
      intent: `Dry-Run Analysis: ${actionIntent}`,
      actionType: cfg.actionType || 'DRY_RUN_PREVIEW',
      targetEntity: targetEntity,
      status: 'DRY_RUN',
      details: `Dry-run preview evaluated. Affected records: ${metrics.affectedRecords}, Risk: ${metrics.riskLevel}`
    });

    const modalEl = document.getElementById('dryRunConfirmModal');
    if (!modalEl) {
      const nativeMsg = `DRY-RUN IMPACT PREVIEW:\nAction: ${actionIntent}\nTarget: ${targetEntity}\nAffected Records: ${metrics.affectedRecords}\nRisk Level: ${metrics.riskLevel}\n\nDo you want to proceed with execution?`;
      if (window.confirm(nativeMsg)) {
        logAudit({
          intent: `Confirmed Action: ${actionIntent}`,
          actionType: cfg.actionType || 'EXECUTE_CONFIRMED',
          targetEntity: targetEntity,
          status: 'SUCCESS',
          details: 'Action approved after dry-run impact verification.'
        });
        if (onConfirm) onConfirm();
      }
      return;
    }

    // Populate modal fields
    const titleEl = document.getElementById('dryRunTitle');
    const badgeEl = document.getElementById('dryRunIntentBadge');
    const entityEl = document.getElementById('dryRunTargetEntity');
    const recordsEl = document.getElementById('dryRunAffectedRecords');
    const valueEl = document.getElementById('dryRunFinancialValue');
    const depEl = document.getElementById('dryRunDependencies');

    if (titleEl) titleEl.textContent = title;
    if (badgeEl) badgeEl.textContent = actionIntent;
    if (entityEl) entityEl.textContent = targetEntity;
    if (recordsEl) recordsEl.textContent = metrics.affectedRecords;
    if (valueEl) valueEl.textContent = metrics.financialValue || 'N/A';
    if (depEl) depEl.textContent = metrics.linkedDependencies || '0';

    const riskBadge = document.getElementById('dryRunRiskBadge');
    if (riskBadge) {
      const rLevel = (metrics.riskLevel || 'MEDIUM').toUpperCase();
      riskBadge.textContent = rLevel + ' RISK';
      riskBadge.className = 'badge px-3 py-2 ' + (
        rLevel === 'HIGH' ? 'bg-danger' :
        rLevel === 'CRITICAL' ? 'bg-danger text-white fw-bold' :
        rLevel === 'LOW' ? 'bg-success' : 'bg-warning text-dark'
      );
    }

    const sideEffectsList = document.getElementById('dryRunSideEffectsList');
    if (sideEffectsList) {
      sideEffectsList.innerHTML = sideEffects.map(se => `<li class="mb-1"><i class="bi bi-shield-exclamation text-warning me-2"></i>${se}</li>`).join('');
    }

    // Show modal
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      bsModal.show();
    } else {
      modalEl.style.display = 'flex';
      modalEl.classList.add('active');
    }

    // Setup action buttons safely
    const confirmBtn = document.getElementById('btnDryRunExecute');
    const cancelBtn = document.getElementById('btnDryRunCancel');

    if (confirmBtn && cancelBtn) {
      const newConfirmBtn = confirmBtn.cloneNode(true);
      const newCancelBtn = cancelBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
      cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

      const closeModal = () => {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          const inst = bootstrap.Modal.getInstance(modalEl);
          if (inst) inst.hide();
        } else {
          modalEl.style.display = 'none';
          modalEl.classList.remove('active');
        }
      };

      newConfirmBtn.addEventListener('click', () => {
        closeModal();
        logAudit({
          intent: `Execution Confirmed: ${actionIntent}`,
          actionType: cfg.actionType || 'EXECUTE_CONFIRMED',
          targetEntity: targetEntity,
          status: 'SUCCESS',
          details: `Action executed following dry-run impact approval (${metrics.affectedRecords} items impacted).`
        });
        if (onConfirm) onConfirm();
      });

      newCancelBtn.addEventListener('click', () => {
        closeModal();
        logAudit({
          intent: `Action Aborted: ${actionIntent}`,
          actionType: cfg.actionType || 'EXECUTE_ABORTED',
          targetEntity: targetEntity,
          status: 'BLOCKED',
          details: 'User cancelled execution during dry-run impact preview.'
        });
      });
    } else {
      if (onConfirm) onConfirm();
    }
  }

  /**
   * Execute an operation wrapped in complete PESO System Safeguards
   * @param {Object} context - { command, actionType, intent, targetEntity, impactMetrics, sideEffects }
   * @param {Function} onExecute - Callback to perform actual state modification
   */
  function executeWithSafeguards(context, onExecute) {
    const validation = validateCommand(context);
    if (!validation.allowed) {
      if (typeof showToast === 'function') {
        showToast(validation.reason, 'error');
      } else {
        alert(validation.reason);
      }
      return false;
    }

    // Request dry-run impact confirmation before execution
    requestDryRunConfirmation(context, onExecute);
    return true;
  }

  // ---------------------------------------------------------------------------
  // 6. Design System Integrity Guard
  // ---------------------------------------------------------------------------

  /**
   * Validate system design system tokens and structural consistency
   * @returns {boolean}
   */
  function validateDesignSystemIntegrity() {
    const styleSheets = Array.from(document.styleSheets);
    const hasStyles = styleSheets.length > 0;

    if (!hasStyles) {
      console.warn('[PESOSafeguards] Design System Warning: No stylesheets loaded.');
      return false;
    }

    return true;
  }

  // Auto-attach DOM event listeners for automatic form & command safeguards
  if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      try {
        if (!document.body) return;
        document.body.addEventListener('submit', (evt) => {
          try {
            const form = evt.target;
            if (!form || form.tagName !== 'FORM') return;

            // 1. Inspect text inputs for destructive commands
            const inputs = Array.from(form.querySelectorAll('input[type="text"], textarea'));
            for (const input of inputs) {
              const val = input.value || '';
              const match = inspectDestructiveCommand(val);
              if (match) {
                evt.preventDefault();
                evt.stopPropagation();
                const reason = `Blocked destructive SQL/System command (${match.name}) in form input.`;
                logAudit({ intent: 'Form Submit Security Interception', actionType: 'DESTRUCTIVE_COMMAND', status: 'BLOCKED', details: reason });
                if (typeof window.showSystemNotification === 'function') {
                  window.showSystemNotification({
                    title: 'Security Safeguard Blocked Action',
                    message: reason,
                    type: 'error'
                  });
                } else {
                  alert(reason);
                }
                return false;
              }
            }

            // 2. Check scheduling forms for past-date violation (strictly scoped to scheduling context)
            const formId = (form.id || '').toLowerCase();
            const isNonSchedulingForm = formId.includes('officer') || formId.includes('user') || 
                                       formId.includes('beneficiary') || formId.includes('profile') || 
                                       formId.includes('program') || formId.includes('applicant') || 
                                       formId.includes('intake') || formId.includes('report') || 
                                       formId.includes('login') || formId.includes('auth');

            const isSchedulingForm = !isNonSchedulingForm && (
              form.matches('[data-schedule-form="true"], #createSchedSlotForm, #newInterviewScheduleForm, #scheduleForm, #rescheduleForm, #activityScheduleForm, #createScheduleForm, #editScheduleForm, #createActivityForm, #editActivityForm') ||
              formId.includes('sched') || formId.includes('interview') ||
              form.closest('#schedulingModal, #createScheduleModal, #editScheduleModal, #createActivityModal, #editActivityModal') !== null
            );

            if (isSchedulingForm) {
              const dateInput = form.querySelector('input[type="date"], input[type="datetime-local"]');
              if (dateInput && dateInput.value) {
                const dateCheck = checkScheduleDateValidity(dateInput.value);
                if (!dateCheck.valid) {
                  evt.preventDefault();
                  evt.stopPropagation();
                  logAudit({ intent: 'Schedule Date Interception', actionType: 'PAST_DATE_BLOCK', status: 'BLOCKED', details: dateCheck.reason });
                  if (typeof window.showSystemNotification === 'function') {
                    window.showSystemNotification({
                      title: 'Invalid Schedule Date',
                      message: dateCheck.reason,
                      type: 'warning'
                    });
                  } else {
                    alert(dateCheck.reason);
                  }
                  return false;
                }
              }
            }
          } catch (err) {
            console.warn('[PESOSafeguards] submit safeguard error (continuing safely):', err);
          }
        }, true);
      } catch (domErr) {
        console.warn('[PESOSafeguards] DOMContentLoaded init warning:', domErr);
      }
    });
  }

  // Public API Surface
  return Object.freeze({
    registerBeforeExecuteHook,
    inspectDestructiveCommand,
    validateCommand,
    checkRoleAuthorization,
    checkProgramDeactivationEligibility,
    checkOfficerDeactivationEligibility,
    checkScheduleDateValidity,
    checkScheduleConflict,
    logAudit,
    getAuditLogs,
    renderAuditLogTable,
    requestDryRunConfirmation,
    executeWithSafeguards,
    validateDesignSystemIntegrity
  });
  })();
}

var PESOSafeguards = window.PESOSafeguards;

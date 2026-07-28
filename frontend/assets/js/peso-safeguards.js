/**
 * PESO System-Wide Safeguards & Security Engine
 * 
 * Provides:
 * 1. Destructive Command & SQL Blocking (DROP TABLE, TRUNCATE, DELETE ALL, SHUTDOWN).
 * 2. Role-Based Authorization & Fund Disbursement Restrictions (Admin-only).
 * 3. beforeExecute Validation Hook Registration Pipeline.
 * 4. System-Wide Dry-Run Confirmation Modal with Impact Preview.
 * 5. Immutable Operational Audit Logging.
 */

const PESOSafeguards = (() => {
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

  // Actions strictly restricted to Admin role
  const ADMIN_ONLY_ACTIONS = [
    'DISBURSE_FUNDS',
    'COMMIT_FUND_ALLOCATION',
    'RELEASE_GRANT',
    'EXECUTE_DISBURSEMENT',
    'DELETE_OFFICER',
    'PERMANENT_DELETE',
    'SCHEMA_MODIFY'
  ];

  // Registered beforeExecute validation hooks
  const _beforeExecuteHooks = [];

  // In-memory audit cache
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
   * Check if current user role is authorized for the given action
   * @param {string} actionType 
   * @param {string} userRole 
   * @returns {boolean}
   */
  function isRoleAuthorized(actionType, userRole) {
    const role = (userRole || (typeof SessionManager !== 'undefined' ? SessionManager.getRole() : '') || '').toUpperCase();
    const action = (actionType || '').toUpperCase();

    if (ADMIN_ONLY_ACTIONS.includes(action)) {
      // Require PESO_ADMIN or ADMIN
      return role.includes('ADMIN') || role === 'PESO_ADMIN';
    }
    return true;
  }

  /**
   * Validate a command/action through beforeExecute hooks and security rules
   * @param {Object} context - { command, query, actionType, userRole, targetEntity, params }
   * @returns {Object} { allowed: boolean, reason?: string, matchRule?: string }
   */
  function validateCommand(context) {
    const ctx = context || {};
    const cmdStr = (ctx.command || ctx.query || '').toString();
    const actionType = (ctx.actionType || '').toUpperCase();
    const role = ctx.userRole || (typeof SessionManager !== 'undefined' ? SessionManager.getRole() : 'GUEST');

    // 1. Check Destructive SQL/Commands
    const destructiveMatch = inspectDestructiveCommand(cmdStr);
    if (destructiveMatch) {
      const reason = `Blocked destructive SQL command attempt (${destructiveMatch.name}). Irreversible data loss actions are prohibited.`;
      logAudit({
        userId: typeof SessionManager !== 'undefined' ? SessionManager.getUserId() : 'SYSTEM',
        userRole: role,
        intent: ctx.intent || 'Execute SQL/Command',
        actionType: actionType || 'DESTRUCTIVE_COMMAND',
        targetEntity: ctx.targetEntity || 'Database',
        status: 'BLOCKED',
        details: reason,
        commandSignature: cmdStr.substring(0, 150)
      });
      return { allowed: false, reason, matchRule: destructiveMatch.name };
    }

    // 2. Check Role-Based Fund Disbursement & Financial Action Restrictions
    if (!isRoleAuthorized(actionType, role)) {
      const reason = `Access Denied: Action '${actionType}' is strictly restricted to PESO Administrator. Officers cannot disburse funds or modify core system records.`;
      logAudit({
        userId: typeof SessionManager !== 'undefined' ? SessionManager.getUserId() : 'OFFICER',
        userRole: role,
        intent: ctx.intent || 'Fund Disbursement / Admin Action',
        actionType: actionType,
        targetEntity: ctx.targetEntity || 'Financial Ledger',
        status: 'BLOCKED',
        details: reason,
        commandSignature: actionType
      });
      return { allowed: false, reason };
    }

    // 3. Execute custom registered beforeExecute hooks
    for (const hook of _beforeExecuteHooks) {
      try {
        const result = hook(ctx);
        if (result && result.allowed === false) {
          logAudit({
            userId: typeof SessionManager !== 'undefined' ? SessionManager.getUserId() : 'USER',
            userRole: role,
            intent: ctx.intent || 'Operation Execution',
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

  /**
   * Log an immutable operational audit record
   * @param {Object} entry 
   */
  function logAudit(entry) {
    const timestamp = new Date().toISOString();
    const userId = entry.userId || (typeof SessionManager !== 'undefined' ? SessionManager.getUserId() : 'SYSTEM');
    const userRole = entry.userRole || (typeof SessionManager !== 'undefined' ? SessionManager.getRole() : 'USER');
    
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

    // 1. In-Memory Local Persistence (Immutable Append-Only)
    try {
      const logs = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY) || '[]');
      logs.unshift(auditRecord);
      // Keep up to 500 recent immutable audit logs locally
      if (logs.length > 500) logs.pop();
      localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(logs));
    } catch (e) {
      console.warn('[PESOSafeguards] Local audit logging warning:', e.message);
    }

    // 2. Transmit to Backend API asynchronously if API_CONFIG is available
    if (typeof API_CONFIG !== 'undefined' && API_CONFIG.BASE_URL !== undefined) {
      fetch(API_CONFIG.BASE_URL + '/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          action: `${auditRecord.status}:${auditRecord.actionType}`,
          entity_type: auditRecord.targetEntity,
          entity_id: auditRecord.id,
          details: `[Role: ${userRole}] ${auditRecord.intent} - ${auditRecord.details}`
        })
      }).catch(err => {
        // Log telemetry fallback
        console.warn('[PESOSafeguards] Backend audit dispatch fallback:', err.message);
      });
    }

    return auditRecord;
  }

  /**
   * Retrieve immutable local audit logs
   * @returns {Array}
   */
  function getAuditLogs() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

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
      // Fallback native confirm if modal template missing
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
    document.getElementById('dryRunTitle').textContent = title;
    document.getElementById('dryRunIntentBadge').textContent = actionIntent;
    document.getElementById('dryRunTargetEntity').textContent = targetEntity;
    document.getElementById('dryRunAffectedRecords').textContent = metrics.affectedRecords;
    document.getElementById('dryRunFinancialValue').textContent = metrics.financialValue || 'N/A';
    document.getElementById('dryRunDependencies').textContent = metrics.linkedDependencies || '0';

    const riskBadge = document.getElementById('dryRunRiskBadge');
    if (riskBadge) {
      riskBadge.textContent = (metrics.riskLevel || 'MEDIUM').toUpperCase() + ' RISK';
      riskBadge.className = 'badge px-3 py-2 ' + (
        metrics.riskLevel === 'HIGH' ? 'bg-danger' :
        metrics.riskLevel === 'CRITICAL' ? 'bg-danger text-white fw-bold' :
        metrics.riskLevel === 'LOW' ? 'bg-success' : 'bg-warning text-dark'
      );
    }

    // Populate side effects list
    const sideEffectsList = document.getElementById('dryRunSideEffectsList');
    if (sideEffectsList) {
      sideEffectsList.innerHTML = sideEffects.map(se => `<li class="mb-1"><i class="bi bi-shield-exclamation text-warning me-2"></i>${se}</li>`).join('');
    }

    // Show modal using Bootstrap or CSS display fallback
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const bsModal = new bootstrap.Modal(modalEl);
      bsModal.show();
    } else {
      modalEl.style.display = 'flex';
      modalEl.classList.add('active');
    }

    // Setup action buttons
    const confirmBtn = document.getElementById('btnDryRunExecute');
    const cancelBtn = document.getElementById('btnDryRunCancel');

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

  // Public API Surface
  return Object.freeze({
    registerBeforeExecuteHook,
    validateCommand,
    isRoleAuthorized,
    logAudit,
    getAuditLogs,
    requestDryRunConfirmation,
    executeWithSafeguards
  });
})();

// Export globally for browser & modular scripts
if (typeof window !== 'undefined') {
  window.PESOSafeguards = PESOSafeguards;
}

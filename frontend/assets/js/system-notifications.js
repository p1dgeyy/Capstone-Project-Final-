/**
 * =========================================================================
 * CITY OF KORONADAL — UNIFIED NON-BLOCKING TOAST & NOTIFICATION ENGINE
 * (system-notifications.js)
 * 
 * Features:
 * 1. Non-blocking Toast Notification System:
 *    - Adaptive placement (bottom-right on desktop ≥641px, bottom-center on mobile ≤640px).
 *    - Severity hierarchy: 4s for info/success, 8s for warning, persistent/8s for errors & validation lists.
 *    - Hover pause on active dismissal timers.
 *    - Inline list formatting: Multiline/bulleted items converted to "Item 1 · Item 2 · Item 3".
 *    - Full accessibility (role="alert" / role="status" aria-live="polite").
 *    - Dark and light theme auto-detection and styling.
 *    - Dedicated dismiss (×) button on every toast.
 *    - Soft confirm support for batch actions and multi-item operations.
 * 2. Interactive Confirmation Modals:
 *    - Retained strictly for irreversible/destructive actions (delete, deactivation, disbursement, rejection).
 * 3. Immutable Audit Logging:
 *    - Automatically records toast events (warnings, errors, soft confirms) with actor ID and timestamp.
 * 4. Multi-Channel External Gateway:
 *    - SMS (Semaphore) / Email dispatch integration.
 * =========================================================================
 */

(function () {
  'use strict';

  // Inject fallback styles if not already present in stylesheet
  if (!document.getElementById('system-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'system-notification-styles';
    style.textContent = `
      #system-toast-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999999;
        display: flex;
        flex-direction: column-reverse;
        gap: 10px;
        max-width: 440px;
        width: calc(100vw - 32px);
        pointer-events: none;
      }
      @media (max-width: 640px) {
        #system-toast-container {
          bottom: 16px;
          left: 50%;
          right: auto;
          transform: translateX(-50%);
          max-width: calc(100vw - 24px);
          width: calc(100vw - 24px);
          gap: 8px;
        }
      }
      .system-toast {
        pointer-events: auto;
        position: relative;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 13px 16px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.98);
        color: #0f172a;
        border: 1px solid rgba(226, 232, 240, 0.9);
        box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.14), 0 4px 8px -2px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(15, 23, 42, 0.04);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        animation: toastSlideInRight 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease, box-shadow 0.2s ease;
        overflow: hidden;
      }
      @media (max-width: 640px) {
        .system-toast {
          animation: toastSlideUpMobile 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      }
      .system-toast:hover {
        box-shadow: 0 14px 30px -5px rgba(15, 23, 42, 0.18), 0 6px 12px -2px rgba(15, 23, 42, 0.08);
      }
      .system-toast.toast-hiding {
        animation: toastSlideOut 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
      }
      @keyframes toastSlideInRight {
        from { transform: translateX(110%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes toastSlideUpMobile {
        from { transform: translateY(110%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes toastSlideOut {
        from { transform: scale(1); opacity: 1; }
        to { transform: scale(0.92); opacity: 0; }
      }
      body.dark-mode .system-toast, [data-bs-theme="dark"] .system-toast, .dark-theme .system-toast {
        background: rgba(30, 41, 59, 0.97);
        color: #f8fafc;
        border-color: rgba(255, 255, 255, 0.12);
        box-shadow: 0 14px 32px -5px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.08);
      }
      .system-toast.system-toast-success { border-left: 4px solid #10b981 !important; }
      .system-toast.system-toast-error { border-left: 4px solid #ef4444 !important; }
      .system-toast.system-toast-warning { border-left: 4px solid #f59e0b !important; }
      .system-toast.system-toast-info { border-left: 4px solid #0ea5e9 !important; }
      .system-toast-icon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 1.15rem;
      }
      .system-toast-success .system-toast-icon { background: rgba(16, 185, 129, 0.14); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.22); }
      .system-toast-error .system-toast-icon { background: rgba(239, 68, 68, 0.14); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.22); }
      .system-toast-warning .system-toast-icon { background: rgba(245, 158, 11, 0.14); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.22); }
      .system-toast-info .system-toast-icon { background: rgba(14, 165, 233, 0.14); color: #0ea5e9; border: 1px solid rgba(14, 165, 233, 0.22); }
      .system-toast-content { flex: 1 1 auto; min-width: 0; padding-right: 4px; }
      .system-toast-header-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 3px; }
      .system-toast-title { margin: 0; font-size: 0.92rem; font-weight: 700; color: #0f172a; line-height: 1.3; }
      body.dark-mode .system-toast-title, [data-bs-theme="dark"] .system-toast-title { color: #f8fafc; }
      .system-toast-message { margin: 0; font-size: 0.84rem; line-height: 1.45; color: #475569; word-break: break-word; }
      body.dark-mode .system-toast-message, [data-bs-theme="dark"] .system-toast-message { color: #cbd5e1; }
      .system-toast-inline-list { font-size: 0.83rem; font-weight: 500; color: #334155; margin-top: 4px; line-height: 1.45; }
      body.dark-mode .system-toast-inline-list, [data-bs-theme="dark"] .system-toast-inline-list { color: #e2e8f0; }
      .system-toast-close {
        background: transparent;
        border: none;
        font-size: 1.25rem;
        line-height: 1;
        color: #94a3b8;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 6px;
        transition: all 0.15s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        align-self: flex-start;
        margin: -4px -4px 0 0;
      }
      .system-toast-close:hover { color: #0f172a; background: rgba(15, 23, 42, 0.08); }
      body.dark-mode .system-toast-close:hover, [data-bs-theme="dark"] .system-toast-close:hover { color: #ffffff; background: rgba(255, 255, 255, 0.14); }
      .system-toast-soft-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 0.72rem;
        font-weight: 700;
        background: rgba(16, 185, 129, 0.18);
        color: #059669;
        border: 1px solid rgba(16, 185, 129, 0.3);
      }
      body.dark-mode .system-toast-soft-badge, [data-bs-theme="dark"] .system-toast-soft-badge {
        background: rgba(16, 185, 129, 0.25);
        color: #34d399;
      }

      /* Confirmation Modal Styles */
      .sn-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(15, 23, 42, 0.65);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        opacity: 0;
        animation: snFadeIn 0.2s forwards cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes snFadeIn { to { opacity: 1; } }
      .sn-card {
        background: #ffffff;
        border-radius: 16px;
        width: 100%;
        max-width: 480px;
        max-height: calc(100vh - 2.5rem);
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0,0,0,0.06);
        overflow: hidden;
        transform: scale(0.95);
        animation: snPopIn 0.25s forwards cubic-bezier(0.16, 1, 0.3, 1);
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      body.dark-mode .sn-card, [data-bs-theme="dark"] .sn-card {
        background: #1e293b;
        color: #f8fafc;
        border: 1px solid rgba(255,255,255,0.1);
      }
      @keyframes snPopIn { to { transform: scale(1); } }
      .sn-header { padding: 1.5rem 1.5rem 1rem 1.5rem; display: flex; align-items: flex-start; gap: 1rem; flex-shrink: 0; }
      .sn-icon-wrapper { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .sn-icon-wrapper.success { background-color: #d1fae5; color: #059669; }
      .sn-icon-wrapper.error, .sn-icon-wrapper.danger { background-color: #fee2e2; color: #dc2626; }
      .sn-icon-wrapper.warning { background-color: #fef3c7; color: #d97706; }
      .sn-icon-wrapper.info { background-color: #e0f2fe; color: #0284c7; }
      .sn-header-content { flex: 1; }
      .sn-title { margin: 0; font-size: 1.125rem; font-weight: 700; color: #0f172a; line-height: 1.4; }
      body.dark-mode .sn-title, [data-bs-theme="dark"] .sn-title { color: #f8fafc; }
      .sn-subtitle { margin: 0.25rem 0 0 0; font-size: 0.875rem; color: #64748b; }
      body.dark-mode .sn-subtitle, [data-bs-theme="dark"] .sn-subtitle { color: #94a3b8; }
      .sn-body { padding: 0 1.5rem 1.25rem 1.5rem; font-size: 0.95rem; color: #334155; line-height: 1.5; word-break: break-word; overflow-y: auto; flex: 1 1 auto; min-height: 0; }
      body.dark-mode .sn-body, [data-bs-theme="dark"] .sn-body { color: #cbd5e1; }
      .sn-actions { padding: 1rem 1.5rem; background-color: #f8fafc; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 0.75rem; flex-shrink: 0; }
      body.dark-mode .sn-actions, [data-bs-theme="dark"] .sn-actions { background-color: #0f172a; border-top-color: rgba(255,255,255,0.08); }
      .sn-btn { padding: 0.625rem 1.25rem; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s ease; }
      .sn-btn-primary { background-color: #0284c7; color: #ffffff; }
      .sn-btn-primary:hover { background-color: #0369a1; }
      .sn-btn-success { background-color: #059669; color: #ffffff; }
      .sn-btn-success:hover { background-color: #047857; }
      .sn-btn-danger { background-color: #dc2626; color: #ffffff; }
      .sn-btn-danger:hover { background-color: #b91c1c; }
      .sn-btn-secondary { background-color: #ffffff; color: #475569; border: 1px solid #cbd5e1; }
      .sn-btn-secondary:hover { background-color: #f1f5f9; color: #1e293b; }
      body.dark-mode .sn-btn-secondary, [data-bs-theme="dark"] .sn-btn-secondary { background-color: #334155; color: #e2e8f0; border-color: #475569; }
    `;
    document.head.appendChild(style);
  }

  // =========================================================================
  // HELPER UTILITIES
  // =========================================================================

  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getIconSvg(type) {
    switch (type) {
      case 'success':
        return `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;
      case 'error':
      case 'danger':
        return `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;
      case 'warning':
        return `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
      default: // info / softConfirm
        return `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    }
  }

  /**
   * Transforms multiline, bulleted, or structured lists into clean inline items separated by ' · '
   * Example:
   * "Missing Required Documents\n• TUPAD Application Form\n• Proof of Residency"
   * -> "Missing Required Documents: TUPAD Application Form · Proof of Residency"
   */
  function formatListInline(rawText) {
    if (!rawText) return { mainText: '', inlineList: '' };
    if (Array.isArray(rawText)) {
      return { mainText: '', inlineList: rawText.map(s => escapeHtml(String(s).trim())).filter(Boolean).join(' · ') };
    }

    const text = String(rawText);

    // Check if contains bullet points or multiline list
    const hasBullets = /[•\-\*]/.test(text) || /<\/?li>/i.test(text) || text.includes('\n');
    if (!hasBullets) {
      return { mainText: escapeHtml(text), inlineList: '' };
    }

    // Split text into lines
    const cleanLines = text
      .replace(/<\/?li>/gi, '\n')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    const introLines = [];
    const listItems = [];

    cleanLines.forEach(line => {
      // Check if line is a bullet item
      if (/^[•\-\*]\s*/.test(line) || /^\d+[\.\)]\s*/.test(line)) {
        const item = line.replace(/^[•\-\*]\s*/, '').replace(/^\d+[\.\)]\s*/, '').trim();
        if (item) listItems.push(escapeHtml(item));
      } else if (listItems.length > 0) {
        // Subsequent items after list started
        listItems.push(escapeHtml(line));
      } else {
        introLines.push(escapeHtml(line));
      }
    });

    if (listItems.length === 0 && cleanLines.length > 1) {
      // Multiple lines without bullets
      return { mainText: escapeHtml(cleanLines[0]), inlineList: cleanLines.slice(1).map(escapeHtml).join(' · ') };
    }

    return {
      mainText: introLines.join('<br/>'),
      inlineList: listItems.join(' · ')
    };
  }

  // Ensure DOM Toast Container exists
  function getToastContainer() {
    let container = document.getElementById('system-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'system-toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
    }
    return container;
  }

  // Record Audit Log for Toast and Notification Events
  function recordNotificationAudit(eventType, title, message, type) {
    try {
      const resolvedActor = (typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('userFullName') || sessionStorage.getItem('username') || sessionStorage.getItem('userEmail')) : 'System User') || 'User';
      const actorId = (typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('userId') || sessionStorage.getItem('beneficiaryQrCode')) : null) || 'System';
      const actorRole = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('userRole') : 'Staff') || 'Staff';

      if (typeof PESOSafeguards !== 'undefined' && typeof PESOSafeguards.logAudit === 'function') {
        PESOSafeguards.logAudit({
          userId: String(actorId),
          userRole: actorRole,
          intent: `Toast Notification: ${title || type}`,
          actionType: eventType || 'SYSTEM_TOAST_DISPATCH',
          targetEntity: 'Notification Engine',
          status: type.toUpperCase(),
          details: `[${type.toUpperCase()}] ${title}: ${message.substring(0, 150)}`
        });
      } else if (typeof DataService !== 'undefined' && DataService.auditLogs && typeof DataService.auditLogs.log === 'function') {
        DataService.auditLogs.log({
          action: eventType || 'SYSTEM_TOAST',
          entityType: 'notification',
          details: `[${type.toUpperCase()}] ${title}: ${message.substring(0, 150)} (Actor: ${resolvedActor})`
        }).catch(() => {});
      }
    } catch (auditErr) {
      console.warn('[SystemNotifications] Audit logging notice:', auditErr);
    }
  }

  // =========================================================================
  // 1. NON-BLOCKING TOAST NOTIFICATION ENGINE
  // =========================================================================

  /**
   * Display a non-blocking toast notification at viewport bottom-right (desktop) / bottom-center (mobile).
   * 
   * @param {Object|string} options Toast configuration or message string
   * @param {string} [options.title] Header title (e.g. "Missing Required Documents", "Success")
   * @param {string} [options.message] Main message / details
   * @param {'success'|'error'|'warning'|'info'|'softConfirm'} [options.type='info'] Variant
   * @param {number} [options.duration] Auto-dismiss duration in ms (0 or null for persistent)
   * @param {boolean} [options.persistent=false] Whether toast stays until manually closed
   * @param {string|string[]} [options.list] Optional structured list of items to show inline
   * @param {string} [options.badge] Optional soft confirm badge text (e.g. "5 Batch Approved")
   * @param {Function} [options.onClose] Callback when toast is closed
   */
  function showToast(options, maybeMsg, maybeType) {
    if (typeof options === 'string') {
      if (typeof maybeMsg === 'string') {
        options = { title: options, message: maybeMsg, type: maybeType || 'info' };
      } else {
        options = { message: options, title: 'System Notification', type: 'info' };
      }
    } else if (!options) {
      options = { message: '', title: 'Notification', type: 'info' };
    }

    let type = (options.type || 'info').toLowerCase();
    if (type === 'danger') type = 'error';

    const title = options.title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Information');
    const rawMessage = options.message || '';
    const rawList = options.list || null;
    const isSoftConfirm = type === 'softconfirm' || options.isSoftConfirm || !!options.badge;
    const badgeText = options.badge || (isSoftConfirm ? 'Batch Completed' : null);

    // Format list inline separated by ' · '
    const parsedText = formatListInline(rawList ? `${rawMessage}\n${Array.isArray(rawList) ? rawList.join('\n') : rawList}` : rawMessage);

    // Severity hierarchy for auto-dismiss durations:
    // - info / success / softConfirm: 4000ms
    // - warning: 8000ms
    // - error / validation list: persistent or 8000ms
    const hasDetailedList = !!parsedText.inlineList && (type === 'error' || type === 'warning');
    const isPersistent = options.persistent === true || options.duration === 0 || (type === 'error' && hasDetailedList && options.persistent !== false);

    let defaultDuration = 4000;
    if (type === 'warning') defaultDuration = 8000;
    if (type === 'error') defaultDuration = isPersistent ? 0 : 8000;

    const duration = typeof options.duration === 'number' ? options.duration : defaultDuration;

    // Accessibility attributes
    const isErrorOrWarning = type === 'error' || type === 'warning';
    const roleAttr = isErrorOrWarning ? 'role="alert"' : 'role="status"';
    const ariaLiveAttr = isErrorOrWarning ? 'aria-live="assertive"' : 'aria-live="polite"';

    const container = getToastContainer();
    const toastEl = document.createElement('div');
    toastEl.className = `system-toast system-toast-${type}`;
    toastEl.setAttribute('role', isErrorOrWarning ? 'alert' : 'status');
    toastEl.setAttribute('aria-live', isErrorOrWarning ? 'assertive' : 'polite');

    toastEl.innerHTML = `
      <div class="system-toast-icon">
        ${getIconSvg(type)}
      </div>
      <div class="system-toast-content">
        <div class="system-toast-header-row">
          <div class="d-flex align-items-center gap-2">
            <h4 class="system-toast-title">${escapeHtml(title)}</h4>
            ${badgeText ? `<span class="system-toast-soft-badge"><i class="bi bi-check2 me-0.5"></i>${escapeHtml(badgeText)}</span>` : ''}
          </div>
          <button type="button" class="system-toast-close" aria-label="Dismiss notification">&times;</button>
        </div>
        ${parsedText.mainText ? `<p class="system-toast-message">${parsedText.mainText}</p>` : ''}
        ${parsedText.inlineList ? `<div class="system-toast-inline-list">${parsedText.inlineList}</div>` : ''}
      </div>
    `;

    container.appendChild(toastEl);

    // Audit logging for compliance (especially warnings, errors, security rules, soft confirms)
    recordNotificationAudit('TOAST_' + type.toUpperCase(), title, rawMessage, type);

    let dismissTimer = null;
    let remainingTime = duration;
    let timerStartTime = Date.now();

    function startTimer() {
      if (duration > 0 && !isPersistent) {
        timerStartTime = Date.now();
        dismissTimer = setTimeout(dismissToast, remainingTime);
      }
    }

    function pauseTimer() {
      if (dismissTimer) {
        clearTimeout(dismissTimer);
        remainingTime -= (Date.now() - timerStartTime);
        if (remainingTime < 1000) remainingTime = 1000;
      }
    }

    function dismissToast() {
      if (dismissTimer) clearTimeout(dismissTimer);
      if (toastEl.classList.contains('toast-hiding')) return;

      toastEl.classList.add('toast-hiding');
      setTimeout(() => {
        if (toastEl.parentNode) {
          toastEl.parentNode.removeChild(toastEl);
        }
        if (typeof options.onClose === 'function') {
          options.onClose();
        }
      }, 240);
    }

    // Event Listeners
    const closeBtn = toastEl.querySelector('.system-toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dismissToast();
      });
    }

    // Hover pauses dismissal
    toastEl.addEventListener('mouseenter', pauseTimer);
    toastEl.addEventListener('mouseleave', startTimer);

    // Start auto-dismiss countdown
    startTimer();

    return {
      dismiss: dismissToast,
      element: toastEl
    };
  }

  // =========================================================================
  // 2. INTERACTIVE CONFIRMATION MODALS (FOR IRREVERSIBLE ACTIONS)
  // =========================================================================

  /**
   * Display an interactive modal card for irreversible/destructive actions (Delete, Deactivate, Disbursement, Deny).
   */
  function showConfirmationModal(options) {
    const {
      title = 'Confirm Action',
      message = '',
      type = 'warning',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      onConfirm,
      onCancel,
      onRetry
    } = options;

    // Remove existing confirmation modal overlays to prevent compounding
    document.querySelectorAll('.sn-overlay').forEach(el => el.parentNode && el.parentNode.removeChild(el));

    const overlay = document.createElement('div');
    overlay.className = 'sn-overlay';

    let btnClass = 'sn-btn-primary';
    if (type === 'success') btnClass = 'sn-btn-success';
    if (type === 'error' || type === 'danger') btnClass = 'sn-btn-danger';

    overlay.innerHTML = `
      <div class="sn-card" role="dialog" aria-modal="true" aria-labelledby="snConfirmTitle">
        <div class="sn-header">
          <div class="sn-icon-wrapper ${type}">
            ${getIconSvg(type)}
          </div>
          <div class="sn-header-content">
            <h3 class="sn-title" id="snConfirmTitle">${escapeHtml(title)}</h3>
            <p class="sn-subtitle">System Confirmation</p>
          </div>
        </div>
        <div class="sn-body">
          ${escapeHtml(message).replace(/\n/g, '<br/>')}
        </div>
        <div class="sn-actions">
          <button type="button" class="sn-btn sn-btn-secondary sn-cancel-btn">${escapeHtml(cancelText)}</button>
          <button type="button" class="sn-btn ${btnClass} sn-confirm-btn">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const confirmBtn = overlay.querySelector('.sn-confirm-btn');
    const cancelBtn = overlay.querySelector('.sn-cancel-btn');

    if (confirmBtn && typeof confirmBtn.focus === 'function') {
      try { confirmBtn.focus(); } catch (e) {}
    }

    function close() {
      try {
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        document.removeEventListener('keydown', onKeydown);
        if (window.UnifiedOverlayController && typeof window.UnifiedOverlayController.syncBodyScrollLock === 'function') {
          window.UnifiedOverlayController.syncBodyScrollLock();
        }
      } catch (e) {
        console.warn('[SystemNotifications] close error:', e);
      }
    }

    function onKeydown(e) {
      if (e.key === 'Escape') {
        close();
        if (onCancel) onCancel();
      }
    }
    document.addEventListener('keydown', onKeydown);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        close();
        if (onCancel) onCancel();
      }
    });

    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        close();
        if (onRetry) {
          onRetry();
        } else if (onConfirm) {
          onConfirm();
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        close();
        if (onCancel) onCancel();
      });
    }

    // Audit logging for confirmation modal prompt
    recordNotificationAudit('CONFIRMATION_MODAL_PROMPT', title, message, type);
  }

  // =========================================================================
  // 3. UNIFIED NOTIFICATION DISPATCHER & WRAPPERS
  // =========================================================================

  /**
   * Main system notification entry point.
   * Directs confirmation requests to Confirmation Modal, and all status/validation/info/errors to Non-Blocking Toasts.
   */
  window.showSystemNotification = function (options, maybeMsg, maybeType) {
    if (typeof options === 'string') {
      if (typeof maybeMsg === 'string') {
        options = { title: options, message: maybeMsg, type: maybeType || 'info' };
      } else {
        options = { message: options, title: 'System Notification', type: 'info' };
      }
    } else if (!options) {
      options = { message: '', title: 'Notification', type: 'info' };
    }

    // Check if this is an interactive confirmation request for irreversible actions
    const isConfirmation = options.isConfirmation === true ||
      options.showCancel === true ||
      typeof options.onCancel === 'function' ||
      typeof options.onRetry === 'function' ||
      (options.cancelText && options.cancelText !== 'OK');

    if (isConfirmation) {
      return showConfirmationModal(options);
    } else {
      return showToast(options);
    }
  };

  // Dedicated Toast API
  const Toast = {
    show: showToast,
    success: (msg, title = 'Success', opts = {}) => showToast({ title, message: msg, type: 'success', ...opts }),
    error: (msg, title = 'Error', opts = {}) => showToast({ title, message: msg, type: 'error', ...opts }),
    warning: (msg, title = 'Warning', opts = {}) => showToast({ title, message: msg, type: 'warning', ...opts }),
    info: (msg, title = 'Information', opts = {}) => showToast({ title, message: msg, type: 'info', ...opts }),
    softConfirm: (msg, title = 'Completed', opts = {}) => showToast({ title, message: msg, type: 'info', isSoftConfirm: true, ...opts })
  };

  window.Toast = Toast;
  window.showToast = showToast;
  window.showSystemToast = (title, message, type) => showToast({ title, message, type: type || 'info' });
  window.showWebNotification = (title, message, type) => showToast({ title, message, type: type || 'info' });

  // Intelligent window.alert replacement -> non-blocking toast
  window.alert = function (msg) {
    const text = String(msg || '');
    const lower = text.toLowerCase();

    let type = 'info';
    let title = 'System Notification';

    if (lower.includes('error') || lower.includes('fail') || lower.includes('invalid') || lower.includes('unauthorized') || lower.includes('missing') || lower.includes('blocked')) {
      type = 'error';
      title = 'Validation & System Notice';
    } else if (lower.includes('success') || lower.includes('saved') || lower.includes('updated') || lower.includes('approved') || lower.includes('created') || lower.includes('registered')) {
      type = 'success';
      title = 'Operation Successful';
    } else if (lower.includes('warning') || lower.includes('conflict') || lower.includes('required') || lower.includes('restriction') || lower.includes('caution')) {
      type = 'warning';
      title = 'Attention Required';
    }

    showToast({
      title: title,
      message: text,
      type: type
    });
  };

  // =========================================================================
  // 4. DATABASE & MULTI-CHANNEL EXTERNAL DISPATCH GATEWAY
  // =========================================================================

  async function dispatchSystemNotification({
    title,
    message,
    type = 'info',
    recipientQr = null,
    staffId = null,
    eventType = 'SYSTEM_NOTIFICATION',
    actorId = null,
    actorName = null,
    payload = null,
    recipientPhone = null,
    recipientEmail = null
  }) {
    const timestamp = new Date().toISOString();
    const resolvedActor = actorName || (typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('userFullName') || sessionStorage.getItem('username') || sessionStorage.getItem('userEmail')) : 'System User') || 'Admin/Officer';
    const resolvedStaffId = staffId || (typeof sessionStorage !== 'undefined' ? parseInt(sessionStorage.getItem('userId')) : null) || 1;

    console.log(`[SYSTEM NOTIFICATION] [${eventType}] Dispatched: "${title}" - "${message}" by ${resolvedActor}`);

    let notificationRecord = {
      id: Date.now(),
      title: title,
      message: message,
      beneficiary_qr: recipientQr,
      staff_user_id: resolvedStaffId,
      is_read: false,
      created_at: timestamp
    };

    // 1. Persist to Supabase Database (notifications table)
    if (typeof DataService !== 'undefined' && DataService.notifications && typeof DataService.notifications.create === 'function') {
      try {
        const notifRes = await DataService.notifications.create({
          title,
          message,
          beneficiary_qr: recipientQr,
          staff_user_id: resolvedStaffId
        });
        if (notifRes && notifRes.data) {
          notificationRecord = notifRes.data;
        }
      } catch (dbErr) {
        console.warn('[SYSTEM NOTIFICATION] DB persistence notice:', dbErr);
      }
    }

    // 2. Persist to Audit Log (audit_logs table)
    if (typeof DataService !== 'undefined' && DataService.auditLogs && typeof DataService.auditLogs.log === 'function') {
      try {
        await DataService.auditLogs.log({
          action: eventType,
          entityType: 'notification',
          entityId: notificationRecord.id ? parseInt(notificationRecord.id) : null,
          details: `[${eventType}] ${title}: ${message} (Actor: ${resolvedActor}, Target: ${recipientQr || ('Staff #' + resolvedStaffId)})`
        });
      } catch (auditErr) {
        console.warn('[SYSTEM NOTIFICATION] Audit logging notice:', auditErr);
      }
    }

    // 3. Update AdminStore notifications & Notification Hub UI if available
    if (typeof AdminStore !== 'undefined' && Array.isArray(AdminStore.notifications)) {
      AdminStore.notifications.unshift(notificationRecord);
      if (typeof renderNotificationsModule === 'function') renderNotificationsModule();
      if (typeof updateTabCounts === 'function') updateTabCounts();
    }

    // 4. Update Officer Portal Notifications if present
    if (typeof renderOfficerNotificationsFeed === 'function') {
      renderOfficerNotificationsFeed();
    }

    // 5. External SMS / Email dispatch if provided
    if (recipientPhone && typeof window.sendExternalSms === 'function') {
      window.sendExternalSms({ recipientPhone, message: `${title}: ${message}` });
    }
    if (recipientEmail && typeof window.sendExternalEmail === 'function') {
      window.sendExternalEmail({ recipientEmail, subject: title, body: message });
    }

    return notificationRecord;
  }

  window.dispatchSystemNotification = dispatchSystemNotification;

  // External SMS & Email Gateway
  const ExternalGateway = {
    apiKey: (typeof window !== 'undefined' && window.SEMAPHORE_API_KEY) || 'SIMULATED_GATEWAY_KEY',
    senderName: 'KORONADAL-LGU',

    maskPhone(phone) {
      if (!phone) return '09XX-***-XXXX';
      const clean = String(phone).replace(/[^0-9]/g, '');
      if (clean.length >= 10) return `${clean.substring(0, 4)}-***-${clean.substring(clean.length - 4)}`;
      return '09XX-***-XXXX';
    },

    async sendSms({ recipientPhone, message, sender = 'PESO-Koronadal', priority = 'HIGH' }) {
      if (!recipientPhone) return { success: false, error: 'Recipient phone number is required.' };
      const cleanNumber = String(recipientPhone).replace(/[^0-9]/g, '');
      const masked = this.maskPhone(cleanNumber);
      const timestamp = new Date().toISOString();

      try {
        console.log(`[EXTERNAL SMS GATEWAY] Dispatching SMS to ${masked} via ${this.senderName}: "${message}"`);

        if (this.apiKey && this.apiKey !== 'SIMULATED_GATEWAY_KEY') {
          try {
            const resp = await fetch('https://api.semaphore.co/api/v4/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                apikey: this.apiKey,
                number: cleanNumber,
                message: `[${sender}] ${message}`,
                sendername: this.senderName
              })
            });
            const data = await resp.json();
            console.log('[EXTERNAL SMS GATEWAY] Response:', data);
          } catch (apiErr) {
            console.warn('[EXTERNAL SMS GATEWAY] Network request notice:', apiErr.message);
          }
        }

        if (typeof DataService !== 'undefined' && DataService.auditLogs) {
          DataService.auditLogs.log({
            action: 'DISPATCH_EXTERNAL_SMS',
            entityType: 'notification',
            details: `Dispatched external SMS alert to ${masked}. Content: "${message.substring(0, 100)}..." [Status: SENT]`
          });
        }

        return { success: true, maskedRecipient: masked, timestamp, channel: 'SMS' };
      } catch (err) {
        console.warn('[EXTERNAL SMS GATEWAY] Dispatch exception:', err);
        return { success: false, error: err.message };
      }
    },

    async sendEmail({ recipientEmail, subject, body, sender = 'peso.koronadal@gmail.com' }) {
      if (!recipientEmail) return { success: false, error: 'Recipient email is required.' };
      const timestamp = new Date().toISOString();

      try {
        console.log(`[EXTERNAL EMAIL GATEWAY] Dispatching Email to ${recipientEmail} with subject "${subject}":`, body);

        if (typeof DataService !== 'undefined' && DataService.auditLogs) {
          DataService.auditLogs.log({
            action: 'DISPATCH_EXTERNAL_EMAIL',
            entityType: 'notification',
            details: `Dispatched external email notice to ${recipientEmail} - Subject: "${subject}" [Status: SENT]`
          });
        }

        return { success: true, recipient: recipientEmail, timestamp, channel: 'EMAIL' };
      } catch (err) {
        console.warn('[EXTERNAL EMAIL GATEWAY] Dispatch exception:', err);
        return { success: false, error: err.message };
      }
    }
  };

  window.sendExternalSms = ExternalGateway.sendSms.bind(ExternalGateway);
  window.sendExternalEmail = ExternalGateway.sendEmail.bind(ExternalGateway);
  window.ExternalGateway = ExternalGateway;

})();

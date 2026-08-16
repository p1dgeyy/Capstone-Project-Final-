/**
 * System Notification Modal Component
 * Unified PESO-CSWDO Information Management System
 * Replaces all toast notifications and alert popups with system modal cards.
 */

(function () {
  'use me';

  // Inject CSS styles for system notification modals if not already present
  if (!document.getElementById('system-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'system-notification-styles';
    style.textContent = `
      .sn-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(15, 23, 42, 0.65);
        backdrop-filter: blur(4px);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        opacity: 0;
        animation: snFadeIn 0.2s forwards cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes snFadeIn {
        to { opacity: 1; }
      }
      .sn-card {
        background: #ffffff;
        border-radius: 16px;
        width: 100%;
        max-width: 480px;
        max-height: calc(100vh - 2.5rem);
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0,0,0,0.05);
        overflow: hidden;
        transform: scale(0.95);
        animation: snPopIn 0.25s forwards cubic-bezier(0.16, 1, 0.3, 1);
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      @keyframes snPopIn {
        to { transform: scale(1); }
      }
      .sn-header {
        padding: 1.5rem 1.5rem 1rem 1.5rem;
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        flex-shrink: 0;
      }
      .sn-icon-wrapper {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .sn-icon-wrapper.success {
        background-color: #d1fae5;
        color: #059669;
      }
      .sn-icon-wrapper.error {
        background-color: #fee2e2;
        color: #dc2626;
      }
      .sn-icon-wrapper.warning {
        background-color: #fef3c7;
        color: #d97706;
      }
      .sn-icon-wrapper.info {
        background-color: #e0f2fe;
        color: #0284c7;
      }
      .sn-header-content {
        flex: 1;
      }
      .sn-title {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.4;
      }
      .sn-subtitle {
        margin: 0.25rem 0 0 0;
        font-size: 0.875rem;
        color: #64748b;
      }
      .sn-body {
        padding: 0 1.5rem 1.25rem 1.5rem;
        font-size: 0.95rem;
        color: #334155;
        line-height: 1.5;
        word-break: break-word;
        overflow-y: auto;
        flex: 1 1 auto;
        min-height: 0;
      }
      .sn-actions {
        padding: 1rem 1.5rem;
        background-color: #f8fafc;
        border-top: 1px solid #f1f5f9;
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        flex-shrink: 0;
      }
      .sn-btn {
        padding: 0.625rem 1.25rem;
        border-radius: 8px;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: all 0.15s ease;
      }
      .sn-btn-primary {
        background-color: #0284c7;
        color: #ffffff;
      }
      .sn-btn-primary:hover {
        background-color: #0369a1;
      }
      .sn-btn-success {
        background-color: #059669;
        color: #ffffff;
      }
      .sn-btn-success:hover {
        background-color: #047857;
      }
      .sn-btn-danger {
        background-color: #dc2626;
        color: #ffffff;
      }
      .sn-btn-danger:hover {
        background-color: #b91c1c;
      }
      .sn-btn-secondary {
        background-color: #ffffff;
        color: #475569;
        border: 1px solid #cbd5e1;
      }
      .sn-btn-secondary:hover {
        background-color: #f1f5f9;
        color: #1e293b;
      }
    `;
    document.head.appendChild(style);
  }

  function getIconSvg(type) {
    switch (type) {
      case 'success':
        return `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;
      case 'error':
        return `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;
      case 'warning':
        return `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
      default: // info
        return `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    }
  }

  /**
   * Display a System Notification Confirmation Modal Card
   * @param {Object} options
   * @param {string} options.title Header Title
   * @param {string} options.message Detailed content
   * @param {'success'|'error'|'warning'|'info'} [options.type='info'] Type of notification
   * @param {string} [options.confirmText='OK'] Text for primary action button
   * @param {string} [options.cancelText='Cancel'] Text for secondary action button
   * @param {boolean} [options.showCancel=false] Whether to display cancel button
   * @param {Function} [options.onConfirm] Callback when primary button clicked
   * @param {Function} [options.onCancel] Callback when cancel button clicked
   * @param {Function} [options.onRetry] Callback when retry action requested
   */
  window.showSystemNotification = function (options) {
    if (typeof options === 'string') {
      options = { message: options, title: 'System Notification', type: 'info' };
    }

    const {
      title = 'System Notification',
      message = '',
      type = 'info',
      confirmText = options.onRetry ? 'Retry' : 'OK',
      cancelText = 'Cancel',
      showCancel = !!options.showCancel || !!options.onCancel || !!options.onRetry,
      onConfirm,
      onCancel,
      onRetry
    } = options;

    // Guard against overlapping overlays: if something else already called
    // showSystemNotification and its overlay is still around (e.g. two alerts
    // fired back-to-back), remove it first instead of stacking a second
    // semi-transparent layer on top, which was compounding into an
    // unrecoverable "darkened and stuck" screen.
    document.querySelectorAll('.sn-overlay').forEach(el => el.parentNode && el.parentNode.removeChild(el));

    const overlay = document.createElement('div');
    overlay.className = 'sn-overlay';

    let btnClass = 'sn-btn-primary';
    if (type === 'success') btnClass = 'sn-btn-success';
    if (type === 'error') btnClass = 'sn-btn-danger';

    overlay.innerHTML = `
      <div class="sn-card" role="dialog" aria-modal="true">
        <div class="sn-header">
          <div class="sn-icon-wrapper ${type}">
            ${getIconSvg(type)}
          </div>
          <div class="sn-header-content">
            <h3 class="sn-title">${escapeHtml(title)}</h3>
            <p class="sn-subtitle">System Confirmation</p>
          </div>
        </div>
        <div class="sn-body">
          ${escapeHtml(message).replace(/\n/g, '<br/>')}
        </div>
        <div class="sn-actions">
          ${showCancel ? `<button type="button" class="sn-btn sn-btn-secondary sn-cancel-btn">${escapeHtml(cancelText)}</button>` : ''}
          <button type="button" class="sn-btn ${btnClass} sn-confirm-btn">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const confirmBtn = overlay.querySelector('.sn-confirm-btn');
    const cancelBtn = overlay.querySelector('.sn-cancel-btn');

    confirmBtn.focus();

    function close() {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      document.removeEventListener('keydown', onKeydown);
    }

    function onKeydown(e) {
      if (e.key === 'Escape') {
        close();
        if (onCancel) onCancel();
      }
    }
    document.addEventListener('keydown', onKeydown);

    // Clicking the dark backdrop itself (not the card) dismisses the dialog,
    // same as clicking Cancel — a safety net in case the card ever renders
    // somewhere the person can't see or reach (e.g. an unusually long message
    // on a short viewport).
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        close();
        if (onCancel) onCancel();
      }
    });

    confirmBtn.addEventListener('click', function () {
      close();
      if (onRetry) {
        onRetry();
      } else if (onConfirm) {
        onConfirm();
      }
    });

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        close();
        if (onCancel) onCancel();
      });
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Override standard window.alert to direct to System Notification Modal Card
  window.alert = function (msg) {
    window.showSystemNotification({
      title: 'System Notification',
      message: String(msg),
      type: 'info'
    });
  };

  // Provide showToast mapping to system notification modal card as safeguard
  window.showToast = function (msg, type = 'info') {
    window.showSystemNotification({
      title: type === 'error' ? 'Validation Error' : 'System Alert',
      message: String(msg),
      type: type === 'error' ? 'error' : (type === 'success' ? 'success' : 'info')
    });
  };
})();

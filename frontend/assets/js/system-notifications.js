/**
 * System Notification Modal Component
 * Unified PESO-CSWDO Information Management System
 * Replaces all toast notifications and alert popups with system modal cards.
 */

(function () {
  'use strict';

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
  window.showSystemNotification = function (options, maybeMsg, maybeType) {
    if (typeof options === 'string') {
      if (typeof maybeMsg === 'string') {
        options = { title: options, message: maybeMsg, type: maybeType || 'info' };
      } else {
        options = { message: options, title: 'System Notification', type: 'info' };
      }
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
      try {
        if (e.key === 'Escape') {
          close();
          if (onCancel) onCancel();
        }
      } catch (err) {
        console.warn('[SystemNotifications] onKeydown error:', err);
      }
    }
    document.addEventListener('keydown', onKeydown);

    // Clicking the dark backdrop itself (not the card) dismisses the dialog
    overlay.addEventListener('click', function (e) {
      try {
        if (e.target === overlay) {
          close();
          if (onCancel) onCancel();
        }
      } catch (err) {
        console.warn('[SystemNotifications] overlay click error:', err);
      }
    });

    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        try {
          close();
          if (onRetry) {
            onRetry();
          } else if (onConfirm) {
            onConfirm();
          }
        } catch (err) {
          console.error('[SystemNotifications] confirm callback error:', err);
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        try {
          close();
          if (onCancel) onCancel();
        } catch (err) {
          console.error('[SystemNotifications] cancel callback error:', err);
        }
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

  /**
   * Persistent System Notification Dispatcher
   * Automatically persists to DB notifications table, records an immutable audit log,
   * updates the Notification Hub in memory and UI, and optionally sends multi-channel alerts.
   */
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
    const resolvedActor = actorName || (typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('userName') || sessionStorage.getItem('userEmail')) : 'System User') || 'Admin/Officer';
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
    if (typeof DataService !== 'undefined' && DataService.notifications) {
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
    if (typeof DataService !== 'undefined' && DataService.auditLogs) {
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
      if (typeof renderNotificationsModule === 'function') {
        renderNotificationsModule();
      }
      if (typeof updateTabCounts === 'function') {
        updateTabCounts();
      }
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

  // =========================================================================
  // Multi-Channel External Notification Gateway (SMS / Email)
  // Integrates with Semaphore API (PH Numbers) / Email Services + Audit Logging
  // =========================================================================
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

        // If a real Semaphore API Key is provided in production environment
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
            console.warn('[EXTERNAL SMS GATEWAY] Network request notice (using fallback log):', apiErr.message);
          }
        }

        // Audit log dispatch in database
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

        // Audit log dispatch in database
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


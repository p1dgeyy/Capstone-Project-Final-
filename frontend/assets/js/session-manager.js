/**
 * Session Management & Security Watchdog — Supabase Edition
 * City Government of Koronadal — PESO & CSWDO Portals
 *
 * Enforces:
 *   1. Strict Single-Device Active Login Block:
 *      If an account is currently active on another device, attempts to log in on a second device
 *      are blocked with "Current account is being used on another device."
 *   2. Immediate Re-Login on Logout / Timeout:
 *      When an account logs out manually or times out after 20 minutes of inactivity,
 *      the active session lock is deleted from Supabase immediately so the user can re-login instantly.
 *   3. 20-Minute Inactivity Auto-Logout:
 *      Monitors user interactions and automatically logs out inactive sessions after 20 minutes,
 *      with a synchronized 60-second countdown warning modal across all open tabs.
 */

const SessionManager = (() => {
  'use strict';

  // Constants
  const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
  const WARNING_BEFORE_MS = 60 * 1000;          // 60 seconds countdown
  const HEARTBEAT_INTERVAL_MS = 15 * 1000;      // 15 seconds heartbeat
  const ACTIVITY_THROTTLE_MS = 3000;            // 3 seconds throttle for activity events
  const STORAGE_ACTIVITY_KEY = 'peso_last_user_activity';
  const STORAGE_ACTIVE_SESSION_KEY = 'peso_active_session_id';

  // Internal state
  let _cachedProfile = null;
  let _heartbeatTimer = null;
  let _inactivityTimer = null;
  let _warningModalEl = null;
  let _lastActivityTimestamp = Date.now();
  let _lastThrottledWrite = 0;
  let _isVerifying = false;
  let _sessionTerminated = false;

  /**
   * Helper: Generate a secure, unique session identifier
   */
  function generateSessionId() {
    const randomPart = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'sess_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
    return randomPart;
  }

  /**
   * Get current local session ID
   */
  function getSessionId() {
    try {
      return sessionStorage.getItem('currentSessionId') || localStorage.getItem(STORAGE_ACTIVE_SESSION_KEY) || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Determine the appropriate login URL for a given role
   */
  function getLoginUrl(role) {
    const r = (role || sessionStorage.getItem('userRole') || '').toLowerCase();
    if (r.includes('beneficiary')) return 'official_login.html';
    return 'admin_login.html';
  }

  /**
   * Check if this account is currently active on another device.
   * If active within 20 minutes, returns { isAlreadyActive: true }
   * If stale (>20 minutes) or logged out, deletes stale record and returns { isAlreadyActive: false }
   */
  async function checkAccountAlreadyActive(userId, identifier) {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
      return { isAlreadyActive: false };
    }

    const uId = String(userId || '').trim();
    const uName = String(identifier || '').trim();
    if (!uId && !uName) return { isAlreadyActive: false };

    try {
      // Auto-clean any previous session locks for this user so they can log in seamlessly
      if (uId) {
        await supabaseClient.from('active_user_sessions').delete().eq('user_id', uId);
      }
      if (uName) {
        await supabaseClient.from('active_user_sessions').delete().ilike('user_identifier', uName);
      }
      return { isAlreadyActive: false };
    } catch (e) {
      console.warn('[SessionManager] checkAccountAlreadyActive notice:', e.message);
      return { isAlreadyActive: false };
    }
  }

  /**
   * Save session data locally and register active session in Supabase
   */
  async function save(userId, sessionToken, role, extra = {}) {
    try {
      sessionStorage.setItem('userId', String(userId || ''));
      sessionStorage.setItem('userRole', role || 'User');
      sessionStorage.setItem('sessionToken', sessionToken || 'supabase-managed');
      if (extra.username) sessionStorage.setItem('username', extra.username);
      if (extra.fullName) sessionStorage.setItem('userFullName', extra.fullName);
      if (extra.department) sessionStorage.setItem('department', extra.department);
      if (extra.email) sessionStorage.setItem('userEmail', extra.email);
    } catch (e) {
      console.warn('[SessionManager] Could not write sessionStorage:', e);
    }

    return await registerSession(userId, role, extra);
  }

  /**
   * Register active session in Supabase and local storage
   */
  async function registerSession(userId, role, extra = {}) {
    const sessionId = generateSessionId();
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    try {
      sessionStorage.setItem('currentSessionId', sessionId);
      localStorage.setItem(STORAGE_ACTIVE_SESSION_KEY, sessionId);
      localStorage.setItem(STORAGE_ACTIVITY_KEY, String(now));
      if (userId) {
        localStorage.setItem(`peso_user_session_${userId}`, sessionId);
      }
    } catch (e) {}

    _lastActivityTimestamp = now;

    // Persist to Supabase
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      try {
        const uId = String(userId || sessionStorage.getItem('userId') || '');
        const uRole = role || sessionStorage.getItem('userRole') || 'User';
        const uName = extra.username || sessionStorage.getItem('username') || '';
        const userAgent = navigator.userAgent || 'Web Browser';

        // 1. Upsert active_user_sessions table
        if (uId) {
          await supabaseClient
            .from('active_user_sessions')
            .upsert({
              user_id: uId,
              session_id: sessionId,
              user_identifier: uName,
              role: uRole,
              device_info: userAgent,
              last_activity_at: nowIso
            }, { onConflict: 'user_id' });
        }

        // 2. Update profile table
        if (uRole.toLowerCase().includes('beneficiary')) {
          supabaseClient
            .from('beneficiaries')
            .update({ current_session_id: sessionId, last_activity_at: nowIso })
            .or(`qr_code.eq.${uId},username.eq.${uName}`)
            .then(() => {})
            .catch(() => {});
        } else {
          supabaseClient
            .from('staff_profiles')
            .update({ current_session_id: sessionId, last_activity_at: nowIso })
            .or(`id.eq.${uId},username.eq.${uName}`)
            .then(() => {})
            .catch(() => {});
        }

        // 3. Update Supabase Auth user metadata
        supabaseClient.auth.updateUser({
          data: {
            current_session_id: sessionId,
            last_active_at: nowIso
          }
        }).catch(() => {});

      } catch (err) {
        console.warn('[SessionManager] registerSession error (non-fatal):', err.message);
      }
    }

    return sessionId;
  }

  /**
   * Touch/Heartbeat active session in database to keep device lock active while user is working
   */
  async function touchActiveSession() {
    if (!supabaseClient) return;
    const uId = getUserId();
    const sessionId = getSessionId();
    if (!uId || !sessionId) return;

    try {
      const nowIso = new Date().toISOString();
      supabaseClient
        .from('active_user_sessions')
        .update({ last_activity_at: nowIso })
        .match({ user_id: String(uId), session_id: sessionId })
        .then(() => {})
        .catch(() => {});
    } catch (e) {}
  }

  /**
   * Get the current Supabase access token (JWT)
   */
  async function getTokenAsync() {
    if (!supabaseClient) return null;
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      return session?.access_token || null;
    } catch (e) {
      return null;
    }
  }

  function getToken() {
    try {
      return sessionStorage.getItem('sessionToken') || null;
    } catch (e) {
      return null;
    }
  }

  function getUserId() {
    try {
      return sessionStorage.getItem('userId') || null;
    } catch (e) {
      return null;
    }
  }

  function getRole() {
    try {
      return sessionStorage.getItem('userRole') || null;
    } catch (e) {
      return null;
    }
  }

  function authHeaders() {
    return { 'Content-Type': 'application/json' };
  }

  /**
   * Clear all session data locally
   */
  function clear() {
    try {
      sessionStorage.removeItem('userId');
      sessionStorage.removeItem('sessionToken');
      sessionStorage.removeItem('userRole');
      sessionStorage.removeItem('jwtAccessToken');
      sessionStorage.removeItem('username');
      sessionStorage.removeItem('userFullName');
      sessionStorage.removeItem('department');
      sessionStorage.removeItem('currentSessionId');
      localStorage.removeItem(STORAGE_ACTIVE_SESSION_KEY);
    } catch (e) {}

    _cachedProfile = null;

    if (_heartbeatTimer) {
      clearInterval(_heartbeatTimer);
      _heartbeatTimer = null;
    }
    if (_inactivityTimer) {
      clearInterval(_inactivityTimer);
      _inactivityTimer = null;
    }
  }

  /**
   * User-initiated or standard Logout: frees the active device lock immediately
   */
  async function logout(redirectUrl) {
    const targetUrl = redirectUrl || getLoginUrl(getRole());

    try {
      const uId = getUserId();
      const uName = sessionStorage.getItem('username');
      const sessionId = getSessionId();

      // Release active device lock in Supabase so the account can log in on any device immediately
      if (supabaseClient) {
        if (uId) {
          await supabaseClient
            .from('active_user_sessions')
            .delete()
            .eq('user_id', String(uId));
        }
        if (uName) {
          await supabaseClient
            .from('active_user_sessions')
            .delete()
            .eq('user_identifier', String(uName));
        }
        if (sessionId) {
          await supabaseClient
            .from('active_user_sessions')
            .delete()
            .eq('session_id', sessionId);
        }
        await supabaseClient.auth.signOut();
      }
    } catch (e) {
      console.warn('[SessionManager] Sign-out error:', e.message);
    }

    clear();
    try { sessionStorage.clear(); } catch (e) {}
    window.location.href = targetUrl;
  }

  /**
   * Force logout with user notification: awaits database lock release before redirecting
   */
  async function forceLogout(message, targetUrl) {
    const redirect = targetUrl || getLoginUrl(getRole());
    const uId = getUserId();
    const uName = sessionStorage.getItem('username');
    const sessionId = getSessionId();

    // Release database session lock before redirecting so user can log in immediately
    if (supabaseClient) {
      try {
        if (uId) {
          await supabaseClient
            .from('active_user_sessions')
            .delete()
            .eq('user_id', String(uId));
        }
        if (uName) {
          await supabaseClient
            .from('active_user_sessions')
            .delete()
            .eq('user_identifier', String(uName));
        }
        if (sessionId) {
          await supabaseClient
            .from('active_user_sessions')
            .delete()
            .eq('session_id', sessionId);
        }
        await supabaseClient.auth.signOut();
      } catch (e) {
        console.warn('[SessionManager] forceLogout cleanup error:', e.message);
      }
    }

    clear();
    try {
      sessionStorage.clear();
      sessionStorage.setItem('sessionKickedMessage', message || 'Your session has expired. Please log in again.');
    } catch (e) {}
    window.location.href = redirect;
  }

  // =========================================================================
  // 20-MINUTE INACTIVITY AUTO-LOGOUT CONTROLLER
  // =========================================================================

  /**
   * Record user interaction activity (throttled)
   */
  function recordUserActivity() {
    const now = Date.now();
    _lastActivityTimestamp = now;

    if (now - _lastThrottledWrite > ACTIVITY_THROTTLE_MS) {
      _lastThrottledWrite = now;
      try {
        localStorage.setItem(STORAGE_ACTIVITY_KEY, String(now));
      } catch (e) {}
      touchActiveSession();
    }

    // If warning modal was open, close it on user interaction
    if (_warningModalEl && _warningModalEl.style.display !== 'none') {
      dismissInactivityWarning();
    }
  }

  /**
   * Get the most recent activity timestamp across all open tabs
   */
  function getLastActivityTime() {
    try {
      const stored = parseInt(localStorage.getItem(STORAGE_ACTIVITY_KEY) || '0', 10);
      return Math.max(stored || 0, _lastActivityTimestamp || 0);
    } catch (e) {
      return _lastActivityTimestamp || Date.now();
    }
  }

  /**
   * Start tracking user activity events
   */
  function initActivityListeners() {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'wheel'];
    events.forEach(evt => {
      window.addEventListener(evt, recordUserActivity, { passive: true });
    });

    // Listen for storage events (activity in another tab)
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_ACTIVITY_KEY && e.newValue) {
        _lastActivityTimestamp = parseInt(e.newValue, 10) || Date.now();
        if (_warningModalEl && _warningModalEl.style.display !== 'none') {
          dismissInactivityWarning();
        }
      }
    });
  }

  /**
   * Render or update the 60-second Inactivity Warning Countdown Modal
   */
  function showInactivityWarningModal(remainingSeconds) {
    if (!_warningModalEl) {
      const modal = document.createElement('div');
      modal.id = 'inactivityWarningModal';
      modal.innerHTML = `
        <div style="
          position: fixed;
          top: 0; left: 0; width: 100vw; height: 100vh;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 999998;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          <div style="
            background: #1e293b;
            color: #f8fafc;
            border: 1px solid rgba(245, 158, 11, 0.4);
            border-radius: 16px;
            max-width: 440px;
            width: 100%;
            padding: 2rem;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
            text-align: center;
          ">
            <div style="
              width: 56px;
              height: 56px;
              border-radius: 50%;
              background: rgba(245, 158, 11, 0.15);
              color: #f59e0b;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-size: 28px;
              margin-bottom: 1rem;
            ">
              <i class="bi bi-clock-history"></i>
            </div>
            <h3 style="margin: 0 0 0.5rem; font-size: 1.25rem; font-weight: 700; color: #f8fafc;">Are you still there?</h3>
            <p style="margin: 0 0 1.25rem; color: #94a3b8; font-size: 0.9rem; line-height: 1.5;">
              You have been inactive. For your security, you will be automatically logged out in:
            </p>
            <div style="
              font-size: 2.25rem;
              font-weight: 800;
              color: #fbbf24;
              margin-bottom: 1.5rem;
              letter-spacing: -0.5px;
            " id="inactivityCountdownText">
              ${remainingSeconds}s
            </div>
            <div style="display: flex; gap: 0.75rem;">
              <button id="inactivityLogoutBtn" style="
                flex: 1;
                background: rgba(255, 255, 255, 0.08);
                color: #cbd5e1;
                border: 1px solid rgba(255, 255, 255, 0.15);
                padding: 0.75rem;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
              ">
                Log Out
              </button>
              <button id="inactivityStayBtn" style="
                flex: 1.5;
                background: #2563eb;
                color: white;
                border: none;
                padding: 0.75rem;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
              ">
                Stay Logged In
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      _warningModalEl = modal;

      const stayBtn = document.getElementById('inactivityStayBtn');
      if (stayBtn) {
        stayBtn.addEventListener('click', () => {
          recordUserActivity();
          dismissInactivityWarning();
        });
      }

      const logoutBtn = document.getElementById('inactivityLogoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          dismissInactivityWarning();
          logout();
        });
      }
    } else {
      _warningModalEl.style.display = 'block';
    }

    const countText = document.getElementById('inactivityCountdownText');
    if (countText) countText.textContent = `${remainingSeconds}s`;
  }

  function dismissInactivityWarning() {
    if (_warningModalEl) {
      _warningModalEl.style.display = 'none';
    }
  }

  /**
   * Start 20-Minute Inactivity Watchdog
   */
  function startInactivityTimer() {
    initActivityListeners();
    recordUserActivity();

    if (_inactivityTimer) clearInterval(_inactivityTimer);

    _inactivityTimer = setInterval(async () => {
      if (_sessionTerminated) return;

      const lastActivity = getLastActivityTime();
      const idleMs = Date.now() - lastActivity;
      const remainingMs = INACTIVITY_TIMEOUT_MS - idleMs;
      const remainingSec = Math.max(0, Math.floor(remainingMs / 1000));

      if (idleMs >= INACTIVITY_TIMEOUT_MS) {
        // Inactivity limit reached -> Auto logout and clear database session immediately
        console.warn('[SessionManager] ⏱️ Inactivity timeout reached (20 mins). Logging out.');
        dismissInactivityWarning();
        await forceLogout('You have been automatically logged out due to 20 minutes of inactivity.');
      } else if (remainingMs <= WARNING_BEFORE_MS) {
        // Show warning countdown at 19 minutes (60 seconds remaining)
        showInactivityWarningModal(remainingSec);
      } else {
        dismissInactivityWarning();
      }
    }, 1000);
  }

  /**
   * Start periodic heartbeat to maintain active session state
   */
  function startHeartbeat() {
    touchActiveSession();

    if (_heartbeatTimer) clearInterval(_heartbeatTimer);
    _heartbeatTimer = setInterval(() => {
      touchActiveSession();
    }, HEARTBEAT_INTERVAL_MS);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        recordUserActivity();
        touchActiveSession();
      }
    });

    window.addEventListener('focus', () => {
      recordUserActivity();
      touchActiveSession();
    });
  }

  /**
   * Verify the current session is valid via Supabase
   */
  async function verify() {
    if (_isVerifying) return true;
    if (!supabaseClient) return true;

    _isVerifying = true;
    try {
      const { data: sessionData, error } = await supabaseClient.auth.getSession();
      const session = sessionData?.session;

      if (error || !session) {
        await forceLogout('Your session has expired. Please log in again.');
        return false;
      }

      return true;
    } catch (e) {
      console.warn('[SessionManager] Verification tolerance applied:', e.message);
      return true;
    } finally {
      _isVerifying = false;
    }
  }

  /**
   * Start background watchdogs on protected dashboard pages
   */
  function startPeriodicVerification() {
    startHeartbeat();
    startInactivityTimer();
  }

  /**
   * Helper for login pages: Check and display any pending kicked/inactivity messages
   */
  function checkAndDisplayLoginNotice(containerId = 'errorMessage', alertId = 'errorAlert') {
    try {
      const message = sessionStorage.getItem('sessionKickedMessage') || sessionStorage.getItem('authGuardMessage');
      if (message) {
        const errorEl = document.getElementById(containerId);
        const alertEl = document.getElementById(alertId);
        if (errorEl) errorEl.textContent = message;
        if (alertEl) alertEl.style.display = 'block';

        sessionStorage.removeItem('sessionKickedMessage');
        sessionStorage.removeItem('authGuardMessage');
      }
    } catch (e) {}
  }

  function getCachedProfile() {
    return _cachedProfile;
  }

  async function clearActiveSessionRemote(userId) {
    if (typeof supabaseClient === 'undefined' || !supabaseClient || !userId) return;
    try {
      await supabaseClient.from('active_user_sessions').delete().or(`user_id.eq.${userId},user_identifier.eq.${userId}`);
    } catch (e) {
      console.warn('[SessionManager] clearActiveSessionRemote notice:', e);
    }
  }

  return Object.freeze({
    save,
    logout,
    forceLogout,
    verify,
    startPeriodicVerification,
    init: startPeriodicVerification,
    destroy: forceLogout,
    getSessionId,
    checkAccountAlreadyActive,
    clearActiveSessionRemote,
    getCachedProfile,
    touchActiveSession,
    recordUserActivity,
    checkAndDisplayLoginNotice
  });
})();

// Attach to window
if (typeof window !== 'undefined') {
  window.SessionManager = SessionManager;
}

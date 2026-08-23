/**
 * Session Management & Security Watchdog — Supabase Edition
 * City Government of Koronadal — PESO & CSWDO Portals
 *
 * Enforces:
 *   1. Single Active Session Per User (Cross-Device Invalidation):
 *      Logging into an account on a new device immediately invalidates and logs out
 *      any older active session on other devices/browsers in real-time.
 *   2. 20-Minute Inactivity Auto-Logout:
 *      Monitors user interactions and automatically logs out inactive sessions after 20 minutes,
 *      with a synchronized 60-second countdown warning modal across all open tabs.
 *   3. Real-time Synchronization & Heartbeat:
 *      Leverages Supabase Realtime + local storage syncing + periodic server verification.
 */

const SessionManager = (() => {
  'use strict';

  // Constants
  const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
  const WARNING_BEFORE_MS = 60 * 1000;          // 60 seconds countdown
  const HEARTBEAT_INTERVAL_MS = 10 * 1000;      // 10 seconds check
  const ACTIVITY_THROTTLE_MS = 2000;            // 2 seconds throttle for activity events
  const STORAGE_ACTIVITY_KEY = 'peso_last_user_activity';
  const STORAGE_ACTIVE_SESSION_KEY = 'peso_active_session_id';

  // Internal state
  let _cachedProfile = null;
  let _heartbeatTimer = null;
  let _inactivityTimer = null;
  let _warningModalEl = null;
  let _warningInterval = null;
  let _lastActivityTimestamp = Date.now();
  let _lastThrottledWrite = 0;
  let _isVerifying = false;
  let _realtimeChannel = null;
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
   * Save session data locally and register the single active session
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

    // Register active session ID
    return await registerSession(userId, role, extra);
  }

  /**
   * Register a new active session in Supabase and local storage (Single Session Enforcement)
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

    // Persist to Supabase so other devices detect the login
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      try {
        const uId = String(userId || sessionStorage.getItem('userId') || '');
        const uRole = role || sessionStorage.getItem('userRole') || 'User';
        const uName = extra.username || sessionStorage.getItem('username') || '';
        const userAgent = navigator.userAgent || 'Web Browser';

        // 1. Update active_user_sessions table (Primary Single-Session Store)
        if (uId) {
          supabaseClient
            .from('active_user_sessions')
            .upsert({
              user_id: uId,
              session_id: sessionId,
              user_identifier: uName,
              role: uRole,
              device_info: userAgent,
              last_activity_at: nowIso
            }, { onConflict: 'user_id' })
            .then(({ error }) => {
              if (error) console.warn('[SessionManager] active_user_sessions upsert note:', error.message);
            })
            .catch(() => {});
        }

        // 2. Update staff_profiles / beneficiaries table directly
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

        // 4. Broadcast session claim on Realtime Channel
        broadcastSessionClaim(uId, sessionId);

      } catch (err) {
        console.warn('[SessionManager] registerSession error (non-fatal):', err.message);
      }
    }

    return sessionId;
  }

  /**
   * Broadcast active session takeover via Supabase Realtime Broadcast
   */
  function broadcastSessionClaim(userId, sessionId) {
    if (!supabaseClient || !userId) return;
    try {
      const channel = supabaseClient.channel(`user_session_broadcast_${userId}`);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'SESSION_CLAIMED',
            payload: { userId: userId, sessionId: sessionId, timestamp: Date.now() }
          });
        }
      });
    } catch (e) {
      console.warn('[SessionManager] Broadcast note:', e.message);
    }
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
      console.warn('[SessionManager] Failed to get token:', e.message);
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
    if (_warningInterval) {
      clearInterval(_warningInterval);
      _warningInterval = null;
    }
    if (_realtimeChannel && supabaseClient) {
      try {
        supabaseClient.removeChannel(_realtimeChannel);
      } catch (e) {}
      _realtimeChannel = null;
    }
  }

  /**
   * User-initiated or standard Logout
   */
  async function logout(redirectUrl) {
    const targetUrl = redirectUrl || getLoginUrl(getRole());

    try {
      const uId = getUserId();
      const currentSess = getSessionId();

      // Clear active session record in database
      if (supabaseClient && uId) {
        supabaseClient
          .from('active_user_sessions')
          .delete()
          .eq('user_id', uId)
          .then(() => {})
          .catch(() => {});
      }

      if (supabaseClient) {
        await supabaseClient.auth.signOut();
      }
    } catch (e) {
      console.warn('[SessionManager] Sign-out warning:', e.message);
    }

    clear();
    try { sessionStorage.clear(); } catch (e) {}
    window.location.href = targetUrl;
  }

  /**
   * Force logout with user notification
   */
  function forceLogout(message, targetUrl) {
    const redirect = targetUrl || getLoginUrl(getRole());
    clear();
    try {
      sessionStorage.clear();
      sessionStorage.setItem('sessionKickedMessage', message || 'Your session has expired. Please log in again.');
    } catch (e) {}
    window.location.href = redirect;
  }

  // =========================================================================
  // SINGLE ACTIVE SESSION TERMINATION OVERLAY
  // =========================================================================

  /**
   * Triggered when another device or tab registers a newer session
   */
  function handleRemoteSessionKicked() {
    if (_sessionTerminated) return;
    _sessionTerminated = true;

    console.warn('[SessionManager] ⚠️ Active session invalidated by another login.');

    // Clear background timers
    if (_heartbeatTimer) clearInterval(_heartbeatTimer);
    if (_inactivityTimer) clearInterval(_inactivityTimer);
    if (_warningInterval) clearInterval(_warningInterval);

    // Save kicked message for the login page
    const kickMessage = 'Your account was logged in on another device. This session has been terminated for your security.';
    try {
      sessionStorage.setItem('sessionKickedMessage', kickMessage);
      localStorage.setItem('peso_last_kick_reason', kickMessage);
    } catch (e) {}

    // Show unclosable termination modal
    showSessionKickedModal(kickMessage);
  }

  function showSessionKickedModal(message) {
    // Remove any existing modals
    const existing = document.getElementById('sessionKickedOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sessionKickedOverlay';
    overlay.innerHTML = `
      <div style="
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(15, 23, 42, 0.85);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      ">
        <div style="
          background: #1e293b;
          color: #f8fafc;
          border: 1px solid rgba(239, 68, 68, 0.4);
          border-radius: 16px;
          max-width: 460px;
          width: 100%;
          padding: 2rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
          text-align: center;
          animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        ">
          <div style="
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: rgba(239, 68, 68, 0.15);
            color: #ef4444;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            margin-bottom: 1.25rem;
          ">
            <i class="bi bi-shield-lock-fill"></i>
          </div>
          <h3 style="margin: 0 0 0.5rem; font-size: 1.35rem; font-weight: 700; color: #f8fafc;">Session Terminated</h3>
          <p style="margin: 0 0 1.5rem; color: #94a3b8; font-size: 0.95rem; line-height: 1.5;">
            ${message}
          </p>
          <div style="background: rgba(239, 68, 68, 0.1); border-radius: 8px; padding: 0.75rem; margin-bottom: 1.5rem; font-size: 0.85rem; color: #fca5a5;">
            <i class="bi bi-info-circle me-1"></i> Only one active session per account is permitted.
          </div>
          <button id="kickedRedirectBtn" style="
            background: #dc2626;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.95rem;
            width: 100%;
            cursor: pointer;
            transition: background 0.2s;
          ">
            Return to Login (<span id="kickCountdownSec">4</span>s)
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    let countdown = 4;
    const countEl = document.getElementById('kickCountdownSec');
    const redirectTarget = getLoginUrl(getRole());

    const timer = setInterval(() => {
      countdown--;
      if (countEl) countEl.textContent = String(countdown);
      if (countdown <= 0) {
        clearInterval(timer);
        clear();
        window.location.href = redirectTarget;
      }
    }, 1000);

    const btn = document.getElementById('kickedRedirectBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        clearInterval(timer);
        clear();
        window.location.href = redirectTarget;
      });
    }
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
    }

    // If warning modal was open, close it on user movement/activity
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
      if (e.key === STORAGE_ACTIVE_SESSION_KEY && e.newValue) {
        const mySession = sessionStorage.getItem('currentSessionId');
        if (mySession && e.newValue !== mySession) {
          handleRemoteSessionKicked();
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

    _inactivityTimer = setInterval(() => {
      if (_sessionTerminated) return;

      const lastActivity = getLastActivityTime();
      const idleMs = Date.now() - lastActivity;
      const remainingMs = INACTIVITY_TIMEOUT_MS - idleMs;
      const remainingSec = Math.max(0, Math.floor(remainingMs / 1000));

      if (idleMs >= INACTIVITY_TIMEOUT_MS) {
        // Inactivity limit reached -> Auto logout
        console.warn('[SessionManager] ⏱️ Inactivity timeout reached (20 mins). Logging out.');
        dismissInactivityWarning();
        forceLogout('You have been automatically logged out due to 20 minutes of inactivity.');
      } else if (remainingMs <= WARNING_BEFORE_MS) {
        // Show warning countdown at 19 minutes (60 seconds remaining)
        showInactivityWarningModal(remainingSec);
      } else {
        dismissInactivityWarning();
      }
    }, 1000);
  }

  // =========================================================================
  // SINGLE ACTIVE SESSION WATCHDOG & HEARTBEAT
  // =========================================================================

  /**
   * Check if remote session ID matches current local session ID
   */
  async function checkActiveSession() {
    if (_isVerifying || _sessionTerminated) return true;
    if (!supabaseClient) return true;

    const mySessionId = getSessionId();
    const userId = getUserId();
    const role = getRole();

    if (!mySessionId || !userId) return true;

    _isVerifying = true;
    try {
      // 1. Check active_user_sessions table
      const { data: activeSessionRecord, error } = await supabaseClient
        .from('active_user_sessions')
        .select('session_id, last_activity_at')
        .eq('user_id', String(userId))
        .maybeSingle();

      if (!error && activeSessionRecord && activeSessionRecord.session_id) {
        if (activeSessionRecord.session_id !== mySessionId) {
          handleRemoteSessionKicked();
          return false;
        }
      } else {
        // 2. Fallback check on user_metadata
        const { data: userData } = await supabaseClient.auth.getUser();
        const metaSessionId = userData?.user?.user_metadata?.current_session_id;
        if (metaSessionId && metaSessionId !== mySessionId) {
          handleRemoteSessionKicked();
          return false;
        }
      }

      return true;
    } catch (e) {
      console.warn('[SessionManager] checkActiveSession notice:', e.message);
      return true;
    } finally {
      _isVerifying = false;
    }
  }

  /**
   * Listen to Supabase Realtime channel for instant push invalidation
   */
  function setupRealtimeSessionListener(userId) {
    if (!supabaseClient || !userId || _realtimeChannel) return;

    try {
      const channelName = `user_session_watch_${userId}`;
      _realtimeChannel = supabaseClient.channel(channelName);

      // Listen for broadcast events
      _realtimeChannel.on('broadcast', { event: 'SESSION_CLAIMED' }, (payload) => {
        const payloadSessionId = payload?.payload?.sessionId;
        const mySessionId = getSessionId();
        if (payloadSessionId && mySessionId && payloadSessionId !== mySessionId) {
          handleRemoteSessionKicked();
        }
      });

      // Listen for postgres changes on active_user_sessions table
      _realtimeChannel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'active_user_sessions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newSessionId = payload?.new?.session_id;
          const mySessionId = getSessionId();
          if (newSessionId && mySessionId && newSessionId !== mySessionId) {
            handleRemoteSessionKicked();
          }
        }
      );

      _realtimeChannel.subscribe();
    } catch (e) {
      console.warn('[SessionManager] Realtime setup warning:', e.message);
    }
  }

  /**
   * Start periodic session verification and heartbeat
   */
  function startSessionWatchdog() {
    const userId = getUserId();
    if (userId) {
      setupRealtimeSessionListener(userId);
    }

    // Ensure session ID is initialized
    if (!getSessionId()) {
      registerSession(userId, getRole());
    }

    // Run initial active session verification
    checkActiveSession();

    // Check periodically
    if (_heartbeatTimer) clearInterval(_heartbeatTimer);
    _heartbeatTimer = setInterval(() => {
      checkActiveSession();
    }, HEARTBEAT_INTERVAL_MS);

    // Also check whenever tab becomes visible again
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        recordUserActivity();
        checkActiveSession();
      }
    });

    window.addEventListener('focus', () => {
      recordUserActivity();
      checkActiveSession();
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
        forceLogout('Your session has expired. Please log in again.');
        return false;
      }

      // Check single active session concurrency
      return await checkActiveSession();
    } catch (e) {
      console.warn('[SessionManager] Verification tolerance applied:', e.message);
      return true;
    } finally {
      _isVerifying = false;
    }
  }

  /**
   * Start all background watchdogs on protected pages
   */
  function startPeriodicVerification() {
    startSessionWatchdog();
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

        // Clear after displaying
        sessionStorage.removeItem('sessionKickedMessage');
        sessionStorage.removeItem('authGuardMessage');
      }
    } catch (e) {}
  }

  function getCachedProfile() {
    return _cachedProfile;
  }

  return Object.freeze({
    save,
    registerSession,
    getSessionId,
    getToken,
    getTokenAsync,
    getUserId,
    getRole,
    authHeaders,
    clear,
    logout,
    forceLogout,
    verify,
    checkActiveSession,
    startSessionWatchdog,
    startInactivityTimer,
    startPeriodicVerification,
    checkAndDisplayLoginNotice,
    getCachedProfile
  });
})();

// Attach to window
if (typeof window !== 'undefined') {
  window.SessionManager = SessionManager;
}

/**
 * Session Management Helper
 * 
 * Handles storage and verification of session tokens for single-session enforcement.
 * When a user logs in on another device, their session token in the database changes,
 * and this script detects the mismatch and forces a logout on the stale session.
 *
 * Usage:
 *   1. After login, call: SessionManager.save(userId, sessionToken, role)
 *   2. On any protected page, call: SessionManager.verify() — redirects to login if invalid
 *   3. On logout, call: SessionManager.logout()
 */

const SessionManager = (() => {
  'use strict';

  const STORAGE_KEYS = {
    USER_ID: 'userId',
    SESSION_TOKEN: 'sessionToken',
    USER_ROLE: 'userRole'
  };

  // How often to verify the session against the database (in milliseconds)
  const VERIFY_INTERVAL_MS = 60 * 1000; // every 60 seconds

  let _verifyTimer = null;

  /**
   * Save session data after a successful login
   */
  function save(userId, sessionToken, role) {
    sessionStorage.setItem(STORAGE_KEYS.USER_ID, userId);
    sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, sessionToken);
    sessionStorage.setItem(STORAGE_KEYS.USER_ROLE, role);
  }

  /**
   * Get the current session token
   */
  function getToken() {
    return sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
  }

  /**
   * Get the current user ID
   */
  function getUserId() {
    return sessionStorage.getItem(STORAGE_KEYS.USER_ID);
  }

  /**
   * Get the current user role
   */
  function getRole() {
    return sessionStorage.getItem(STORAGE_KEYS.USER_ROLE);
  }

  /**
   * Build headers for authenticated API requests
   */
  function authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const userId = getUserId();
    const token = getToken();
    if (userId) headers['X-User-Id'] = userId;
    if (token) headers['X-Session-Token'] = token;
    return headers;
  }

  /**
   * Clear all session data
   */
  function clear() {
    sessionStorage.removeItem(STORAGE_KEYS.USER_ID);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.USER_ROLE);
    if (_verifyTimer) {
      clearInterval(_verifyTimer);
      _verifyTimer = null;
    }
  }

  /**
   * Logout: clear session client-side and notify the server
   */
  async function logout(redirectUrl) {
    const userId = getUserId();
    const token = getToken();

    // Notify server to clear the session token
    if (userId) {
      try {
        await fetch(API_CONFIG.BASE_URL + '/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, sessionToken: token })
        });
      } catch (e) {
        // Best-effort — don't block logout if server is unreachable
        console.warn('[SessionManager] Logout API call failed:', e.message);
      }
    }

    // Clear everything client-side
    clear();
    sessionStorage.clear();

    // Redirect to login
    window.location.href = redirectUrl || 'official_login.html';
  }

  /**
   * Force logout with a user-visible message (for session-kicked scenarios)
   */
  function forceLogout(message) {
    clear();
    sessionStorage.clear();
    // Store the kick message so the login page can display it
    sessionStorage.setItem('sessionKickedMessage', message || 'Your session has expired because your account was logged in from another device.');
    window.location.href = 'official_login.html';
  }

  /**
   * Verify the current session against the database
   * Redirects to login if the session has been invalidated
   */
  async function verify() {
    const userId = getUserId();
    const token = getToken();

    if (!userId || !token) {
      forceLogout('Please log in to continue.');
      return false;
    }

    try {
      const response = await fetch(API_CONFIG.BASE_URL + '/api/auth/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessionToken: token })
      });

      const data = await response.json();

      if (!response.ok || data.kicked) {
        forceLogout(data.message);
        return false;
      }

      return true;
    } catch (e) {
      // Network error — don't kick the user, just log it
      console.warn('[SessionManager] Session verification failed (network):', e.message);
      return true; // Assume valid if we can't reach the server
    }
  }

  /**
   * Start periodic session verification (call on protected pages)
   */
  function startPeriodicVerification() {
    // Verify immediately on page load
    verify();

    // Then verify at regular intervals
    if (_verifyTimer) clearInterval(_verifyTimer);
    _verifyTimer = setInterval(() => {
      verify();
    }, VERIFY_INTERVAL_MS);
  }

  return Object.freeze({
    save,
    getToken,
    getUserId,
    getRole,
    authHeaders,
    clear,
    logout,
    forceLogout,
    verify,
    startPeriodicVerification
  });
})();

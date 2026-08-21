/**
 * Session Management Helper — Supabase Edition
 *
 * Replaces the old Railway/Express session-token system with Supabase Auth.
 * Supabase handles JWT tokens, refresh, and session persistence automatically.
 *
 * This module provides a backward-compatible API so existing code that calls
 * SessionManager.getRole(), SessionManager.getUserId(), etc. continues to work.
 *
 * Usage:
 *   1. After login, session is auto-managed by Supabase (no manual save needed)
 *   2. On any protected page, call: SessionManager.verify() — redirects to login if invalid
 *   3. On logout, call: SessionManager.logout()
 */

const SessionManager = (() => {
  'use strict';

  // Cache for the user's profile data
  let _cachedProfile = null;
  let _verifyTimer = null;
  let _isVerifying = false;
  let _failedVerifyCooldownUntil = 0;
  let _lastVerifySuccessTime = 0;
  const VERIFY_INTERVAL_MS = 60 * 1000; // 60 seconds
  const FAIL_COOLDOWN_MS = 10 * 1000;   // 10 seconds cooldown on failure

  /**
   * Save session data after a successful login.
   * With Supabase, the session is auto-persisted. This method caches
   * profile data locally for quick access by dashboard scripts.
   */
  function save(userId, sessionToken, role) {
    try {
      sessionStorage.setItem('userId', userId);
      sessionStorage.setItem('userRole', role);
      sessionStorage.setItem('sessionToken', sessionToken || 'supabase-managed');
    } catch (e) {
      console.warn('[SessionManager] Could not save session storage:', e);
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

  /**
   * Get the session token (synchronous — from cache/sessionStorage)
   */
  function getToken() {
    try {
      return sessionStorage.getItem('sessionToken') || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Get the current user ID (profile ID from staff_profiles or qr_code from beneficiaries)
   */
  function getUserId() {
    try {
      return sessionStorage.getItem('userId') || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Get the current user role
   */
  function getRole() {
    try {
      return sessionStorage.getItem('userRole') || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Build headers for authenticated API requests.
   * With Supabase, the client handles auth headers automatically.
   * This is kept for backward compatibility with any custom fetch calls.
   */
  function authHeaders() {
    return { 'Content-Type': 'application/json' };
  }

  /**
   * Clear all session data
   */
  function clear() {
    try {
      const keys = ['userId', 'sessionToken', 'userRole', 'jwtAccessToken', 'username', 'userFullName', 'department', 'currentUser'];
      keys.forEach(k => {
        sessionStorage.removeItem(k);
        localStorage.removeItem(k);
      });
    } catch (e) { }
    _cachedProfile = null;
    if (_verifyTimer) {
      clearInterval(_verifyTimer);
      _verifyTimer = null;
    }
  }

  /**
   * Logout: sign out via Supabase Auth and clear local session data
   */
  async function logout(redirectUrl) {
    const currentRole = getRole();
    try {
      if (supabaseClient) {
        await supabaseClient.auth.signOut();
        console.log('[SessionManager] Supabase sign-out successful.');
      }
    } catch (e) {
      console.warn('[SessionManager] Sign-out error (best-effort):', e.message);
    }

    // Clear everything client-side
    clear();
    try { sessionStorage.clear(); } catch (e) { }

    // Redirect to proper login
    let target = redirectUrl;
    if (!target) {
      target = (currentRole && currentRole.toLowerCase().includes('beneficiary')) ? 'official_login.html' : 'admin_login.html';
    }
    window.location.href = target;
  }

  /**
   * Force logout with a user-visible message
   */
  function forceLogout(message) {
    const currentRole = getRole();
    clear();
    try {
      sessionStorage.clear();
      sessionStorage.setItem('authGuardMessage', message || 'Your session has expired. Please log in again.');
    } catch (e) { }
    const target = (currentRole && currentRole.toLowerCase().includes('beneficiary')) ? 'official_login.html' : 'admin_login.html';
    window.location.href = target;
  }

  /**
   * Verify the current session is still valid via Supabase with guard clauses
   */
  async function verify() {
    // 1. Concurrency Guard: Avoid overlapping verification calls
    if (_isVerifying) return true;

    // 2. Failure Backoff Guard: Don't hammer Supabase if in cooldown
    const now = Date.now();
    if (now < _failedVerifyCooldownUntil) {
      return true;
    }

    // 3. Client Availability Guard
    if (!supabaseClient) {
      return true;
    }

    _isVerifying = true;
    try {
      const { data: sessionData, error } = await supabaseClient.auth.getSession();
      const session = sessionData?.session;

      if (error || !session) {
        console.warn('[SessionManager] No valid active Supabase session found.');
        _failedVerifyCooldownUntil = Date.now() + FAIL_COOLDOWN_MS;
        forceLogout('Your session has expired. Please log in again.');
        return false;
      }

      // Session is valid — update cached data
      _lastVerifySuccessTime = Date.now();
      const { data: userData } = await supabaseClient.auth.getUser();
      const user = userData?.user;
      if (user) {
        // Try staff_profiles first
        let profile = null;
        try {
          const { data: staffProfile } = await supabaseClient
            .from('staff_profiles')
            .select('id, role, status, first_name, last_name')
            .eq('auth_id', user.id)
            .maybeSingle();

          if (staffProfile) {
            profile = staffProfile;
          } else {
            // Try beneficiaries table
            const { data: benProfile } = await supabaseClient
              .from('beneficiaries')
              .select('qr_code, status, first_name, last_name')
              .eq('auth_id', user.id)
              .maybeSingle();

            if (benProfile) {
              profile = { id: benProfile.qr_code, role: 'Beneficiary', status: benProfile.status, first_name: benProfile.first_name, last_name: benProfile.last_name };
            }
          }
        } catch (dbErr) {
          console.warn('[SessionManager] Profile query warning:', dbErr);
        }

        if (profile) {
          _cachedProfile = profile;
          try {
            sessionStorage.setItem('userId', profile.id);
            sessionStorage.setItem('userRole', profile.role);
          } catch (e) { }

          // Check if account was deactivated
          if (profile.status === 'Deactivated' || profile.status === 'Inactive') {
            await supabaseClient.auth.signOut();
            forceLogout('Your account has been deactivated.');
            return false;
          }
        }
      }

      return true;
    } catch (e) {
      console.warn('[SessionManager] Session verification failed (offline tolerance applied):', e.message);
      _failedVerifyCooldownUntil = Date.now() + FAIL_COOLDOWN_MS;
      return true;
    } finally {
      _isVerifying = false;
    }
  }

  /**
   * Start periodic session verification (call on protected pages)
   */
  function startPeriodicVerification() {
    // Verify on page load
    verify();

    // Then verify at regular intervals
    if (_verifyTimer) clearInterval(_verifyTimer);
    _verifyTimer = setInterval(() => {
      verify();
    }, VERIFY_INTERVAL_MS);
  }

  /**
   * Get cached profile data
   */
  function getCachedProfile() {
    return _cachedProfile;
  }

  return Object.freeze({
    save,
    getToken,
    getTokenAsync,
    getUserId,
    getRole,
    authHeaders,
    clear,
    logout,
    forceLogout,
    verify,
    startPeriodicVerification,
    getCachedProfile
  });
})();

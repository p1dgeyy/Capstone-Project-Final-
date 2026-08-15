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
  const VERIFY_INTERVAL_MS = 60 * 1000; // 60 seconds

  /**
   * Save session data after a successful login.
   * With Supabase, the session is auto-persisted. This method caches
   * profile data locally for quick access by dashboard scripts.
   */
  function save(userId, sessionToken, role) {
    sessionStorage.setItem('userId', userId);
    sessionStorage.setItem('userRole', role);
    // sessionToken is managed by Supabase internally — we store it for backward compat
    sessionStorage.setItem('sessionToken', sessionToken || 'supabase-managed');
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
    return sessionStorage.getItem('sessionToken') || null;
  }

  /**
   * Get the current user ID (profile ID from staff_profiles or qr_code from beneficiaries)
   */
  function getUserId() {
    return sessionStorage.getItem('userId') || null;
  }

  /**
   * Get the current user role
   */
  function getRole() {
    return sessionStorage.getItem('userRole') || null;
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
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('sessionToken');
    sessionStorage.removeItem('userRole');
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
    sessionStorage.clear();

    // Redirect to login
    window.location.href = redirectUrl || 'official_login.html';
  }

  /**
   * Force logout with a user-visible message
   */
  function forceLogout(message) {
    clear();
    sessionStorage.clear();
    sessionStorage.setItem('sessionKickedMessage', message || 'Your session has expired. Please log in again.');
    window.location.href = 'official_login.html';
  }

  /**
   * Verify the current session is still valid via Supabase
   */
  async function verify() {
    if (!supabaseClient) {
      console.warn('[SessionManager] Supabase client not available, skipping verification.');
      return true;
    }

    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession();

      if (error || !session) {
        console.warn('[SessionManager] No valid session found.');
        forceLogout('Your session has expired. Please log in again.');
        return false;
      }

      // Session is valid — update cached data
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        // Try staff_profiles first
        let profile = null;
        const { data: staffProfile } = await supabaseClient
          .from('staff_profiles')
          .select('id, role, status, first_name, last_name')
          .eq('auth_id', user.id)
          .single();

        if (staffProfile) {
          profile = staffProfile;
        } else {
          // Try beneficiaries table
          const { data: benProfile } = await supabaseClient
            .from('beneficiaries')
            .select('qr_code, status, first_name, last_name')
            .eq('auth_id', user.id)
            .single();

          if (benProfile) {
            profile = { id: benProfile.qr_code, role: 'Beneficiary', status: benProfile.status, first_name: benProfile.first_name, last_name: benProfile.last_name };
          }
        }

        if (profile) {
          _cachedProfile = profile;
          // Update sessionStorage for backward compat
          sessionStorage.setItem('userId', profile.id);
          sessionStorage.setItem('userRole', profile.role);

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
      console.warn('[SessionManager] Session verification failed:', e.message);
      // Network error — keep session active (offline tolerance)
      return true;
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

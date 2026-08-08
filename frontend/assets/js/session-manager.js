/**
 * Session Management Helper — Dual Express Session & Supabase Support
 *
 * Provides robust authentication and session persistence for:
 * 1. Express Session (HttpOnly cookies + JWT tokens)
 * 2. Supabase Auth (for beneficiary/cloud workflows)
 * 3. Backward-compatible API for getRole(), getUserId(), getToken(), verify(), logout()
 */

const SessionManager = (() => {
  'use strict';

  // Cache for the user's profile data
  let _cachedProfile = null;
  let _verifyTimer = null;
  const VERIFY_INTERVAL_MS = 60 * 1000; // 60 seconds

  function getApiBase() {
    return (typeof API_CONFIG !== 'undefined' && API_CONFIG.BASE_URL) || window.__API_BASE_URL__ || window.API_BASE_URL || '';
  }

  /**
   * Save session data after a successful login.
   */
  function save(userId, sessionToken, role, extraProfile = {}) {
    if (userId) {
      sessionStorage.setItem('userId', userId);
      localStorage.setItem('peso_userId', userId);
    }
    if (role) {
      sessionStorage.setItem('userRole', role);
      localStorage.setItem('peso_userRole', role);
    }
    if (sessionToken) {
      sessionStorage.setItem('sessionToken', sessionToken);
      sessionStorage.setItem('jwtAccessToken', sessionToken);
      localStorage.setItem('peso_jwtToken', sessionToken);
    }
    if (extraProfile.username) {
      sessionStorage.setItem('username', extraProfile.username);
    }
    if (extraProfile.fullName) {
      sessionStorage.setItem('userFullName', extraProfile.fullName);
    }

    _cachedProfile = {
      id: userId,
      role: role,
      ...extraProfile
    };
  }

  /**
   * Get the current access token (JWT)
   */
  function getToken() {
    return sessionStorage.getItem('jwtAccessToken') ||
           sessionStorage.getItem('sessionToken') ||
           localStorage.getItem('peso_jwtToken') ||
           null;
  }

  /**
   * Get access token asynchronously (from local storage or Supabase)
   */
  async function getTokenAsync() {
    const localToken = getToken();
    if (localToken && localToken !== 'supabase-managed') return localToken;

    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        return session?.access_token || localToken;
      } catch (e) {
        console.warn('[SessionManager] Failed to get Supabase token:', e.message);
      }
    }
    return localToken;
  }

  /**
   * Get the current user ID
   */
  function getUserId() {
    return sessionStorage.getItem('userId') || localStorage.getItem('peso_userId') || null;
  }

  /**
   * Get the current user role
   */
  function getRole() {
    return sessionStorage.getItem('userRole') || localStorage.getItem('peso_userRole') || null;
  }

  /**
   * Build headers for authenticated API requests
   */
  function authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token && token !== 'supabase-managed') {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Clear all session data
   */
  function clear() {
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('sessionToken');
    sessionStorage.removeItem('jwtAccessToken');
    sessionStorage.removeItem('jwtRefreshToken');
    sessionStorage.removeItem('userRole');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('userFullName');
    
    localStorage.removeItem('peso_userId');
    localStorage.removeItem('peso_userRole');
    localStorage.removeItem('peso_jwtToken');

    _cachedProfile = null;
    if (_verifyTimer) {
      clearInterval(_verifyTimer);
      _verifyTimer = null;
    }
  }

  /**
   * Logout: destroys backend session, signs out Supabase, clears storage, and redirects
   */
  async function logout(redirectUrl) {
    const apiBase = getApiBase();

    // 1. Terminate Backend Express Session
    try {
      await fetch(`${apiBase}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders()
      });
    } catch (e) {
      console.warn('[SessionManager] Backend logout notice:', e.message);
    }

    // 2. Sign out Supabase
    try {
      if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        await supabaseClient.auth.signOut();
      }
    } catch (e) {
      console.warn('[SessionManager] Supabase sign-out notice:', e.message);
    }

    // 3. Clear storage client-side
    clear();

    const target = redirectUrl || (getRole() === 'Beneficiary' ? 'official_login.html' : 'admin_login.html');
    window.location.href = target;
  }

  /**
   * Force logout with a user-visible message
   */
  function forceLogout(message) {
    clear();
    sessionStorage.setItem('sessionKickedMessage', message || 'Your session has expired. Please log in again.');
    window.location.href = 'admin_login.html';
  }

  /**
   * Verify the current session is still valid
   */
  async function verify() {
    const apiBase = getApiBase();

    // STEP 1: Verify with Express Backend (/api/auth/me) with credentials & token
    try {
      const response = await fetch(`${apiBase}/api/auth/me`, {
        method: 'GET',
        credentials: 'include',
        headers: authHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          const u = data.user;
          if (u.status === 'Deactivated' || u.status === 'Archived' || u.status === 'Inactive') {
            forceLogout('Your account has been deactivated. Please contact your administrator.');
            return false;
          }

          _cachedProfile = u;
          sessionStorage.setItem('userId', u.id);
          sessionStorage.setItem('userRole', u.role);
          sessionStorage.setItem('username', u.username);
          if (u.fullName) sessionStorage.setItem('userFullName', u.fullName);
          return true;
        }
      } else if (response.status === 403) {
        forceLogout('Your account has been deactivated.');
        return false;
      }
    } catch (err) {
      console.warn('[SessionManager] Backend verify check fallback:', err.message);
    }

    // STEP 2: Fallback to Supabase Auth if initialized
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (!error && session) {
          const { data: { user } } = await supabaseClient.auth.getUser();
          if (user) {
            const { data: staffProfile } = await supabaseClient
              .from('staff_profiles')
              .select('id, role, status, first_name, last_name, username')
              .eq('auth_id', user.id)
              .maybeSingle();

            if (staffProfile) {
              if (staffProfile.status === 'Deactivated' || staffProfile.status === 'Inactive') {
                await supabaseClient.auth.signOut();
                forceLogout('Your account has been deactivated.');
                return false;
              }
              _cachedProfile = staffProfile;
              sessionStorage.setItem('userId', staffProfile.id);
              sessionStorage.setItem('userRole', staffProfile.role);
              return true;
            }
          }
        }
      } catch (e) {
        console.warn('[SessionManager] Supabase verify fallback notice:', e.message);
      }
    }

    // STEP 3: Check cached session credentials
    const localRole = getRole();
    const localId = getUserId();
    const localToken = getToken();

    if (localRole && localId && localToken) {
      return true; // Session active
    }

    // No valid session found
    return false;
  }

  /**
   * Start periodic session verification
   */
  function startPeriodicVerification() {
    verify();
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

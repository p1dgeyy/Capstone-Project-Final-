/**
 * Auth Guard — Route Protection Hook + Initialization Safeguard
 *
 * Include this script on every protected dashboard page (or on the login
 * pages, where it does nothing but is safe to include) to enforce:
 *   1. Valid Supabase session (redirects to login if none)
 *   2. Role-based access control (Admin/Officer/Beneficiary only — no
 *      standalone "Evaluator" role; Officers perform that function)
 *   3. Correct portal separation: Admins/Officers -> Staff Login only,
 *      Beneficiaries -> Beneficiary Login only
 *   4. Auto-redirect on sign-out events
 *   5. Safe handling of missing session keys / DB errors — never throws
 *      an unhandled exception into the page.
 *
 * Usage:
 *   Add to any protected page's <head>, AFTER supabase-config.js:
 *     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *     <script src="assets/js/supabase-config.js"></script>
 *     <script src="assets/js/auth-guard.js"></script>
 *
 *   This file auto-runs a guard check on DOMContentLoaded for any page
 *   listed in PAGE_ROLE_MAP below — no extra call needed. If you need a
 *   guard on a page NOT in the map, call AuthGuard.requireRole([...])
 *   manually from that page's own script.
 */

const AuthGuard = (() => {
  'use strict';

  // Map of pages to their allowed roles.
  // NOTE: 'Evaluator' is no longer a standalone role — Officers (PESO/CSWDO)
  // perform the evaluator function, so evaluator.html is allowed for Officers.
  const PAGE_ROLE_MAP = {
    'beneficiary.html': ['Beneficiary'],
    'beneficiary_dashboard.html': ['Beneficiary'],
    'peso_officer.html': ['PESO Officer', 'PESO Admin'],
    'peso_admin.html': ['PESO Admin'],
    'cswdo_officer.html': ['CSWDO Officer', 'CSWDO Admin'],
    'cswdo_admin.html': ['CSWDO Admin'],
    'evaluator.html': ['PESO Officer', 'CSWDO Officer', 'PESO Admin', 'CSWDO Admin']
  };

  // Role -> correct login portal. Used to bounce a user back to the RIGHT
  // login page rather than a generic error if they land somewhere invalid.
  const ROLE_LOGIN_MAP = {
    'Beneficiary': 'official_login.html',
    'PESO Admin': 'admin_login.html',
    'PESO Officer': 'admin_login.html',
    'CSWDO Admin': 'admin_login.html',
    'CSWDO Officer': 'admin_login.html'
  };

  // Roles allowed on the Staff Login portal (admin_login.html) vs the
  // Beneficiary portal (official_login.html). Exported so the login pages
  // themselves can enforce the same rule without duplicating the list.
  const STAFF_ROLES = ['PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer'];
  const BENEFICIARY_ROLES = ['Beneficiary'];

  let _currentUserProfile = null;
  let _authStateListener = null;

  function getCurrentPage() {
    try {
      const path = window.location.pathname;
      return path.substring(path.lastIndexOf('/') + 1) || 'index.html';
    } catch (e) {
      return 'index.html';
    }
  }

  function getLoginPage() {
    const page = getCurrentPage();
    if (page.includes('beneficiary')) return 'official_login.html';
    return 'admin_login.html';
  }

  function redirectToLogin(message) {
    try {
      if (message) sessionStorage.setItem('authGuardMessage', message);
    } catch (e) {
      // sessionStorage may be unavailable (private browsing, etc.) — non-fatal
      console.warn('[AUTH_GUARD] Could not persist redirect message:', e.message);
    }
    window.location.href = getLoginPage();
  }

  /**
   * Fetch the current user's profile from Backend Session or Supabase.
   * Never throws — returns null on failure so callers can degrade gracefully.
   */
  async function fetchUserProfile() {
    const apiBase = (typeof API_CONFIG !== 'undefined' && API_CONFIG.BASE_URL) || window.__API_BASE_URL__ || window.API_BASE_URL || '';

    // 1. Try Backend Session & Token (/api/auth/me) with credentials & token
    try {
      const headers = typeof SessionManager !== 'undefined' && SessionManager.authHeaders ? SessionManager.authHeaders() : { 'Content-Type': 'application/json' };
      const response = await fetch(`${apiBase}/api/auth/me`, {
        method: 'GET',
        credentials: 'include',
        headers: headers
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          _currentUserProfile = data.user;
          return data.user;
        }
      }
    } catch (e) {
      console.warn('[AUTH_GUARD] Backend auth/me check note:', e.message);
    }

    // 2. Check SessionManager Cache / sessionStorage
    if (typeof SessionManager !== 'undefined') {
      const cached = SessionManager.getCachedProfile();
      if (cached && cached.role) {
        _currentUserProfile = cached;
        return cached;
      }
    }

    const localRole = sessionStorage.getItem('userRole') || localStorage.getItem('peso_userRole');
    const localId = sessionStorage.getItem('userId') || localStorage.getItem('peso_userId');
    const localUser = sessionStorage.getItem('username');
    const localName = sessionStorage.getItem('userFullName');

    if (localRole && localId) {
      _currentUserProfile = {
        id: localId,
        role: localRole,
        username: localUser || 'administrator',
        fullName: localName || 'Administrator',
        status: 'Active'
      };
      return _currentUserProfile;
    }

    // 3. Fallback to Supabase Auth if available
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      try {
        const { data: userData, error: userError } = await supabaseClient.auth.getUser();
        const user = userData?.user;
        if (!userError && user) {
          let profile = null;
          const { data: staffProfile } = await supabaseClient
            .from('staff_profiles')
            .select('*')
            .eq('auth_id', user.id)
            .maybeSingle();

          if (staffProfile) {
            profile = staffProfile;
          } else {
            const { data: benProfile } = await supabaseClient
              .from('beneficiaries')
              .select('*')
              .eq('auth_id', user.id)
              .maybeSingle();

            if (benProfile) {
              profile = { ...benProfile, role: 'Beneficiary', id: benProfile.qr_code };
            }
          }

          if (profile) {
            _currentUserProfile = profile;
            return profile;
          }
        }
      } catch (err) {
        console.warn('[AUTH_GUARD] Supabase user fetch note:', err?.message || err);
      }
    }

    return null;
  }

  /**
   * Require a valid, active session. Redirects to login if missing/invalid.
   */
  async function requireAuth() {
    try {
      // Check session via SessionManager or backend/local
      const profile = await fetchUserProfile();

      if (!profile) {
        redirectToLogin('Please log in to continue.');
        return false;
      }

      if (profile.status === 'Deactivated' || profile.status === 'Inactive' || profile.status === 'Archived') {
        if (typeof SessionManager !== 'undefined' && SessionManager.clear) {
          SessionManager.clear();
        }
        redirectToLogin('Your account has been deactivated. Please contact your administrator.');
        return false;
      }

      setupAuthStateListener();
      return true;

    } catch (err) {
      console.error('[AUTH_GUARD] requireAuth error (handled safely):', err?.message || err);
      redirectToLogin('A system error occurred. Please log in again.');
      return false;
    }
  }

  /**
   * Require the session's role to be one of allowedRoles. Redirects to the
   * user's OWN correct dashboard if access is not allowed.
   */
  async function requireRole(allowedRoles) {
    const isAuthenticated = await requireAuth();
    if (!isAuthenticated) return false;

    const userRole = _currentUserProfile?.role || sessionStorage.getItem('userRole') || 'Unknown';

    if (!allowedRoles.includes(userRole)) {
      console.warn(`[AUTH_GUARD] Access denied. Role "${userRole}" not in allowed roles:`, allowedRoles);

      const redirectPage = getRoleDashboard(userRole);
      if (redirectPage && redirectPage !== getCurrentPage()) {
        window.location.href = redirectPage;
      } else {
        redirectToLogin('You do not have permission to access this page.');
      }
      return false;
    }

    return true;
  }

  /**
   * Auto-detect allowed roles for the current page and enforce them.
   */
  async function autoGuard() {
    try {
      const page = getCurrentPage();
      const allowedRoles = PAGE_ROLE_MAP[page];

      if (allowedRoles) {
        return await requireRole(allowedRoles);
      }
      return true;
    } catch (err) {
      console.error('[AUTH_GUARD] autoGuard failed (handled safely):', err?.message || err);
      return false;
    }
  }

  function getRoleDashboard(role) {
    const map = {
      'PESO Admin': 'peso_admin.html',
      'PESO Officer': 'peso_officer.html',
      'CSWDO Admin': 'cswdo_admin.html',
      'CSWDO Officer': 'cswdo_officer.html',
      'Beneficiary': 'beneficiary.html'
    };
    return map[role] || null;
  }

  function setupAuthStateListener() {
    if (_authStateListener || typeof supabaseClient === 'undefined' || !supabaseClient) return;
    try {
      _authStateListener = supabaseClient.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          _currentUserProfile = null;
          redirectToLogin('You have been signed out.');
        }
      });
    } catch (e) {
      console.warn('[AUTH_GUARD] Could not attach auth state listener:', e.message);
    }
  }

  function getProfile() { return _currentUserProfile; }
  function getRole() { return _currentUserProfile?.role || null; }
  function getDisplayName() {
    if (!_currentUserProfile) return '';
    return `${_currentUserProfile.first_name || ''} ${_currentUserProfile.last_name || ''}`.trim();
  }

  return Object.freeze({
    requireAuth,
    requireRole,
    autoGuard,
    getProfile,
    getRole,
    getDisplayName,
    getRoleDashboard,
    fetchUserProfile,
    redirectToLogin,
    STAFF_ROLES,
    BENEFICIARY_ROLES
  });
})();

// -----------------------------------------------------------------------------
// INITIALIZATION SAFEGUARD: automatically runs the guard on every protected
// page as soon as the DOM is ready — no need to remember to call it manually
// on each dashboard page. Wrapped in try/catch so a failure here can never
// break page rendering.
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  try {
    AuthGuard.autoGuard();
  } catch (err) {
    console.error('[AUTH_GUARD] Init hook failed (handled safely):', err?.message || err);
  }
});

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
   * Fetch the current user's profile from Supabase.
   * Never throws — returns null on any failure so callers can degrade
   * gracefully instead of crashing.
   */
  async function fetchUserProfile() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
      console.error('[AUTH_GUARD] Supabase client not available.');
      return null;
    }

    try {
      const { data: userData, error: userError } = await supabaseClient.auth.getUser();
      const user = userData?.user;
      if (userError || !user) {
        return null;
      }

      let profile = null;

      const { data: staffProfile, error: staffError } = await supabaseClient
        .from('staff_profiles')
        .select('*')
        .eq('auth_id', user.id)
        .maybeSingle();

      if (!staffError && staffProfile) {
        profile = staffProfile;
      } else {
        const { data: benProfile, error: benError } = await supabaseClient
          .from('beneficiaries')
          .select('*')
          .eq('auth_id', user.id)
          .maybeSingle();

        if (!benError && benProfile) {
          profile = { ...benProfile, role: 'Beneficiary', id: benProfile.qr_code };
        }
      }

      if (!profile) {
        console.warn('[AUTH_GUARD] No staff_profiles or beneficiaries row for auth user:', user.id);
        return null;
      }

      _currentUserProfile = profile;
      return profile;
    } catch (err) {
      // Covers network errors, RLS errors, malformed rows, etc.
      console.error('[AUTH_GUARD] Error fetching profile (handled safely):', err?.message || err);
      return null;
    }
  }

  /**
   * Require a valid, active session. Redirects to login if missing/invalid.
   * Wrapped so a database error never becomes an unhandled exception —
   * worst case, it fails safe by sending the user to login.
   */
  async function requireAuth() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
      redirectToLogin('System error: authentication service unavailable.');
      return false;
    }

    try {
      const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
      const session = sessionData?.session;

      if (sessionError || !session) {
        redirectToLogin('Please log in to continue.');
        return false;
      }

      const profile = await fetchUserProfile();
      if (!profile) {
        redirectToLogin('Account profile not found. Please contact support.');
        return false;
      }

      if (profile.status === 'Deactivated' || profile.status === 'Inactive') {
        try { await supabaseClient.auth.signOut(); } catch (e) { /* best effort */ }
        redirectToLogin('Your account has been deactivated. Please contact your administrator.');
        return false;
      }

      setupAuthStateListener();
      return true;

    } catch (err) {
      // Any unexpected DB/network failure — fail safe, don't crash the page
      console.error('[AUTH_GUARD] requireAuth failed (handled safely):', err?.message || err);
      redirectToLogin('A system error occurred. Please log in again.');
      return false;
    }
  }

  /**
   * Require the session's role to be one of allowedRoles. Redirects to the
   * user's OWN correct dashboard (not an error page) if it isn't.
   */
  async function requireRole(allowedRoles) {
    const isAuthenticated = await requireAuth();
    if (!isAuthenticated) return false;

    if (!_currentUserProfile || !allowedRoles.includes(_currentUserProfile.role)) {
      const userRole = _currentUserProfile?.role || 'Unknown';
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
   * This is the initialization hook: call it once on page load.
   */
  async function autoGuard() {
    try {
      const page = getCurrentPage();
      const allowedRoles = PAGE_ROLE_MAP[page];

      if (allowedRoles) {
        return await requireRole(allowedRoles);
      }
      // Page not in the map — not a recognized protected page, do nothing
      // (avoids accidentally locking out public pages like index.html)
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
    if (_authStateListener) return;
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

// -----------------------------------------------------------------------------
// MODAL BACKDROP WATCHDOG
// Fixes the "click a button, the screen dims a bit and becomes completely
// untouchable" bug. Root cause: some buttons trigger a Bootstrap modal two
// ways at once (e.g. both a data-bs-toggle/data-bs-target attribute AND an
// onclick handler that also calls new bootstrap.Modal(...).show()). Bootstrap
// then gets confused about whether the modal is opening or closing, and can
// leave a .modal-backdrop element in the DOM with no actual open modal above
// it — a dark, full-screen, unclosable overlay that blocks every click and
// persists across tab switches (since this is a single-page-style app, not a
// tab-per-page reload).
//
// This runs on every page that includes auth-guard.js and silently removes
// any backdrop that shouldn't be there, restoring the page to normal. It's
// purely a cleanup safety net — it doesn't change how any modal looks or
// behaves when things work correctly.
// -----------------------------------------------------------------------------
(function () {
  function cleanupOrphanedModalBackdrops() {
    const anyModalOpen = !!document.querySelector('.modal.show');
    if (!anyModalOpen) {
      document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
      if (document.body.classList.contains('modal-open')) {
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
      }
    }
  }

  // Run after every modal fully closes (the normal case — this is nearly
  // always a no-op, just confirming cleanup happened correctly).
  document.addEventListener('hidden.bs.modal', cleanupOrphanedModalBackdrops);

  // Also sweep shortly after any click, to catch the specific double-trigger
  // race condition where a backdrop gets orphaned without a clean
  // hidden.bs.modal event ever firing.
  document.addEventListener('click', () => {
    setTimeout(cleanupOrphanedModalBackdrops, 400);
  }, true);

  // And a periodic safety sweep in case neither of the above catches it.
  setInterval(cleanupOrphanedModalBackdrops, 3000);
})();

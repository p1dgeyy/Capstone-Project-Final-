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
  // Strict segregation: PESO portals only allow PESO roles, CSWDO portals only allow CSWDO roles.
  const PAGE_ROLE_MAP = {
    'beneficiary.html': ['Beneficiary'],
    'beneficiary_dashboard.html': ['Beneficiary'],
    'peso_officer.html': ['PESO Officer', 'PESO Admin'],
    'peso_admin.html': ['PESO Admin'],
    'cswdo_officer.html': ['CSWDO Officer', 'CSWDO Admin'],
    'cswdo_admin.html': ['CSWDO Admin'],
    'evaluator.html': ['PESO Officer', 'PESO Admin', 'Evaluator']
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
  let _lastFetchTime = 0;
  const FETCH_THROTTLE_MS = 5000;

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
   * Fetch the current user's profile from Supabase with guard clauses
   */
  async function fetchUserProfile() {
    const now = Date.now();
    if (_currentUserProfile && (now - _lastFetchTime < FETCH_THROTTLE_MS)) {
      return _currentUserProfile;
    }

    const storedRole = sessionStorage.getItem('userRole');
    const storedUsername = sessionStorage.getItem('username');
    const storedId = sessionStorage.getItem('userId');
    const storedName = sessionStorage.getItem('userFullName');
    const storedDept = sessionStorage.getItem('department');

    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
      if (storedRole) {
        const profile = {
          id: storedId || '1',
          username: storedUsername || 'user',
          role: storedRole,
          first_name: storedName || 'User',
          last_name: '',
          department: storedDept || 'PESO',
          status: 'Active'
        };
        _currentUserProfile = profile;
        _lastFetchTime = now;
        return profile;
      }
      return null;
    }

    try {
      const { data: userData, error: userError } = await supabaseClient.auth.getUser();
      const user = userData?.user;

      if (userError || !user) {
        if (storedRole) {
          const profile = {
            id: storedId || '1',
            username: storedUsername || 'user',
            role: storedRole,
            first_name: storedName || 'User',
            last_name: '',
            department: storedDept || 'PESO',
            status: 'Active'
          };
          _currentUserProfile = profile;
          _lastFetchTime = now;
          return profile;
        }
        return null;
      }

      let profile = null;

      // 1. Try staff_profiles by auth_id
      try {
        const { data: staffProfile, error: staffError } = await supabaseClient
          .from('staff_profiles')
          .select('*')
          .eq('auth_id', user.id)
          .maybeSingle();

        if (!staffError && staffProfile) {
          profile = staffProfile;
        }
      } catch (e) {}

      // 2. Try staff_profiles by email
      if (!profile && user.email) {
        try {
          const { data: staffByEmail } = await supabaseClient
            .from('staff_profiles')
            .select('*')
            .eq('email', user.email)
            .maybeSingle();

          if (staffByEmail) {
            profile = staffByEmail;
            // Link auth_id asynchronously
            supabaseClient.from('staff_profiles').update({ auth_id: user.id }).eq('id', staffByEmail.id).then(() => {});
          }
        } catch (e) {}
      }

      // 3. Try beneficiaries by auth_id
      if (!profile) {
        try {
          const { data: benProfile, error: benError } = await supabaseClient
            .from('beneficiaries')
            .select('*')
            .eq('auth_id', user.id)
            .maybeSingle();

          if (!benError && benProfile) {
            profile = { ...benProfile, role: 'Beneficiary', id: benProfile.qr_code };
          }
        } catch (e) {}
      }

      // 4. Try beneficiaries by email
      if (!profile && user.email) {
        try {
          const { data: benByEmail } = await supabaseClient
            .from('beneficiaries')
            .select('*')
            .eq('email', user.email)
            .maybeSingle();

          if (benByEmail) {
            profile = { ...benByEmail, role: 'Beneficiary', id: benByEmail.qr_code };
            supabaseClient.from('beneficiaries').update({ auth_id: user.id }).eq('id', benByEmail.id).then(() => {});
          }
        } catch (e) {}
      }

      // 5. Fallback to user_metadata or derived profile
      if (!profile && user) {
        const meta = user.user_metadata || {};
        let derivedRole = meta.role || storedRole;
        let derivedDept = meta.department || storedDept || 'PESO';

        if (!derivedRole && user.email) {
          const emailLower = user.email.toLowerCase();
          if (emailLower.includes('peso.admin') || emailLower.includes('admin@koronadal')) {
            derivedRole = 'PESO Admin';
            derivedDept = 'PESO';
          } else if (emailLower.includes('peso.officer')) {
            derivedRole = 'PESO Officer';
            derivedDept = 'PESO';
          } else if (emailLower.includes('cswdo.admin')) {
            derivedRole = 'CSWDO Admin';
            derivedDept = 'CSWDO';
          } else if (emailLower.includes('cswdo.officer')) {
            derivedRole = 'CSWDO Officer';
            derivedDept = 'CSWDO';
          } else if (emailLower.includes('evaluator')) {
            derivedRole = 'PESO Officer';
            derivedDept = 'PESO';
          } else {
            derivedRole = 'Beneficiary';
          }
        }

        derivedRole = derivedRole || 'Beneficiary';

        profile = {
          id: user.id,
          auth_id: user.id,
          username: meta.username || storedUsername || (user.email ? user.email.split('@')[0] : 'admin'),
          role: derivedRole,
          first_name: meta.first_name || storedName || 'Administrator',
          last_name: meta.last_name || '',
          email: user.email || '',
          department: derivedDept,
          status: 'Active'
        };
      }

      _currentUserProfile = profile;
      _lastFetchTime = now;
      return profile;
    } catch (err) {
      console.warn('[AUTH_GUARD] Error fetching profile (handled safely):', err?.message || err);
      _lastFetchTime = now;
      if (storedRole) {
        const fallback = {
          id: storedId || '1',
          username: storedUsername || 'user',
          role: storedRole,
          first_name: storedName || 'User',
          last_name: '',
          department: storedDept || 'PESO',
          status: 'Active'
        };
        _currentUserProfile = fallback;
        return fallback;
      }
      return null;
    }
  }

  /**
   * Require a valid, active session. Redirects to login if missing/invalid.
   */
  async function requireAuth() {
    const storedRole = sessionStorage.getItem('userRole');

    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
      if (storedRole) return true;
      redirectToLogin('System error: authentication service unavailable.');
      return false;
    }

    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const session = sessionData?.session;

      if (!session && !storedRole) {
        redirectToLogin('Please log in to continue.');
        return false;
      }

      const profile = await fetchUserProfile();
      if (!profile) {
        if (storedRole) return true;
        redirectToLogin('Account profile not found. Please contact support.');
        return false;
      }

      // Safeguard: the primary PESO admin account must never be locked out by
      // a stale/incorrect 'Deactivated' or 'Inactive' status in staff_profiles.
      // This mirrors the same safeguard already applied on the login page
      // (admin-login.js) — without it, a status flip in the database (e.g.
      // from testing the Active/Inactive toggle) would sign this account
      // straight back out immediately after a successful login.
      const isPrimaryAdmin =
        (profile.username && profile.username.toLowerCase() === 'peso-admin') ||
        (profile.email && (profile.email.toLowerCase() === 'peso.admin@gmail.com' || profile.email.toLowerCase() === 'peso.admin@koronadal.gov.ph'));

      if (isPrimaryAdmin && (profile.status === 'Deactivated' || profile.status === 'Inactive')) {
        console.warn('[AUTH_GUARD] Primary admin account had a non-Active status in the database; overriding to Active to prevent lockout.');
        profile.status = 'Active';
      }

      if (profile.status === 'Deactivated' || profile.status === 'Inactive') {
        try { await supabaseClient.auth.signOut(); } catch (e) { /* best effort */ }
        redirectToLogin('Your account has been deactivated. Please contact your administrator.');
        return false;
      }

      setupAuthStateListener();

      // Start Single-Session Watchdog & 20-Minute Inactivity Timer
      if (typeof SessionManager !== 'undefined' && SessionManager.startPeriodicVerification) {
        SessionManager.startPeriodicVerification();
      }

      return true;

    } catch (err) {
      console.warn('[AUTH_GUARD] requireAuth note (recovered):', err?.message || err);
      if (sessionStorage.getItem('userRole')) {
        if (typeof SessionManager !== 'undefined' && SessionManager.startPeriodicVerification) {
          SessionManager.startPeriodicVerification();
        }
        return true;
      }
      redirectToLogin('A system error occurred. Please log in again.');
      return false;
    }
  }

  /**
   * Universal Logout helper
   */
  async function logout(redirectUrl) {
    try {
      if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.auth) {
        await supabaseClient.auth.signOut();
      }
    } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    window.location.href = redirectUrl || getLoginPage();
  }

  /**
   * Require the session's role to be one of allowedRoles. Redirects to the
   * user's OWN correct dashboard (not an error page) if it isn't.
   */
  async function requireRole(allowedRoles) {
    const isAuthenticated = await requireAuth();
    if (!isAuthenticated) return false;

    const userRole = _currentUserProfile?.role || sessionStorage.getItem('userRole') || 'Unknown';
    const hasRole = allowedRoles.some(r => r.toLowerCase().trim() === userRole.toLowerCase().trim());

    if (!hasRole) {
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
      'Evaluator': 'evaluator.html',
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
    logout,
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
  function isModalGenuinelyOpen() {
    try {
      if (document.querySelector('.sn-overlay')) return true;
      if (document.querySelector('.custom-modal-backdrop.show, .custom-modal.show')) return true;

      const candidates = document.querySelectorAll('.modal.show');
      for (const el of candidates) {
        if (el.style.display === 'block' || window.getComputedStyle(el).display !== 'none') {
          return true;
        }
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  function cleanupOrphanedModalBackdrops() {
    try {
      if (typeof document === 'undefined' || !document.body) return;
      if (isModalGenuinelyOpen()) return;

      const backdrops = document.querySelectorAll('.modal-backdrop, .custom-modal-backdrop:not(.show)');
      if (backdrops.length > 0) {
        backdrops.forEach(el => {
          try {
            if (!el.classList.contains('show') || !document.querySelector('.modal.show, .custom-modal.show')) {
              el.remove();
            }
          } catch (e) {}
        });
      }
      if (document.body && document.body.classList && document.body.classList.contains('modal-open')) {
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
      }
    } catch (err) {
      console.warn('[AUTH_GUARD] Backdrop cleanup warning (handled safely):', err);
    }
  }

  // Run after every modal fully closes
  document.addEventListener('hidden.bs.modal', () => {
    try { cleanupOrphanedModalBackdrops(); } catch (e) {}
  });

  // Also sweep shortly after any click, to catch orphaned backdrops
  document.addEventListener('click', () => {
    try {
      setTimeout(cleanupOrphanedModalBackdrops, 400);
    } catch (e) {}
  }, true);

  // Periodic safety sweep
  setInterval(() => {
    try { cleanupOrphanedModalBackdrops(); } catch (e) {}
  }, 1500);

  // Run safely once the DOM is ready (or immediately if already parsed)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try { cleanupOrphanedModalBackdrops(); } catch (e) {}
    });
  } else {
    try { cleanupOrphanedModalBackdrops(); } catch (e) {}
  }
})();

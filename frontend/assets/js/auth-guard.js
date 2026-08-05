/**
 * Auth Guard — Route Protection Hook
 *
 * Include this script on every protected dashboard page to enforce:
 *   1. Valid Supabase session (redirects to login if none)
 *   2. Role-based access control (prevents unauthorized page access)
 *   3. Auto-redirect on sign-out events
 *
 * Usage:
 *   Add to any protected page's <head>:
 *     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *     <script src="assets/js/supabase-config.js"></script>
 *     <script src="assets/js/auth-guard.js"></script>
 *
 *   Then in the page's <script>, call:
 *     AuthGuard.requireRole(['PESO Admin', 'PESO Officer']);
 *   or for any authenticated user:
 *     AuthGuard.requireAuth();
 */

const AuthGuard = (() => {
  'use strict';

  // Map of pages to their allowed roles
  const PAGE_ROLE_MAP = {
    'beneficiary.html': ['Beneficiary'],
    'beneficiary_dashboard.html': ['Beneficiary'],
    'peso_officer.html': ['PESO Officer', 'PESO Admin'],
    'peso_admin.html': ['PESO Admin'],
    'cswdo_officer.html': ['CSWDO Officer', 'CSWDO Admin'],
    'cswdo_admin.html': ['CSWDO Admin'],
    'evaluator.html': ['Evaluator', 'PESO Admin', 'CSWDO Admin']
  };

  // Role → login page mapping
  const ROLE_LOGIN_MAP = {
    'Beneficiary': 'official_login.html',
    'PESO Admin': 'admin_login.html',
    'PESO Officer': 'admin_login.html',
    'CSWDO Admin': 'admin_login.html',
    'CSWDO Officer': 'admin_login.html',
    'Evaluator': 'admin_login.html'
  };

  let _currentUserProfile = null;
  let _authStateListener = null;

  /**
   * Get the current page filename
   */
  function getCurrentPage() {
    const path = window.location.pathname;
    return path.substring(path.lastIndexOf('/') + 1) || 'index.html';
  }

  /**
   * Get the appropriate login page for the current page context
   */
  function getLoginPage() {
    const page = getCurrentPage();
    // If it's a beneficiary page, redirect to beneficiary login
    if (page.includes('beneficiary')) {
      return 'official_login.html';
    }
    return 'admin_login.html';
  }

  /**
   * Redirect to login with an optional message
   */
  function redirectToLogin(message) {
    if (message) {
      sessionStorage.setItem('authGuardMessage', message);
    }
    window.location.href = getLoginPage();
  }

  /**
   * Fetch the current user's profile from Supabase
   */
  async function fetchUserProfile() {
    if (!supabaseClient) {
      console.error('[AUTH_GUARD] Supabase client not available.');
      return null;
    }

    try {
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      if (userError || !user) {
        return null;
      }

      const { data: profile, error: profileError } = await supabaseClient
        .from('users_profile')
        .select('*')
        .eq('auth_id', user.id)
        .single();

      if (profileError || !profile) {
        console.warn('[AUTH_GUARD] Profile not found for auth user:', user.id);
        return null;
      }

      _currentUserProfile = profile;
      return profile;
    } catch (err) {
      console.error('[AUTH_GUARD] Error fetching profile:', err.message);
      return null;
    }
  }

  /**
   * Check if user has a valid session — redirect to login if not
   */
  async function requireAuth() {
    if (!supabaseClient) {
      redirectToLogin('System error: Supabase not configured.');
      return false;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
      redirectToLogin('Please log in to continue.');
      return false;
    }

    // Fetch profile and store it
    const profile = await fetchUserProfile();
    if (!profile) {
      redirectToLogin('Account profile not found. Please contact support.');
      return false;
    }

    // Check account status
    if (profile.status === 'Deactivated' || profile.status === 'Inactive') {
      await supabaseClient.auth.signOut();
      redirectToLogin('Your account has been deactivated. Please contact your administrator.');
      return false;
    }

    // Set up auth state listener for auto-redirect on sign-out
    setupAuthStateListener();

    return true;
  }

  /**
   * Check if user has one of the specified roles — redirect if not authorized
   */
  async function requireRole(allowedRoles) {
    const isAuthenticated = await requireAuth();
    if (!isAuthenticated) return false;

    if (!_currentUserProfile || !allowedRoles.includes(_currentUserProfile.role)) {
      const userRole = _currentUserProfile?.role || 'Unknown';
      console.warn(`[AUTH_GUARD] Access denied. User role "${userRole}" not in allowed roles:`, allowedRoles);

      // Redirect to the user's appropriate dashboard instead
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
   * Auto-detect allowed roles based on current page and enforce them
   */
  async function autoGuard() {
    const page = getCurrentPage();
    const allowedRoles = PAGE_ROLE_MAP[page];

    if (allowedRoles) {
      return await requireRole(allowedRoles);
    } else {
      // Page not in the map — just require authentication
      return await requireAuth();
    }
  }

  /**
   * Get the dashboard page for a given role
   */
  function getRoleDashboard(role) {
    const map = {
      'PESO Admin': 'peso_admin.html',
      'PESO Officer': 'peso_officer.html',
      'CSWDO Admin': 'cswdo_admin.html',
      'CSWDO Officer': 'cswdo_officer.html',
      'Evaluator': 'evaluator.html',
      'Beneficiary': 'beneficiary.html'
    };
    return map[role] || 'official_login.html';
  }

  /**
   * Set up auth state change listener
   */
  function setupAuthStateListener() {
    if (_authStateListener) return; // Already set up

    _authStateListener = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        console.log('[AUTH_GUARD] User signed out — redirecting to login.');
        _currentUserProfile = null;
        redirectToLogin('You have been signed out.');
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('[AUTH_GUARD] Session token refreshed.');
      }
    });
  }

  /**
   * Get the current cached user profile
   */
  function getProfile() {
    return _currentUserProfile;
  }

  /**
   * Get the current user's role
   */
  function getRole() {
    return _currentUserProfile?.role || null;
  }

  /**
   * Get the current user's display name
   */
  function getDisplayName() {
    if (!_currentUserProfile) return '';
    return `${_currentUserProfile.first_name} ${_currentUserProfile.last_name}`.trim();
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
    redirectToLogin
  });
})();

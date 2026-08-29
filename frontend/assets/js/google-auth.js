/**
 * =========================================================================
 * CITY OF KORONADAL - GOOGLE OAUTH CONTROLLER (google-auth.js)
 * 
 * Official Google Identity / OAuth 2.0 Integration via Supabase:
 * - Direct Google OAuth Authentication (`signInWithOAuth`)
 * - Automated OAuth Redirect & Session Detection
 * - Beneficiary Auto-Provisioning & Unique QR Code Generation
 * - Strict Staff Role Gate: Non-staff Google accounts are denied access
 * - Safe URL Resolution & Origin Verification Safeguards
 * =========================================================================
 */

const GoogleAuth = (() => {
  'use strict';

  // Generate unique Beneficiary QR code identifier
  function generateBeneficiaryQr() {
    const chars = '0123456789ABCDEF';
    let hex = '';
    for (let i = 0; i < 8; i++) {
      hex += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `QR-BEN-${hex}`;
  }

  // Get safe, sanitized redirect URL constrained strictly to current origin and deployment path
  function getSafeRedirectUrl(targetPage = 'beneficiary.html') {
    const origin = window.location.origin;
    const path = window.location.pathname;
    const lastSlash = path.lastIndexOf('/');
    const baseDir = lastSlash >= 0 ? path.substring(0, lastSlash + 1) : '/';
    
    // If targetPage has query params, preserve them
    return `${origin}${baseDir}${targetPage}`;
  }

  /**
   * Initiate Google OAuth Sign-In
   * @param {Object} options
   * @param {string} options.portal - 'beneficiary' | 'staff'
   * @param {string} [options.role] - 'Beneficiary' | 'PESO Officer' | 'CSWDO Officer' | 'PESO Admin'
   * @param {string} [options.redirectTo] - Destination page after authentication
   * @param {Object} [options.extraData] - Additional registration data to preserve in state
   */
  async function signInWithGoogle(options = {}) {
    const portal = options.portal || 'beneficiary';
    const role = options.role || (portal === 'beneficiary' ? 'Beneficiary' : 'Staff');
    const targetPage = options.redirectTo || (portal === 'beneficiary' ? 'beneficiary.html' : 'admin_login.html');
    const redirectUrl = getSafeRedirectUrl(targetPage);

    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
      alert('Database connection unavailable. Please check your internet connection.');
      return { error: new Error('Supabase client not initialized') };
    }

    // Persist pending auth intent into sessionStorage for retrieval upon return
    sessionStorage.setItem('oauth_pending_portal', portal);
    sessionStorage.setItem('oauth_pending_role', role);
    sessionStorage.setItem('oauth_target_page', targetPage);
    if (options.extraData) {
      sessionStorage.setItem('oauth_pending_registration', JSON.stringify(options.extraData));
    }

    try {
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      console.error('[GOOGLE_AUTH] OAuth initiation failed:', err);
      alert(`Google Authentication could not be started: ${err.message || 'Please check Supabase Google provider configuration.'}`);
      return { data: null, error: err };
    }
  }

  /**
   * Handle OAuth Return / Redirect on Page Load
   * Detects returned Supabase session from Google, synchronizes profile in database,
   * enforces role authorization guards, and initializes user session.
   */
  async function handleAuthRedirect() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return null;

    // Only process if returning from an active OAuth callback (hash tokens, code query, or pending flag)
    const hasOAuthHash = window.location.hash && (
      window.location.hash.includes('access_token=') ||
      window.location.hash.includes('refresh_token=') ||
      window.location.hash.includes('error=')
    );
    const hasOAuthQuery = window.location.search && (
      window.location.search.includes('code=') ||
      window.location.search.includes('error=')
    );
    const hasPendingPortal = sessionStorage.getItem('oauth_pending_portal');

    if (!hasOAuthHash && !hasOAuthQuery && !hasPendingPortal) {
      return null;
    }

    try {
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !session || !session.user) return null;

      const user = session.user;
      const meta = user.user_metadata || {};
      const curPath = window.location.pathname;
      const isStaffPortalPage = curPath.includes('admin') || curPath.includes('officer') || curPath.includes('evaluator');
      
      const pendingPortal = sessionStorage.getItem('oauth_pending_portal') || (isStaffPortalPage ? 'staff' : 'beneficiary');
      const pendingRole = sessionStorage.getItem('oauth_pending_role') || (pendingPortal === 'beneficiary' ? 'Beneficiary' : 'Staff');
      const pendingRegStr = sessionStorage.getItem('oauth_pending_registration');
      let pendingReg = null;
      if (pendingRegStr) {
        try { pendingReg = JSON.parse(pendingRegStr); } catch (e) {}
      }

      // Check if logged in via Google OAuth
      const isGoogleUser = user.app_metadata?.provider === 'google' || user.identities?.some(id => id.provider === 'google');

      // -------------------------------------------------------------
      // 1. STAFF PORTAL AUTHENTICATION & STRICT ROLE GATE
      // -------------------------------------------------------------
      if (pendingPortal === 'staff') {
        let staffProfile = null;

        try {
          const { data: existingStaff, error: staffFetchErr } = await supabaseClient
            .from('staff_profiles')
            .select('*')
            .or(`auth_id.eq.${user.id},email.ilike.${user.email}`)
            .maybeSingle();

          if (!staffFetchErr && existingStaff) {
            staffProfile = existingStaff;
            if (!existingStaff.auth_id) {
              await supabaseClient.from('staff_profiles').update({ auth_id: user.id }).eq('id', existingStaff.id);
            }
          }
        } catch (dbErr) {
          console.warn('[GOOGLE_AUTH] Staff database lookup error:', dbErr);
        }

        // Validate Staff Authorization: Non-staff Google accounts are strictly REJECTED
        const allowedStaffRoles = ['PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator'];
        const isAuthorizedStaff = staffProfile && 
          allowedStaffRoles.includes(staffProfile.role) && 
          staffProfile.status === 'Active';

        if (!isAuthorizedStaff) {
          console.warn(`[GOOGLE_AUTH] Unauthorized Google staff login attempt by: ${user.email}`);

          // Sign out immediately from Supabase to prevent dangling session
          await supabaseClient.auth.signOut();

          // Clear all stored sessions
          ['userId', 'userRole', 'username', 'userFullName', 'department', 'jwtAccessToken', 'sessionToken', 'oauth_pending_portal', 'oauth_pending_role', 'oauth_target_page'].forEach(k => sessionStorage.removeItem(k));

          // Clean URL hash tokens so user is not stuck in redirect loop
          if (window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
          }

          // Display prominent error alert
          const errorAlert = document.getElementById('errorAlert');
          const errorMessage = document.getElementById('errorMessage');
          const errorMsgText = `Access Denied: Google account (${user.email}) is not registered as an authorized staff account. Only registered PESO and CSWDO staff may log in here.`;

          if (errorMessage) errorMessage.textContent = errorMsgText;
          if (errorAlert) errorAlert.style.display = 'block';

          if (typeof SystemNotifications !== 'undefined' && SystemNotifications.show) {
            SystemNotifications.show({
              title: 'Staff Access Denied',
              message: errorMsgText,
              type: 'error',
              duration: 8000
            });
          } else if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
              title: 'Staff Access Denied',
              message: errorMsgText,
              type: 'error'
            });
          } else if (!errorAlert) {
            alert(errorMsgText);
          }

          // If on a protected dashboard, bounce back to admin login
          if (!curPath.includes('admin_login.html')) {
            setTimeout(() => { window.location.replace('admin_login.html'); }, 1500);
          }

          return { error: 'unauthorized_staff' };
        }

        // Strict Single Active Device Check: Prevent login if already active on another device
        if (typeof SessionManager !== 'undefined' && SessionManager.checkAccountAlreadyActive) {
          const activeCheck = await SessionManager.checkAccountAlreadyActive(staffProfile.id, staffProfile.username, {
            email: staffProfile.email || user.email,
            authId: user.id
          });
          if (activeCheck.isAlreadyActive) {
            try { await supabaseClient.auth.signOut(); } catch (e) {}
            const kickMsg = `Current account is being used on another device. Please log out from that device first to log in here.`;
            const errorAlert = document.getElementById('errorAlert');
            const errorMsg = document.getElementById('errorMessage');
            if (errorMsg) errorMsg.textContent = kickMsg;
            if (errorAlert) errorAlert.style.display = 'block';
            if (typeof SystemNotifications !== 'undefined' && SystemNotifications.show) {
              SystemNotifications.show({ title: 'Account Already Active', message: kickMsg, type: 'warning', duration: 8000 });
            } else {
              alert(kickMsg);
            }
            return { error: 'already_active_on_another_device' };
          }
        }

        // Authorized Staff Session Initialization
        const fullName = `${staffProfile.first_name || ''} ${staffProfile.last_name || ''}`.trim() || staffProfile.username;
        sessionStorage.setItem('jwtAccessToken', session.access_token);
        sessionStorage.setItem('userRole', staffProfile.role);
        sessionStorage.setItem('username', staffProfile.username);
        sessionStorage.setItem('userId', String(staffProfile.id));
        sessionStorage.setItem('userFullName', fullName);
        sessionStorage.setItem('department', staffProfile.department || 'PESO');

        if (typeof SessionManager !== 'undefined' && SessionManager.save) {
          await SessionManager.save(staffProfile.id, session.access_token, staffProfile.role, {
            username: staffProfile.username,
            fullName: fullName,
            department: staffProfile.department || 'PESO',
            email: staffProfile.email
          });
        }

        // Clean transient OAuth storage
        sessionStorage.removeItem('oauth_pending_portal');
        sessionStorage.removeItem('oauth_pending_role');
        sessionStorage.removeItem('oauth_target_page');

        // Clean URL hash
        if (window.location.hash) {
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }

        // Route to designated dashboard if on login page
        if (curPath.includes('login') || curPath.includes('index.html') || curPath.endsWith('/')) {
          const roleLower = (staffProfile.role || '').toLowerCase();
          let redirectUrl = 'peso_admin.html';

          if (roleLower.includes('peso') && roleLower.includes('officer')) {
            redirectUrl = 'peso_officer.html';
          } else if (roleLower.includes('cswdo') && roleLower.includes('admin')) {
            redirectUrl = 'cswdo_admin.html';
          } else if (roleLower.includes('cswdo') && roleLower.includes('officer')) {
            redirectUrl = 'cswdo_officer.html';
          } else if (roleLower.includes('evaluator')) {
            redirectUrl = 'peso_officer.html';
          }

          window.location.replace(redirectUrl);
        }

        return { user, profile: staffProfile, role: staffProfile.role, session };
      }

      // -------------------------------------------------------------
      // 2. BENEFICIARY PORTAL AUTHENTICATION & AUTO-PROVISIONING
      // -------------------------------------------------------------
      let profile = null;
      try {
        const { data: existingBen } = await supabaseClient
          .from('beneficiaries')
          .select('*')
          .or(`auth_id.eq.${user.id},email.ilike.${user.email}`)
          .maybeSingle();

        if (existingBen) {
          profile = existingBen;
          if (!existingBen.auth_id) {
            await supabaseClient
              .from('beneficiaries')
              .update({ auth_id: user.id })
              .eq('id', existingBen.id);
          }
        }
      } catch (benDbErr) {
        console.warn('[GOOGLE_AUTH] Beneficiary DB lookup notice:', benDbErr);
      }

      if (!profile) {
        // Auto-provision new beneficiary row
        const qrCode = generateBeneficiaryQr();
        const fullName = meta.full_name || meta.name || '';
        const nameParts = fullName.split(' ');
        const firstName = pendingReg?.first_name || meta.given_name || nameParts[0] || 'Beneficiary';
        const lastName = pendingReg?.last_name || meta.family_name || (nameParts.slice(1).join(' ')) || '';
        const username = pendingReg?.username || user.email.split('@')[0] + Math.floor(100 + Math.random() * 900);

        const payload = {
          qr_code: qrCode,
          auth_id: user.id,
          username: username,
          first_name: firstName,
          middle_name: pendingReg?.middle_name || null,
          last_name: lastName,
          suffix: pendingReg?.suffix || null,
          email: user.email,
          phone: pendingReg?.phone || null,
          age: pendingReg?.age ? parseInt(pendingReg.age, 10) : 0,
          date_of_birth: pendingReg?.date_of_birth || null,
          sex: pendingReg?.sex || null,
          marital_status: pendingReg?.marital_status || null,
          address: pendingReg?.address || 'City of Koronadal',
          id_type: pendingReg?.id_type || 'Google Verified Identity',
          terms_agreed: true,
          data_consent: true,
          status: 'Active'
        };

        try {
          const { data: newBen, error: insertError } = await supabaseClient
            .from('beneficiaries')
            .insert(payload)
            .select()
            .single();

          if (!insertError && newBen) {
            profile = newBen;
          }
        } catch (insErr) {
          console.warn('[GOOGLE_AUTH] Auto-provision insert notice:', insErr);
        }

        if (!profile) {
          profile = {
            id: user.id,
            auth_id: user.id,
            qr_code: qrCode,
            username: username,
            first_name: firstName,
            last_name: lastName,
            email: user.email,
            role: 'Beneficiary',
            status: 'Active'
          };
        }
      }

        // Strict Single Active Device Check: Prevent login if already active on another device
        if (typeof SessionManager !== 'undefined' && SessionManager.checkAccountAlreadyActive) {
          const activeCheck = await SessionManager.checkAccountAlreadyActive(profile.qr_code || profile.id, profile.username, {
            email: profile.email || user.email,
            authId: user.id
          });
          if (activeCheck.isAlreadyActive) {
            try { await supabaseClient.auth.signOut(); } catch (e) {}
            const kickMsg = `Current account is being used on another device. Please log out from that device first to log in here.`;
            const errorAlert = document.getElementById('errorAlert');
            const errorMsg = document.getElementById('errorMessage');
            if (errorMsg) errorMsg.textContent = kickMsg;
            if (errorAlert) errorAlert.style.display = 'block';
            if (typeof SystemNotifications !== 'undefined' && SystemNotifications.show) {
              SystemNotifications.show({ title: 'Account Already Active', message: kickMsg, type: 'warning', duration: 8000 });
            } else {
              alert(kickMsg);
            }
            return { error: 'already_active_on_another_device' };
          }
        }

        // Initialize Beneficiary Session Storage
        const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username;
      sessionStorage.setItem('jwtAccessToken', session.access_token);
      sessionStorage.setItem('userRole', 'Beneficiary');
      sessionStorage.setItem('username', profile.username);
      sessionStorage.setItem('userId', String(profile.id));
      sessionStorage.setItem('userFullName', fullName);
      sessionStorage.setItem('beneficiaryLoggedIn', 'true');
      sessionStorage.setItem('beneficiaryUsername', profile.username);
      sessionStorage.setItem('beneficiaryName', fullName);
      if (profile.qr_code) sessionStorage.setItem('beneficiaryQrCode', profile.qr_code);

      if (typeof SessionManager !== 'undefined' && SessionManager.save) {
        await SessionManager.save(profile.id, session.access_token, 'Beneficiary', {
          username: profile.username,
          fullName: fullName,
          email: profile.email
        });
      }

      // Clear transient OAuth storage
      sessionStorage.removeItem('oauth_pending_portal');
      sessionStorage.removeItem('oauth_pending_role');
      sessionStorage.removeItem('oauth_target_page');
      sessionStorage.removeItem('oauth_pending_registration');

      // Clean URL hash
      if (window.location.hash) {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      }

      // If user landed on login page after Google OAuth, route them to beneficiary dashboard
      if (curPath.includes('login') || curPath.includes('official_login.html') || curPath.includes('index.html') || curPath.endsWith('/') || curPath === '') {
        window.location.replace('beneficiary.html');
      }

      return { user, profile, role: 'Beneficiary', session };

    } catch (err) {
      console.error('[GOOGLE_AUTH] Error processing OAuth redirect:', err);
      return null;
    }
  }

  /**
   * HTML Template for Official Google OAuth Button
   * Following Google Identity & Material Design guidelines
   */
  function getGoogleButtonHtml(options = {}) {
    const text = options.text || 'Continue with Google';
    const id = options.id || 'btnGoogleAuth';
    const extraClass = options.className || '';

    return `
      <button type="button" class="btn btn-google-auth ${extraClass}" id="${id}" style="
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        width: 100%;
        background-color: #FFFFFF;
        color: #3c4043;
        border: 1px solid #dadce0;
        border-radius: 24px;
        padding: 11px 20px;
        font-family: 'Roboto', 'Outfit', sans-serif;
        font-size: 15px;
        font-weight: 500;
        letter-spacing: 0.2px;
        box-shadow: 0 1px 3px rgba(60,64,67,0.08);
        transition: background-color .2s, box-shadow .2s, border-color .2s;
        cursor: pointer;
      " onmouseover="this.style.backgroundColor='#F8FAFD'; this.style.boxShadow='0 2px 6px rgba(60,64,67,0.15)';" onmouseout="this.style.backgroundColor='#FFFFFF'; this.style.boxShadow='0 1px 3px rgba(60,64,67,0.08)';">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="width: 20px; height: 20px; flex-shrink: 0;">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
          <path fill="none" d="M0 0h48v48H0z"></path>
        </svg>
        <span>${text}</span>
      </button>
    `;
  }

  // Auto-run on DOMContentLoaded if returning from OAuth
  document.addEventListener('DOMContentLoaded', () => {
    handleAuthRedirect();
  });

  return {
    signInWithGoogle,
    handleAuthRedirect,
    getGoogleButtonHtml,
    generateBeneficiaryQr,
    getSafeRedirectUrl
  };
})();

// Global window registration
window.GoogleAuth = GoogleAuth;

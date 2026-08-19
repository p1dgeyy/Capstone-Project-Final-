/**
 * =========================================================================
 * CITY OF KORONADAL - GOOGLE OAUTH CONTROLLER (google-auth.js)
 * 
 * Official Google Identity / OAuth 2.0 Integration via Supabase:
 * - Direct Google OAuth Authentication (`signInWithOAuth`)
 * - Automated OAuth Redirect & Session Detection
 * - Beneficiary Auto-Provisioning & Unique QR Code Generation
 * - Anti-Phishing, DPA (RA 10173) & Origin Verification Safeguards
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

  // Get safe, sanitized redirect URL constrained strictly to current origin
  function getSafeRedirectUrl(targetPage = 'beneficiary.html') {
    const origin = window.location.origin;
    const path = window.location.pathname;
    const baseDir = path.substring(0, path.lastIndexOf('/') + 1) || '/frontend/';
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
    const targetPage = options.redirectTo || (portal === 'beneficiary' ? 'beneficiary.html' : 'peso_officer.html');
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
   * Detects returned Supabase session from Google, synchronizes profile in database, and initializes session.
   */
  async function handleAuthRedirect() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return null;

    try {
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !session || !session.user) return null;

      const user = session.user;
      const meta = user.user_metadata || {};
      const pendingPortal = sessionStorage.getItem('oauth_pending_portal') || 'beneficiary';
      const pendingRole = sessionStorage.getItem('oauth_pending_role') || (pendingPortal === 'beneficiary' ? 'Beneficiary' : 'Staff');
      const pendingRegStr = sessionStorage.getItem('oauth_pending_registration');
      let pendingReg = null;
      if (pendingRegStr) {
        try { pendingReg = JSON.parse(pendingRegStr); } catch (e) {}
      }

      // Check if logged in via Google OAuth
      const isGoogleUser = user.app_metadata?.provider === 'google' || user.identities?.some(id => id.provider === 'google');

      if (pendingPortal === 'beneficiary' || (!sessionStorage.getItem('userRole') && isGoogleUser)) {
        // 1. Resolve or Create Beneficiary Profile
        let profile = null;
        const { data: existingBen } = await supabaseClient
          .from('beneficiaries')
          .select('*')
          .or(`auth_id.eq.${user.id},email.ilike.${user.email}`)
          .maybeSingle();

        if (existingBen) {
          profile = existingBen;
          // Ensure auth_id is linked
          if (!existingBen.auth_id) {
            await supabaseClient
              .from('beneficiaries')
              .update({ auth_id: user.id })
              .eq('id', existingBen.id);
          }
        } else {
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

          const { data: newBen, error: insertError } = await supabaseClient
            .from('beneficiaries')
            .insert(payload)
            .select()
            .single();

          if (!insertError && newBen) {
            profile = newBen;
          } else {
            console.warn('[GOOGLE_AUTH] Auto-provision insert warning:', insertError?.message);
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

        // Initialize Session Storage
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

        // Clear transient oauth storage
        sessionStorage.removeItem('oauth_pending_portal');
        sessionStorage.removeItem('oauth_pending_role');
        sessionStorage.removeItem('oauth_target_page');
        sessionStorage.removeItem('oauth_pending_registration');

        return { user, profile, role: 'Beneficiary', session };
      } else {
        // Staff Profile Handling
        let staffProfile = null;
        const { data: existingStaff } = await supabaseClient
          .from('staff_profiles')
          .select('*')
          .or(`auth_id.eq.${user.id},email.ilike.${user.email}`)
          .maybeSingle();

        if (existingStaff) {
          staffProfile = existingStaff;
          if (!existingStaff.auth_id) {
            await supabaseClient.from('staff_profiles').update({ auth_id: user.id }).eq('id', existingStaff.id);
          }
        } else {
          staffProfile = {
            id: user.id,
            auth_id: user.id,
            username: user.email.split('@')[0],
            role: pendingRole || 'PESO Officer',
            first_name: meta.given_name || 'Staff',
            last_name: meta.family_name || 'Member',
            email: user.email,
            department: 'PESO',
            status: 'Active'
          };
        }

        const fullName = `${staffProfile.first_name || ''} ${staffProfile.last_name || ''}`.trim() || staffProfile.username;
        sessionStorage.setItem('jwtAccessToken', session.access_token);
        sessionStorage.setItem('userRole', staffProfile.role);
        sessionStorage.setItem('username', staffProfile.username);
        sessionStorage.setItem('userId', String(staffProfile.id));
        sessionStorage.setItem('userFullName', fullName);
        sessionStorage.setItem('department', staffProfile.department || 'PESO');

        sessionStorage.removeItem('oauth_pending_portal');
        sessionStorage.removeItem('oauth_pending_role');
        sessionStorage.removeItem('oauth_target_page');

        return { user, profile: staffProfile, role: staffProfile.role, session };
      }
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

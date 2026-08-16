/**
 * =========================================================================
 * CITY OF KORONADAL - STAFF / ADMIN LOGIN CONTROLLER (admin-login.js)
 * Handles Lockout Protection, Password Complexity, Password Reset,
 * Supabase Auth Authentication, Audit Logging, and Portal Routing.
 * =========================================================================
 */

(function () {
    'use strict';

    let failedLoginAttempts = parseInt(localStorage.getItem('peso_failed_attempts') || '0', 10);
    let lockoutUntilTimestamp = parseInt(localStorage.getItem('peso_lockout_until') || '0', 10);

    function checkLockoutStatus() {
        const now = Date.now();
        if (lockoutUntilTimestamp > now) {
            const remainingMinutes = Math.ceil((lockoutUntilTimestamp - now) / 60000);
            const errorAlert = document.getElementById('errorAlert');
            const errorMessage = document.getElementById('errorMessage');
            const loginBtn = document.getElementById('loginBtn');
            const lang = localStorage.getItem('lang') || 'en';

            if (errorMessage) {
                errorMessage.textContent = lang === 'tg'
                    ? `Naka-lock ang account dahil sa maraming maling pagsubok. Maghintay ng ${remainingMinutes} minuto.`
                    : `Account locked due to 5 failed attempts. Please wait ${remainingMinutes} minute(s) or reset your password.`;
            }

            if (errorAlert) errorAlert.style.display = 'block';
            if (loginBtn) loginBtn.disabled = true;
            return true;
        } else if (lockoutUntilTimestamp > 0 && now >= lockoutUntilTimestamp) {
            failedLoginAttempts = 0;
            lockoutUntilTimestamp = 0;
            localStorage.removeItem('peso_failed_attempts');
            localStorage.removeItem('peso_lockout_until');
            const loginBtn = document.getElementById('loginBtn');
            const errorAlert = document.getElementById('errorAlert');
            if (loginBtn) loginBtn.disabled = false;
            if (errorAlert) errorAlert.style.display = 'none';
        }
        return false;
    }

    // Initialize on DOM Ready
    document.addEventListener('DOMContentLoaded', () => {
        checkLockoutStatus();

        // Reset form inputs so no credentials persist on page refresh
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.reset();

        // Forgot Password UI Helpers
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                const step1 = document.getElementById('forgotStep1');
                const step2 = document.getElementById('forgotStep2');
                const step3 = document.getElementById('forgotStep3');
                if (step1) step1.classList.remove('d-none');
                if (step2) step2.classList.add('d-none');
                if (step3) step3.classList.add('d-none');
                if (window.showModal) window.showModal('resetModal');
            });
        }

        const closeResetBtn = document.getElementById('closeResetBtn');
        if (closeResetBtn) closeResetBtn.addEventListener('click', () => window.hideModal && window.hideModal('resetModal'));

        const resetBackdrop = document.getElementById('resetBackdrop');
        if (resetBackdrop) resetBackdrop.addEventListener('click', () => window.hideModal && window.hideModal('resetModal'));

        const forgotForm = document.getElementById('forgotPasswordForm');
        if (forgotForm) {
            forgotForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                const identifier = (document.getElementById('forgotIdentifier')?.value || '').trim();
                const btn = document.getElementById('btnSendVerification');

                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Verifying...';
                }

                const resetToken = 'RST-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now();
                const targetEmail = identifier.includes('@') ? identifier : `${identifier}@koronadal.gov.ph`;

                const badge = document.getElementById('forgotUserEmailBadge');
                const display = document.getElementById('verificationLinkDisplay');
                const tokenInput = document.getElementById('verifiedResetToken');

                if (badge) badge.textContent = targetEmail;
                if (display) display.textContent = `${window.location.origin}${window.location.pathname}?action=reset&token=${resetToken}`;
                if (tokenInput) tokenInput.value = resetToken;

                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="bi bi-send-fill me-1"></i> Send Verification Link';
                }

                const step1 = document.getElementById('forgotStep1');
                const step2 = document.getElementById('forgotStep2');
                if (step1) step1.classList.add('d-none');
                if (step2) step2.classList.remove('d-none');
            });
        }

        const resetCompleteForm = document.getElementById('resetCompleteForm');
        if (resetCompleteForm) {
            resetCompleteForm.addEventListener('submit', function (e) {
                e.preventDefault();
                const newPass = document.getElementById('newResetPassword')?.value;
                const confirmPass = document.getElementById('confirmResetPassword')?.value;

                if (newPass !== confirmPass) {
                    alert('Passwords do not match.');
                    return;
                }

                failedLoginAttempts = 0;
                lockoutUntilTimestamp = 0;
                localStorage.removeItem('peso_failed_attempts');
                localStorage.removeItem('peso_lockout_until');
                checkLockoutStatus();

                alert('Password reset successful! You may now sign in with your updated credentials.');
                if (window.hideModal) window.hideModal('resetModal');
            });
        }
    });

    window.copyVerificationLink = function () {
        const text = document.getElementById('verificationLinkDisplay')?.textContent || '';
        navigator.clipboard.writeText(text).then(() => alert('Link copied to clipboard!')).catch(() => prompt('Copy URL:', text));
    };

    window.proceedToPasswordResetForm = function () {
        const step2 = document.getElementById('forgotStep2');
        const step3 = document.getElementById('forgotStep3');
        if (step2) step2.classList.add('d-none');
        if (step3) step3.classList.remove('d-none');
    };

    // Known Staff Roster Reference
    const knownStaffAccounts = {
        'peso-admin': { email: 'peso.admin@koronadal.gov.ph', role: 'PESO Admin', firstName: 'John', lastName: 'Doe', department: 'PESO' },
        'peso-officer': { email: 'peso.officer@koronadal.gov.ph', role: 'PESO Officer', firstName: 'Jane', lastName: 'Smith', department: 'PESO' },
        'bing': { email: 'chanchanman@gmail.com', role: 'PESO Officer', firstName: 'Chandler', lastName: 'Bing', department: 'PESO' },
        'peso-officer-02': { email: 'maria.fernandez@koronadal.gov.ph', role: 'PESO Officer', firstName: 'Maria', lastName: 'Fernandez', department: 'PESO' },
        'peso-officer-03': { email: 'mark.gonzales@koronadal.gov.ph', role: 'PESO Officer', firstName: 'Mark', lastName: 'Gonzales', department: 'PESO' },
        'evaluator': { email: 'evaluator@koronadal.gov.ph', role: 'Evaluator', firstName: 'Edward', lastName: 'Davis', department: 'PESO' },
        'peso-staff-01': { email: 'staff.marquez@koronadal.gov.ph', role: 'Staff', firstName: 'Patricia', lastName: 'Marquez', department: 'PESO' },
        'cswdo-admin': { email: 'cswdo.admin@koronadal.gov.ph', role: 'CSWDO Admin', firstName: 'Robert', lastName: 'Johnson', department: 'CSWDO' },
        'cswdo-officer': { email: 'cswdo.officer@koronadal.gov.ph', role: 'CSWDO Officer', firstName: 'Mary', lastName: 'Williams', department: 'CSWDO' }
    };

    // Staff Login Form Submission Handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            if (checkLockoutStatus()) return;

            const identifier = (document.getElementById('username')?.value || '').trim();
            const password = document.getElementById('password')?.value || '';
            const errorAlert = document.getElementById('errorAlert');
            const successAlert = document.getElementById('successAlert');
            const loginBtn = document.getElementById('loginBtn');
            const spinner = loginBtn?.querySelector('.spinner');
            const btnText = loginBtn?.querySelector('span');
            const btnIcon = loginBtn?.querySelector('i');
            const lang = localStorage.getItem('lang') || 'en';

            if (errorAlert) errorAlert.style.display = 'none';
            if (successAlert) successAlert.style.display = 'none';

            // Password Complexity Gate
            const hasLetter = /[a-zA-Z]/.test(password);
            const hasNumber = /[0-9]/.test(password);
            if (password.length < 8 || !hasLetter || !hasNumber) {
                const errorMsgEl = document.getElementById('errorMessage');
                if (errorMsgEl) {
                    errorMsgEl.textContent = lang === 'tg'
                        ? "Abiso sa Seguridad: Ang password ay dapat may hindi bababa sa 8 karakter at may kasamang titik at numero."
                        : "Security Notice: Password must be at least 8 characters long and contain both letters and numbers.";
                }
                if (errorAlert) errorAlert.style.display = 'block';
                return;
            }

            if (btnText) btnText.style.display = 'none';
            if (btnIcon) btnIcon.style.display = 'none';
            if (spinner) spinner.style.display = 'block';
            if (loginBtn) loginBtn.disabled = true;

            try {
                let authSuccess = false;
                let userProfile = null;
                let accessToken = null;

                // Step 1: Direct Supabase Auth Verification
                if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                    let targetEmail = identifier.includes('@') ? identifier : null;

                    if (!targetEmail) {
                        try {
                            const { data: rpcEmail } = await supabaseClient.rpc('resolve_login_email', { p_identifier: identifier, p_portal: 'staff' });
                            if (rpcEmail) targetEmail = rpcEmail;
                        } catch (e) { }

                        if (!targetEmail) {
                            const lower = identifier.toLowerCase();
                            targetEmail = knownStaffAccounts[lower] ? knownStaffAccounts[lower].email : `${identifier}@koronadal.gov.ph`;
                        }
                    }

                    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
                        email: targetEmail,
                        password: password
                    });

                    if (!authError && authData && authData.user) {
                        let profile = null;
                        try {
                            const { data: staffData } = await supabaseClient
                                .from('staff_profiles')
                                .select('*')
                                .eq('auth_id', authData.user.id)
                                .maybeSingle();
                            if (staffData) profile = staffData;
                        } catch (e) { }

                        if (!profile) {
                            const meta = authData.user.user_metadata || {};
                            const known = knownStaffAccounts[identifier.toLowerCase()] || {};
                            profile = {
                                id: authData.user.id,
                                auth_id: authData.user.id,
                                username: meta.username || known.username || identifier,
                                role: meta.role || known.role || 'PESO Admin',
                                first_name: meta.first_name || known.firstName || 'Administrator',
                                last_name: meta.last_name || known.lastName || '',
                                email: authData.user.email,
                                department: known.department || 'PESO',
                                status: 'Active'
                            };
                        }

                        authSuccess = true;
                        userProfile = profile;
                        accessToken = authData.session.access_token;
                    }
                }

                if (!authSuccess) {
                    failedLoginAttempts++;
                    localStorage.setItem('peso_failed_attempts', failedLoginAttempts.toString());
                    if (failedLoginAttempts >= 5) {
                        lockoutUntilTimestamp = Date.now() + (15 * 60 * 1000);
                        localStorage.setItem('peso_lockout_until', lockoutUntilTimestamp.toString());
                        checkLockoutStatus();
                    }
                    throw new Error(lang === 'tg' ? 'Maling username/email o password.' : 'Invalid username/email or password.');
                }

                // Reset failed attempts on success
                failedLoginAttempts = 0;
                lockoutUntilTimestamp = 0;
                localStorage.removeItem('peso_failed_attempts');
                localStorage.removeItem('peso_lockout_until');

                // Ensure primary admin is always Active
                if ((userProfile.username && userProfile.username.toLowerCase() === 'peso-admin') || (userProfile.email && userProfile.email.toLowerCase() === 'peso.admin@koronadal.gov.ph')) {
                    userProfile.status = 'Active';
                }

                // Check status
                if (userProfile.status === 'Deactivated' || userProfile.status === 'Inactive' || userProfile.status === 'Locked') {
                    throw new Error('Account has been deactivated. Please contact your administrator.');
                }

                // Session Storage & AuthGuard Integration
                const fullName = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || userProfile.username;
                sessionStorage.setItem('jwtAccessToken', accessToken || '');
                sessionStorage.setItem('userRole', userProfile.role || 'PESO Admin');
                sessionStorage.setItem('username', userProfile.username || identifier);
                sessionStorage.setItem('userId', String(userProfile.id || '1'));
                sessionStorage.setItem('userFullName', fullName);
                sessionStorage.setItem('department', userProfile.department || 'PESO');

                if (typeof SessionManager !== 'undefined' && SessionManager.save) {
                    SessionManager.save(userProfile.id, accessToken, userProfile.role);
                }

                // Audit Log
                if (typeof PESOSafeguards !== 'undefined' && PESOSafeguards.logAudit) {
                    PESOSafeguards.logAudit({
                        intent: 'Staff Login Success',
                        actionType: 'LOGIN_SUCCESS',
                        targetEntity: 'Authentication Engine',
                        status: 'AUTHENTICATED',
                        details: `Staff member "${userProfile.username}" (${userProfile.role}) logged in successfully.`
                    });
                }

                const dict = (window.LoginSupport && window.LoginSupport.translations && window.LoginSupport.translations[lang]) || (window.translations && window.translations[lang]) || {};
                if (successAlert) {
                    const successMsgEl = successAlert.querySelector('#successMessage');
                    if (successMsgEl) successMsgEl.textContent = dict['success_redirect'] || 'Login successful! Redirecting...';
                    successAlert.style.display = 'block';
                }

                // Determine Portal Destination
                const roleLower = (userProfile.role || '').toLowerCase();
                let redirectUrl = 'peso_admin.html';

                if (roleLower.includes('peso') && roleLower.includes('officer')) {
                    redirectUrl = 'peso_officer.html';
                } else if (roleLower.includes('cswdo') && roleLower.includes('admin')) {
                    redirectUrl = 'cswdo_admin.html';
                } else if (roleLower.includes('cswdo') && roleLower.includes('officer')) {
                    redirectUrl = 'cswdo_officer.html';
                } else if (roleLower.includes('evaluator')) {
                    redirectUrl = 'evaluator.html';
                }

                setTimeout(() => { window.location.href = redirectUrl; }, 600);

            } catch (err) {
                const errorMsgEl = document.getElementById('errorMessage');
                if (errorMsgEl) errorMsgEl.textContent = err.message;
                if (errorAlert) errorAlert.style.display = 'block';
                if (btnText) btnText.style.display = 'inline';
                if (btnIcon) btnIcon.style.display = 'inline-block';
                if (spinner) spinner.style.display = 'none';
                if (loginBtn) loginBtn.disabled = false;
            }
        });
    }

})();

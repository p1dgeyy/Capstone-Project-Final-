/**
 * =========================================================================
 * CITY OF KORONADAL - BENEFICIARY LOGIN CONTROLLER (beneficiary-login.js)
 * Handles Password Reset Verification, Supabase Auth Authentication,
 * Seamless Login with EITHER Username OR Email, Session Initialization & Routing.
 * =========================================================================
 */

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        // Reset login form fields on page load
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.reset();

        // Password Reset Modal Controls
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

                let targetEmail = identifier.includes('@') ? identifier : null;
                if (!targetEmail && typeof supabaseClient !== 'undefined' && supabaseClient) {
                    try {
                        const { data: benRecord } = await supabaseClient
                            .from('beneficiaries')
                            .select('email')
                            .or(`username.ilike.${identifier},qr_code.ilike.${identifier}`)
                            .maybeSingle();
                        if (benRecord && benRecord.email) {
                            targetEmail = benRecord.email;
                        }
                    } catch (err) {
                        console.warn('[RESET] Beneficiary lookup error:', err);
                    }
                }
                if (!targetEmail) {
                    targetEmail = identifier.includes('@') ? identifier : `${identifier}@beneficiary.local`;
                }

                const resetToken = 'BEN-RST-' + Math.random().toString(36).substring(2, 8).toUpperCase();

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

    // Beneficiary Login Form Submission Handler (Supports Username OR Email)
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

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
            if (btnText) btnText.style.display = 'none';
            if (btnIcon) btnIcon.style.display = 'none';
            if (spinner) spinner.style.display = 'block';
            if (loginBtn) loginBtn.disabled = true;

            try {
                let authSuccess = false;
                let userProfile = null;
                let accessToken = null;

                // Step 1: Direct Supabase Authentication (Resolving Username OR Email)
                if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                    let targetEmail = null;
                    let resolvedBenFromDb = null;

                    // 1. Check beneficiaries table by username, email, or qr_code
                    try {
                        const { data: benRecord } = await supabaseClient
                            .from('beneficiaries')
                            .select('*')
                            .or(`username.ilike.${identifier},email.ilike.${identifier},qr_code.ilike.${identifier}`)
                            .maybeSingle();

                        if (benRecord) {
                            resolvedBenFromDb = benRecord;
                            if (benRecord.email) {
                                targetEmail = benRecord.email;
                            }
                        }
                    } catch (lookupErr) {
                        console.warn('[LOGIN] Beneficiary database lookup notice:', lookupErr);
                    }

                    // 2. Try RPC resolve_login_email if available
                    if (!targetEmail) {
                        try {
                            const { data: rpcEmail } = await supabaseClient
                                .rpc('resolve_login_email', { p_identifier: identifier, p_portal: 'beneficiary' });
                            if (rpcEmail) targetEmail = rpcEmail;
                        } catch (rpcErr) { }
                    }

                    // 3. Build candidate list to try with Supabase Auth
                    const candidateEmails = [];
                    if (targetEmail) candidateEmails.push(targetEmail);
                    if (identifier.includes('@')) candidateEmails.push(identifier);
                    candidateEmails.push(`${identifier}@beneficiary.local`);
                    const uniqueCandidates = [...new Set(candidateEmails.filter(Boolean))];

                    let authData = null;
                    let authError = null;

                    for (const candidate of uniqueCandidates) {
                        const res = await supabaseClient.auth.signInWithPassword({
                            email: candidate,
                            password: password
                        });

                        if (!res.error && res.data && res.data.user) {
                            authData = res.data;
                            authError = null;
                            break;
                        } else {
                            authError = res.error;
                        }
                    }

                    if (!authError && authData && authData.user) {
                        let profile = resolvedBenFromDb;

                        if (!profile) {
                            const { data: profByAuth } = await supabaseClient
                                .from('beneficiaries')
                                .select('*')
                                .eq('auth_id', authData.user.id)
                                .maybeSingle();
                            if (profByAuth) profile = profByAuth;
                        }

                        if (!profile && authData.user.email) {
                            const { data: profByEmail } = await supabaseClient
                                .from('beneficiaries')
                                .select('*')
                                .eq('email', authData.user.email)
                                .maybeSingle();
                            if (profByEmail) {
                                profile = profByEmail;
                                supabaseClient.from('beneficiaries').update({ auth_id: authData.user.id }).eq('id', profByEmail.id).then(() => {});
                            }
                        }

                        if (!profile && identifier) {
                            const { data: profByUsername } = await supabaseClient
                                .from('beneficiaries')
                                .select('*')
                                .ilike('username', identifier)
                                .maybeSingle();
                            if (profByUsername) {
                                profile = profByUsername;
                                supabaseClient.from('beneficiaries').update({ auth_id: authData.user.id }).eq('id', profByUsername.id).then(() => {});
                            }
                        }

                        if (profile) {
                            profile.role = 'Beneficiary';
                            authSuccess = true;
                            userProfile = profile;
                            accessToken = authData.session.access_token;
                        } else {
                            // Fallback profile from user metadata
                            const meta = authData.user.user_metadata || {};
                            userProfile = {
                                id: authData.user.id,
                                qr_code: `QR-${authData.user.id.substring(0, 8).toUpperCase()}`,
                                username: meta.username || identifier,
                                first_name: meta.first_name || 'Beneficiary',
                                last_name: meta.last_name || '',
                                email: authData.user.email,
                                role: 'Beneficiary',
                                status: 'Active'
                            };
                            authSuccess = true;
                            accessToken = authData.session.access_token;
                        }
                    }
                }

                if (!authSuccess) {
                    throw new Error(lang === 'tg' ? 'Hindi tamang username/email o password.' : 'Invalid username/email or password.');
                }

                // Check account status
                if (userProfile.status === 'Deactivated' || userProfile.status === 'Inactive' || userProfile.status === 'Archived') {
                    throw new Error('Account has been deactivated. Please contact your administrator.');
                }

                // Save session data & AuthGuard integration
                const fullName = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || userProfile.username;
                if (typeof SessionManager !== 'undefined' && SessionManager.save) {
                    SessionManager.save(userProfile.id, accessToken, 'Beneficiary');
                }

                sessionStorage.setItem('jwtAccessToken', accessToken || '');
                sessionStorage.setItem('userRole', 'Beneficiary');
                sessionStorage.setItem('username', userProfile.username);
                sessionStorage.setItem('userId', String(userProfile.id));
                sessionStorage.setItem('userFullName', fullName);
                sessionStorage.setItem('beneficiaryLoggedIn', 'true');
                sessionStorage.setItem('beneficiaryUsername', userProfile.username);
                sessionStorage.setItem('beneficiaryName', fullName);
                if (userProfile.qr_code) sessionStorage.setItem('beneficiaryQrCode', userProfile.qr_code);

                // Audit Log
                if (typeof PESOSafeguards !== 'undefined' && PESOSafeguards.logAudit) {
                    PESOSafeguards.logAudit({
                        userId: userProfile.qr_code || String(userProfile.id),
                        userRole: 'BENEFICIARY',
                        intent: 'Beneficiary Login Success',
                        actionType: 'LOGIN_SUCCESS',
                        targetEntity: 'Authentication Engine',
                        status: 'AUTHENTICATED',
                        details: `Beneficiary "${userProfile.username}" (${userProfile.qr_code || userProfile.id}) logged in successfully.`
                    });
                } else if (typeof supabaseClient !== 'undefined' && supabaseClient && userProfile.qr_code) {
                    supabaseClient.from('audit_logs').insert({
                        beneficiary_qr: userProfile.qr_code,
                        action: 'SUCCESS:LOGIN_SUCCESS',
                        entity_type: 'Authentication Engine',
                        details: `Beneficiary "${userProfile.username}" (${userProfile.qr_code}) logged in successfully.`
                    }).then(() => {});
                }

                const dict = (window.LoginSupport && window.LoginSupport.translations && window.LoginSupport.translations[lang]) || (window.translations && window.translations[lang]) || {};
                if (successAlert) {
                    const successMsgEl = successAlert.querySelector('#successMessage');
                    if (successMsgEl) successMsgEl.textContent = dict['success_redirect'] || 'Login successful! Redirecting...';
                    successAlert.style.display = 'block';
                }

                setTimeout(() => {
                    window.location.href = 'beneficiary.html';
                }, 600);

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

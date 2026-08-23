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
        // Check if redirected due to session kick or inactivity timeout
        if (typeof SessionManager !== 'undefined' && SessionManager.checkAndDisplayLoginNotice) {
            SessionManager.checkAndDisplayLoginNotice('errorMessage', 'errorAlert');
        }

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
                    const cleanIdentifier = identifier.trim();

                    // 1. Check beneficiaries table by username, email, qr_code, or phone
                    try {
                        const { data: benRecord } = await supabaseClient
                            .from('beneficiaries')
                            .select('*')
                            .or(`username.ilike.${cleanIdentifier},email.ilike.${cleanIdentifier},qr_code.ilike.${cleanIdentifier}`)
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
                                .rpc('resolve_login_email', { p_identifier: cleanIdentifier, p_portal: 'beneficiary' });
                            if (rpcEmail) targetEmail = rpcEmail;
                        } catch (rpcErr) { }
                    }

                    // 3. Build candidate list to try with Supabase Auth
                    const candidateEmails = [];
                    if (targetEmail) candidateEmails.push(targetEmail);
                    if (cleanIdentifier.includes('@')) candidateEmails.push(cleanIdentifier);
                    candidateEmails.push(`${cleanIdentifier}@beneficiary.local`);
                    candidateEmails.push(`${cleanIdentifier.toLowerCase()}@beneficiary.local`);
                    candidateEmails.push(`${cleanIdentifier}@gmail.com`);
                    candidateEmails.push(`${cleanIdentifier}@koronadal.gov.ph`);
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

                // Strict Single Active Device Check: Prevent login if already active on another device
                if (typeof SessionManager !== 'undefined' && SessionManager.checkAccountAlreadyActive) {
                    const activeCheck = await SessionManager.checkAccountAlreadyActive(userProfile.qr_code || userProfile.id, userProfile.username);
                    if (activeCheck.isAlreadyActive) {
                        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                            try { await supabaseClient.auth.signOut(); } catch (e) {}
                        }
                        throw new Error(lang === 'tg'
                            ? `Kasalukuyang ginagamit ang account na ito sa ibang device.`
                            : `Current account is being used on another device. Please log out from that device first to log in here.`);
                    }
                }

                // Save session data & AuthGuard integration
                const fullName = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || userProfile.username;
                if (typeof SessionManager !== 'undefined' && SessionManager.save) {
                    SessionManager.save(userProfile.qr_code || userProfile.id, accessToken, 'Beneficiary', {
                        username: userProfile.username,
                        fullName: fullName,
                        qrCode: userProfile.qr_code,
                        email: userProfile.email || ''
                    });
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

    // =========================================================================
    // FORGOT PASSWORD / GMAIL OTP PASSWORD RESET ENGINE
    // =========================================================================
    let activeResetEmail = '';
    let resetExpiryInterval = null;
    let resetResendInterval = null;

    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = document.getElementById('resetModal');
            if (modal) {
                modal.classList.add('active');
                modal.classList.add('show');
                document.body.style.overflow = 'hidden';
                document.getElementById('forgotStep1').classList.remove('d-none');
                document.getElementById('forgotStep2').classList.add('d-none');
                document.getElementById('forgotStep3').classList.add('d-none');
                setTimeout(() => document.getElementById('forgotIdentifier')?.focus(), 300);
            }
        });
    }

    const closeResetBtn = document.getElementById('closeResetBtn');
    if (closeResetBtn) {
        closeResetBtn.addEventListener('click', () => {
            const modal = document.getElementById('resetModal');
            if (modal) {
                modal.classList.remove('active');
                modal.classList.remove('show');
                document.body.style.overflow = 'auto';
            }
        });
    }

    window.handleSendResetOtp = async function (e) {
        e.preventDefault();
        const identifier = document.getElementById('forgotIdentifier').value.trim();
        const btn = document.getElementById('btnSendResetOtp');

        if (!identifier) return;

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Checking account...';

            const res = await OTPAuth.sendPasswordResetOtp(identifier);
            activeResetEmail = res.email;

            document.getElementById('forgotUserEmailBadge').textContent = res.maskedRecipient;
            document.getElementById('forgotStep1').classList.add('d-none');
            document.getElementById('forgotStep2').classList.remove('d-none');
            document.getElementById('forgotStep3').classList.add('d-none');

            startResetTimers();
            setupResetInputs();

        } catch (err) {
            window.showSystemNotification({
                title: 'Password Reset Notice',
                message: err.message || 'Could not dispatch password reset code.',
                type: 'error'
            });
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-send-fill me-1"></i> Send Verification Code';
        }
    };

    function startResetTimers() {
        if (resetExpiryInterval) clearInterval(resetExpiryInterval);
        let expirySecs = 300;
        const timerEl = document.getElementById('resetExpiryTimer');

        resetExpiryInterval = setInterval(() => {
            const mins = Math.floor(expirySecs / 60).toString().padStart(2, '0');
            const secs = (expirySecs % 60).toString().padStart(2, '0');
            timerEl.textContent = `${mins}:${secs}`;
            if (expirySecs <= 0) {
                clearInterval(resetExpiryInterval);
                timerEl.textContent = 'Expired';
            }
            expirySecs--;
        }, 1000);

        if (resetResendInterval) clearInterval(resetResendInterval);
        let cooldown = 60;
        const btnResend = document.getElementById('btnResendResetOtp');
        const cooldownEl = document.getElementById('resetResendCooldown');
        btnResend.disabled = true;

        resetResendInterval = setInterval(() => {
            cooldown--;
            if (cooldown <= 0) {
                clearInterval(resetResendInterval);
                btnResend.disabled = false;
                cooldownEl.textContent = '';
            } else {
                cooldownEl.textContent = `(${cooldown}s)`;
            }
        }, 1000);
    }

    function setupResetInputs() {
        const inputs = [
            document.getElementById('resetDigit1'),
            document.getElementById('resetDigit2'),
            document.getElementById('resetDigit3'),
            document.getElementById('resetDigit4'),
            document.getElementById('resetDigit5'),
            document.getElementById('resetDigit6')
        ];
        inputs.forEach((input, idx) => {
            if (!input) return;
            input.value = '';
            input.oninput = () => {
                input.value = input.value.replace(/[^0-9]/g, '');
                if (input.value.length === 1 && idx < inputs.length - 1) {
                    inputs[idx + 1].focus();
                }
            };
            input.onkeydown = (e) => {
                if (e.key === 'Backspace' && !input.value && idx > 0) {
                    inputs[idx - 1].focus();
                }
            };
            input.onpaste = (e) => {
                e.preventDefault();
                const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
                text.split('').forEach((ch, i) => {
                    if (inputs[i]) inputs[i].value = ch;
                });
                const next = Math.min(text.length, inputs.length - 1);
                inputs[next].focus();
            };
        });
        setTimeout(() => inputs[0] && inputs[0].focus(), 300);
    }

    window.handleResendResetOtp = async function () {
        try {
            await OTPAuth.sendPasswordResetOtp(activeResetEmail);
            startResetTimers();
            setupResetInputs();
        } catch (err) {
            window.showSystemNotification({
                title: 'Resend Failed',
                message: err.message || 'Could not resend reset code.',
                type: 'error'
            });
        }
    };

    window.handleVerifyResetOtp = async function () {
        let code = '';
        for (let i = 1; i <= 6; i++) {
            const el = document.getElementById(`resetDigit${i}`);
            if (el && el.value) code += el.value.trim();
        }

        const alertEl = document.getElementById('resetOtpAlert');
        const alertMsg = document.getElementById('resetOtpAlertMsg');

        if (code.length < 6) {
            alertMsg.textContent = 'Please enter your complete 6-digit verification code.';
            alertEl.classList.remove('d-none');
            return;
        }

        alertEl.classList.add('d-none');

        try {
            await OTPAuth.verifyPasswordResetOtp(activeResetEmail, code);

            document.getElementById('forgotStep1').classList.add('d-none');
            document.getElementById('forgotStep2').classList.add('d-none');
            document.getElementById('forgotStep3').classList.remove('d-none');
            setTimeout(() => document.getElementById('newResetPassword')?.focus(), 300);

        } catch (err) {
            alertMsg.textContent = err.message || 'Invalid or expired verification code.';
            alertEl.classList.remove('d-none');
        }
    };

    window.handleCommitNewPassword = async function (e) {
        e.preventDefault();
        const p1 = document.getElementById('newResetPassword').value;
        const p2 = document.getElementById('confirmResetPassword').value;
        const btn = document.getElementById('btnUpdatePassword');

        if (p1 !== p2) {
            window.showSystemNotification({
                title: 'Password Mismatch',
                message: 'New password and confirmation do not match.',
                type: 'error'
            });
            return;
        }

        if (p1.length < 8) {
            window.showSystemNotification({
                title: 'Weak Password',
                message: 'Password must be at least 8 characters long.',
                type: 'error'
            });
            return;
        }

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Updating password...';

            await OTPAuth.resetBeneficiaryPassword(activeResetEmail, p1);

            window.showSystemNotification({
                title: 'Password Reset Successful',
                message: 'Your password has been updated in the database! You can now log in.',
                type: 'success',
                duration: 6000
            });

            // Close modal
            const modal = document.getElementById('resetModal');
            if (modal) {
                modal.classList.remove('active');
                modal.classList.remove('show');
                document.body.style.overflow = 'auto';
            }

            // Fill username in login form
            const usernameInput = document.getElementById('username');
            if (usernameInput) usernameInput.value = activeResetEmail;
            document.getElementById('password')?.focus();

        } catch (err) {
            window.showSystemNotification({
                title: 'Reset Error',
                message: err.message || 'Failed to update password in database.',
                type: 'error'
            });
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Save New Password';
        }
    };

})();


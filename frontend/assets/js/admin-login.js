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

        // Check if redirected due to session kick or inactivity timeout
        if (typeof SessionManager !== 'undefined' && SessionManager.checkAndDisplayLoginNotice) {
            SessionManager.checkAndDisplayLoginNotice('errorMessage', 'errorAlert');
        }

        // Clear any stale cached credentials/sessions on login portal load
        ['userId', 'userRole', 'username', 'userFullName', 'department', 'jwtAccessToken', 'sessionToken', 'currentSessionId'].forEach(k => sessionStorage.removeItem(k));

        // Reset form inputs so no credentials persist on page refresh
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.reset();

        // =========================================================================
        // OFFICER PASSWORD RESET ENGINE (ADMIN APPROVAL WORKFLOW)
        // =========================================================================
        let activeResetTicketId = '';
        let activeResetIdentifier = '';
        let resetRealtimeSub = null;

        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                const step1 = document.getElementById('forgotStep1');
                const step2 = document.getElementById('forgotStep2');
                const step3 = document.getElementById('forgotStep3');
                const errAlert = document.getElementById('resetErrorAlert');
                const succAlert = document.getElementById('resetSuccessAlert');
                if (errAlert) errAlert.classList.add('d-none');
                if (succAlert) succAlert.classList.add('d-none');
                if (step1) step1.classList.remove('d-none');
                if (step2) step2.classList.add('d-none');
                if (step3) step3.classList.add('d-none');
                if (window.showModal) window.showModal('resetModal');
                setTimeout(() => document.getElementById('forgotIdentifier')?.focus(), 200);
            });
        }

        const closeResetBtn = document.getElementById('closeResetBtn');
        if (closeResetBtn) closeResetBtn.addEventListener('click', () => window.hideModal && window.hideModal('resetModal'));

        const resetBackdrop = document.getElementById('resetBackdrop');
        if (resetBackdrop) resetBackdrop.addEventListener('click', () => window.hideModal && window.hideModal('resetModal'));

        // Step 1: Submit Request to Admin
        const forgotForm = document.getElementById('forgotPasswordForm');
        if (forgotForm) {
            forgotForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                const identifier = (document.getElementById('forgotIdentifier')?.value || '').trim();
                const department = (document.getElementById('forgotDepartment')?.value || 'PESO').trim();
                const reason = (document.getElementById('forgotReason')?.value || '').trim();
                const btn = document.getElementById('btnSendVerification');
                const errAlert = document.getElementById('resetErrorAlert');
                const errText = document.getElementById('resetErrorMsg');

                if (errAlert) errAlert.classList.add('d-none');

                if (!identifier) {
                    if (errText) errText.textContent = 'Please enter your registered username or email.';
                    if (errAlert) errAlert.classList.remove('d-none');
                    return;
                }

                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Submitting to Admin...';
                }

                try {
                    let reqRes = null;
                    if (typeof DataService !== 'undefined' && DataService.passwordResets) {
                        reqRes = await DataService.passwordResets.createRequest({
                            username: identifier,
                            email: identifier,
                            department: department,
                            reason: reason
                        });
                    } else if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                        const { data: staffMatches } = await supabaseClient
                            .from('staff_profiles')
                            .select('*')
                            .or(`email.ilike.${identifier},username.ilike.${identifier}`)
                            .limit(1);

                        if (!staffMatches || staffMatches.length === 0) {
                            throw new Error('No registered staff or officer account found matching "' + identifier + '".');
                        }

                        const sp = staffMatches[0];
                        const ticketId = 'TKT-PW-' + Math.floor(100000 + Math.random() * 900000);
                        const { data: insData, error: insErr } = await supabaseClient
                            .from('password_reset_requests')
                            .insert({
                                ticket_id: ticketId,
                                staff_id: sp.id,
                                username: sp.username,
                                email: sp.email,
                                role: sp.role || 'Officer',
                                department: department || 'PESO',
                                reason: reason || 'Officer requested password reset via official login portal.',
                                status: 'Pending',
                                created_at: new Date().toISOString()
                            })
                            .select()
                            .single();

                        if (insErr) throw insErr;
                        reqRes = { data: insData, isExisting: false };
                    }

                    const reqData = reqRes.data;
                    activeResetTicketId = reqData.ticket_id || ('TKT-PW-' + Math.floor(100000 + Math.random() * 900000));
                    activeResetIdentifier = reqData.email || identifier;

                    // Update Step 2 Badges
                    const ticketBadge = document.getElementById('resetTicketIdBadge');
                    const emailBadge = document.getElementById('forgotUserEmailBadge');
                    const deptBadge = document.getElementById('resetDeptBadge');
                    const ticketInput = document.getElementById('verifiedResetTicket');

                    if (ticketBadge) ticketBadge.textContent = activeResetTicketId;
                    if (emailBadge) emailBadge.textContent = reqData.email || identifier;
                    if (deptBadge) deptBadge.textContent = reqData.department || department;
                    if (ticketInput) ticketInput.value = activeResetTicketId;

                    // Check if already approved
                    if (reqData.status === 'Approved') {
                        updateResetStep2ToApproved();
                    } else {
                        updateResetStep2ToPending();
                    }

                    // Transition to Step 2
                    const step1 = document.getElementById('forgotStep1');
                    const step2 = document.getElementById('forgotStep2');
                    const step3 = document.getElementById('forgotStep3');
                    if (step1) step1.classList.add('d-none');
                    if (step2) step2.classList.remove('d-none');
                    if (step3) step3.classList.add('d-none');

                    // Setup Realtime Watcher for Approval
                    startResetRealtimeWatcher(activeResetTicketId, activeResetIdentifier);

                    if (window.showSystemNotification) {
                        window.showSystemNotification({
                            title: reqRes.isExisting ? 'Existing Request Found' : 'Request Submitted',
                            message: reqRes.message || `Password reset request ${activeResetTicketId} submitted to Admin.`,
                            type: 'info'
                        });
                    }

                } catch (err) {
                    if (errText) errText.textContent = err.message || 'Error processing request.';
                    if (errAlert) errAlert.classList.remove('d-none');
                } finally {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="bi bi-send-fill me-1"></i> Send Request to Administrator';
                    }
                }
            });
        }

        function updateResetStep2ToPending() {
            const icon = document.getElementById('resetStatusIcon');
            const title = document.getElementById('resetStep2Title');
            const desc = document.getElementById('resetStep2Desc');
            const badge = document.getElementById('resetStatusBadge');
            const btnProceed = document.getElementById('btnProceedToNewPassword');

            if (icon) icon.innerHTML = '<i class="bi bi-hourglass-split" style="font-size: 2.8rem;"></i>';
            if (icon) icon.className = 'text-warning mb-2';
            if (title) title.textContent = 'Request Awaiting Admin Approval';
            if (desc) desc.textContent = 'Your password reset request has been transmitted to the Administrator in real-time. Once approved, you can set your new password.';
            if (badge) {
                badge.className = 'badge bg-warning text-dark px-2.5 py-1.5';
                badge.innerHTML = '<span class="spinner-grow spinner-grow-sm me-1" style="width: 8px; height: 8px;"></span> Pending Admin Approval';
            }
            if (btnProceed) btnProceed.classList.add('d-none');
        }

        function updateResetStep2ToApproved() {
            const icon = document.getElementById('resetStatusIcon');
            const title = document.getElementById('resetStep2Title');
            const desc = document.getElementById('resetStep2Desc');
            const badge = document.getElementById('resetStatusBadge');
            const btnProceed = document.getElementById('btnProceedToNewPassword');

            if (icon) icon.innerHTML = '<i class="bi bi-check-circle-fill text-success" style="font-size: 2.8rem;"></i>';
            if (icon) icon.className = 'text-success mb-2';
            if (title) title.textContent = 'Request Approved by Admin!';
            if (desc) desc.textContent = 'The Administrator has approved your password reset request. Click the button below to set your new password.';
            if (badge) {
                badge.className = 'badge bg-success text-white px-2.5 py-1.5';
                badge.innerHTML = '<i class="bi bi-check2 me-1"></i> Approved by Admin';
            }
            if (btnProceed) btnProceed.classList.remove('d-none');
        }

        // Live Realtime Watcher
        function startResetRealtimeWatcher(ticketId, identifier) {
            if (typeof window.onRealtimeEvent === 'function') {
                window.onRealtimeEvent((ev) => {
                    if (ev.type === 'OFFICER_PASSWORD_RESET_APPROVED') {
                        const req = ev.payload?.request;
                        if (req && (req.ticket_id === ticketId || req.email?.toLowerCase() === identifier?.toLowerCase() || req.username?.toLowerCase() === identifier?.toLowerCase())) {
                            updateResetStep2ToApproved();
                            if (window.showSystemNotification) {
                                window.showSystemNotification({
                                    title: 'Request Approved!',
                                    message: 'Your administrator has approved your password reset request.',
                                    type: 'success'
                                });
                            }
                        }
                    }
                });
            }

            // Also check via Supabase client realtime channel if available
            if (typeof supabaseClient !== 'undefined' && supabaseClient && !resetRealtimeSub) {
                try {
                    resetRealtimeSub = supabaseClient
                        .channel('officer-pwd-reset-status')
                        .on('postgres_changes', {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'password_reset_requests'
                        }, (payload) => {
                            if (payload.new && (payload.new.ticket_id === ticketId || payload.new.email?.toLowerCase() === identifier?.toLowerCase())) {
                                if (payload.new.status === 'Approved') {
                                    updateResetStep2ToApproved();
                                }
                            }
                        })
                        .subscribe();
                } catch (e) {}
            }
        }

        // Step 2 Action: Manual Status Check
        window.checkOfficerResetStatus = async function () {
            const ticketId = activeResetTicketId || document.getElementById('verifiedResetTicket')?.value || document.getElementById('forgotIdentifier')?.value;
            if (!ticketId) return;

            try {
                if (typeof DataService !== 'undefined' && DataService.passwordResets) {
                    const res = await DataService.passwordResets.getRequestStatus(ticketId);
                    if (res && res.data) {
                        const status = res.data.status;
                        if (status === 'Approved') {
                            updateResetStep2ToApproved();
                            if (window.showSystemNotification) {
                                window.showSystemNotification({
                                    title: 'Request Approved!',
                                    message: 'Your administrator has approved your password reset request.',
                                    type: 'success'
                                });
                            }
                            // Auto-proceed after brief moment
                            setTimeout(() => proceedToPasswordResetForm(), 500);
                        } else if (status === 'Pending') {
                            updateResetStep2ToPending();
                            alert(`Status: Pending Admin Approval.\n\nTicket: ${res.data.ticket_id}\nDepartment: ${res.data.department}\n\nPlease ask your ${res.data.department} Administrator to approve this request.`);
                        } else if (status === 'Rejected') {
                            alert(`Status: Rejected.\n\nReason: ${res.data.admin_notes || 'Denied by Administrator.'}`);
                        } else if (status === 'Completed') {
                            alert('This password reset request has already been completed.');
                        }
                        return;
                    }
                }
                alert('No active reset request status found. Please submit a request.');
            } catch (err) {
                alert('Could not check status: ' + (err.message || err));
            }
        };

        window.proceedToPasswordResetForm = function () {
            const step2 = document.getElementById('forgotStep2');
            const step3 = document.getElementById('forgotStep3');
            if (step2) step2.classList.add('d-none');
            if (step3) step3.classList.remove('d-none');
            setTimeout(() => document.getElementById('newResetPassword')?.focus(), 200);
        };

        // Step 3: Commit New Password
        const resetCompleteForm = document.getElementById('resetCompleteForm');
        if (resetCompleteForm) {
            resetCompleteForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                const newPass = document.getElementById('newResetPassword')?.value || '';
                const confirmPass = document.getElementById('confirmResetPassword')?.value || '';
                const btn = document.getElementById('btnUpdatePassword');
                const errAlert = document.getElementById('resetErrorAlert');
                const errText = document.getElementById('resetErrorMsg');

                if (errAlert) errAlert.classList.add('d-none');

                if (newPass !== confirmPass) {
                    if (errText) errText.textContent = 'New Password and Confirmation do not match.';
                    if (errAlert) errAlert.classList.remove('d-none');
                    return;
                }

                if (newPass.length < 8) {
                    if (errText) errText.textContent = 'Password must be at least 8 characters in length.';
                    if (errAlert) errAlert.classList.remove('d-none');
                    return;
                }

                const hasLetter = /[a-zA-Z]/.test(newPass);
                const hasNumber = /[0-9]/.test(newPass);
                if (!hasLetter || !hasNumber) {
                    if (errText) errText.textContent = 'Password must contain both letters and numbers.';
                    if (errAlert) errAlert.classList.remove('d-none');
                    return;
                }

                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Updating in Supabase...';
                }

                try {
                    const identifier = activeResetTicketId || activeResetIdentifier || document.getElementById('forgotIdentifier')?.value;
                    let completeRes = null;

                    if (typeof DataService !== 'undefined' && DataService.passwordResets) {
                        completeRes = await DataService.passwordResets.completePasswordReset({
                            identifier: identifier,
                            newPassword: newPass
                        });
                    }

                    if (completeRes && completeRes.error) {
                        throw new Error(completeRes.error.message);
                    }

                    // Reset failed attempt lockouts
                    failedLoginAttempts = 0;
                    lockoutUntilTimestamp = 0;
                    localStorage.removeItem('peso_failed_attempts');
                    localStorage.removeItem('peso_lockout_until');
                    checkLockoutStatus();

                    if (window.showSystemNotification) {
                        window.showSystemNotification({
                            title: 'Password Updated Successfully',
                            message: 'Your official password has been saved and updated in Supabase! You can now log in.',
                            type: 'success',
                            duration: 7000
                        });
                    }

                    alert('Password reset successful! You may now sign in with your updated credentials.');

                    if (window.hideModal) window.hideModal('resetModal');

                    // Pre-fill username on login form
                    const usernameInp = document.getElementById('username');
                    if (usernameInp && activeResetIdentifier) {
                        usernameInp.value = activeResetIdentifier;
                    }
                    document.getElementById('password')?.focus();

                } catch (err) {
                    if (errText) errText.textContent = err.message || 'Failed to update password.';
                    if (errAlert) errAlert.classList.remove('d-none');
                } finally {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Save & Update Password in Supabase';
                    }
                }
            });
        }

        // Staff Login Form Submission Handler
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

                // Step 1: Direct Supabase Auth Verification (Username OR Email)
                let specificErrorMsg = null;
                if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                    let targetEmail = null;
                    let resolvedStaffFromDb = null;
                    const cleanIdentifier = identifier.trim();

                    // 1. Check staff_profiles table by username or email
                    try {
                        const { data: staffMatch } = await supabaseClient
                            .from('staff_profiles')
                            .select('*')
                            .or(`username.ilike.${cleanIdentifier},email.ilike.${cleanIdentifier}`)
                            .maybeSingle();
                        if (staffMatch) {
                            resolvedStaffFromDb = staffMatch;
                            if (staffMatch.email) targetEmail = staffMatch.email;
                        }
                    } catch (lookupErr) {
                        console.warn('[ADMIN_LOGIN] Staff profile lookup notice:', lookupErr);
                    }

                    // 1.5: Detect if account is actually a Beneficiary trying to log into Staff Portal
                    if (!resolvedStaffFromDb) {
                        try {
                            const { data: benMatch } = await supabaseClient
                                .from('beneficiaries')
                                .select('id, username, email, qr_code')
                                .or(`username.ilike.${cleanIdentifier},email.ilike.${cleanIdentifier},qr_code.ilike.${cleanIdentifier}`)
                                .maybeSingle();
                            if (benMatch) {
                                throw new Error(`Beneficiary Account Detected: You are attempting to log into the Staff Portal with a Beneficiary account. Please use the Beneficiary Login Portal (<a href="official_login.html" class="fw-bold text-decoration-underline text-white">official_login.html</a>).`);
                            }
                        } catch (benCheckErr) {
                            if (benCheckErr.message && benCheckErr.message.includes('Beneficiary Account Detected')) {
                                throw benCheckErr;
                            }
                        }
                    }

                    // 2. Try RPC resolve_login_email if available
                    if (!targetEmail) {
                        try {
                            const { data: rpcEmail } = await supabaseClient
                                .rpc('resolve_login_email', { p_identifier: cleanIdentifier, p_portal: 'staff' });
                            if (rpcEmail) targetEmail = rpcEmail;
                        } catch (e) { }
                    }

                    // 3. Candidate emails list
                    const candidateEmails = [];
                    if (targetEmail) candidateEmails.push(targetEmail);
                    if (cleanIdentifier.includes('@')) candidateEmails.push(cleanIdentifier);
                    candidateEmails.push(`${cleanIdentifier}@gmail.com`);
                    candidateEmails.push(`${cleanIdentifier.toLowerCase()}@gmail.com`);
                    candidateEmails.push(`${cleanIdentifier}@koronadal.gov.ph`);
                    candidateEmails.push(`${cleanIdentifier.toLowerCase()}@koronadal.gov.ph`);
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
                            if (res.error && res.error.message && res.error.message.toLowerCase().includes('email not confirmed')) {
                                specificErrorMsg = 'Email Not Confirmed: Supabase requires email verification. Please disable "Confirm email" in Supabase Auth Settings.';
                            }
                        }
                    }

                    if (!authError && authData && authData.user) {
                        let profile = resolvedStaffFromDb;
                        try {
                            const { data: staffData } = await supabaseClient
                                .from('staff_profiles')
                                .select('*')
                                .eq('auth_id', authData.user.id)
                                .maybeSingle();
                            if (staffData) profile = staffData;
                        } catch (e) { }

                        // If not linked yet, match by email and link auth_id
                        if (!profile && authData.user.email) {
                            try {
                                const { data: staffByEmail } = await supabaseClient
                                    .from('staff_profiles')
                                    .select('*')
                                    .eq('email', authData.user.email)
                                    .maybeSingle();
                                if (staffByEmail) {
                                    profile = staffByEmail;
                                    supabaseClient.from('staff_profiles').update({ auth_id: authData.user.id }).eq('id', staffByEmail.id).then(() => {});
                                }
                            } catch (e) { }
                        }

                        if (!profile) {
                            const meta = authData.user.user_metadata || {};
                            profile = {
                                id: authData.user.id,
                                auth_id: authData.user.id,
                                username: meta.username || identifier,
                                role: meta.role || (targetEmail && targetEmail.includes('admin') ? 'PESO Admin' : 'PESO Officer'),
                                first_name: meta.first_name || 'Staff',
                                last_name: meta.last_name || 'Member',
                                email: authData.user.email,
                                department: meta.department || 'PESO',
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
                    if (specificErrorMsg) throw new Error(specificErrorMsg);
                    throw new Error(lang === 'tg' ? 'Maling username/email o password.' : 'Invalid username/email or password.');
                }

                // Reset failed attempts on success
                failedLoginAttempts = 0;
                lockoutUntilTimestamp = 0;
                localStorage.removeItem('peso_failed_attempts');
                localStorage.removeItem('peso_lockout_until');

                // Ensure primary admin is always Active
                if ((userProfile.username && userProfile.username.toLowerCase() === 'peso-admin') || (userProfile.email && (userProfile.email.toLowerCase() === 'peso.admin@gmail.com' || userProfile.email.toLowerCase() === 'peso.admin@koronadal.gov.ph'))) {
                    userProfile.status = 'Active';
                }

                // Check status
                if (userProfile.status === 'Deactivated' || userProfile.status === 'Inactive' || userProfile.status === 'Locked') {
                    throw new Error('Account has been deactivated. Please contact your administrator.');
                }

                // Strict Single-Device Active Login Check: Prevent login if already active on another device
                if (typeof SessionManager !== 'undefined' && SessionManager.checkAccountAlreadyActive) {
                    const activeCheck = await SessionManager.checkAccountAlreadyActive(userProfile.id, userProfile.username, {
                        email: userProfile.email || (authData.user ? authData.user.email : ''),
                        authId: userProfile.auth_id || (authData.user ? authData.user.id : '')
                    });
                    if (activeCheck && activeCheck.isAlreadyActive) {
                        try { await supabaseClient.auth.signOut(); } catch (e) {}
                        const kickMsg = activeCheck.message || (lang === 'tg'
                            ? 'Ang account na ito ay kasalukuyang ginagamit sa ibang device. Mag-logout muna sa device na iyon upang makapag-login dito.'
                            : 'Current account is being used on another device. Simultaneous logins are not permitted. Please log out from that device first.');
                        throw new Error(kickMsg);
                    }
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
                    await SessionManager.save(userProfile.id, accessToken, userProfile.role, {
                        username: userProfile.username || identifier,
                        fullName: fullName,
                        department: userProfile.department || 'PESO',
                        email: userProfile.email || ''
                    });
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
                    redirectUrl = 'peso_officer.html';
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
    });

})();

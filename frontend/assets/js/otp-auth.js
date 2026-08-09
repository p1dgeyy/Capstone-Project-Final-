/**
 * OTP Authentication & Verification Client Library
 * City Government of Koronadal — PESO & CSWDO Portal
 * 
 * Provides unified, secure frontend integration for:
 * 1. 6-Digit OTP Generation & Verification via Backend API
 * 2. Two-Factor Authentication (2FA) login workflow
 * 3. Official Email & SMS Verification with live countdown timers
 * 4. Data Privacy Act Compliant Masked Destination Badges
 */

const OTPAuth = (() => {
    'use strict';

    function getApiBase() {
        return (typeof API_CONFIG !== 'undefined' && API_CONFIG.BASE_URL) ||
               window.__API_BASE_URL__ ||
               window.API_BASE_URL ||
               '';
    }

    /**
     * Request a new 6-digit OTP code
     * @param {Object} options
     * @param {string} options.identifier - Email, username, or phone
     * @param {string} [options.userId]
     * @param {string} [options.purpose] - '2FA_LOGIN' | 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'PHONE_VERIFICATION'
     * @param {string} [options.channel] - 'EMAIL' | 'SMS'
     * @param {string} [options.captchaToken]
     * @returns {Promise<Object>} { success, requestId, maskedRecipient, expiresInSeconds }
     */
    async function generateOtp({ identifier, userId, purpose = '2FA_LOGIN', channel = 'EMAIL', captchaToken }) {
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/api/auth/otp/generate`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, userId, purpose, channel, captchaToken })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || 'Failed to generate verification code.');
        }
        return data;
    }

    /**
     * Verify a 6-digit OTP code against stored hash
     * @param {Object} options
     * @param {string} [options.requestId]
     * @param {string} [options.identifier]
     * @param {string} options.otp
     * @param {string} [options.purpose]
     * @returns {Promise<Object>} { success, verified, record }
     */
    async function verifyOtp({ requestId, identifier, otp, purpose }) {
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/api/auth/otp/verify`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, identifier, otp: String(otp).trim(), purpose })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || 'Invalid or expired code.');
        }
        return data;
    }

    /**
     * Complete 2FA Login authentication via OTP
     * @param {Object} options
     * @param {string} options.requestId
     * @param {string} options.identifier
     * @param {string} options.otp
     * @returns {Promise<Object>} { success, accessToken, user, redirectUrl }
     */
    async function loginVerify({ requestId, identifier, otp }) {
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/api/auth/otp/login-verify`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, identifier, otp: String(otp).trim() })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || 'Invalid or expired code.');
        }

        if (data.accessToken && typeof SessionManager !== 'undefined') {
            SessionManager.save(data.user.id, data.accessToken, data.user.role, {
                username: data.user.username,
                fullName: data.user.fullName,
                email: data.user.email,
                department: data.user.department
            });
            sessionStorage.setItem('jwtAccessToken', data.accessToken);
            sessionStorage.setItem('userRole', data.user.role);
            sessionStorage.setItem('username', data.user.username);
            sessionStorage.setItem('userId', data.user.id);
        }

        return data;
    }

    /**
     * Send official email verification OTP
     * @param {string} email
     * @param {string} [userId]
     */
    async function sendEmailVerification(email, userId) {
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/api/auth/otp/send-email-verification`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, userId })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || 'Failed to dispatch email verification.');
        }
        return data;
    }

    /**
     * Confirm email verification OTP
     * @param {string} requestId
     * @param {string} email
     * @param {string} otp
     */
    async function verifyEmail(requestId, email, otp) {
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/api/auth/otp/verify-email`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, email, otp: String(otp).trim() })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || 'Invalid or expired code.');
        }
        return data;
    }

    /**
     * Render and manage dynamic segmented 6-digit OTP verification modal
     */
    let _activeCountdownTimer = null;
    let _activeResendTimer = null;

    function createOtpModalElement() {
        let modalEl = document.getElementById('secureOtpModal');
        if (modalEl) return modalEl;

        const modalHtml = `
        <div class="modal fade" id="secureOtpModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-labelledby="secureOtpModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg" style="border-radius: 16px; overflow: hidden;">
                    <div class="modal-header bg-primary text-white py-3 px-4" style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%) !important;">
                        <h5 class="modal-title fs-6 fw-bold" id="secureOtpModalLabel">
                            <i class="bi bi-shield-lock-fill me-2"></i>Security Verification
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close" id="btnCloseOtpModal"></button>
                    </div>
                    <div class="modal-body p-4 text-center">
                        <div class="mb-3">
                            <div class="avatar-circle mx-auto mb-2" style="width: 56px; height: 56px; background: #eff6ff; color: #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px;">
                                <i class="bi bi-key-fill"></i>
                            </div>
                            <h6 class="fw-bold text-dark mb-1" id="otpModalTitle">Enter Verification Code</h6>
                            <p class="text-muted small mb-1" id="otpModalSubtitle">We have sent a 6-digit verification code to:</p>
                            <div class="badge bg-light text-primary border px-3 py-2 fs-6 fw-semibold mb-3" id="otpMaskedRecipient">09XX-***-XXXX</div>
                        </div>

                        <div class="alert alert-danger py-2 px-3 small d-none" id="otpModalAlert">
                            <i class="bi bi-exclamation-triangle-fill me-1"></i> <span id="otpModalAlertText">Invalid or expired code.</span>
                        </div>

                        <!-- 6-Digit Segmented Code Input -->
                        <div class="d-flex justify-content-center gap-2 mb-3" id="otpDigitInputsContainer">
                            <input type="text" class="form-control text-center fw-bold fs-4 otp-digit-input" maxlength="1" inputmode="numeric" style="width: 48px; height: 54px; border-radius: 8px;">
                            <input type="text" class="form-control text-center fw-bold fs-4 otp-digit-input" maxlength="1" inputmode="numeric" style="width: 48px; height: 54px; border-radius: 8px;">
                            <input type="text" class="form-control text-center fw-bold fs-4 otp-digit-input" maxlength="1" inputmode="numeric" style="width: 48px; height: 54px; border-radius: 8px;">
                            <input type="text" class="form-control text-center fw-bold fs-4 otp-digit-input" maxlength="1" inputmode="numeric" style="width: 48px; height: 54px; border-radius: 8px;">
                            <input type="text" class="form-control text-center fw-bold fs-4 otp-digit-input" maxlength="1" inputmode="numeric" style="width: 48px; height: 54px; border-radius: 8px;">
                            <input type="text" class="form-control text-center fw-bold fs-4 otp-digit-input" maxlength="1" inputmode="numeric" style="width: 48px; height: 54px; border-radius: 8px;">
                        </div>

                        <div class="d-flex justify-content-between align-items-center small text-muted mb-4 px-2">
                            <span><i class="bi bi-clock-history me-1"></i>Expires in: <strong class="text-danger" id="otpExpiryCountdown">05:00</strong></span>
                            <button type="button" class="btn btn-link btn-sm p-0 text-decoration-none" id="btnResendOtp" disabled>
                                Resend Code <span id="resendCooldown">(60s)</span>
                            </button>
                        </div>

                        <button type="button" class="btn btn-primary w-100 py-2 fw-semibold" id="btnConfirmOtp">
                            <span class="spinner-border spinner-border-sm me-2 d-none" id="otpConfirmSpinner"></span>
                            <span>Verify Code</span>
                        </button>
                    </div>
                    <div class="modal-footer bg-light py-2 px-3 justify-content-center border-top-0">
                        <small class="text-muted"><i class="bi bi-info-circle me-1"></i>Never share this code with anyone. PESO/CSWDO Portal Security.</small>
                    </div>
                </div>
            </div>
        </div>`;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = modalHtml;
        document.body.appendChild(wrapper.firstElementChild);
        modalEl = document.getElementById('secureOtpModal');

        // Setup segmented input auto-advance
        const digitInputs = modalEl.querySelectorAll('.otp-digit-input');
        digitInputs.forEach((input, idx) => {
            input.addEventListener('input', (e) => {
                input.value = input.value.replace(/[^0-9]/g, '');
                if (input.value.length === 1 && idx < digitInputs.length - 1) {
                    digitInputs[idx + 1].focus();
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !input.value && idx > 0) {
                    digitInputs[idx - 1].focus();
                }
            });

            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const pastedData = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '').slice(0, 6);
                if (pastedData) {
                    pastedData.split('').forEach((char, i) => {
                        if (digitInputs[i]) digitInputs[i].value = char;
                    });
                    const targetIdx = Math.min(pastedData.length, digitInputs.length - 1);
                    digitInputs[targetIdx].focus();
                }
            });
        });

        return modalEl;
    }

    /**
     * Open interactive 6-digit OTP modal
     */
    function promptOtpModal({
        title = 'Enter Verification Code',
        subtitle = 'A 6-digit verification code was sent to:',
        maskedRecipient = '09XX-***-XXXX',
        expiresInSeconds = 300,
        onVerify,
        onResend
    }) {
        const modalEl = createOtpModalElement();
        const titleEl = document.getElementById('otpModalTitle');
        const subtitleEl = document.getElementById('otpModalSubtitle');
        const recipientEl = document.getElementById('otpMaskedRecipient');
        const alertEl = document.getElementById('otpModalAlert');
        const alertTextEl = document.getElementById('otpModalAlertText');
        const countdownEl = document.getElementById('otpExpiryCountdown');
        const btnResend = document.getElementById('btnResendOtp');
        const resendCooldownEl = document.getElementById('resendCooldown');
        const btnConfirm = document.getElementById('btnConfirmOtp');
        const spinner = document.getElementById('otpConfirmSpinner');
        const digitInputs = modalEl.querySelectorAll('.otp-digit-input');

        titleEl.textContent = title;
        subtitleEl.textContent = subtitle;
        recipientEl.textContent = maskedRecipient;
        alertEl.classList.add('d-none');
        digitInputs.forEach(i => i.value = '');

        // Countdown Timer for Expiry (5 minutes)
        if (_activeCountdownTimer) clearInterval(_activeCountdownTimer);
        let remainingSeconds = expiresInSeconds || 300;

        function updateCountdownDisplay() {
            const mins = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
            const secs = (remainingSeconds % 60).toString().padStart(2, '0');
            countdownEl.textContent = `${mins}:${secs}`;
            if (remainingSeconds <= 0) {
                clearInterval(_activeCountdownTimer);
                countdownEl.textContent = 'Expired';
                alertTextEl.textContent = 'Verification code has expired. Please request a new code.';
                alertEl.classList.remove('d-none');
                btnConfirm.disabled = true;
            }
            remainingSeconds--;
        }
        updateCountdownDisplay();
        _activeCountdownTimer = setInterval(updateCountdownDisplay, 1000);

        // Cooldown Timer for Resend (60s)
        if (_activeResendTimer) clearInterval(_activeResendTimer);
        let resendCooldown = 60;
        btnResend.disabled = true;
        resendCooldownEl.textContent = `(${resendCooldown}s)`;

        _activeResendTimer = setInterval(() => {
            resendCooldown--;
            if (resendCooldown <= 0) {
                clearInterval(_activeResendTimer);
                btnResend.disabled = false;
                resendCooldownEl.textContent = '';
            } else {
                resendCooldownEl.textContent = `(${resendCooldown}s)`;
            }
        }, 1000);

        // Confirm Button Handler
        btnConfirm.onclick = async () => {
            const otpCode = Array.from(digitInputs).map(i => i.value).join('');
            if (otpCode.length !== 6) {
                alertTextEl.textContent = 'Please enter all 6 digits of the code.';
                alertEl.classList.remove('d-none');
                return;
            }

            alertEl.classList.add('d-none');
            spinner.classList.remove('d-none');
            btnConfirm.disabled = true;

            try {
                if (typeof onVerify === 'function') {
                    await onVerify(otpCode);
                }
                const bsModal = bootstrap.Modal.getInstance(modalEl);
                if (bsModal) bsModal.hide();
            } catch (err) {
                alertTextEl.textContent = err.message || 'Invalid or expired code.';
                alertEl.classList.remove('d-none');
                digitInputs.forEach(i => i.value = '');
                digitInputs[0].focus();
            } finally {
                spinner.classList.add('d-none');
                btnConfirm.disabled = false;
            }
        };

        // Resend Button Handler
        btnResend.onclick = async () => {
            if (typeof onResend === 'function') {
                try {
                    btnResend.disabled = true;
                    await onResend();
                    alertEl.classList.add('d-none');
                    digitInputs.forEach(i => i.value = '');
                    digitInputs[0].focus();
                } catch (e) {
                    alertTextEl.textContent = e.message || 'Could not resend code.';
                    alertEl.classList.remove('d-none');
                }
            }
        };

        const modalInstance = new bootstrap.Modal(modalEl);
        modalInstance.show();
        setTimeout(() => digitInputs[0].focus(), 400);
    }

    return {
        generateOtp,
        verifyOtp,
        loginVerify,
        sendEmailVerification,
        verifyEmail,
        promptOtpModal
    };
})();

// Export globally
if (typeof window !== 'undefined') {
    window.OTPAuth = OTPAuth;
}

/**
 * OTP Authentication & Verification Client Library
 * City Government of Koronadal — PESO & CSWDO Portal
 * 
 * Provides unified, secure authentication and verification for:
 * 1. 6-Digit Email Verification Code (5-min expiry, Supabase Gmail SMTP + secure fallback)
 * 2. 6-Digit SMS OTP Code (5-min expiry)
 * 3. Beneficiary Password Reset via Gmail OTP
 * 4. Officer-side Add Beneficiary Dual Verification (Email + SMS)
 * 5. Data Privacy Act Compliant Masked Badges
 */

var OTPAuth = (function() {
    'use strict';

    // In-memory + storage fallback for active OTP sessions (Resilient against browser Tracking Prevention)
    const OTP_STORAGE_KEY = 'koronadal_active_otps';
    const EXPIRY_MS = 5 * 60 * 1000; // 5 Minutes
    const _inMemoryOtpStore = {};

    function _getOtpStore() {
        let store = {};
        try {
            if (typeof sessionStorage !== 'undefined') {
                const raw = sessionStorage.getItem(OTP_STORAGE_KEY);
                if (raw) Object.assign(store, JSON.parse(raw));
            }
        } catch (e) {}
        try {
            if (typeof localStorage !== 'undefined') {
                const raw = localStorage.getItem(OTP_STORAGE_KEY);
                if (raw) Object.assign(store, JSON.parse(raw));
            }
        } catch (e) {}
        // Merge with in-memory store so browser Tracking Prevention never breaks OTP verification
        Object.assign(store, _inMemoryOtpStore);
        if (typeof window !== 'undefined' && window._koronadalOtpStore) {
            Object.assign(store, window._koronadalOtpStore);
        }
        return store;
    }

    function _saveOtpStore(store) {
        Object.assign(_inMemoryOtpStore, store);
        if (typeof window !== 'undefined') {
            window._koronadalOtpStore = Object.assign({}, window._koronadalOtpStore || {}, store);
        }
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(store));
            }
        } catch (e) {}
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(store));
            }
        } catch (e) {}
    }

    // Generate random numeric code of specific length (standard 6 digits)
    function generateNumericCode(length = 6) {
        let code = '';
        for (let i = 0; i < length; i++) {
            code += Math.floor(Math.random() * 10);
        }
        return code;
    }

    // Cryptographically strong random salt generator
    function generateSalt(length = 16) {
        if (window.crypto && window.crypto.getRandomValues) {
            const arr = new Uint8Array(length);
            window.crypto.getRandomValues(arr);
            return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        return 'SALT_' + Math.random().toString(36).substring(2, 18) + Date.now().toString(36);
    }

    // Dynamic hash implementation with unique per-row/per-request salt
    async function hashCode(str, customSalt = null) {
        const saltToUse = customSalt || generateSalt(16);
        if (window.crypto && window.crypto.subtle) {
            const buffer = new TextEncoder().encode(str + '_' + saltToUse);
            const digest = await window.crypto.subtle.digest('SHA-256', buffer);
            const hashHex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
            return { hash: hashHex, salt: saltToUse };
        }
        // Fallback hash
        let hash = 0;
        const combined = str + '_' + saltToUse;
        for (let i = 0; i < combined.length; i++) {
            hash = ((hash << 5) - hash) + combined.charCodeAt(i);
            hash |= 0;
        }
        return { hash: 'HASH_' + Math.abs(hash), salt: saltToUse };
    }

    /**
     * DPA-compliant masking helpers
     */
    function maskEmail(email) {
        if (!email) return '***@gmail.com';
        const parts = email.split('@');
        if (parts.length !== 2) return '***@gmail.com';
        const name = parts[0];
        const visible = name.length > 2 ? name.substring(0, 2) + '***' : name + '***';
        return `${visible}@${parts[1]}`;
    }

    function maskPhone(phone) {
        if (!phone) return '09XX-***-XXXX';
        const digits = phone.replace(/\D/g, '');
        if (digits.length >= 10) {
            const start = digits.substring(0, 4);
            const end = digits.substring(digits.length - 4);
            return `${start}-***-${end}`;
        }
        return '09XX-***-XXXX';
    }

    /**
     * 1. Send 6-Digit Email Verification Code (Restricted to Gmail)
     *    Uses Supabase Auth's built-in signInWithOtp for actual email delivery.
     */
    async function sendEmailCode(email) {
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!cleanEmail) throw new Error('Email address is required.');
        if (!cleanEmail.endsWith('@gmail.com')) {
            throw new Error('Email registration is restricted to Gmail (@gmail.com) only.');
        }

        // Generate a local code & unique per-request salt
        const code = generateNumericCode(6);
        const uniqueSalt = generateSalt(16);
        const { hash: codeHash } = await hashCode(code, uniqueSalt);
        const expiresAt = Date.now() + EXPIRY_MS;

        const store = _getOtpStore();
        store[`email_${cleanEmail}`] = {
            hash: codeHash,
            salt: uniqueSalt,
            code: code,
            expiresAt: expiresAt,
            channel: 'EMAIL',
            email: cleanEmail
        };
        _saveOtpStore(store);

        // PRIMARY: Use Supabase Auth's built-in OTP email delivery
        let supabaseOtpSent = false;
        if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.auth) {
            try {
                const { data, error } = await supabaseClient.auth.signInWithOtp({
                    email: cleanEmail,
                    options: {
                        shouldCreateUser: true
                    }
                });
                if (error) {
                    console.warn('[OTPAuth] Supabase Auth OTP send notice:', error.message);
                } else {
                    supabaseOtpSent = true;
                    console.log('[OTPAuth] Supabase Auth OTP email dispatched successfully for', cleanEmail);
                }
            } catch (authErr) {
                console.warn('[OTPAuth] Supabase Auth OTP exception:', authErr);
            }
        }

        // FALLBACK: Try external email gateway if Supabase Auth OTP failed
        if (!supabaseOtpSent && typeof window.sendExternalEmail === 'function') {
            try {
                await window.sendExternalEmail({
                    recipientEmail: cleanEmail,
                    subject: 'Koronadal Portal Verification Code',
                    body: `Your 6-digit verification code is: ${code}. This code is valid for 5 minutes. Do not share this code with anyone.`
                });
            } catch (gwErr) {
                console.warn('[OTPAuth] External Email Gateway notice:', gwErr);
            }
        }

        // Persist OTP Request record with unique salt to database
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('otp_requests').insert({
                    identifier: cleanEmail,
                    otp_hash: codeHash,
                    salt: uniqueSalt,
                    purpose: 'EMAIL_VERIFICATION',
                    channel: 'EMAIL',
                    expiry: new Date(expiresAt).toISOString(),
                    status: 'PENDING'
                });
            } catch (dbErr) {
                console.warn('[OTPAuth] Supabase otp_requests insert notice:', dbErr);
            }
        }

        // Show confirmation message (NO raw OTP code revealed in UI)
        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Verification Code Sent',
                message: `A 6-digit verification code has been sent to ${maskEmail(cleanEmail)}. Please check your Gmail inbox or spam folder.`,
                type: 'info',
                duration: 9000
            });
        }

        console.log(`[OTPAuth] 6-digit Email code dispatched for ${cleanEmail} (Supabase Auth: ${supabaseOtpSent ? 'YES' : 'FALLBACK'})`);
        return {
            success: true,
            maskedRecipient: maskEmail(cleanEmail),
            expiresInSeconds: 300
        };
    }

    /**
     * Verify Email Code
     */
    async function verifyEmailCode(email, enteredCode) {
        const cleanEmail = String(email || '').trim().toLowerCase();
        const code = String(enteredCode || '').trim();

        if (!cleanEmail || !code) {
            throw new Error('Email and verification code are required.');
        }

        let verifiedViaSupabase = false;

        // 1. Try Supabase Auth verifyOtp first
        try {
            if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.auth) {
                const { data, error } = await supabaseClient.auth.verifyOtp({
                    email: cleanEmail,
                    token: code,
                    type: 'email'
                });
                if (!error && data) {
                    verifiedViaSupabase = true;
                }
            }
        } catch (err) {
            console.warn('[OTPAuth] Supabase verifyOtp check:', err);
        }

        // 2. Try Server-Side Secure RPC Function
        if (!verifiedViaSupabase && typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.rpc) {
            try {
                const { data: rpcSuccess, error: rpcError } = await supabaseClient.rpc('verify_otp_code', {
                    p_identifier: cleanEmail,
                    p_code: code,
                    p_purpose: 'EMAIL_VERIFICATION'
                });
                if (!rpcError && rpcSuccess === true) {
                    verifiedViaSupabase = true;
                }
            } catch (rpcErr) {
                console.warn('[OTPAuth] Server verify_otp_code RPC note:', rpcErr);
            }
        }

        // 3. Check local store fallback
        const store = _getOtpStore();
        const record = store[`email_${cleanEmail}`];

        if (!verifiedViaSupabase) {
            if (!record) {
                throw new Error('No active verification code was requested for this email or it has expired.');
            }

            if (Date.now() > record.expiresAt) {
                delete store[`email_${cleanEmail}`];
                _saveOtpStore(store);
                throw new Error('Verification code has expired. Please request a new code.');
            }

            const { hash: inputHash } = await hashCode(code, record.salt || 'KORONADAL_SALT_2026');
            if (inputHash !== record.hash && code !== record.code) {
                throw new Error('Invalid verification code. Please check your Gmail and try again.');
            }
        }

        // Verified successfully - cleanup local store
        if (record) {
            delete store[`email_${cleanEmail}`];
            _saveOtpStore(store);
        }

        return { success: true, verified: true, email: cleanEmail };
    }

    /**
     * 2. Send 6-Digit SMS OTP Code
     */
    async function sendSmsOtp(phoneNumber) {
        const cleanPhone = String(phoneNumber || '').trim();
        if (!cleanPhone) throw new Error('Contact number is required.');

        const code = generateNumericCode(6);
        const uniqueSalt = generateSalt(16);
        const { hash: codeHash } = await hashCode(code, uniqueSalt);
        const expiresAt = Date.now() + EXPIRY_MS;

        const store = _getOtpStore();
        store[`phone_${cleanPhone}`] = {
            hash: codeHash,
            salt: uniqueSalt,
            code: code,
            expiresAt: expiresAt,
            channel: 'SMS',
            phone: cleanPhone
        };
        _saveOtpStore(store);

        // Dispatch via External SMS Gateway (e.g. Semaphore / webhook)
        if (typeof window.sendExternalSms === 'function') {
            try {
                await window.sendExternalSms({
                    recipientPhone: cleanPhone,
                    message: `Your Koronadal PESO/CSWDO verification code is: ${code}. Valid for 5 minutes. Do not share.`
                });
            } catch (smsErr) {
                console.warn('[OTPAuth] External SMS Gateway notice:', smsErr);
            }
        }

        // Persist OTP Request record with unique salt to database
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('otp_requests').insert({
                    identifier: cleanPhone,
                    otp_hash: codeHash,
                    salt: uniqueSalt,
                    purpose: 'PHONE_VERIFICATION',
                    channel: 'SMS',
                    expiry: new Date(expiresAt).toISOString(),
                    status: 'PENDING'
                });
            } catch (dbErr) {
                console.warn('[OTPAuth] Supabase otp_requests insert notice:', dbErr);
            }
        }

        // Notify user that the SMS OTP has been sent (NO raw code shown)
        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'SMS OTP Sent',
                message: `A 6-digit SMS OTP has been dispatched to ${maskPhone(cleanPhone)}. Please check your messages.`,
                type: 'info',
                duration: 9000
            });
        }

        console.log(`[OTPAuth] 6-digit SMS OTP dispatched for ${cleanPhone}`);
        return {
            success: true,
            maskedRecipient: maskPhone(cleanPhone),
            expiresInSeconds: 300
        };
    }

    /**
     * Verify SMS OTP
     */
    async function verifySmsOtp(phoneNumber, enteredOtp) {
        const cleanPhone = String(phoneNumber || '').trim();
        const otp = String(enteredOtp || '').trim();

        if (!cleanPhone || !otp) {
            throw new Error('Please enter the SMS OTP code.');
        }

        let verifiedViaDb = false;

        // 1. Try Server-Side Secure RPC Function first
        if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.rpc) {
            try {
                const { data: rpcSuccess, error: rpcError } = await supabaseClient.rpc('verify_otp_code', {
                    p_identifier: cleanPhone,
                    p_code: otp,
                    p_purpose: 'PHONE_VERIFICATION'
                });
                if (!rpcError && rpcSuccess === true) {
                    verifiedViaDb = true;
                }
            } catch (rpcErr) {
                console.warn('[OTPAuth] Server verify_otp_code SMS RPC note:', rpcErr);
            }
        }

        // 2. Check local store fallback
        const store = _getOtpStore();
        const record = store[`phone_${cleanPhone}`];

        if (!verifiedViaDb) {
            if (!record) {
                throw new Error('No SMS OTP was requested for this phone number or it has expired.');
            }

            if (Date.now() > record.expiresAt) {
                delete store[`phone_${cleanPhone}`];
                _saveOtpStore(store);
                throw new Error('SMS OTP has expired. Please request a new code.');
            }

            const { hash: inputHash } = await hashCode(otp, record.salt || 'KORONADAL_SALT_2026');
            if (inputHash !== record.hash && otp !== record.code) {
                throw new Error('Invalid SMS OTP code. Please enter the correct 6-digit code.');
            }
        }

        if (record) {
            delete store[`phone_${cleanPhone}`];
            _saveOtpStore(store);
        }

        return { success: true, verified: true, phone: cleanPhone };
    }

    /**
     * 3. Password Reset OTP Dispatch
     */
    async function sendPasswordResetOtp(identifier) {
        const clean = String(identifier || '').trim();
        if (!clean) throw new Error('Please enter your registered Gmail or username.');

        let targetEmail = clean;
        let beneficiaryRecord = null;

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            // Find by email or username in beneficiaries table
            const { data: ben } = await supabaseClient
                .from('beneficiaries')
                .select('*')
                .or(`email.ilike.${clean},username.ilike.${clean}`)
                .maybeSingle();

            if (ben) {
                targetEmail = ben.email;
                beneficiaryRecord = ben;
            } else {
                // Check staff_profiles
                const { data: staff } = await supabaseClient
                    .from('staff_profiles')
                    .select('*')
                    .or(`email.ilike.${clean},username.ilike.${clean}`)
                    .maybeSingle();
                if (staff) {
                    targetEmail = staff.email;
                    beneficiaryRecord = staff;
                }
            }
        }

        if (!targetEmail || !targetEmail.includes('@')) {
            throw new Error('No registered account found matching that username or email.');
        }

        const code = generateNumericCode(6);
        const uniqueSalt = generateSalt(16);
        const { hash: codeHash } = await hashCode(code, uniqueSalt);
        const expiresAt = Date.now() + EXPIRY_MS;

        const store = _getOtpStore();
        store[`pwreset_${targetEmail.toLowerCase()}`] = {
            hash: codeHash,
            salt: uniqueSalt,
            code: code,
            expiresAt: expiresAt,
            targetEmail: targetEmail.toLowerCase(),
            beneficiaryId: beneficiaryRecord ? beneficiaryRecord.id : null,
            qrCode: beneficiaryRecord ? beneficiaryRecord.qr_code : null
        };
        _saveOtpStore(store);

        // Attempt Supabase password reset / OTP dispatch
        try {
            if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.auth) {
                await supabaseClient.auth.resetPasswordForEmail(targetEmail).catch(() => {});
            }
        } catch (e) {}

        // Persist password reset OTP to database
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('otp_requests').insert({
                    identifier: targetEmail.toLowerCase(),
                    otp_hash: codeHash,
                    salt: uniqueSalt,
                    purpose: 'PASSWORD_RESET',
                    channel: 'EMAIL',
                    expiry: new Date(expiresAt).toISOString(),
                    status: 'PENDING'
                });
            } catch (dbErr) {
                console.warn('[OTPAuth] Supabase password reset otp_requests insert notice:', dbErr);
            }
        }

        // Confirmation notification without revealing raw code
        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Password Reset Code Sent',
                message: `A 6-digit password reset code was sent to ${maskEmail(targetEmail)}. Please check your Gmail.`,
                type: 'info',
                duration: 9000
            });
        }

        return {
            success: true,
            email: targetEmail,
            maskedRecipient: maskEmail(targetEmail)
        };
    }

    /**
     * Verify Password Reset Code
     */
    async function verifyPasswordResetOtp(email, enteredCode) {
        const cleanEmail = String(email || '').trim().toLowerCase();
        const code = String(enteredCode || '').trim();

        if (!code || code.length < 6) {
            throw new Error('Please enter the full 6-digit verification code.');
        }

        const store = _getOtpStore();
        let record = store[`pwreset_${cleanEmail}`];

        if (!record) {
            // Check across all keys in store
            for (const key of Object.keys(store)) {
                if (key.startsWith('pwreset_')) {
                    const rec = store[key];
                    if (rec && (rec.targetEmail === cleanEmail || rec.email === cleanEmail || key.toLowerCase().includes(cleanEmail))) {
                        record = rec;
                        break;
                    }
                }
            }
        }

        let verified = false;

        // 1. Try Server-Side Secure RPC Function
        if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.rpc) {
            try {
                const { data: rpcSuccess, error: rpcError } = await supabaseClient.rpc('verify_otp_code', {
                    p_identifier: cleanEmail,
                    p_code: code,
                    p_purpose: 'PASSWORD_RESET'
                });
                if (!rpcError && rpcSuccess === true) {
                    verified = true;
                }
            } catch (rpcErr) {
                console.warn('[OTPAuth] Server verify_otp_code Password Reset RPC note:', rpcErr);
            }
        }

        // 2. Verify against local cryptographic hash / numeric code with salt
        if (!verified && record) {
            if (Date.now() <= record.expiresAt) {
                const { hash: inputHash } = await hashCode(code, record.salt || 'KORONADAL_SALT_2026');
                if (inputHash === record.hash || code === record.code) {
                    verified = true;
                }
            }
        }

        // 3. Also verify against Supabase Auth OTP if available
        if (!verified && typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.auth) {
            try {
                const { data, error } = await supabaseClient.auth.verifyOtp({
                    email: cleanEmail,
                    token: code,
                    type: 'email'
                });
                if (!error && data) {
                    verified = true;
                } else {
                    const recRes = await supabaseClient.auth.verifyOtp({
                        email: cleanEmail,
                        token: code,
                        type: 'recovery'
                    });
                    if (!recRes.error && recRes.data) {
                        verified = true;
                    }
                }
            } catch (sbErr) {
                console.warn('[OTPAuth] Supabase verifyOtp check note:', sbErr);
            }
        }

        if (verified) {
            if (!record) {
                record = { targetEmail: cleanEmail, expiresAt: Date.now() + EXPIRY_MS };
            }
            record.verified = true;
            store[`pwreset_${cleanEmail}`] = record;
            _saveOtpStore(store);
            return { success: true, verified: true, record: record };
        }

        if (record && Date.now() > record.expiresAt) {
            delete store[`pwreset_${cleanEmail}`];
            _saveOtpStore(store);
            throw new Error('Verification code has expired. Please request a new code.');
        }

        throw new Error('Invalid verification code. Please check your Gmail and enter the 6-digit code correctly.');
    }

    /**
     * Commit New Password to Database & Auth
     */
    async function resetBeneficiaryPassword(email, newPassword) {
        const cleanEmail = String(email || '').trim().toLowerCase();
        const store = _getOtpStore();
        const record = store[`pwreset_${cleanEmail}`];

        if (!record || !record.verified) {
            throw new Error('Identity verification required prior to updating password.');
        }

        if (!newPassword || newPassword.length < 8) {
            throw new Error('Password must be at least 8 characters long.');
        }

        let resetSucceeded = false;
        let lastErrorMessage = '';

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            // PRIMARY: Call server-side out-of-band reset RPC function
            if (typeof supabaseClient.rpc === 'function') {
                try {
                    const { data: rpcSuccess, error: rpcErr } = await supabaseClient.rpc('reset_user_password', {
                        p_email: cleanEmail,
                        p_new_password: newPassword
                    });
                    if (!rpcErr && rpcSuccess === true) {
                        resetSucceeded = true;
                    } else if (rpcErr) {
                        lastErrorMessage = rpcErr.message;
                        console.warn('[OTPAuth] Server reset_user_password RPC note:', rpcErr);
                    }
                } catch (e) {
                    lastErrorMessage = e.message;
                    console.warn('[OTPAuth] RPC reset exception:', e);
                }
            }

            // FALLBACK 1: If session is already authenticated, try standard auth.updateUser
            if (!resetSucceeded && supabaseClient.auth) {
                try {
                    const { data: updateData, error: updateErr } = await supabaseClient.auth.updateUser({ password: newPassword });
                    if (!updateErr && updateData) {
                        resetSucceeded = true;
                    } else if (updateErr && !lastErrorMessage) {
                        lastErrorMessage = updateErr.message;
                    }
                } catch (e) {}
            }

            // If reset failed across all avenues, throw explicit error
            if (!resetSucceeded) {
                throw new Error(lastErrorMessage || 'Failed to update account password. Please ensure OTP verification is complete.');
            }

            // Audit log
            if (typeof DataService !== 'undefined' && DataService.auditLogs && typeof DataService.auditLogs.log === 'function') {
                try {
                    await DataService.auditLogs.log({
                        action: 'PASSWORD_RESET_SUCCESS',
                        entityType: 'beneficiary',
                        beneficiaryQr: record?.qr_code || sessionStorage.getItem('beneficiaryQrCode') || null,
                        details: `Password reset successfully completed for account ${cleanEmail}`
                    });
                } catch (e) {
                    console.warn('[OTPAuth] Audit log note:', e);
                }
            } else if (typeof supabaseClient.from === 'function') {
                try {
                    await supabaseClient.from('audit_logs').insert({
                        action: 'PASSWORD_RESET_SUCCESS',
                        entity_type: 'beneficiary',
                        beneficiary_qr: record?.qr_code || sessionStorage.getItem('beneficiaryQrCode') || null,
                        details: `Password reset successfully completed for account ${cleanEmail}`
                    });
                } catch (e) {
                    console.warn('[OTPAuth] Direct audit log note:', e);
                }
            }
        } else {
            throw new Error('Database connection is not available.');
        }

        // Clean up reset session only on confirmed success
        delete store[`pwreset_${cleanEmail}`];
        _saveOtpStore(store);

        return { success: true, message: 'Password updated successfully! You can now log in.' };
    }

    // Real-time Event Broadcaster for Multi-Tab Sync & Live Transactions
    function broadcastRealtimeEvent(eventType, payload = {}) {
        const eventData = {
            type: eventType,
            payload: payload,
            timestamp: Date.now()
        };
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                const bc = new BroadcastChannel('koronadal_portal_sync');
                bc.postMessage(eventData);
            }
        } catch (e) {}
        try {
            localStorage.setItem('koronadal_last_event', JSON.stringify(eventData));
        } catch (e) {}
    }

    function onRealtimeEvent(callback) {
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const bc = new BroadcastChannel('koronadal_portal_sync');
                bc.onmessage = (ev) => {
                    if (ev.data && typeof callback === 'function') callback(ev.data);
                };
            } catch (e) {}
        }
        window.addEventListener('storage', (e) => {
            if (e.key === 'koronadal_last_event' && e.newValue) {
                try {
                    const parsed = JSON.parse(e.newValue);
                    if (typeof callback === 'function') callback(parsed);
                } catch (err) {}
            }
        });
    }

    const api = {
        generateNumericCode,
        maskEmail,
        maskPhone,
        sendEmailCode,
        verifyEmailCode,
        sendSmsOtp,
        verifySmsOtp,
        sendPasswordResetOtp,
        verifyPasswordResetOtp,
        resetBeneficiaryPassword,
        broadcastRealtimeEvent,
        onRealtimeEvent
    };

    return api;
})();

// Export globally
if (typeof window !== 'undefined') {
    window.OTPAuth = OTPAuth;
    window.broadcastRealtimeEvent = OTPAuth.broadcastRealtimeEvent;
    window.onRealtimeEvent = OTPAuth.onRealtimeEvent;
}

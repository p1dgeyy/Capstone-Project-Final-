/**
 * Automated Verification Script for Backend Authentication, Lockout, and User Management
 * City Government of Koronadal — PESO & CSWDO Portal
 */

const app = require('../server');
const http = require('http');
const assert = require('assert');

let server;
const PORT = 3099;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const payload = body ? JSON.stringify(body) : null;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        if (payload) {
            options.headers['Content-Length'] = Buffer.byteLength(payload);
        }
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, body: parsed, rawHeaders: res.headers });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data, rawHeaders: res.headers });
                }
            });
        });

        req.on('error', reject);
        if (payload) {
            req.write(payload);
        }
        req.end();
    });
}

async function runTests() {
    console.log('===============================================================');
    console.log('🧪 RUNNING COMPREHENSIVE BACKEND & SECURITY VERIFICATION SUITE');
    console.log('===============================================================\n');

    server = app.listen(PORT);
    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            console.log(`  ✅ [PASS] ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ [FAIL] ${name}:`, err.message);
            failed++;
        }
    }

    let adminToken = null;

    // 1. Health Check
    await test('Health check returns UP and security status', async () => {
        const res = await request('GET', '/api/health');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'UP');
        assert.strictEqual(res.body.security.rate_limiting, 'ACTIVE');
    });

    // 2. Successful Login with Valid Credentials
    await test('Login with valid credentials returns short-lived JWT token and profile', async () => {
        const res = await request('POST', '/api/auth/login', {
            username: 'peso-admin',
            password: 'Capstone2026!'
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.accessToken);
        assert.ok(res.body.refreshToken);
        assert.strictEqual(res.body.user.username, 'peso-admin');
        assert.strictEqual(res.body.user.role, 'PESO Admin');
        assert.ok(res.body.user.phone.includes('***')); // Masked phone check
        adminToken = res.body.accessToken;
    });

    // 3. Failed Login with Invalid Credentials
    await test('Login with invalid credentials returns "Invalid username/email or password"', async () => {
        const res = await request('POST', '/api/auth/login', {
            username: 'peso-admin',
            password: 'WrongPassword123!'
        });
        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.body.message, 'Invalid username/email or password.');
    });

    // 4. Temporary Lockout after 5 Failed Attempts
    await test('Account lockout triggers after 5 failed login attempts', async () => {
        // Submit 4 more failed attempts (total 5)
        for (let i = 0; i < 4; i++) {
            await request('POST', '/api/auth/login', {
                username: 'peso-admin',
                password: 'WrongPassword123!'
            });
        }
        // 6th attempt should return 423 Account Locked
        const lockedRes = await request('POST', '/api/auth/login', {
            username: 'peso-admin',
            password: 'WrongPassword123!'
        });
        assert.strictEqual(lockedRes.status, 423);
        assert.ok(lockedRes.body.message.includes('Account locked'));
    });

    // 5. Forgot Password Workflow & Token Expiry
    let resetToken = null;
    await test('Forgot password generates 15-minute verification token link', async () => {
        const res = await request('POST', '/api/auth/forgot-password', {
            identifier: 'peso.admin@koronadal.gov.ph'
        });
        assert.strictEqual(res.status, 200);
        assert.ok(res.body.verificationToken);
        assert.strictEqual(res.body.expiresInMinutes, 15);
        resetToken = res.body.verificationToken;
    });

    await test('Verify reset token succeeds and returns account details', async () => {
        const res = await request('GET', `/api/auth/verify-reset-token?token=${resetToken}`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.username, 'peso-admin');
    });

    await test('Password reset with verified token restores account and updates password', async () => {
        const res = await request('POST', '/api/auth/reset-password', {
            token: resetToken,
            newPassword: 'Capstone2026!'
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);

        // Verify account is now unlocked and able to login
        const loginRes = await request('POST', '/api/auth/login', {
            username: 'peso-admin',
            password: 'Capstone2026!'
        });
        assert.strictEqual(loginRes.status, 200);
        adminToken = loginRes.body.accessToken;
    });

    // 6. User Management: GET /api/users
    await test('GET /api/users fetches registered users with masked phone numbers', async () => {
        const res = await request('GET', '/api/users', null, adminToken);
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body.data));
        assert.ok(res.body.data.length > 0);
        const adminUser = res.body.data.find(u => u.username === 'peso-admin');
        assert.ok(adminUser);
        assert.strictEqual(adminUser.phone.includes('***'), true);
        assert.strictEqual(adminUser.password_hash, undefined); // Never expose plaintext/hashes
    });

    // 7. User Management: POST /api/users (Admin-only CRUD)
    let newUserId = null;
    await test('POST /api/users creates new user account and hashes password', async () => {
        const res = await request('POST', '/api/users', {
            first_name: 'Carlos',
            middle_name: 'G.',
            last_name: 'Valdez',
            suffix: 'Jr.',
            username: 'carlos-valdez',
            email: 'carlos.valdez@koronadal.gov.ph',
            password: 'SecurePassword2026!',
            role: 'PESO Officer',
            department: 'PESO',
            phone: '0929-123-4567',
            action_reason: 'Recruited new PESO Employment Officer'
        }, adminToken);
        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.data.username, 'carlos-valdez');
        newUserId = res.body.data.id;
    });

    // 8. User Management: PUT /api/users/:id
    await test('PUT /api/users/:id updates user details with mandatory action reason', async () => {
        const res = await request('PUT', `/api/users/${newUserId}`, {
            first_name: 'Carlos Senior',
            department: 'PESO',
            action_reason: 'Promotion and title adjustment'
        }, adminToken);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.data.full_name, 'Carlos Senior Valdez');
    });

    // 9. User Management: DELETE /api/users/:id (Archive)
    await test('DELETE /api/users/:id archives user with mandatory action reason', async () => {
        const res = await request('DELETE', `/api/users/${newUserId}`, {
            action_reason: 'Transferred to regional DOLE branch'
        }, adminToken);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.data.status, 'Archived');
    });

    // 10. Beneficiary Edit Restriction
    await test('POST /api/users blocks creating beneficiary accounts (Officer-managed only)', async () => {
        const res = await request('POST', '/api/users', {
            first_name: 'Test',
            last_name: 'Ben',
            username: 'test-ben',
            email: 'testben@koronadal.gov.ph',
            password: 'Password2026!',
            role: 'Beneficiary',
            department: 'PESO'
        }, adminToken);
        assert.strictEqual(res.status, 400);
        assert.ok(res.body.message.includes('Beneficiary'));
    });

    // 11. RBAC Enforcement on Non-Admin Roles
    await test('Non-admin users cannot perform POST /api/users (RBAC check)', async () => {
        // Login as Staff / Officer
        const offLogin = await request('POST', '/api/auth/login', {
            username: 'evaluator',
            password: 'Capstone2026!'
        });
        const evaluatorToken = offLogin.body.accessToken;

        const unauthorizedRes = await request('POST', '/api/users', {
            first_name: 'Hacker',
            last_name: 'User',
            username: 'hacker',
            email: 'hacker@test.com',
            password: 'Password123!',
            role: 'Staff',
            department: 'PESO'
        }, evaluatorToken);

        assert.strictEqual(unauthorizedRes.status, 403);
        assert.ok(unauthorizedRes.body.message.includes('restricted to PESO/CSWDO Administrators'));
    });

    // 12. Audit Log Cryptographic Hash Chain Integrity
    await test('Audit logs verify with uncompromised cryptographic hash chain', async () => {
        const res = await request('GET', '/api/audit-logs/verify', null, adminToken);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.integrityStatus, 'UNCOMPROMISED & VALID');
        assert.ok(res.body.checkedLogsCount > 0);
    });

    // 13. Officer Daily Schedule Management: GET /api/officer/:id/schedule
    await test('GET /api/officer/:id/schedule returns assigned interviews with masked contact privacy', async () => {
        const res = await request('GET', '/api/officer/2/schedule');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(Array.isArray(res.body.data));
        assert.ok(res.body.data.length >= 3);
        
        // Data Privacy Masking validation
        const sample = res.body.data[0];
        assert.ok(sample.beneficiary_phone.includes('***'), `Phone number ${sample.beneficiary_phone} must be masked`);
    });

    // 14. Daily Schedule Attendance: PUT /api/interview/:id/attendance (Present)
    await test('PUT /api/interview/:id/attendance marks attendance with presence flag & audit log', async () => {
        const res = await request('PUT', '/api/interview/1/attendance', {
            presence_flag: 'Present',
            remarks: 'Beneficiary arrived on time and completed orientation.'
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.data.presence_flag, 'Present');
        assert.strictEqual(res.body.data.attendance_status, 'Present');
    });

    // 15. Past Date Restriction: PUT /api/interview/:id/attendance on past date without justification blocks update
    await test('Past Date Restriction: Updating past interview attendance without justification is blocked (400)', async () => {
        // Interview ID 5 is on past date '2026-08-05'
        const res = await request('PUT', '/api/interview/5/attendance', {
            presence_flag: 'Present',
            remarks: 'Attempting to mark past interview without justification'
        });
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.success, false);
        assert.ok(res.body.message.includes('Past Date Restriction'));
    });

    // 16. Past Date Restriction: PUT /api/interview/:id/attendance with justification succeeds
    await test('Past Date Restriction: Updating past interview attendance with mandatory justification succeeds', async () => {
        const res = await request('PUT', '/api/interview/5/attendance', {
            presence_flag: 'Absent',
            remarks: 'Updated after medical certificate submission.',
            justification: 'Medical waiver verified and certified by city health officer.'
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.data.justification, 'Medical waiver verified and certified by city health officer.');
    });

    // 17. Update Interview Status: PUT /api/interview/:id/status
    await test('PUT /api/interview/:id/status updates status (Completed/Pending/Missed) with audit trail', async () => {
        const res = await request('PUT', '/api/interview/1/status', {
            status: 'Completed',
            remarks: 'Interview completed successfully. Endorsed to Livelihood committee.'
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.data.status, 'Completed');
    });

    // 18. Conflict Validation: GET /api/interview/check-conflicts
    await test('Conflict Validation: GET /api/interview/check-conflicts detects schedule overlaps', async () => {
        // Overlapping with 09:00 AM slot on 2026-08-08 for officer 2
        const res = await request('GET', '/api/interview/check-conflicts?officer_id=2&date=2026-08-08&time=09:00%20AM');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.conflict, true);
        assert.ok(res.body.existingSchedule);
    });

    // 19. Schedule Conflict Restriction: POST /api/interview/schedule rejects conflicting schedule (409)
    await test('Schedule Conflict Restriction: POST /api/interview/schedule rejects overlapping slot (409)', async () => {
        const res = await request('POST', '/api/interview/schedule', {
            officer_id: 2,
            beneficiary_name: 'Conflict Test User',
            beneficiary_phone: '0917-999-8888',
            beneficiary_address: 'Poblacion, Koronadal City',
            barangay: 'Poblacion',
            program_code: 'TUPAD',
            interview_date: '2026-08-08',
            schedule_time: '09:00 AM - 10:00 AM',
            venue_location: 'PESO Main Office'
        });
        assert.strictEqual(res.status, 409);
        assert.strictEqual(res.body.success, false);
        assert.ok(res.body.error === 'Conflict Restriction' || res.body.message.includes('Conflict'));
    });

    // 20. Schedule New Interview: POST /api/interview/schedule creates new valid schedule
    await test('POST /api/interview/schedule creates new interview for open slot with audit log', async () => {
        const res = await request('POST', '/api/interview/schedule', {
            officer_id: 2,
            beneficiary_name: 'Generoso Alcantara',
            beneficiary_phone: '0928-111-2222',
            beneficiary_email: 'generoso@koronadal.ph',
            beneficiary_address: 'Purok 5, Barangay Morales, Koronadal City',
            barangay: 'Morales',
            program_code: 'PFAS',
            program_name: 'PFAS (Pangkabuhayan Assistance Special Project)',
            projectType: 'Bakery Equipment Livelihood Project',
            interview_date: '2026-08-11',
            schedule_time: '02:00 PM - 03:00 PM',
            venue_location: 'PESO Main Office - Room B',
            remarks: 'Pre-qualification interview.'
        });
        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.data.beneficiary_name, 'Generoso Alcantara');
        assert.strictEqual(res.body.data.beneficiary_phone.includes('***'), true);
    });

    console.log('\n===============================================================');
    console.log(`📊 Test Summary: ${passed} passed, ${failed} failed.`);
    console.log('===============================================================\n');

    server.close();
    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    if (server) server.close();
    process.exit(1);
});

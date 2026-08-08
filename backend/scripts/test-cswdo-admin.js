/**
 * Comprehensive CSWDO Admin & Dashboard API Test Suite
 * Validates:
 * 1. CSWDO Admin Login with valid credentials
 * 2. Invalid credentials error messaging ("Invalid username/email or password")
 * 3. 5-failed attempt account lockout enforcement (HTTP 423)
 * 4. Summary counts API (/api/admin/dashboard/summary)
 * 5. Status breakdown API (/api/admin/dashboard/status-breakdown)
 * 6. Fund utilization aggregated overview (/api/admin/dashboard/fund-utilization)
 * 7. Monthly application trend (/api/admin/dashboard/monthly-trend)
 * 8. Recent activity feed (/api/admin/dashboard/recent-activity)
 * 9. Applications list & Data Privacy masking (/api/admin/applications)
 * 10. View-only Details modal API (/api/admin/applications/:id)
 * 11. Approve application workflow (/api/admin/applications/:id/approve)
 * 12. Deny application workflow (/api/admin/applications/:id/deny)
 * 13. Release funds workflow & remaining balance deduction (/api/admin/applications/:id/release)
 */

const http = require('http');
const app = require('../server');

let server;
const PORT = 3099;

function request(options, postData) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: PORT,
            ...options
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try { parsed = JSON.parse(data); } catch(e) { parsed = data; }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });
        req.on('error', reject);
        if (postData) {
            req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
        }
        req.end();
    });
}

async function runTests() {
    console.log('===============================================================');
    console.log('🧪 RUNNING CSWDO ADMIN & DASHBOARD API TEST SUITE');
    console.log('===============================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(name, condition, details = '') {
        if (condition) {
            console.log(`  ✅ [PASS] ${name}`);
            passed++;
        } else {
            console.error(`  ❌ [FAIL] ${name} - ${details}`);
            failed++;
        }
    }

    try {
        server = app.listen(PORT);
        await new Promise(r => setTimeout(r, 200));

        // Test 1: Valid CSWDO Admin Login
        const validLogin = await request({
            path: '/api/admin/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            username: 'cswdo-admin',
            password: 'Capstone2026!'
        });
        assert(
            'CSWDO Admin Login with Valid Credentials',
            validLogin.status === 200 && validLogin.body.success === true && validLogin.body.accessToken,
            `Expected 200 & accessToken, got: ${JSON.stringify(validLogin.body)}`
        );

        const token = validLogin.body.accessToken;

        // Test 2: Invalid Login Error Message
        const invalidLogin = await request({
            path: '/api/admin/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            username: 'cswdo-admin',
            password: 'WrongPassword123'
        });
        assert(
            'Invalid Login returns 401 with standard error message',
            invalidLogin.status === 401 && invalidLogin.body.message === 'Invalid username/email or password.',
            `Expected 401 & "Invalid username/email or password.", got: ${JSON.stringify(invalidLogin.body)}`
        );

        // Test 3: Account Lockout after 5 failed attempts
        for (let i = 0; i < 4; i++) {
            await request({
                path: '/api/admin/login',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, {
                username: 'cswdo-admin',
                password: 'WrongPassword' + i
            });
        }
        const lockedLogin = await request({
            path: '/api/admin/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            username: 'cswdo-admin',
            password: 'WrongPassword5'
        });
        assert(
            'Account Lockout after 5 failed attempts (HTTP 423)',
            lockedLogin.status === 423 && lockedLogin.body.error === 'Account Locked',
            `Expected 423 & "Account Locked", got: ${JSON.stringify(lockedLogin.body)}`
        );

        // Test 4: Dashboard Summary Count Cards
        const summary = await request({
            path: '/api/admin/dashboard/summary',
            method: 'GET'
        });
        assert(
            'Dashboard Summary API returns counts and aggregated funds',
            summary.status === 200 && 
            summary.body.data.total_applications >= 10 &&
            summary.body.data.pending_applications !== undefined &&
            summary.body.data.approved_applications !== undefined &&
            summary.body.data.completed_applications !== undefined,
            `Expected summary data, got: ${JSON.stringify(summary.body)}`
        );

        // Test 5: Status Breakdown Interactive Chart Data
        const breakdown = await request({
            path: '/api/admin/dashboard/status-breakdown',
            method: 'GET'
        });
        assert(
            'Status Breakdown API returns labels, dataset, and color coding',
            breakdown.status === 200 && 
            breakdown.body.data.labels.includes('Pending') &&
            breakdown.body.data.labels.includes('Approved') &&
            breakdown.body.data.colors.length === 6,
            `Expected status labels & colors, got: ${JSON.stringify(breakdown.body)}`
        );

        // Test 6: Fund Utilization Overview & Aggregated Progress
        const funds = await request({
            path: '/api/admin/dashboard/fund-utilization',
            method: 'GET'
        });
        assert(
            'Fund Utilization returns total budget, released amount, and program progress',
            funds.status === 200 && 
            funds.body.data.total_allocated_budget === 7000000 &&
            funds.body.data.programs.length === 3,
            `Expected 7,000,000 allocated & 3 programs, got: ${JSON.stringify(funds.body)}`
        );

        // Test 7: Monthly Trend Chart Data
        const trend = await request({
            path: '/api/admin/dashboard/monthly-trend?year=2026',
            method: 'GET'
        });
        assert(
            'Monthly Trend API returns current year submissions per month',
            trend.status === 200 && 
            trend.body.data.year === 2026 &&
            trend.body.data.months.length === 12 &&
            trend.body.data.total_submissions.length === 12,
            `Expected 12 months data, got: ${JSON.stringify(trend.body)}`
        );

        // Test 8: Recent Activity Log Feed
        const recent = await request({
            path: '/api/admin/dashboard/recent-activity?limit=5',
            method: 'GET'
        });
        assert(
            'Recent Activity Feed returns timestamped action logs',
            recent.status === 200 && 
            Array.isArray(recent.body.data) &&
            recent.body.data.length > 0 &&
            recent.body.data[0].timestamp !== undefined,
            `Expected activity logs, got: ${JSON.stringify(recent.body)}`
        );

        // Test 9: Applications List with DPA Masked Contacts
        const apps = await request({
            path: '/api/admin/applications',
            method: 'GET'
        });
        const firstApp = apps.body.data[0];
        assert(
            'Applications List masks contact numbers (09XX-***-XXXX)',
            apps.status === 200 && 
            firstApp && 
            firstApp.contact_number.includes('***'),
            `Expected masked phone like 09XX-***-XXXX, got: ${firstApp ? firstApp.contact_number : 'null'}`
        );

        // Test 10: Strictly View-Only Details Modal API
        const details = await request({
            path: `/api/admin/applications/${firstApp.id}`,
            method: 'GET'
        });
        assert(
            'View-Only Details Modal API enforces read-only integrity',
            details.status === 200 && 
            details.body.data.is_view_only === true &&
            details.body.data.id === firstApp.id,
            `Expected view-only details, got: ${JSON.stringify(details.body)}`
        );

        // Test 11: Admin Approve Application Action
        const approveAction = await request({
            path: `/api/admin/applications/APP-CSWDO-2026-001/approve`,
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }, {
            approved_amount: 15000,
            remarks: 'Medical grant verified and approved.'
        });
        assert(
            'Approve Application updates status to Approved with audit log',
            approveAction.status === 200 && 
            approveAction.body.data.status === 'Approved',
            `Expected status "Approved", got: ${JSON.stringify(approveAction.body)}`
        );

        // Test 12: Admin Deny Application Action
        const denyAction = await request({
            path: `/api/admin/applications/APP-CSWDO-2026-002/deny`,
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }, {
            reason: 'Applicant resides outside designated municipal service zone.'
        });
        assert(
            'Deny Application updates status to Denied with audit reason',
            denyAction.status === 200 && 
            denyAction.body.data.status === 'Denied',
            `Expected status "Denied", got: ${JSON.stringify(denyAction.body)}`
        );

        // Test 13: Release Funds & Balance Deduction
        const releaseAction = await request({
            path: `/api/admin/applications/APP-CSWDO-2026-001/release`,
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }, {
            release_amount: 15000,
            notes: 'Check voucher issued at CSWDO Desk.'
        });
        assert(
            'Release Funds updates status to Released & reduces remaining balance',
            releaseAction.status === 200 && 
            releaseAction.body.data.status === 'Released' &&
            releaseAction.body.fund_update !== null,
            `Expected status "Released" & fund balance update, got: ${JSON.stringify(releaseAction.body)}`
        );

    } catch (err) {
        console.error('[TEST ERROR]:', err);
        failed++;
    } finally {
        if (server) server.close();
    }

    console.log('\n===============================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('===============================================================');
    process.exit(failed > 0 ? 1 : 0);
}

runTests();

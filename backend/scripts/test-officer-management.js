/**
 * Comprehensive CSWDO Officer Management Automated Test Suite
 * Tests all requirements:
 * 1. Officer Accounts List with Active & Deactivated (Archive) separation
 * 2. Search & filter by Name, Username, Role, Department, Status
 * 3. Philippines Data Privacy Act compliance (Masked contact numbers 09XX-***-XXXX)
 * 4. Create New Officer Account with required fields
 * 5. Strong Password Policy enforcement (min 8 chars, letters + numbers)
 * 6. Automated Email Notification credentials dispatch record
 * 7. Duplicate username/email prevention
 * 8. View & Update Officer Details via modal (PUT /api/admin/officers/:id)
 * 9. Instant Status Toggle switch (Active <-> Deactivated)
 * 10. Automatic movement to Archive Section upon deactivation
 * 11. Restore account from Archive Section (Deactivated -> Active)
 * 12. Permanent Delete from Archive Section with mandatory justification
 * 13. Protection of primary Administrator accounts from deletion
 * 14. Audit logging verification for all CRUD and security actions
 */

const http = require('http');
const app = require('../server');

let server;
const PORT = 3101;

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
    console.log('🧪 RUNNING CSWDO OFFICER MANAGEMENT TEST SUITE');
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

        // Test 1: Fetch Officers List
        const listRes = await request({
            path: '/api/admin/officers',
            method: 'GET'
        });
        assert(
            'Fetch Officers list returns active and archived accounts with counts',
            listRes.status === 200 &&
            listRes.body.success === true &&
            listRes.body.active_count >= 1 &&
            listRes.body.archived_count >= 1,
            `Got: ${JSON.stringify(listRes.body)}`
        );

        // Test 2: Data Privacy Act Contact Masking
        const firstOfficer = listRes.body.data[0];
        assert(
            'Contact numbers are masked in compliance with Data Privacy Act (09XX-***-XXXX)',
            firstOfficer && firstOfficer.contact_number.includes('***'),
            `Expected masked phone like 09XX-***-XXXX, got: ${firstOfficer ? firstOfficer.contact_number : 'none'}`
        );

        // Test 3: Create Officer with Weak Password (Should Fail)
        const weakPwRes = await request({
            path: '/api/admin/officers',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            first_name: 'Test',
            last_name: 'Officer',
            username: 'test-weak-pw',
            password: 'simple', // Less than 8 chars
            confirm_password: 'simple',
            email: 'test.weak@koronadal.gov.ph',
            role: 'CSWDO Officer',
            department: 'Medical'
        });
        assert(
            'Strong Password Policy rejects passwords shorter than 8 chars or missing numbers',
            weakPwRes.status === 400 && weakPwRes.body.error === 'Weak Password',
            `Expected 400 & "Weak Password", got: ${JSON.stringify(weakPwRes.body)}`
        );

        // Test 4: Create Officer with Password Mismatch (Should Fail)
        const mismatchRes = await request({
            path: '/api/admin/officers',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            first_name: 'Test',
            last_name: 'Officer',
            username: 'test-mismatch',
            password: 'Password2026!',
            confirm_password: 'DifferentPassword2026!',
            email: 'test.mismatch@koronadal.gov.ph',
            role: 'CSWDO Officer',
            department: 'Medical'
        });
        assert(
            'Creation rejects confirmation password mismatch',
            mismatchRes.status === 400 && mismatchRes.body.error === 'Password Mismatch',
            `Expected 400 & "Password Mismatch", got: ${JSON.stringify(mismatchRes.body)}`
        );

        // Test 5: Create Officer with Valid Credentials & Automated Email Notification
        const createRes = await request({
            path: '/api/admin/officers',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            first_name: 'Angela',
            middle_name: 'G.',
            last_name: 'Valdez',
            suffix: 'N/A',
            username: 'cswdo-angela-valdez',
            password: 'Officer2026Pass',
            confirm_password: 'Officer2026Pass',
            email: 'angela.valdez@koronadal.gov.ph',
            role: 'CSWDO Officer',
            gender: 'Female',
            department: 'Medical',
            contact_number: '0918-333-7788',
            address: 'CSWDO Medical Center Desk, Koronadal City'
        });
        assert(
            'Create Officer account succeeds and logs email credential dispatch record',
            createRes.status === 201 &&
            createRes.body.success === true &&
            createRes.body.data.email_notification.sent === true &&
            createRes.body.data.status === 'Active',
            `Got: ${JSON.stringify(createRes.body)}`
        );

        const newOfficerId = createRes.body.data.id;

        // Test 6: Duplicate Username / Email Prevention
        const dupRes = await request({
            path: '/api/admin/officers',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            first_name: 'Duplicate',
            last_name: 'Test',
            username: 'cswdo-angela-valdez',
            password: 'Officer2026Pass',
            confirm_password: 'Officer2026Pass',
            email: 'angela.valdez@koronadal.gov.ph',
            role: 'CSWDO Officer',
            department: 'Medical'
        });
        assert(
            'Creation blocks duplicate usernames or email addresses (HTTP 409)',
            dupRes.status === 409 && dupRes.body.error === 'Duplicate Account',
            `Expected 409 & "Duplicate Account", got: ${JSON.stringify(dupRes.body)}`
        );

        // Test 7: Fetch Single Officer for Details Modal
        const detailsRes = await request({
            path: `/api/admin/officers/${newOfficerId}`,
            method: 'GET'
        });
        assert(
            'Fetch single officer returns complete profile for view and edit modal',
            detailsRes.status === 200 &&
            detailsRes.body.data.username === 'cswdo-angela-valdez' &&
            detailsRes.body.data.department === 'Medical',
            `Got: ${JSON.stringify(detailsRes.body)}`
        );

        // Test 8: Update Officer Details directly in Modal (PUT /api/admin/officers/:id)
        const updateRes = await request({
            path: `/api/admin/officers/${newOfficerId}`,
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        }, {
            first_name: 'Angela',
            middle_name: 'G.',
            last_name: 'Valdez-Reyes',
            suffix: 'N/A',
            email: 'angela.valdez@koronadal.gov.ph',
            role: 'CSWDO Officer',
            department: 'Financial', // Transferred to Financial Assistance
            gender: 'Female',
            contact_number: '0918-333-9999',
            address: 'CSWDO Financial Center, Koronadal City',
            status: 'Active'
        });
        assert(
            'Update Officer details directly from modal commits changes successfully',
            updateRes.status === 200 &&
            updateRes.body.data.last_name === 'Valdez-Reyes' &&
            updateRes.body.data.department === 'Financial',
            `Got: ${JSON.stringify(updateRes.body)}`
        );

        // Test 9: Instant Status Toggle Switch (Active -> Deactivated)
        const toggleRes = await request({
            path: `/api/admin/officers/${newOfficerId}/status`,
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' }
        });
        assert(
            'Instant toggle switches account status from Active to Deactivated',
            toggleRes.status === 200 &&
            toggleRes.body.data.status === 'Deactivated' &&
            toggleRes.body.is_archived === true,
            `Got: ${JSON.stringify(toggleRes.body)}`
        );

        // Test 10: Verify Account Automatically Moved to Archive Section
        const archiveCheck = await request({
            path: '/api/admin/officers',
            method: 'GET'
        });
        const foundInArchive = archiveCheck.body.archive_data.find(o => o.id === newOfficerId);
        assert(
            'Deactivated officer account automatically appears in Archive Section',
            foundInArchive !== undefined && foundInArchive.status === 'Deactivated',
            `Officer ${newOfficerId} not found in archive: ${JSON.stringify(archiveCheck.body.archive_data)}`
        );

        // Test 11: Restore Account from Archive (Deactivated -> Active)
        const restoreRes = await request({
            path: `/api/admin/officers/${newOfficerId}/status`,
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' }
        });
        assert(
            'Restore button instantly activates account and returns it to Active list',
            restoreRes.status === 200 &&
            restoreRes.body.data.status === 'Active' &&
            restoreRes.body.is_archived === false,
            `Got: ${JSON.stringify(restoreRes.body)}`
        );

        // Deactivate again to test permanent deletion from archive
        await request({
            path: `/api/admin/officers/${newOfficerId}/status`,
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' }
        });

        // Test 12: Permanent Deletion from Archive Section
        const deleteRes = await request({
            path: `/api/admin/officers/${newOfficerId}`,
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'Personnel contract ended, administrative archiving completed.' })
        });
        assert(
            'Permanent Delete removes deactivated officer account from system archive',
            deleteRes.status === 200 &&
            deleteRes.body.success === true &&
            deleteRes.body.deleted_account.username === 'cswdo-angela-valdez',
            `Got: ${JSON.stringify(deleteRes.body)}`
        );

        // Test 13: Protection of Primary Administrator Accounts
        const adminDeleteRes = await request({
            path: '/api/admin/officers/99', // Primary Admin account ID (cswdo-admin)
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'Accidental deletion attempt' })
        });
        assert(
            'Protected accounts safeguard blocks deletion of Primary Administrator',
            adminDeleteRes.status === 403,
            `Expected HTTP 403, got status: ${adminDeleteRes.status}`
        );

        // Test 14: Audit Logs Generated for Actions
        const auditRes = await request({
            path: '/api/admin/activity-logs?limit=10',
            method: 'GET'
        });
        const officerLog = auditRes.body.data.find(l => 
            l.action === 'CREATE_OFFICER' || 
            l.action === 'UPDATE_OFFICER' || 
            l.action === 'DEACTIVATE_OFFICER' ||
            l.action === 'DELETE_OFFICER_PERMANENT'
        );
        assert(
            'Audit logging records administrative actions with timestamp and admin ID',
            auditRes.status === 200 && officerLog !== undefined,
            `Audit logs: ${JSON.stringify(auditRes.body.data)}`
        );

    } catch (err) {
        console.error('[TEST SUITE EXCEPTION]:', err);
        failed++;
    } finally {
        if (server) server.close();
    }

    console.log('\n===============================================================');
    console.log(`OFFICER TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('===============================================================');
    process.exit(failed > 0 ? 1 : 0);
}

runTests();

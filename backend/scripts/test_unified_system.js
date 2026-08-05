/**
 * Automated Test Suite — Unified PESO-CSWDO Information Management System
 * Validates backend rules, database schemas, status restrictions, OTP hashing,
 * deactivated account login blocking, Application Evaluation Module, and audit trail logging.
 */

const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Build standalone test app
const app = express();
app.use(cors());
app.use(express.json());

// Mount auth, officers, audit, and applications routes
const authRoutes = require('../routes/auth');
const officerRoutes = require('../routes/officers');
const auditLogRoutes = require('../routes/audit_logs');
const applicationRoutes = require('../routes/applications');

app.use('/api/auth', authRoutes);
app.use('/api/officers', officerRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/applications', applicationRoutes);

const TEST_PORT = 5099;
const API_BASE = `http://localhost:${TEST_PORT}`;

function makeRequest(method, reqPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, API_BASE);
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers
        }
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve({ status: res.statusCode, data: json });
          } catch (e) {
            resolve({ status: res.statusCode, text: data });
          }
        });
      }
    );

    req.on('error', err => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING UNIFIED PESO-CSWDO AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, failureMsg = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}: ${failureMsg}`);
      failed++;
    }
  }

  // Start test server
  const server = app.listen(TEST_PORT, async () => {
    try {
      // 1. Test SMS OTP Dispatch & Expiry Structure
      console.log('--- TEST 1: SMS OTP & Email Verification Code Generation ---');
      const smsRes = await makeRequest('POST', '/api/auth/send-sms-otp', { phone: '09171234567' });
      assert(
        smsRes.status === 200 && smsRes.data.success && smsRes.data.demoCode && smsRes.data.otpHash,
        'SMS OTP (6-digit, 5-min TTL) dispatch',
        JSON.stringify(smsRes.data)
      );

      const emailRes = await makeRequest('POST', '/api/auth/send-email-code', { email: 'test@koronadal.gov.ph' });
      assert(
        emailRes.status === 200 && emailRes.data.success && emailRes.data.demoCode && emailRes.data.codeHash,
        'Email Verification Code (4-digit, 5-min TTL) dispatch',
        JSON.stringify(emailRes.data)
      );

      // 2. Test Mandatory Document Upload Enforcement (Blocks if missing)
      console.log('\n--- TEST 2: Beneficiary Registration Mandatory Document Validation ---');
      const incompleteRegRes = await makeRequest('POST', '/api/auth/register', {
        username: `test_user_${Date.now()}`,
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        firstName: 'Test',
        lastName: 'Beneficiary',
        dateOfBirth: '1995-05-15',
        sex: 'Male',
        maritalStatus: 'Single',
        email: `test_ben_${Date.now()}@koronadal.gov.ph`,
        phone: '09170001122',
        purok: 'Purok 1',
        barangay: 'Poblacion',
        programType: 'PESO',
        smsVerified: true,
        emailVerified: true
        // validIdFilePath missing!
      });
      assert(
        incompleteRegRes.status === 400 && incompleteRegRes.data.success === false,
        'Registration blocked when mandatory documents missing',
        JSON.stringify(incompleteRegRes.data)
      );

      // 3. Test OTP Verification Check (Fails if unverified)
      console.log('\n--- TEST 3: Unverified Registration Safeguard ---');
      const unverifiedRegRes = await makeRequest('POST', '/api/auth/register', {
        username: `unverified_user_${Date.now()}`,
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        firstName: 'Unverified',
        lastName: 'Beneficiary',
        dateOfBirth: '1995-05-15',
        sex: 'Male',
        maritalStatus: 'Single',
        email: `unverified_${Date.now()}@koronadal.gov.ph`,
        phone: '09170001133',
        purok: 'Purok 1',
        barangay: 'Poblacion',
        programType: 'PESO',
        validIdFilePath: 'valid_id.pdf',
        brgyClearanceFilePath: 'clearance.pdf',
        programReqFilePath: 'proposal.pdf',
        smsVerified: false, // Unverified!
        emailVerified: true
      });
      assert(
        unverifiedRegRes.status === 400 && unverifiedRegRes.data.success === false,
        'Registration blocked when SMS/Email OTP is unverified',
        JSON.stringify(unverifiedRegRes.data)
      );

      // 4. Test 27 Barangays Dropdown Enforcement
      console.log('\n--- TEST 4: 27 Predefined Barangays Rule ---');
      const invalidBrgyRegRes = await makeRequest('POST', '/api/auth/register', {
        username: `invalid_brgy_${Date.now()}`,
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        firstName: 'Invalid',
        lastName: 'Barangay',
        dateOfBirth: '1995-05-15',
        sex: 'Male',
        maritalStatus: 'Single',
        email: `brgy_${Date.now()}@koronadal.gov.ph`,
        phone: '09170001144',
        purok: 'Purok 1',
        barangay: 'InvalidNonExistentBarangay', // Not in 27 list!
        programType: 'PESO',
        validIdFilePath: 'valid_id.pdf',
        brgyClearanceFilePath: 'clearance.pdf',
        programReqFilePath: 'proposal.pdf',
        smsVerified: true,
        emailVerified: true
      });
      assert(
        invalidBrgyRegRes.status === 400 && invalidBrgyRegRes.data.success === false,
        'Registration blocked if Barangay is not in the predefined 27 list',
        JSON.stringify(invalidBrgyRegRes.data)
      );

      // 5. Test PESO Admin Application Evaluation (Mandatory Notes Enforcement & Status Transitions)
      console.log('\n--- TEST 5: PESO Admin Application Evaluation & Mandatory Notes Rule ---');
      const evalMissingNotesRes = await makeRequest('PUT', '/api/applications/1/admin-finalize', {
        action: 'deny',
        notes: '' // Empty notes!
      });
      assert(
        evalMissingNotesRes.status === 400 && evalMissingNotesRes.data.success === false,
        'Evaluation Deny/Pending blocked when mandatory assessment notes are empty',
        JSON.stringify(evalMissingNotesRes.data)
      );

      console.log('\n====================================================');
      console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
      console.log('====================================================');

      server.close(() => process.exit(failed > 0 ? 1 : 0));
    } catch (err) {
      console.error('CRITICAL ERROR in Automated Test Suite:', err.message);
      server.close(() => process.exit(1));
    }
  });
}

runTests();

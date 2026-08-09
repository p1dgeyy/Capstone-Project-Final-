/**
 * Comprehensive Syntax & Static Validation Suite
 * City Government of Koronadal — PESO & CSWDO Portal
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.join(__dirname, '../../');
const filesToValidate = [
    'backend/server.js',
    'backend/auth.js',
    'backend/users.js',
    'backend/routes/otp.js',
    'backend/routes/audit.js',
    'backend/routes/officers.js',
    'backend/middleware/auth.js',
    'backend/middleware/otpRateLimiter.js',
    'backend/utils/auditLogger.js',
    'backend/utils/otpService.js',
    'backend/utils/deliveryService.js',
    'backend/data/seedData.js',
    'backend/scripts/test-api.js',
    'backend/scripts/test-otp-flow.js',
    'frontend/assets/js/peso_admin.js',
    'frontend/assets/js/peso_officer.js',
    'frontend/assets/js/peso-safeguards.js',
    'frontend/assets/js/session-manager.js',
    'frontend/assets/js/otp-auth.js',
    'frontend/assets/js/system-notifications.js'
];

console.log('===============================================================');
console.log('🔍 VALIDATING JAVASCRIPT & BACKEND/FRONTEND MODULE SYNTAX');
console.log('===============================================================\n');

let errorCount = 0;

filesToValidate.forEach(relPath => {
    const fullPath = path.join(rootDir, relPath);
    if (!fs.existsSync(fullPath)) {
        console.warn(`  ⚠️  [SKIP] File does not exist: ${relPath}`);
        return;
    }
    const code = fs.readFileSync(fullPath, 'utf8');
    try {
        new vm.Script(code, { filename: relPath });
        console.log(`  ✅ [VALID SYNTAX] ${relPath}`);
    } catch (e) {
        console.error(`  ❌ [SYNTAX ERROR] ${relPath}:`, e.message);
        errorCount++;
    }
});

// HTML Structure & Attribute Checks
const htmlFiles = [
    'frontend/peso_admin.html',
    'frontend/peso_officer.html',
    'frontend/admin_login.html'
];

htmlFiles.forEach(relPath => {
    const fullPath = path.join(rootDir, relPath);
    if (!fs.existsSync(fullPath)) return;
    const content = fs.readFileSync(fullPath, 'utf8');

    const hasDoctype = content.startsWith('<!DOCTYPE html>');
    const hasUsersSection = relPath.includes('peso_admin.html') ? content.includes('id="sectionUsers"') : true;
    const hasUsersTable = relPath.includes('peso_admin.html') ? content.includes('id="usersManagementTable"') : true;
    const hasUserDetailsModal = relPath.includes('peso_admin.html') ? content.includes('id="userDetailsModal"') : true;
    const hasNewUserModal = relPath.includes('peso_admin.html') ? content.includes('id="newUserModal"') : true;
    const hasEditUserModal = relPath.includes('peso_admin.html') ? content.includes('id="editUserModal"') : true;
    const hasUserActionConfirmModal = relPath.includes('peso_admin.html') ? content.includes('id="userActionConfirmModal"') : true;
    const hasHttpsWarning = relPath.includes('admin_login.html') ? content.includes('httpsWarningBanner') : true;

    if (hasDoctype && hasUsersSection && hasUsersTable && hasUserDetailsModal && hasNewUserModal && hasEditUserModal && hasUserActionConfirmModal && hasHttpsWarning) {
        console.log(`  ✅ [VALID HTML & DOM INTEGRITY] ${relPath}`);
    } else {
        console.error(`  ❌ [HTML INTEGRITY ISSUE] ${relPath} missing required containers.`);
        errorCount++;
    }
});

console.log('\n===============================================================');
if (errorCount === 0) {
    console.log('🎉 ALL CODE AND TEMPLATES PASSED SYNTAX & INTEGRITY CHECKS (0 Errors)');
} else {
    console.error(`❌ Validation failed with ${errorCount} errors.`);
    process.exit(1);
}
console.log('===============================================================\n');

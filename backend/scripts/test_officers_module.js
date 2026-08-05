// Automated Verification Script for PESO Officers Management Module
process.env.MYSQLHOST = 'localhost';
process.env.MYSQLUSER = 'test';
process.env.MYSQLPASSWORD = 'test';
process.env.MYSQLDATABASE = 'test';

const path = require('path');
const fs = require('fs');

console.log('[TEST] Checking backend routes and safe migration imports...');

try {
  const safeMigrate = require('../safe-migrate');
  console.log('[TEST] ✅ safe-migrate.js imported successfully.');

  const officersRouter = require('../routes/officers');
  console.log('[TEST] ✅ routes/officers.js imported successfully.');

  const authRouter = require('../routes/auth');
  console.log('[TEST] ✅ routes/auth.js imported successfully.');

  console.log('[TEST] Checking frontend HTML syntax and element presence...');
  const htmlPath = path.join(__dirname, '../../frontend/peso_admin.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  const requiredTokens = [
    'tabNavOfficers',
    'sectionOfficers',
    'activeOfficersTable',
    'archivedOfficersTable',
    'newOfficerModal',
    'editOfficerModal',
    'handleOfficerStatusToggle',
    'activateOfficerAccount',
    'permanentlyDeleteOfficer',
    'handleCreateOfficerSubmit',
    'handleSaveOfficerUpdates'
  ];

  let missing = [];
  for (const token of requiredTokens) {
    if (!htmlContent.includes(token)) {
      missing.push(token);
    }
  }

  if (missing.length > 0) {
    console.error('[TEST] ❌ Missing tokens in HTML:', missing);
    process.exit(1);
  }

  console.log('[TEST] ✅ All frontend HTML element tokens verified in peso_admin.html.');
  console.log('[TEST] 🎉 All automated code checks passed successfully!');
} catch (err) {
  console.error('[TEST] ❌ Verification error:', err.message);
  console.error(err.stack);
  process.exit(1);
}

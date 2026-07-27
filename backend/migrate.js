// Database Migration Script for Capstone Portal (Refactored)
//
// Handles two scenarios:
//   1. Fresh install — creates officers + beneficiaries tables from schema.sql
//   2. Upgrade from old schema — migrates data from single 'users' table to
//      officers + beneficiaries, then renames users to users_legacy
//
// Safely detects existing tables/columns before making changes.
// Also bcrypt-hashes any plaintext passwords found during migration.
//
// Usage:
//   node backend/migrate.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('./db');

// Schema file path
const SCHEMA_PATH = path.join(__dirname, '..', 'database', 'schema.sql');
const SEED_PATH = path.join(__dirname, '..', 'database', 'seed.sql');

/**
 * Generate a QR code ID (UUID format) for beneficiary migration
 */
function generateQrCodeId() {
  return `BEN-${crypto.randomUUID()}`;
}

/**
 * Check if a table exists in the current database
 */
async function tableExists(connection, tableName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );
  return rows[0].cnt > 0;
}

/**
 * Check if a column exists on a table
 */
async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName]
  );
  return rows[0].cnt > 0;
}

/**
 * Execute a multi-statement SQL file by splitting on semicolons
 */
async function executeSqlFile(connection, filePath, label) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`[MIGRATE] Executing ${label} (${statements.length} statements)...`);

  for (const stmt of statements) {
    try {
      await connection.execute(stmt);
    } catch (err) {
      // Skip errors for CREATE TABLE IF NOT EXISTS, TRUNCATE, etc.
      if (err.code === 'ER_TABLE_EXISTS_ERROR') continue;
      console.warn(`[MIGRATE] Warning in ${label}: ${err.message}`);
      console.warn(`[MIGRATE]   Statement: ${stmt.substring(0, 100)}...`);
    }
  }
  console.log(`[MIGRATE] ✅ ${label} completed.`);
}

/**
 * Hash a password if it's plaintext (doesn't already start with $2a$ / $2b$ / $2y$)
 */
async function hashIfPlaintext(password) {
  if (password && !password.startsWith('$2a$') && !password.startsWith('$2b$') && !password.startsWith('$2y$')) {
    return await bcrypt.hash(password, 10);
  }
  return password;
}

/**
 * Main migration logic
 */
async function migrate() {
  let connection;
  try {
    console.log('================================================================');
    console.log(' Capstone Portal — Database Migration');
    console.log('================================================================');
    console.log(`[MIGRATE] Connecting to database...`);

    connection = await pool.getConnection();
    console.log('[MIGRATE] ✅ Database connection established.');

    // Determine current state
    const hasOldUsersTable = await tableExists(connection, 'users');
    const hasOfficersTable = await tableExists(connection, 'officers');
    const hasBeneficiariesTable = await tableExists(connection, 'beneficiaries');

    console.log(`[MIGRATE] Current state:`);
    console.log(`  - 'users' table (old):       ${hasOldUsersTable ? 'EXISTS' : 'not found'}`);
    console.log(`  - 'officers' table (new):     ${hasOfficersTable ? 'EXISTS' : 'not found'}`);
    console.log(`  - 'beneficiaries' table (new): ${hasBeneficiariesTable ? 'EXISTS' : 'not found'}`);

    // -----------------------------------------------------------------------
    // Scenario 1: Old 'users' table exists and new tables don't → migrate
    // -----------------------------------------------------------------------
    if (hasOldUsersTable && !hasOfficersTable && !hasBeneficiariesTable) {
      console.log('\n[MIGRATE] 📦 Detected old schema. Starting data migration...');
      await migrateFromUsersTable(connection);
    }

    // -----------------------------------------------------------------------
    // Scenario 2: No tables exist → fresh install
    // -----------------------------------------------------------------------
    else if (!hasOfficersTable && !hasBeneficiariesTable) {
      console.log('\n[MIGRATE] 🆕 Fresh install detected. Creating tables...');
      await executeSqlFile(connection, SCHEMA_PATH, 'schema.sql');

      // Optionally seed
      if (fs.existsSync(SEED_PATH)) {
        const seedArg = process.argv.includes('--seed') || process.argv.includes('--with-seed');
        if (seedArg) {
          console.log('[MIGRATE] Seeding database with initial data...');
          await executeSqlFile(connection, SEED_PATH, 'seed.sql');
          await hashAllPlaintextPasswords(connection);
        } else {
          console.log('[MIGRATE] Skipping seed data. Use --seed flag to include seed data.');
        }
      }
    }

    // -----------------------------------------------------------------------
    // Scenario 3: New tables already exist → verify/upgrade schema
    // -----------------------------------------------------------------------
    else {
      console.log('\n[MIGRATE] ✅ New schema already in place. Verifying columns...');
      await verifyAndUpgradeSchema(connection);
    }

    // Hash any remaining plaintext passwords
    await hashAllPlaintextPasswords(connection);

    console.log('\n================================================================');
    console.log(' Migration completed successfully!');
    console.log('================================================================');

  } catch (error) {
    console.error('\n❌ [MIGRATE] Migration failed:', error.message);
    console.error('[MIGRATE] Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

/**
 * Migrate data from old 'users' table to new officers + beneficiaries tables
 */
async function migrateFromUsersTable(connection) {
  const STAFF_ROLES = ['PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator'];

  // Step 1: Create new tables
  console.log('[MIGRATE] Creating new tables (officers, beneficiaries)...');
  await executeSqlFile(connection, SCHEMA_PATH, 'schema.sql');

  // Step 2: Migrate staff/admin to officers
  console.log('[MIGRATE] Migrating staff/admin users to officers table...');

  const [staffRows] = await connection.execute(
    `SELECT * FROM \`users\` WHERE \`role\` IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator') ORDER BY \`id\` ASC`
  );

  for (const user of staffRows) {
    const hashedPw = await hashIfPlaintext(user.password);
    const department = user.role.includes('PESO') ? 'PESO' : (user.role.includes('CSWDO') ? 'CSWDO' : 'General');

    try {
      await connection.execute(
        `INSERT INTO \`officers\` (\`id\`, \`username\`, \`password\`, \`role\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`, \`email\`, \`phone\`, \`department\`, \`status\`, \`current_session_token\`, \`created_at\`, \`updated_at\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?)`,
        [
          user.id, user.username, hashedPw, user.role,
          user.first_name, user.middle_name, user.last_name, user.suffix,
          user.email, user.phone || 'N/A', department,
          user.current_session_token,
          user.created_at, user.updated_at
        ]
      );
      console.log(`  → Migrated officer: ${user.username} (${user.role})`);
    } catch (err) {
      console.warn(`  ⚠ Failed to migrate officer ${user.username}: ${err.message}`);
    }
  }

  // Step 3: Migrate beneficiaries
  console.log('[MIGRATE] Migrating beneficiary users to beneficiaries table...');

  const [benRows] = await connection.execute(
    `SELECT * FROM \`users\` WHERE \`role\` = 'Beneficiary' ORDER BY \`id\` ASC`
  );

  for (const user of benRows) {
    const hashedPw = await hashIfPlaintext(user.password);
    const qrCodeId = generateQrCodeId();

    try {
      await connection.execute(
        `INSERT INTO \`beneficiaries\` (\`qr_code_id\`, \`id\`, \`username\`, \`password\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`, \`age\`, \`date_of_birth\`, \`sex\`, \`nationality\`, \`marital_status\`, \`email\`, \`phone\`, \`address\`, \`id_type\`, \`id_file_path\`, \`terms_agreed\`, \`data_consent\`, \`current_session_token\`, \`is_verified\`, \`qr_code_data\`, \`created_at\`, \`updated_at\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          qrCodeId, user.id, user.username, hashedPw,
          user.first_name, user.middle_name, user.last_name, user.suffix,
          user.age || 0, user.date_of_birth || '1990-01-01',
          user.sex || 'Male', user.nationality || 'Filipino',
          user.marital_status || 'Single',
          user.email, user.phone || 'N/A',
          user.address || 'Not Provided',
          user.id_type, user.id_file_path,
          user.terms_agreed ? 1 : 0, user.data_consent ? 1 : 0,
          user.current_session_token,
          user.is_verified ? 1 : 1, // Mark migrated users as verified
          user.qr_code_data || null,
          user.created_at, user.updated_at
        ]
      );
      console.log(`  → Migrated beneficiary: ${user.username} (QR: ${qrCodeId})`);
    } catch (err) {
      console.warn(`  ⚠ Failed to migrate beneficiary ${user.username}: ${err.message}`);
    }
  }

  // Step 4: Update notifications to include user_type
  console.log('[MIGRATE] Updating notifications with user_type...');
  if (await columnExists(connection, 'notifications', 'user_type')) {
    // Set user_type based on whether user_id is in officers or beneficiaries
    await connection.execute(`
      UPDATE \`notifications\` n SET n.\`user_type\` = 'officer'
      WHERE EXISTS (SELECT 1 FROM \`officers\` o WHERE o.\`id\` = n.\`user_id\`)
    `);
    await connection.execute(`
      UPDATE \`notifications\` n SET n.\`user_type\` = 'beneficiary'
      WHERE EXISTS (SELECT 1 FROM \`beneficiaries\` b WHERE b.\`id\` = n.\`user_id\`)
    `);
  }

  // Step 5: Rename old users table
  console.log('[MIGRATE] Renaming old users table to users_legacy...');
  try {
    await connection.execute('RENAME TABLE `users` TO `users_legacy`');
    console.log('[MIGRATE] ✅ Old users table renamed to users_legacy.');
  } catch (err) {
    console.warn(`[MIGRATE] ⚠ Could not rename users table: ${err.message}`);
  }

  console.log(`[MIGRATE] ✅ Data migration complete. Officers: ${staffRows.length}, Beneficiaries: ${benRows.length}`);
}

/**
 * Verify and upgrade the schema (add missing columns)
 */
async function verifyAndUpgradeSchema(connection) {
  // Officers table checks
  if (await tableExists(connection, 'officers')) {
    if (!(await columnExists(connection, 'officers', 'department'))) {
      await connection.execute("ALTER TABLE `officers` ADD COLUMN `department` VARCHAR(100) DEFAULT NULL AFTER `phone`");
      console.log('[MIGRATE] Added column: officers.department');
    }
    if (!(await columnExists(connection, 'officers', 'status'))) {
      await connection.execute("ALTER TABLE `officers` ADD COLUMN `status` ENUM('Active', 'Inactive', 'Suspended') DEFAULT 'Active' AFTER `department`");
      console.log('[MIGRATE] Added column: officers.status');
    }
  }

  // Beneficiaries table checks
  if (await tableExists(connection, 'beneficiaries')) {
    if (!(await columnExists(connection, 'beneficiaries', 'email_otp'))) {
      await connection.execute("ALTER TABLE `beneficiaries` ADD COLUMN `email_otp` VARCHAR(6) DEFAULT NULL AFTER `is_verified`");
      console.log('[MIGRATE] Added column: beneficiaries.email_otp');
    }
    if (!(await columnExists(connection, 'beneficiaries', 'email_otp_expires_at'))) {
      await connection.execute("ALTER TABLE `beneficiaries` ADD COLUMN `email_otp_expires_at` TIMESTAMP NULL DEFAULT NULL AFTER `email_otp`");
      console.log('[MIGRATE] Added column: beneficiaries.email_otp_expires_at');
    }
  }

  // Notifications table — add user_type if missing
  if (await tableExists(connection, 'notifications')) {
    if (!(await columnExists(connection, 'notifications', 'user_type'))) {
      await connection.execute("ALTER TABLE `notifications` ADD COLUMN `user_type` ENUM('officer', 'beneficiary') NOT NULL DEFAULT 'beneficiary' AFTER `user_id`");
      console.log('[MIGRATE] Added column: notifications.user_type');
    }
  }

  // Audit logs table — add user_type if missing
  if (await tableExists(connection, 'audit_logs')) {
    if (!(await columnExists(connection, 'audit_logs', 'user_type'))) {
      await connection.execute("ALTER TABLE `audit_logs` ADD COLUMN `user_type` ENUM('officer', 'beneficiary') NOT NULL DEFAULT 'officer' AFTER `user_id`");
      console.log('[MIGRATE] Added column: audit_logs.user_type');
    }
  }

  console.log('[MIGRATE] ✅ Schema verification complete.');
}

/**
 * Hash any plaintext passwords in both tables
 */
async function hashAllPlaintextPasswords(connection) {
  console.log('[MIGRATE] Checking for plaintext passwords...');

  // Officers
  if (await tableExists(connection, 'officers')) {
    const [offRows] = await connection.execute('SELECT `id`, `password` FROM `officers`');
    for (const row of offRows) {
      if (row.password && !row.password.startsWith('$2a$') && !row.password.startsWith('$2b$') && !row.password.startsWith('$2y$')) {
        const hashed = await bcrypt.hash(row.password, 10);
        await connection.execute('UPDATE `officers` SET `password` = ? WHERE `id` = ?', [hashed, row.id]);
        console.log(`  → Hashed plaintext password for officer ID: ${row.id}`);
      }
    }
  }

  // Beneficiaries
  if (await tableExists(connection, 'beneficiaries')) {
    const [benRows] = await connection.execute('SELECT `id`, `password` FROM `beneficiaries`');
    for (const row of benRows) {
      if (row.password && !row.password.startsWith('$2a$') && !row.password.startsWith('$2b$') && !row.password.startsWith('$2y$')) {
        const hashed = await bcrypt.hash(row.password, 10);
        await connection.execute('UPDATE `beneficiaries` SET `password` = ? WHERE `id` = ?', [hashed, row.id]);
        console.log(`  → Hashed plaintext password for beneficiary ID: ${row.id}`);
      }
    }
  }

  console.log('[MIGRATE] ✅ Password hashing check complete.');
}

// Run migration
migrate().catch(err => {
  console.error('[MIGRATE] Fatal error:', err);
  process.exit(1);
});

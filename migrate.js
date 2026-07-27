// Database Migration & Auto-Initialization Script for Capstone Portal
//
// Features:
//   1. Auto-Initialization on Startup: Ensures `officers` and `beneficiaries` tables exist.
//   2. Automatic Migration: Detects legacy single `users` table, splits records into
//      `officers` and `beneficiaries` (generating unique `qr_code_id`), and renames
//      `users` to `users_legacy`.
//   3. Auto-Seeding: Populates default accounts and programs if tables are newly created.
//   4. Password Security: Automatically hashes any plaintext passwords to bcrypt.
//
// Usage:
//   - CLI Execution: `node backend/migrate.js` or `npm run migrate`
//   - Server Boot: Imported & run via `autoInitDatabase(pool)` in `server.js`

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Schema file path
const SCHEMA_PATH = path.join(__dirname, '..', 'database', 'schema.sql');
const SEED_PATH = path.join(__dirname, '..', 'database', 'seed.sql');

/**
 * Generate a unique QR code ID (UUID format) for beneficiary accounts
 * @returns {string} e.g. "BEN-a3f7c2e8-4b1d-..."
 */
function generateQrCodeId() {
  const uuid = crypto.randomUUID();
  return `BEN-${uuid}`;
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
 * Execute a multi-statement SQL file safely by stripping comments and splitting on semicolons
 */
async function executeSqlFile(connection, filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[MIGRATE] SQL file not found at ${filePath}`);
    return;
  }

  const rawSql = fs.readFileSync(filePath, 'utf8');

  // Strip multi-line comments (/* ... */)
  let cleanSql = rawSql.replace(/\/\*[\s\S]*?\*\//g, '');

  // Strip single-line comments (-- ...)
  cleanSql = cleanSql
    .split('\n')
    .map(line => {
      const idx = line.indexOf('--');
      if (idx !== -1) {
        return line.substring(0, idx);
      }
      return line;
    })
    .join('\n');

  // Split on semicolons into individual statements
  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`[MIGRATE] Executing ${label} (${statements.length} statements)...`);

  for (const stmt of statements) {
    try {
      await connection.execute(stmt);
    } catch (err) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.code === 'ER_DUP_ENTRY') continue;
      console.warn(`[MIGRATE] Notice in ${label}: ${err.message}`);
    }
  }
  console.log(`[MIGRATE] ✅ ${label} completed.`);
}

/**
 * Hash a password if it's plaintext (doesn't already start with bcrypt $2 prefix)
 */
async function hashIfPlaintext(password) {
  if (password && !password.startsWith('$2a$') && !password.startsWith('$2b$') && !password.startsWith('$2y$')) {
    return await bcrypt.hash(password, 10);
  }
  return password;
}

/**
 * Perform database auto-initialization & migration
 * @param {object} poolInstance - mysql2 connection pool
 */
async function autoInitDatabase(poolInstance) {
  let connection;
  try {
    console.log('[DB-INIT] Running database initialization and migration check...');
    connection = await poolInstance.getConnection();

    const hasOldUsersTable = await tableExists(connection, 'users');
    const hasOfficersTable = await tableExists(connection, 'officers');
    const hasBeneficiariesTable = await tableExists(connection, 'beneficiaries');

    console.log(`[DB-INIT] Schema status: officers=${hasOfficersTable}, beneficiaries=${hasBeneficiariesTable}, legacy_users=${hasOldUsersTable}`);

    // Scenario 1: Old 'users' table exists → Migrate data to split tables
    if (hasOldUsersTable && (!hasOfficersTable || !hasBeneficiariesTable)) {
      console.log('[DB-INIT] 📦 Old unified `users` table detected. Migrating to `officers` and `beneficiaries`...');
      await migrateFromUsersTable(connection);
    }
    // Scenario 2: Tables missing → Fresh schema setup + auto-seed
    else if (!hasOfficersTable || !hasBeneficiariesTable) {
      console.log('[DB-INIT] 🆕 New database schema initialization required. Creating tables...');
      await executeSqlFile(connection, SCHEMA_PATH, 'schema.sql');

      // Auto-seed if officers table is empty
      const [offCount] = await connection.execute('SELECT COUNT(*) as cnt FROM officers');
      if (offCount[0].cnt === 0 && fs.existsSync(SEED_PATH)) {
        console.log('[DB-INIT] Seeding initial mock data into database...');
        await executeSqlFile(connection, SEED_PATH, 'seed.sql');
      }
    }
    // Scenario 3: Schema already split → Verify/upgrade columns
    else {
      console.log('[DB-INIT] ✅ Schema up-to-date. Verifying table columns...');
      await verifyAndUpgradeSchema(connection);
    }

    // Auto-hash any plaintext passwords across both tables
    await hashAllPlaintextPasswords(connection);

    console.log('[DB-INIT] ✅ Database initialization complete!');
  } catch (error) {
    console.error('[DB-INIT] ❌ Database initialization/migration error:', error.message);
    console.error(error.stack);
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Migrate data from legacy single `users` table into `officers` and `beneficiaries`
 */
async function migrateFromUsersTable(connection) {
  // Step 1: Ensure target tables exist
  await executeSqlFile(connection, SCHEMA_PATH, 'schema.sql');

  // Step 2: Migrate staff & admins to officers table
  console.log('[MIGRATE] Transferring staff/admin accounts to `officers` table...');
  const [staffRows] = await connection.execute(
    `SELECT * FROM \`users\` WHERE \`role\` IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator', 'Admin', 'Officer') ORDER BY \`id\` ASC`
  );

  for (const user of staffRows) {
    const hashedPw = await hashIfPlaintext(user.password);
    let role = user.role;
    if (role === 'Admin') role = 'PESO Admin';
    if (role === 'Officer') role = 'PESO Officer';
    const department = role.includes('PESO') ? 'PESO' : (role.includes('CSWDO') ? 'CSWDO' : 'General');

    try {
      await connection.execute(
        `INSERT INTO \`officers\` (\`id\`, \`username\`, \`password\`, \`role\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`, \`email\`, \`phone\`, \`department\`, \`status\`, \`current_session_token\`, \`created_at\`, \`updated_at\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?)
         ON DUPLICATE KEY UPDATE \`role\` = VALUES(\`role\`)`,
        [
          user.id, user.username, hashedPw, role,
          user.first_name || 'Staff', user.middle_name || null, user.last_name || 'Member', user.suffix || null,
          user.email || `${user.username}@koronadal.gov.ph`, user.phone || 'N/A', department,
          user.current_session_token || null,
          user.created_at || new Date(), user.updated_at || new Date()
        ]
      );
      console.log(`  → Migrated officer: ${user.username} (${role})`);
    } catch (err) {
      console.warn(`  ⚠ Failed to migrate officer ${user.username}: ${err.message}`);
    }
  }

  // Step 3: Migrate beneficiaries to beneficiaries table
  console.log('[MIGRATE] Transferring beneficiary accounts to `beneficiaries` table...');
  const [benRows] = await connection.execute(
    `SELECT * FROM \`users\` WHERE \`role\` NOT IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator', 'Admin', 'Officer') OR \`role\` IS NULL ORDER BY \`id\` ASC`
  );

  for (const user of benRows) {
    const hashedPw = await hashIfPlaintext(user.password);
    const qrCodeId = generateQrCodeId();

    try {
      await connection.execute(
        `INSERT INTO \`beneficiaries\` (\`qr_code_id\`, \`id\`, \`username\`, \`password\`, \`role\`, \`status\`, \`first_name\`, \`middle_name\`, \`last_name\`, \`suffix\`, \`age\`, \`date_of_birth\`, \`sex\`, \`nationality\`, \`marital_status\`, \`email\`, \`phone\`, \`address\`, \`id_type\`, \`id_file_path\`, \`terms_agreed\`, \`data_consent\`, \`current_session_token\`, \`is_verified\`, \`qr_code_data\`, \`created_at\`, \`updated_at\`)
         VALUES (?, ?, ?, ?, 'Beneficiary', 'Active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE \`username\` = VALUES(\`username\`)`,
        [
          qrCodeId, user.id, user.username, hashedPw,
          user.first_name || 'Beneficiary', user.middle_name || null, user.last_name || 'User', user.suffix || null,
          user.age || 18, user.date_of_birth || '2000-01-01',
          user.sex || 'Male', user.nationality || 'Filipino',
          user.marital_status || 'Single',
          user.email || `${user.username}@email.com`, user.phone || 'N/A',
          user.address || 'Koronadal City',
          user.id_type || null, user.id_file_path || null,
          user.terms_agreed ? 1 : 1, user.data_consent ? 1 : 1,
          user.current_session_token || null,
          user.is_verified ? 1 : 1,
          user.qr_code_data || null,
          user.created_at || new Date(), user.updated_at || new Date()
        ]
      );
      console.log(`  → Migrated beneficiary: ${user.username} (QR: ${qrCodeId})`);
    } catch (err) {
      console.warn(`  ⚠ Failed to migrate beneficiary ${user.username}: ${err.message}`);
    }
  }

  // Step 4: Rename old users table to users_legacy
  console.log('[MIGRATE] Renaming old `users` table to `users_legacy`...');
  try {
    await connection.execute('RENAME TABLE `users` TO `users_legacy`');
    console.log('[MIGRATE] ✅ Old `users` table safely renamed to `users_legacy`.');
  } catch (err) {
    console.warn(`[MIGRATE] Notice: ${err.message}`);
  }
}

/**
 * Verify and upgrade schema (ensure missing columns exist)
 */
async function verifyAndUpgradeSchema(connection) {
  if (await tableExists(connection, 'officers')) {
    if (!(await columnExists(connection, 'officers', 'department'))) {
      await connection.execute("ALTER TABLE `officers` ADD COLUMN `department` VARCHAR(100) DEFAULT NULL AFTER `phone`");
    }
    if (!(await columnExists(connection, 'officers', 'status'))) {
      await connection.execute("ALTER TABLE `officers` ADD COLUMN `status` ENUM('Active', 'Inactive', 'Suspended') DEFAULT 'Active' AFTER `department`");
    }
  }

  if (await tableExists(connection, 'beneficiaries')) {
    if (!(await columnExists(connection, 'beneficiaries', 'role'))) {
      await connection.execute("ALTER TABLE `beneficiaries` ADD COLUMN `role` VARCHAR(50) DEFAULT 'Beneficiary' AFTER `password`");
    }
    if (!(await columnExists(connection, 'beneficiaries', 'status'))) {
      await connection.execute("ALTER TABLE `beneficiaries` ADD COLUMN `status` ENUM('Active', 'Inactive', 'Suspended') DEFAULT 'Active' AFTER `role`");
    }
    if (!(await columnExists(connection, 'beneficiaries', 'email_otp'))) {
      await connection.execute("ALTER TABLE `beneficiaries` ADD COLUMN `email_otp` VARCHAR(6) DEFAULT NULL AFTER `is_verified`");
    }
    if (!(await columnExists(connection, 'beneficiaries', 'email_otp_expires_at'))) {
      await connection.execute("ALTER TABLE `beneficiaries` ADD COLUMN `email_otp_expires_at` TIMESTAMP NULL DEFAULT NULL AFTER `email_otp`");
    }
  }

  if (await tableExists(connection, 'notifications')) {
    if (!(await columnExists(connection, 'notifications', 'user_type'))) {
      await connection.execute("ALTER TABLE `notifications` ADD COLUMN `user_type` ENUM('officer', 'beneficiary') NOT NULL DEFAULT 'beneficiary' AFTER `user_id`");
    }
  }

  if (await tableExists(connection, 'audit_logs')) {
    if (!(await columnExists(connection, 'audit_logs', 'user_type'))) {
      await connection.execute("ALTER TABLE `audit_logs` ADD COLUMN `user_type` ENUM('officer', 'beneficiary') NOT NULL DEFAULT 'officer' AFTER `user_id`");
    }
  }
}

/**
 * Hash any remaining plaintext passwords across both tables
 */
async function hashAllPlaintextPasswords(connection) {
  if (await tableExists(connection, 'officers')) {
    const [offRows] = await connection.execute('SELECT `id`, `password` FROM `officers`');
    for (const row of offRows) {
      if (row.password && !row.password.startsWith('$2a$') && !row.password.startsWith('$2b$') && !row.password.startsWith('$2y$')) {
        const hashed = await bcrypt.hash(row.password, 10);
        await connection.execute('UPDATE `officers` SET `password` = ? WHERE `id` = ?', [hashed, row.id]);
      }
    }
  }

  if (await tableExists(connection, 'beneficiaries')) {
    const [benRows] = await connection.execute('SELECT `id`, `password` FROM `beneficiaries`');
    for (const row of benRows) {
      if (row.password && !row.password.startsWith('$2a$') && !row.password.startsWith('$2b$') && !row.password.startsWith('$2y$')) {
        const hashed = await bcrypt.hash(row.password, 10);
        await connection.execute('UPDATE `beneficiaries` SET `password` = ? WHERE `id` = ?', [hashed, row.id]);
      }
    }
  }
}

// Standalone CLI execution handler
if (require.main === module) {
  const pool = require('./db');
  autoInitDatabase(pool).then(() => {
    pool.end();
  });
}

module.exports = { autoInitDatabase, generateQrCodeId };

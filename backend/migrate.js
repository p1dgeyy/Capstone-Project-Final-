const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const pool = require('./db.js');

// Helper to parse SQL file into individual statements
function parseSqlFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`SQL file not found at: ${filePath}`);
  }

  const rawContent = fs.readFileSync(filePath, 'utf8');
  const lines = rawContent.split('\n');
  let cleanSql = '';

  for (let line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('#')) {
      continue;
    }
    // Remove inline comment if present (excluding inside strings)
    // For capstone, simple line filter is robust enough
    cleanSql += line + '\n';
  }

  // Split by semicolon, filter empty statements
  return cleanSql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
}

async function runMigrations() {
  console.log('--- STARTING DATABASE MIGRATION PROCESS ---');
  let connection;

  try {
    // 1. Get database connection from pool with retry logic for container startup synchronization
    let retries = 10;
    while (retries > 0) {
      try {
        connection = await pool.getConnection();
        console.log('Successfully connected to the database.');
        break;
      } catch (err) {
        retries--;
        if (retries === 0) {
          console.error('All database connection retries exhausted.');
          throw err;
        }
        console.log(`Database not ready yet. Retrying connection in 5 seconds... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // 2. Load schema.sql and split into queries
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    console.log(`Reading schema definitions from: ${schemaPath}`);
    const schemaStatements = parseSqlFile(schemaPath);

    // 3. Execute schema queries sequentially
    console.log(`Executing ${schemaStatements.length} schema statements...`);
    for (const statement of schemaStatements) {
      // Print first 80 characters of statement for visibility
      const snippet = statement.substring(0, 80).replace(/\s+/g, ' ');
      console.log(`Executing: ${snippet}...`);
      await connection.query(statement);
    }
    console.log('Database schema successfully initialized/verified.');

    // 3.5. Ensure current_session_token column exists on existing deployments
    try {
      const [columns] = await connection.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'current_session_token'"
      );
      if (columns.length === 0) {
        console.log('Adding current_session_token column to users table...');
        await connection.query(
          "ALTER TABLE `users` ADD COLUMN `current_session_token` VARCHAR(128) DEFAULT NULL AFTER `data_consent`"
        );
        console.log('current_session_token column added successfully.');
      }
    } catch (alterError) {
      console.warn('Warning: Could not verify/add current_session_token column:', alterError.message);
    }

    // 3.6. Ensure officer/admin evaluation columns exist on applications table
    try {
      const appCols = ['officer_decision', 'officer_id', 'officer_notes', 'officer_action_at', 'admin_id', 'admin_notes', 'documents_json'];
      for (const col of appCols) {
        const [chk] = await connection.query(
          "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = ?",
          [col]
        );
        if (chk.length === 0) {
          console.log(`Adding ${col} column to applications table...`);
          if (col === 'officer_decision') {
            await connection.query("ALTER TABLE `applications` ADD COLUMN `officer_decision` ENUM('Approved', 'Denied', 'Pending Requirements', 'None') DEFAULT 'None'");
          } else if (col === 'officer_id' || col === 'admin_id') {
            await connection.query(`ALTER TABLE \`applications\` ADD COLUMN \`${col}\` INT DEFAULT NULL`);
          } else if (col === 'officer_action_at') {
            await connection.query("ALTER TABLE `applications` ADD COLUMN `officer_action_at` TIMESTAMP NULL DEFAULT NULL");
          } else {
            await connection.query(`ALTER TABLE \`applications\` ADD COLUMN \`${col}\` TEXT DEFAULT NULL`);
          }
        }
      }

      // Modify status ENUM to include Officer Approved / Officer Denied / Pending Requirements if needed
      await connection.query(
        "ALTER TABLE `applications` MODIFY COLUMN `status` ENUM('Pending', 'Pending Requirements', 'Under Review', 'Interview Scheduled', 'Training Scheduled', 'Officer Approved', 'Officer Denied', 'Approved', 'Rejected', 'Completed') DEFAULT 'Pending'"
      );
    } catch (appAlterErr) {
      console.warn('Warning: Could not add applications evaluation columns:', appAlterErr.message);
    }

    // 3.7. Ensure audit_logs table exists
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`audit_logs\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`user_id\` INT NOT NULL,
          \`action\` VARCHAR(100) NOT NULL,
          \`entity_type\` VARCHAR(50) DEFAULT 'application',
          \`entity_id\` INT DEFAULT NULL,
          \`details\` TEXT DEFAULT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT \`fk_audit_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
          INDEX \`idx_audit_user\` (\`user_id\`),
          INDEX \`idx_audit_action\` (\`action\`),
          INDEX \`idx_audit_entity\` (\`entity_type\`, \`entity_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('audit_logs table verified.');
    } catch (auditErr) {
      console.warn('Warning: Could not verify audit_logs table:', auditErr.message);
    }

    // 3.8. Ensure approved_assistance table exists (REQ082, REQ083)
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`approved_assistance\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`application_id\` INT DEFAULT NULL,
          \`beneficiary_id\` INT NOT NULL,
          \`program_id\` INT NOT NULL,
          \`assistance_type\` VARCHAR(100) NOT NULL,
          \`quantity_amount\` VARCHAR(255) NOT NULL,
          \`conditions\` TEXT DEFAULT NULL,
          \`approval_date\` DATE NOT NULL,
          \`officer_id\` INT NOT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT \`fk_ast_beneficiary\` FOREIGN KEY (\`beneficiary_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_ast_program\` FOREIGN KEY (\`program_id\`) REFERENCES \`programs\` (\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_ast_officer\` FOREIGN KEY (\`officer_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
          INDEX \`idx_ast_beneficiary\` (\`beneficiary_id\`),
          INDEX \`idx_ast_program\` (\`program_id\`),
          INDEX \`idx_ast_date\` (\`approval_date\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('approved_assistance table verified.');
    // 3.9. Ensure interview_schedules table exists (REQ084 - REQ088)
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`interview_schedules\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`application_id\` INT DEFAULT NULL,
          \`beneficiary_id\` INT NOT NULL,
          \`program_id\` INT NOT NULL,
          \`officer_id\` INT NOT NULL,
          \`interview_date\` DATE NOT NULL,
          \`interview_time\` VARCHAR(50) NOT NULL,
          \`venue_location\` VARCHAR(255) NOT NULL DEFAULT 'PESO Main Office - Interview Room A',
          \`status\` ENUM('Scheduled', 'Pending', 'Completed', 'Missed', 'Cancelled') DEFAULT 'Scheduled',
          \`attendance_status\` ENUM('Unmarked', 'Present', 'Absent') DEFAULT 'Unmarked',
          \`remarks\` TEXT DEFAULT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT \`fk_int_beneficiary\` FOREIGN KEY (\`beneficiary_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_int_program\` FOREIGN KEY (\`program_id\`) REFERENCES \`programs\` (\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_int_officer\` FOREIGN KEY (\`officer_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
          INDEX \`idx_int_beneficiary\` (\`beneficiary_id\`),
          INDEX \`idx_int_date\` (\`interview_date\`),
          INDEX \`idx_int_status\` (\`status\`),
          INDEX \`idx_int_attendance\` (\`attendance_status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('interview_schedules table verified.');
    } catch (intErr) {
      console.warn('Warning: Could not verify interview_schedules table:', intErr.message);
    }



    // 4. Determine if seeding is necessary
    // We only seed if the users table is empty to prevent overwriting production data
    console.log('Checking database content for seeding condition...');
    const [rows] = await connection.query('SELECT COUNT(*) AS count FROM users');
    const userCount = rows[0].count;
    console.log(`Found ${userCount} existing users in the database.`);

    if (userCount === 0) {
      console.log('No users found. Seeding default capstone portal data...');
      const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
      console.log(`Reading seed queries from: ${seedPath}`);
      const seedStatements = parseSqlFile(seedPath);

      console.log(`Executing ${seedStatements.length} seed statements...`);
      for (const statement of seedStatements) {
        const snippet = statement.substring(0, 80).replace(/\s+/g, ' ');
        console.log(`Executing: ${snippet}...`);
        await connection.query(statement);
      }
      console.log('Database seeding successfully completed.');

      // 4.5. Hash all plaintext passwords in the seeded data
      // The seed.sql uses plaintext passwords for readability, but production must use bcrypt
      console.log('Hashing seed user passwords with bcrypt...');
      const [seedUsers] = await connection.query('SELECT `id`, `username`, `password` FROM `users`');
      let hashedCount = 0;

      for (const user of seedUsers) {
        // Skip if already a bcrypt hash (starts with $2a$, $2b$, or $2y$)
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
          continue;
        }
        const hashedPassword = await bcrypt.hash(user.password, 10);
        await connection.execute(
          'UPDATE `users` SET `password` = ? WHERE `id` = ?',
          [hashedPassword, user.id]
        );
        hashedCount++;
        console.log(`  Hashed password for user: ${user.username}`);
      }
      console.log(`Password hashing complete. ${hashedCount} password(s) upgraded to bcrypt.`);

    } else {
      console.log('Database already contains data. Skipping seeding phase to preserve existing records.');

      // 4.6. Still check for any remaining plaintext passwords and hash them
      // (handles edge case where previous deployment seeded but didn't hash)
      console.log('Checking for any remaining plaintext passwords...');
      const [allUsers] = await connection.query('SELECT `id`, `username`, `password` FROM `users`');
      let legacyCount = 0;

      for (const user of allUsers) {
        if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$') && !user.password.startsWith('$2y$')) {
          const hashedPassword = await bcrypt.hash(user.password, 10);
          await connection.execute(
            'UPDATE `users` SET `password` = ? WHERE `id` = ?',
            [hashedPassword, user.id]
          );
          legacyCount++;
          console.log(`  Migrated plaintext password for user: ${user.username}`);
        }
      }

      if (legacyCount > 0) {
        console.log(`Migrated ${legacyCount} plaintext password(s) to bcrypt.`);
      } else {
        console.log('All passwords are already bcrypt-hashed. No migration needed.');
      }
    }

    console.log('--- DATABASE MIGRATIONS COMPLETE ---');
  } catch (error) {
    console.error('CRITICAL ERROR during migration execution:', error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    // Close the connection pool to allow the migration process to exit cleanly
    await pool.end();
    console.log('Database pool closed. Exiting process.');
  }
}

runMigrations();

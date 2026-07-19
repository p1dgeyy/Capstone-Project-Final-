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
    // (ALTER TABLE is idempotent-safe with the IF NOT EXISTS check below)
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
      } else {
        console.log('current_session_token column already exists. Skipping.');
      }
    } catch (alterError) {
      console.warn('Warning: Could not verify/add current_session_token column:', alterError.message);
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

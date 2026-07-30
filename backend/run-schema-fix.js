// Standalone Forced Database Schema Fix & Migration Script
// Runs before server startup via "start": "node backend/run-schema-fix.js && node backend/server.js"

require('dotenv').config();
const pool = require('./db');

async function runSchemaFix() {
  let connection;
  try {
    console.log('[SCHEMA-FIX] Starting forced database schema migration...');
    connection = await pool.getConnection();

    // Query 1: Create officers table
    console.log('[SCHEMA-FIX] Executing Query 1: Creating `officers` table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS officers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          email VARCHAR(150) UNIQUE,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          middle_name VARCHAR(100),
          role VARCHAR(50) DEFAULT 'PESO Officer',
          department VARCHAR(100) DEFAULT 'PESO',
          status VARCHAR(50) DEFAULT 'Active',
          current_session_token VARCHAR(128) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Query 2: Create beneficiaries table
    console.log('[SCHEMA-FIX] Executing Query 2: Creating `beneficiaries` table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS beneficiaries (
          qr_code_id VARCHAR(100) PRIMARY KEY,
          id INT AUTO_INCREMENT UNIQUE,
          username VARCHAR(100) UNIQUE,
          password VARCHAR(255),
          email VARCHAR(150) UNIQUE,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          middle_name VARCHAR(100),
          role VARCHAR(50) DEFAULT 'Beneficiary',
          status VARCHAR(50) DEFAULT 'Active',
          age INT DEFAULT 18,
          date_of_birth DATE DEFAULT '2000-01-01',
          sex VARCHAR(20) DEFAULT 'Male',
          nationality VARCHAR(50) DEFAULT 'Filipino',
          marital_status VARCHAR(50) DEFAULT 'Single',
          phone VARCHAR(30) DEFAULT 'N/A',
          address TEXT DEFAULT NULL,
          id_type VARCHAR(100) DEFAULT NULL,
          id_file_path VARCHAR(255) DEFAULT NULL,
          terms_agreed BOOLEAN DEFAULT TRUE,
          data_consent BOOLEAN DEFAULT TRUE,
          current_session_token VARCHAR(128) DEFAULT NULL,
          is_verified BOOLEAN DEFAULT TRUE,
          email_otp VARCHAR(6) DEFAULT NULL,
          email_otp_expires_at TIMESTAMP NULL DEFAULT NULL,
          qr_code_data TEXT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Check for legacy table 'users' vs 'users_legacy'
    let sourceTable = null;
    const [uRows] = await connection.execute(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'`
    );
    const [ulRows] = await connection.execute(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users_legacy'`
    );

    if (uRows[0].cnt > 0) {
      sourceTable = 'users';
    } else if (ulRows[0].cnt > 0) {
      sourceTable = 'users_legacy';
    }

    if (sourceTable) {
      console.log(`[SCHEMA-FIX] Found source table \`${sourceTable}\`. Transferring legacy records...`);

      // Query 3: Copy staff/admins to officers
      try {
        await connection.execute(`
          INSERT IGNORE INTO officers (username, password, email, first_name, last_name, role)
          SELECT username, password, email, first_name, last_name, role 
          FROM \`${sourceTable}\` 
          WHERE role LIKE '%Admin%' OR role LIKE '%Officer%' OR role LIKE '%Staff%' OR role = 'Evaluator';
        `);
        console.log('[SCHEMA-FIX] Executed Query 3: Migrated officers from legacy table.');
      } catch (err3) {
        console.warn('[SCHEMA-FIX] Query 3 Notice:', err3.message);
      }

      // Query 4: Copy beneficiaries with QR IDs
      try {
        await connection.execute(`
          INSERT IGNORE INTO beneficiaries (qr_code_id, username, password, email, first_name, last_name, role)
          SELECT CONCAT('QR-BEN-', id), username, password, email, first_name, last_name, COALESCE(role, 'Beneficiary') 
          FROM \`${sourceTable}\` 
          WHERE role = 'Beneficiary' OR role IS NULL OR (role NOT LIKE '%Admin%' AND role NOT LIKE '%Officer%' AND role NOT LIKE '%Staff%');
        `);
        console.log('[SCHEMA-FIX] Executed Query 4: Migrated beneficiaries from legacy table.');
      } catch (err4) {
        console.warn('[SCHEMA-FIX] Query 4 Notice:', err4.message);
      }

      if (sourceTable === 'users') {
        try {
          await connection.execute(`RENAME TABLE users TO users_legacy;`);
          console.log('[SCHEMA-FIX] Renamed `users` to `users_legacy`.');
        } catch (renameErr) {
          console.warn('[SCHEMA-FIX] Notice during table rename:', renameErr.message);
        }
      }
    }

    // Seed default officer accounts if officers table is empty
    try {
      const [offCount] = await connection.execute(`SELECT COUNT(*) AS cnt FROM officers`);
      if (offCount[0].cnt === 0) {
        console.log('[SCHEMA-FIX] Seeding default officer accounts...');
        await connection.execute(`
          INSERT IGNORE INTO officers (id, username, password, role, first_name, last_name, email, department) VALUES
          (1, 'peso-admin', 'password123', 'PESO Admin', 'John', 'Doe', 'peso.admin@koronadal.gov.ph', 'PESO'),
          (2, 'peso-officer', 'password123', 'PESO Officer', 'Jane', 'Smith', 'peso.officer@koronadal.gov.ph', 'PESO'),
          (3, 'cswdo-admin', 'password123', 'CSWDO Admin', 'Robert', 'Johnson', 'cswdo.admin@koronadal.gov.ph', 'CSWDO'),
          (4, 'cswdo-officer', 'password123', 'CSWDO Officer', 'Mary', 'Williams', 'cswdo.officer@koronadal.gov.ph', 'CSWDO'),
          (5, 'evaluator', 'password123', 'Evaluator', 'Edward', 'Davis', 'evaluator@koronadal.gov.ph', 'PESO');
        `);
      }
    } catch (seedOffErr) {
      console.warn('[SCHEMA-FIX] Notice seeding default officers:', seedOffErr.message);
    }

    // Seed default beneficiary accounts if beneficiaries table is empty
    try {
      const [benCount] = await connection.execute(`SELECT COUNT(*) AS cnt FROM beneficiaries`);
      if (benCount[0].cnt === 0) {
        console.log('[SCHEMA-FIX] Seeding default beneficiary accounts...');
        await connection.execute(`
          INSERT IGNORE INTO beneficiaries (qr_code_id, id, username, password, role, first_name, last_name, email, phone, address, is_verified) VALUES
          ('QR-BEN-6', 6, 'juan_dela_cruz', 'Test1234', 'Beneficiary', 'Juan', 'Dela Cruz', 'juan.delacruz@email.com', '0905-111-2222', 'Koronadal City', TRUE),
          ('QR-BEN-7', 7, 'maria_santos', 'Sample5678', 'Beneficiary', 'Maria', 'Santos', 'maria.santos@email.com', '0906-333-4444', 'Koronadal City', TRUE),
          ('QR-BEN-8', 8, 'pedro_reyes', 'DemoPass90', 'Beneficiary', 'Pedro', 'Reyes', 'pedro.reyes@email.com', '0907-555-6666', 'Koronadal City', TRUE);
        `);
      }
    } catch (seedBenErr) {
      console.warn('[SCHEMA-FIX] Notice seeding default beneficiaries:', seedBenErr.message);
    }

    console.log("✅ SCHEMA MIGRATION SUCCESSFUL");
  } catch (err) {
    console.error("❌ SCHEMA MIGRATION FAILED:", err);
  } finally {
    if (connection) connection.release();
    try {
      await pool.end();
    } catch (e) {}
    process.exit(0);
  }
}

runSchemaFix();

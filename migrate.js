// Database Migration & Auto-Creation Module for Capstone Portal
// Uses clean, single-statement SQL queries wrapped in try/catch blocks for safe startup migration on Railway.

const pool = require('./db');

/**
 * Check if a table exists in the MySQL database
 */
async function tableExists(connection, tableName) {
  try {
    const [rows] = await connection.execute(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
      [tableName]
    );
    return rows[0].cnt > 0;
  } catch (e) {
    return false;
  }
}

/**
 * Main migration function — executed safely on server startup
 */
async function migrateDatabase() {
  let connection;
  try {
    console.log('[MIGRATE] Initializing database table auto-creation and migration...');
    connection = await pool.getConnection();

    // SQL Step 1: Create table officers
    try {
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
      console.log('[MIGRATE] ✅ Table `officers` verified/created.');
    } catch (err) {
      console.error('[MIGRATE] Error creating `officers` table:', err.message);
    }

    // SQL Step 2: Create table beneficiaries
    try {
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
      console.log('[MIGRATE] ✅ Table `beneficiaries` verified/created.');
    } catch (err) {
      console.error('[MIGRATE] Error creating `beneficiaries` table:', err.message);
    }

    // SQL Step 3 & 4: Copy existing data if legacy `users` or `users_legacy` table exists
    const hasUsers = await tableExists(connection, 'users');
    const hasUsersLegacy = await tableExists(connection, 'users_legacy');
    const sourceTable = hasUsers ? 'users' : (hasUsersLegacy ? 'users_legacy' : null);

    if (sourceTable) {
      console.log(`[MIGRATE] Migrating legacy accounts from \`${sourceTable}\`...`);

      // Copy staff/admins to officers
      try {
        await connection.execute(`
          INSERT IGNORE INTO officers (username, password, email, first_name, last_name, role)
          SELECT username, password, email, first_name, last_name, role
          FROM \`${sourceTable}\`
          WHERE role LIKE '%Admin%' OR role LIKE '%Officer%' OR role LIKE '%Staff%' OR role = 'Evaluator';
        `);
        console.log('[MIGRATE] ✅ Transferred staff/admin records to `officers`.');
      } catch (err) {
        console.error('[MIGRATE] Notice copying staff to `officers`:', err.message);
      }

      // Copy beneficiaries with generated QR IDs
      try {
        await connection.execute(`
          INSERT IGNORE INTO beneficiaries (qr_code_id, username, password, email, first_name, last_name, role)
          SELECT CONCAT('QR-BEN-', id), username, password, email, first_name, last_name, COALESCE(role, 'Beneficiary')
          FROM \`${sourceTable}\`
          WHERE role = 'Beneficiary' OR role IS NULL OR (role NOT LIKE '%Admin%' AND role NOT LIKE '%Officer%' AND role NOT LIKE '%Staff%');
        `);
        console.log('[MIGRATE] ✅ Transferred beneficiary records to `beneficiaries`.');
      } catch (err) {
        console.error('[MIGRATE] Notice copying beneficiaries to `beneficiaries`:', err.message);
      }

      if (hasUsers) {
        try {
          await connection.execute(`RENAME TABLE users TO users_legacy;`);
          console.log('[MIGRATE] ✅ Renamed `users` to `users_legacy`.');
        } catch (err) {
          console.error('[MIGRATE] Notice renaming users table:', err.message);
        }
      }
    }

    // Ensure default seed accounts exist in officers if table is empty
    try {
      const [offRows] = await connection.execute(`SELECT COUNT(*) AS cnt FROM officers`);
      if (offRows[0].cnt === 0) {
        console.log('[MIGRATE] Populating default officer seed accounts...');
        await connection.execute(`
          INSERT IGNORE INTO officers (id, username, password, role, first_name, last_name, email, department) VALUES
          (1, 'peso-admin', 'password123', 'PESO Admin', 'John', 'Doe', 'peso.admin@koronadal.gov.ph', 'PESO'),
          (2, 'peso-officer', 'password123', 'PESO Officer', 'Jane', 'Smith', 'peso.officer@koronadal.gov.ph', 'PESO'),
          (3, 'cswdo-admin', 'password123', 'CSWDO Admin', 'Robert', 'Johnson', 'cswdo.admin@koronadal.gov.ph', 'CSWDO'),
          (4, 'cswdo-officer', 'password123', 'CSWDO Officer', 'Mary', 'Williams', 'cswdo.officer@koronadal.gov.ph', 'CSWDO'),
          (5, 'evaluator', 'password123', 'Evaluator', 'Edward', 'Davis', 'evaluator@koronadal.gov.ph', 'PESO');
        `);
        console.log('[MIGRATE] ✅ Default officer seed accounts inserted.');
      }
    } catch (err) {
      console.error('[MIGRATE] Notice seeding default officers:', err.message);
    }

    // Ensure default seed accounts exist in beneficiaries if table is empty
    try {
      const [benRows] = await connection.execute(`SELECT COUNT(*) AS cnt FROM beneficiaries`);
      if (benRows[0].cnt === 0) {
        console.log('[MIGRATE] Populating default beneficiary seed accounts...');
        await connection.execute(`
          INSERT IGNORE INTO beneficiaries (qr_code_id, id, username, password, role, first_name, last_name, email, phone, address, is_verified) VALUES
          ('BEN-seed-0006-juan-dela-cruz', 6, 'juan_dela_cruz', 'Test1234', 'Beneficiary', 'Juan', 'Dela Cruz', 'juan.delacruz@email.com', '0905-111-2222', 'Koronadal City', TRUE),
          ('BEN-seed-0007-maria-santos', 7, 'maria_santos', 'Sample5678', 'Beneficiary', 'Maria', 'Santos', 'maria.santos@email.com', '0906-333-4444', 'Koronadal City', TRUE),
          ('BEN-seed-0008-pedro-reyes', 8, 'pedro_reyes', 'DemoPass90', 'Beneficiary', 'Pedro', 'Reyes', 'pedro.reyes@email.com', '0907-555-6666', 'Koronadal City', TRUE);
        `);
        console.log('[MIGRATE] ✅ Default beneficiary seed accounts inserted.');
      }
    } catch (err) {
      console.error('[MIGRATE] Notice seeding default beneficiaries:', err.message);
    }

    console.log('[MIGRATE] ✅ Database auto-migration completed successfully.');
  } catch (globalErr) {
    console.error('[MIGRATE] Non-fatal database migration error:', globalErr.message);
  } finally {
    if (connection) connection.release();
  }
}

// Support CLI execution: `node backend/migrate.js`
if (require.main === module) {
  migrateDatabase().then(() => {
    pool.end();
  });
}

module.exports = { migrateDatabase };

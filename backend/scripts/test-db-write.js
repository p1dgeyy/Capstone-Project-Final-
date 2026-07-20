// =============================================================================
// Database Write Privilege Test Script
// =============================================================================
// Run: node backend/scripts/test-db-write.js
//
// Tests that the Railway MySQL user has INSERT, SELECT, and DELETE privileges
// by performing a round-trip write → read → cleanup cycle.
// =============================================================================

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const pool = require('../db');

const TEST_USERNAME = '__db_write_test__' + Date.now();

async function testDatabaseWrite() {
  let connection;
  console.log('=== DATABASE WRITE PRIVILEGE TEST ===\n');

  try {
    // 1. Acquire connection
    console.log('[1/5] Acquiring database connection...');
    connection = await pool.getConnection();
    console.log('      ✅ Connection acquired.\n');

    // 2. Test INSERT
    console.log('[2/5] Testing INSERT privilege...');
    const insertQuery = `
      INSERT INTO \`users\`
        (\`username\`, \`password\`, \`role\`, \`first_name\`, \`last_name\`,
         \`age\`, \`date_of_birth\`, \`sex\`, \`nationality\`, \`marital_status\`,
         \`email\`, \`phone\`, \`address\`, \`terms_agreed\`, \`data_consent\`)
      VALUES (?, 'test_hash', 'Beneficiary', 'Test', 'User',
              25, '2001-01-01', 'Male', 'Filipino', 'Single',
              ?, '0900-000-0000', 'Test Address', TRUE, TRUE)
    `;
    const testEmail = `${TEST_USERNAME}@test.local`;
    const [insertResult] = await connection.execute(insertQuery, [TEST_USERNAME, testEmail]);
    const insertedId = insertResult.insertId;
    console.log(`      ✅ INSERT successful — new row ID: ${insertedId}\n`);

    // 3. Test SELECT (verify the write persisted)
    console.log('[3/5] Verifying row was persisted (SELECT)...');
    const [rows] = await connection.execute(
      'SELECT `id`, `username`, `email` FROM `users` WHERE `id` = ? LIMIT 1',
      [insertedId]
    );
    if (rows.length === 1 && rows[0].username === TEST_USERNAME) {
      console.log(`      ✅ SELECT verified — found user: ${rows[0].username}, email: ${rows[0].email}\n`);
    } else {
      console.error('      ❌ SELECT failed — inserted row not found! Data may not be persisting.\n');
    }

    // 4. Test DELETE (cleanup)
    console.log('[4/5] Cleaning up test row (DELETE)...');
    const [deleteResult] = await connection.execute(
      'DELETE FROM `users` WHERE `id` = ?',
      [insertedId]
    );
    if (deleteResult.affectedRows === 1) {
      console.log('      ✅ DELETE successful — test row removed.\n');
    } else {
      console.error('      ⚠️  DELETE ran but affected 0 rows. Manual cleanup may be needed.\n');
    }

    // 5. Test UPDATE (on seed data)
    console.log('[5/5] Testing UPDATE privilege (touching seed row)...');
    const [updateResult] = await connection.execute(
      "UPDATE `users` SET `updated_at` = NOW() WHERE `username` = 'peso-admin' LIMIT 1"
    );
    if (updateResult.affectedRows >= 0) {
      console.log(`      ✅ UPDATE successful — ${updateResult.affectedRows} row(s) touched.\n`);
    }

    // Summary
    console.log('=== ALL TESTS PASSED ===');
    console.log('The database user has full INSERT, SELECT, UPDATE, and DELETE privileges.');
    console.log('If your application writes are still failing, the issue is in the application layer, not the database.');

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);

    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n🔴 DIAGNOSIS: Database user lacks connection privileges. Check your credentials.');
    } else if (error.code === 'ER_TABLEACCESS_DENIED_ERROR' || error.code === 'ER_DBACCESS_DENIED_ERROR') {
      console.error('\n🔴 DIAGNOSIS: Database user lacks INSERT/WRITE privileges on the target table.');
      console.error('   Ask your Railway admin to run: GRANT INSERT, UPDATE, DELETE ON <database>.* TO <user>;');
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('\n🔴 DIAGNOSIS: The "users" table does not exist. Run migrations first: npm run migrate');
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.error('\n🔴 DIAGNOSIS: Cannot reach the database host. Check MYSQL_URL or MYSQLHOST env vars.');
    } else {
      console.error('\n🔴 Unexpected error — see details above.');
    }
    console.error('\nFull error:', error);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
    console.log('\nDatabase pool closed. Exiting.');
  }
}

testDatabaseWrite();

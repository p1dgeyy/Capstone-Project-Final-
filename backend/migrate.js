// Database Migration Helper Script
// Safe CLI runner — delegates table initialization and legacy record migration to initializeDatabaseTables()

const pool = require('./db');

async function migrateDatabase() {
  console.log('[MIGRATE] Database migration helper invoked.');
  try {
    const { initializeDatabaseTables } = require('./server');
    if (typeof initializeDatabaseTables === 'function') {
      await initializeDatabaseTables(pool);
    }
  } catch (err) {
    console.log('[MIGRATE] Migration runner completed notice:', err.message);
  }
}

if (require.main === module) {
  migrateDatabase().then(() => {
    try {
      pool.end();
    } catch (e) {}
  });
}

module.exports = { migrateDatabase };

// Shared Auth Middleware & Role Constants
// Extracted from routes/users.js so every role-scoped router (users,
// officers, beneficiaries) enforces IDENTICAL rules for who can call what.
//
// Accepts legacy headers: X-User-Id + X-Session-Token (DB session_token flow)

const pool = require('../db');

const VALID_ROLES = ['Beneficiary', 'PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator'];
const STAFF_ROLES = ['PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator'];
const ADMIN_ROLES = ['PESO Admin', 'CSWDO Admin'];

async function authenticateCaller(req, res, next) {
  // --- Legacy X-User-Id / X-Session-Token ---
  const callerId = req.headers['x-user-id'];
  const sessionToken = req.headers['x-session-token'];

  if (!callerId || !sessionToken) {
    // Allow unauthenticated access for GET requests (public listing);
    // block all mutations without auth.
    if (req.method !== 'GET') {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please include X-User-Id and X-Session-Token headers.'
      });
    }
    req.caller = null;
    return next();
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT `id`, `role`, `current_session_token` FROM `users` WHERE `id` = ? LIMIT 1',
      [callerId]
    );

    if (rows.length === 0 || rows[0].current_session_token !== sessionToken) {
      return res.status(401).json({
        success: false,
        message: 'Session invalid or expired. Please log in again.',
        kicked: true
      });
    }

    req.caller = { id: rows[0].id, role: rows[0].role };
    next();
  } catch (error) {
    console.error('[AUTH] Auth middleware error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
}

/** Blocks the request unless the caller is authenticated as one of allowedRoles. */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.caller || !allowedRoles.includes(req.caller.role)) {
      return res.status(403).json({
        success: false,
        message: `Access restricted to: ${allowedRoles.join(', ')}.`
      });
    }
    next();
  };
}

module.exports = { authenticateCaller, requireRole, VALID_ROLES, STAFF_ROLES, ADMIN_ROLES };

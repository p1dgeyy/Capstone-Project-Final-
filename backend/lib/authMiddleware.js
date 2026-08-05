// Shared Auth Middleware & Role Constants
// Extracted from routes/users.js so every role-scoped router (users,
// officers, beneficiaries) enforces IDENTICAL rules for who can call what.
//
// Accepts EITHER:
//   - Legacy headers: X-User-Id + X-Session-Token (current DB session_token flow)
//   - Clerk session:  Authorization: Bearer <clerk-session-jwt>
// so routes work whether the caller has migrated to Clerk-issued sessions yet.

const pool = require('../db');
const { isClerkEnabled, clerkClient } = require('./clerk');
let verifyToken;
try {
  verifyToken = require('@clerk/backend').verifyToken;
} catch (e) {}

const VALID_ROLES = ['Beneficiary', 'PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator'];
const STAFF_ROLES = ['PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator'];
const ADMIN_ROLES = ['PESO Admin', 'CSWDO Admin'];

async function authenticateCaller(req, res, next) {
  const authHeader = req.headers['authorization'];

  // --- Path A: Clerk-issued session token ---
  if (authHeader && authHeader.startsWith('Bearer ') && isClerkEnabled()) {
    try {
      const token = authHeader.slice('Bearer '.length).trim();
      const claims = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
      const dbUserId = claims?.publicMetadata?.dbUserId || claims?.public_metadata?.dbUserId;
      const role = claims?.publicMetadata?.role || claims?.public_metadata?.role;
      if (dbUserId && role) {
        req.caller = { id: dbUserId, role };
        return next();
      }
      // Fall through to legacy headers if Clerk metadata isn't populated yet
    } catch (err) {
      console.warn('[AUTH] Clerk token verification failed, trying legacy session:', err.message);
    }
  }

  // --- Path B: Legacy X-User-Id / X-Session-Token ---
  const callerId = req.headers['x-user-id'];
  const sessionToken = req.headers['x-session-token'];

  if (!callerId || !sessionToken) {
    // Allow unauthenticated access for GET requests (public listing);
    // block all mutations without auth.
    if (req.method !== 'GET') {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please include X-User-Id and X-Session-Token headers, or a Clerk Bearer token.'
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

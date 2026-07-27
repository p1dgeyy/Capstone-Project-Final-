// Clerk Authentication Middleware & Session Helper
// Supports @clerk/express, @clerk/backend, and @clerk/clerk-sdk-node SDKs
// Validates Clerk JWT tokens from Authorization header (Bearer <jwt>)

require('dotenv').config();

let clerkClient = null;
let isClerkActive = false;

// Attempt SDK initialization
if (process.env.CLERK_SECRET_KEY) {
  try {
    try {
      const { createClerkClient } = require('@clerk/backend');
      clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    } catch (e1) {
      const { createClerkClient } = require('@clerk/clerk-sdk-node');
      clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    }
    isClerkActive = true;
    console.log('[CLERK] Clerk authentication middleware INITIALIZED successfully.');
  } catch (err) {
    console.warn('[CLERK] Failed to initialize Clerk SDK:', err.message);
    console.warn('[CLERK] Falling back to session-token authentication.');
  }
} else {
  console.log('[CLERK] No CLERK_SECRET_KEY set. Clerk middleware bypassed (session-token auth active).');
}

/**
 * Clerk middleware — validates JWT from Authorization header.
 */
async function clerkMiddleware(req, res, next) {
  if (!isClerkActive || !clerkClient) {
    return next();
  }

  // Skip health check & auth route bypasses
  if (req.path === '/api/health' || (req.path.startsWith('/api/auth/') && req.path !== '/api/auth/me' && req.path !== '/api/auth/clerk-sync')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    let verifiedToken = null;

    if (typeof clerkClient.verifyToken === 'function') {
      verifiedToken = await clerkClient.verifyToken(token);
    } else if (clerkClient.tokens && typeof clerkClient.tokens.verifyToken === 'function') {
      verifiedToken = await clerkClient.tokens.verifyToken(token);
    }

    if (verifiedToken) {
      req.clerkUserId = verifiedToken.sub;
      req.clerkSessionId = verifiedToken.sid;
      req.isClerkAuthenticated = true;
      req.caller = { id: verifiedToken.sub, clerkUserId: verifiedToken.sub };
      console.log(`[CLERK] Verified token for user: ${verifiedToken.sub}`);
    }
    next();
  } catch (err) {
    console.warn('[CLERK] Token verification failed:', err.message);
    return next();
  }
}

/**
 * Require Auth Middleware for protected endpoints
 */
async function requireClerkAuth(req, res, next) {
  if (req.isClerkAuthenticated && req.clerkUserId) {
    return next();
  }

  // Legacy header fallback (X-User-Id + X-Session-Token)
  const callerId = req.headers['x-user-id'];
  const sessionToken = req.headers['x-session-token'];

  if (callerId && sessionToken) {
    const pool = require('../db');
    let connection;
    try {
      connection = await pool.getConnection();
      const [rows] = await connection.execute(
        'SELECT `id`, `username`, `role`, `current_session_token` FROM `officers` WHERE `id` = ? LIMIT 1',
        [callerId]
      );
      if (rows.length > 0 && rows[0].current_session_token === sessionToken) {
        req.caller = { id: rows[0].id, username: rows[0].username, role: rows[0].role };
        return next();
      }
    } catch (err) {
      console.error('[CLERK AUTH] Legacy session check failed:', err.message);
    } finally {
      if (connection) connection.release();
    }
  }

  return res.status(401).json({
    success: false,
    message: 'Authentication required. Please log in or provide a valid Clerk token.'
  });
}

function isClerkEnabled() {
  return isClerkActive;
}

module.exports = {
  clerkMiddleware,
  requireClerkAuth,
  isClerkEnabled
};

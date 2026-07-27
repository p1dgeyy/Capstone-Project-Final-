// Clerk Authentication Middleware (Optional)
//
// Activates ONLY when CLERK_SECRET_KEY is set in environment variables.
// When active, validates Clerk JWT tokens from the Authorization header.
// When inactive (no key configured), all requests pass through — the existing
// session-token auth continues to work.
//
// Usage in server.js:
//   const { clerkMiddleware } = require('./middleware/clerk');
//   app.use(clerkMiddleware);

require('dotenv').config();

let clerkClient = null;
let isClerkActive = false;

// Initialize Clerk SDK if secret key is available
if (process.env.CLERK_SECRET_KEY) {
  try {
    const { createClerkClient } = require('@clerk/clerk-sdk-node');
    clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    isClerkActive = true;
    console.log('[CLERK] Clerk authentication middleware ACTIVE.');
  } catch (err) {
    console.warn('[CLERK] Failed to initialize Clerk SDK:', err.message);
    console.warn('[CLERK] Falling back to session-token authentication.');
  }
} else {
  console.log('[CLERK] No CLERK_SECRET_KEY found. Clerk middleware BYPASSED — using session-token auth.');
}

/**
 * Clerk middleware — validates JWT from Authorization header.
 * If Clerk is not configured, passes through silently.
 */
async function clerkMiddleware(req, res, next) {
  // Skip if Clerk is not active
  if (!isClerkActive || !clerkClient) {
    return next();
  }

  // Skip health check and public endpoints
  if (req.path === '/api/health') {
    return next();
  }

  // Skip auth endpoints (login, register, verify-otp, etc.) — these create sessions
  if (req.path.startsWith('/api/auth/')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No Clerk token — fall through to session-token auth
    return next();
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const verifiedToken = await clerkClient.verifyToken(token);

    // Attach Clerk user info to request
    req.clerkUserId = verifiedToken.sub;
    req.clerkSessionId = verifiedToken.sid;
    req.isClerkAuthenticated = true;

    console.log(`[CLERK] Token verified for Clerk user: ${verifiedToken.sub}`);
    next();
  } catch (err) {
    console.warn('[CLERK] Token verification failed:', err.message);
    // Don't block — fall through to session-token auth
    return next();
  }
}

/**
 * Check if Clerk is currently active
 */
function isClerkEnabled() {
  return isClerkActive;
}

module.exports = { clerkMiddleware, isClerkEnabled };

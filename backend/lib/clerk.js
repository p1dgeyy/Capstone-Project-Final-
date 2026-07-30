// Clerk Integration Helper
// Clerk owns: account authentication, the primary sign-up OTP flow, and
// session issuance/verification. Our own MySQL `users` table remains the
// source of truth for role isolation and domain data (applications, QR
// codes, etc.) and is linked to Clerk via `users.clerk_user_id`.
//
// Resend (see backend/lib/resend.js) is layered on top for the *custom
// branded* emails Clerk doesn't send out of the box: our own OTP fallback,
// the welcome email, and the QR code delivery.

const { createClerkClient, verifyToken } = require('@clerk/backend');

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY;

let clerkClient = null;
if (CLERK_SECRET_KEY) {
  clerkClient = createClerkClient({ secretKey: CLERK_SECRET_KEY, publishableKey: CLERK_PUBLISHABLE_KEY });
} else {
  console.warn('[CLERK] CLERK_SECRET_KEY is not set — Clerk account creation/session verification is disabled. Falling back to the legacy username/password + session-token flow only.');
}

const isClerkEnabled = () => !!clerkClient;

/**
 * Creates a Clerk user during registration. Role and our internal DB user id
 * are stamped onto Clerk's publicMetadata so Clerk-issued session tokens can
 * carry role information for downstream authorization checks.
 */
async function createClerkUser({ email, password, firstName, lastName, role }) {
  if (!clerkClient) return null;
  try {
    const user = await clerkClient.users.createUser({
      emailAddress: [email],
      password,
      firstName,
      lastName,
      publicMetadata: { role }
    });
    console.log(`[CLERK] Created Clerk user ${user.id} for ${email} (role: ${role})`);
    return user;
  } catch (err) {
    // Clerk enforces its own password/email rules — surface a clean message
    const message = err?.errors?.[0]?.longMessage || err.message;
    console.error('[CLERK] createUser failed:', message);
    throw new Error(message);
  }
}

/**
 * Once our own DB row gets its auto-increment id, mirror it onto the Clerk
 * user so a Clerk session token can be mapped straight back to the MySQL row
 * without an extra lookup-by-email query.
 */
async function linkClerkUserToDbId(clerkUserId, dbUserId, role) {
  if (!clerkClient || !clerkUserId) return;
  try {
    await clerkClient.users.updateUserMetadata(clerkUserId, {
      publicMetadata: { role, dbUserId }
    });
  } catch (err) {
    console.error('[CLERK] Failed to link Clerk user metadata:', err.message);
  }
}

async function setClerkUserVerified(clerkUserId, verified) {
  if (!clerkClient || !clerkUserId) return;
  try {
    await clerkClient.users.updateUserMetadata(clerkUserId, {
      publicMetadata: { isVerified: verified }
    });
  } catch (err) {
    console.error('[CLERK] Failed to update verification metadata:', err.message);
  }
}

async function deleteClerkUser(clerkUserId) {
  if (!clerkClient || !clerkUserId) return;
  try {
    await clerkClient.users.deleteUser(clerkUserId);
  } catch (err) {
    console.error('[CLERK] Failed to delete Clerk user (cleanup):', err.message);
  }
}

/**
 * Express middleware: verifies a Clerk session JWT sent as
 * `Authorization: Bearer <token>`. Used as an alternative to the legacy
 * X-User-Id / X-Session-Token headers so routes can accept either during
 * the migration to Clerk-managed sessions.
 */
function clerkAuthMiddleware() {
  return async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ') || !clerkClient) {
      return next(); // fall through to legacy header-based auth
    }

    const token = authHeader.slice('Bearer '.length).trim();
    try {
      const claims = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
      req.clerkClaims = claims;
      req.clerkUserId = claims.sub;
    } catch (err) {
      console.warn('[CLERK] Session token verification failed:', err.message);
      // Don't hard-fail here — let the route's own auth logic decide,
      // since the caller may still be using a legacy session token.
    }
    next();
  };
}

module.exports = {
  clerkClient,
  isClerkEnabled,
  createClerkUser,
  linkClerkUserToDbId,
  setClerkUserVerified,
  deleteClerkUser,
  clerkAuthMiddleware
};

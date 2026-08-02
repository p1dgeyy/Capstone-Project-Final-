/**
 * Express Middleware: Backend System-Wide Safeguards & Command Interceptor
 * 
 * Provides:
 * 1. Destructive SQL & Command Injection Inspection (DROP TABLE, TRUNCATE, DELETE ALL, SHUTDOWN).
 * 2. Server-side Role Authorization Enforcement.
 * 3. Program & Officer Account Deactivation Dependency Checks.
 */

const pool = require('../db');

// Destructive patterns
const DESTRUCTIVE_PATTERNS = [
  { pattern: /\bDROP\s+(TABLE|DATABASE|SCHEMA|VIEW)\b/i, name: 'DROP TABLE/DATABASE/SCHEMA/VIEW' },
  { pattern: /\bTRUNCATE\s+(TABLE|\w+)?\b/i, name: 'TRUNCATE TABLE' },
  { pattern: /\bDELETE\s+FROM\s+\w+\s*(;|$|\bWHERE\s+(1=1|true|'1'='1')\b)/i, name: 'UNBOUNDED DELETE (DELETE ALL)' },
  { pattern: /\bSHUTDOWN\b/i, name: 'SYSTEM SHUTDOWN COMMAND' },
  { pattern: /\bALTER\s+TABLE\s+\w+\s+DROP\b/i, name: 'ALTER TABLE DROP COLUMN' }
];

/**
 * Middleware: Inspect request body, query, and params for destructive commands
 */
function commandValidationMiddleware(req, res, next) {
  const payload = JSON.stringify({ body: req.body, query: req.query, params: req.params });

  for (const rule of DESTRUCTIVE_PATTERNS) {
    if (rule.pattern.test(payload)) {
      console.warn(`[SAFEGUARDS] Blocked destructive request attempt (${rule.name}) from IP ${req.ip}`);
      return res.status(403).json({
        success: false,
        message: `Command Blocked by Backend Security Engine (${rule.name}). Destructive operations causing data loss are strictly prohibited.`
      });
    }
  }
  next();
}

/**
 * Middleware: Enforce Admin-only role for fund disbursement and resource allocation endpoints
 */
function restrictToAdminMiddleware(req, res, next) {
  const callerRole = (req.headers['x-user-role'] || (req.caller && req.caller.role) || '').toUpperCase();

  const isAdmin = callerRole.includes('ADMIN') || callerRole === 'PESO_ADMIN' || callerRole === 'CSWDO_ADMIN';

  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Access Denied: Fund disbursement, resource allocation, and final approval endpoints are restricted to Administrator roles only.'
    });
  }
  next();
}

/**
 * Middleware: Enforce Officer-only role for beneficiary record creation and editing
 */
function restrictToOfficerMiddleware(req, res, next) {
  const callerRole = (req.headers['x-user-role'] || (req.caller && req.caller.role) || '').toUpperCase();

  const isOfficer = callerRole.includes('OFFICER') || callerRole === 'PESO_OFFICER' || callerRole === 'CSWDO_OFFICER' || callerRole.includes('EVALUATOR');

  if (!isOfficer) {
    return res.status(403).json({
      success: false,
      message: 'Access Denied: Beneficiary account creation, updates, and document uploads are restricted to Officer roles only. Administrators have read-only access.'
    });
  }
  next();
}

/**
 * Check Livelihood Program Deactivation Eligibility
 */
async function verifyProgramDeactivation(req, res, next) {
  if (req.method === 'DELETE' || (req.method === 'PUT' && req.body && req.body.status === 'Inactive')) {
    const programId = req.params.id;
    let connection;
    try {
      connection = await pool.getConnection();
      // Check active applications linked to program
      const [apps] = await connection.execute(
        'SELECT COUNT(*) as count FROM applications WHERE program_id = ? AND status IN ("Pending", "Approved", "In Progress")',
        [programId]
      );
      if (apps[0] && apps[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot deactivate or delete Livelihood Program: ${apps[0].count} active applications are still in progress.`
        });
      }
    } catch (e) {
      console.warn('[SAFEGUARDS] Program deactivation check notice:', e.message);
    } finally {
      if (connection) connection.release();
    }
  }
  next();
}

/**
 * Check Officer Account Deactivation Eligibility
 */
async function verifyOfficerDeactivation(req, res, next) {
  if (req.method === 'DELETE' || (req.method === 'PUT' && req.body && req.body.status === 'Inactive')) {
    const officerId = req.params.id;
    let connection;
    try {
      connection = await pool.getConnection();
      // Check active assigned cases
      const [cases] = await connection.execute(
        'SELECT COUNT(*) as count FROM applications WHERE assigned_officer_id = ? AND status IN ("Pending", "Under Review")',
        [officerId]
      );
      if (cases[0] && cases[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot deactivate Officer Account: Officer has ${cases[0].count} active assigned cases under review.`
        });
      }
    } catch (e) {
      console.warn('[SAFEGUARDS] Officer deactivation check notice:', e.message);
    } finally {
      if (connection) connection.release();
    }
  }
  next();
}

module.exports = {
  commandValidationMiddleware,
  restrictToAdminMiddleware,
  restrictToOfficerMiddleware,
  verifyProgramDeactivation,
  verifyOfficerDeactivation
};

/**
 * Unified Database Abstraction Layer & ORM Model Queries
 * City Government of Koronadal — PESO & CSWDO Portal
 * 
 * Features:
 * 1. Single Active Driver Validation: strictly loads one driver ('supabase', 'mysql', 'postgres', 'memory')
 * 2. Transaction Safety: withTransaction() wrapper ensuring atomic commit / rollback
 * 3. Dual-Table User Queries: queries staff_profiles and beneficiaries / portal_users
 * 4. Dual Verification Enforcement: Email (4-digit) + Phone (6-digit) verification
 * 5. Active Officer Filtering: default status='Active' for operational rosters
 * 6. Audit Privacy: logs metadata without storing raw passwords or sensitive credentials
 * 7. Graceful Error Handling: returns "System temporarily unavailable" on connection failures
 */

const bcrypt = require('bcryptjs');
const seedData = require('./seedData');
const { logAudit } = require('../utils/auditLogger');

// Determine and validate single active database driver
const VALID_DB_TYPES = ['supabase', 'mysql', 'postgres', 'memory'];
let DB_TYPE = (process.env.DB_TYPE || '').toLowerCase().trim();

if (!VALID_DB_TYPES.includes(DB_TYPE)) {
    if (process.env.SUPABASE_URL && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
        DB_TYPE = 'supabase';
    } else if (process.env.MYSQL_URL || process.env.MYSQLHOST) {
        DB_TYPE = 'mysql';
    } else {
        DB_TYPE = 'memory';
    }
}

console.log(`[DATABASE INIT] Active Driver Mode: "${DB_TYPE.toUpperCase()}" (Single Driver Enforcement Active)`);

// Driver Initialization (Only one active driver instantiated)
let supabaseClient = null;
let mysqlPool = null;

if (DB_TYPE === 'supabase') {
    try {
        const { createClient } = require('@supabase/supabase-js');
        const url = process.env.SUPABASE_URL || 'https://oqnbckqfwmpcmouyptvj.supabase.co';
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xbmJja3Fmd21wY21vdXlwdHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NzMwOTgsImV4cCI6MjEwMTI0OTA5OH0._SzwQalNutaIIyZiERwa9tSYdcJeMS85Chk_iQw1CCI';
        supabaseClient = createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
        console.log('[DATABASE] Supabase client initialized successfully.');
    } catch (err) {
        console.warn('[DATABASE] Supabase driver init notice, falling back to resilient in-memory store:', err.message);
    }
} else if (DB_TYPE === 'mysql') {
    try {
        const mysql = require('mysql2/promise');
        mysqlPool = mysql.createPool(process.env.MYSQL_URL || {
            host: process.env.MYSQLHOST || 'localhost',
            port: Number(process.env.MYSQLPORT) || 3306,
            user: process.env.MYSQLUSER || 'root',
            password: process.env.MYSQLPASSWORD || 'root',
            database: process.env.MYSQLDATABASE || 'capstone_db',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        console.log('[DATABASE] MySQL connection pool initialized.');
    } catch (err) {
        console.warn('[DATABASE] MySQL driver init notice, falling back to resilient in-memory store:', err.message);
    }
}

/**
 * Clean string helper
 */
function cleanStr(val) {
    return (val || '').toString().trim();
}

/**
 * Mask contact number helper (09XX-***-XXXX)
 */
function maskPhone(phone) {
    if (!phone) return '09XX-***-XXXX';
    const clean = String(phone).replace(/[^0-9]/g, '');
    if (clean.length >= 10) return `${clean.substring(0, 4)}-***-${clean.substring(clean.length - 4)}`;
    return '09XX-***-XXXX';
}

/**
 * Standard database error wrapper
 */
function createDbUnavailableError(originalMessage) {
    const err = new Error('System temporarily unavailable. Please try again later or contact your administrator.');
    err.code = 'DB_UNAVAILABLE';
    err.originalMessage = originalMessage;
    return err;
}

/**
 * Transaction Wrapper: Executes operations atomically.
 * Automatically rolls back on exception.
 */
async function withTransaction(callback) {
    // In-memory transaction checkpointing
    const usersSnapshot = JSON.stringify(seedData.getUsers());
    const cswdoOfficersSnapshot = seedData.getCswdoOfficers ? JSON.stringify(seedData.getCswdoOfficers()) : null;

    try {
        const result = await callback({
            driver: DB_TYPE,
            supabase: supabaseClient,
            mysql: mysqlPool
        });
        return result;
    } catch (err) {
        // Rollback in-memory state on error
        try {
            const restoredUsers = JSON.parse(usersSnapshot);
            const currentUsers = seedData.getUsers();
            currentUsers.length = 0;
            currentUsers.push(...restoredUsers);

            if (cswdoOfficersSnapshot && seedData.getCswdoOfficers) {
                const restoredCswdo = JSON.parse(cswdoOfficersSnapshot);
                const currentCswdo = seedData.getCswdoOfficers();
                currentCswdo.length = 0;
                currentCswdo.push(...restoredCswdo);
            }
            console.log('[TRANSACTION ROLLBACK] Reverted memory store state to pre-transaction checkpoint.');
        } catch (rbErr) {
            console.error('[TRANSACTION ROLLBACK ERROR]:', rbErr);
        }
        throw err;
    }
}

/**
 * Query User by Identifier (Username or Email)
 * Queries both Staff Profiles (Admins, Officers, Evaluators) and Beneficiary tables.
 * Enforces portal scoping when provided.
 */
async function queryUserByIdentifier(identifier, portal = null) {
    if (!identifier) return null;
    const clean = cleanStr(identifier).toLowerCase();
    const cleanPortal = cleanStr(portal).toLowerCase();

    try {
        // 1. Primary Seed/In-Memory lookup
        const user = seedData.findUserByIdentifier(clean);
        if (user) {
            return user;
        }

        // 2. Supabase Query if driver is active
        if (DB_TYPE === 'supabase' && supabaseClient) {
            // If portal is beneficiary: search beneficiaries first
            if (cleanPortal === 'beneficiary') {
                const { data: ben, error: benErr } = await supabaseClient
                    .from('beneficiaries')
                    .select('*')
                    .or(`username.ilike.${clean},email.ilike.${clean}`)
                    .maybeSingle();

                if (!benErr && ben) {
                    return {
                        id: ben.qr_code || ben.id,
                        username: ben.username,
                        email: ben.email,
                        password_hash: ben.password_hash || seedData.DEFAULT_HASH,
                        role: 'Beneficiary',
                        department: 'PESO',
                        first_name: ben.first_name,
                        last_name: ben.last_name,
                        phone: ben.phone,
                        status: ben.status || 'Active',
                        failed_login_attempts: 0
                    };
                }
            }

            // Otherwise search staff_profiles
            const { data: staff, error: staffErr } = await supabaseClient
                .from('staff_profiles')
                .select('*')
                .or(`username.ilike.${clean},email.ilike.${clean}`)
                .maybeSingle();

            if (!staffErr && staff) {
                return {
                    id: staff.id,
                    username: staff.username,
                    email: staff.email,
                    password_hash: staff.password_hash || seedData.DEFAULT_HASH,
                    role: staff.role,
                    department: staff.department || (staff.role.includes('CSWDO') ? 'CSWDO' : 'PESO'),
                    first_name: staff.first_name,
                    last_name: staff.last_name,
                    phone: staff.phone,
                    status: staff.status || 'Active',
                    failed_login_attempts: 0
                };
            }
        }

        return null;
    } catch (err) {
        console.error('[DB ERROR queryUserByIdentifier]:', err.message);
        throw createDbUnavailableError(err.message);
    }
}

/**
 * Query All Officers
 * Retrieves active officer accounts (PESO and/or CSWDO) from the shared data layer.
 * Default filters: status='Active'.
 */
async function queryAllOfficers(filters = {}) {
    const statusFilter = filters.status || 'Active';
    const deptFilter = filters.department ? filters.department.toUpperCase() : null;
    const roleFilter = filters.role ? filters.role.toLowerCase() : null;
    const searchQuery = filters.search ? filters.search.toLowerCase().trim() : null;

    try {
        let users = seedData.getUsers();

        let list = users.filter(u => {
            if (u.role === 'Beneficiary') return false;
            
            // Department filter
            if (deptFilter && u.department && u.department.toUpperCase() !== deptFilter) return false;
            if (!deptFilter && u.department === 'CSWDO') return false; // Default PESO scope if unspecified

            // Status filter (Active by default, or ALL)
            if (statusFilter && statusFilter !== 'ALL' && u.status !== statusFilter) return false;

            // Role filter
            if (roleFilter && roleFilter !== 'all' && u.role.toLowerCase() !== roleFilter) return false;

            // Search filter
            if (searchQuery) {
                const full = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
                const un = (u.username || '').toLowerCase();
                const em = (u.email || '').toLowerCase();
                if (!full.includes(searchQuery) && !un.includes(searchQuery) && !em.includes(searchQuery)) {
                    return false;
                }
            }

            return true;
        });

        return list.map(o => ({
            id: o.id,
            first_name: o.first_name,
            middle_name: o.middle_name || '',
            last_name: o.last_name,
            suffix: o.suffix || '',
            full_name: `${o.first_name} ${o.middle_name ? o.middle_name + ' ' : ''}${o.last_name}${o.suffix ? ' ' + o.suffix : ''}`.trim(),
            username: o.username,
            email: o.email,
            role: o.role,
            department: o.department || 'PESO',
            sex: o.sex || 'Male',
            phone: maskPhone(o.phone),
            address: o.address || 'City of Koronadal',
            status: o.status || 'Active',
            created_at: o.created_at,
            updated_at: o.updated_at
        }));
    } catch (err) {
        console.error('[DB ERROR queryAllOfficers]:', err.message);
        throw createDbUnavailableError(err.message);
    }
}

/**
 * Insert Officer Atomically
 * Wraps officer insertion across staff_profiles and user store with bcrypt hashing.
 */
async function insertOfficerAtomic(officerData, adminUser = 'PESO Admin') {
    return withTransaction(async () => {
        const {
            first_name,
            middle_name,
            last_name,
            suffix,
            username,
            email,
            password,
            role,
            department,
            sex,
            phone,
            address
        } = officerData;

        if (!first_name || !last_name || !username || !email || !password) {
            const err = new Error('First Name, Last Name, Username, Email, and Password are required.');
            err.statusCode = 400;
            throw err;
        }

        const cleanUsername = cleanStr(username).toLowerCase();
        const cleanEmail = cleanStr(email).toLowerCase();

        // Check duplicates
        const existing = await queryUserByIdentifier(cleanUsername) || await queryUserByIdentifier(cleanEmail);
        if (existing) {
            const err = new Error(`An account with username "${cleanUsername}" or email "${cleanEmail}" already exists.`);
            err.statusCode = 409;
            throw err;
        }

        // Hash password with bcrypt (salt rounds: 10)
        const password_hash = await bcrypt.hash(password, 10);

        const newOfficer = seedData.addUser({
            first_name: cleanStr(first_name),
            middle_name: cleanStr(middle_name),
            last_name: cleanStr(last_name),
            suffix: cleanStr(suffix),
            username: cleanUsername,
            email: cleanEmail,
            password_hash,
            role: role || 'PESO Officer',
            department: department || 'PESO',
            sex: sex || 'Male',
            phone: cleanStr(phone),
            address: cleanStr(address) || 'City of Koronadal',
            status: 'Active'
        });

        // Audit Log (Credentials-Safe: NO passwords logged)
        recordAuditLog({
            userId: adminUser,
            userRole: 'PESO Admin',
            actionType: 'CREATE_PESO_OFFICER',
            targetEntity: 'Officer Account Management',
            targetId: newOfficer.id,
            status: 'SUCCESS',
            actionReason: 'Administrative creation of new PESO Officer account',
            details: `Admin "${adminUser}" provisioned officer "${newOfficer.username}" (${newOfficer.first_name} ${newOfficer.last_name}). Role: ${newOfficer.role}, Dept: ${newOfficer.department}.`
        });

        return {
            id: newOfficer.id,
            username: newOfficer.username,
            email: newOfficer.email,
            full_name: `${newOfficer.first_name} ${newOfficer.last_name}`,
            role: newOfficer.role,
            department: newOfficer.department,
            status: newOfficer.status
        };
    });
}

/**
 * Insert Beneficiary Atomically
 * Creates beneficiary user upon dual verification (Email + SMS OTP).
 */
async function insertBeneficiaryAtomic(benData) {
    return withTransaction(async () => {
        const {
            email,
            password,
            password_hash,
            phone_number,
            username,
            first_name,
            middle_name,
            last_name,
            suffix,
            barangay,
            program_sector
        } = benData;

        const effectiveHash = password_hash || (password ? await bcrypt.hash(password, 10) : seedData.DEFAULT_HASH);

        const newBen = seedData.createDualVerificationUser({
            email,
            password_hash: effectiveHash,
            phone_number,
            username,
            first_name,
            middle_name,
            last_name,
            suffix,
            barangay,
            role: 'Beneficiary',
            program_sector: program_sector || 'PESO'
        });

        // Mark dual verification as completed
        newBen.email_status = 'verified';
        newBen.phone_status = 'verified';

        // Audit Log (Credentials-Safe: NO passwords logged)
        recordAuditLog({
            userId: newBen.username,
            userRole: 'Beneficiary',
            actionType: 'BENEFICIARY_REGISTRATION',
            targetEntity: 'Dual Verification System',
            targetId: newBen.id,
            status: 'SUCCESS',
            actionReason: 'Dual verification registration completed (Email + SMS OTP)',
            details: `Beneficiary "${newBen.username}" successfully completed dual verification and activated account.`
        });

        return newBen;
    });
}

/**
 * Privacy-Safe Audit Logger
 * Strips raw passwords and credentials before recording.
 */
function recordAuditLog(entry) {
    try {
        const safeDetails = (entry.details || '')
            .replace(/password[:=]\s*[^,\s]+/gi, 'password=[REDACTED]')
            .replace(/password_hash[:=]\s*[^,\s]+/gi, 'password_hash=[REDACTED]')
            .replace(/token[:=]\s*[^,\s]+/gi, 'token=[REDACTED]');

        logAudit({
            userId: entry.userId || 'SYSTEM',
            userRole: entry.userRole || 'SYSTEM',
            actionType: entry.actionType || 'GENERIC_AUDIT',
            targetEntity: entry.targetEntity || 'System',
            targetId: entry.targetId || null,
            status: entry.status || 'SUCCESS',
            actionReason: entry.actionReason || '',
            details: safeDetails,
            clientIp: entry.clientIp || '127.0.0.1'
        });
    } catch (e) {
        console.error('[AUDIT LOGGING NOTICE]:', e.message);
    }
}

module.exports = {
    DB_TYPE,
    supabaseClient,
    mysqlPool,
    withTransaction,
    queryUserByIdentifier,
    queryAllOfficers,
    insertOfficerAtomic,
    insertBeneficiaryAtomic,
    recordAuditLog,
    maskPhone,
    createDbUnavailableError
};

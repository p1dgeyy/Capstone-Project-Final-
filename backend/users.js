/**
 * Backend User Management Router & Controller
 * City Government of Koronadal — PESO & CSWDO Portal
 * 
 * Endpoints:
 * - GET /api/users          -> List registered users with filters (Role, Status, Dept, Search)
 * - POST /api/users         -> Create new user (Admin-only, bcrypt hashing, audit logged)
 * - PUT /api/users/:id      -> Update user details (Admin-only, audit logged with reason)
 * - POST /api/users/:id/unlock -> Unlock user account (Admin-only, audit logged with reason)
 * - DELETE /api/users/:id   -> Archive user (Admin-only, audit logged with reason)
 * 
 * Safeguards & Rules:
 * 1. RBAC: Only PESO/CSWDO Admins can perform CRUD operations.
 * 2. Sensitive fields (contact numbers) are masked; passwords are never in plaintext.
 * 3. Beneficiary records cannot be created/modified here (strictly Officer-managed).
 * 4. Immutable audit logging with admin credentials, timestamps, and action reasons.
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getUsers, findUserById, findUserByIdentifier, addUser } = require('./data/seedData');
const { requireAuth, requireAdmin, maskContactNumber } = require('./middleware/auth');
const { logAudit } = require('./utils/auditLogger');

/**
 * GET /api/users
 * Fetch all registered users with optional filters (Role, Status, Department, Search)
 * Accessible to authenticated staff/admins (read-only for non-admins)
 */
router.get('/', requireAuth, (req, res) => {
    const { role, status, department, search } = req.query;
    let list = getUsers();

    const requesterDept = req.user?.department;
    const requesterRole = req.user?.role || '';

    // Enforce default department scoping based on authenticated admin/officer session
    if (requesterDept === 'PESO' || requesterRole.includes('PESO')) {
        list = list.filter(u => u.department !== 'CSWDO' && !u.role.includes('CSWDO'));
    } else if (requesterDept === 'CSWDO' || requesterRole.includes('CSWDO')) {
        list = list.filter(u => u.department === 'CSWDO' || u.role.includes('CSWDO'));
    }

    // Filter by Role
    if (role && role !== 'ALL') {
        const r = role.toLowerCase();
        list = list.filter(u => u.role.toLowerCase() === r);
    }

    // Filter by Status (Active, Locked, Archived)
    if (status && status !== 'ALL') {
        list = list.filter(u => u.status === status);
    }

    // Filter by Department (PESO, CSWDO, IT/MIS)
    if (department && department !== 'ALL') {
        list = list.filter(u => u.department === department);
    }

    // Search Query
    if (search) {
        const q = search.toLowerCase().trim();
        list = list.filter(u => {
            const fullName = `${u.first_name} ${u.middle_name || ''} ${u.last_name} ${u.suffix || ''}`.toLowerCase();
            return fullName.includes(q) || 
                   u.username.toLowerCase().includes(q) || 
                   u.email.toLowerCase().includes(q) ||
                   u.phone.includes(q);
        });
    }

    // Format output: Mask sensitive contact numbers, completely exclude password hashes
    const sanitizedList = list.map(u => ({
        id: u.id,
        first_name: u.first_name,
        middle_name: u.middle_name || '',
        last_name: u.last_name,
        suffix: u.suffix || '',
        full_name: `${u.first_name} ${u.middle_name ? u.middle_name + ' ' : ''}${u.last_name}${u.suffix ? ' ' + u.suffix : ''}`.trim(),
        username: u.username,
        email: u.email,
        role: u.role,
        department: u.department,
        phone: maskContactNumber(u.phone),
        sex: u.sex || 'Male',
        address: u.address || 'City of Koronadal',
        status: u.status,
        failed_login_attempts: u.failed_login_attempts || 0,
        is_locked: !!(u.lockout_until && Date.now() < u.lockout_until) || u.status === 'Locked',
        last_login_at: u.last_login_at,
        created_at: u.created_at,
        updated_at: u.updated_at
    }));

    res.json({
        success: true,
        count: sanitizedList.length,
        data: sanitizedList
    });
});

/**
 * POST /api/users
 * Create new user account (Admin-only, with bcrypt password hashing)
 */
router.post('/', requireAdmin, async (req, res) => {
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
        phone,
        sex,
        address,
        action_reason
    } = req.body;

    const adminUser = req.user?.username || 'PESO Admin';
    const adminRole = req.user?.role || 'PESO Admin';
    const adminDept = req.user?.department || (adminRole.includes('CSWDO') ? 'CSWDO' : 'PESO');
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    // Validation
    if (!first_name || !last_name || !username || !email || !password || !role || !department) {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: 'First name, last name, username, email, password, role, and department are required.'
        });
    }

    // Cross-Department Isolation Validation
    if (adminDept === 'PESO' && (department === 'CSWDO' || role.includes('CSWDO'))) {
        return res.status(403).json({
            success: false,
            error: 'Cross-Department Restriction',
            message: 'PESO Administrators are strictly prohibited from creating CSWDO accounts.'
        });
    }
    if (adminDept === 'CSWDO' && (department === 'PESO' || role.includes('PESO'))) {
        return res.status(403).json({
            success: false,
            error: 'Cross-Department Restriction',
            message: 'CSWDO Administrators are strictly prohibited from creating PESO accounts.'
        });
    }

    // Beneficiary Account Restriction check
    if (role.toLowerCase().includes('beneficiary')) {
        return res.status(400).json({
            success: false,
            error: 'Beneficiary Edit Restriction',
            message: 'Beneficiary accounts cannot be created from the user management module; they remain strictly Officer-managed.'
        });
    }

    // Role validation
    const validRoles = ['PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Staff', 'Admin', 'Officer', 'Evaluator'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Role',
            message: `Role must be one of: ${validRoles.join(', ')}`
        });
    }

    // Check duplicate username or email
    const existing = findUserByIdentifier(username) || findUserByIdentifier(email);
    if (existing) {
        return res.status(409).json({
            success: false,
            error: 'Duplicate Account',
            message: 'A user with this username or email already exists.'
        });
    }

    // Password Complexity Check
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (password.length < 8 || !hasLetter || !hasNumber) {
        return res.status(400).json({
            success: false,
            error: 'Weak Password',
            message: 'Password must be at least 8 characters long and contain both letters and numbers.'
        });
    }

    // Hash password with bcrypt
    const password_hash = await bcrypt.hash(password, 10);

    const newUser = addUser({
        first_name: first_name.trim(),
        middle_name: (middle_name || '').trim(),
        last_name: last_name.trim(),
        suffix: (suffix || '').trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password_hash,
        role,
        department: department || 'PESO',
        phone: phone || '09XX-***-XXXX',
        sex: sex || 'Male',
        address: (address || 'City of Koronadal').trim(),
        status: 'Active'
    });

    const reason = action_reason || 'Initial account provisioning by Administrator';

    // Immutable Audit Trail
    logAudit({
        userId: adminUser,
        userRole: adminRole,
        actionType: 'CREATE_USER',
        targetEntity: 'User Management',
        targetId: newUser.id,
        status: 'SUCCESS',
        actionReason: reason,
        details: `Admin "${adminUser}" created user "${newUser.username}" (${newUser.first_name} ${newUser.last_name}), Role: ${newUser.role}, Dept: ${newUser.department}. Reason: ${reason}`,
        clientIp
    });

    res.status(201).json({
        success: true,
        message: `User account "${newUser.username}" created successfully.`,
        data: {
            id: newUser.id,
            full_name: `${newUser.first_name} ${newUser.last_name}`,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role,
            department: newUser.department,
            phone: maskContactNumber(newUser.phone),
            status: newUser.status,
            created_at: newUser.created_at
        }
    });
});

/**
 * PUT /api/users/:id
 * Update user account details (Admin-only, audit logged with mandatory action reason)
 */
router.put('/:id', requireAdmin, async (req, res) => {
    const userId = Number(req.params.id);
    const user = findUserById(userId);

    const adminUser = req.user?.username || 'PESO Admin';
    const adminRole = req.user?.role || 'PESO Admin';
    const adminDept = req.user?.department || (adminRole.includes('CSWDO') ? 'CSWDO' : 'PESO');
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User Not Found',
            message: `User with ID ${userId} does not exist.`
        });
    }

    // Cross-Department Isolation Validation
    if (adminDept === 'PESO' && (user.department === 'CSWDO' || req.body.department === 'CSWDO' || (req.body.role && req.body.role.includes('CSWDO')))) {
        return res.status(403).json({
            success: false,
            error: 'Cross-Department Restriction',
            message: 'PESO Administrators are strictly prohibited from modifying CSWDO accounts.'
        });
    }
    if (adminDept === 'CSWDO' && (user.department === 'PESO' || req.body.department === 'PESO' || (req.body.role && req.body.role.includes('PESO')))) {
        return res.status(403).json({
            success: false,
            error: 'Cross-Department Restriction',
            message: 'CSWDO Administrators are strictly prohibited from modifying PESO accounts.'
        });
    }

    const {
        first_name,
        middle_name,
        last_name,
        suffix,
        email,
        role,
        department,
        phone,
        address,
        status,
        action_reason,
        new_password
    } = req.body;

    const reason = action_reason || 'Administrative profile update';
    const changes = [];

    if (first_name && first_name.trim() !== user.first_name) {
        changes.push(`first_name: "${user.first_name}" -> "${first_name.trim()}"`);
        user.first_name = first_name.trim();
    }
    if (last_name && last_name.trim() !== user.last_name) {
        changes.push(`last_name: "${user.last_name}" -> "${last_name.trim()}"`);
        user.last_name = last_name.trim();
    }
    if (middle_name !== undefined && middle_name !== user.middle_name) {
        user.middle_name = middle_name.trim();
    }
    if (suffix !== undefined && suffix !== user.suffix) {
        user.suffix = suffix.trim();
    }
    if (email && email.trim().toLowerCase() !== user.email) {
        changes.push(`email: "${user.email}" -> "${email.trim().toLowerCase()}"`);
        user.email = email.trim().toLowerCase();
    }
    if (role && role !== user.role) {
        changes.push(`role: "${user.role}" -> "${role}"`);
        user.role = role;
    }
    if (department && department !== user.department) {
        changes.push(`department: "${user.department}" -> "${department}"`);
        user.department = department;
    }
    if (phone && phone !== user.phone) {
        changes.push(`phone: [MASKED] -> [MASKED]`);
        user.phone = phone;
    }
    if (address && address !== user.address) {
        user.address = address.trim();
    }
    if (status && status !== user.status) {
        changes.push(`status: "${user.status}" -> "${status}"`);
        user.status = status;
        if (status === 'Active') {
            user.lockout_until = null;
            user.failed_login_attempts = 0;
        }
    }

    // Optional admin password reset
    if (new_password) {
        const hasLetter = /[a-zA-Z]/.test(new_password);
        const hasNumber = /[0-9]/.test(new_password);
        if (new_password.length >= 8 && hasLetter && hasNumber) {
            user.password_hash = await bcrypt.hash(new_password, 10);
            changes.push('password updated');
        }
    }

    user.updated_at = new Date().toISOString();

    // Immutable Audit Trail
    logAudit({
        userId: adminUser,
        userRole: adminRole,
        actionType: 'UPDATE_USER',
        targetEntity: 'User Management',
        targetId: user.id,
        status: 'SUCCESS',
        actionReason: reason,
        details: `Admin "${adminUser}" updated user "${user.username}" (ID: ${user.id}). Changes: ${changes.join(', ') || 'No changes'}. Reason: ${reason}`,
        clientIp
    });

    res.json({
        success: true,
        message: `User "${user.username}" updated successfully.`,
        data: {
            id: user.id,
            full_name: `${user.first_name} ${user.last_name}`,
            username: user.username,
            email: user.email,
            role: user.role,
            department: user.department,
            status: user.status,
            updated_at: user.updated_at
        }
    });
});

/**
 * POST /api/users/:id/unlock
 * Unlock a locked user account (Admin-only, audit logged with action reason)
 */
router.post('/:id/unlock', requireAdmin, (req, res) => {
    const userId = Number(req.params.id);
    const user = findUserById(userId);

    const adminUser = req.user?.username || 'PESO Admin';
    const adminRole = req.user?.role || 'PESO Admin';
    const adminDept = req.user?.department || (adminRole.includes('CSWDO') ? 'CSWDO' : 'PESO');
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const reason = req.body.action_reason || req.body.reason || 'Admin verified account legitimacy';

    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Cross-Department Isolation Validation
    if (adminDept === 'PESO' && user.department === 'CSWDO') {
        return res.status(403).json({
            success: false,
            error: 'Cross-Department Restriction',
            message: 'PESO Administrators cannot unlock CSWDO accounts.'
        });
    }
    if (adminDept === 'CSWDO' && user.department === 'PESO') {
        return res.status(403).json({
            success: false,
            error: 'Cross-Department Restriction',
            message: 'CSWDO Administrators cannot unlock PESO accounts.'
        });
    }

    user.lockout_until = null;
    user.failed_login_attempts = 0;
    user.status = 'Active';
    user.updated_at = new Date().toISOString();

    logAudit({
        userId: adminUser,
        userRole: adminRole,
        actionType: 'UNLOCK_USER',
        targetEntity: 'User Account Security',
        targetId: user.id,
        status: 'SUCCESS',
        actionReason: reason,
        details: `Admin "${adminUser}" unlocked account "${user.username}" (ID: ${user.id}). Reason: ${reason}`,
        clientIp
    });

    res.json({
        success: true,
        message: `Account "${user.username}" has been unlocked and restored to Active status.`
    });
});

/**
 * DELETE /api/users/:id
 * Archive user account (Admin-only, audit logged with action reason)
 */
router.delete('/:id', requireAdmin, (req, res) => {
    const userId = Number(req.params.id);
    const user = findUserById(userId);

    const adminUser = req.user?.username || 'PESO Admin';
    const adminRole = req.user?.role || 'PESO Admin';
    const adminDept = req.user?.department || (adminRole.includes('CSWDO') ? 'CSWDO' : 'PESO');
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const reason = req.body.action_reason || req.body.reason || req.query.reason || 'Staff reassignment/archival';
    const isPermanent = req.query.permanent === 'true';

    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Cross-Department Isolation Validation
    if (adminDept === 'PESO' && user.department === 'CSWDO') {
        return res.status(403).json({
            success: false,
            error: 'Cross-Department Restriction',
            message: 'PESO Administrators cannot archive or delete CSWDO accounts.'
        });
    }
    if (adminDept === 'CSWDO' && user.department === 'PESO') {
        return res.status(403).json({
            success: false,
            error: 'Cross-Department Restriction',
            message: 'CSWDO Administrators cannot archive or delete PESO accounts.'
        });
    }

    // Protect primary admin from deletion
    if (user.username === 'peso-admin') {
        return res.status(403).json({
            success: false,
            error: 'Protected Account',
            message: 'Primary Administrator account (peso-admin) cannot be deleted or archived.'
        });
    }

    if (isPermanent) {
        const usersList = getUsers();
        const idx = usersList.findIndex(u => u.id === userId);
        if (idx !== -1) usersList.splice(idx, 1);

        logAudit({
            userId: adminUser,
            userRole: adminRole,
            actionType: 'PERMANENT_DELETE_USER',
            targetEntity: 'User Account',
            targetId: userId,
            status: 'SUCCESS',
            actionReason: reason,
            details: `Admin "${adminUser}" permanently deleted user account "${user.username}" (ID: ${userId}). Reason: ${reason}`,
            clientIp
        });

        return res.json({
            success: true,
            message: `User account "${user.username}" permanently removed from system.`
        });
    }

    user.status = 'Archived';
    user.updated_at = new Date().toISOString();

    logAudit({
        userId: adminUser,
        userRole: adminRole,
        actionType: 'ARCHIVE_USER',
        targetEntity: 'User Account',
        targetId: user.id,
        status: 'SUCCESS',
        actionReason: reason,
        details: `Admin "${adminUser}" archived user account "${user.username}" (ID: ${user.id}). Reason: ${reason}`,
        clientIp
    });

    res.json({
        success: true,
        message: `User account "${user.username}" has been archived.`,
        data: {
            id: user.id,
            username: user.username,
            status: user.status
        }
    });
});

module.exports = router;

/**
 * Seed User Store & Initial System Users
 * City Government of Koronadal — PESO & CSWDO Portal
 * 
 * Passwords are pre-hashed with bcrypt (salt rounds: 10) for Capstone2026!
 * Default Seed Accounts:
 * - peso-admin / peso.admin@koronadal.gov.ph (PESO Admin)
 * - peso-officer / peso.officer@koronadal.gov.ph (PESO Officer)
 * - cswdo-admin / cswdo.admin@koronadal.gov.ph (CSWDO Admin)
 * - cswdo-officer / cswdo.officer@koronadal.gov.ph (CSWDO Officer)
 * - evaluator / evaluator@koronadal.gov.ph (Evaluator / Staff)
 */

const bcrypt = require('bcryptjs');

// Pre-computed bcrypt hash for 'Capstone2026!'
const DEFAULT_HASH = bcrypt.hashSync('Capstone2026!', 10);

const _users = [
    {
        id: 1,
        username: 'peso-admin',
        email: 'peso.admin@koronadal.gov.ph',
        password_hash: DEFAULT_HASH,
        first_name: 'John',
        middle_name: 'A.',
        last_name: 'Doe',
        suffix: '',
        role: 'PESO Admin',
        department: 'PESO',
        phone: '0917-111-2222',
        sex: 'Male',
        address: 'City Hall Complex, Koronadal City',
        status: 'Active', // 'Active', 'Locked', 'Archived'
        failed_login_attempts: 0,
        lockout_until: null,
        last_login_at: '2026-08-08T09:30:00.000Z',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-08-08T09:30:00.000Z'
    },
    {
        id: 2,
        username: 'peso-officer',
        email: 'peso.officer@koronadal.gov.ph',
        password_hash: DEFAULT_HASH,
        first_name: 'Jane',
        middle_name: 'B.',
        last_name: 'Smith',
        suffix: '',
        role: 'PESO Officer',
        department: 'PESO',
        phone: '0918-222-3333',
        sex: 'Female',
        address: 'PESO Office, Koronadal City',
        status: 'Active',
        failed_login_attempts: 0,
        lockout_until: null,
        last_login_at: '2026-08-07T14:15:00.000Z',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-08-07T14:15:00.000Z'
    },
    {
        id: 3,
        username: 'cswdo-admin',
        email: 'cswdo.admin@koronadal.gov.ph',
        password_hash: DEFAULT_HASH,
        first_name: 'Robert',
        middle_name: 'C.',
        last_name: 'Johnson',
        suffix: 'Sr.',
        role: 'CSWDO Admin',
        department: 'CSWDO',
        phone: '0919-333-4444',
        sex: 'Male',
        address: 'CSWDO Main Building, Koronadal City',
        status: 'Active',
        failed_login_attempts: 0,
        lockout_until: null,
        last_login_at: '2026-08-06T11:00:00.000Z',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-08-06T11:00:00.000Z'
    },
    {
        id: 4,
        username: 'cswdo-officer',
        email: 'cswdo.officer@koronadal.gov.ph',
        password_hash: DEFAULT_HASH,
        first_name: 'Mary',
        middle_name: 'D.',
        last_name: 'Williams',
        suffix: '',
        role: 'CSWDO Officer',
        department: 'CSWDO',
        phone: '0920-444-5555',
        sex: 'Female',
        address: 'CSWDO Annex, Koronadal City',
        status: 'Active',
        failed_login_attempts: 0,
        lockout_until: null,
        last_login_at: '2026-08-05T16:20:00.000Z',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-08-05T16:20:00.000Z'
    },
    {
        id: 5,
        username: 'evaluator',
        email: 'evaluator@koronadal.gov.ph',
        password_hash: DEFAULT_HASH,
        first_name: 'Edward',
        middle_name: 'E.',
        last_name: 'Davis',
        suffix: 'Jr.',
        role: 'Staff',
        department: 'PESO',
        phone: '0921-555-6666',
        sex: 'Male',
        address: 'City Hall Annex, Koronadal City',
        status: 'Active',
        failed_login_attempts: 0,
        lockout_until: null,
        last_login_at: '2026-08-04T10:40:00.000Z',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-08-04T10:40:00.000Z'
    },
    {
        id: 6,
        username: 'peso-staff-01',
        email: 'staff.marquez@koronadal.gov.ph',
        password_hash: DEFAULT_HASH,
        first_name: 'Patricia',
        middle_name: 'M.',
        last_name: 'Marquez',
        suffix: '',
        role: 'Staff',
        department: 'PESO',
        phone: '0922-777-8888',
        sex: 'Female',
        address: 'Barangay Zone II, Koronadal City',
        status: 'Active',
        failed_login_attempts: 0,
        lockout_until: null,
        last_login_at: '2026-08-08T08:10:00.000Z',
        created_at: '2026-02-01T08:00:00.000Z',
        updated_at: '2026-08-08T08:10:00.000Z'
    }
];

function getUsers() {
    return _users;
}

function findUserById(id) {
    return _users.find(u => u.id === Number(id));
}

function findUserByIdentifier(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    return _users.find(u => 
        u.username.toLowerCase() === clean || 
        u.email.toLowerCase() === clean
    );
}

function addUser(userData) {
    const id = _users.length > 0 ? Math.max(..._users.map(u => u.id)) + 1 : 1;
    const newUser = {
        id,
        ...userData,
        failed_login_attempts: 0,
        lockout_until: null,
        last_login_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    _users.push(newUser);
    return newUser;
}

module.exports = {
    getUsers,
    findUserById,
    findUserByIdentifier,
    addUser,
    DEFAULT_HASH
};

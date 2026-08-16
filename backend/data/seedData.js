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
    },
    {
        id: 7,
        username: 'peso-officer-02',
        email: 'maria.fernandez@koronadal.gov.ph',
        password_hash: DEFAULT_HASH,
        first_name: 'Maria',
        middle_name: 'L.',
        last_name: 'Fernandez',
        suffix: '',
        role: 'PESO Officer',
        department: 'PESO',
        phone: '0919-333-4444',
        sex: 'Female',
        address: 'Barangay Morales, Koronadal City',
        status: 'Active',
        failed_login_attempts: 0,
        lockout_until: null,
        last_login_at: '2026-08-09T09:15:00.000Z',
        created_at: '2026-02-01T08:00:00.000Z',
        updated_at: '2026-08-09T09:15:00.000Z'
    },
    {
        id: 8,
        username: 'peso-officer-03',
        email: 'mark.gonzales@koronadal.gov.ph',
        password_hash: DEFAULT_HASH,
        first_name: 'Mark',
        middle_name: 'D.',
        last_name: 'Gonzales',
        suffix: '',
        role: 'PESO Officer',
        department: 'PESO',
        phone: '0920-444-5555',
        sex: 'Male',
        address: 'Barangay GPS, Koronadal City',
        status: 'Active',
        failed_login_attempts: 0,
        lockout_until: null,
        last_login_at: '2026-08-09T11:20:00.000Z',
        created_at: '2026-02-01T08:00:00.000Z',
        updated_at: '2026-08-09T11:20:00.000Z'
    },
    {
        id: 9,
        username: 'elena-ramos',
        email: 'elena.ramos@koronadal.gov.ph',
        password_hash: DEFAULT_HASH,
        first_name: 'Elena',
        middle_name: 'S.',
        last_name: 'Ramos',
        suffix: '',
        role: 'PESO Officer',
        department: 'PESO',
        phone: '0919-555-1234',
        sex: 'Female',
        address: 'Barangay Zone III, Koronadal City',
        status: 'Active',
        failed_login_attempts: 0,
        lockout_until: null,
        last_login_at: '2026-08-10T13:45:00.000Z',
        created_at: '2026-02-15T08:00:00.000Z',
        updated_at: '2026-08-10T13:45:00.000Z'
    },
    {
        id: 10,
        username: 'gabriel-mercado',
        email: 'gabriel.mercado@koronadal.gov.ph',
        password_hash: DEFAULT_HASH,
        first_name: 'Gabriel',
        middle_name: 'P.',
        last_name: 'Mercado',
        suffix: '',
        role: 'PESO Officer',
        department: 'PESO',
        phone: '0928-333-7777',
        sex: 'Male',
        address: 'Barangay GPS, Koronadal City',
        status: 'Active',
        failed_login_attempts: 0,
        lockout_until: null,
        last_login_at: '2026-08-11T10:00:00.000Z',
        created_at: '2026-02-15T08:00:00.000Z',
        updated_at: '2026-08-11T10:00:00.000Z'
    },
    {
        id: 11,
        username: 'carlos-garcia',
        email: 'carlos.garcia@koronadal.gov.ph',
        password_hash: DEFAULT_HASH,
        first_name: 'Carlos',
        middle_name: 'R.',
        last_name: 'Garcia',
        suffix: '',
        role: 'Staff',
        department: 'PESO',
        phone: '0923-888-9999',
        sex: 'Male',
        address: 'Barangay San Isidro, Koronadal City',
        status: 'Active',
        failed_login_attempts: 0,
        lockout_until: null,
        last_login_at: '2026-08-11T14:30:00.000Z',
        created_at: '2026-02-15T08:00:00.000Z',
        updated_at: '2026-08-11T14:30:00.000Z'
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

function findUserByEmail(email) {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    return _users.find(u => (u.email && u.email.toLowerCase() === clean));
}

function findUserByPhoneNumber(phone) {
    if (!phone) return null;
    const clean = phone.replace(/[^0-9]/g, '');
    return _users.find(u => {
        const uPhone = (u.phone_number || u.phone || '').replace(/[^0-9]/g, '');
        return uPhone && (uPhone === clean || (clean.length === 10 && uPhone.endsWith(clean)) || (uPhone.length === 10 && clean.endsWith(uPhone)));
    });
}

function createDualVerificationUser({ 
    email, 
    password, 
    password_hash, 
    phone_number, 
    username = null,
    first_name = '', 
    middle_name = '',
    last_name = '', 
    suffix = '',
    dob = null,
    age = 0,
    sex = 'Male',
    civil_status = 'Single',
    spouse_name = '',
    number_of_children = 0,
    purok = '',
    barangay = 'Poblacion',
    city = 'City of Koronadal',
    role = 'Beneficiary', 
    department = 'PESO',
    program_sector = 'PESO',
    mandatory_uploads = null
}) {
    const id = _users.length > 0 ? Math.max(..._users.map(u => u.id)) + 1 : 1;
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone_number.trim();
    const effectiveUsername = (username || cleanEmail.split('@')[0]).trim().toLowerCase();

    const newUser = {
        id,
        username: effectiveUsername,
        email: cleanEmail,
        password: password_hash || password,
        password_hash: password_hash || password,
        phone_number: cleanPhone,
        phone: cleanPhone,
        first_name: first_name || effectiveUsername,
        middle_name: middle_name || '',
        last_name: last_name || '',
        suffix: suffix || '',
        full_name: `${first_name} ${middle_name ? middle_name + ' ' : ''}${last_name}${suffix ? ' ' + suffix : ''}`.trim() || effectiveUsername,
        dob: dob || null,
        date_of_birth: dob || null,
        age: parseInt(age, 10) || 0,
        sex: sex || 'Male',
        civil_status: civil_status || 'Single',
        marital_status: civil_status || 'Single',
        spouse_name: spouse_name || '',
        number_of_children: parseInt(number_of_children, 10) || 0,
        purok: purok || '',
        barangay: barangay || 'Poblacion',
        city: city || 'City of Koronadal',
        address: `Purok ${purok || 'Centro'}, Barangay ${barangay || 'Poblacion'}, ${city || 'City of Koronadal'}`,
        role,
        department: program_sector.toUpperCase().includes('CSWDO') ? 'CSWDO' : (department || 'PESO'),
        program_sector: program_sector || 'PESO',
        mandatory_uploads: mandatory_uploads || {},
        status: 'Active',
        email_status: 'unverified',
        phone_status: 'unverified',
        email_code_hash: null,
        email_code_expiry: null,
        phone_otp_hash: null,
        phone_otp_expiry: null,
        failed_login_attempts: 0,
        lockout_until: null,
        last_login_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    _users.push(newUser);
    return newUser;
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


// In-memory Unified Schedule Slots & Interview Schedules Store
const _interviews = [
    {
        interview_id: 'INT-2026-001',
        slot_id: 'SLOT-2026-001',
        id: 1,
        officer_id: 2, // PESO Officer (Jane Smith)
        officer_name: 'Jane Smith',
        beneficiary_id: 'BEN-2026-001',
        beneficiary_name: 'Maria Santos',
        beneficiary_phone: '0917-123-4567',
        beneficiary_email: 'maria.santos@gmail.com',
        beneficiary_address: 'Purok 4, Barangay Morales, Koronadal City',
        barangay: 'Morales',
        sex: 'Female',
        age: 32,
        documents_verified: true,
        program_id: 'PRG-TUPAD',
        program_code: 'TUPAD',
        program_name: 'TUPAD (Emergency Employment Assistance)',
        project_type: 'Environmental Sanitation & Community Beautification',
        program_sub_category: 'Environmental Sanitation',
        barangay_cluster: 'Cluster 2 - East Poblacion & Morales',
        application_id: 'APP-2026-001',
        date_applied: '2026-07-28',
        interview_date: new Date().toISOString().split('T')[0],
        schedule_time: '09:00 AM - 10:00 AM',
        time_slot: '09:00 AM',
        venue_location: 'PESO Main Office - Interview Room A',
        status: 'Pending', // 'Pending', 'Completed', 'Missed', 'Scheduled', 'Cancelled'
        slot_status: 'Active', // 'Active', 'Locked', 'Completed', 'Cancelled'
        is_locked: false,
        lock_status: 'Unlocked',
        scheduling_mode: 'Individual', // 'Individual', 'Batch', 'Unassigned'
        batch_id: null,
        batch_name: null,
        batch_count: 1,
        batch_members: [],
        attendance_status: 'Unmarked', // 'Unmarked', 'Present', 'Absent'
        presence_flag: 'Unmarked',
        remarks: 'Scheduled for initial qualification interview and livelihood assessment.',
        justification: null,
        cancellation_reason: null,
        created_at: '2026-08-01T08:00:00.000Z',
        updated_at: '2026-08-08T08:00:00.000Z'
    },
    {
        interview_id: 'INT-2026-002',
        slot_id: 'SLOT-2026-002',
        id: 2,
        officer_id: 2,
        officer_name: 'Jane Smith',
        beneficiary_id: 'BEN-2026-002',
        beneficiary_name: 'Juan Dela Cruz',
        beneficiary_phone: '0918-222-3344',
        beneficiary_email: 'juan.delacruz@yahoo.com',
        beneficiary_address: 'Purok Sunflower, Barangay Zone 1, Koronadal City',
        barangay: 'Zone 1',
        sex: 'Male',
        age: 41,
        documents_verified: true,
        program_id: 'PRG-PFAS',
        program_code: 'PFAS',
        program_name: 'PFAS (Pangkabuhayan Assistance Special Project)',
        project_type: 'Micro-Enterprise Food Cart & Rolling Store',
        program_sub_category: 'Food Cart Livelihood Enterprise',
        barangay_cluster: 'Cluster 1 - Urban (Poblacion, Zone I, Zone II)',
        application_id: 'APP-2026-002',
        date_applied: '2026-07-29',
        interview_date: '2026-08-08',
        schedule_time: '10:30 AM - 11:30 AM',
        time_slot: '10:30 AM',
        venue_location: 'PESO Main Office - Interview Room B',
        status: 'Completed',
        slot_status: 'Completed',
        is_locked: false,
        lock_status: 'Unlocked',
        scheduling_mode: 'Individual',
        batch_id: null,
        batch_name: null,
        batch_count: 1,
        batch_members: [],
        attendance_status: 'Present',
        presence_flag: 'Present',
        remarks: 'Candidate successfully presented business proposal and passed interview assessment.',
        justification: null,
        cancellation_reason: null,
        created_at: '2026-08-01T08:30:00.000Z',
        updated_at: '2026-08-08T10:35:00.000Z'
    },
    {
        interview_id: 'INT-2026-003',
        slot_id: 'SLOT-2026-003',
        id: 3,
        officer_id: 2,
        officer_name: 'Jane Smith',
        beneficiary_id: 'BEN-2026-003',
        beneficiary_name: 'Pedro Reyes',
        beneficiary_phone: '0919-333-5566',
        beneficiary_email: 'pedro.reyes@koronadal.ph',
        beneficiary_address: 'Purok 2, Barangay Rotonda, Koronadal City',
        barangay: 'Rotonda',
        sex: 'Male',
        age: 23,
        documents_verified: true,
        program_id: 'PRG-CKGIP',
        program_code: 'CKGIP',
        program_name: 'CKGIP (City of Koronadal Government Internship Program)',
        project_type: 'Administrative & Information Systems Internship',
        program_sub_category: 'Government Systems IT Internship',
        barangay_cluster: 'Cluster 3 - West Corridor (Rotonda, GPS)',
        application_id: 'APP-2026-003',
        date_applied: '2026-07-30',
        interview_date: '2026-08-08',
        schedule_time: '01:30 PM - 02:30 PM',
        time_slot: '01:30 PM',
        venue_location: 'PESO Main Office - Interview Room A',
        status: 'Pending',
        slot_status: 'Locked',
        is_locked: true,
        lock_status: 'Locked',
        scheduling_mode: 'Individual',
        batch_id: null,
        batch_name: null,
        batch_count: 1,
        batch_members: [],
        attendance_status: 'Unmarked',
        presence_flag: 'Unmarked',
        remarks: 'Afternoon interview session for technical internship placement.',
        justification: null,
        cancellation_reason: null,
        created_at: '2026-08-02T09:00:00.000Z',
        updated_at: '2026-08-08T08:00:00.000Z'
    },
    {
        interview_id: 'INT-2026-004',
        slot_id: 'SLOT-2026-004',
        id: 4,
        officer_id: 2,
        officer_name: 'Jane Smith',
        beneficiary_id: 'BEN-2026-004',
        beneficiary_name: 'Ana Lim',
        beneficiary_phone: '0920-444-7788',
        beneficiary_email: 'ana.lim@gmail.com',
        beneficiary_address: 'Purok Pag-asa, Barangay Poblacion, Koronadal City',
        barangay: 'Poblacion',
        sex: 'Female',
        age: 28,
        documents_verified: true,
        program_id: 'PRG-TUPAD',
        program_code: 'TUPAD',
        program_name: 'TUPAD (Emergency Employment Assistance)',
        project_type: 'Community Urban Greening & Tree Planting',
        program_sub_category: 'Urban Greening & Tree Planting',
        barangay_cluster: 'Cluster 1 - Urban (Poblacion, Zone I, Zone II)',
        application_id: 'APP-2026-004',
        date_applied: '2026-08-01',
        interview_date: '2026-08-09',
        schedule_time: '09:00 AM - 10:00 AM',
        time_slot: '09:00 AM',
        venue_location: 'PESO Main Office - Interview Room A',
        status: 'Pending',
        slot_status: 'Active',
        is_locked: false,
        lock_status: 'Unlocked',
        scheduling_mode: 'Individual',
        batch_id: null,
        batch_name: null,
        batch_count: 1,
        batch_members: [],
        attendance_status: 'Unmarked',
        presence_flag: 'Unmarked',
        remarks: 'Tomorrow morning interview schedule.',
        justification: null,
        cancellation_reason: null,
        created_at: '2026-08-03T10:00:00.000Z',
        updated_at: '2026-08-08T08:00:00.000Z'
    },
    {
        interview_id: 'INT-2026-005',
        slot_id: 'SLOT-2026-005',
        id: 5,
        officer_id: 2,
        officer_name: 'Jane Smith',
        beneficiary_id: 'BEN-2026-005',
        beneficiary_name: 'Carlos Garcia',
        beneficiary_phone: '0921-555-8899',
        beneficiary_email: 'carlos.garcia@outlook.com',
        beneficiary_address: 'Purok Centro, Barangay San Isidro, Koronadal City',
        barangay: 'San Isidro',
        sex: 'Male',
        age: 36,
        documents_verified: true,
        program_id: 'PRG-PFAS',
        program_code: 'PFAS',
        program_name: 'PFAS (Pangkabuhayan Assistance Special Project)',
        project_type: 'Welding, Metalcraft & Fabrication Starter Kit',
        program_sub_category: 'Technical Vocational Skills Livelihood',
        barangay_cluster: 'Cluster 4 - North Corridor (San Isidro, Concepcion)',
        application_id: 'APP-2026-005',
        date_applied: '2026-07-20',
        interview_date: '2026-08-05', // Past date for testing past-date restriction
        schedule_time: '11:00 AM - 12:00 PM',
        time_slot: '11:00 AM',
        venue_location: 'PESO Main Office - Interview Room B',
        status: 'Missed',
        slot_status: 'Completed',
        is_locked: false,
        lock_status: 'Unlocked',
        scheduling_mode: 'Individual',
        batch_id: null,
        batch_name: null,
        batch_count: 1,
        batch_members: [],
        attendance_status: 'Absent',
        presence_flag: 'Absent',
        remarks: 'Applicant was unable to attend due to medical emergency.',
        justification: 'Logged official beneficiary absence notice.',
        cancellation_reason: null,
        created_at: '2026-07-25T08:00:00.000Z',
        updated_at: '2026-08-05T12:00:00.000Z'
    },
    {
        interview_id: 'INT-2026-006',
        slot_id: 'SLOT-2026-006',
        id: 6,
        officer_id: 2,
        officer_name: 'Jane Smith',
        beneficiary_id: 'BEN-2026-006',
        beneficiary_name: 'Elena Ramos',
        beneficiary_phone: '0922-666-9900',
        beneficiary_email: 'elena.ramos@gmail.com',
        beneficiary_address: 'Purok 3, Barangay Concepcion, Koronadal City',
        barangay: 'Concepcion',
        sex: 'Female',
        age: 45,
        documents_verified: true,
        program_id: 'PRG-TUPAD',
        program_code: 'TUPAD',
        program_name: 'TUPAD (Emergency Employment Assistance)',
        project_type: 'Public Park Maintenance & Tree Pruning',
        program_sub_category: 'Public Facilities Maintenance',
        barangay_cluster: 'Cluster 4 - North Corridor (San Isidro, Concepcion)',
        application_id: 'APP-2026-006',
        date_applied: '2026-08-02',
        interview_date: '2026-08-10',
        schedule_time: '10:00 AM - 11:00 AM',
        time_slot: '10:00 AM',
        venue_location: 'PESO Main Office - Interview Room A',
        status: 'Pending',
        slot_status: 'Active',
        is_locked: false,
        lock_status: 'Unlocked',
        scheduling_mode: 'Individual',
        batch_id: null,
        batch_name: null,
        batch_count: 1,
        batch_members: [],
        attendance_status: 'Unmarked',
        presence_flag: 'Unmarked',
        remarks: 'Scheduled interview session.',
        justification: null,
        cancellation_reason: null,
        created_at: '2026-08-04T09:00:00.000Z',
        updated_at: '2026-08-08T08:00:00.000Z'
    },
    {
        interview_id: 'INT-2026-007',
        slot_id: 'SLOT-2026-007',
        id: 7,
        officer_id: 2,
        officer_name: 'Jane Smith',
        beneficiary_id: 'BATCH-2026-001',
        beneficiary_name: 'Batch 2026-01: Morales Drainage Sanitation (25 Beneficiaries)',
        beneficiary_phone: '0917-000-0000',
        beneficiary_email: 'officer.smith@koronadal.gov.ph',
        beneficiary_address: 'Barangay Morales Multi-Purpose Center, Koronadal City',
        barangay: 'Morales',
        sex: 'Mixed',
        age: 35,
        documents_verified: true,
        program_id: 'PRG-TUPAD',
        program_code: 'TUPAD',
        program_name: 'TUPAD (Emergency Employment Assistance)',
        project_type: 'Community Drainage Declogging & Sanitation',
        program_sub_category: 'Drainage Declogging Assistance',
        barangay_cluster: 'Cluster 2 - East Poblacion & Morales',
        application_id: 'BATCH-APP-001',
        date_applied: '2026-08-01',
        interview_date: '2026-08-12',
        schedule_time: '08:00 AM - 12:00 PM',
        time_slot: '08:00 AM',
        venue_location: 'Barangay Morales Multi-Purpose Gymnasium',
        status: 'Pending',
        slot_status: 'Active',
        is_locked: false,
        lock_status: 'Unlocked',
        scheduling_mode: 'Batch',
        batch_id: 'BAT-2026-001',
        batch_name: 'Batch 2026-01: Morales Drainage Sanitation',
        batch_count: 25,
        batch_members: [
            { name: 'Reynaldo Cortez', phone: '0917-111-3344', barangay: 'Morales' },
            { name: 'Grace Bautista', phone: '0918-222-5566', barangay: 'Morales' },
            { name: 'Danilo Mendoza', phone: '0919-333-7788', barangay: 'Morales' }
        ],
        attendance_status: 'Unmarked',
        presence_flag: 'Unmarked',
        remarks: 'Batch orientation and safety equipment distribution.',
        justification: null,
        cancellation_reason: null,
        created_at: '2026-08-05T08:00:00.000Z',
        updated_at: '2026-08-08T08:00:00.000Z'
    },
    {
        interview_id: 'INT-2026-008',
        slot_id: 'SLOT-2026-008',
        id: 8,
        officer_id: 2,
        officer_name: 'Jane Smith',
        beneficiary_id: null,
        beneficiary_name: 'Open Schedule Slot (Awaiting Officer Beneficiary Assignment)',
        beneficiary_phone: '0900-000-0000',
        beneficiary_email: '',
        beneficiary_address: 'City Hall Complex, Koronadal City',
        barangay: 'Poblacion',
        sex: 'N/A',
        age: 0,
        documents_verified: false,
        program_id: 'PRG-SPES',
        program_code: 'SPES',
        program_name: 'SPES (Special Program for Employment of Students)',
        project_type: 'Student Youth Government Internship',
        program_sub_category: 'Student Employment Facilitation',
        barangay_cluster: 'Cluster 1 - Urban (Poblacion, Zone I, Zone II)',
        application_id: null,
        date_applied: null,
        interview_date: '2026-08-14',
        schedule_time: '01:00 PM - 02:00 PM',
        time_slot: '01:00 PM',
        venue_location: 'PESO Main Office - Interview Room A',
        status: 'Pending',
        slot_status: 'Active',
        is_locked: false,
        lock_status: 'Unlocked',
        scheduling_mode: 'Unassigned',
        batch_id: null,
        batch_name: null,
        batch_count: 0,
        batch_members: [],
        attendance_status: 'Unmarked',
        presence_flag: 'Unmarked',
        remarks: 'Admin-created slot for SPES pre-qualification screening.',
        justification: null,
        cancellation_reason: null,
        created_at: '2026-08-06T10:00:00.000Z',
        updated_at: '2026-08-06T10:00:00.000Z'
    }
];

// In-memory Attendance Records Store
const _attendanceRecords = [
    {
        id: 1,
        interview_id: 'INT-2026-002',
        officer_id: 2,
        presence_flag: 'Present',
        remarks: 'Candidate present and completed orientation.',
        justification: null,
        recorded_at: '2026-08-08T10:35:00.000Z'
    },
    {
        id: 2,
        interview_id: 'INT-2026-005',
        officer_id: 2,
        presence_flag: 'Absent',
        remarks: 'Applicant was absent due to medical emergency.',
        justification: 'Official doctor certificate submitted by family.',
        recorded_at: '2026-08-05T12:00:00.000Z'
    }
];

function getInterviews() {
    return _interviews;
}

function findInterviewById(idOrInterviewId) {
    if (!idOrInterviewId) return null;
    const str = String(idOrInterviewId).trim().toLowerCase();
    return _interviews.find(i => 
        String(i.id) === str || 
        (i.interview_id && i.interview_id.toLowerCase() === str) ||
        (i.slot_id && i.slot_id.toLowerCase() === str)
    );
}

function getInterviewsByOfficer(officerId, filters = {}) {
    let list = _interviews.filter(i => 
        !officerId || 
        i.officer_id === Number(officerId) || 
        officerId === 'all' || 
        officerId === 'ALL'
    );

    if (filters.date && filters.date !== 'ALL') {
        list = list.filter(i => i.interview_date === filters.date);
    }
    if (filters.program_type && filters.program_type !== 'ALL') {
        const p = filters.program_type.toLowerCase();
        list = list.filter(i => (i.program_code && i.program_code.toLowerCase() === p) || (i.program_name && i.program_name.toLowerCase().includes(p)));
    }
    if (filters.status && filters.status !== 'ALL') {
        const s = filters.status.toLowerCase();
        list = list.filter(i => (i.status && i.status.toLowerCase() === s) || (i.slot_status && i.slot_status.toLowerCase() === s));
    }
    if (filters.attendance && filters.attendance !== 'ALL') {
        const a = filters.attendance.toLowerCase();
        list = list.filter(i => (i.attendance_status && i.attendance_status.toLowerCase() === a) || (i.presence_flag && i.presence_flag.toLowerCase() === a));
    }
    if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        list = list.filter(i => 
            (i.beneficiary_name && i.beneficiary_name.toLowerCase().includes(q)) ||
            (i.beneficiary_id && i.beneficiary_id.toLowerCase().includes(q)) ||
            (i.interview_id && i.interview_id.toLowerCase().includes(q)) ||
            (i.slot_id && i.slot_id.toLowerCase().includes(q)) ||
            (i.batch_name && i.batch_name.toLowerCase().includes(q)) ||
            (i.program_code && i.program_code.toLowerCase().includes(q)) ||
            (i.program_name && i.program_name.toLowerCase().includes(q)) ||
            (i.barangay && i.barangay.toLowerCase().includes(q)) ||
            (i.barangay_cluster && i.barangay_cluster.toLowerCase().includes(q)) ||
            (i.venue_location && i.venue_location.toLowerCase().includes(q))
        );
    }

    return list;
}

/**
 * Get all schedule slots for Admin with filters and summary counters
 */
function getScheduleSlots(filters = {}) {
    let list = [..._interviews];

    if (filters.program_type && filters.program_type !== 'ALL') {
        const p = filters.program_type.toLowerCase();
        list = list.filter(s => (s.program_code && s.program_code.toLowerCase() === p) || (s.program_name && s.program_name.toLowerCase().includes(p)));
    }
    if (filters.date && filters.date !== 'ALL') {
        list = list.filter(s => s.interview_date === filters.date);
    }
    if (filters.date_from) {
        list = list.filter(s => s.interview_date >= filters.date_from);
    }
    if (filters.date_to) {
        list = list.filter(s => s.interview_date <= filters.date_to);
    }
    if (filters.venue && filters.venue !== 'ALL') {
        const v = filters.venue.toLowerCase();
        list = list.filter(s => s.venue_location && s.venue_location.toLowerCase().includes(v));
    }
    if (filters.officer_id && filters.officer_id !== 'ALL') {
        list = list.filter(s => s.officer_id === Number(filters.officer_id));
    }
    if (filters.status && filters.status !== 'ALL') {
        const st = filters.status.toLowerCase();
        list = list.filter(s => (s.slot_status && s.slot_status.toLowerCase() === st) || (s.status && s.status.toLowerCase() === st));
    }
    if (filters.is_locked !== undefined && filters.is_locked !== null && filters.is_locked !== '') {
        const lockBool = String(filters.is_locked) === 'true';
        list = list.filter(s => s.is_locked === lockBool);
    }
    if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        list = list.filter(s => 
            (s.beneficiary_name && s.beneficiary_name.toLowerCase().includes(q)) ||
            (s.slot_id && s.slot_id.toLowerCase().includes(q)) ||
            (s.interview_id && s.interview_id.toLowerCase().includes(q)) ||
            (s.program_code && s.program_code.toLowerCase().includes(q)) ||
            (s.venue_location && s.venue_location.toLowerCase().includes(q)) ||
            (s.officer_name && s.officer_name.toLowerCase().includes(q)) ||
            (s.batch_name && s.batch_name.toLowerCase().includes(q))
        );
    }

    // Compute Summary Metrics
    const total_slots = _interviews.length;
    const active_slots = _interviews.filter(s => s.slot_status === 'Active' || s.status === 'Pending').length;
    const locked_slots = _interviews.filter(s => s.is_locked === true || s.slot_status === 'Locked').length;
    const completed_slots = _interviews.filter(s => s.slot_status === 'Completed' || s.status === 'Completed').length;
    const cancelled_slots = _interviews.filter(s => s.slot_status === 'Cancelled' || s.status === 'Cancelled').length;

    return {
        slots: list,
        metrics: {
            total_slots,
            active_slots,
            locked_slots,
            completed_slots,
            cancelled_slots
        }
    };
}

/**
 * Check if a beneficiary is already scheduled in an overlapping slot
 */
function checkBeneficiaryDoubleBooking(beneficiaryName, interviewDate, scheduleTime, excludeSlotId = null) {
    if (!beneficiaryName || !interviewDate || !scheduleTime) return null;
    const cleanName = beneficiaryName.trim().toLowerCase();
    if (cleanName.includes('open schedule slot') || cleanName.includes('unassigned')) return null;

    const cleanTime = scheduleTime.trim().toLowerCase();

    return _interviews.find(i => {
        if (excludeSlotId && (i.id === Number(excludeSlotId) || i.interview_id === excludeSlotId || i.slot_id === excludeSlotId)) return false;
        if (i.status === 'Cancelled' || i.slot_status === 'Cancelled') return false;
        if (i.interview_date !== interviewDate) return false;

        const iName = (i.beneficiary_name || '').trim().toLowerCase();
        if (!iName || iName.includes('open schedule slot')) return false;

        if (iName === cleanName || (i.batch_name && i.batch_name.toLowerCase().includes(cleanName))) {
            const existingSlot = (i.schedule_time || '').toLowerCase();
            const existingStart = existingSlot.split(' - ')[0].trim();
            const incomingStart = cleanTime.split(' - ')[0].trim();

            if (existingSlot.includes(cleanTime) || cleanTime.includes(existingSlot) || existingStart === incomingStart) {
                return true;
            }
        }
        return false;
    });
}

function updateInterviewAttendance(interviewId, presenceFlag, remarks = '', justification = '') {
    const interview = findInterviewById(interviewId);
    if (!interview) return null;

    interview.presence_flag = presenceFlag;
    interview.attendance_status = presenceFlag;
    if (remarks) interview.remarks = remarks;
    if (justification) interview.justification = justification;
    interview.updated_at = new Date().toISOString();

    const attRecord = {
        id: _attendanceRecords.length + 1,
        interview_id: interview.interview_id,
        officer_id: interview.officer_id,
        presence_flag: presenceFlag,
        remarks: remarks || interview.remarks,
        justification: justification || interview.justification,
        recorded_at: interview.updated_at
    };
    _attendanceRecords.push(attRecord);

    return { interview, attendanceRecord: attRecord };
}

function updateInterviewStatus(interviewId, status, remarks = '', justification = '') {
    const interview = findInterviewById(interviewId);
    if (!interview) return null;

    interview.status = status;
    if (status === 'Completed') {
        interview.slot_status = 'Completed';
    }
    if (remarks) interview.remarks = remarks;
    if (justification) interview.justification = justification;
    interview.updated_at = new Date().toISOString();

    return interview;
}

function checkOfficerScheduleConflict(officerId, interviewDate, scheduleTime, excludeInterviewId = null) {
    if (!officerId || !interviewDate || !scheduleTime) return null;
    const cleanTime = scheduleTime.trim().toLowerCase();
    
    return _interviews.find(i => {
        if (i.officer_id !== Number(officerId)) return false;
        if (i.interview_date !== interviewDate) return false;
        if (i.status === 'Cancelled' || i.slot_status === 'Cancelled') return false;
        if (excludeInterviewId && (i.interview_id === excludeInterviewId || i.slot_id === excludeInterviewId || String(i.id) === String(excludeInterviewId))) return false;

        const existingSlot = (i.schedule_time || '').toLowerCase();
        const existingStart = existingSlot.split(' - ')[0].trim();
        const incomingStart = cleanTime.split(' - ')[0].trim();

        return existingSlot.includes(cleanTime) || 
               cleanTime.includes(existingSlot) || 
               existingStart === incomingStart ||
               existingSlot.includes(incomingStart);
    });
}

/**
 * Admin creates a new schedule slot with program linkage and officer assignment
 */
function createScheduleSlot(data) {
    const id = _interviews.length > 0 ? Math.max(..._interviews.map(i => i.id)) + 1 : 1;
    const slot_id = `SLOT-2026-${String(id).padStart(3, '0')}`;
    const interview_id = `INT-2026-${String(id).padStart(3, '0')}`;

    const newSlot = {
        id,
        slot_id,
        interview_id,
        officer_id: Number(data.officer_id) || 2,
        officer_name: data.officer_name || (data.officer_id === 2 ? 'Jane Smith' : 'PESO Officer'),
        beneficiary_id: data.beneficiary_id || null,
        beneficiary_name: data.beneficiary_name || 'Open Schedule Slot (Awaiting Officer Beneficiary Assignment)',
        beneficiary_phone: data.beneficiary_phone || '0900-000-0000',
        beneficiary_email: data.beneficiary_email || '',
        beneficiary_address: data.beneficiary_address || 'Koronadal City',
        barangay: data.barangay || 'Poblacion',
        sex: data.sex || 'N/A',
        age: Number(data.age) || 0,
        documents_verified: Boolean(data.documents_verified),
        program_id: data.program_id || (data.program_code ? `PRG-${data.program_code}` : 'PRG-TUPAD'),
        program_code: (data.program_code || 'TUPAD').toUpperCase(),
        program_name: data.program_name || (data.program_code === 'SPES' ? 'SPES (Special Program for Employment of Students)' : data.program_code === 'PFAS' ? 'PFAS (Pangkabuhayan Assistance Special Project)' : data.program_code === 'CKGIP' ? 'CKGIP (City of Koronadal Government Internship Program)' : 'TUPAD (Emergency Employment Assistance)'),
        project_type: data.project_type || 'Livelihood & Community Employment',
        program_sub_category: data.program_sub_category || 'General Livelihood Program',
        barangay_cluster: data.barangay_cluster || 'Cluster 1 - Urban (Poblacion, Zone I, Zone II)',
        application_id: data.application_id || null,
        date_applied: data.date_applied || new Date().toISOString().split('T')[0],
        interview_date: data.interview_date || data.date || new Date().toISOString().split('T')[0],
        schedule_time: data.schedule_time || data.time || '09:00 AM - 10:00 AM',
        time_slot: (data.schedule_time || data.time || '09:00 AM').split(' - ')[0],
        venue_location: data.venue_location || data.venue || 'PESO Main Office - Interview Room A',
        status: data.status || 'Pending',
        slot_status: 'Active',
        is_locked: false,
        lock_status: 'Unlocked',
        scheduling_mode: data.scheduling_mode || 'Unassigned',
        batch_id: data.batch_id || null,
        batch_name: data.batch_name || null,
        batch_count: Number(data.batch_count) || (data.scheduling_mode === 'Individual' ? 1 : 0),
        batch_members: data.batch_members || [],
        attendance_status: 'Unmarked',
        presence_flag: 'Unmarked',
        remarks: data.remarks || 'Admin created program schedule slot.',
        justification: data.justification || null,
        cancellation_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    _interviews.push(newSlot);
    return newSlot;
}

/**
 * Admin updates slot (reassigns officer, changes date/time/venue/remarks)
 */
function updateScheduleSlot(id, data) {
    const slot = findInterviewById(id);
    if (!slot) return null;

    if (slot.is_locked && (data.officer_id && Number(data.officer_id) !== slot.officer_id)) {
        throw new Error('Lock Restriction: Slot is locked. Unlock the slot before reassigning the PESO officer.');
    }

    if (data.program_code) slot.program_code = data.program_code;
    if (data.program_name) slot.program_name = data.program_name;
    if (data.program_sub_category) slot.program_sub_category = data.program_sub_category;
    if (data.barangay_cluster) slot.barangay_cluster = data.barangay_cluster;
    if (data.interview_date || data.date) slot.interview_date = data.interview_date || data.date;
    if (data.schedule_time || data.time) {
        slot.schedule_time = data.schedule_time || data.time;
        slot.time_slot = slot.schedule_time.split(' - ')[0];
    }
    if (data.venue_location || data.venue) slot.venue_location = data.venue_location || data.venue;
    if (data.officer_id) {
        slot.officer_id = Number(data.officer_id);
        if (data.officer_name) slot.officer_name = data.officer_name;
    }
    if (data.remarks !== undefined) slot.remarks = data.remarks;
    if (data.status) slot.status = data.status;
    if (data.slot_status) slot.slot_status = data.slot_status;

    slot.updated_at = new Date().toISOString();
    return slot;
}

/**
 * Admin locks / unlocks slot
 */
function lockScheduleSlot(id, isLocked) {
    const slot = findInterviewById(id);
    if (!slot) return null;

    slot.is_locked = Boolean(isLocked);
    slot.lock_status = isLocked ? 'Locked' : 'Unlocked';
    slot.slot_status = isLocked ? 'Locked' : (slot.status === 'Completed' ? 'Completed' : 'Active');
    slot.updated_at = new Date().toISOString();
    return slot;
}

/**
 * Admin marks slot finalized/completed
 */
function completeScheduleSlot(id, data = {}) {
    const slot = findInterviewById(id);
    if (!slot) return null;

    slot.slot_status = 'Completed';
    slot.status = 'Completed';
    if (data.remarks) slot.remarks = data.remarks;
    slot.updated_at = new Date().toISOString();
    return slot;
}

/**
 * Admin cancels slot (retains record with red label for compliance)
 */
function cancelScheduleSlot(id, reason = 'Administrative schedule cancellation') {
    const slot = findInterviewById(id);
    if (!slot) return null;

    slot.slot_status = 'Cancelled';
    slot.status = 'Cancelled';
    slot.cancellation_reason = reason;
    slot.updated_at = new Date().toISOString();
    return slot;
}

/**
 * Officer assigns beneficiary (Individual or Batch mode) to an Admin-created slot
 */
function assignBeneficiariesToSlot(slotId, data) {
    const slot = findInterviewById(slotId);
    if (!slot) return { error: 'Schedule slot not found.' };

    if (slot.is_locked) {
        return { error: 'Lock Restriction: This slot has been locked by PESO Admin. Reassignment or beneficiary modifications are prevented.' };
    }

    const mode = data.mode || (data.batch_name ? 'Batch' : 'Individual');

    if (mode === 'Individual') {
        if (!data.beneficiary_name) {
            return { error: 'Beneficiary name is required for individual assignment.' };
        }

        // Double-booking check
        const conflict = checkBeneficiaryDoubleBooking(data.beneficiary_name, slot.interview_date, slot.schedule_time, slot.id);
        if (conflict) {
            return { 
                error: `Double-Booking Restriction: Beneficiary "${data.beneficiary_name}" is already scheduled in slot ${conflict.slot_id || conflict.interview_id} on ${conflict.interview_date} at ${conflict.schedule_time}.`,
                conflictSlot: conflict 
            };
        }

        slot.scheduling_mode = 'Individual';
        slot.beneficiary_name = data.beneficiary_name.trim();
        slot.beneficiary_phone = data.beneficiary_phone || '0917-111-2222';
        slot.beneficiary_email = data.beneficiary_email || 'beneficiary@koronadal.ph';
        slot.beneficiary_address = data.beneficiary_address || `Barangay ${data.barangay || 'Poblacion'}, Koronadal City`;
        slot.barangay = data.barangay || slot.barangay || 'Poblacion';
        slot.sex = data.sex || 'Male';
        slot.age = Number(data.age) || 30;
        slot.beneficiary_id = data.beneficiary_id || `BEN-2026-${String(slot.id).padStart(3, '0')}`;
        slot.application_id = data.application_id || `APP-2026-${String(slot.id).padStart(3, '0')}`;
        slot.batch_id = null;
        slot.batch_name = null;
        slot.batch_count = 1;
        slot.batch_members = [];
        if (data.remarks) slot.remarks = data.remarks;
    } else if (mode === 'Batch') {
        if (!data.batch_name) {
            return { error: 'Batch name is required for batch assignment.' };
        }

        slot.scheduling_mode = 'Batch';
        slot.batch_id = data.batch_id || `BAT-2026-${String(slot.id).padStart(3, '0')}`;
        slot.batch_name = data.batch_name.trim();
        slot.batch_count = Number(data.batch_count) || (Array.isArray(data.batch_members) ? data.batch_members.length : 10);
        slot.batch_members = Array.isArray(data.batch_members) ? data.batch_members : [];
        slot.barangay_cluster = data.barangay_cluster || slot.barangay_cluster || 'Cluster 1 - Urban';
        slot.program_sub_category = data.program_sub_category || slot.program_sub_category || 'Batch Community Project';
        slot.beneficiary_name = `${slot.batch_name} (${slot.batch_count} Beneficiaries)`;
        slot.beneficiary_id = slot.batch_id;
        slot.application_id = `BATCH-APP-${String(slot.id).padStart(3, '0')}`;
        if (data.remarks) slot.remarks = data.remarks;
    }

    slot.updated_at = new Date().toISOString();
    return { success: true, slot };
}

function addInterview(data) {
    return createScheduleSlot(data);
}

function getAttendanceRecords(filters = {}) {
    let list = [..._attendanceRecords];
    if (filters.interview_id) {
        list = list.filter(a => a.interview_id === filters.interview_id);
    }
    return list;
}

// =============================================================================
// CSWDO ASSISTANCE PROGRAMS, FUNDS & APPLICATIONS STORE
// =============================================================================

// CSWDO Programs & Budget Allocations (Aggregated Fund Data)
const _cswdoFunds = [
    {
        id: 1,
        program_id: 'PRG-MED-01',
        program: 'Medical Assistance',
        code: 'MED-AST',
        category: 'Medical',
        allocated_budget: 2500000.00,
        released_amount: 1650000.00,
        remaining_balance: 850000.00,
        icon: 'bi-heart-pulse-fill',
        color: '#E63946',
        description: 'Hospitalization bills, specialized laboratory diagnostics, and vital prescription medication assistance.'
    },
    {
        id: 2,
        program_id: 'PRG-FIN-02',
        program: 'Financial Assistance',
        code: 'FIN-AST',
        category: 'Financial',
        allocated_budget: 3000000.00,
        released_amount: 2100000.00,
        remaining_balance: 900000.00,
        icon: 'bi-cash-coin',
        color: '#2EC4B6',
        description: 'Emergency livelihood relief, crisis intervention subsidies, and educational emergency support.'
    },
    {
        id: 3,
        program_id: 'PRG-BUR-03',
        program: 'Burial Assistance',
        code: 'BUR-AST',
        category: 'Burial',
        allocated_budget: 1500000.00,
        released_amount: 950000.00,
        remaining_balance: 550000.00,
        icon: 'bi-flower1',
        color: '#6C5B7B',
        description: 'Mortuary expenses, casket subsidies, and transport logistics support for indigent bereaved families.'
    }
];

// Seed Applications for Medical, Financial, and Burial Assistance
const _cswdoApplications = [
    {
        id: 'APP-CSWDO-2026-001',
        beneficiary_id: 'BEN-2026-010',
        beneficiary_name: 'Rosa Villanueva',
        contact_number: '0917-888-1122',
        barangay: 'Zone III',
        address: 'Purok Malipayon, Zone III, Koronadal City',
        type: 'Medical Assistance',
        program_code: 'MED-AST',
        status: 'Pending', // Pending, For Evaluation, Approved, Released, Completed, Denied
        amount_requested: 15000.00,
        amount_approved: 0.00,
        submission_date: '2026-08-08',
        submission_month: 8,
        submission_year: 2026,
        purpose: 'Chemotherapy and post-operative laboratory medication support.',
        requirements_submitted: ['Barangay Certificate of Indigency', 'Medical Abstract & Diagnosis', 'Hospital Billing Statement', 'Valid Government ID'],
        evaluator_notes: 'Initial documents received and queued for social worker case study verification.',
        admin_notes: null,
        created_at: '2026-08-08T08:30:00.000Z',
        updated_at: '2026-08-08T08:30:00.000Z'
    },
    {
        id: 'APP-CSWDO-2026-002',
        beneficiary_id: 'BEN-2026-011',
        beneficiary_name: 'Danilo Alcantara',
        contact_number: '0918-777-3344',
        barangay: 'General Paulino Santos (GPS)',
        address: 'Purok San Jose, Brgy. GPS, Koronadal City',
        type: 'Financial Assistance',
        program_code: 'FIN-AST',
        status: 'For Evaluation',
        amount_requested: 10000.00,
        amount_approved: 0.00,
        submission_date: '2026-08-07',
        submission_month: 8,
        submission_year: 2026,
        purpose: 'House rehabilitation following severe monsoon flooding.',
        requirements_submitted: ['Barangay Disaster Incident Report', 'Certificate of Indigency', 'Photographic Evidence of Damage', 'Valid ID'],
        evaluator_notes: 'Social worker field assessment completed. Validated damaged structure.',
        admin_notes: null,
        created_at: '2026-08-07T09:15:00.000Z',
        updated_at: '2026-08-08T09:00:00.000Z'
    },
    {
        id: 'APP-CSWDO-2026-003',
        beneficiary_id: 'BEN-2026-012',
        beneficiary_name: 'Luzviminda Ocampo',
        contact_number: '0919-666-5566',
        barangay: 'San Roque',
        address: 'Purok Crossing, Brgy. San Roque, Koronadal City',
        type: 'Burial Assistance',
        program_code: 'BUR-AST',
        status: 'Approved',
        amount_requested: 8000.00,
        amount_approved: 8000.00,
        submission_date: '2026-08-06',
        submission_month: 8,
        submission_year: 2026,
        purpose: 'Burial and funeral service assistance for late spouse.',
        requirements_submitted: ['Certified True Copy of Death Certificate', 'Funeral Contract Receipt', 'Barangay Indigency', 'Proof of Relationship'],
        evaluator_notes: 'Documents verified authentic. Case qualified under LGU Social Relief Program.',
        admin_notes: 'Approved by CSWDO Administrator. Ready for fund voucher release.',
        created_at: '2026-08-06T10:00:00.000Z',
        updated_at: '2026-08-07T14:20:00.000Z'
    },
    {
        id: 'APP-CSWDO-2026-004',
        beneficiary_id: 'BEN-2026-013',
        beneficiary_name: 'Arnel Mendoza',
        contact_number: '0920-555-7788',
        barangay: 'Sta. Cruz',
        address: 'Purok 5, Brgy. Sta. Cruz, Koronadal City',
        type: 'Medical Assistance',
        program_code: 'MED-AST',
        status: 'Released',
        amount_requested: 20000.00,
        amount_approved: 15000.00,
        submission_date: '2026-08-04',
        submission_month: 8,
        submission_year: 2026,
        purpose: 'Emergency pediatric surgery and dialysis supplies.',
        requirements_submitted: ['Clinical Summary', 'Doctor Prescription with License', 'Hospital Billing', 'Barangay Indigency'],
        evaluator_notes: 'Urgent medical emergency verified with City District Hospital.',
        admin_notes: 'Grant check issued and disbursed via City Treasurer Cashier.',
        created_at: '2026-08-04T11:30:00.000Z',
        updated_at: '2026-08-06T16:00:00.000Z'
    },
    {
        id: 'APP-CSWDO-2026-005',
        beneficiary_id: 'BEN-2026-014',
        beneficiary_name: 'Corazon Bautista',
        contact_number: '0921-444-9900',
        barangay: 'Morales',
        address: 'Purok Riverside, Brgy. Morales, Koronadal City',
        type: 'Financial Assistance',
        program_code: 'FIN-AST',
        status: 'Completed',
        amount_requested: 5000.00,
        amount_approved: 5000.00,
        submission_date: '2026-07-25',
        submission_month: 7,
        submission_year: 2026,
        purpose: 'Emergency nutritional and livelihood support for solo parent.',
        requirements_submitted: ['Solo Parent ID Card', 'Certificate of Indigency', 'Barangay Clearance'],
        evaluator_notes: 'Case study recorded. Beneficiary attended financial literacy counseling.',
        admin_notes: 'Grant liquidation report received and verified. Process completed.',
        created_at: '2026-07-25T09:00:00.000Z',
        updated_at: '2026-08-02T10:30:00.000Z'
    },
    {
        id: 'APP-CSWDO-2026-006',
        beneficiary_id: 'BEN-2026-015',
        beneficiary_name: 'Felix Manalo',
        contact_number: '0922-333-2211',
        barangay: 'Zone I',
        address: 'Purok Maharlika, Zone I, Koronadal City',
        type: 'Medical Assistance',
        program_code: 'MED-AST',
        status: 'Denied',
        amount_requested: 30000.00,
        amount_approved: 0.00,
        submission_date: '2026-07-18',
        submission_month: 7,
        submission_year: 2026,
        purpose: 'Duplicate assistance request for non-resident relative.',
        requirements_submitted: ['Medical Certificate'],
        evaluator_notes: 'Failed residency verification criteria. Patient is registered under a different municipality.',
        admin_notes: 'Disapproved: Non-compliance with Koronadal City Residency Ordinance criteria.',
        created_at: '2026-07-18T13:45:00.000Z',
        updated_at: '2026-07-20T11:00:00.000Z'
    },
    {
        id: 'APP-CSWDO-2026-007',
        beneficiary_id: 'BEN-2026-016',
        beneficiary_name: 'Teresa Magbanua',
        contact_number: '0923-222-4455',
        barangay: 'Carpenter Hill',
        address: 'Purok Mabuhay, Carpenter Hill, Koronadal City',
        type: 'Medical Assistance',
        program_code: 'MED-AST',
        status: 'Approved',
        amount_requested: 12000.00,
        amount_approved: 12000.00,
        submission_date: '2026-06-15',
        submission_month: 6,
        submission_year: 2026,
        purpose: 'Orthopedic rehabilitation and physical therapy equipment.',
        requirements_submitted: ['Doctor Clinical Order', 'Indigency Certificate', 'Valid ID'],
        evaluator_notes: 'Physical disability validated with PWD Office.',
        admin_notes: 'Approved under Special Medical Aid Program.',
        created_at: '2026-06-15T08:20:00.000Z',
        updated_at: '2026-06-18T15:00:00.000Z'
    },
    {
        id: 'APP-CSWDO-2026-008',
        beneficiary_id: 'BEN-2026-017',
        beneficiary_name: 'Ignacio Palma',
        contact_number: '0924-111-6677',
        barangay: 'Esperanza',
        address: 'Purok Silangan, Brgy. Esperanza, Koronadal City',
        type: 'Financial Assistance',
        program_code: 'FIN-AST',
        status: 'Completed',
        amount_requested: 6000.00,
        amount_approved: 6000.00,
        submission_date: '2026-05-20',
        submission_month: 5,
        submission_year: 2026,
        purpose: 'Fire crisis temporary housing grant.',
        requirements_submitted: ['BFP Fire Incident Certificate', 'Barangay Indigency', 'Valid ID'],
        evaluator_notes: 'Confirmed total loss in Brgy Esperanza residential fire incident.',
        admin_notes: 'Assistance delivered and acknowledged by recipient.',
        created_at: '2026-05-20T10:10:00.000Z',
        updated_at: '2026-05-28T09:00:00.000Z'
    },
    {
        id: 'APP-CSWDO-2026-009',
        beneficiary_id: 'BEN-2026-018',
        beneficiary_name: 'Gloria Valerio',
        contact_number: '0925-999-8877',
        barangay: 'Mabini',
        address: 'Purok Centro, Brgy. Mabini, Koronadal City',
        type: 'Burial Assistance',
        program_code: 'BUR-AST',
        status: 'Completed',
        amount_requested: 8000.00,
        amount_approved: 8000.00,
        submission_date: '2026-04-12',
        submission_month: 4,
        submission_year: 2026,
        purpose: 'Burial and funeral transportation subsidy.',
        requirements_submitted: ['Death Certificate', 'Funeral Contract', 'Barangay Indigency'],
        evaluator_notes: 'Family verified as indigent agricultural workers.',
        admin_notes: 'Voucher released and liquidated.',
        created_at: '2026-04-12T14:00:00.000Z',
        updated_at: '2026-04-19T11:30:00.000Z'
    },
    {
        id: 'APP-CSWDO-2026-010',
        beneficiary_id: 'BEN-2026-019',
        beneficiary_name: 'Ramon Laurel',
        contact_number: '0926-888-7766',
        barangay: 'Assumption',
        address: 'Purok Pag-asa, Brgy. Assumption, Koronadal City',
        type: 'Medical Assistance',
        program_code: 'MED-AST',
        status: 'Completed',
        amount_requested: 18000.00,
        amount_approved: 15000.00,
        submission_date: '2026-03-10',
        submission_month: 3,
        submission_year: 2026,
        purpose: 'Cardiac maintenance medication and ECG telemetry testing.',
        requirements_submitted: ['Medical Record', 'Doctor Prescription', 'Indigency Certificate'],
        evaluator_notes: 'Senior citizen beneficiary verified.',
        admin_notes: 'Approved and full medicine subsidy released.',
        created_at: '2026-03-10T09:30:00.000Z',
        updated_at: '2026-03-18T16:15:00.000Z'
    },
    {
        id: 'APP-CSWDO-2026-011',
        beneficiary_id: 'BEN-2026-020',
        beneficiary_name: 'Estela Soriano',
        contact_number: '0927-777-6655',
        barangay: 'Zone II',
        address: 'Purok Ilang-ilang, Zone II, Koronadal City',
        type: 'Financial Assistance',
        program_code: 'FIN-AST',
        status: 'Completed',
        amount_requested: 10000.00,
        amount_approved: 8000.00,
        submission_date: '2026-02-14',
        submission_month: 2,
        submission_year: 2026,
        purpose: 'Emergency transportation and family subsistence grant.',
        requirements_submitted: ['Case Study Assessment', 'Indigency Certificate', 'Valid ID'],
        evaluator_notes: 'Indigent family with multiple school-age dependents.',
        admin_notes: 'Assistance completed.',
        created_at: '2026-02-14T11:00:00.000Z',
        updated_at: '2026-02-22T14:00:00.000Z'
    },
    {
        id: 'APP-CSWDO-2026-012',
        beneficiary_id: 'BEN-2026-021',
        beneficiary_name: 'Bernardo Cruz',
        contact_number: '0928-666-5544',
        barangay: 'Avanceña',
        address: 'Purok 1, Brgy. Avanceña, Koronadal City',
        type: 'Medical Assistance',
        program_code: 'MED-AST',
        status: 'Completed',
        amount_requested: 15000.00,
        amount_approved: 12000.00,
        submission_date: '2026-01-20',
        submission_month: 1,
        submission_year: 2026,
        purpose: 'Dialysis fluid subsidy for kidney ailment.',
        requirements_submitted: ['Dialysis Protocol Sheet', 'Medical Certificate', 'Indigency Certificate'],
        evaluator_notes: 'Chronic kidney disease protocol verified.',
        admin_notes: 'Released and completed.',
        created_at: '2026-01-20T08:45:00.000Z',
        updated_at: '2026-01-29T10:00:00.000Z'
    }
];

// Activity Log Stream
const _cswdoActivityLogs = [
    {
        id: 'LOG-CSWDO-2026-001',
        action: 'APPLICATION_SUBMITTED',
        action_title: 'New Application Submitted',
        application_id: 'APP-CSWDO-2026-001',
        beneficiary_name: 'Rosa Villanueva',
        program: 'Medical Assistance',
        admin_id: 'SYSTEM',
        admin_name: 'CSWDO Citizen Intake',
        details: 'New Medical Assistance application submitted for Chemotherapy medication support (Amount: ₱15,000.00).',
        timestamp: '2026-08-08T08:30:00.000Z',
        status: 'SUCCESS'
    },
    {
        id: 'LOG-CSWDO-2026-002',
        action: 'STATUS_EVALUATION',
        action_title: 'Case Study Evaluated',
        application_id: 'APP-CSWDO-2026-002',
        beneficiary_name: 'Danilo Alcantara',
        program: 'Financial Assistance',
        admin_id: 'CSWDO_OFFICER_01',
        admin_name: 'Mary Williams (CSWDO Officer)',
        details: 'Field evaluation completed for Danilo Alcantara (Flood disaster damage validated). Status updated to For Evaluation.',
        timestamp: '2026-08-08T09:00:00.000Z',
        status: 'SUCCESS'
    },
    {
        id: 'LOG-CSWDO-2026-003',
        action: 'APPLICATION_APPROVED',
        action_title: 'Application Approved by Admin',
        application_id: 'APP-CSWDO-2026-003',
        beneficiary_name: 'Luzviminda Ocampo',
        program: 'Burial Assistance',
        admin_id: 'CSWDO_ADMIN_01',
        admin_name: 'Robert Johnson (CSWDO Admin)',
        details: 'CSWDO Administrator approved Burial Assistance grant for ₱8,000.00 following authentic death certificate validation.',
        timestamp: '2026-08-07T14:20:00.000Z',
        status: 'SUCCESS'
    },
    {
        id: 'LOG-CSWDO-2026-004',
        action: 'FUNDS_RELEASED',
        action_title: 'Assistance Funds Released',
        application_id: 'APP-CSWDO-2026-004',
        beneficiary_name: 'Arnel Mendoza',
        program: 'Medical Assistance',
        admin_id: 'CSWDO_ADMIN_01',
        admin_name: 'Robert Johnson (CSWDO Admin)',
        details: 'Check voucher released for Medical Assistance grant (₱15,000.00). Deducted from Medical Program Allocation.',
        timestamp: '2026-08-06T16:00:00.000Z',
        status: 'SUCCESS'
    },
    {
        id: 'LOG-CSWDO-2026-005',
        action: 'APPLICATION_COMPLETED',
        action_title: 'Grant Liquidation Completed',
        application_id: 'APP-CSWDO-2026-005',
        beneficiary_name: 'Corazon Bautista',
        program: 'Financial Assistance',
        admin_id: 'CSWDO_ADMIN_01',
        admin_name: 'Robert Johnson (CSWDO Admin)',
        details: 'Liquidation receipt confirmed. Beneficiary case file successfully marked as Completed.',
        timestamp: '2026-08-02T10:30:00.000Z',
        status: 'SUCCESS'
    },
    {
        id: 'LOG-CSWDO-2026-006',
        action: 'APPLICATION_DENIED',
        action_title: 'Application Disapproved',
        application_id: 'APP-CSWDO-2026-006',
        beneficiary_name: 'Felix Manalo',
        program: 'Medical Assistance',
        admin_id: 'CSWDO_ADMIN_01',
        admin_name: 'Robert Johnson (CSWDO Admin)',
        details: 'Application disapproved: Non-compliance with Koronadal City residency requirements.',
        timestamp: '2026-07-20T11:00:00.000Z',
        status: 'SUCCESS'
    }
];

// Helper Functions for CSWDO Portal
function getCswdoApplications(filters = {}) {
    let list = [..._cswdoApplications];
    if (filters.status && filters.status !== 'ALL') {
        const s = filters.status.toLowerCase();
        list = list.filter(a => a.status.toLowerCase() === s);
    }
    if (filters.type && filters.type !== 'ALL') {
        const t = filters.type.toLowerCase();
        list = list.filter(a => a.type.toLowerCase().includes(t) || a.program_code.toLowerCase().includes(t));
    }
    if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        list = list.filter(a => 
            a.id.toLowerCase().includes(q) ||
            a.beneficiary_name.toLowerCase().includes(q) ||
            a.beneficiary_id.toLowerCase().includes(q) ||
            a.type.toLowerCase().includes(q) ||
            a.barangay.toLowerCase().includes(q)
        );
    }
    return list;
}

function findCswdoApplicationById(id) {
    if (!id) return null;
    const clean = String(id).trim().toLowerCase();
    return _cswdoApplications.find(a => a.id.toLowerCase() === clean);
}

function getCswdoFunds() {
    return _cswdoFunds.map(f => {
        const pct = f.allocated_budget > 0 
            ? ((f.released_amount / f.allocated_budget) * 100).toFixed(1) 
            : '0.0';
        return {
            ...f,
            percentage_utilized: parseFloat(pct)
        };
    });
}

function getCswdoDashboardSummary() {
    const totalApplications = _cswdoApplications.length;
    const pendingApplications = _cswdoApplications.filter(a => a.status === 'Pending' || a.status === 'For Evaluation').length;
    const approvedApplications = _cswdoApplications.filter(a => a.status === 'Approved' || a.status === 'Released').length;
    const completedApplications = _cswdoApplications.filter(a => a.status === 'Completed').length;
    const deniedApplications = _cswdoApplications.filter(a => a.status === 'Denied').length;

    // Aggregated Fund Metrics (Data Privacy compliant - aggregate numbers only)
    const funds = getCswdoFunds();
    const totalAllocatedBudget = funds.reduce((acc, f) => acc + f.allocated_budget, 0);
    const totalAmountReleased = funds.reduce((acc, f) => acc + f.released_amount, 0);
    const remainingBalance = totalAllocatedBudget - totalAmountReleased;
    const overallPercentageUtilization = totalAllocatedBudget > 0 
        ? ((totalAmountReleased / totalAllocatedBudget) * 100).toFixed(1) 
        : '0.0';

    return {
        total_applications: totalApplications,
        pending_applications: pendingApplications,
        approved_applications: approvedApplications,
        completed_applications: completedApplications,
        denied_applications: deniedApplications,
        fund_utilization: {
            total_allocated_budget: totalAllocatedBudget,
            total_amount_released: totalAmountReleased,
            remaining_balance: remainingBalance,
            overall_percentage_utilization: parseFloat(overallPercentageUtilization),
            programs: funds
        }
    };
}

function getCswdoStatusBreakdown() {
    const statuses = ['Pending', 'For Evaluation', 'Approved', 'Released', 'Completed', 'Denied'];
    const distribution = {};
    statuses.forEach(s => {
        distribution[s] = _cswdoApplications.filter(a => a.status === s).length;
    });

    const colors = {
        'Pending': '#F59E0B',        // Yellow
        'For Evaluation': '#8B5CF6', // Purple
        'Approved': '#10B981',       // Green
        'Released': '#06B6D4',       // Cyan/Teal
        'Completed': '#3B82F6',      // Blue
        'Denied': '#EF4444'          // Red
    };

    return {
        labels: statuses,
        data: statuses.map(s => distribution[s]),
        colors: statuses.map(s => colors[s]),
        breakdown: distribution,
        total: _cswdoApplications.length
    };
}

function getCswdoMonthlyTrend(year = 2026) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyCounts = new Array(12).fill(0);
    const medicalCounts = new Array(12).fill(0);
    const financialCounts = new Array(12).fill(0);
    const burialCounts = new Array(12).fill(0);

    _cswdoApplications.forEach(app => {
        const appYear = app.submission_year || (app.submission_date ? new Date(app.submission_date).getFullYear() : 2026);
        const appMonth = app.submission_month ? app.submission_month - 1 : (app.submission_date ? new Date(app.submission_date).getMonth() : 0);
        
        if (appYear === Number(year) && appMonth >= 0 && appMonth < 12) {
            monthlyCounts[appMonth]++;
            if (app.type.includes('Medical')) medicalCounts[appMonth]++;
            else if (app.type.includes('Financial')) financialCounts[appMonth]++;
            else if (app.type.includes('Burial')) burialCounts[appMonth]++;
        }
    });

    return {
        year: Number(year),
        months,
        total_submissions: monthlyCounts,
        by_program: {
            medical: medicalCounts,
            financial: financialCounts,
            burial: burialCounts
        },
        insights: {
            peak_month: months[monthlyCounts.indexOf(Math.max(...monthlyCounts))],
            peak_count: Math.max(...monthlyCounts),
            avg_per_month: (monthlyCounts.slice(0, 8).reduce((a, b) => a + b, 0) / 8).toFixed(1),
            pattern: 'High demand in Q1 & Q3 for Medical Subsidies; sustained emergency requests during typhoon months.'
        }
    };
}

function getCswdoRecentActivity(limit = 10) {
    return _cswdoActivityLogs.slice(0, limit);
}

function addCswdoActivityLog(logData) {
    const id = 'LOG-CSWDO-' + Date.now();
    const entry = {
        id,
        action: logData.action || 'GENERIC_ACTION',
        action_title: logData.action_title || 'System Action',
        application_id: logData.application_id || null,
        beneficiary_name: logData.beneficiary_name || 'N/A',
        program: logData.program || 'CSWDO Assistance',
        admin_id: logData.admin_id || 'CSWDO_ADMIN_01',
        admin_name: logData.admin_name || 'CSWDO Administrator',
        details: logData.details || '',
        timestamp: new Date().toISOString(),
        status: logData.status || 'SUCCESS'
    };
    _cswdoActivityLogs.unshift(entry);
    if (_cswdoActivityLogs.length > 500) _cswdoActivityLogs.pop();
    return entry;
}

function approveCswdoApplication(id, adminUser, remarks = '', amount = null) {
    const app = findCswdoApplicationById(id);
    if (!app) return null;

    const oldStatus = app.status;
    app.status = 'Approved';
    if (amount !== null && amount !== undefined) {
        app.amount_approved = parseFloat(amount);
    } else if (app.amount_approved === 0) {
        app.amount_approved = app.amount_requested;
    }
    app.admin_notes = remarks || 'Approved for grant disbursement.';
    app.updated_at = new Date().toISOString();

    addCswdoActivityLog({
        action: 'APPLICATION_APPROVED',
        action_title: 'Application Approved',
        application_id: app.id,
        beneficiary_name: app.beneficiary_name,
        program: app.type,
        admin_id: adminUser.username || adminUser || 'cswdo-admin',
        admin_name: adminUser.fullName || `${adminUser.first_name || ''} ${adminUser.last_name || ''}`.trim() || 'CSWDO Administrator',
        details: `Application ${app.id} (${app.beneficiary_name}) approved for ₱${app.amount_approved.toLocaleString('en-US', { minimumFractionDigits: 2 })}. Remarks: ${remarks || 'None'}`
    });

    return app;
}

function denyCswdoApplication(id, adminUser, reason = '') {
    const app = findCswdoApplicationById(id);
    if (!app) return null;

    app.status = 'Denied';
    app.admin_notes = reason || 'Disapproved by CSWDO Administration.';
    app.updated_at = new Date().toISOString();

    addCswdoActivityLog({
        action: 'APPLICATION_DENIED',
        action_title: 'Application Denied',
        application_id: app.id,
        beneficiary_name: app.beneficiary_name,
        program: app.type,
        admin_id: adminUser.username || adminUser || 'cswdo-admin',
        admin_name: adminUser.fullName || `${adminUser.first_name || ''} ${adminUser.last_name || ''}`.trim() || 'CSWDO Administrator',
        details: `Application ${app.id} (${app.beneficiary_name}) disapproved. Justification: ${reason || 'Document non-compliance'}`
    });

    return app;
}

function releaseCswdoApplicationFunds(id, adminUser, releaseAmount = null, notes = '') {
    const app = findCswdoApplicationById(id);
    if (!app) return null;

    const amt = releaseAmount !== null && releaseAmount !== undefined 
        ? parseFloat(releaseAmount) 
        : (app.amount_approved > 0 ? app.amount_approved : app.amount_requested);

    app.status = 'Released';
    app.amount_approved = amt;
    app.admin_notes = (app.admin_notes ? app.admin_notes + ' | ' : '') + `Funds released: ₱${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}. ${notes || ''}`;
    app.updated_at = new Date().toISOString();

    // Deduct from remaining balance of matching fund
    const fund = _cswdoFunds.find(f => app.type.toLowerCase().includes(f.category.toLowerCase()) || f.program.toLowerCase() === app.type.toLowerCase());
    if (fund) {
        fund.released_amount += amt;
        fund.remaining_balance = Math.max(0, fund.allocated_budget - fund.released_amount);
    }

    addCswdoActivityLog({
        action: 'FUNDS_RELEASED',
        action_title: 'Assistance Grant Released',
        application_id: app.id,
        beneficiary_name: app.beneficiary_name,
        program: app.type,
        admin_id: adminUser.username || adminUser || 'cswdo-admin',
        admin_name: adminUser.fullName || `${adminUser.first_name || ''} ${adminUser.last_name || ''}`.trim() || 'CSWDO Administrator',
        details: `Funds released for ${app.id} (${app.beneficiary_name}): ₱${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })} from ${fund ? fund.program : app.type}.`
    });

    return { app, fund };
}

// =============================================================================
// CSWDO OFFICER ACCOUNTS & MANAGEMENT STORE
// =============================================================================

const _cswdoOfficers = [
    {
        id: 1,
        first_name: 'Mary',
        middle_name: 'D.',
        last_name: 'Williams',
        suffix: 'N/A',
        username: 'cswdo-officer',
        email: 'cswdo.officer@koronadal.gov.ph',
        password_hash: DEFAULT_HASH,
        role: 'CSWDO Officer',
        gender: 'Female',
        address: 'CSWDO Annex, Barangay Zone I, Koronadal City',
        contact_number: '0920-444-5555',
        department: 'Medical',
        status: 'Active', // Strictly 'Active' or 'Deactivated'
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-08-08T08:00:00.000Z'
    },
    {
        id: 2,
        first_name: 'Carlos',
        middle_name: 'E.',
        last_name: 'Dela Peña',
        suffix: 'Sr.',
        username: 'cswdo-officer-fin',
        email: 'carlos.delapena@koronadal.gov.ph',
        password_hash: DEFAULT_HASH,
        role: 'CSWDO Officer',
        gender: 'Male',
        address: 'Purok San Jose, Barangay GPS, Koronadal City',
        contact_number: '0921-555-7766',
        department: 'Financial',
        status: 'Active',
        created_at: '2026-02-01T09:00:00.000Z',
        updated_at: '2026-08-08T08:00:00.000Z'
    },
    {
        id: 3,
        first_name: 'Elena',
        middle_name: 'R.',
        last_name: 'Cruz',
        suffix: 'N/A',
        username: 'cswdo-officer-bur',
        email: 'elena.cruz@koronadal.gov.ph',
        password_hash: DEFAULT_HASH,
        role: 'CSWDO Officer',
        gender: 'Female',
        address: 'Purok Crossing, Barangay San Roque, Koronadal City',
        contact_number: '0922-666-8899',
        department: 'Burial',
        status: 'Active',
        created_at: '2026-02-15T10:30:00.000Z',
        updated_at: '2026-08-08T08:00:00.000Z'
    },
    {
        id: 4,
        first_name: 'Vicente',
        middle_name: 'M.',
        last_name: 'Morales',
        suffix: 'Jr.',
        username: 'cswdo-officer-med2',
        email: 'vicente.morales@koronadal.gov.ph',
        password_hash: DEFAULT_HASH,
        role: 'CSWDO Officer',
        gender: 'Male',
        address: 'Purok 5, Barangay Sta. Cruz, Koronadal City',
        contact_number: '0923-777-9900',
        department: 'Medical',
        status: 'Active',
        created_at: '2026-03-01T08:30:00.000Z',
        updated_at: '2026-08-08T08:00:00.000Z'
    },
    {
        id: 99,
        first_name: 'Robert',
        middle_name: 'L.',
        last_name: 'Johnson',
        suffix: 'N/A',
        username: 'cswdo-admin',
        email: 'cswdo.admin@koronadal.gov.ph',
        password_hash: DEFAULT_HASH,
        role: 'CSWDO Admin',
        gender: 'Male',
        address: 'CSWDO Central Headquarters, City of Koronadal',
        contact_number: '0917-111-2222',
        department: 'CSWDO',
        status: 'Active',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-08-08T08:00:00.000Z'
    },
    {
        id: 5,
        first_name: 'Aurora',
        middle_name: 'S.',
        last_name: 'Santos',
        suffix: 'N/A',
        username: 'cswdo-officer-archived',
        email: 'aurora.santos@koronadal.gov.ph',
        password_hash: DEFAULT_HASH,
        role: 'CSWDO Officer',
        gender: 'Female',
        address: 'Purok Malipayon, Barangay Morales, Koronadal City',
        contact_number: '0924-888-1122',
        department: 'Financial',
        status: 'Deactivated', // Placed in Archive Section
        created_at: '2026-01-20T09:00:00.000Z',
        updated_at: '2026-07-30T16:00:00.000Z'
    }
];

function getCswdoOfficers(filters = {}) {
    let list = [..._cswdoOfficers];
    if (filters.status && filters.status !== 'ALL') {
        const s = filters.status.toLowerCase();
        list = list.filter(o => o.status.toLowerCase() === s);
    }
    if (filters.department && filters.department !== 'ALL') {
        const d = filters.department.toLowerCase();
        list = list.filter(o => o.department.toLowerCase() === d);
    }
    if (filters.role && filters.role !== 'ALL') {
        const r = filters.role.toLowerCase();
        list = list.filter(o => o.role.toLowerCase() === r);
    }
    if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        list = list.filter(o => 
            o.first_name.toLowerCase().includes(q) ||
            o.last_name.toLowerCase().includes(q) ||
            `${o.first_name} ${o.last_name}`.toLowerCase().includes(q) ||
            o.username.toLowerCase().includes(q) ||
            o.email.toLowerCase().includes(q) ||
            o.department.toLowerCase().includes(q) ||
            o.contact_number.includes(q)
        );
    }
    return list;
}

function findCswdoOfficerById(id) {
    if (!id) return null;
    return _cswdoOfficers.find(o => String(o.id) === String(id));
}

function findCswdoOfficerByUsernameOrEmail(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    return _cswdoOfficers.find(o => 
        o.username.toLowerCase() === clean || 
        o.email.toLowerCase() === clean
    );
}

function addCswdoOfficer(data, adminUser) {
    const id = _cswdoOfficers.length > 0 ? Math.max(..._cswdoOfficers.map(o => o.id)) + 1 : 1;
    
    // Hash password with bcrypt
    const rawPassword = data.password;
    const password_hash = bcrypt.hashSync(rawPassword, 10);

    const newOfficer = {
        id,
        first_name: (data.first_name || '').trim(),
        middle_name: (data.middle_name || '').trim(),
        last_name: (data.last_name || '').trim(),
        suffix: (data.suffix || 'N/A').trim(),
        username: (data.username || '').trim().toLowerCase(),
        email: (data.email || '').trim().toLowerCase(),
        password_hash,
        role: data.role || 'CSWDO Officer',
        gender: data.gender || 'Female',
        address: (data.address || 'City of Koronadal').trim(),
        contact_number: data.contact_number || '09XX-***-XXXX',
        department: data.department || 'Medical',
        status: 'Active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        email_notification_sent: true
    };

    _cswdoOfficers.push(newOfficer);

    // Sync into general users table if needed
    addUser({
        first_name: newOfficer.first_name,
        middle_name: newOfficer.middle_name,
        last_name: newOfficer.last_name,
        suffix: newOfficer.suffix,
        username: newOfficer.username,
        email: newOfficer.email,
        password_hash: newOfficer.password_hash,
        role: newOfficer.role,
        department: 'CSWDO',
        phone: newOfficer.contact_number,
        sex: newOfficer.gender,
        address: newOfficer.address,
        status: 'Active'
    });

    addCswdoActivityLog({
        action: 'CREATE_OFFICER',
        action_title: 'New Officer Account Provisioned',
        beneficiary_name: 'N/A',
        program: `${newOfficer.department} Assistance Dept`,
        admin_id: adminUser.username || adminUser || 'cswdo-admin',
        admin_name: adminUser.fullName || `${adminUser.first_name || ''} ${adminUser.last_name || ''}`.trim() || 'CSWDO Administrator',
        details: `Created officer account "${newOfficer.username}" (${newOfficer.first_name} ${newOfficer.last_name}) for ${newOfficer.department} Dept. Login credentials automatically dispatched via email.`
    });

    return newOfficer;
}

function updateCswdoOfficer(id, data, adminUser) {
    const officer = findCswdoOfficerById(id);
    if (!officer) return null;

    if (data.first_name) officer.first_name = data.first_name.trim();
    if (data.middle_name !== undefined) officer.middle_name = data.middle_name.trim();
    if (data.last_name) officer.last_name = data.last_name.trim();
    if (data.suffix !== undefined) officer.suffix = data.suffix.trim();
    if (data.email) officer.email = data.email.trim().toLowerCase();
    if (data.role) officer.role = data.role;
    if (data.gender) officer.gender = data.gender;
    if (data.address) officer.address = data.address.trim();
    if (data.contact_number) officer.contact_number = data.contact_number.trim();
    if (data.department) officer.department = data.department;
    if (data.status && ['Active', 'Deactivated'].includes(data.status)) officer.status = data.status;

    if (data.password && data.password.length >= 8) {
        officer.password_hash = bcrypt.hashSync(data.password, 10);
    }

    officer.updated_at = new Date().toISOString();

    addCswdoActivityLog({
        action: 'UPDATE_OFFICER',
        action_title: 'Officer Details Updated',
        beneficiary_name: 'N/A',
        program: `${officer.department} Assistance Dept`,
        admin_id: adminUser.username || adminUser || 'cswdo-admin',
        admin_name: adminUser.fullName || `${adminUser.first_name || ''} ${adminUser.last_name || ''}`.trim() || 'CSWDO Administrator',
        details: `Administrator updated officer profile for "${officer.username}" (${officer.first_name} ${officer.last_name}), Dept: ${officer.department}, Status: ${officer.status}.`
    });

    return officer;
}

function toggleCswdoOfficerStatus(id, adminUser) {
    const officer = findCswdoOfficerById(id);
    if (!officer) return null;

    const oldStatus = officer.status;
    officer.status = oldStatus === 'Active' ? 'Deactivated' : 'Active';
    officer.updated_at = new Date().toISOString();

    const actionType = officer.status === 'Active' ? 'ACTIVATE_OFFICER' : 'DEACTIVATE_OFFICER';
    const actionTitle = officer.status === 'Active' ? 'Officer Account Activated' : 'Officer Account Deactivated (Archived)';

    addCswdoActivityLog({
        action: actionType,
        action_title: actionTitle,
        beneficiary_name: 'N/A',
        program: `${officer.department} Assistance Dept`,
        admin_id: adminUser.username || adminUser || 'cswdo-admin',
        admin_name: adminUser.fullName || `${adminUser.first_name || ''} ${adminUser.last_name || ''}`.trim() || 'CSWDO Administrator',
        details: `Account "${officer.username}" status toggled from "${oldStatus}" to "${officer.status}". ${officer.status === 'Deactivated' ? 'Account moved to Archive Section.' : 'Account restored to Active list.'}`
    });

    return officer;
}

function deleteCswdoOfficerPermanently(id, adminUser, reason = 'Permanent administrative purging') {
    const idx = _cswdoOfficers.findIndex(o => String(o.id) === String(id));
    if (idx === -1) return null;

    const deleted = _cswdoOfficers[idx];
    _cswdoOfficers.splice(idx, 1);

    addCswdoActivityLog({
        action: 'DELETE_OFFICER_PERMANENT',
        action_title: 'Officer Account Permanently Deleted',
        beneficiary_name: 'N/A',
        program: `${deleted.department} Assistance Dept`,
        admin_id: adminUser.username || adminUser || 'cswdo-admin',
        admin_name: adminUser.fullName || `${adminUser.first_name || ''} ${adminUser.last_name || ''}`.trim() || 'CSWDO Administrator',
        details: `Permanently removed officer account "${deleted.username}" (ID: ${deleted.id}) from Archive Section. Justification: ${reason}`
    });

    return deleted;
}

module.exports = {
    getUsers,
    findUserById,
    findUserByIdentifier,
    findUserByEmail,
    findUserByPhoneNumber,
    createDualVerificationUser,
    addUser,
    DEFAULT_HASH,
    getInterviews,
    findInterviewById,
    getInterviewsByOfficer,
    getScheduleSlots,
    createScheduleSlot,
    updateScheduleSlot,
    lockScheduleSlot,
    completeScheduleSlot,
    cancelScheduleSlot,
    assignBeneficiariesToSlot,
    checkBeneficiaryDoubleBooking,
    updateInterviewAttendance,
    updateInterviewStatus,
    checkOfficerScheduleConflict,
    addInterview,
    getAttendanceRecords,
    // CSWDO Applications & Funds Exports
    getCswdoApplications,
    findCswdoApplicationById,
    getCswdoFunds,
    getCswdoDashboardSummary,
    getCswdoStatusBreakdown,
    getCswdoMonthlyTrend,
    getCswdoRecentActivity,
    addCswdoActivityLog,
    approveCswdoApplication,
    denyCswdoApplication,
    releaseCswdoApplicationFunds,
    // CSWDO Officer Management Exports
    getCswdoOfficers,
    findCswdoOfficerById,
    findCswdoOfficerByUsernameOrEmail,
    addCswdoOfficer,
    updateCswdoOfficer,
    toggleCswdoOfficerStatus,
    deleteCswdoOfficerPermanently
};



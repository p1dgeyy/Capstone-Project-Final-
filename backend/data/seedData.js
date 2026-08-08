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

// In-memory Interview Schedules Store
const _interviews = [
    {
        interview_id: 'INT-2026-001',
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
        application_id: 'APP-2026-001',
        date_applied: '2026-07-28',
        interview_date: '2026-08-08',
        schedule_time: '09:00 AM - 10:00 AM',
        time_slot: '09:00 AM',
        venue_location: 'PESO Main Office - Interview Room A',
        status: 'Pending', // 'Pending', 'Completed', 'Missed', 'Scheduled', 'Cancelled'
        attendance_status: 'Unmarked', // 'Unmarked', 'Present', 'Absent'
        presence_flag: 'Unmarked',
        remarks: 'Scheduled for initial qualification interview and livelihood assessment.',
        justification: null,
        created_at: '2026-08-01T08:00:00.000Z',
        updated_at: '2026-08-08T08:00:00.000Z'
    },
    {
        interview_id: 'INT-2026-002',
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
        application_id: 'APP-2026-002',
        date_applied: '2026-07-29',
        interview_date: '2026-08-08',
        schedule_time: '10:30 AM - 11:30 AM',
        time_slot: '10:30 AM',
        venue_location: 'PESO Main Office - Interview Room B',
        status: 'Completed',
        attendance_status: 'Present',
        presence_flag: 'Present',
        remarks: 'Candidate successfully presented business proposal and passed interview assessment.',
        justification: null,
        created_at: '2026-08-01T08:30:00.000Z',
        updated_at: '2026-08-08T10:35:00.000Z'
    },
    {
        interview_id: 'INT-2026-003',
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
        application_id: 'APP-2026-003',
        date_applied: '2026-07-30',
        interview_date: '2026-08-08',
        schedule_time: '01:30 PM - 02:30 PM',
        time_slot: '01:30 PM',
        venue_location: 'PESO Main Office - Interview Room A',
        status: 'Pending',
        attendance_status: 'Unmarked',
        presence_flag: 'Unmarked',
        remarks: 'Afternoon interview session for technical internship placement.',
        justification: null,
        created_at: '2026-08-02T09:00:00.000Z',
        updated_at: '2026-08-08T08:00:00.000Z'
    },
    {
        interview_id: 'INT-2026-004',
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
        application_id: 'APP-2026-004',
        date_applied: '2026-08-01',
        interview_date: '2026-08-09',
        schedule_time: '09:00 AM - 10:00 AM',
        time_slot: '09:00 AM',
        venue_location: 'PESO Main Office - Interview Room A',
        status: 'Pending',
        attendance_status: 'Unmarked',
        presence_flag: 'Unmarked',
        remarks: 'Tomorrow morning interview schedule.',
        justification: null,
        created_at: '2026-08-03T10:00:00.000Z',
        updated_at: '2026-08-08T08:00:00.000Z'
    },
    {
        interview_id: 'INT-2026-005',
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
        application_id: 'APP-2026-005',
        date_applied: '2026-07-20',
        interview_date: '2026-08-05', // Past date for testing past-date restriction
        schedule_time: '11:00 AM - 12:00 PM',
        time_slot: '11:00 AM',
        venue_location: 'PESO Main Office - Interview Room B',
        status: 'Missed',
        attendance_status: 'Absent',
        presence_flag: 'Absent',
        remarks: 'Applicant was unable to attend due to medical emergency.',
        justification: 'Logged official beneficiary absence notice.',
        created_at: '2026-07-25T08:00:00.000Z',
        updated_at: '2026-08-05T12:00:00.000Z'
    },
    {
        interview_id: 'INT-2026-006',
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
        application_id: 'APP-2026-006',
        date_applied: '2026-08-02',
        interview_date: '2026-08-10',
        schedule_time: '10:00 AM - 11:00 AM',
        time_slot: '10:00 AM',
        venue_location: 'PESO Main Office - Interview Room A',
        status: 'Pending',
        attendance_status: 'Unmarked',
        presence_flag: 'Unmarked',
        remarks: 'Scheduled interview session.',
        justification: null,
        created_at: '2026-08-04T09:00:00.000Z',
        updated_at: '2026-08-08T08:00:00.000Z'
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
        i.interview_id.toLowerCase() === str
    );
}

function getInterviewsByOfficer(officerId, filters = {}) {
    let list = _interviews.filter(i => 
        !officerId || 
        i.officer_id === Number(officerId) || 
        officerId === 'all' || 
        officerId === 'ALL'
    );

    if (filters.date) {
        list = list.filter(i => i.interview_date === filters.date);
    }
    if (filters.status && filters.status !== 'ALL') {
        const s = filters.status.toLowerCase();
        list = list.filter(i => i.status.toLowerCase() === s);
    }
    if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        list = list.filter(i => 
            i.beneficiary_name.toLowerCase().includes(q) ||
            i.beneficiary_id.toLowerCase().includes(q) ||
            i.interview_id.toLowerCase().includes(q) ||
            (i.program_code && i.program_code.toLowerCase().includes(q)) ||
            (i.program_name && i.program_name.toLowerCase().includes(q)) ||
            (i.barangay && i.barangay.toLowerCase().includes(q))
        );
    }

    return list;
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
        if (i.status === 'Cancelled') return false;
        if (excludeInterviewId && (i.interview_id === excludeInterviewId || String(i.id) === String(excludeInterviewId))) return false;

        const existingSlot = i.schedule_time.toLowerCase();
        const existingStart = existingSlot.split(' - ')[0].trim();
        const incomingStart = cleanTime.split(' - ')[0].trim();

        return existingSlot.includes(cleanTime) || 
               cleanTime.includes(existingSlot) || 
               existingStart === incomingStart ||
               existingSlot.includes(incomingStart);
    });
}

function addInterview(data) {
    const id = _interviews.length > 0 ? Math.max(..._interviews.map(i => i.id)) + 1 : 1;
    const interview_id = data.interview_id || `INT-2026-${String(id).padStart(3, '0')}`;
    const newInterview = {
        id,
        interview_id,
        officer_id: data.officer_id || 2,
        officer_name: data.officer_name || 'Jane Smith',
        beneficiary_id: data.beneficiary_id || `BEN-2026-${String(id).padStart(3, '0')}`,
        beneficiary_name: data.beneficiary_name,
        beneficiary_phone: data.beneficiary_phone || '0917-111-2222',
        beneficiary_email: data.beneficiary_email || 'beneficiary@koronadal.ph',
        beneficiary_address: data.beneficiary_address || 'Koronadal City',
        barangay: data.barangay || 'Poblacion',
        sex: data.sex || 'Male',
        age: data.age || 30,
        documents_verified: true,
        program_id: data.program_id || 'PRG-TUPAD',
        program_code: data.program_code || 'TUPAD',
        program_name: data.program_name || 'TUPAD (Emergency Employment Assistance)',
        project_type: data.project_type || 'Community Assistance',
        application_id: data.application_id || `APP-2026-${String(id).padStart(3, '0')}`,
        date_applied: data.date_applied || new Date().toISOString().split('T')[0],
        interview_date: data.interview_date || new Date().toISOString().split('T')[0],
        schedule_time: data.schedule_time || '09:00 AM - 10:00 AM',
        time_slot: data.time_slot || '09:00 AM',
        venue_location: data.venue_location || 'PESO Main Office - Interview Room A',
        status: data.status || 'Pending',
        attendance_status: data.attendance_status || 'Unmarked',
        presence_flag: data.presence_flag || 'Unmarked',
        remarks: data.remarks || 'Scheduled interview session.',
        justification: data.justification || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    _interviews.push(newInterview);
    return newInterview;
}

function getAttendanceRecords(filters = {}) {
    let list = [..._attendanceRecords];
    if (filters.interview_id) {
        list = list.filter(a => a.interview_id === filters.interview_id);
    }
    return list;
}

module.exports = {
    getUsers,
    findUserById,
    findUserByIdentifier,
    addUser,
    DEFAULT_HASH,
    getInterviews,
    findInterviewById,
    getInterviewsByOfficer,
    updateInterviewAttendance,
    updateInterviewStatus,
    checkOfficerScheduleConflict,
    addInterview,
    getAttendanceRecords
};

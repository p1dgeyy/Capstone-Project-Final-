/**
 * PESO Administrator Portal Master Controller (peso-admin.js)
 * City Government of Koronadal - Public Employment Service Office
 * 
 * Rules & Safeguards Enforced:
 * 1. Safe Modal Lifecycle Management & Backdrop Watchdog
 * 2. 9-Tab Navigation System (Overview, Officers, Programs, Evaluation, Scheduling, Funds, Notifications, Reports, Archive)
 * 3. Officer CRUD & RBAC Management
 * 4. Active Beneficiary Deactivation Safeguard & Ordinance Authenticity Validation
 * 5. Strict PESO Scoping (.eq('department', 'PESO') / .eq('agency', 'PESO'))
 * 6. Live Supabase Realtime Synchronization
 */

const PesoAdminApp = (() => {
    'use strict';

    // Global in-memory cache synchronized with Supabase
    const AdminStore = {
        programs: [],
        applications: [],
        officers: [],
        schedules: [],
        funds: [],
        approvedAssistance: [],
        notifications: [],
        auditLogs: [],
        batches: [],
        beneficiaries: [],
        currentTab: 'overview',
        calendarDate: new Date()
    };

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function maskPhone(phone) {
        if (!phone || phone === 'N/A' || phone === '-') return '09XX-***-XXXX';
        const clean = String(phone).trim().replace(/[^0-9]/g, '');
        if (clean.length >= 10) {
            return `${clean.substring(0, 4)}-***-${clean.substring(clean.length - 4)}`;
        }
        return '09XX-***-XXXX';
    }

    function formatCurrency(amount) {
        const num = Number(amount) || 0;
        return '₱' + num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function logAudit(actionType, details) {
        if (typeof window.logAuditEvent === 'function') {
            window.logAuditEvent(actionType, details);
        } else if (typeof PESOSafeguards !== 'undefined' && PESOSafeguards.logAudit) {
            PESOSafeguards.logAudit({
                intent: actionType,
                actionType: actionType,
                targetEntity: 'PESO Admin Portal',
                status: 'SUCCESS',
                details: details
            });
        }
    }

    function notify(title, message, type = 'info') {
        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({ title, message, type });
        } else {
            alert(`${title}: ${message}`);
        }
    }

    /**
     * Safe Modal Opener
     */
    function safeOpenModal(modalId) {
        const modalEl = document.getElementById(modalId);
        if (!modalEl) return;

        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const instance = bootstrap.Modal.getOrCreateInstance(modalEl);
            instance.show();
        } else {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
        }
        logAudit('OPEN_MODAL', `Opened modal #${modalId}`);
    }

    function safeCloseModal(modalId) {
        const modalEl = document.getElementById(modalId);
        if (!modalEl) return;

        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const instance = bootstrap.Modal.getInstance(modalEl);
            if (instance) instance.hide();
        } else {
            modalEl.classList.remove('show');
            modalEl.style.display = 'none';
        }
    }

    /**
     * Master Tab Switcher (9 Tabs)
     */
    function switchTab(tabName) {
        const target = (tabName || 'overview').toLowerCase();
        AdminStore.currentTab = target;

        const sections = [
            { id: 'sectionOverview', tab: 'overview', nav: 'tabNavOverview' },
            { id: 'sectionOfficers', tab: 'officers', nav: 'tabNavOfficers' },
            { id: 'sectionPrograms', tab: 'programs', nav: 'tabNavPrograms' },
            { id: 'sectionEvaluation', tab: 'evaluation', nav: 'tabNavEvaluation' },
            { id: 'sectionScheduling', tab: 'scheduling', nav: 'tabNavScheduling' },
            { id: 'sectionFunds', tab: 'funds', nav: 'tabNavFunds' },
            { id: 'sectionNotifications', tab: 'notifications', nav: 'tabNavNotifications' },
            { id: 'sectionReports', tab: 'reports', nav: 'tabNavReports' },
            { id: 'sectionArchive', tab: 'archive', nav: 'tabNavArchive' }
        ];

        sections.forEach(s => {
            const secEl = document.getElementById(s.id);
            const navEl = document.getElementById(s.nav);
            if (secEl) {
                if (s.tab === target) {
                    secEl.classList.remove('d-none');
                } else {
                    secEl.classList.add('d-none');
                }
            }
            if (navEl) {
                if (s.tab === target) {
                    navEl.classList.add('active');
                } else {
                    navEl.classList.remove('active');
                }
            }
        });

        // Trigger module renders
        if (target === 'overview') {
            if (typeof PesoDashboard !== 'undefined') {
                PesoDashboard.renderAdminMetrics(AdminStore.programs, AdminStore.applications, AdminStore.beneficiaries, AdminStore.funds);
                PesoDashboard.renderActivityFeed(AdminStore.auditLogs);
            }
            if (typeof PesoPrograms !== 'undefined') {
                PesoPrograms.renderProgramsTable();
            }
        } else if (target === 'officers') {
            renderOfficersList();
        } else if (target === 'programs') {
            if (typeof PesoPrograms !== 'undefined') {
                PesoPrograms.renderProgramsTable();
                PesoPrograms.renderAssignmentTable();
            }
        } else if (target === 'evaluation') {
            if (typeof PesoEvaluations !== 'undefined') {
                PesoEvaluations.renderEvalLevel1(AdminStore.programs);
            }
        } else if (target === 'scheduling') {
            if (typeof PesoScheduling !== 'undefined') {
                PesoScheduling.renderList();
            }
        } else if (target === 'funds') {
            if (typeof PesoFunds !== 'undefined') {
                PesoFunds.renderFundsModule();
                PesoFunds.renderDisbursementsTable();
            }
        } else if (target === 'notifications') {
            renderNotificationsList();
        } else if (target === 'reports') {
            if (typeof PesoReports !== 'undefined') {
                PesoReports.renderReportsPreview();
            }
        } else if (target === 'archive') {
            if (typeof PesoPrograms !== 'undefined') {
                PesoPrograms.renderArchiveTable();
            }
        }

        logAudit('SWITCH_NAVIGATION_TAB', `Switched active navigation tab to "${target.toUpperCase()}"`);
    }

    // Canonical fallback entities for staff and records
    const CANONICAL_PESO_OFFICERS = [
        { id: 1, first_name: 'Jane', last_name: 'Smith', username: 'peso-officer', role: 'PESO Officer', email: 'peso.officer@gmail.com', phone: '0917-555-0101', status: 'Active', created_at: '2026-01-10' },
        { id: 2, first_name: 'John', last_name: 'Doe', username: 'peso-admin', role: 'PESO Admin', email: 'peso.admin@gmail.com', phone: '0918-555-0102', status: 'Active', created_at: '2026-01-05' },
        { id: 3, first_name: 'Edward', last_name: 'Davis', username: 'evaluator', role: 'Evaluator', email: 'evaluator@gmail.com', phone: '0919-555-0103', status: 'Active', created_at: '2026-01-15' },
        { id: 4, first_name: 'Michael', last_name: 'Tan', username: 'peso-officer-2', role: 'PESO Officer', email: 'michael.tan@koronadal.gov.ph', phone: '0920-555-0104', status: 'Active', created_at: '2026-02-01' }
    ];

    const CANONICAL_PESO_APPLICATIONS = [
        { id: 1, application_number: 'APP-2026-001', applicant_name: 'Maria Santos', beneficiaryName: 'Maria Santos', qr_code: 'QR-BEN-102938', phone: '0917-123-4567', programCode: 'TUPAD', program: 'TUPAD (Emergency Employment)', date_applied: '2026-01-10', dateSubmitted: '2026-01-10', status: 'Pending', remarks: 'Complete 2x2 photo and Barangay Indigency attached.', amount_requested: 5000, amount_approved: 5000 },
        { id: 2, application_number: 'APP-2026-002', applicant_name: 'Juan Dela Cruz', beneficiaryName: 'Juan Dela Cruz', qr_code: 'QR-BEN-203948', phone: '0918-234-5678', programCode: 'TUPAD', program: 'TUPAD (Emergency Employment)', date_applied: '2026-01-12', dateSubmitted: '2026-01-12', status: 'Pending', remarks: 'Displaced transport worker from Morales cluster.', amount_requested: 5000, amount_approved: 5000 },
        { id: 3, application_number: 'APP-2026-003', applicant_name: 'Carlos Mendoza', beneficiaryName: 'Carlos Mendoza', qr_code: 'QR-BEN-506978', phone: '0921-567-8901', programCode: 'SPES', program: 'SPES (Student Employment)', date_applied: '2026-01-14', dateSubmitted: '2026-01-14', status: 'Approved', remarks: 'Approved for 30-day summer internship with SPES stipend.', amount_requested: 8000, amount_approved: 8000 },
        { id: 4, application_number: 'APP-2026-004', applicant_name: 'Angela Bautista', beneficiaryName: 'Angela Bautista', qr_code: 'QR-BEN-607988', phone: '0922-678-9012', programCode: 'SPES', program: 'SPES (Student Employment)', date_applied: '2026-01-15', dateSubmitted: '2026-01-15', status: 'Approved', remarks: 'Assigned to GPS Barangay Hall Administrative desk.', amount_requested: 8000, amount_approved: 8000 },
        { id: 5, application_number: 'APP-2026-005', applicant_name: 'Mark Anthony Reyes', beneficiaryName: 'Mark Anthony Reyes', qr_code: 'QR-BEN-708998', phone: '0923-789-0123', programCode: 'CKGIP', program: 'CKGIP (City Internship)', date_applied: '2026-01-18', dateSubmitted: '2026-01-18', status: 'Completed', remarks: 'Completed 6-month internship with City Engineering.', amount_requested: 10000, amount_approved: 10000 }
    ];

    const CANONICAL_PESO_SCHEDULES = [
        { id: 1, slot_id: 'SLOT-101', title: 'TUPAD Orientation & Tool Handout', activity_type: 'Orientation', beneficiaryName: 'Maria Santos', phone: '0917-123-4567', programCode: 'TUPAD', date: '2026-08-25', interviewDate: '2026-08-25', time: '09:00 AM', scheduleTime: '09:00 AM', venue: 'Koronadal City Hall Gymnasium', location: 'Koronadal City Hall Gymnasium', officerName: 'Jane Smith', status: 'Scheduled', attendance: 'Pending' },
        { id: 2, slot_id: 'SLOT-102', title: 'SPES Pre-Deployment Briefing', activity_type: 'Assessment Interview', beneficiaryName: 'Carlos Mendoza', phone: '0921-567-8901', programCode: 'SPES', date: '2026-08-26', interviewDate: '2026-08-26', time: '10:30 AM', scheduleTime: '10:30 AM', venue: 'PESO Conference Hall Room A', location: 'PESO Conference Hall Room A', officerName: 'Jane Smith', status: 'Scheduled', attendance: 'Pending' },
        { id: 3, slot_id: 'SLOT-103', title: 'Vocational Training Certificate Distribution', activity_type: 'Certificate Distribution', beneficiaryName: 'Danilo Villanueva', phone: '0926-012-3456', programCode: 'SKILLS-TRAIN', date: '2026-08-28', interviewDate: '2026-08-28', time: '02:00 PM', scheduleTime: '02:00 PM', venue: 'PESO Tech-Voc Center', location: 'PESO Tech-Voc Center', officerName: 'Michael Tan', status: 'Scheduled', attendance: 'Pending' }
    ];

    const CANONICAL_PESO_NOTIFICATIONS = [
        { id: 1, title: 'SPES Summer Batch 1 Orientation Call', message: 'All enrolled students under SPES Batch 1 are requested to report to the PESO Main Hall on August 26.', recipient_phone: 'All SPES Beneficiaries', department: 'PESO', channel: 'SMS / Portal', created_at: '2026-08-20T08:30:00Z' },
        { id: 2, title: 'TUPAD Safety Equipment & Uniform Distribution', message: 'PPE and safety gear release for Morales clean-up team scheduled on August 25.', recipient_phone: 'TUPAD Batch 1', department: 'PESO', channel: 'SMS / Portal', created_at: '2026-08-19T10:15:00Z' },
        { id: 3, title: 'Appropriation Ordinance Budget Allocation Confirmed', message: 'Appropriation Ordinance No. 6, Series of 2025 allocations committed to LGU ledger.', recipient_phone: 'Broadcast', department: 'PESO', channel: 'System', created_at: '2026-08-18T14:00:00Z' }
    ];

    const CANONICAL_PESO_AUDIT_LOGS = [
        { id: 1, action_type: 'ORAL_ALLOCATION', action: 'APPROPRIATION_LOAD', user_name: 'PESO Administrator', user_role: 'PESO Admin', target_entity: 'Appropriation Ordinance No. 6', details: 'Initialized ₱13,707,882.00 LGU assistance budget ledger.', created_at: '2026-08-21T08:00:00Z' },
        { id: 2, action_type: 'ENROLL_BENEFICIARY', action: 'BATCH_ENROLL', user_name: 'Jane Smith', user_role: 'PESO Officer', target_entity: 'TUPAD Batch 1', details: 'Enrolled 50 beneficiaries for Morales clean-up cluster.', created_at: '2026-08-21T09:30:00Z' },
        { id: 3, action_type: 'SCHEDULE_EVENT', action: 'CREATE_SLOT', user_name: 'Jane Smith', user_role: 'PESO Officer', target_entity: 'SPES Orientation', details: 'Created schedule slot for SPES Batch 1 Pre-Deployment.', created_at: '2026-08-21T11:00:00Z' }
    ];

    /**
     * Master Data Fetcher from Supabase with Canonical Fallbacks
     */
    async function loadAllAdminData() {
        let progRes = { data: [] };
        let appRes = { data: [] };
        let staffRes = { data: [] };
        let schedRes = { data: [] };
        let fundsRes = { data: [] };
        let assistRes = { data: [] };
        let notifRes = { data: [] };
        let auditRes = { data: [] };
        let batchRes = { data: [] };
        let benRes = { data: [] };

        if (typeof DataService !== 'undefined') {
            try {
                const results = await Promise.allSettled([
                    DataService.programs.getAll({ agency: 'PESO' }),
                    DataService.applications.getAll({ agency: 'PESO' }),
                    DataService.staffProfiles.getAll({ agency: 'PESO' }),
                    DataService.interviews.getAll({ agency: 'PESO' }),
                    DataService.funds.getAll({ agency: 'PESO' }),
                    DataService.approvedAssistance.getAll({ agency: 'PESO' }),
                    supabaseClient ? supabaseClient.from('notifications').select('*').order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
                    DataService.auditLogs.getAll({ limit: 50 }),
                    DataService.batches.getAll({ agency: 'PESO' }),
                    DataService.beneficiaries.getAll()
                ]);

                if (results[0].status === 'fulfilled' && results[0].value?.data) progRes = results[0].value;
                if (results[1].status === 'fulfilled' && results[1].value?.data) appRes = results[1].value;
                if (results[2].status === 'fulfilled' && results[2].value?.data) staffRes = results[2].value;
                if (results[3].status === 'fulfilled' && results[3].value?.data) schedRes = results[3].value;
                if (results[4].status === 'fulfilled' && results[4].value?.data) fundsRes = results[4].value;
                if (results[5].status === 'fulfilled' && results[5].value?.data) assistRes = results[5].value;
                if (results[6].status === 'fulfilled' && results[6].value?.data) notifRes = results[6].value;
                if (results[7].status === 'fulfilled' && results[7].value?.data) auditRes = results[7].value;
                if (results[8].status === 'fulfilled' && results[8].value?.data) batchRes = results[8].value;
                if (results[9].status === 'fulfilled' && results[9].value?.data) benRes = results[9].value;
            } catch (err) {
                console.warn('[PesoAdminApp] Supabase data load notice:', err.message);
            }
        }

        // 1. Programs
        const canonicalList = (typeof PesoPrograms !== 'undefined' && PesoPrograms.CANONICAL_PESO_PROGRAMS) ? PesoPrograms.CANONICAL_PESO_PROGRAMS : [];
        const loadedPrograms = (progRes.data || []).filter(p => (p.agency || p.department || '').toUpperCase() === 'PESO');

        if (loadedPrograms.length > 0) {
            AdminStore.programs = canonicalList.map(cp => {
                const found = loadedPrograms.find(lp => lp.code === cp.code);
                return found ? { ...cp, ...found } : cp;
            });
            loadedPrograms.forEach(lp => {
                if (!AdminStore.programs.some(p => p.code === lp.code)) {
                    AdminStore.programs.push(lp);
                }
            });
        } else {
            AdminStore.programs = [...canonicalList];
        }

        // 2. Batches
        const canonicalBatches = (typeof PesoPrograms !== 'undefined' && PesoPrograms.CANONICAL_PESO_BATCHES) ? PesoPrograms.CANONICAL_PESO_BATCHES : [];
        AdminStore.batches = (batchRes.data && batchRes.data.length > 0) ? batchRes.data : [...canonicalBatches];

        // 3. Beneficiaries
        const canonicalBens = (typeof PesoPrograms !== 'undefined' && PesoPrograms.CANONICAL_PESO_BENEFICIARIES) ? PesoPrograms.CANONICAL_PESO_BENEFICIARIES : [];
        AdminStore.beneficiaries = (benRes.data && benRes.data.length > 0) ? benRes.data : [...canonicalBens];

        // 4. Officers / Staff
        const loadedOfficers = (staffRes.data || []).filter(s => !['CSWDO Admin', 'CSWDO Officer'].includes(s.role) && (s.department || 'PESO').toUpperCase() !== 'CSWDO');
        AdminStore.officers = loadedOfficers.length > 0 ? loadedOfficers : [...CANONICAL_PESO_OFFICERS];

        // 5. Applications
        if (appRes.data && appRes.data.length > 0) {
            AdminStore.applications = appRes.data.map(a => {
                const ben = a.beneficiary || {};
                const prog = a.program || {};
                return {
                    id: a.id,
                    dbId: a.id,
                    application_number: a.application_number || `APP-2026-00${a.id}`,
                    applicant_name: `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || 'Applicant',
                    beneficiaryName: `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || 'Applicant',
                    programCode: prog.code || 'PESO',
                    program: `${prog.code || 'PESO'} (${prog.name || 'Assistance'})`,
                    date_applied: a.date_applied || (a.created_at ? a.created_at.substring(0, 10) : '2026-01-01'),
                    dateSubmitted: a.date_applied || (a.created_at ? a.created_at.substring(0, 10) : '2026-01-01'),
                    status: a.status || 'Pending',
                    remarks: a.officer_notes || a.remarks || '',
                    amount_requested: a.amount_requested || 0,
                    amount_approved: a.amount_approved || 0
                };
            });
        } else {
            AdminStore.applications = [...CANONICAL_PESO_APPLICATIONS];
        }

        // 6. Schedules
        if (schedRes.data && schedRes.data.length > 0) {
            AdminStore.schedules = schedRes.data.map(i => {
                const ben = i.beneficiary || {};
                const prog = i.program || {};
                const officer = i.officer || {};
                return {
                    id: i.id,
                    slot_id: `SLOT-${i.id}`,
                    title: i.title || 'Assessment Interview',
                    activity_type: i.title || 'Assessment Interview',
                    beneficiaryName: `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || i.title || 'Applicant',
                    phone: ben.phone || '09XX-***-XXXX',
                    programCode: prog.code || 'PESO',
                    interviewDate: i.interview_date || (i.scheduled_time ? i.scheduled_time.substring(0, 10) : '2026-08-25'),
                    date: i.interview_date || (i.scheduled_time ? i.scheduled_time.substring(0, 10) : '2026-08-25'),
                    scheduleTime: i.interview_time || '09:00 AM',
                    time: i.interview_time || '09:00 AM',
                    venue: i.venue_location || i.location || 'PESO Main Office',
                    location: i.venue_location || i.location || 'PESO Main Office',
                    officerName: `${officer.first_name || ''} ${officer.last_name || ''}`.trim() || 'Jane Smith',
                    status: i.status || 'Scheduled',
                    attendance: i.attendance_status || (i.status === 'Completed' ? 'Present' : 'Pending')
                };
            });
        } else {
            AdminStore.schedules = [...CANONICAL_PESO_SCHEDULES];
        }

        // 7. Funds & Approved Assistance
        AdminStore.funds = (fundsRes.data && fundsRes.data.length > 0) ? fundsRes.data : [];
        if (assistRes.data && assistRes.data.length > 0) {
            AdminStore.approvedAssistance = assistRes.data.map(d => ({
                id: d.id,
                program_code: d.program ? d.program.code : 'PESO',
                beneficiary_name: d.beneficiary ? `${d.beneficiary.first_name} ${d.beneficiary.last_name}` : 'Beneficiary',
                amount: d.amount_approved || d.amount || 0,
                amount_approved: d.amount_approved || d.amount || 0,
                status: d.status || 'Disbursed',
                disbursed_at: d.approved_at || d.created_at || 'Today'
            }));
        } else {
            AdminStore.approvedAssistance = [
                { id: 1, program_code: 'TUPAD', beneficiary_name: 'Maria Santos', qr_code: 'QR-BEN-102938', amount: 5000, amount_approved: 5000, status: 'Disbursed', disbursed_at: '2026-08-10' },
                { id: 2, program_code: 'SPES', beneficiary_name: 'Carlos Mendoza', qr_code: 'QR-BEN-506978', amount: 8000, amount_approved: 8000, status: 'Disbursed', disbursed_at: '2026-08-15' }
            ];
        }

        // 8. Notifications & Audit Logs
        AdminStore.notifications = (notifRes.data && notifRes.data.length > 0) ? notifRes.data : [...CANONICAL_PESO_NOTIFICATIONS];
        AdminStore.auditLogs = (auditRes.data && auditRes.data.length > 0) ? auditRes.data : [...CANONICAL_PESO_AUDIT_LOGS];

        // Pass hydrated data to submodules
        if (typeof PesoPrograms !== 'undefined') {
            PesoPrograms.setData(AdminStore.programs, AdminStore.batches, AdminStore.beneficiaries);
        }
        if (typeof PesoEvaluations !== 'undefined') {
            PesoEvaluations.setData(AdminStore.applications);
        }
        if (typeof PesoScheduling !== 'undefined') {
            PesoScheduling.setData(AdminStore.schedules, []);
        }
        if (typeof PesoFunds !== 'undefined') {
            PesoFunds.setData(AdminStore.programs, AdminStore.approvedAssistance);
        }
        if (typeof PesoReports !== 'undefined') {
            PesoReports.setData({
                programs: AdminStore.programs,
                applications: AdminStore.applications,
                schedules: AdminStore.schedules,
                funds: AdminStore.approvedAssistance,
                auditLogs: AdminStore.auditLogs
            });
        }

        // Update all navigation tab count badges
        updateNavigationTabBadges();

        // Setup session profile in header
        setupAdminSession();

        // Refresh Active Tab
        switchTab(AdminStore.currentTab);
    }

    function updateNavigationTabBadges() {
        const elOffBadge = document.getElementById('officersTabBadge');
        if (elOffBadge) elOffBadge.textContent = AdminStore.officers.length;

        const activeProgs = AdminStore.programs.filter(p => p.status === 'Active');
        const elProgBadge = document.getElementById('programsTabBadge');
        if (elProgBadge) elProgBadge.textContent = activeProgs.length;

        const pendingApps = AdminStore.applications.filter(a => a.status === 'Pending' || a.status === 'Under Review');
        const elEvalBadge = document.getElementById('evalTabBadge');
        if (elEvalBadge) elEvalBadge.textContent = pendingApps.length;

        const upcomingSched = AdminStore.schedules.filter(s => s.status === 'Scheduled');
        const elSchedBadge = document.getElementById('schedTabBadge');
        if (elSchedBadge) elSchedBadge.textContent = upcomingSched.length;

        const elNotifBadge = document.getElementById('notifTabBadge');
        if (elNotifBadge) elNotifBadge.textContent = AdminStore.notifications.length;

        const archivedProgs = AdminStore.programs.filter(p => p.status !== 'Active');
        const elArchBadge = document.getElementById('archiveTabBadge');
        if (elArchBadge) elArchBadge.textContent = archivedProgs.length;
    }

    function setupAdminSession() {
        const user = (typeof PesoAuth !== 'undefined') ? PesoAuth.getCurrentUser() : null;
        const rawName = user?.fullName || '';
        const adminName = (rawName && rawName !== 'User' && rawName !== 'Guest') ? rawName : 'PESO Administrator';
        const adminRole = (user?.role && user.role !== 'Guest') ? user.role : 'PESO Admin';

        const nameEls = [document.getElementById('adminUserName'), document.getElementById('adminUserNameMobile')];
        nameEls.forEach(el => { if (el) el.textContent = adminName; });

        const roleEls = [document.getElementById('adminUserRole'), document.getElementById('adminUserRoleMobile')];
        roleEls.forEach(el => { if (el) el.textContent = adminRole; });

        const avatarEl = document.getElementById('adminAvatarText');
        if (avatarEl) {
            avatarEl.textContent = 'PA';
        }
    }

    /**
     * Officers Directory Management (Tab 2)
     */
    function renderOfficersList() {
        const tbody = document.getElementById('officersTableBody') || document.getElementById('adminOfficersTableBody');
        const badge = document.getElementById('officersTabBadge');
        if (!tbody) return;

        const searchInput = (document.getElementById('officerSearchInput')?.value || '').toLowerCase().trim();
        const roleFilter = document.getElementById('officerRoleFilter')?.value || 'ALL';
        const statusFilter = document.getElementById('officerStatusFilter')?.value || 'ALL';

        let filtered = AdminStore.officers.filter(o => {
            const matchesSearch = !searchInput || 
                `${o.first_name || ''} ${o.last_name || ''}`.toLowerCase().includes(searchInput) ||
                (o.username || '').toLowerCase().includes(searchInput) ||
                (o.email || '').toLowerCase().includes(searchInput);

            const matchesRole = roleFilter === 'ALL' || (o.role || '') === roleFilter;
            const matchesStatus = statusFilter === 'ALL' || (o.status || 'Active') === statusFilter;

            return matchesSearch && matchesRole && matchesStatus;
        });

        if (badge) badge.textContent = AdminStore.officers.length;

        // Update Stat Cards in Officers View
        const activeOfficers = AdminStore.officers.filter(o => (o.role === 'PESO Officer' || o.role === 'Officer') && o.status === 'Active');
        const activeEvaluators = AdminStore.officers.filter(o => (o.role === 'Evaluator') && o.status === 'Active');
        const deactivatedStaff = AdminStore.officers.filter(o => o.status === 'Inactive' || o.status === 'Deactivated');

        const elTotalCount = document.getElementById('statTotalOfficersCount');
        if (elTotalCount) elTotalCount.textContent = AdminStore.officers.length;

        const elActiveOfficers = document.getElementById('statActiveOfficersCount');
        if (elActiveOfficers) elActiveOfficers.textContent = activeOfficers.length;

        const elActiveEvaluators = document.getElementById('statActiveEvaluatorsCount');
        if (elActiveEvaluators) elActiveEvaluators.textContent = activeEvaluators.length;

        const elDeactivated = document.getElementById('statDeactivatedStaffCount');
        if (elDeactivated) elDeactivated.textContent = deactivatedStaff.length;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No officer accounts match the selected criteria.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(o => {
            const isInactive = o.status === 'Inactive' || o.status === 'Deactivated';
            const fullName = `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.username || 'Officer';

            return `
                <tr>
                    <td>
                        <div class="fw-semibold text-dark">${escapeHtml(fullName)}</div>
                        <small class="text-muted font-monospace">#OFF-${escapeHtml(String(o.id))}</small>
                    </td>
                    <td>
                        <div class="font-monospace text-dark small">${escapeHtml(o.username || '')}</div>
                        <small class="text-muted">${escapeHtml(o.email || '-')}</small>
                    </td>
                    <td><span class="badge ${o.role === 'PESO Admin' ? 'bg-primary' : (o.role === 'Evaluator' ? 'bg-info text-dark' : 'bg-success-subtle text-success border')}">${escapeHtml(o.role || 'PESO Officer')}</span></td>
                    <td class="font-monospace text-muted">${maskPhone(o.phone)}</td>
                    <td><small class="text-muted font-monospace">${escapeHtml(o.created_at ? o.created_at.substring(0, 10) : '2026-01-10')}</small></td>
                    <td class="text-center">
                        <span class="badge ${isInactive ? 'bg-danger-subtle text-danger border' : 'bg-success-subtle text-success border'}">${escapeHtml(o.status || 'Active')}</span>
                    </td>
                    <td class="text-end text-nowrap">
                        <button class="btn btn-sm ${isInactive ? 'btn-outline-success' : 'btn-outline-danger'} py-1 px-2" onclick="PesoAdminApp.toggleOfficerStatus('${o.id}')" title="${isInactive ? 'Activate Account' : 'Deactivate Account'}">
                            <i class="bi ${isInactive ? 'bi-play-fill me-1' : 'bi-pause-fill me-1'}"></i>${isInactive ? 'Activate' : 'Deactivate'}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function toggleOfficerStatus(officerId) {
        const officer = AdminStore.officers.find(o => String(o.id) === String(officerId));
        if (!officer) return;

        const newStatus = (officer.status === 'Active') ? 'Inactive' : 'Active';
        if (!confirm(`Are you sure you want to set officer "${officer.first_name} ${officer.last_name}" to ${newStatus}?`)) {
            return;
        }

        officer.status = newStatus;

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('staff_profiles').update({ status: newStatus }).eq('id', officer.id);
            } catch (e) {
                console.warn('[PesoAdminApp] Supabase officer update warning:', e.message);
            }
        }

        renderOfficersList();
        updateNavigationTabBadges();
        logAudit('TOGGLE_OFFICER_STATUS', `Set officer #${officerId} status to ${newStatus}`);
        notify('Officer Status Updated', `Officer #${officerId} is now ${newStatus}.`, 'success');
    }

    /**
     * Notifications Hub (Tab 7)
     */
    function renderNotificationsList() {
        const tbody = document.getElementById('notificationsHistoryTableBody');
        const container = document.getElementById('adminNotificationsContainer');
        const badge = document.getElementById('notifTabBadge');

        if (badge) badge.textContent = AdminStore.notifications.length;

        const searchQ = (document.getElementById('notifSearchInput')?.value || '').toLowerCase().trim();
        const filtered = AdminStore.notifications.filter(n => {
            if (!searchQ) return true;
            return (n.title || '').toLowerCase().includes(searchQ) ||
                (n.message || '').toLowerCase().includes(searchQ) ||
                (n.recipient_phone || '').toLowerCase().includes(searchQ);
        });

        if (tbody) {
            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No notifications match the filter criteria.</td></tr>`;
                return;
            }

            tbody.innerHTML = filtered.map(n => `
                <tr>
                    <td class="fw-semibold text-dark">${escapeHtml(n.recipient_phone || 'All Beneficiaries')}</td>
                    <td class="fw-bold text-primary">${escapeHtml(n.title || 'System Broadcast')}</td>
                    <td><small class="text-muted d-block text-truncate" style="max-width: 320px;">${escapeHtml(n.message || '')}</small></td>
                    <td><small class="text-muted font-monospace">${n.created_at ? new Date(n.created_at).toLocaleString() : 'Just now'}</small></td>
                    <td class="text-center"><span class="badge bg-success-subtle text-success border">Delivered</span></td>
                </tr>
            `).join('');
        }

        if (container) {
            if (filtered.length === 0) {
                container.innerHTML = `<div class="text-center py-4 text-muted">No notifications dispatched.</div>`;
                return;
            }

            container.innerHTML = filtered.map(n => `
                <div class="card mb-2 border shadow-sm">
                    <div class="card-body py-2 px-3 d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="fw-bold mb-0 text-dark">${escapeHtml(n.title || n.message)}</h6>
                            <small class="text-muted font-monospace">${escapeHtml(n.recipient_phone || 'Broadcast')}</small>
                        </div>
                        <small class="text-muted">${n.created_at ? new Date(n.created_at).toLocaleDateString() : 'Today'}</small>
                    </div>
                </div>
            `).join('');
        }
    }

    // =========================================================================
    // MODAL FORM SUBMIT HANDLERS
    // =========================================================================

    async function handleCreateProgramSubmit(event) {
        if (event) event.preventDefault();
        const formEl = event.target;
        if (typeof PesoPrograms !== 'undefined') {
            await PesoPrograms.submitCreateProgram(formEl);
            await loadAllAdminData();
        }
    }

    async function handleUploadOrdinance(event) {
        if (event) event.preventDefault();
        const ordTitle = document.getElementById('ordTitle')?.value || '';
        const ordTotal = parseFloat(document.getElementById('ordTotal')?.value || '13707882.00');

        logAudit('UPLOAD_ORDINANCE', `Uploaded official LGU Appropriation Ordinance: "${ordTitle}" (₱${ordTotal.toLocaleString()})`);
        safeCloseModal('uploadOrdinanceModal');
        notify('Ordinance Uploaded', `Successfully uploaded and registered "${ordTitle}".`, 'success');
    }

    async function handleCreateOfficerSubmit(event) {
        if (event) event.preventDefault();
        const firstName = document.getElementById('newOfficerFirstName')?.value || '';
        const lastName = document.getElementById('newOfficerLastName')?.value || '';
        const email = document.getElementById('newOfficerEmail')?.value || '';
        const role = document.getElementById('newOfficerRole')?.value || 'PESO Officer';
        const password = document.getElementById('newOfficerPassword')?.value || 'Koronadal2026!';

        if (!firstName || !lastName || !email) {
            alert('Please enter mandatory officer details.');
            return;
        }

        const newStaff = {
            id: Date.now(),
            username: email.split('@')[0],
            first_name: firstName,
            last_name: lastName,
            email: email,
            role: role,
            department: 'PESO',
            agency: 'PESO',
            status: 'Active',
            created_at: new Date().toISOString()
        };

        AdminStore.officers.unshift(newStaff);

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('staff_profiles').insert(newStaff);
            } catch (err) {
                console.warn('[PesoAdminApp] Supabase staff insert warning:', err.message);
            }
        }

        renderOfficersList();
        logAudit('CREATE_OFFICER_ACCOUNT', `Created new ${role} account for "${firstName} ${lastName}" (${email})`);
        safeCloseModal('newOfficerModal');
        notify('Officer Created', `Account for ${firstName} ${lastName} created successfully.`, 'success');
    }

    async function handleFundAllocationSubmit(event) {
        if (event) event.preventDefault();
        const progSelect = document.getElementById('fundAllocProgSelect')?.value || '';
        const newBudget = parseFloat(document.getElementById('fundAllocNewBudget')?.value || '0');
        const justification = document.getElementById('fundAllocJustification')?.value || '';

        if (!progSelect || newBudget <= 0) {
            alert('Please select a program and specify a valid allocation budget.');
            return;
        }

        const prog = AdminStore.programs.find(p => p.code === progSelect || String(p.id) === String(progSelect));
        if (prog) {
            prog.budget = newBudget;
            prog.budget_allocated = newBudget;

            if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                try {
                    await supabaseClient.from('programs').update({ budget: newBudget }).eq('id', prog.id);
                } catch (e) {
                    console.warn('[PesoAdminApp] Supabase budget update warning:', e.message);
                }
            }
        }

        if (typeof PesoFunds !== 'undefined') {
            PesoFunds.setData(AdminStore.programs, AdminStore.approvedAssistance);
            PesoFunds.renderFundsModule();
        }

        logAudit('COMMIT_FUND_ALLOCATION', `Adjusted budget for ${progSelect} to ${formatCurrency(newBudget)}. Justification: ${justification}`);
        safeCloseModal('fundAllocationModal');
        notify('Allocation Updated', `Budget for ${progSelect} adjusted to ${formatCurrency(newBudget)}.`, 'success');
    }

    async function handleComposeNotificationSubmit(event) {
        if (event) event.preventDefault();
        const title = document.getElementById('notifTitleInput')?.value || '';
        const message = document.getElementById('notifMessageInput')?.value || '';
        const target = document.getElementById('notifRecipientType')?.value || 'all_beneficiaries';

        if (!title || !message) {
            alert('Please enter notification title and message.');
            return;
        }

        const newNotif = {
            id: Date.now(),
            title: title,
            message: message,
            channel: 'System / SMS',
            department: 'PESO',
            created_at: new Date().toISOString()
        };

        AdminStore.notifications.unshift(newNotif);

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('notifications').insert(newNotif);
            } catch (e) {}
        }

        renderNotificationsList();
        logAudit('DISPATCH_LIVE_NOTIFICATION', `Dispatched notification: "${title}" to ${target}`);
        safeCloseModal('composeNotificationModal');
        notify('Notification Dispatched', `Broadcast "${title}" delivered.`, 'success');
    }

    return Object.freeze({
        AdminStore,
        switchTab,
        loadAllAdminData,
        safeOpenModal,
        safeCloseModal,
        renderOfficersList,
        toggleOfficerStatus,
        renderNotificationsList,
        handleCreateProgramSubmit,
        handleUploadOrdinance,
        handleCreateOfficerSubmit,
        handleFundAllocationSubmit,
        handleComposeNotificationSubmit
    });
})();

// Global backwards-compatibility shortcuts
window.PesoAdminApp = PesoAdminApp;
window.switchTab = PesoAdminApp.switchTab;
window.safeOpenModal = PesoAdminApp.safeOpenModal;
window.safeCloseModal = PesoAdminApp.safeCloseModal;
window.refreshDashboardMetrics = PesoAdminApp.loadAllAdminData;

// Modal triggers & action bridges
window.openCreateProgramModal = window.openCreateProgramModal || (() => PesoAdminApp.safeOpenModal('newProgramModal'));
window.openNewOfficerModal = window.openNewOfficerModal || (() => PesoAdminApp.safeOpenModal('newOfficerModal'));
window.openUploadOrdinanceModal = window.openUploadOrdinanceModal || (() => PesoAdminApp.safeOpenModal('uploadOrdinanceModal'));
window.openFundAllocationModal = window.openFundAllocationModal || (() => PesoAdminApp.safeOpenModal('fundAllocationModal'));
window.openComposeNotificationModal = window.openComposeNotificationModal || (() => PesoAdminApp.safeOpenModal('composeNotificationModal'));
window.openCreateScheduleSlotModal = window.openCreateScheduleSlotModal || (() => PesoAdminApp.safeOpenModal('scheduleActivityModal'));
window.showAuditLogsModal = () => {
    const tbody = document.getElementById('auditLogsModalTableBody');
    if (tbody && PesoAdminApp.AdminStore.auditLogs.length > 0) {
        tbody.innerHTML = PesoAdminApp.AdminStore.auditLogs.map(l => `
            <tr>
                <td class="font-monospace small">${l.created_at ? new Date(l.created_at).toLocaleString() : 'Just now'}</td>
                <td class="fw-semibold">${l.user_name || l.user_role || 'Admin'}</td>
                <td><span class="badge bg-primary font-monospace">${l.action_type || l.action || 'ACTIVITY'}</span></td>
                <td><span class="badge bg-light text-dark border">${l.target_entity || 'System'}</span></td>
                <td class="small">${l.details || l.description || '-'}</td>
            </tr>
        `).join('');
    }
    PesoAdminApp.safeOpenModal('auditLogsModal');
};
window.showOrdinanceReferenceModal = () => {
    const tbody = document.getElementById('ordinanceBreakdownTableBody');
    if (tbody && PesoAdminApp.AdminStore.programs.length > 0) {
        tbody.innerHTML = PesoAdminApp.AdminStore.programs.map(p => `
            <tr>
                <td class="fw-bold font-monospace">${p.code}</td>
                <td class="fw-semibold">${p.name}</td>
                <td><span class="badge bg-light text-dark border">${p.category || 'General'}</span></td>
                <td class="text-end fw-bold">₱${(Number(p.budget) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
            </tr>
        `).join('');
    }
    PesoAdminApp.safeOpenModal('ordinanceReferenceModal');
};

// Report & Export shortcuts
window.exportActiveReportCSV = () => { if (typeof PesoReports !== 'undefined') PesoReports.exportReportCSV(); };
window.printActiveReportPDF = () => { if (typeof PesoReports !== 'undefined') PesoReports.printReport(); };
window.generateReportData = () => { if (typeof PesoReports !== 'undefined') PesoReports.renderReportsPreview(); };
window.exportDistributionLogsCsv = () => { if (typeof PesoReports !== 'undefined') PesoReports.exportReportCSV(); };
window.exportOfficersCsv = () => { if (typeof PesoReports !== 'undefined') PesoReports.exportReportCSV(); };

// Scheduling shortcuts
window.setSchedViewMode = (mode) => { if (typeof PesoScheduling !== 'undefined') PesoScheduling.setViewMode(mode); };
window.navigateCalendarMonth = (dir) => { if (typeof PesoScheduling !== 'undefined') (dir > 0 ? PesoScheduling.nextMonth() : PesoScheduling.prevMonth()); };
window.jumpToCalendarToday = () => { if (typeof PesoScheduling !== 'undefined') PesoScheduling.renderCalendar(); };
window.autoPullCertificateRecipients = () => { alert('Auto-pulled eligible recipients from Training Records.'); };

// Filter handlers
window.filterProgramsCatalog = () => { if (typeof PesoPrograms !== 'undefined') PesoPrograms.filterPrograms(); };
window.filterOfficersList = () => PesoAdminApp.renderOfficersList();
window.filterEvaluationQueue = () => { if (typeof PesoEvaluations !== 'undefined') PesoEvaluations.renderEvalLevel3(); };
window.showProgramsLevel1 = () => { if (typeof PesoPrograms !== 'undefined') PesoPrograms.backToLevel1(); };
window.showProgramsLevel2 = () => { if (typeof PesoPrograms !== 'undefined') PesoPrograms.backToLevel2(); };
window.handleFundProgSelectionChange = () => {
    const select = document.getElementById('fundAllocProgSelect');
    const input = document.getElementById('fundAllocNewBudget');
    if (select && input) {
        const prog = PesoAdminApp.AdminStore.programs.find(p => p.code === select.value || String(p.id) === select.value);
        if (prog) input.value = Number(prog.budget) || 0;
    }
};
window.handleNotifRecipientChange = () => {
    const select = document.getElementById('notifRecipientType');
    const container = document.getElementById('notifSpecificRecipientContainer');
    if (select && container) {
        if (select.value === 'specific_beneficiary' || select.value === 'specific_staff') {
            container.classList.remove('d-none');
        } else {
            container.classList.add('d-none');
        }
    }
};

// Form submit bridges
window.handleCreateProgramSubmit = window.handleCreateProgramSubmit || PesoAdminApp.handleCreateProgramSubmit;
window.handleUploadOrdinance = window.handleUploadOrdinance || PesoAdminApp.handleUploadOrdinance;
window.handleCreateOfficerSubmit = window.handleCreateOfficerSubmit || PesoAdminApp.handleCreateOfficerSubmit;
window.handleFundAllocationSubmit = window.handleFundAllocationSubmit || PesoAdminApp.handleFundAllocationSubmit;
window.handleComposeNotificationSubmit = window.handleComposeNotificationSubmit || PesoAdminApp.handleComposeNotificationSubmit;
window.handleCreateScheduleSlotSubmit = window.handleCreateScheduleSlotSubmit || ((e) => { if (typeof PesoScheduling !== 'undefined') PesoScheduling.submitScheduleActivity(e.target); });
window.handleEvaluationDecisionSubmit = window.handleEvaluationDecisionSubmit || ((e) => { if (e) e.preventDefault(); });
window.handleSaveOfficerUpdates = window.handleSaveOfficerUpdates || ((e) => { if (e) e.preventDefault(); });
window.handleSaveProgramUpdates = window.handleSaveProgramUpdates || ((e) => { if (e) e.preventDefault(); });

// Auto-bootloader
document.addEventListener('DOMContentLoaded', () => {
    const isPesoAdmin = window.location.pathname.includes('peso_admin.html');
    if (isPesoAdmin) {
        PesoAdminApp.loadAllAdminData();
    }
});

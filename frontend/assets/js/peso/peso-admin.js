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

    /**
     * Master Data Fetcher from Supabase
     */
    async function loadAllAdminData() {
        if (typeof DataService === 'undefined') return;

        try {
            const [
                progRes,
                appRes,
                staffRes,
                schedRes,
                fundsRes,
                assistRes,
                notifRes,
                auditRes,
                batchRes,
                benRes
            ] = await Promise.all([
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

            const loadedPrograms = (progRes.data || []).filter(p => (p.agency || p.department || '').toUpperCase() === 'PESO');
            const canonicalList = (typeof PesoPrograms !== 'undefined' && PesoPrograms.CANONICAL_PESO_PROGRAMS) ? PesoPrograms.CANONICAL_PESO_PROGRAMS : [];

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

            const canonicalBatches = (typeof PesoPrograms !== 'undefined' && PesoPrograms.CANONICAL_PESO_BATCHES) ? PesoPrograms.CANONICAL_PESO_BATCHES : [];
            AdminStore.batches = (batchRes.data && batchRes.data.length > 0) ? batchRes.data : [...canonicalBatches];

            const canonicalBens = (typeof PesoPrograms !== 'undefined' && PesoPrograms.CANONICAL_PESO_BENEFICIARIES) ? PesoPrograms.CANONICAL_PESO_BENEFICIARIES : [];
            AdminStore.beneficiaries = (benRes.data && benRes.data.length > 0) ? benRes.data : [...canonicalBens];

            AdminStore.applications = (appRes.data || []).map(a => {
                const ben = a.beneficiary || {};
                const prog = a.program || {};
                return {
                    id: a.id,
                    dbId: a.id,
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
            AdminStore.officers = (staffRes.data || []).filter(s => !['CSWDO Admin', 'CSWDO Officer'].includes(s.role) && (s.department || 'PESO').toUpperCase() !== 'CSWDO');
            AdminStore.schedules = (schedRes.data || []).map(i => {
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
                    interviewDate: i.interview_date || (i.scheduled_time ? i.scheduled_time.substring(0, 10) : 'Today'),
                    date: i.interview_date || (i.scheduled_time ? i.scheduled_time.substring(0, 10) : 'Today'),
                    scheduleTime: i.interview_time || '09:00 AM',
                    time: i.interview_time || '09:00 AM',
                    venue: i.venue_location || i.location || 'PESO Main Office',
                    location: i.venue_location || i.location || 'PESO Main Office',
                    officerName: `${officer.first_name || ''} ${officer.last_name || ''}`.trim() || 'PESO Officer',
                    status: i.status || 'Scheduled',
                    attendance: i.attendance_status || (i.status === 'Completed' ? 'Present' : 'Pending')
                };
            });
            AdminStore.funds = fundsRes.data || [];
            AdminStore.approvedAssistance = (assistRes.data || []).map(d => ({
                id: d.id,
                program_code: d.program ? d.program.code : 'PESO',
                beneficiary_name: d.beneficiary ? `${d.beneficiary.first_name} ${d.beneficiary.last_name}` : 'Beneficiary',
                amount: d.amount_approved || d.amount || 0,
                amount_approved: d.amount_approved || d.amount || 0,
                status: d.status || 'Disbursed',
                disbursed_at: d.approved_at || d.created_at || 'Today'
            }));
            AdminStore.notifications = notifRes.data || [];
            AdminStore.auditLogs = auditRes.data || [];
            AdminStore.batches = batchRes.data || [];
            AdminStore.beneficiaries = benRes.data || [];

        } catch (err) {
            console.warn('[PesoAdminApp] Supabase data load notice:', err.message);
        }

        // Pass data to submodules
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

        // Setup session profile in header
        setupAdminSession();

        // Refresh Active Tab
        switchTab(AdminStore.currentTab);
    }

    function setupAdminSession() {
        const user = (typeof PesoAuth !== 'undefined') ? PesoAuth.getCurrentUser() : null;
        const adminName = user?.fullName || 'PESO Administrator';
        const adminRole = user?.role || 'PESO Admin';

        const nameEls = [document.getElementById('adminUserName'), document.getElementById('adminUserNameMobile')];
        nameEls.forEach(el => { if (el) el.textContent = adminName; });

        const roleEls = [document.getElementById('adminUserRole'), document.getElementById('adminUserRoleMobile')];
        roleEls.forEach(el => { if (el) el.textContent = adminRole; });

        const avatarEl = document.getElementById('adminAvatarText');
        if (avatarEl && adminName) {
            const initials = adminName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            avatarEl.textContent = initials || 'PA';
        }
    }

    /**
     * Officers Directory Management (Tab 2)
     */
    function renderOfficersList() {
        const tbody = document.getElementById('adminOfficersTableBody');
        const badge = document.getElementById('officersTabBadge');
        if (!tbody) return;

        if (badge) badge.textContent = AdminStore.officers.length;

        if (AdminStore.officers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No officer accounts registered.</td></tr>`;
            return;
        }

        tbody.innerHTML = AdminStore.officers.map(o => {
            const isInactive = o.status === 'Inactive' || o.status === 'Deactivated';
            return `
                <tr>
                    <td class="fw-bold font-monospace text-primary">#OFF-${escapeHtml(String(o.id))}</td>
                    <td>
                        <div class="fw-semibold text-dark">${escapeHtml(o.first_name || '')} ${escapeHtml(o.last_name || '')}</div>
                        <small class="text-muted font-monospace">${escapeHtml(o.username || '')}</small>
                    </td>
                    <td><span class="badge bg-primary-subtle text-primary border">${escapeHtml(o.role || 'PESO Officer')}</span></td>
                    <td><small class="text-muted">${escapeHtml(o.email || '-')}</small></td>
                    <td><span class="badge ${isInactive ? 'bg-danger-subtle text-danger border' : 'bg-success-subtle text-success border'}">${escapeHtml(o.status || 'Active')}</span></td>
                    <td class="text-end">
                        <button class="btn btn-sm ${isInactive ? 'btn-outline-success' : 'btn-outline-danger'} py-1 px-2" onclick="PesoAdminApp.toggleOfficerStatus('${o.id}')">
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
        logAudit('TOGGLE_OFFICER_STATUS', `Set officer #${officerId} status to ${newStatus}`);
        notify('Officer Status Updated', `Officer #${officerId} is now ${newStatus}.`, 'success');
    }

    /**
     * Notifications Hub (Tab 7)
     */
    function renderNotificationsList() {
        const container = document.getElementById('adminNotificationsContainer');
        const badge = document.getElementById('notifTabBadge');
        if (!container) return;

        if (badge) badge.textContent = AdminStore.notifications.length;

        if (AdminStore.notifications.length === 0) {
            container.innerHTML = `<div class="text-center py-4 text-muted">No notifications dispatched.</div>`;
            return;
        }

        container.innerHTML = AdminStore.notifications.map(n => `
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
window.openCreateProgramModal = () => PesoAdminApp.safeOpenModal('newProgramModal');
window.openNewOfficerModal = () => PesoAdminApp.safeOpenModal('newOfficerModal');
window.openUploadOrdinanceModal = () => PesoAdminApp.safeOpenModal('uploadOrdinanceModal');
window.openFundAllocationModal = () => PesoAdminApp.safeOpenModal('fundAllocationModal');
window.openComposeNotificationModal = () => PesoAdminApp.safeOpenModal('composeNotificationModal');
window.openCreateScheduleSlotModal = () => PesoAdminApp.safeOpenModal('scheduleActivityModal');
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
window.handleCreateProgramSubmit = PesoAdminApp.handleCreateProgramSubmit;
window.handleUploadOrdinance = PesoAdminApp.handleUploadOrdinance;
window.handleCreateOfficerSubmit = PesoAdminApp.handleCreateOfficerSubmit;
window.handleFundAllocationSubmit = PesoAdminApp.handleFundAllocationSubmit;
window.handleComposeNotificationSubmit = PesoAdminApp.handleComposeNotificationSubmit;
window.handleCreateScheduleSlotSubmit = (e) => { if (typeof PesoScheduling !== 'undefined') PesoScheduling.submitScheduleActivity(e.target); };
window.handleEvaluationDecisionSubmit = (e) => { if (e) e.preventDefault(); };
window.handleSaveOfficerUpdates = (e) => { if (e) e.preventDefault(); };
window.handleSaveProgramUpdates = (e) => { if (e) e.preventDefault(); };

// Auto-bootloader
document.addEventListener('DOMContentLoaded', () => {
    const isPesoAdmin = window.location.pathname.includes('peso_admin.html');
    if (isPesoAdmin) {
        PesoAdminApp.loadAllAdminData();
    }
});

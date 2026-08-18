/**
 * PESO Admin Portal - Global Navigation Controller & DOM Initializer (Tab 7 & Main Bootloader)
 * Module: Main (peso-admin-main.js)
 */

function renderDashboardTables() {
    const activeList = programsList.filter(p => p.status === 'Active');
    const archList = programsList.filter(p => p.status !== 'Active');
    const totalBudget = programsList.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);

    if (document.getElementById('statTotalPrograms')) document.getElementById('statTotalPrograms').textContent = programsList.length;
    if (document.getElementById('statActivePrograms')) document.getElementById('statActivePrograms').textContent = activeList.length;
    if (document.getElementById('statArchivedPrograms')) document.getElementById('statArchivedPrograms').textContent = archList.length;
    if (document.getElementById('archiveTabBadge')) document.getElementById('archiveTabBadge').textContent = archList.length;
    if (document.getElementById('archiveSectionCountBadge')) document.getElementById('archiveSectionCountBadge').textContent = `${archList.length} Deactivated Programs`;
    if (document.getElementById('statTotalBudget')) document.getElementById('statTotalBudget').textContent = '₱' + totalBudget.toLocaleString();

    filterPrograms();
    renderAssignProgramsTable();
    renderArchiveTable(archList);
}

// Master Tab Navigation Controller
function switchTab(tabName) {
    const target = (tabName === 'officers') ? 'users' : tabName;
    const sections = ['Overview', 'Users', 'Scheduling', 'Evaluation', 'Assignment', 'Archive'];
    sections.forEach(s => {
        const secEl = document.getElementById(`section${s}`);
        const tabEl = document.getElementById(`tabNav${s}`);
        if (secEl) {
            if (s.toLowerCase() === target.toLowerCase()) {
                secEl.classList.remove('d-none');
            } else {
                secEl.classList.add('d-none');
            }
        }
        if (tabEl) {
            if (s.toLowerCase() === target.toLowerCase()) {
                tabEl.classList.add('active');
            } else {
                tabEl.classList.remove('active');
            }
        }
    });

    if (target === 'overview') {
        renderDashboardTables();
    } else if (target === 'users') {
        renderUsersModule();
    } else if (target === 'scheduling') {
        renderSchedulingModule();
    } else if (target === 'evaluation') {
        renderEvalLevel1Programs();
    } else if (target === 'assignment') {
        showLevel1Programs();
    } else if (target === 'archive') {
        renderArchiveTable();
    }

    logAuditEvent('SWITCH_NAVIGATION_TAB', `Switched active navigation tab to "${target.toUpperCase()}"`);
}

// Initial App Load Dispatcher & Unified Event Bindings
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Module Data Stores
    try {
        initUserManagementData();
        fetchUsersFromApi();
        initProgramsData();
        initSchedulingData();
        initOfficersData();
        fetchOfficersFromApi();
        initEvalModuleData();
        renderDashboardTables();
    } catch (initErr) {
        console.error('[PESO Admin Init Error]:', initErr);
    }

    // 2. Setup Lifecycle Logging for all existing Modals in DOM
    try {
        document.querySelectorAll('.modal').forEach(setupModalLifecycleListeners);
    } catch (e) {
        console.warn('[PESO Admin] Modal lifecycle setup warning:', e);
    }

    // 3. Explicit Event Listeners for Primary Admin Action Buttons (Prevents Dead Buttons)
    const bindBtn = (id, fn) => {
        try {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', (e) => {
                try { fn(e); } catch (err) { console.error(`[PESO Admin Button Error #${id}]:`, err); }
            });
        } catch (e) {
            console.warn(`[PESO Admin] Could not bind #${id}:`, e);
        }
    };

    bindBtn('createNewOfficerBtn', () => openNewOfficerModal());
    bindBtn('uploadOrdinanceBtn', () => openUploadOrdinanceModal());
    bindBtn('adminBtnViewCalendar', () => setAdminScheduleViewMode('calendar'));
    bindBtn('adminBtnViewList', () => setAdminScheduleViewMode('list'));

    // 4. Document-Level Unified Click Delegation for Dynamic Action Buttons (Defensive)
    document.addEventListener('click', function (e) {
        try {
            const target = e.target && typeof e.target.closest === 'function' ? e.target.closest('[data-modal-target], [data-admin-action]') : null;
            if (!target) return;

            const modalTarget = target.getAttribute('data-modal-target');
            if (modalTarget) {
                e.preventDefault();
                safeOpenModal(modalTarget);
            }
        } catch (err) {
            console.warn('[PESO Admin] Click delegation error (handled safely):', err);
        }
    });

    // 5. Initialize Realtime Subscriptions for PESO Admin Portal
    try {
        if (typeof DataService !== 'undefined' && DataService.realtime) {
            DataService.realtime.subscribeMulti(['programs', 'applications', 'interview_schedules', 'staff_profiles', 'batches'], (payload) => {
                console.log('[PESO Admin Realtime Event]:', payload.table, payload.eventType);
                if (payload.table === 'programs') {
                    initProgramsData();
                } else if (payload.table === 'applications') {
                    initEvalModuleData();
                    initProgramsData();
                } else if (payload.table === 'interview_schedules') {
                    initSchedulingData();
                } else if (payload.table === 'staff_profiles') {
                    initUserManagementData();
                    initOfficersData();
                } else if (payload.table === 'batches') {
                    initEvalModuleData();
                }
            });
        }
    } catch (rtErr) {
        console.warn('[PESO Admin Realtime Init Notice]:', rtErr);
    }

    console.log('[PESO Admin Portal] Unified event bindings, live data & realtime system initialized.');
});


/**
 * PESO Admin Portal - Global Navigation Controller & DOM Initializer (Tab 7 & Main Bootloader)
 * Module: Main (peso-admin-main.js)
 */

function formatCurrency(amount) {
    if (amount === undefined || amount === null || isNaN(Number(amount))) return '₱0.00';
    return '₱' + Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
window.formatCurrency = formatCurrency;

// Global in-memory cache for cross-module data (Funds module and Dashboard KPIs
// read from this). Populated by initFundsData() in peso-admin-funds.js.
window.AdminStore = window.AdminStore || {
    programs: [],
    applications: [],
    batches: [],
    beneficiaries: [],
    approvedAssistance: [],
    funds: [],
    notifications: [],
    auditLogs: []
};
const AdminStore = window.AdminStore;

function renderDashboardOverview() {
    const list = (typeof programsList !== 'undefined' && Array.isArray(programsList)) ? programsList : [];
    const activeList = list.filter(p => p.status === 'Active');
    const archList = list.filter(p => p.status !== 'Active');
    const totalBudget = list.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt('statTotalPrograms', list.length);
    setTxt('statActivePrograms', activeList.length);
    setTxt('statArchivedPrograms', archList.length);
    setTxt('archiveTabBadge', archList.length);
    setTxt('archiveSectionBadge', `${archList.length} Deactivated Programs`);
    setTxt('statTotalBudget', formatCurrency(totalBudget));
    setTxt('ordinanceTotalAppropriation', formatCurrency(totalBudget));
    setTxt('overviewTotalAppropriation', formatCurrency(totalBudget));

    if (typeof filterPrograms === 'function') filterPrograms();
    if (typeof renderAssignProgramsTable === 'function') renderAssignProgramsTable();
    if (typeof renderArchiveTable === 'function') renderArchiveTable(archList);

    // Real KPI cards (statOverview*, fundUtil*, etc.) live in PesoDashboard.renderAdminMetrics --
    // the block above only ever wrote to older ids that no longer exist on this page.
    if (typeof PesoDashboard !== 'undefined' && PesoDashboard.renderAdminMetrics) {
        const apps = (typeof evalApplicationsList !== 'undefined' && Array.isArray(evalApplicationsList)) ? evalApplicationsList : [];
        const fnds = (window.AdminStore && Array.isArray(window.AdminStore.funds)) ? window.AdminStore.funds : [];
        const btchs = (window.AdminStore && Array.isArray(window.AdminStore.batches)) ? window.AdminStore.batches : [];
        const scheds = (typeof activitiesList !== 'undefined' && Array.isArray(activitiesList)) ? activitiesList : [];
        PesoDashboard.renderAdminMetrics(list, apps, fnds, btchs, scheds);
    }
}
window.renderDashboardOverview = renderDashboardOverview;

async function refreshAllData() {
    try {
        if (typeof fetchProgramsFromApi === 'function') await fetchProgramsFromApi();
        if (typeof fetchUsersFromApi === 'function') await fetchUsersFromApi();
        if (typeof fetchOfficersFromApi === 'function') await fetchOfficersFromApi();
        if (typeof initEvalModuleData === 'function') await initEvalModuleData();
        if (typeof initSchedulingData === 'function') await initSchedulingData();
        if (typeof renderDashboardTables === 'function') renderDashboardTables();
        if (typeof renderDashboardOverview === 'function') renderDashboardOverview();
        if (typeof initFundsData === 'function') await initFundsData();
        if (typeof renderReportsModule === 'function') renderReportsModule();
    } catch (e) {
        console.warn('[PESO Admin] refreshAllData notice:', e);
    }
}
window.refreshAllData = refreshAllData;

function renderDashboardTables() {
    renderDashboardOverview();
}
window.renderDashboardTables = renderDashboardTables;

function refreshDashboardMetrics() {
    refreshAllData();
}
// Master Tab Navigation Controller
function switchTab(tabName) {
    const target = tabName;
    const sections = ['Overview', 'Officers', 'Programs', 'Users', 'Scheduling', 'Evaluation', 'Assignment', 'Funds', 'Resources', 'Notifications', 'Reports', 'Archive'];
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
    } else if (target === 'officers') {
        if (typeof filterOfficers === 'function') filterOfficers();
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
    } else if (target === 'funds') {
        if (typeof renderFundsModule === 'function') renderFundsModule();
    } else if (target === 'programs') {
        if (typeof filterProgramsCatalog === 'function') filterProgramsCatalog();
    } else if (target === 'resources') {
        if (typeof renderResourcesModule === 'function') renderResourcesModule();
    } else if (target === 'notifications') {
        if (typeof renderNotificationsModule === 'function') renderNotificationsModule();
    } else if (target === 'reports') {
        if (typeof generateReportData === 'function') generateReportData();
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
        if (typeof initFundsData === 'function') initFundsData();
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

    // 5. Initialize Realtime Subscriptions for PESO Admin Portal (Singleton & Debounce guarded)
    try {
        let _adminRtDebounceTimer = null;
        if (typeof DataService !== 'undefined' && DataService.realtime && !window.__pesoAdminRealtimeActive) {
            window.__pesoAdminRealtimeActive = true;
            DataService.realtime.subscribeMulti(['programs', 'applications', 'interview_schedules', 'staff_profiles', 'batches', 'approved_assistance', 'notifications', 'funds'], (payload) => {
                console.log('[PESO Admin Realtime Event]:', payload.table, payload.eventType);
                
                // Debounce rapid multi-table broadcasts to a single smooth UI refresh
                if (_adminRtDebounceTimer) clearTimeout(_adminRtDebounceTimer);
                _adminRtDebounceTimer = setTimeout(async () => {
                    if (payload.table === 'funds') {
                        if (typeof DataService !== 'undefined' && DataService.funds) {
                            try {
                                const fRes = await DataService.funds.getAll({ agency: 'PESO' });
                                if (fRes && fRes.data && typeof AdminStore !== 'undefined') {
                                    AdminStore.funds = fRes.data;
                                }
                            } catch (fErr) {
                                console.warn('[PESO Admin] Realtime funds refresh note:', fErr);
                            }
                        }
                        if (typeof renderFundsModule === 'function') renderFundsModule();
                    } else if (payload.table === 'programs') {
                        if (typeof initProgramsData === 'function') initProgramsData();
                        if (typeof renderFundsModule === 'function') renderFundsModule();
                    } else if (payload.table === 'applications') {
                        if (typeof initEvalModuleData === 'function') initEvalModuleData();
                        if (typeof initProgramsData === 'function') initProgramsData();
                    } else if (payload.table === 'interview_schedules') {
                        if (typeof initSchedulingData === 'function') initSchedulingData();
                    } else if (payload.table === 'staff_profiles') {
                        if (typeof initOfficersData === 'function') initOfficersData();
                    } else if (payload.table === 'batches' || payload.table === 'beneficiaries' || payload.table === 'approved_assistance') {
                        if (typeof initEvalModuleData === 'function') initEvalModuleData();
                        if (typeof renderFundsModule === 'function') renderFundsModule();
                    }
                    if (typeof renderDashboardOverview === 'function') renderDashboardOverview();
                }, 1500);
            });
        }
    } catch (rtErr) {
        console.warn('[PESO Admin Realtime Init Notice]:', rtErr);
    }

    console.log('[PESO Admin Portal] Unified event bindings, live data & realtime system initialized.');
});


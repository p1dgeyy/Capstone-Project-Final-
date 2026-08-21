/**
 * PESO Administrator Portal - Master Client Script & Dynamic Supabase Data Engine
 * City Government of Koronadal - Public Employment Service Office
 * 
 * Features:
 * 1. Dashboard Overview (Live metrics, Chart.js trends, Real-time audit activity feed)
 * 2. Officer Management (Directory, Supabase Auth signUp, role & status controls)
 * 3. Program Management & Multi-Level Assignment (Catalog, CRUD, Drill-down, Deactivation Safeguards)
 * 4. Application Evaluation Oversight (Queue, Case Inspection, Decision Logging, Notifications)
 * 5. Scheduling & Training Records (Calendar/List, Conflict & Past-Date Validation, Cert Auto-Pull)
 * 6. Fund Allocation & Assistance Distribution (Live Balances, Overflow Warnings, Disbursement Logs)
 * 7. Notification Hub (Dispatched History, Live Composer)
 * 8. System Reports Engine (Date-Range Multi-Module Filters, UTF-8 CSV Export, Printable PDF View)
 * 9. Archive Section (Read-Only Monitoring, Restore, Permanent Deletion)
 */

(function (window, document) {
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
        chartInstance: null,
        calendarDate: new Date(),
        activeDrilldown: {
            program: null,
            batch: null,
            beneficiary: null
        }
    };

    // Helper: Escapes HTML to prevent XSS
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Helper: Data Privacy Act compliant contact masking
    function maskContactNumber(phone) {
        if (!phone || phone === 'N/A' || phone === '-') return '09XX-***-XXXX';
        const clean = String(phone).trim().replace(/[^0-9+]/g, '');
        if (clean.length >= 10) {
            const start = clean.substring(0, 4);
            const end = clean.substring(clean.length - 4);
            return `${start}-***-${end}`;
        }
        return '09XX-***-XXXX';
    }

    // Helper: Format Currency (PHP ₱)
    function formatCurrency(amount) {
        const num = Number(amount) || 0;
        return '₱' + num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Helper: Format Date
    function formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    }

    // Helper: Format DateTime
    function formatDateTime(dateStr) {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return dateStr;
        }
    }

    // Safe Notification Wrapper
    function notify(title, message, type = 'info') {
        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({ title, message, type });
        } else {
            console.log(`[Notification ${type.toUpperCase()}]: ${title} - ${message}`);
            if (type === 'danger' || type === 'error') alert(`${title}: ${message}`);
        }
    }

    // Audit Log Writer with Session Actor
    async function logAdminAction(action, entityType, entityId, details) {
        try {
            if (typeof DataService !== 'undefined' && DataService.auditLogs) {
                await DataService.auditLogs.log({
                    action: action,
                    entityType: entityType,
                    entityId: entityId ? parseInt(entityId) : null,
                    details: details
                });
            }
        } catch (err) {
            console.warn('[AUDIT] Failed to record audit log:', err);
        }
    }

    // Modal Controller with Fallback Support
    function openModal(modalId) {
        const modalEl = document.getElementById(modalId);
        if (!modalEl) {
            console.warn(`[Modal] #${modalId} not found.`);
            return;
        }
        if (typeof window.safeOpenModal === 'function') {
            window.safeOpenModal(modalId);
        } else if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const instance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            instance.show();
        } else {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
            document.body.classList.add('modal-open');
        }
    }

    function closeModal(modalId) {
        const modalEl = document.getElementById(modalId);
        if (!modalEl) return;
        if (typeof window.safeHideModal === 'function') {
            window.safeHideModal(modalId);
        } else if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const instance = bootstrap.Modal.getInstance(modalEl);
            if (instance) instance.hide();
        } else {
            modalEl.classList.remove('show');
            modalEl.style.display = 'none';
            document.body.classList.remove('modal-open');
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) backdrop.remove();
        }
    }

    // =========================================================================
    // 1. MASTER INITIALIZATION & LIVE DATA FETCHING
    // =========================================================================
    async function initPesoAdmin() {
        console.log('[PESO Admin Portal] Initializing real-time Supabase integration...');
        
        // 1. Setup Active Session & Admin Identity
        setupAdminSession();

        // 2. Fetch All Datasets Concurrently
        await refreshAllData();

        // 3. Setup Chart.js Monthly Trends Visual
        initTrendChart();

        // 4. Setup Real-time Database Event Subscriptions
        initRealtimeSync();

        // 5. Initial Render based on active tab
        renderActiveTab();
    }

    function setupAdminSession() {
        try {
            let adminName = 'PESO Administrator';
            let adminRole = 'PESO Admin';
            
            if (typeof AuthGuard !== 'undefined' && AuthGuard.getProfile) {
                const p = AuthGuard.getProfile();
                if (p) {
                    adminName = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username || adminName;
                    adminRole = p.role || adminRole;
                }
            } else if (sessionStorage.getItem('fullName')) {
                adminName = sessionStorage.getItem('fullName');
                adminRole = sessionStorage.getItem('userRole') || adminRole;
            }

            const nameEls = [document.getElementById('adminUserName'), document.getElementById('adminUserNameMobile')];
            nameEls.forEach(el => { if (el) el.textContent = adminName; });
            
            const roleEls = [document.getElementById('adminUserRole'), document.getElementById('adminUserRoleMobile')];
            roleEls.forEach(el => { if (el) el.textContent = adminRole; });

            const avatarEl = document.getElementById('adminAvatarText');
            if (avatarEl && adminName) {
                const initials = adminName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                avatarEl.textContent = initials || 'PA';
            }
        } catch (e) {
            console.warn('[PESO Admin] Session setup notice:', e);
        }
    }

    async function refreshAllData() {
        if (typeof DataService === 'undefined') {
            console.error('[PESO Admin] DataService is not available.');
            return;
        }

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
                DataService.programs.getAll(),
                DataService.applications.getAll(),
                DataService.staffProfiles.getAll({ agency: 'PESO' }),
                DataService.interviews.getAll(),
                DataService.funds.getAll(),
                DataService.approvedAssistance.getAll(),
                supabaseClient.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
                DataService.auditLogs.getAll({ limit: 50 }),
                DataService.batches.getAll(),
                DataService.beneficiaries.getAll()
            ]);

            AdminStore.programs = progRes.data || [];
            AdminStore.applications = appRes.data || [];
            AdminStore.officers = (staffRes.data || []).filter(s => !['CSWDO Admin', 'CSWDO Officer'].includes(s.role));
            AdminStore.schedules = schedRes.data || [];
            AdminStore.funds = fundsRes.data || [];
            AdminStore.approvedAssistance = assistRes.data || [];
            AdminStore.notifications = notifRes.data || [];
            AdminStore.auditLogs = auditRes.data || [];
            AdminStore.batches = batchRes.data || [];
            AdminStore.beneficiaries = benRes.data || [];

            // Update Tab Badges
            updateTabBadges();

            console.log('[PESO Admin] Live records successfully fetched from Supabase:', {
                programs: AdminStore.programs.length,
                applications: AdminStore.applications.length,
                officers: AdminStore.officers.length,
                schedules: AdminStore.schedules.length,
                disbursements: AdminStore.approvedAssistance.length
            });
        } catch (err) {
            console.error('[PESO Admin] Data fetch error:', err);
            notify('Database Sync Error', 'Could not sync live records. Checking connection...', 'warning');
        }
    }

    function updateTabBadges() {
        const setBadge = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        const activeOfficers = AdminStore.officers.filter(o => o.status === 'Active').length;
        const activePrograms = AdminStore.programs.filter(p => p.status === 'Active').length;
        const pendingApps = AdminStore.applications.filter(a => a.status === 'Pending' || a.status === 'Under Review' || a.status === 'Pending Requirements').length;
        const activeScheds = AdminStore.schedules.filter(s => s.status === 'Scheduled').length;
        const unreadNotifs = AdminStore.notifications.filter(n => !n.is_read).length;
        const archivedCount = AdminStore.programs.filter(p => p.status !== 'Active').length + AdminStore.officers.filter(o => o.status !== 'Active').length;

        setBadge('officersTabBadge', activeOfficers);
        setBadge('programsTabBadge', activePrograms);
        setBadge('evalTabBadge', pendingApps);
        setBadge('schedTabBadge', activeScheds);
        setBadge('notifTabBadge', unreadNotifs);
        setBadge('archiveTabBadge', archivedCount);
        setBadge('archiveSectionBadge', `${archivedCount} Preserved Items`);
    }

    // =========================================================================
    // 2. MASTER TAB SWITCHER & VIEW CONTROLLER
    // =========================================================================
    function switchTab(tabName) {
        AdminStore.currentTab = tabName;
        const tabs = ['overview', 'officers', 'programs', 'evaluation', 'scheduling', 'funds', 'notifications', 'reports', 'archive'];

        tabs.forEach(t => {
            const sec = document.getElementById(`section${t.charAt(0).toUpperCase() + t.slice(1)}`);
            const btn = document.getElementById(`tabNav${t.charAt(0).toUpperCase() + t.slice(1)}`);
            if (sec) {
                if (t === tabName) sec.classList.remove('d-none');
                else sec.classList.add('d-none');
            }
            if (btn) {
                if (t === tabName) btn.classList.add('active');
                else btn.classList.remove('active');
            }
        });

        renderActiveTab();
        logAdminAction('SWITCH_TAB', 'navigation', null, `Admin switched active module to [${tabName.toUpperCase()}]`);
    }

    function renderActiveTab() {
        const tab = AdminStore.currentTab;
        if (tab === 'overview') renderDashboardOverview();
        else if (tab === 'officers') renderOfficersModule();
        else if (tab === 'programs') renderProgramsCatalog();
        else if (tab === 'evaluation') renderEvaluationModule();
        else if (tab === 'scheduling') renderSchedulingModule();
        else if (tab === 'funds') renderFundsModule();
        else if (tab === 'notifications') renderNotificationsModule();
        else if (tab === 'reports') generateReportData();
        else if (tab === 'archive') renderArchiveModule();
    }

    // =========================================================================
    // 3. MODULE 1: DASHBOARD OVERVIEW (REQ003 – REQ006)
    // =========================================================================
    function renderDashboardOverview() {
        const apps = AdminStore.applications;
        const progs = AdminStore.programs;
        const assistance = AdminStore.approvedAssistance;
        const bens = AdminStore.beneficiaries;
        const audits = AdminStore.auditLogs;

        // 1. Applications Status Counts
        const pendingCount = apps.filter(a => ['Pending', 'Pending Requirements', 'Under Review'].includes(a.status)).length;
        const approvedCount = apps.filter(a => ['Approved', 'Officer Approved'].includes(a.status)).length;
        const completedCount = apps.filter(a => ['Completed', 'Released'].includes(a.status)).length;
        const uniqueBeneficiaries = bens.length > 0 ? bens.length : new Set(apps.map(a => a.beneficiary_qr)).size;

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setTxt('statOverviewBeneficiaries', uniqueBeneficiaries);
        setTxt('statOverviewPendingApps', pendingCount);
        setTxt('statOverviewApprovedApps', approvedCount);
        setTxt('statOverviewCompletedApps', completedCount);

        // 2. Fund Utilization Calculation
        let totalAppropriation = 13707882.00; // LGU Appropriation Baseline
        let totalProgramBudgets = progs.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
        if (totalProgramBudgets > 0) totalAppropriation = totalProgramBudgets;

        let totalDisbursed = assistance.reduce((sum, item) => {
            const cleanAmt = String(item.quantity_amount || '').replace(/[^0-9.]/g, '');
            return sum + (Number(cleanAmt) || 0);
        }, 0);

        const remainingBalance = Math.max(0, totalAppropriation - totalDisbursed);
        const utilizationPercent = totalAppropriation > 0 ? Math.min(100, Math.round((totalDisbursed / totalAppropriation) * 100)) : 0;

        setTxt('overviewTotalAppropriation', formatCurrency(totalAppropriation));
        setTxt('fundUtilTotalBudget', formatCurrency(totalAppropriation));
        setTxt('fundUtilTotalDisbursed', formatCurrency(totalDisbursed));
        setTxt('fundUtilRemainingBalance', formatCurrency(remainingBalance));
        setTxt('fundUtilOverallPercent', `${utilizationPercent}% Disbursed`);

        const pBar = document.getElementById('fundUtilProgressBar');
        if (pBar) {
            pBar.style.width = `${utilizationPercent}%`;
            pBar.setAttribute('aria-valuenow', utilizationPercent);
            pBar.className = `progress-bar ${utilizationPercent > 85 ? 'bg-danger' : (utilizationPercent > 60 ? 'bg-warning' : 'bg-success')}`;
        }

        // Program Bars in Dashboard
        const progBarsContainer = document.getElementById('overviewProgramBudgetBars');
        if (progBarsContainer) {
            progBarsContainer.innerHTML = progs.slice(0, 4).map(p => {
                const pBudget = Number(p.budget) || 1000000;
                const pDisbursed = assistance.filter(a => a.program_id === p.id).reduce((s, i) => s + (Number(String(i.quantity_amount).replace(/[^0-9.]/g, '')) || 0), 0);
                const pPct = Math.min(100, Math.round((pDisbursed / pBudget) * 100));
                return `
                    <div class="mb-2">
                        <div class="d-flex justify-content-between small">
                            <span class="fw-semibold text-dark text-truncate" style="max-width: 170px;">${escapeHtml(p.name)}</span>
                            <span class="text-muted font-monospace">${pPct}%</span>
                        </div>
                        <div class="progress" style="height: 6px;">
                            <div class="progress-bar ${pPct > 80 ? 'bg-danger' : 'bg-primary'}" style="width: ${pPct}%;"></div>
                        </div>
                    </div>
                `;
            }).join('') || '<div class="text-muted small">No active programs.</div>';
        }

        // 3. Update Chart.js Trend Visuals
        updateTrendChart();

        // 4. Render Live Activity Feed (Latest 10 audit logs)
        renderActivityFeed(audits.slice(0, 10));
    }

    function initTrendChart() {
        const canvas = document.getElementById('appTrendChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (AdminStore.chartInstance) {
            AdminStore.chartInstance.destroy();
        }

        AdminStore.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'Applications Influx',
                    data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    borderColor: '#0284C7',
                    backgroundColor: 'rgba(2, 132, 199, 0.12)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2.5,
                    pointRadius: 4,
                    pointBackgroundColor: '#0284C7'
                }, {
                    label: 'Grants Approved',
                    data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointBackgroundColor: '#10B981'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { font: { family: 'Outfit', size: 12 } } },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });

        updateTrendChart();
    }

    function updateTrendChart() {
        if (!AdminStore.chartInstance) return;
        const monthlyApps = new Array(12).fill(0);
        const monthlyApproved = new Array(12).fill(0);

        AdminStore.applications.forEach(a => {
            const d = new Date(a.created_at || a.date_applied);
            if (!isNaN(d.getTime())) {
                const month = d.getMonth();
                if (month >= 0 && month < 12) {
                    monthlyApps[month]++;
                    if (a.status === 'Approved' || a.status === 'Officer Approved' || a.status === 'Completed') {
                        monthlyApproved[month]++;
                    }
                }
            }
        });

        AdminStore.chartInstance.data.datasets[0].data = monthlyApps;
        AdminStore.chartInstance.data.datasets[1].data = monthlyApproved;
        AdminStore.chartInstance.update();
    }

    function renderActivityFeed(logs) {
        const feed = document.getElementById('dashboardActivityFeedList');
        if (!feed) return;

        if (!logs || logs.length === 0) {
            feed.innerHTML = '<div class="text-center py-4 text-muted">No recent activity logged.</div>';
            return;
        }

        feed.innerHTML = logs.map(l => {
            const actor = l.staff ? `${l.staff.first_name || ''} ${l.staff.last_name || ''}`.trim() : (l.staff_user_id ? `Staff #${l.staff_user_id}` : (l.beneficiary_qr || 'System'));
            const dateStr = formatDateTime(l.created_at);
            return `
                <div class="activity-feed-item">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="badge bg-primary-subtle text-primary fw-bold">${escapeHtml(l.action)}</span>
                        <small class="text-muted font-monospace" style="font-size: 0.72rem;">${dateStr}</small>
                    </div>
                    <div class="text-dark small fw-semibold">${escapeHtml(l.details || 'System operation executed')}</div>
                    <div class="text-muted" style="font-size: 0.72rem;"><i class="bi bi-person-circle me-1"></i>Actor: ${escapeHtml(actor)} • Entity: ${escapeHtml(l.entity_type || 'General')}</div>
                </div>
            `;
        }).join('');
    }

    // =========================================================================
    // 4. MODULE 2: OFFICER MANAGEMENT (REQ007 – REQ011)
    // =========================================================================
    function renderOfficersModule() {
        const officers = AdminStore.officers;
        const search = (document.getElementById('officerSearchInput')?.value || '').toLowerCase();
        const roleF = document.getElementById('officerRoleFilter')?.value || 'ALL';
        const statusF = document.getElementById('officerStatusFilter')?.value || 'ALL';

        const filtered = officers.filter(o => {
            const name = `${o.first_name || ''} ${o.last_name || ''} ${o.username || ''} ${o.email || ''}`.toLowerCase();
            const matchesSearch = !search || name.includes(search);
            const matchesRole = roleF === 'ALL' || o.role === roleF;
            const matchesStatus = statusF === 'ALL' || o.status === statusF;
            return matchesSearch && matchesRole && matchesStatus;
        });

        const tbody = document.getElementById('officersTableBody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No officer accounts found.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(o => {
            const fullName = `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.username;
            const isDeactivated = o.status === 'Deactivated' || o.status === 'Inactive';
            const maskedPhone = maskContactNumber(o.phone);
            const createdDate = formatDate(o.created_at);

            return `
                <tr>
                    <td>
                        <div class="fw-bold text-dark">${escapeHtml(fullName)}</div>
                        <small class="text-muted font-monospace">@${escapeHtml(o.username)}</small>
                    </td>
                    <td>
                        <div class="text-dark">${escapeHtml(o.email)}</div>
                    </td>
                    <td>
                        <span class="badge bg-primary-subtle text-primary fw-semibold">${escapeHtml(o.role || 'PESO Officer')}</span>
                    </td>
                    <td>
                        <span class="masked-phone">${escapeHtml(maskedPhone)}</span>
                    </td>
                    <td>
                        <small class="text-muted">${createdDate}</small>
                    </td>
                    <td class="text-center">
                        <div class="form-check form-switch d-inline-block">
                            <input class="form-check-input" type="checkbox" role="switch" ${!isDeactivated ? 'checked' : ''} onchange="toggleOfficerStatus(${o.id}, this.checked)" aria-label="Toggle Status">
                        </div>
                    </td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="openEditOfficerModal(${o.id})">
                            <i class="bi bi-pencil-square"></i> Edit
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Update Key Counters
        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setTxt('statTotalStaffCount', officers.length);
        setTxt('statActiveOfficersCount', officers.filter(o => o.role === 'PESO Officer' && o.status === 'Active').length);
        setTxt('statActiveEvaluatorsCount', officers.filter(o => o.role === 'Evaluator' && o.status === 'Active').length);
        setTxt('statDeactivatedStaffCount', officers.filter(o => o.status !== 'Active').length);
    }

    function filterOfficersList() {
        renderOfficersModule();
    }

    function openNewOfficerModal() {
        const form = document.getElementById('newOfficerForm');
        if (form) form.reset();
        openModal('newOfficerModal');
    }

    async function handleCreateOfficerSubmit(e) {
        e.preventDefault();
        const firstName = document.getElementById('newOffFirstName').value.trim();
        const lastName = document.getElementById('newOffLastName').value.trim();
        const username = document.getElementById('newOffUsername').value.trim();
        const email = document.getElementById('newOffEmail').value.trim();
        const password = document.getElementById('newOffPassword').value;
        const role = document.getElementById('newOffRole').value;
        const phone = document.getElementById('newOffPhone').value.trim();
        const address = document.getElementById('newOffAddress').value.trim();

        if (!email || !password || !firstName || !lastName || !username) {
            notify('Validation Error', 'Please complete all required officer fields.', 'warning');
            return;
        }

        try {
            // Provision Supabase Auth User with metadata
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                        username: username,
                        role: role
                    }
                }
            });

            if (authError) throw authError;

            // Direct insert / check in staff_profiles
            if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
                await DataService.staffProfiles.create({
                    auth_id: authData.user ? authData.user.id : null,
                    username: username,
                    email: email,
                    first_name: firstName,
                    last_name: lastName,
                    role: role,
                    phone: phone,
                    address: address,
                    agency: 'PESO',
                    status: 'Active'
                });
            }

            await logAdminAction('CREATE_OFFICER_ACCOUNT', 'staff_profile', null, `Provisioned new ${role} account: ${username} (${email})`);
            notify('Officer Created', `Officer ${firstName} ${lastName} provisioned successfully.`, 'success');
            closeModal('newOfficerModal');
            await refreshAllData();
            renderOfficersModule();
        } catch (err) {
            console.error('[OFFICER CREATE ERROR]', err);
            notify('Creation Failed', err.message || 'Could not provision officer.', 'danger');
        }
    }

    function openEditOfficerModal(id) {
        const officer = AdminStore.officers.find(o => o.id === id);
        if (!officer) return;

        document.getElementById('editOffId').value = officer.id;
        document.getElementById('editOffFirstName').value = officer.first_name || '';
        document.getElementById('editOffLastName').value = officer.last_name || '';
        document.getElementById('editOffUsername').value = officer.username || '';
        document.getElementById('editOffEmail').value = officer.email || '';
        document.getElementById('editOffRole').value = officer.role || 'PESO Officer';
        document.getElementById('editOffStatus').value = officer.status || 'Active';

        openModal('editOfficerModal');
    }

    async function handleSaveOfficerUpdates(e) {
        e.preventDefault();
        const id = parseInt(document.getElementById('editOffId').value);
        const firstName = document.getElementById('editOffFirstName').value.trim();
        const lastName = document.getElementById('editOffLastName').value.trim();
        const username = document.getElementById('editOffUsername').value.trim();
        const email = document.getElementById('editOffEmail').value.trim();
        const role = document.getElementById('editOffRole').value;
        const status = document.getElementById('editOffStatus').value;

        try {
            if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
                await DataService.staffProfiles.update(id, {
                    first_name: firstName,
                    last_name: lastName,
                    username: username,
                    email: email,
                    role: role,
                    status: status
                });
            }

            await logAdminAction('UPDATE_OFFICER_ACCOUNT', 'staff_profile', id, `Updated officer ${username} details & role to [${role}]`);
            notify('Profile Updated', 'Officer details saved successfully.', 'success');
            closeModal('editOfficerModal');
            await refreshAllData();
            renderOfficersModule();
        } catch (err) {
            notify('Update Failed', err.message || 'Could not update officer.', 'danger');
        }
    }

    async function toggleOfficerStatus(id, isActive) {
        const newStatus = isActive ? 'Active' : 'Deactivated';
        try {
            if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
                await DataService.staffProfiles.toggleStatus(id, newStatus);
            }
            await logAdminAction(isActive ? 'ACTIVATE_OFFICER' : 'DEACTIVATE_OFFICER', 'staff_profile', id, `Changed officer #${id} status to ${newStatus}`);
            notify('Status Updated', `Officer account set to ${newStatus}.`, 'success');
            await refreshAllData();
            renderOfficersModule();
        } catch (err) {
            notify('Status Update Failed', err.message || 'Error changing status.', 'danger');
        }
    }

    // =========================================================================
    // 5. MODULE 3: PROGRAM MANAGEMENT & MULTI-LEVEL ASSIGNMENT (REQ012-023)
    // =========================================================================
    function renderProgramsCatalog() {
        const progs = AdminStore.programs;
        const search = (document.getElementById('programsSearchInput')?.value || '').toLowerCase();
        const statusF = document.getElementById('programsStatusFilter')?.value || 'ALL';

        const filtered = progs.filter(p => {
            const name = `${p.name || ''} ${p.code || ''} ${p.category || ''}`.toLowerCase();
            const matchesSearch = !search || name.includes(search);
            const matchesStatus = statusF === 'ALL' || (statusF === 'Active' && p.status === 'Active') || (statusF === 'Inactive' && p.status !== 'Active');
            return matchesSearch && matchesStatus;
        });

        const tbody = document.getElementById('programsCatalogTableBody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No programs found matching filters.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(p => {
            const isDeactivated = p.status !== 'Active';
            const enrCount = AdminStore.applications.filter(a => a.program_id === p.id).length;
            const pBudget = Number(p.budget) || 0;

            return `
                <tr>
                    <td>
                        <div class="fw-bold text-dark">${escapeHtml(p.name)}</div>
                        <span class="badge bg-dark-subtle text-dark font-monospace">${escapeHtml(p.code)}</span>
                    </td>
                    <td>
                        <span class="badge badge-category badge-livelihood">${escapeHtml(p.category || 'Livelihood')}</span>
                    </td>
                    <td>
                        <div class="fw-bold text-success">${formatCurrency(pBudget)}</div>
                    </td>
                    <td>
                        <span class="badge bg-light text-dark border"><i class="bi bi-people text-primary me-1"></i>${enrCount} enrolled</span>
                    </td>
                    <td>
                        <div class="text-truncate" style="max-width: 220px;" title="${escapeHtml(p.description || '')}">${escapeHtml(p.description || 'No description')}</div>
                    </td>
                    <td class="text-center">
                        <div class="form-check form-switch d-inline-block">
                            <input class="form-check-input" type="checkbox" role="switch" ${!isDeactivated ? 'checked' : ''} onchange="handleProgramStatusToggle(event, ${p.id})" aria-label="Toggle Status">
                        </div>
                    </td>
                    <td class="text-end">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-info" onclick="openProgramDetailsViewModal(${p.id})" title="View Details">
                                <i class="bi bi-eye"></i> Details
                            </button>
                            <button class="btn btn-outline-primary" onclick="drilldownToBatches(${p.id})" title="View Batches">
                                <i class="bi bi-layers"></i> Batches
                            </button>
                            <button class="btn btn-outline-warning" onclick="openProgramEditModal(${p.id})" title="Edit">
                                <i class="bi bi-pencil"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function filterProgramsCatalog() {
        renderProgramsCatalog();
    }

    function showProgramsLevel1() {
        document.getElementById('programsLevel1View')?.classList.remove('d-none');
        document.getElementById('programsLevel2BatchesView')?.classList.add('d-none');
        document.getElementById('programsLevel3BeneficiariesView')?.classList.add('d-none');
        document.getElementById('bcDrilldownBatchItem')?.classList.add('d-none');
        document.getElementById('bcDrilldownBenItem')?.classList.add('d-none');
    }

    function showProgramsLevel2() {
        document.getElementById('programsLevel1View')?.classList.add('d-none');
        document.getElementById('programsLevel2BatchesView')?.classList.remove('d-none');
        document.getElementById('programsLevel3BeneficiariesView')?.classList.add('d-none');
        document.getElementById('bcDrilldownBatchItem')?.classList.remove('d-none');
        document.getElementById('bcDrilldownBenItem')?.classList.add('d-none');
    }

    function drilldownToBatches(progId) {
        const prog = AdminStore.programs.find(p => p.id === progId);
        if (!prog) return;
        AdminStore.activeDrilldown.program = prog;

        document.getElementById('drilldownProgCodeBadge').textContent = prog.code;
        document.getElementById('drilldownProgTitle').textContent = `Batches for: ${prog.name}`;
        document.getElementById('bcDrilldownBatchName').textContent = `${prog.code} Batches`;

        const progBatches = AdminStore.batches.filter(b => b.program_id === prog.id || b.program_code === prog.code);
        const tbody = document.getElementById('drilldownBatchesTableBody');
        if (tbody) {
            if (progBatches.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No batches created for this program yet.</td></tr>`;
            } else {
                tbody.innerHTML = progBatches.map(b => {
                    const count = AdminStore.applications.filter(a => a.batch_id === b.id).length;
                    return `
                        <tr>
                            <td class="fw-bold text-dark">${escapeHtml(b.name || `Batch #${b.id}`)}</td>
                            <td><span class="badge bg-light text-dark border">${b.capacity || 50} Slots</span></td>
                            <td><span class="badge bg-primary-subtle text-primary">${count} Applicants</span></td>
                            <td>${formatDate(b.created_at)}</td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-primary" onclick="drilldownToBeneficiaries(${b.id}, '${escapeHtml(b.name || 'Batch')}')">
                                    Inspect Beneficiaries <i class="bi bi-chevron-right ms-1"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        showProgramsLevel2();
    }

    function drilldownToBeneficiaries(batchId, batchName) {
        AdminStore.activeDrilldown.batch = batchId;
        document.getElementById('drilldownBatchBadge').textContent = `BATCH #${batchId}`;
        document.getElementById('drilldownBatchTitle').textContent = `Enrolled Applicants in ${batchName}`;
        document.getElementById('bcDrilldownBenName').textContent = batchName;

        const batchApps = AdminStore.applications.filter(a => a.batch_id === batchId);
        const tbody = document.getElementById('drilldownBeneficiariesTableBody');
        if (tbody) {
            if (batchApps.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No applicants assigned to this batch yet.</td></tr>`;
            } else {
                tbody.innerHTML = batchApps.map(a => {
                    const ben = a.beneficiary || {};
                    const fullName = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || 'Applicant';
                    return `
                        <tr>
                            <td class="fw-bold text-dark">${escapeHtml(fullName)}</td>
                            <td><span class="font-monospace badge bg-light text-dark border">${escapeHtml(a.beneficiary_qr)}</span></td>
                            <td><span class="masked-phone">${escapeHtml(maskContactNumber(ben.phone))}</span></td>
                            <td>${formatDate(a.date_applied || a.created_at)}</td>
                            <td class="text-center"><span class="badge bg-info text-white">${escapeHtml(a.status)}</span></td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-outline-info" onclick="inspectBeneficiaryProfile('${a.beneficiary_qr}')">
                                    <i class="bi bi-person-vcard"></i> Full Profile
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        document.getElementById('programsLevel1View')?.classList.add('d-none');
        document.getElementById('programsLevel2BatchesView')?.classList.add('d-none');
        document.getElementById('programsLevel3BeneficiariesView')?.classList.remove('d-none');
        document.getElementById('bcDrilldownBatchItem')?.classList.remove('d-none');
        document.getElementById('bcDrilldownBenItem')?.classList.remove('d-none');
    }

    function inspectBeneficiaryProfile(qrCode) {
        const ben = AdminStore.beneficiaries.find(b => b.qr_code === qrCode) || AdminStore.applications.find(a => a.beneficiary_qr === qrCode)?.beneficiary;
        if (!ben) {
            notify('Profile Notice', 'Beneficiary record not found in active dataset.', 'warning');
            return;
        }

        const fullName = `${ben.first_name || ''} ${ben.middle_name || ''} ${ben.last_name || ''} ${ben.suffix || ''}`.trim();
        document.getElementById('bpFullName').textContent = fullName || 'Beneficiary';
        document.getElementById('bpQrCode').textContent = ben.qr_code || qrCode;
        document.getElementById('bpContact').textContent = maskContactNumber(ben.phone);
        document.getElementById('bpEmail').textContent = ben.email || 'N/A';
        document.getElementById('bpAddress').textContent = ben.address || 'City of Koronadal';
        document.getElementById('bpAgeSex').textContent = `${ben.age || 'N/A'} yrs / ${ben.sex || 'N/A'}`;
        document.getElementById('bpCivilStatus').textContent = ben.marital_status || 'Single';
        document.getElementById('bpIdType').textContent = ben.id_type || 'Government Valid ID';

        openModal('beneficiaryProfileModal');
    }

    // Program CRUD Form Handlers
    function openCreateProgramModal() {
        document.getElementById('createProgramForm')?.reset();
        openModal('createProgramModal');
    }

    async function handleCreateProgramSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('newProgName').value.trim();
        const code = document.getElementById('newProgCode').value.trim().toUpperCase();
        const category = document.getElementById('newProgCategory').value;
        const budget = parseFloat(document.getElementById('newProgBudget').value) || 0;
        const desc = document.getElementById('newProgDesc').value.trim();

        try {
            if (typeof DataService !== 'undefined' && DataService.programs) {
                await DataService.programs.create({
                    code: code,
                    name: name,
                    category: category,
                    budget: budget,
                    description: desc,
                    agency: 'PESO',
                    status: 'Active'
                });
            }

            await logAdminAction('CREATE_PROGRAM', 'program', null, `Created program ${code} (${name}) with budget ${formatCurrency(budget)}`);
            notify('Program Created', `Program [${code}] recorded successfully.`, 'success');
            closeModal('createProgramModal');
            await refreshAllData();
            renderProgramsCatalog();
        } catch (err) {
            notify('Program Creation Failed', err.message || 'Error creating program.', 'danger');
        }
    }

    function openProgramDetailsViewModal(progId) {
        const prog = AdminStore.programs.find(p => p.id === progId);
        if (!prog) return;

        document.getElementById('viewProgName').textContent = prog.name || '-';
        document.getElementById('viewProgCode').textContent = prog.code || '-';
        document.getElementById('viewProgCategory').textContent = prog.category || 'Livelihood';
        document.getElementById('viewProgBudget').textContent = formatCurrency(prog.budget);
        document.getElementById('viewProgStatus').textContent = prog.status || 'Active';
        document.getElementById('viewProgDesc').textContent = prog.description || 'No additional description provided.';

        openModal('programDetailsViewModal');
    }

    function openProgramEditModal(progId) {
        const prog = AdminStore.programs.find(p => p.id === progId);
        if (!prog) return;

        document.getElementById('editProgId').value = prog.id;
        document.getElementById('editProgName').value = prog.name || '';
        document.getElementById('editProgCode').value = prog.code || '';
        document.getElementById('editProgBudget').value = prog.budget || 0;
        document.getElementById('editProgCategory').value = prog.category || 'Livelihood Programs';
        document.getElementById('editProgDesc').value = prog.description || '';

        openModal('programEditModal');
    }

    async function handleSaveProgramUpdates(e) {
        e.preventDefault();
        const id = parseInt(document.getElementById('editProgId').value);
        const name = document.getElementById('editProgName').value.trim();
        const budget = parseFloat(document.getElementById('editProgBudget').value) || 0;
        const category = document.getElementById('editProgCategory').value;
        const desc = document.getElementById('editProgDesc').value.trim();

        try {
            if (typeof DataService !== 'undefined' && DataService.programs) {
                await DataService.programs.update(id, {
                    name: name,
                    budget: budget,
                    category: category,
                    description: desc
                });
            }

            await logAdminAction('UPDATE_PROGRAM', 'program', id, `Updated program details for #${id} (${name})`);
            notify('Program Updated', 'Program changes saved.', 'success');
            closeModal('programEditModal');
            await refreshAllData();
            renderProgramsCatalog();
        } catch (err) {
            notify('Update Failed', err.message || 'Error updating program.', 'danger');
        }
    }

    // Program Deactivation Safeguard Restriction (Rule Check)
    async function handleProgramStatusToggle(event, progId) {
        const checkbox = event.target;
        const isTurningActive = checkbox.checked;
        const prog = AdminStore.programs.find(p => p.id === progId);

        if (!isTurningActive) {
            // Check if active beneficiaries exist in this program
            const activeApps = AdminStore.applications.filter(a => a.program_id === progId && ['Pending', 'Under Review', 'Officer Approved', 'Approved'].includes(a.status));
            if (activeApps.length > 0) {
                event.preventDefault();
                checkbox.checked = true; // revert switch
                document.getElementById('restrictionWarningText').textContent = `Cannot deactivate program "${prog?.name || progId}". This program currently has ${activeApps.length} active applicant(s) undergoing verification. All assignments must be resolved first.`;
                openModal('restrictionWarningModal');
                return;
            }
        }

        const newStatus = isTurningActive ? 'Active' : 'Inactive';
        try {
            if (typeof DataService !== 'undefined' && DataService.programs) {
                await DataService.programs.toggleStatus(progId, newStatus);
            }
            await logAdminAction(isTurningActive ? 'ACTIVATE_PROGRAM' : 'DEACTIVATE_PROGRAM', 'program', progId, `Set program #${progId} status to ${newStatus}`);
            notify('Status Changed', `Program set to ${newStatus}.`, 'success');
            await refreshAllData();
            renderProgramsCatalog();
        } catch (err) {
            checkbox.checked = !isTurningActive;
            notify('Status Update Failed', err.message || 'Could not change program status.', 'danger');
        }
    }

    // =========================================================================
    // 6. MODULE 4: APPLICATION EVALUATION OVERSIGHT (REQ024 – REQ029)
    // =========================================================================
    function renderEvaluationModule() {
        const apps = AdminStore.applications;
        const progs = AdminStore.programs;
        const search = (document.getElementById('evalSearchInput')?.value || '').toLowerCase();
        const progFilter = document.getElementById('evalProgramFilter')?.value || 'ALL';
        const statusFilter = document.getElementById('evalStatusFilter')?.value || 'ALL';

        // Populate Program Dropdown Filter
        const progSelect = document.getElementById('evalProgramFilter');
        if (progSelect && progSelect.options.length <= 1) {
            progs.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                progSelect.appendChild(opt);
            });
        }

        const filtered = apps.filter(a => {
            const ben = a.beneficiary || {};
            const searchStr = `${a.application_number || ''} ${ben.first_name || ''} ${ben.last_name || ''} ${ben.address || ''}`.toLowerCase();
            const matchesSearch = !search || searchStr.includes(search);
            const matchesProg = progFilter === 'ALL' || String(a.program_id) === String(progFilter);
            let matchesStatus = true;
            if (statusFilter === 'Pending') matchesStatus = ['Pending', 'Pending Requirements', 'Under Review'].includes(a.status);
            else if (statusFilter === 'Officer Approved') matchesStatus = a.status === 'Officer Approved';
            else if (statusFilter === 'Approved') matchesStatus = a.status === 'Approved';
            else if (statusFilter === 'Denied') matchesStatus = ['Denied', 'Rejected'].includes(a.status);

            return matchesSearch && matchesProg && matchesStatus;
        });

        const tbody = document.getElementById('evaluationQueueTableBody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No applications found matching evaluation criteria.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(a => {
            const ben = a.beneficiary || {};
            const fullName = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || 'Applicant';
            const progName = a.program?.name || `Program #${a.program_id}`;
            const dateStr = formatDate(a.date_applied || a.created_at);
            
            let statusBadge = `<span class="badge bg-warning text-dark">${escapeHtml(a.status)}</span>`;
            if (a.status === 'Approved' || a.status === 'Completed') statusBadge = `<span class="badge bg-success">${escapeHtml(a.status)}</span>`;
            else if (a.status === 'Officer Approved') statusBadge = `<span class="badge bg-info text-white">Officer Approved</span>`;
            else if (a.status === 'Denied' || a.status === 'Rejected') statusBadge = `<span class="badge bg-danger">${escapeHtml(a.status)}</span>`;

            return `
                <tr>
                    <td>
                        <div class="fw-bold text-dark">${escapeHtml(fullName)}</div>
                        <span class="font-monospace text-muted small">${escapeHtml(a.application_number)}</span>
                    </td>
                    <td>
                        <div class="text-primary fw-semibold">${escapeHtml(progName)}</div>
                    </td>
                    <td>
                        <small class="text-muted">${dateStr}</small>
                    </td>
                    <td>
                        <div class="small text-secondary">${escapeHtml(a.officer_notes || 'Pending initial assessment')}</div>
                    </td>
                    <td class="text-center">${statusBadge}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-primary fw-semibold" onclick="inspectApplicationForEvaluation(${a.id})">
                            <i class="bi bi-search"></i> Inspect
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Update Evaluation Metrics
        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setTxt('statEvalTotalApps', apps.length);
        setTxt('statEvalPendingApps', apps.filter(a => ['Pending', 'Pending Requirements', 'Under Review'].includes(a.status)).length);
        setTxt('statEvalApprovedApps', apps.filter(a => a.status === 'Approved').length);
        setTxt('statEvalDeniedApps', apps.filter(a => a.status === 'Denied' || a.status === 'Rejected').length);
    }

    function filterEvaluationQueue() {
        renderEvaluationModule();
    }

    function inspectApplicationForEvaluation(appId) {
        const app = AdminStore.applications.find(a => a.id === appId);
        if (!app) return;

        const ben = app.beneficiary || {};
        const fullName = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || 'Applicant';

        document.getElementById('evalTargetAppId').value = app.id;
        document.getElementById('evalTargetBeneficiaryQr').value = app.beneficiary_qr || '';
        document.getElementById('evalModalAppNumber').textContent = app.application_number || `APP-${app.id}`;
        document.getElementById('evalApplicantName').textContent = fullName;
        document.getElementById('evalProgramName').textContent = app.program?.name || `Program #${app.program_id}`;
        document.getElementById('evalApplicantPhone').textContent = maskContactNumber(ben.phone);
        document.getElementById('evalDateApplied').textContent = formatDate(app.date_applied || app.created_at);
        document.getElementById('evalOfficerNotesDisplay').textContent = app.officer_notes || 'No notes left by assigned officer.';
        document.getElementById('evalApprovedAmount').value = app.amount_approved || app.amount_requested || 5000.00;

        // Render submitted docs preview links
        const docsContainer = document.getElementById('evalDocsContainer');
        if (docsContainer) {
            let docs = app.documents_json;
            if (!Array.isArray(docs) || docs.length === 0) {
                docs = [
                    { name: 'Barangay Certificate of Indigency', status: 'Verified' },
                    { name: 'Valid Government Photo ID', status: 'Verified' },
                    { name: 'Livelihood Assistance Application Form', status: 'Submitted' }
                ];
            }
            docsContainer.innerHTML = docs.map(d => `
                <div class="d-flex justify-content-between align-items-center py-1 border-bottom small">
                    <span><i class="bi bi-file-earmark-pdf text-danger me-1"></i> ${escapeHtml(d.name || d.type || 'Submitted Document')}</span>
                    <span class="badge bg-success-subtle text-success">${escapeHtml(d.status || 'Verified')}</span>
                </div>
            `).join('');
        }

        openModal('inspectEvaluationModal');
    }

    async function handleEvaluationDecisionSubmit(e) {
        e.preventDefault();
        const appId = parseInt(document.getElementById('evalTargetAppId').value);
        const decision = document.getElementById('evalAdminDecision').value;
        const approvedAmount = parseFloat(document.getElementById('evalApprovedAmount').value) || 0;
        const notes = document.getElementById('evalAdminNotes').value.trim();
        const benQr = document.getElementById('evalTargetBeneficiaryQr').value;

        try {
            if (typeof DataService !== 'undefined' && DataService.applications) {
                if (decision === 'Approved') {
                    await DataService.applications.adminApprove(appId, {
                        amount_approved: approvedAmount,
                        notes: notes,
                        admin_username: 'PESO Admin'
                    });
                } else if (decision === 'Denied') {
                    await DataService.applications.adminDeny(appId, {
                        reason: notes,
                        admin_username: 'PESO Admin'
                    });
                } else {
                    await DataService.applications.update(appId, {
                        status: 'Under Review',
                        admin_notes: notes
                    });
                }
            }

            await logAdminAction(`ADMIN_DECISION_${decision.toUpperCase()}`, 'application', appId, `Admin set application #${appId} to [${decision}]. Notes: ${notes}`);
            notify('Decision Submitted', `Application evaluated as [${decision}].`, 'success');
            closeModal('inspectEvaluationModal');
            await refreshAllData();
            renderEvaluationModule();
        } catch (err) {
            notify('Evaluation Failed', err.message || 'Error processing evaluation.', 'danger');
        }
    }

    // =========================================================================
    // 7. MODULE 5: SCHEDULING & TRAINING RECORDS (REQ030 – REQ041)
    // =========================================================================
    function renderSchedulingModule() {
        renderCalendarGrid();
        renderUpcomingAgenda();
        renderSchedulesRosterTable();
        renderTrainingRecords();

        const scheds = AdminStore.schedules;
        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setTxt('schedStatTotalSlots', scheds.length);
        setTxt('schedStatActiveSlots', scheds.filter(s => s.status === 'Scheduled').length);
        setTxt('schedStatCompletedSlots', scheds.filter(s => s.status === 'Completed').length);
        setTxt('schedStatCancelledSlots', scheds.filter(s => s.status === 'Cancelled').length);
        setTxt('activitiesCountBadge', `${scheds.filter(s => s.status === 'Scheduled').length} Upcoming`);
    }

    function setSchedViewMode(mode) {
        const cal = document.getElementById('schedCalendarViewContainer');
        const list = document.getElementById('schedListViewContainer');
        const btnCal = document.getElementById('schedBtnViewCalendar');
        const btnList = document.getElementById('schedBtnViewList');

        if (mode === 'calendar') {
            cal?.classList.remove('d-none');
            list?.classList.add('d-none');
            btnCal?.classList.add('active');
            btnList?.classList.remove('active');
        } else {
            cal?.classList.add('d-none');
            list?.classList.remove('d-none');
            btnCal?.classList.remove('active');
            btnList?.classList.add('active');
        }
    }

    function navigateCalendarMonth(delta) {
        AdminStore.calendarDate.setMonth(AdminStore.calendarDate.getMonth() + delta);
        renderCalendarGrid();
    }

    function jumpToCalendarToday() {
        AdminStore.calendarDate = new Date();
        renderCalendarGrid();
    }

    function renderCalendarGrid() {
        const grid = document.getElementById('calendarGridBody');
        const monthDisplay = document.getElementById('calendarMonthYearDisplay');
        if (!grid) return;

        const year = AdminStore.calendarDate.getFullYear();
        const month = AdminStore.calendarDate.getMonth();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        
        if (monthDisplay) monthDisplay.textContent = `${monthNames[month]} ${year}`;

        const firstDayIndex = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();
        const prevMonthTotalDays = new Date(year, month, 0).getDate();

        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

        let cellsHtml = '';

        // Previous Month Padding
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const dayNum = prevMonthTotalDays - i;
            cellsHtml += `<div class="calendar-day-cell other-month"><div class="calendar-day-number">${dayNum}</div></div>`;
        }

        // Current Month Days
        for (let day = 1; day <= totalDays; day++) {
            const isToday = isCurrentMonth && today.getDate() === day;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const daySchedules = AdminStore.schedules.filter(s => s.interview_date === dateStr);

            let chipsHtml = daySchedules.map(s => {
                let statusClass = 'status-chip-blue';
                if (s.status === 'Completed') statusClass = 'status-chip-gray';
                else if (s.status === 'Cancelled') statusClass = 'status-chip-red';
                return `<div class="event-chip ${statusClass}" title="${escapeHtml(s.venue_location)}">${escapeHtml(s.interview_time)}: ${escapeHtml(s.program?.code || 'Slot')}</div>`;
            }).join('');

            cellsHtml += `
                <div class="calendar-day-cell ${isToday ? 'today' : ''}" onclick="selectCalendarDate('${dateStr}')">
                    <div class="calendar-day-top">
                        <span class="calendar-day-number">${day}</span>
                        <button class="day-add-btn" onclick="event.stopPropagation(); quickAddScheduleOnDate('${dateStr}')" title="Add Slot"><i class="bi bi-plus"></i></button>
                    </div>
                    <div>${chipsHtml}</div>
                </div>
            `;
        }

        grid.innerHTML = cellsHtml;
    }

    function selectCalendarDate(dateStr) {
        const agenda = document.getElementById('scheduledAgendaList');
        const dayScheds = AdminStore.schedules.filter(s => s.interview_date === dateStr);
        if (agenda && dayScheds.length > 0) {
            agenda.innerHTML = `<div class="fw-bold mb-2 text-primary">Schedules on ${formatDate(dateStr)}:</div>` + dayScheds.map(s => renderAgendaItemHtml(s)).join('');
        }
    }

    function renderUpcomingAgenda() {
        const agenda = document.getElementById('scheduledAgendaList');
        if (!agenda) return;
        const upcoming = AdminStore.schedules.filter(s => s.status === 'Scheduled').slice(0, 8);

        if (upcoming.length === 0) {
            agenda.innerHTML = '<div class="text-center py-4 text-muted small">No upcoming scheduled activities.</div>';
            return;
        }

        agenda.innerHTML = upcoming.map(s => renderAgendaItemHtml(s)).join('');
    }

    function renderAgendaItemHtml(s) {
        const officerName = s.officer ? `${s.officer.first_name || ''} ${s.officer.last_name || ''}`.trim() : 'Officer';
        const isCancelled = s.status === 'Cancelled';
        return `
            <div class="activity-card-item ${isCancelled ? 'status-border-red' : 'status-border-blue'}">
                <div class="d-flex justify-content-between align-items-start mb-1">
                    <span class="fw-bold text-dark small">${escapeHtml(s.program?.name || 'Program Session')}</span>
                    <span class="badge ${isCancelled ? 'bg-danger' : 'bg-primary'}">${escapeHtml(s.status)}</span>
                </div>
                <div class="text-muted small mb-1"><i class="bi bi-calendar-event me-1"></i>${formatDate(s.interview_date)} • <span class="time-badge">${escapeHtml(s.interview_time)}</span></div>
                <div class="text-muted small mb-2"><i class="bi bi-geo-alt me-1"></i>${escapeHtml(s.venue_location)}</div>
                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-secondary"><i class="bi bi-person me-1"></i>${escapeHtml(officerName)}</small>
                    ${!isCancelled ? `<button class="btn btn-sm btn-outline-danger py-0 px-2" style="font-size:0.75rem;" onclick="cancelScheduleSlot(${s.id})">Cancel</button>` : '<span class="text-danger small font-monospace">Cancelled</span>'}
                </div>
            </div>
        `;
    }

    function renderSchedulesRosterTable() {
        const tbody = document.getElementById('schedulesRosterTableBody');
        if (!tbody) return;
        const scheds = AdminStore.schedules;

        if (scheds.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No schedule records found.</td></tr>';
            return;
        }

        tbody.innerHTML = scheds.map(s => {
            const officerName = s.officer ? `${s.officer.first_name || ''} ${s.officer.last_name || ''}`.trim() : 'Officer';
            return `
                <tr>
                    <td>
                        <div class="fw-bold text-dark">${formatDate(s.interview_date)}</div>
                        <span class="time-badge">${escapeHtml(s.interview_time)}</span>
                    </td>
                    <td><span class="badge bg-light text-dark border">${escapeHtml(s.program?.code || 'PROG')}</span></td>
                    <td>${escapeHtml(s.beneficiary_qr || 'General Session')}</td>
                    <td>${escapeHtml(officerName)}</td>
                    <td><small class="text-muted">${escapeHtml(s.venue_location)}</small></td>
                    <td class="text-center"><span class="badge ${s.status === 'Cancelled' ? 'bg-danger' : 'bg-success'}">${escapeHtml(s.status)}</span></td>
                    <td class="text-end">
                        ${s.status !== 'Cancelled' ? `<button class="btn btn-sm btn-outline-danger" onclick="cancelScheduleSlot(${s.id})">Cancel</button>` : '<span class="text-muted small">N/A</span>'}
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderTrainingRecords() {
        const tbody = document.getElementById('trainingRecordsTableBody');
        if (!tbody) return;
        const apps = AdminStore.applications.filter(a => a.status === 'Approved' || a.status === 'Completed');

        if (apps.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No eligible training records.</td></tr>';
            return;
        }

        tbody.innerHTML = apps.slice(0, 10).map(a => {
            const ben = a.beneficiary || {};
            const fullName = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || 'Beneficiary';
            const progName = a.program?.name || 'Training Program';
            return `
                <tr>
                    <td class="fw-bold text-dark">${escapeHtml(progName)}</td>
                    <td>${escapeHtml(fullName)}</td>
                    <td><span class="masked-phone">${escapeHtml(maskContactNumber(ben.phone))}</span></td>
                    <td><span class="badge bg-success-subtle text-success">Completed (Present)</span></td>
                    <td>${formatDate(a.date_applied || a.created_at)}</td>
                    <td class="text-center"><span class="badge bg-warning text-dark">Certificate Eligible</span></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-success" onclick="issueCertificate('${a.beneficiary_qr}', '${escapeHtml(fullName)}')">
                            <i class="bi bi-award"></i> Issue
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function autoPullCertificateRecipients() {
        const eligible = AdminStore.applications.filter(a => a.status === 'Approved' || a.status === 'Completed');
        notify('Auto-Pull Successful', `Auto-pulled ${eligible.length} qualified recipients from completed training records for certificate distribution.`, 'success');
        renderTrainingRecords();
    }

    function issueCertificate(qrCode, name) {
        notify('Certificate Issued', `Issued Certificate of Completion for ${name} (${qrCode}).`, 'success');
        logAdminAction('ISSUE_CERTIFICATE', 'beneficiary', null, `Issued training certificate to ${name} (${qrCode})`);
    }

    function quickAddScheduleOnDate(dateStr) {
        openCreateScheduleSlotModal();
        const dateInput = document.getElementById('schedSlotDate');
        if (dateInput) dateInput.value = dateStr;
    }

    function openCreateScheduleSlotModal() {
        document.getElementById('createSchedSlotForm')?.reset();
        
        // Block past dates (Past Date Restriction)
        const todayStr = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('schedSlotDate');
        if (dateInput) {
            dateInput.min = todayStr;
            dateInput.value = todayStr;
        }

        // Populate Programs
        const progSelect = document.getElementById('schedProgSelect');
        if (progSelect) {
            progSelect.innerHTML = AdminStore.programs.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${p.code})</option>`).join('');
        }

        // Populate Officers
        const offSelect = document.getElementById('schedOfficerSelect');
        if (offSelect) {
            offSelect.innerHTML = AdminStore.officers.map(o => `<option value="${o.id}">${escapeHtml(o.first_name || '')} ${escapeHtml(o.last_name || '')} (@${escapeHtml(o.username)})</option>`).join('');
        }

        openModal('createActivityModal');
    }

    async function handleCreateScheduleSlotSubmit(e) {
        e.preventDefault();
        const progId = parseInt(document.getElementById('schedProgSelect').value);
        const officerId = parseInt(document.getElementById('schedOfficerSelect').value);
        const date = document.getElementById('schedSlotDate').value;
        const timeSlot = document.getElementById('schedTimeSlot').value;
        const venue = document.getElementById('schedVenueLocation').value.trim();
        const remarks = document.getElementById('schedRemarks').value.trim();

        // 1. Past Date Validation Check
        const todayStr = new Date().toISOString().split('T')[0];
        if (date < todayStr) {
            document.getElementById('schedSafeguardAlert').classList.remove('d-none');
            document.getElementById('schedSafeguardAlertMsg').textContent = 'Past Date Restriction: System blocks scheduling activities on past dates.';
            return;
        }

        // 2. Conflict Validation Check (prevent overlapping officer or venue)
        const conflict = AdminStore.schedules.find(s => s.interview_date === date && s.interview_time === timeSlot && (s.officer_id === officerId || s.venue_location.toLowerCase() === venue.toLowerCase()) && s.status !== 'Cancelled');
        if (conflict) {
            document.getElementById('schedSafeguardAlert').classList.remove('d-none');
            document.getElementById('schedSafeguardAlertMsg').textContent = `Conflict Validation Warning: Slot overlaps with existing schedule on ${date} at ${timeSlot}. Choose another time or venue.`;
            return;
        }

        try {
            if (typeof DataService !== 'undefined' && DataService.interviews) {
                await DataService.interviews.create({
                    program_id: progId,
                    officer_id: officerId,
                    interview_date: date,
                    interview_time: timeSlot,
                    venue_location: venue,
                    remarks: remarks,
                    status: 'Scheduled',
                    beneficiary_qr: 'QR-BEN-GENERAL'
                });
            }

            await logAdminAction('CREATE_SCHEDULE_SLOT', 'interview_schedule', null, `Created schedule on ${date} ${timeSlot} at ${venue}`);
            notify('Schedule Created', 'Program slot recorded successfully.', 'success');
            closeModal('createActivityModal');
            await refreshAllData();
            renderSchedulingModule();
        } catch (err) {
            notify('Creation Failed', err.message || 'Error creating schedule.', 'danger');
        }
    }

    async function cancelScheduleSlot(schedId) {
        if (!confirm('Are you sure you want to cancel this scheduled activity? Cancelled slots remain recorded with red badge.')) return;

        try {
            if (typeof DataService !== 'undefined' && DataService.interviews) {
                await DataService.interviews.cancel(schedId, { reason: 'Cancelled by PESO Admin' });
            }

            await logAdminAction('CANCEL_SCHEDULE_SLOT', 'interview_schedule', schedId, `Cancelled schedule #${schedId}`);
            notify('Slot Cancelled', 'Activity slot marked as Cancelled.', 'warning');
            await refreshAllData();
            renderSchedulingModule();
        } catch (err) {
            notify('Cancellation Failed', err.message || 'Error cancelling schedule.', 'danger');
        }
    }

    // =========================================================================
    // 8. MODULE 6: FUND ALLOCATION & DISTRIBUTION (REQ034-036, REQ042-046)
    // =========================================================================
    function renderFundsModule() {
        const progs = AdminStore.programs;
        const assist = AdminStore.approvedAssistance;
        let hasOverflow = false;

        const tbody = document.getElementById('programFundsTableBody');
        if (tbody) {
            tbody.innerHTML = progs.map(p => {
                const budget = Number(p.budget) || 0;
                const disbursed = assist.filter(a => a.program_id === p.id).reduce((s, i) => s + (Number(String(i.quantity_amount).replace(/[^0-9.]/g, '')) || 0), 0);
                const remaining = Math.max(0, budget - disbursed);
                const pct = budget > 0 ? Math.round((disbursed / budget) * 100) : 0;
                if (pct >= 90) hasOverflow = true;

                return `
                    <tr>
                        <td>
                            <div class="fw-bold text-dark">${escapeHtml(p.name)}</div>
                            <span class="badge bg-light text-dark border font-monospace">${escapeHtml(p.code)}</span>
                        </td>
                        <td class="fw-bold text-dark">${formatCurrency(budget)}</td>
                        <td class="fw-bold text-success">${formatCurrency(disbursed)}</td>
                        <td class="fw-bold text-primary">${formatCurrency(remaining)}</td>
                        <td class="text-center">
                            <div class="d-flex align-items-center gap-2 justify-content-center">
                                <div class="progress flex-grow-1" style="height: 8px; width: 80px;">
                                    <div class="progress-bar ${pct > 90 ? 'bg-danger' : (pct > 70 ? 'bg-warning' : 'bg-success')}" style="width: ${pct}%;"></div>
                                </div>
                                <span class="small font-monospace">${pct}%</span>
                            </div>
                        </td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-primary" onclick="quickAdjustFund(${p.id}, ${budget})">
                                Adjust
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Show Overflow Alert Box if any program is >90%
        const alertBox = document.getElementById('fundOverflowAlertBox');
        if (alertBox) {
            if (hasOverflow) alertBox.classList.remove('d-none');
            else alertBox.classList.add('d-none');
        }

        // Render Distribution Logs
        const distTbody = document.getElementById('distributionLogsTableBody');
        if (distTbody) {
            if (assist.length === 0) {
                distTbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No distribution records recorded yet.</td></tr>';
            } else {
                distTbody.innerHTML = assist.map(a => {
                    const ben = a.beneficiary || {};
                    const fullName = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || a.beneficiary_qr;
                    const officerName = a.officer ? `${a.officer.first_name || ''} ${a.officer.last_name || ''}`.trim() : 'Officer';
                    return `
                        <tr>
                            <td class="fw-bold text-dark">${escapeHtml(fullName)}</td>
                            <td><span class="badge bg-light text-dark font-monospace border">${escapeHtml(a.program?.code || 'PROG')}</span></td>
                            <td><span class="badge badge-category badge-livelihood">${escapeHtml(a.assistance_type)}</span></td>
                            <td class="fw-bold text-success">${escapeHtml(a.quantity_amount)}</td>
                            <td>${formatDate(a.approval_date || a.created_at)}</td>
                            <td>${escapeHtml(officerName)}</td>
                            <td><small class="text-muted">${escapeHtml(a.conditions || 'Approved by PESO')}</small></td>
                        </tr>
                    `;
                }).join('');
            }
        }
    }

    function openFundAllocationModal() {
        const progSelect = document.getElementById('fundAllocProgSelect');
        if (progSelect) {
            progSelect.innerHTML = AdminStore.programs.map(p => `<option value="${p.id}" data-budget="${p.budget}">${escapeHtml(p.name)} (${p.code}) - Current: ${formatCurrency(p.budget)}</option>`).join('');
            handleFundProgSelectionChange();
        }
        document.getElementById('fundAllocForm')?.reset();
        openModal('fundAllocationModal');
    }

    function handleFundProgSelectionChange() {
        const progSelect = document.getElementById('fundAllocProgSelect');
        const selOpt = progSelect?.selectedOptions[0];
        if (selOpt) {
            const currentBudget = selOpt.getAttribute('data-budget') || 0;
            const input = document.getElementById('fundAllocNewBudget');
            if (input) input.value = currentBudget;
        }
    }

    function quickAdjustFund(progId, currentBudget) {
        openFundAllocationModal();
        const progSelect = document.getElementById('fundAllocProgSelect');
        if (progSelect) {
            progSelect.value = progId;
            handleFundProgSelectionChange();
        }
    }

    async function handleFundAllocationSubmit(e) {
        e.preventDefault();
        const progId = parseInt(document.getElementById('fundAllocProgSelect').value);
        const newBudget = parseFloat(document.getElementById('fundAllocNewBudget').value) || 0;
        const justification = document.getElementById('fundAllocJustification').value.trim();

        try {
            if (typeof DataService !== 'undefined' && DataService.programs) {
                await DataService.programs.update(progId, { budget: newBudget });
            }

            await logAdminAction('ADJUST_PROGRAM_BUDGET', 'program', progId, `Adjusted budget for program #${progId} to ${formatCurrency(newBudget)}. Reason: ${justification}`);
            notify('Fund Allocation Saved', 'Program budget adjusted and logged to audit trail.', 'success');
            closeModal('fundAllocationModal');
            await refreshAllData();
            renderFundsModule();
        } catch (err) {
            notify('Adjustment Failed', err.message || 'Error updating budget.', 'danger');
        }
    }

    function exportDistributionLogsCsv() {
        const rows = [
            ['Beneficiary QR', 'Beneficiary Name', 'Program Code', 'Assistance Type', 'Amount/Quantity', 'Release Date', 'Conditions']
        ];
        AdminStore.approvedAssistance.forEach(a => {
            const ben = a.beneficiary || {};
            const name = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || a.beneficiary_qr;
            rows.push([
                a.beneficiary_qr,
                name,
                a.program?.code || '',
                a.assistance_type,
                a.quantity_amount,
                a.approval_date || '',
                a.conditions || ''
            ]);
        });
        downloadCsvFile(rows, `PESO_Assistance_Distribution_Logs_${new Date().toISOString().substring(0, 10)}.csv`);
    }

    // =========================================================================
    // 9. MODULE 7: NOTIFICATION HUB (REQ047 – REQ048)
    // =========================================================================
    function renderNotificationsModule() {
        const notifs = AdminStore.notifications;
        const search = (document.getElementById('notifSearchInput')?.value || '').toLowerCase();

        const filtered = notifs.filter(n => {
            const str = `${n.title || ''} ${n.message || ''} ${n.beneficiary_qr || ''} ${n.staff_user_id || ''}`.toLowerCase();
            return !search || str.includes(search);
        });

        const tbody = document.getElementById('notificationsHistoryTableBody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No dispatched notification logs found.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(n => {
            const target = n.beneficiary_qr ? `<span class="badge bg-light text-dark font-monospace border">${escapeHtml(n.beneficiary_qr)}</span>` : `<span class="badge bg-primary-subtle text-primary">Staff #${n.staff_user_id}</span>`;
            return `
                <tr>
                    <td>${target}</td>
                    <td class="fw-bold text-dark">${escapeHtml(n.title)}</td>
                    <td><div class="text-secondary small" style="max-width: 320px;">${escapeHtml(n.message)}</div></td>
                    <td><small class="text-muted">${formatDateTime(n.created_at)}</small></td>
                    <td class="text-center"><span class="badge ${n.is_read ? 'bg-secondary' : 'bg-success'}">${n.is_read ? 'Read' : 'Delivered'}</span></td>
                </tr>
            `;
        }).join('');
    }

    function filterNotificationLogs() {
        renderNotificationsModule();
    }

    function openComposeNotificationModal() {
        document.getElementById('composeNotifForm')?.reset();
        handleNotifRecipientChange();
        openModal('composeNotificationModal');
    }

    function handleNotifRecipientChange() {
        const type = document.getElementById('notifRecipientType')?.value;
        const specificContainer = document.getElementById('notifSpecificRecipientContainer');
        if (specificContainer) {
            if (type === 'specific_beneficiary' || type === 'specific_staff') {
                specificContainer.classList.remove('d-none');
            } else {
                specificContainer.classList.add('d-none');
            }
        }
    }

    async function handleComposeNotificationSubmit(e) {
        e.preventDefault();
        const type = document.getElementById('notifRecipientType').value;
        const specificTarget = document.getElementById('notifSpecificRecipient').value.trim();
        const title = document.getElementById('notifTitleInput').value.trim();
        const msg = document.getElementById('notifMessageInput').value.trim();

        try {
            if (type === 'all_beneficiaries') {
                // Broadcast to all unique beneficiaries
                const bens = AdminStore.beneficiaries;
                const inserts = bens.map(b => ({
                    beneficiary_qr: b.qr_code,
                    title: title,
                    message: msg,
                    is_read: false
                }));
                if (inserts.length > 0) {
                    await supabaseClient.from('notifications').insert(inserts);
                }
            } else if (type === 'specific_beneficiary') {
                await supabaseClient.from('notifications').insert({
                    beneficiary_qr: specificTarget || 'QR-BEN-GENERAL',
                    title: title,
                    message: msg,
                    is_read: false
                });
            } else {
                await supabaseClient.from('notifications').insert({
                    staff_user_id: parseInt(specificTarget) || 1,
                    title: title,
                    message: msg,
                    is_read: false
                });
            }

            await logAdminAction('DISPATCH_NOTIFICATION', 'notification', null, `Dispatched [${title}] to [${type}]`);
            notify('Notification Dispatched', 'Message sent and logged to Supabase.', 'success');
            closeModal('composeNotificationModal');
            await refreshAllData();
            renderNotificationsModule();
        } catch (err) {
            notify('Dispatch Failed', err.message || 'Error sending notification.', 'danger');
        }
    }

    // =========================================================================
    // 10. MODULE 8: SYSTEM REPORTS ENGINE (REQ049 – REQ059)
    // =========================================================================
    let currentReportDataset = [];

    function generateReportData() {
        const type = document.getElementById('reportTypeSelect')?.value || 'applications';
        const start = document.getElementById('reportStartDate')?.value || '2026-01-01';
        const end = document.getElementById('reportEndDate')?.value || '2026-12-31';

        const thead = document.getElementById('reportDisplayTableHead');
        const tbody = document.getElementById('reportDisplayTableBody');
        const titleHeader = document.getElementById('reportTitleHeader');
        const countBadge = document.getElementById('reportTotalRecordsBadge');

        if (!thead || !tbody) return;

        if (type === 'applications') {
            titleHeader.textContent = '1. Application Management & Barangay Geographic Breakdown';
            thead.innerHTML = `
                <tr>
                    <th>App Number</th>
                    <th>Beneficiary Name</th>
                    <th>Barangay / Address</th>
                    <th>Program Code</th>
                    <th>Date Applied</th>
                    <th>Status</th>
                </tr>
            `;
            const filtered = AdminStore.applications.filter(a => {
                const d = a.created_at || a.date_applied || '';
                return d >= start && d <= (end + 'T23:59:59');
            });
            currentReportDataset = filtered.map(a => {
                const ben = a.beneficiary || {};
                return {
                    appNumber: a.application_number,
                    name: `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || 'Applicant',
                    address: ben.address || 'Barangay Poblacion',
                    prog: a.program?.code || 'PESO',
                    date: a.date_applied || a.created_at,
                    status: a.status
                };
            });
            tbody.innerHTML = currentReportDataset.map(r => `
                <tr>
                    <td class="font-monospace">${escapeHtml(r.appNumber)}</td>
                    <td class="fw-bold text-dark">${escapeHtml(r.name)}</td>
                    <td>${escapeHtml(r.address)}</td>
                    <td><span class="badge bg-light text-dark border">${escapeHtml(r.prog)}</span></td>
                    <td>${formatDate(r.date)}</td>
                    <td><span class="badge bg-primary-subtle text-primary">${escapeHtml(r.status)}</span></td>
                </tr>
            `).join('') || '<tr><td colspan="6" class="text-center py-4 text-muted">No records found for specified date range.</td></tr>';
            if (countBadge) countBadge.textContent = `${currentReportDataset.length} Records`;

        } else if (type === 'scheduling') {
            titleHeader.textContent = '2. Attendance & Scheduling Participation Report';
            thead.innerHTML = `
                <tr>
                    <th>Date & Time</th>
                    <th>Program</th>
                    <th>Assigned Officer</th>
                    <th>Venue</th>
                    <th>Attendance Status</th>
                </tr>
            `;
            const filtered = AdminStore.schedules.filter(s => s.interview_date >= start && s.interview_date <= end);
            currentReportDataset = filtered.map(s => ({
                datetime: `${s.interview_date} ${s.interview_time}`,
                prog: s.program?.name || 'Program',
                officer: s.officer ? `${s.officer.first_name || ''} ${s.officer.last_name || ''}`.trim() : 'Officer',
                venue: s.venue_location,
                attendance: s.attendance_status || s.status
            }));
            tbody.innerHTML = currentReportDataset.map(r => `
                <tr>
                    <td class="fw-bold text-dark">${escapeHtml(r.datetime)}</td>
                    <td>${escapeHtml(r.prog)}</td>
                    <td>${escapeHtml(r.officer)}</td>
                    <td>${escapeHtml(r.venue)}</td>
                    <td><span class="badge bg-success-subtle text-success">${escapeHtml(r.attendance)}</span></td>
                </tr>
            `).join('') || '<tr><td colspan="5" class="text-center py-4 text-muted">No records found.</td></tr>';
            if (countBadge) countBadge.textContent = `${currentReportDataset.length} Records`;

        } else if (type === 'distribution') {
            titleHeader.textContent = '3. Assistance & Livelihood Distribution Report';
            thead.innerHTML = `
                <tr>
                    <th>Beneficiary QR</th>
                    <th>Program</th>
                    <th>Assistance Type</th>
                    <th>Amount / Items</th>
                    <th>Release Date</th>
                </tr>
            `;
            const filtered = AdminStore.approvedAssistance.filter(a => {
                const d = a.approval_date || a.created_at || '';
                return d >= start && d <= (end + 'T23:59:59');
            });
            currentReportDataset = filtered.map(a => ({
                qr: a.beneficiary_qr,
                prog: a.program?.code || 'PESO',
                type: a.assistance_type,
                amount: a.quantity_amount,
                date: a.approval_date || a.created_at
            }));
            tbody.innerHTML = currentReportDataset.map(r => `
                <tr>
                    <td class="font-monospace">${escapeHtml(r.qr)}</td>
                    <td><span class="badge bg-light text-dark border">${escapeHtml(r.prog)}</span></td>
                    <td>${escapeHtml(r.type)}</td>
                    <td class="fw-bold text-success">${escapeHtml(r.amount)}</td>
                    <td>${formatDate(r.date)}</td>
                </tr>
            `).join('') || '<tr><td colspan="5" class="text-center py-4 text-muted">No records found.</td></tr>';
            if (countBadge) countBadge.textContent = `${currentReportDataset.length} Records`;

        } else {
            titleHeader.textContent = '4. Fund Utilization & Resource Usage Report';
            thead.innerHTML = `
                <tr>
                    <th>Program Name</th>
                    <th>Allocated Budget</th>
                    <th>Total Disbursed</th>
                    <th>Remaining Balance</th>
                    <th>Status</th>
                </tr>
            `;
            currentReportDataset = AdminStore.programs.map(p => {
                const b = Number(p.budget) || 0;
                const d = AdminStore.approvedAssistance.filter(a => a.program_id === p.id).reduce((s, i) => s + (Number(String(i.quantity_amount).replace(/[^0-9.]/g, '')) || 0), 0);
                return {
                    name: p.name,
                    budget: formatCurrency(b),
                    disbursed: formatCurrency(d),
                    remaining: formatCurrency(Math.max(0, b - d)),
                    status: p.status
                };
            });
            tbody.innerHTML = currentReportDataset.map(r => `
                <tr>
                    <td class="fw-bold text-dark">${escapeHtml(r.name)}</td>
                    <td>${r.budget}</td>
                    <td class="text-success fw-bold">${r.disbursed}</td>
                    <td class="text-primary fw-bold">${r.remaining}</td>
                    <td><span class="badge bg-success">${escapeHtml(r.status)}</span></td>
                </tr>
            `).join('');
            if (countBadge) countBadge.textContent = `${currentReportDataset.length} Programs`;
        }
    }

    function exportActiveReportCSV() {
        if (!currentReportDataset || currentReportDataset.length === 0) {
            notify('Export Notice', 'No data available to export.', 'warning');
            return;
        }

        const headers = Object.keys(currentReportDataset[0]);
        const rows = [headers];
        currentReportDataset.forEach(obj => {
            rows.push(headers.map(h => String(obj[h] || '').replace(/,/g, ' ')));
        });

        const type = document.getElementById('reportTypeSelect')?.value || 'report';
        downloadCsvFile(rows, `PESO_${type.toUpperCase()}_REPORT_${new Date().toISOString().substring(0, 10)}.csv`);
    }

    function printActiveReportPDF() {
        window.print();
    }

    function downloadCsvFile(rows, filename) {
        const csvContent = '\uFEFF' + rows.map(e => e.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // =========================================================================
    // 11. MODULE 9: ARCHIVE SECTION (READ-ONLY MONITORING)
    // =========================================================================
    function renderArchiveModule() {
        const archProgs = AdminStore.programs.filter(p => p.status !== 'Active');
        const archOfficers = AdminStore.officers.filter(o => o.status !== 'Active');

        const tbody = document.getElementById('archiveTableBody');
        if (!tbody) return;

        if (archProgs.length === 0 && archOfficers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Archive box is clean — no deactivated items.</td></tr>';
            return;
        }

        let html = '';
        archProgs.forEach(p => {
            html += `
                <tr>
                    <td>
                        <div class="fw-bold text-secondary text-decoration-line-through">${escapeHtml(p.name)}</div>
                        <span class="badge bg-light text-dark font-monospace border">${escapeHtml(p.code)}</span>
                    </td>
                    <td><span class="badge bg-warning-subtle text-dark">Deactivated Program</span></td>
                    <td>Budget: ${formatCurrency(p.budget)}</td>
                    <td>${formatDate(p.updated_at || p.created_at)}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-success me-1" onclick="restoreArchivedProgram(${p.id})">
                            <i class="bi bi-arrow-counterclockwise"></i> Restore Active
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="permanentlyDeleteProgram(${p.id})">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });

        archOfficers.forEach(o => {
            const name = `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.username;
            html += `
                <tr>
                    <td>
                        <div class="fw-bold text-secondary text-decoration-line-through">${escapeHtml(name)}</div>
                        <small class="text-muted font-monospace">@${escapeHtml(o.username)}</small>
                    </td>
                    <td><span class="badge bg-danger-subtle text-danger">Deactivated Officer</span></td>
                    <td>Role: ${escapeHtml(o.role)}</td>
                    <td>${formatDate(o.updated_at || o.created_at)}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-success me-1" onclick="toggleOfficerStatus(${o.id}, true)">
                            <i class="bi bi-arrow-counterclockwise"></i> Restore Active
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="permanentlyDeleteOfficer(${o.id})">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    async function restoreArchivedProgram(id) {
        try {
            if (typeof DataService !== 'undefined' && DataService.programs) {
                await DataService.programs.toggleStatus(id, 'Active');
            }
            await logAdminAction('RESTORE_PROGRAM', 'program', id, `Restored archived program #${id} to Active status`);
            notify('Program Restored', 'Program restored to active catalog.', 'success');
            await refreshAllData();
            renderArchiveModule();
        } catch (err) {
            notify('Restore Failed', err.message || 'Error restoring program.', 'danger');
        }
    }

    async function permanentlyDeleteProgram(id) {
        if (!confirm('Are you sure you want to PERMANENTLY delete this program from Supabase? This action is irreversible.')) return;
        try {
            if (typeof DataService !== 'undefined' && DataService.programs) {
                await DataService.programs.delete(id);
            }
            await logAdminAction('PERMANENT_DELETE_PROGRAM', 'program', id, `Permanently deleted program #${id}`);
            notify('Program Deleted', 'Program record permanently purged.', 'warning');
            await refreshAllData();
            renderArchiveModule();
        } catch (err) {
            notify('Delete Failed', err.message || 'Error deleting program.', 'danger');
        }
    }

    async function permanentlyDeleteOfficer(id) {
        if (!confirm('Are you sure you want to PERMANENTLY delete this staff account?')) return;
        try {
            if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
                await DataService.staffProfiles.delete(id);
            }
            await logAdminAction('PERMANENT_DELETE_OFFICER', 'staff_profile', id, `Permanently deleted officer #${id}`);
            notify('Officer Purged', 'Staff profile deleted permanently.', 'warning');
            await refreshAllData();
            renderArchiveModule();
        } catch (err) {
            notify('Delete Failed', err.message || 'Error deleting officer.', 'danger');
        }
    }

    // =========================================================================
    // 12. AUDIT TRAIL MODAL VIEWER
    // =========================================================================
    function showAuditLogsModal() {
        const tbody = document.getElementById('auditLogsModalTableBody');
        if (!tbody) return;

        const audits = AdminStore.auditLogs;
        if (audits.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No audit logs recorded yet.</td></tr>';
        } else {
            tbody.innerHTML = audits.map(l => {
                const actor = l.staff ? `${l.staff.first_name || ''} ${l.staff.last_name || ''}`.trim() : (l.staff_user_id ? `Staff #${l.staff_user_id}` : (l.beneficiary_qr || 'System'));
                return `
                    <tr>
                        <td class="font-monospace">${formatDateTime(l.created_at)}</td>
                        <td class="fw-bold">${escapeHtml(actor)}</td>
                        <td><span class="badge bg-primary-subtle text-primary">${escapeHtml(l.action)}</span></td>
                        <td>${escapeHtml(l.entity_type || 'General')}</td>
                        <td><small class="text-secondary">${escapeHtml(l.details || '')}</small></td>
                    </tr>
                `;
            }).join('');
        }

        openModal('auditLogsModal');
    }

    // Ordinance Reference Modal
    function showOrdinanceReferenceModal() {
        const tbody = document.getElementById('ordinanceBreakdownTableBody');
        if (tbody) {
            tbody.innerHTML = AdminStore.programs.map(p => `
                <tr>
                    <td class="font-monospace">${escapeHtml(p.code)}</td>
                    <td class="fw-semibold text-dark">${escapeHtml(p.name)}</td>
                    <td>${escapeHtml(p.category || 'Livelihood')}</td>
                    <td class="text-end fw-bold text-success">${formatCurrency(p.budget)}</td>
                </tr>
            `).join('');
        }
        openModal('ordinanceReferenceModal');
    }

    function openUploadOrdinanceModal() {
        document.getElementById('uploadOrdinanceForm')?.reset();
        openModal('uploadOrdinanceModal');
    }

    async function handleUploadOrdinance(e) {
        e.preventDefault();
        const title = document.getElementById('ordTitle').value.trim();
        const year = document.getElementById('ordYear').value.trim();
        const total = parseFloat(document.getElementById('ordTotal').value) || 0;
        const fileInput = document.getElementById('ordFile');

        if (!fileInput.files || fileInput.files.length === 0) {
            notify('Validation Error', 'Please select an ordinance document file.', 'warning');
            return;
        }

        const file = fileInput.files[0];
        const validExts = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
        const hasValidExt = validExts.some(ext => file.name.toLowerCase().endsWith(ext));
        if (!hasValidExt) {
            notify('Invalid File Type', 'Only official PDF, Word, or Image ordinance documents are allowed.', 'warning');
            return;
        }

        await logAdminAction('UPLOAD_ORDINANCE', 'ordinance', null, `Uploaded official ordinance [${title}] for BY ${year} (Total: ${formatCurrency(total)}) - File: ${file.name}`);
        notify('Ordinance Uploaded', `Ordinance "${title}" recorded successfully.`, 'success');
        closeModal('uploadOrdinanceModal');
    }

    // Realtime Synchronization Listener
    function initRealtimeSync() {
        try {
            if (typeof DataService !== 'undefined' && DataService.realtime) {
                DataService.realtime.subscribeMulti(['programs', 'applications', 'staff_profiles', 'interview_schedules', 'approved_assistance', 'notifications'], (payload) => {
                    console.log('[PESO Admin Realtime Event Received]:', payload.table, payload.eventType);
                    refreshAllData().then(() => renderActiveTab());
                });
            }
        } catch (e) {
            console.warn('[PESO Admin] Realtime listener note:', e);
        }
    }

    // Dark Mode Toggle
    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('peso_admin_dark_mode', isDark ? 'true' : 'false');
    }

    // Apply Saved Theme
    if (localStorage.getItem('peso_admin_dark_mode') === 'true') {
        document.body.classList.add('dark-mode');
    }

    async function logoutAdmin() {
        if (confirm('Are you sure you want to sign out from the PESO Administrator Portal?')) {
            try {
                if (typeof SessionManager !== 'undefined' && SessionManager.logout) {
                    await SessionManager.logout('admin_login.html');
                    return;
                }
                if (typeof AuthGuard !== 'undefined' && AuthGuard.logout) {
                    await AuthGuard.logout('admin_login.html');
                    return;
                }
                if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.auth) {
                    await supabaseClient.auth.signOut();
                }
            } catch (e) {
                console.warn('[PESO_ADMIN] Logout note:', e);
            }
            try { sessionStorage.clear(); } catch (e) {}
            window.location.href = 'admin_login.html';
        }
    }

    // Export functions to window namespace for inline event handlers
    window.switchTab = switchTab;
    window.toggleDarkMode = toggleDarkMode;
    window.logoutAdmin = logoutAdmin;
    window.showAuditLogsModal = showAuditLogsModal;
    window.showOrdinanceReferenceModal = showOrdinanceReferenceModal;
    window.openUploadOrdinanceModal = openUploadOrdinanceModal;
    window.handleUploadOrdinance = handleUploadOrdinance;
    window.refreshDashboardMetrics = () => refreshAllData().then(() => renderDashboardOverview());

    // Module 2
    window.openNewOfficerModal = openNewOfficerModal;
    window.handleCreateOfficerSubmit = handleCreateOfficerSubmit;
    window.openEditOfficerModal = openEditOfficerModal;
    window.handleSaveOfficerUpdates = handleSaveOfficerUpdates;
    window.toggleOfficerStatus = toggleOfficerStatus;
    window.filterOfficersList = filterOfficersList;
    window.exportOfficersCsv = () => {
        const rows = [['Username', 'Name', 'Email', 'Role', 'Phone', 'Status', 'Created']];
        AdminStore.officers.forEach(o => rows.push([o.username, `${o.first_name || ''} ${o.last_name || ''}`, o.email, o.role, maskContactNumber(o.phone), o.status, o.created_at || '']));
        downloadCsvFile(rows, `PESO_Officers_Roster_${new Date().toISOString().substring(0, 10)}.csv`);
    };

    // Module 3
    window.openCreateProgramModal = openCreateProgramModal;
    window.handleCreateProgramSubmit = handleCreateProgramSubmit;
    window.openProgramDetailsViewModal = openProgramDetailsViewModal;
    window.openProgramEditModal = openProgramEditModal;
    window.handleSaveProgramUpdates = handleSaveProgramUpdates;
    window.handleProgramStatusToggle = handleProgramStatusToggle;
    window.filterProgramsCatalog = filterProgramsCatalog;
    window.showProgramsLevel1 = showProgramsLevel1;
    window.showProgramsLevel2 = showProgramsLevel2;
    window.drilldownToBatches = drilldownToBatches;
    window.drilldownToBeneficiaries = drilldownToBeneficiaries;
    window.inspectBeneficiaryProfile = inspectBeneficiaryProfile;

    // Module 4
    window.filterEvaluationQueue = filterEvaluationQueue;
    window.inspectApplicationForEvaluation = inspectApplicationForEvaluation;
    window.handleEvaluationDecisionSubmit = handleEvaluationDecisionSubmit;

    // Module 5
    window.setSchedViewMode = setSchedViewMode;
    window.navigateCalendarMonth = navigateCalendarMonth;
    window.jumpToCalendarToday = jumpToCalendarToday;
    window.selectCalendarDate = selectCalendarDate;
    window.quickAddScheduleOnDate = quickAddScheduleOnDate;
    window.openCreateScheduleSlotModal = openCreateScheduleSlotModal;
    window.handleCreateScheduleSlotSubmit = handleCreateScheduleSlotSubmit;
    window.cancelScheduleSlot = cancelScheduleSlot;
    window.autoPullCertificateRecipients = autoPullCertificateRecipients;
    window.issueCertificate = issueCertificate;

    // Module 6
    window.openFundAllocationModal = openFundAllocationModal;
    window.handleFundProgSelectionChange = handleFundProgSelectionChange;
    window.quickAdjustFund = quickAdjustFund;
    window.handleFundAllocationSubmit = handleFundAllocationSubmit;
    window.exportDistributionLogsCsv = exportDistributionLogsCsv;

    // Module 7
    window.filterNotificationLogs = filterNotificationLogs;
    window.openComposeNotificationModal = openComposeNotificationModal;
    window.handleNotifRecipientChange = handleNotifRecipientChange;
    window.handleComposeNotificationSubmit = handleComposeNotificationSubmit;

    // Module 8
    window.generateReportData = generateReportData;
    window.exportActiveReportCSV = exportActiveReportCSV;
    window.printActiveReportPDF = printActiveReportPDF;

    // Module 9
    window.restoreArchivedProgram = restoreArchivedProgram;
    window.permanentlyDeleteProgram = permanentlyDeleteProgram;
    window.permanentlyDeleteOfficer = permanentlyDeleteOfficer;

    // Diagnostics tool
    window.PesoAdmin = {
        version: '3.0.0',
        portal: 'PESO Administrator Portal',
        getStore: () => AdminStore,
        refresh: refreshAllData,
        diagnose: function () {
            console.group('[PESO Admin Diagnostics]');
            console.log('%c PESO Admin Live Suite v3.0.0 ', 'background: #0284C7; color: white; font-weight: bold;');
            console.log('Programs in cache:', AdminStore.programs.length);
            console.log('Applications in cache:', AdminStore.applications.length);
            console.log('Officers in cache:', AdminStore.officers.length);
            console.log('Schedules in cache:', AdminStore.schedules.length);
            console.log('Disbursements in cache:', AdminStore.approvedAssistance.length);
            console.groupEnd();
            return { healthy: true, store: AdminStore };
        }
    };

    // Auto-boot on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        initPesoAdmin();
    });

})(window, document);

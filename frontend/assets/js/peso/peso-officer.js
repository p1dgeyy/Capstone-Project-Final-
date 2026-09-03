/**
 * PESO Officer Portal Master Controller Module (peso-officer.js)
 * City Government of Koronadal - Public Employment Service Office
 * 
 * 10 Standard Officer Modules Implemented:
 * 1. Dashboard: Real-time overview of officer activities & 9 Quick-Access cards.
 * 2. Beneficiary Management: Officer-managed intake, update, activation/deactivation (no deletion), audit logging, masked contacts.
 * 3. Application Evaluation: Document completeness check, Approve Completeness (forwards to Admin Level 3), Deny with mandatory reason & auto-enforced 3-day resubmission window.
 * 4. Beneficiary Batches: Group Admin-approved candidates into operational batches, lock once scheduled, instant notifications.
 * 5. Schedule: Assign batches to Admin-created slots (Interview, Training, Distribution) with confirmation prompts. (No slot creation for officers).
 * 6. Training Attendance: Per-beneficiary training progress tracking (In Progress / Completed), syncs with Admin certificate auto-pull eligibility.
 * 7. Fund & Resource Tracking: Record disbursement of kits and cash grants with mandatory dual verification (Officer + Beneficiary confirmation).
 * 8. Disbursement: Release desk with mandatory QR scan confirmation, auto-inventory deduction, and real-time mirror to beneficiary portal.
 * 9. Notification Hub: Role-scoped notification streams (Admin updates, applicant resubmissions) and cohort reminder composer.
 * 10. Report Engine: Read-only officer-side reports with 8 standard datasets, CSV export, and PDF printable generator.
 */

const PesoOfficerApp = (() => {
    'use strict';

    const state = {
        beneficiaries: [],
        applications: [],
        schedules: [],
        batches: [],
        assistanceRecords: [],
        approvedAssistance: [],
        trainingRecords: [],
        officers: [],
        notifications: [],
        auditLogs: [],
        pendingIntakeData: null,
        currentTab: 'dashboard',
        currentScheduleDate: new Date().toISOString().substring(0, 10),
        currentScheduleViewMode: 'calendar',
        selectedEvalAppId: null,
        selectedInterviewScheduleId: null,
        selectedBatchAssignAppIds: [],
        activeBatchProgram: 'SPES',
        activeReportDataset: 'applications',
        isLoaded: false,
        // Real context captured by handleQrDisbursementScan(), consumed by
        // confirmDisbursementRelease() -- the confirm step used to re-derive
        // everything (including the amount) from DOM textContent, and hardcoded
        // quantity_amount:5000 in the DB insert outright regardless of what was
        // actually shown or approved.
        pendingDisbursement: null
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

    function logAudit(actionType, details, targetEntity = 'PESO Officer Portal') {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{"fullName":"PESO Officer","username":"peso-officer","id":2}');
        const entry = {
            action: actionType,
            details: details,
            officer: (currentUser && currentUser.fullName) || 'PESO Officer',
            timestamp: new Date().toISOString()
        };
        state.auditLogs.unshift(entry);

        if (typeof window.logAuditEvent === 'function') {
            window.logAuditEvent(actionType, details);
        } else if (typeof PESOSafeguards !== 'undefined' && PESOSafeguards.logAudit) {
            PESOSafeguards.logAudit({
                intent: actionType,
                actionType: actionType,
                targetEntity: targetEntity,
                status: 'SUCCESS',
                details: details
            });
        }
        // Route through the safe helper instead of inserting directly into audit_logs:
        // DataService.auditLogs.log() resolves the required staff_user_id / beneficiary_qr
        // actor column so the insert satisfies the chk_audit_actor constraint. A raw insert
        // here (the old code) set neither column and violated that constraint on every call.
        if (typeof DataService !== 'undefined' && DataService.auditLogs && typeof DataService.auditLogs.log === 'function') {
            DataService.auditLogs.log({
                action: actionType,
                entityType: 'officer_action',
                details: details
            }).catch(() => {});
        }
    }

    function safeOpenModal(modalId) {
        const modalEl = document.getElementById(modalId);
        if (!modalEl) return;
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            bootstrap.Modal.getOrCreateInstance(modalEl).show();
        } else {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
        }
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
     * Switch Navigation Tabs across all 10 standard modules
     */
    function switchTab(tabId) {
        const cleanId = (tabId || 'dashboard').replace(/^tab-/, '').replace(/^nav/, '').toLowerCase();
        state.currentTab = cleanId;

        const tabMap = {
            'dashboard': 'tab-dashboard',
            'beneficiaries': 'tab-beneficiaries',
            'evaluation': 'tab-evaluation',
            'batches': 'tab-livelihood-batches',
            'livelihood-batches': 'tab-livelihood-batches',
            'livelihood': 'tab-livelihood-batches',
            'schedule': 'tab-schedule',
            'daily-schedules': 'tab-schedule',
            'training': 'tab-training',
            'tracking': 'tab-tracking',
            'approved-assistance': 'tab-tracking',
            'disbursement': 'tab-disbursement',
            'notifications': 'tab-notifications',
            'reports': 'tab-reports',
            'officer-roster': 'tab-officer-roster'
        };

        const targetSectionId = tabMap[cleanId] || `tab-${cleanId}`;

        document.querySelectorAll('.tab-section').forEach(sec => {
            if (sec.id === targetSectionId) {
                sec.classList.remove('d-none');
                sec.style.display = 'block';
            } else {
                sec.classList.add('d-none');
                sec.style.display = 'none';
            }
        });

        document.querySelectorAll('.sidebar-menu .nav-link').forEach(link => {
            const onclickAttr = link.getAttribute('onclick') || '';
            if (onclickAttr.includes(`'${cleanId}'`) || onclickAttr.includes(`'${tabId}'`)) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Trigger corresponding module renderers
        if (cleanId === 'dashboard') {
            renderOfficerDashboard();
        } else if (cleanId === 'beneficiaries') {
            renderBeneficiariesTable();
        } else if (cleanId === 'evaluation') {
            renderOfficerEvaluationTable();
        } else if (cleanId === 'batches' || cleanId.includes('batch')) {
            renderBeneficiaryBatchesModule();
        } else if (cleanId === 'schedule' || cleanId.includes('sched')) {
            renderOfficerScheduleModule();
        } else if (cleanId === 'training') {
            renderTrainingAttendanceTable();
        } else if (cleanId === 'tracking' || cleanId.includes('assist')) {
            renderApprovedAssistanceTable();
        } else if (cleanId === 'disbursement') {
            renderDisbursementLedgerTable();
        } else if (cleanId === 'notifications') {
            renderOfficerNotificationsFeed();
        } else if (cleanId === 'reports') {
            loadOfficerReportDataset();
        } else if (cleanId.includes('roster')) {
            renderOfficerRosterTable();
        }

        logAudit('OFFICER_SWITCH_TAB', `Switched view to module tab "${cleanId}"`);
    }

    /**
     * Helper: Get Assigned Programs for Current Officer (Real-Time Live Programs)
     */
    function getOfficerAssignedPrograms() {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (user && Array.isArray(user.assigned_programs) && user.assigned_programs.length > 0) {
            return user.assigned_programs;
        }
        if (Array.isArray(state.programs) && state.programs.length > 0) {
            return state.programs.map(p => p.code || p.name);
        }
        return ['TUPAD', 'SPES', 'GIP', 'CKGIP', 'PFAS', 'AICS', 'KEEP', 'OFW-RLAP', 'WELD-NCII', 'DILP-IGP', 'DILP-DK', 'SP-SEK', 'PEAP', 'AGRI-SK'];
    }

    /**
     * Helper: Navigate directly to a specific module filtered by status (from Stat Cards [View] buttons)
     */
    function navigateToStatusList(module, statusFilter) {
        switchTab(module);
        setTimeout(() => {
            if (module === 'evaluation') {
                const searchEl = document.getElementById('officerEvalSearchInput') || document.getElementById('searchApplicationInput');
                if (statusFilter === 'pending_officer') {
                    if (searchEl) searchEl.value = 'Pending';
                } else if (statusFilter === 'pending_admin') {
                    if (searchEl) searchEl.value = 'Approved';
                } else {
                    if (searchEl) searchEl.value = '';
                }
                if (typeof filterEvaluationQueue === 'function') filterEvaluationQueue();
                if (typeof renderOfficerEvaluationTable === 'function') renderOfficerEvaluationTable();
            } else if (module === 'batches') {
                const filterEl = document.getElementById('batchStatusFilter');
                if (filterEl) filterEl.value = statusFilter === 'unbatched' ? 'unbatched' : 'active';
                if (typeof filterBatches === 'function') filterBatches();
                if (typeof renderBeneficiaryBatchesModule === 'function') renderBeneficiaryBatchesModule();
            } else if (module === 'training') {
                const statusEl = document.getElementById('trainingStatusFilter');
                if (statusEl) statusEl.value = statusFilter === 'in_progress' ? 'In Progress' : (statusFilter === 'completed' ? 'Completed' : '');
                if (typeof filterTrainingAttendanceTable === 'function') filterTrainingAttendanceTable();
            } else if (module === 'reports') {
                const datasetSelect = document.getElementById('officerReportDatasetSelect');
                if (datasetSelect) {
                    datasetSelect.value = statusFilter === 'incomplete' ? 'incomplete' : 'applications';
                    if (typeof loadOfficerReportDataset === 'function') loadOfficerReportDataset();
                }
            }
        }, 120);
        logAudit('DASH_STAT_NAVIGATE', `Clicked [View] card for status: ${statusFilter} in module: ${module}`);
    }

    /**
     * Helper: Open Schedule module for a specific day from Today's Activities
     */
    function navigateToScheduleDay(dateStr) {
        const targetDate = dateStr || new Date().toISOString().substring(0, 10);
        state.currentScheduleDate = targetDate;
        switchTab('schedule');
        setTimeout(() => {
            const picker = document.getElementById('scheduleDatePickerInput');
            if (picker) {
                picker.value = targetDate;
                if (typeof updateScheduleDateHeaderDisplay === 'function') updateScheduleDateHeaderDisplay();
            }
            if (typeof renderDailySchedules === 'function') renderDailySchedules();
        }, 120);
        logAudit('DASH_VIEW_SCHEDULE', `Navigated to schedule date: ${targetDate}`);
    }

    /**
     * MODULE 1: Dashboard Overview (100% Design-Compliant Component Integration)
     * Implements:
     * 1. Officer Assigned Programs Scoping
     * 2. 8 Lifecycle Stat Cards with [View] Navigation
     * 3. Today's Activities (Time, Slot Type, Program, Batch, Venue, [View Schedule])
     * 4. Fund & Resource Balance per Assigned Program
     * 5. Action Items Queue (Failed Notifs, 3-Day Window, Forfeiture) with [Resolve] Workflows
     */
    function renderOfficerDashboard() {
        const assignedProgs = getOfficerAssignedPrograms();

        // 1. Update Assigned Programs Banner
        const assignedTextEl = document.getElementById('dashAssignedProgramsListText');
        if (assignedTextEl) assignedTextEl.textContent = assignedProgs.join(', ');

        // 2. Filter Application Pool to Assigned Programs Only
        const assignedApps = state.applications.filter(a => {
            const pCode = (a.programCode || a.program_code || (a.program && (a.program.code || a.program)) || '').toUpperCase();
            return assignedProgs.some(ap => pCode.includes(ap.toUpperCase()));
        });

        // 3. Compute 8 Lifecycle Status Metric Counts
        const totalApps = assignedApps.length;
        const pendingOfficer = assignedApps.filter(a => ['Pending', 'Pending Officer Review', 'Under Review', 'Incomplete', 'Pending Requirements'].includes(a.status || a.rawStatus)).length;
        const pendingAdmin = assignedApps.filter(a => ['Officer Approved', 'Forwarded to Admin', 'Pending Admin Review', 'Level 3 Review', 'Forwarded'].includes(a.status || a.rawStatus)).length;
        const unbatched = assignedApps.filter(a => (a.status === 'Approved' || a.status === 'Officer Approved' || a.rawStatus === 'Approved') && !a.batch_id && !a.batchId).length;
        
        // Batches awaiting schedule (formed batches without locked event date)
        const assignedBatches = (state.batches || []).filter(b => {
            const pCode = (b.program || b.program_code || '').toUpperCase();
            return assignedProgs.some(ap => pCode.includes(ap.toUpperCase()));
        });
        const batchedAwaitingSched = assignedBatches.filter(b => b.status === 'Active' || !b.eventDate || b.status === 'Awaiting Schedule').length;

        // In Progress (beneficiaries active in training/work)
        const inProgress = (state.beneficiaries || []).filter(b => {
            const p = (b.program || b.program_sector || '').toUpperCase();
            return assignedProgs.some(ap => p.includes(ap.toUpperCase())) && (b.status === 'Active' || b.training_status === 'In Progress');
        }).length;

        // Closed — Not Completed (expired 3-day window, absent, missed, cancelled)
        const closedNotCompleted = assignedApps.filter(a => ['Denied', 'Officer Denied', 'Expired', 'Cancelled', 'Closed', 'Missed'].includes(a.status || a.rawStatus)).length;

        // Program Completed (successfully completed training / disbursed)
        const programCompleted = assignedApps.filter(a => ['Completed', 'Disbursed', 'Released', 'Certified'].includes(a.status || a.rawStatus)).length;

        // Populate 8 Stat Card Counters
        const elTotal = document.getElementById('statDashTotalApps');
        const elPendingOff = document.getElementById('statDashPendingOfficer');
        const elPendingAdm = document.getElementById('statDashPendingAdmin');
        const elUnbatched = document.getElementById('statDashUnbatched');
        const elBatchedSched = document.getElementById('statDashBatchedAwaitingSched');
        const elInProg = document.getElementById('statDashInProgress');
        const elClosed = document.getElementById('statDashClosedNotCompleted');
        const elCompleted = document.getElementById('statDashProgramCompleted');

        if (elTotal) elTotal.textContent = totalApps;
        if (elPendingOff) elPendingOff.textContent = pendingOfficer;
        if (elPendingAdm) elPendingAdm.textContent = pendingAdmin;
        if (elUnbatched) elUnbatched.textContent = unbatched;
        if (elBatchedSched) elBatchedSched.textContent = batchedAwaitingSched;
        if (elInProg) elInProg.textContent = inProgress;
        if (elClosed) elClosed.textContent = closedNotCompleted;
        if (elCompleted) elCompleted.textContent = programCompleted;

        // Backward-compatibility references
        if (document.getElementById('statOfficerPendingApps')) document.getElementById('statOfficerPendingApps').textContent = pendingOfficer;
        if (document.getElementById('statOfficerUnbatchedBatches')) document.getElementById('statOfficerUnbatchedBatches').textContent = unbatched;
        if (document.getElementById('statOfficerScheduledEvents')) document.getElementById('statOfficerScheduledEvents').textContent = (state.schedules || []).length;
        if (document.getElementById('statOfficerNotifs')) document.getElementById('statOfficerNotifs').textContent = (state.notifications || []).length;

        // 4. Render Today's Activities Table
        renderDashboardTodayActivities(assignedProgs);

        // 5. Render Fund & Resource Balance per Assigned Program
        renderDashboardAssignedFunds(assignedProgs);

        // 6. Render 3 Action Items Queues (Failed Notifs, 3-Day Window, Forfeiture)
        renderDashboardActionItems(assignedApps);
    }

    /**
     * Render Today's Activities Table (Time, Slot Type, Program, Batch, Venue, [View Schedule])
     */
    /**
     * Render Today's Activities Table (Time, Slot Type, Program, Batch, Venue, [View Schedule])
     */
    function renderDashboardTodayActivities(assignedProgs = []) {
        const tbody = document.getElementById('dashTodayActivitiesTableBody');
        const badge = document.getElementById('dashTodayActivitiesCountBadge');
        if (!tbody) return;

        const todayStr = new Date().toISOString().substring(0, 10);
        let todaySchedules = (state.schedules || []).filter(s => {
            const sDate = s.interviewDate || s.slot_date || s.startDate || s.start_date || (s.created_at ? s.created_at.substring(0, 10) : todayStr);
            const pCode = (s.programCode || s.program_code || s.program || 'TUPAD').toUpperCase();
            const isAssigned = assignedProgs.length === 0 || assignedProgs.some(ap => pCode.includes(ap.toUpperCase()));
            return sDate === todayStr && isAssigned;
        });

        if (badge) badge.textContent = `${todaySchedules.length} Scheduled Today`;

        if (todaySchedules.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted"><i class="bi bi-calendar-check fs-4 d-block mb-1 text-muted"></i>No activities or slots scheduled for today.</td></tr>`;
            return;
        }

        tbody.innerHTML = todaySchedules.map(s => {
            const time = s.scheduleTime || s.timeSlot || '09:00 AM - 10:00 AM';
            const slotType = s.slot_type || s.category || s.title || 'Interview';
            const prog = s.programCode || s.program_code || s.program || 'TUPAD';
            const batch = s.batchName || s.batch_name || (s.batchId ? `Batch #${s.batchId}` : 'Individual Intake');
            const venue = s.venue || s.venue_location || s.location || 'PESO Office';

            let typeBadgeClass = 'bg-primary-subtle text-primary border border-primary-subtle';
            if (slotType.toLowerCase().includes('training')) typeBadgeClass = 'bg-info-subtle text-info border border-info-subtle';
            if (slotType.toLowerCase().includes('distribution') || slotType.toLowerCase().includes('grant') || slotType.toLowerCase().includes('payout')) typeBadgeClass = 'bg-success-subtle text-success border border-success-subtle';

            return `
                <tr>
                    <td class="font-monospace fw-semibold text-dark text-nowrap">
                        <i class="bi bi-clock text-primary me-1"></i>${escapeHtml(time)}
                    </td>
                    <td>
                        <span class="badge ${typeBadgeClass} fw-semibold">${escapeHtml(slotType)}</span>
                    </td>
                    <td>
                        <span class="badge bg-light text-dark border font-monospace fw-bold">${escapeHtml(prog)}</span>
                    </td>
                    <td>
                        <span class="fw-semibold text-dark text-truncate d-inline-block" style="max-width: 170px;" title="${escapeHtml(batch)}">
                            ${escapeHtml(batch)}
                        </span>
                    </td>
                    <td>
                        <small class="text-muted"><i class="bi bi-geo-alt me-1 text-danger"></i>${escapeHtml(venue)}</small>
                    </td>
                    <td class="text-end text-nowrap">
                        <button class="btn btn-xs btn-outline-primary rounded-pill px-3 py-1 fw-semibold d-inline-flex align-items-center gap-1 shadow-xs" onclick="PesoOfficerApp.navigateToScheduleDay('${todayStr}')" title="Open Schedule module for today">
                            <i class="bi bi-calendar3"></i> View Schedule
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Render Fund and Resource Balance per Assigned Program (Derived dynamically)
     */
    function renderDashboardAssignedFunds(assignedProgs = []) {
        const container = document.getElementById('dashAssignedFundCardsContainer');
        if (!container) return;

        const programConfigs = [
            { code: 'TUPAD', name: 'Emergency Employment Assistance', allocated: 3500000, slots_target: 700 },
            { code: 'SPES', name: 'Special Program for Employment of Students', allocated: 2000000, slots_target: 400 },
            { code: 'GIP', name: 'Government Internship Program', allocated: 1500000, slots_target: 150 },
            { code: 'CKGIP', name: 'Koronadal City Youth Internship', allocated: 1800000, slots_target: 180 },
            { code: 'PFAS', name: 'Pangkabuhayan Financial Assistance', allocated: 1500000, slots_target: 150 }
        ];

        const targetPrograms = programConfigs.filter(p => assignedProgs.some(ap => ap.toUpperCase() === p.code));

        container.innerHTML = targetPrograms.map(p => {
            const progApps = (state.applications || []).filter(a => (a.programCode || a.program || '').toUpperCase().includes(p.code));
            const progAssistance = (state.approvedAssistance || []).filter(a => (a.programCode || a.programName || '').toUpperCase().includes(p.code));
            
            const spent = progAssistance.reduce((sum, item) => sum + (Number(item.amount) || Number(item.quantityAmount) || 5000), 0);
            const slots_filled = progApps.filter(a => a.status === 'Approved' || a.status === 'Released' || a.status === 'Completed').length;
            const remaining = Math.max(0, p.allocated - spent);
            const utilPct = p.allocated > 0 ? Math.min(100, Math.round((spent / p.allocated) * 100)) : 0;
            const remainingSlots = Math.max(0, p.slots_target - slots_filled);

            return `
                <div class="col-12 col-md-6 col-xl-4">
                    <div class="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white d-flex flex-column justify-content-between">
                        <div>
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <div>
                                    <h5 class="fw-bold text-dark mb-0 font-monospace">${escapeHtml(p.code)}</h5>
                                    <small class="text-muted text-truncate d-inline-block" style="max-width: 190px;">${escapeHtml(p.name)}</small>
                                </div>
                                <span class="badge ${utilPct >= 80 ? 'bg-danger-subtle text-danger border-danger-subtle' : (utilPct >= 50 ? 'bg-primary-subtle text-primary border-primary-subtle' : 'bg-success-subtle text-success border-success-subtle')} border px-2.5 py-1 rounded-pill">
                                    ${utilPct}% Utilized
                                </span>
                            </div>

                            <div class="bg-light p-3 rounded-3 border mb-3">
                                <div class="d-flex justify-content-between small mb-1.5">
                                    <span class="text-muted">Allocated Budget:</span>
                                    <strong class="font-monospace text-dark">${formatCurrency(p.allocated)}</strong>
                                </div>
                                <div class="d-flex justify-content-between small mb-1.5">
                                    <span class="text-muted">Spent / Disbursed:</span>
                                    <strong class="font-monospace text-danger">${formatCurrency(spent)}</strong>
                                </div>
                                <div class="d-flex justify-content-between small border-top pt-1.5">
                                    <span class="text-muted fw-bold">Available Balance:</span>
                                    <strong class="font-monospace text-success fw-bold">${formatCurrency(remaining)}</strong>
                                </div>
                            </div>

                            <div class="d-flex justify-content-between align-items-center small mb-1">
                                <span class="text-muted">Disbursement Progress</span>
                                <span class="font-monospace fw-semibold text-primary">${utilPct}%</span>
                            </div>
                            <div class="progress mb-2" style="height: 6px; border-radius: 4px;">
                                <div class="progress-bar ${utilPct >= 80 ? 'bg-danger' : (utilPct >= 50 ? 'bg-primary' : 'bg-success')}" role="progressbar" style="width: ${utilPct}%"></div>
                            </div>
                        </div>

                        <div class="d-flex justify-content-between align-items-center pt-2 border-top text-muted small">
                            <span><i class="bi bi-people me-1"></i>Slots: <strong>${slots_filled}/${p.slots_target}</strong></span>
                            <span class="text-success"><i class="bi bi-check2-circle me-1"></i>${remainingSlots} open slots</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render Action Items Queue (Real data computed from deadlines and pending tasks)
     */
    function renderDashboardActionItems(assignedApps = []) {
        const container = document.getElementById('dashActionItemsList');
        const countBadge = document.getElementById('dashActionItemsCountBadge');
        if (!container) return;

        const actionItems = [];

        // 1. Applications with expiring resubmission deadlines
        assignedApps.filter(a => a.status === 'Incomplete' || a.resubmission_deadline).forEach((app, idx) => {
            actionItems.push({
                id: `ACT-DEADLINE-${app.id || idx}`,
                type: 'three_day_window',
                category: '3-Day Window Expiring',
                categoryBadge: 'bg-warning-subtle text-warning border-warning-subtle',
                title: `Incomplete Requirements (App #${app.id || app.application_number})`,
                beneficiaryName: app.beneficiaryName || 'Applicant',
                beneficiaryPhone: app.beneficiaryPhone || '09XX-***-XXXX',
                program: app.programCode || app.program || 'Assistance Program',
                detail: `Application flagged for deficient documents. Resubmission window is active.`,
                urgency: 'Action Required',
                btnText: 'Resolve',
                icon: 'bi-hourglass-bottom text-warning'
            });
        });

        // 2. Unclaimed approved grants
        (state.approvedAssistance || []).filter(a => a.status !== 'Released' && a.status !== 'Disbursed').forEach((ast, idx) => {
            actionItems.push({
                id: `ACT-FORFEIT-${ast.id || idx}`,
                type: 'assistance_forfeiture',
                category: 'Assistance Ready for Claim',
                categoryBadge: 'bg-info-subtle text-info border-info-subtle',
                title: `Approved Assistance Unclaimed: ${ast.programName || ast.programCode || 'Grant'}`,
                beneficiaryName: ast.beneficiaryName || 'Beneficiary',
                beneficiaryPhone: '09XX-***-XXXX',
                program: ast.programName || 'PESO Aid',
                detail: `Approved grant of ${formatCurrency(ast.amount || ast.quantityAmount || 5000)} awaiting QR disbursement.`,
                urgency: 'Ready for Release',
                btnText: 'Resolve',
                icon: 'bi-box-seam text-info'
            });
        });

        if (countBadge) countBadge.textContent = `${actionItems.length} Urgent Items`;

        if (actionItems.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 bg-white border rounded-3 p-4">
                    <i class="bi bi-check-circle-fill fs-2 text-success d-block mb-2"></i>
                    <h6 class="fw-bold text-dark mb-1">No Urgent Action Items</h6>
                    <small class="text-muted">All beneficiary requirements, schedule notifications, and assistance allocations are up to date.</small>
                </div>
            `;
            return;
        }

        container.innerHTML = actionItems.map(item => {
            const rawJson = JSON.stringify(item).replace(/"/g, '&quot;');
            return `
                <div class="p-3 border rounded-3 bg-white shadow-xs mb-3 d-flex flex-column justify-content-between">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div class="d-flex align-items-center gap-2">
                            <div class="p-2 rounded-circle bg-light d-flex align-items-center justify-content-center" style="width: 38px; height: 38px;">
                                <i class="bi ${item.icon} fs-5"></i>
                            </div>
                            <div>
                                <span class="badge ${item.categoryBadge} border mb-1">${escapeHtml(item.category)}</span>
                                <h6 class="fw-bold mb-0 text-dark" style="font-size: 0.9rem;">${escapeHtml(item.title)}</h6>
                            </div>
                        </div>
                        <span class="badge bg-light text-danger border font-monospace small">${escapeHtml(item.urgency)}</span>
                    </div>

                    <div class="text-secondary small mb-3 ps-1">
                        <div class="mb-1"><i class="bi bi-person-fill text-muted me-1"></i><strong>Beneficiary:</strong> ${escapeHtml(item.beneficiaryName)} <span class="text-muted font-monospace">(${maskPhone(item.beneficiaryPhone)})</span></div>
                        <div class="mb-1"><i class="bi bi-folder-fill text-muted me-1"></i><strong>Program:</strong> ${escapeHtml(item.program)}</div>
                        <div class="text-muted">${escapeHtml(item.detail)}</div>
                    </div>

                    <div class="d-flex justify-content-end gap-2 border-top pt-2">
                        <button class="btn btn-sm btn-primary rounded-pill px-3 fw-semibold d-inline-flex align-items-center gap-1.5 shadow-xs" onclick="PesoOfficerApp.openActionResolveModal('${item.type}', '${item.id}', ${rawJson})">
                            <i class="bi bi-lightning-charge-fill"></i> Resolve
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Open Action Resolution Modal for Failed Notifications, 3-Day Window, or Forfeiture
     */
    function openActionResolveModal(type, itemId, itemData = {}) {
        const modalEl = document.getElementById('officerActionResolveModal');
        if (!modalEl) return;

        const titleEl = document.getElementById('actionResolveModalTitle');
        const descEl = document.getElementById('actionResolveItemDescription');
        const benEl = document.getElementById('actionResolveBeneficiaryDisplay');
        const phoneEl = document.getElementById('actionResolvePhoneDisplay');
        const progEl = document.getElementById('actionResolveProgramDisplay');
        const typeInput = document.getElementById('actionResolveTypeInput');
        const idInput = document.getElementById('actionResolveIdInput');

        if (titleEl) titleEl.textContent = `Resolve Action Item: ${itemData.category || 'Operational Task'}`;
        if (descEl) descEl.textContent = itemData.detail || 'Follow up with beneficiary regarding this pending operational item.';
        if (benEl) benEl.textContent = itemData.beneficiaryName || 'Beneficiary';
        if (phoneEl) phoneEl.textContent = maskPhone(itemData.beneficiaryPhone);
        if (progEl) progEl.textContent = itemData.program || 'PESO Assistance';
        if (typeInput) typeInput.value = type;
        if (idInput) idInput.value = itemId;

        // Custom action dropdown options based on type
        const selectAction = document.getElementById('actionResolveActionSelect');
        if (selectAction) {
            if (type === 'failed_notification') {
                selectAction.innerHTML = `
                    <option value="called_informed">Successfully Called Beneficiary - Informed of Schedule Details</option>
                    <option value="resent_sms">Retried SMS Notification via Backup Gateway</option>
                    <option value="unreachable_marked">Beneficiary Unreachable - Marked for Barangay Notice</option>
                `;
            } else if (type === 'three_day_window') {
                selectAction.innerHTML = `
                    <option value="resubmission_received">Beneficiary Submitted Missing Documents - Forward for Review</option>
                    <option value="called_reminder">Called Beneficiary - Reminded of Imminent 72-Hour Deadline</option>
                    <option value="deadline_expired">No Submission Received - Close Application as Incomplete</option>
                `;
            } else {
                selectAction.innerHTML = `
                    <option value="reminder_sent">Sent Final Urgent Claim Reminder to Beneficiary</option>
                    <option value="claimed_disbursed">Beneficiary Arrived on Site - Proceed to QR Disbursement</option>
                    <option value="forfeited_reallocated">Forfeited Unclaimed Aid - Return Funds to Program Balance</option>
                `;
            }
        }

        safeOpenModal('officerActionResolveModal');
    }

    /**
     * Submit Action Resolution Form
     */
    function submitActionResolution(event) {
        if (event) event.preventDefault();

        const type = document.getElementById('actionResolveTypeInput')?.value;
        const itemId = document.getElementById('actionResolveIdInput')?.value;
        const actionChosen = document.getElementById('actionResolveActionSelect')?.value;
        const notes = document.getElementById('actionResolveNotes')?.value || 'Resolution logged by Officer.';

        logAudit('OFFICER_RESOLVE_ACTION_ITEM', `Resolved action item [${itemId}] (${type}) with action: "${actionChosen}". Notes: ${notes}`);

        safeCloseModal('officerActionResolveModal');

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Action Item Resolved',
                message: 'The operational item was resolved and recorded in the audit trail.',
                type: 'success'
            });
        } else {
            alert('Action item marked as resolved successfully and logged in official audit logs.');
        }

        renderOfficerDashboard();
    }

    /**
     * MODULE 2: Beneficiary Management (100% Design Specification Compliant)
     * Implements:
     * 1. Beneficiary list: Full Name, Beneficiary ID, Barangay, Contact Number (Masked), Account Status, Eligibility Status
     * 2. Buttons: [Search] / [Filter], [Register Walk-in], [View Record], [Edit], [Show QR Code], [Scan QR], [Activate] / [Deactivate]
     * 3. [Register Walk-in]: 18 fields, no OTP verification code, duplicate check on name+DOB, auto-computed age, generates permanent QR
     * 4. [Scan QR] or [View Record]: 8 display-only sections dossier
     * 5. [Edit]: Updates demographic & contact information with audit trail
     */

    function computeBeneficiaryEligibility(ben) {
        if (!ben) return { status: 'Ineligible', badge: 'bg-secondary', label: 'Ineligible' };
        if (ben.status === 'Deactivated' || ben.status === 'Inactive') {
            return { status: 'Inactive', badge: 'bg-secondary text-white', label: 'Account Deactivated' };
        }

        // Check applications pool. Beneficiaries have no numeric id column (qr_code IS
        // the primary key), so matching must go through qr_code only -- comparing a
        // beneficiary_id/ben.id that never exists made every application match every
        // beneficiary here (both sides always stringified to "undefined").
        const benQr = (ben.qr_code || '').toUpperCase();
        const activeApps = state.applications.filter(a => {
            const aBenQr = (a.beneficiary_qr || (a.beneficiary && a.beneficiary.qr_code) || '').toUpperCase();
            const match = !!benQr && aBenQr === benQr;
            const isActive = ['Approved', 'Officer Approved', 'In Progress', 'In Training', 'Scheduled', 'Forwarded to Admin'].includes(a.status || a.rawStatus);
            return match && isActive;
        });

        if (activeApps.length > 0) {
            const firstActive = activeApps[0];
            const pCode = firstActive.programCode || firstActive.program || 'Active PPA';
            return { status: 'Ongoing', badge: 'bg-primary-subtle text-primary border border-primary-subtle', label: `Ongoing: ${pCode}` };
        }

        // Check if recently completed / cooldown
        const completedApps = state.applications.filter(a => {
            const aBenQr = (a.beneficiary_qr || (a.beneficiary && a.beneficiary.qr_code) || '').toUpperCase();
            return (!!benQr && aBenQr === benQr) && (a.status === 'Completed' || a.status === 'Disbursed');
        });

        if (completedApps.length > 0 && ben.program === 'TUPAD') {
            return { status: 'Cooldown', badge: 'bg-warning-subtle text-warning border border-warning-subtle text-dark', label: 'Cooldown (TUPAD Cycle)' };
        }

        return { status: 'Eligible', badge: 'bg-success-subtle text-success border border-success-subtle', label: 'Eligible for Programs' };
    }

    function renderBeneficiariesTable() {
        const gridContainer = document.getElementById('beneficiaryGridContainer');
        const tbody = document.getElementById('beneficiaryTableBody') || document.getElementById('officerBeneficiaryTableBody');
        if (!gridContainer && !tbody) return;

        const query = (document.getElementById('benSearchInput')?.value || document.getElementById('searchBeneficiaryQuery')?.value || '').toLowerCase();
        const brgyFilter = (document.getElementById('benBarangayFilter')?.value || '').toLowerCase();
        const statusFilter = document.getElementById('benStatusFilter')?.value || '';
        const eligFilter = document.getElementById('benEligibilityFilter')?.value || '';

        const filtered = state.beneficiaries.filter(b => {
            const name = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
            const qr = (b.qr_code || `BEN-${b.id}`).toLowerCase();
            const brgy = (b.barangay || '').toLowerCase();
            const matchesQuery = !query || name.includes(query) || qr.includes(query) || brgy.includes(query);
            const matchesBrgy = !brgyFilter || brgy === brgyFilter;
            const matchesStatus = !statusFilter || b.status === statusFilter;

            const elig = computeBeneficiaryEligibility(b);
            const matchesElig = !eligFilter || elig.status === eligFilter || (eligFilter === 'Ongoing' && elig.status.includes('Ongoing'));

            return matchesQuery && matchesBrgy && matchesStatus && matchesElig;
        });

        const countFooter = document.getElementById('benTotalCountFooter');
        if (countFooter) {
            countFooter.textContent = `${filtered.length} Beneficiaries Found`;
        }

        if (gridContainer) {
            if (filtered.length === 0) {
                gridContainer.innerHTML = `
                    <div class="col-12">
                        <div class="card border-0 shadow-sm rounded-4 bg-white p-5 text-center">
                            <i class="bi bi-person-x fs-1 d-block mb-2 text-muted"></i>
                            <h6 class="fw-bold text-dark mb-1">No Beneficiary Records Found</h6>
                            <p class="text-muted small mb-3">No beneficiary records match the current search query or filter criteria.</p>
                            <div>
                                <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" onclick="resetBeneficiaryFilters()">
                                    <i class="bi bi-arrow-clockwise me-1"></i> Reset Filters
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                return;
            }

            gridContainer.innerHTML = filtered.map(b => {
                const fullName = `${b.first_name || ''} ${b.middle_name ? b.middle_name + ' ' : ''}${b.last_name || ''} ${b.suffix || ''}`.trim() || b.name || 'Beneficiary';
                const benId = b.qr_code || `BEN-${b.id}`;
                const brgy = b.barangay || 'Koronadal';
                const maskedPhone = maskPhone(b.phone || b.contact || b.contact_number);
                const isAcctActive = (b.status || 'Active') === 'Active';
                const elig = computeBeneficiaryEligibility(b);

                return `
                    <div class="col-12 col-md-6 col-xl-4">
                        <div class="card border-0 shadow-sm rounded-4 bg-white h-100 d-flex flex-column justify-content-between p-3.5 beneficiary-card-item transition-all">
                            <!-- Card Header: Identity & Status -->
                            <div>
                                <div class="d-flex justify-content-between align-items-start mb-2.5">
                                    <div class="d-flex align-items-center gap-2.5">
                                        <div class="rounded-circle bg-primary-subtle text-primary fw-bold d-flex align-items-center justify-content-center flex-shrink-0" style="width: 42px; height: 42px; font-size: 1.1rem;">
                                            <i class="bi bi-person-fill"></i>
                                        </div>
                                        <div>
                                            <h6 class="fw-bold text-dark mb-0 text-truncate" style="max-width: 170px;" title="${escapeHtml(fullName)}">${escapeHtml(fullName)}</h6>
                                            <span class="text-muted font-monospace" style="font-size: 0.75rem;">@${escapeHtml(b.username || 'walkin_user')}</span>
                                        </div>
                                    </div>
                                    <span class="badge ${isAcctActive ? 'bg-success' : 'bg-secondary'} rounded-pill px-2.5 py-1">
                                        <i class="bi ${isAcctActive ? 'bi-check-circle-fill' : 'bi-slash-circle'} me-1"></i>${isAcctActive ? 'Active' : 'Deactivated'}
                                    </span>
                                </div>

                                <!-- Meta Chips -->
                                <div class="d-flex flex-wrap align-items-center gap-1.5 mb-3">
                                    <span class="badge bg-light text-primary border font-monospace fw-bold px-2 py-1" style="font-size: 0.75rem;">
                                        <i class="bi bi-qr-code me-1"></i>${escapeHtml(benId)}
                                    </span>
                                    <span class="badge ${elig.badge} font-monospace px-2 py-1" style="font-size: 0.72rem;">
                                        ${escapeHtml(elig.label)}
                                    </span>
                                </div>

                                <!-- Key Attributes Container -->
                                <div class="p-2.5 rounded-3 bg-light mb-3 text-secondary small border">
                                    <div class="d-flex align-items-center justify-content-between mb-1.5">
                                        <span class="text-muted"><i class="bi bi-geo-alt-fill text-danger me-1"></i>Barangay:</span>
                                        <span class="fw-semibold text-dark text-truncate ms-2" style="max-width: 150px;">${escapeHtml(brgy)}</span>
                                    </div>
                                    <div class="d-flex align-items-center justify-content-between mb-1.5">
                                        <span class="text-muted"><i class="bi bi-telephone-fill text-primary me-1"></i>Contact:</span>
                                        <span class="font-monospace fw-semibold text-dark">${maskedPhone}</span>
                                    </div>
                                    <div class="d-flex align-items-center justify-content-between">
                                        <span class="text-muted"><i class="bi bi-envelope-fill text-secondary me-1"></i>Email:</span>
                                        <span class="text-truncate text-dark ms-2" style="max-width: 150px;" title="${escapeHtml(b.email || 'N/A')}">${escapeHtml(b.email || 'N/A')}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Card Action Buttons -->
                            <div class="border-top pt-2.5 mt-auto">
                                <div class="row g-1.5">
                                    <div class="col-6">
                                        <button class="btn btn-sm btn-outline-primary rounded-pill w-100 fw-semibold d-inline-flex align-items-center justify-content-center gap-1 shadow-xs" onclick="PesoOfficerApp.openBeneficiaryRecordModal('${b.qr_code || b.id}')" title="View beneficiary record" aria-label="View record for ${escapeHtml(fullName)}">
                                            <i class="bi bi-eye"></i> View
                                        </button>
                                    </div>
                                    <div class="col-6">
                                        <button class="btn btn-sm btn-outline-secondary rounded-pill w-100 fw-semibold d-inline-flex align-items-center justify-content-center gap-1 shadow-xs" onclick="PesoOfficerApp.openEditBeneficiaryModal('${b.qr_code || b.id}')" title="Edit beneficiary details" aria-label="Edit details for ${escapeHtml(fullName)}">
                                            <i class="bi bi-pencil"></i> Edit
                                        </button>
                                    </div>
                                    <div class="col-6">
                                        <button class="btn btn-sm btn-outline-dark rounded-pill w-100 fw-semibold d-inline-flex align-items-center justify-content-center gap-1 shadow-xs" onclick="PesoOfficerApp.showBeneficiaryQR('${b.qr_code || b.id}')" title="Display beneficiary QR" aria-label="Show QR code for ${escapeHtml(fullName)}">
                                            <i class="bi bi-qr-code"></i> QR Pass
                                        </button>
                                    </div>
                                    <div class="col-6">
                                        <button class="btn btn-sm ${isAcctActive ? 'btn-outline-danger' : 'btn-outline-success'} rounded-pill w-100 fw-semibold d-inline-flex align-items-center justify-content-center gap-1 shadow-xs" onclick="PesoOfficerApp.toggleBeneficiaryStatus('${b.qr_code || b.id}')" title="${isAcctActive ? 'Deactivate Account' : 'Activate Account'}" aria-label="${isAcctActive ? 'Deactivate' : 'Activate'} account for ${escapeHtml(fullName)}">
                                            <i class="bi ${isAcctActive ? 'bi-person-dash' : 'bi-person-check'}"></i> ${isAcctActive ? 'Deactivate' : 'Activate'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            return;
        }

        if (tbody) {
            tbody.innerHTML = filtered.map(b => {
                const fullName = `${b.first_name || ''} ${b.middle_name ? b.middle_name + ' ' : ''}${b.last_name || ''} ${b.suffix || ''}`.trim() || b.name || 'Beneficiary';
                const benId = b.qr_code || `BEN-${b.id}`;
                const brgy = b.barangay || 'Koronadal';
                const maskedPhone = maskPhone(b.phone || b.contact || b.contact_number);
                const isAcctActive = (b.status || 'Active') === 'Active';
                const elig = computeBeneficiaryEligibility(b);

                return `
                    <tr>
                        <td>
                            <strong class="text-dark d-block">${escapeHtml(fullName)}</strong>
                            <small class="text-muted font-monospace">${escapeHtml(b.username || 'walkin_user')}</small>
                        </td>
                        <td>
                            <span class="badge bg-light text-primary border font-monospace fw-bold">${escapeHtml(benId)}</span>
                        </td>
                        <td>
                            <small class="text-secondary"><i class="bi bi-geo-alt me-1 text-danger"></i>${escapeHtml(brgy)}</small>
                        </td>
                        <td>
                            <span class="font-monospace text-dark d-block small">${maskedPhone}</span>
                            ${b.email && b.email !== 'N/A' ? `<small class="text-muted">${escapeHtml(b.email)}</small>` : '<small class="text-muted fst-italic">No email provided</small>'}
                        </td>
                        <td class="text-center">
                            <span class="badge ${isAcctActive ? 'bg-success' : 'bg-secondary'}">${isAcctActive ? 'Active' : 'Deactivated'}</span>
                        </td>
                        <td class="text-center">
                            <span class="badge ${elig.badge} font-monospace">${escapeHtml(elig.label)}</span>
                        </td>
                        <td class="text-end text-nowrap">
                            <button class="btn btn-xs btn-outline-primary rounded-pill px-2.5 py-1 fw-semibold me-1 shadow-xs" onclick="PesoOfficerApp.openBeneficiaryRecordModal('${b.qr_code || b.id}')">View Record</button>
                            <button class="btn btn-xs btn-outline-secondary rounded-pill px-2.5 py-1 fw-semibold me-1 shadow-xs" onclick="PesoOfficerApp.openEditBeneficiaryModal('${b.qr_code || b.id}')">Edit</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    /**
     * Auto-compute Age from Birthdate for Walk-in Form
     */
    function calcWalkInAge() {
        const dobInput = document.getElementById('walkInDob');
        const ageInput = document.getElementById('walkInAge');
        if (!dobInput || !ageInput || !dobInput.value) return;

        try {
            const birthDate = new Date(dobInput.value);
            if (!isNaN(birthDate.getTime())) {
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                ageInput.value = Math.max(0, age);
            }
        } catch (e) {
            ageInput.value = '';
        }
    }

    /**
     * Open [Register Walk-in] Modal (No OTP Verification)
     */
    function openWalkInRegistrationModal() {
        const form = document.getElementById('addBeneficiaryForm');
        if (form) form.reset();

        const errBox = document.getElementById('walkInFormErrorNotice');
        if (errBox) errBox.classList.add('d-none');

        const ageInput = document.getElementById('walkInAge');
        if (ageInput) ageInput.value = '';

        const regByInput = document.getElementById('walkInRegisteredBy');
        const user = JSON.parse(localStorage.getItem('currentUser') || '{"fullName":"PESO Officer","username":"peso-officer","id":2}');
        if (regByInput) regByInput.value = (user && user.fullName) || 'PESO Officer';

        const cityInput = document.getElementById('walkInCity');
        if (cityInput) cityInput.value = 'Koronadal City';

        safeOpenModal('addBeneficiaryModal');
    }

    /**
     * Check Unique Username for Walk-in Registration
     */
    function checkUsernameUniqueness() {
        const uInput = document.getElementById('walkInUsername');
        if (!uInput) return true;
        const val = uInput.value.trim().toLowerCase();
        const exists = state.beneficiaries.some(b => (b.username || '').toLowerCase() === val);
        if (exists) {
            uInput.classList.add('is-invalid');
            return false;
        }
        uInput.classList.remove('is-invalid');
        return true;
    }

    /**
     * Submit Walk-in Beneficiary Registration (Direct Save & QR Generation - No OTP Code Required)
     */
    async function submitWalkInRegistration(event) {
        if (event) event.preventDefault();

        const fn = (document.getElementById('walkInFirstName')?.value || '').trim();
        const mn = (document.getElementById('walkInMiddleName')?.value || '').trim();
        const ln = (document.getElementById('walkInLastName')?.value || '').trim();
        const suffix = document.getElementById('walkInSuffix')?.value || '';
        const sex = document.getElementById('walkInSex')?.value || '';
        const dob = document.getElementById('walkInDob')?.value || '';
        const age = Number(document.getElementById('walkInAge')?.value) || 25;
        const civil = document.getElementById('walkInCivilStatus')?.value || 'Single';
        const phone = (document.getElementById('walkInPhone')?.value || '').trim();
        const email = (document.getElementById('walkInEmail')?.value || '').trim();
        const purok = (document.getElementById('walkInPurok')?.value || '').trim();
        const brgy = document.getElementById('walkInBarangay')?.value || '';
        const city = document.getElementById('walkInCity')?.value || 'Koronadal City';
        const idType = document.getElementById('walkInIdType')?.value || 'PhilSys ID (National ID)';
        const idNumber = (document.getElementById('walkInIdNumber')?.value || '').trim();
        const username = (document.getElementById('walkInUsername')?.value || '').trim();
        const tempPass = (document.getElementById('walkInTempPassword')?.value || '').trim();
        const officerName = document.getElementById('walkInRegisteredBy')?.value || 'PESO Officer';

        const errBox = document.getElementById('walkInFormErrorNotice');
        if (errBox) errBox.classList.add('d-none');

        // 1. Validation: Letters only for names
        const letterRegex = /^[A-Za-z\s\.\-]+$/;
        if (!letterRegex.test(fn) || !letterRegex.test(ln)) {
            if (errBox) {
                errBox.textContent = 'Validation Error: First Name and Last Name must contain letters only.';
                errBox.classList.remove('d-none');
            }
            return;
        }

        // 2. Validation: 11-digit phone starting with 09
        const phoneRegex = /^09\d{9}$/;
        if (!phoneRegex.test(phone)) {
            if (errBox) {
                errBox.textContent = 'Validation Error: Contact Number must be exactly 11 digits starting with 09 (e.g. 09171234567).';
                errBox.classList.remove('d-none');
            }
            return;
        }

        // 3. Validation: Duplicate Account Checking (First Name + Last Name + Date of Birth)
        const isDuplicate = state.beneficiaries.some(b => {
            const sameFn = (b.first_name || '').trim().toLowerCase() === fn.toLowerCase();
            const sameLn = (b.last_name || '').trim().toLowerCase() === ln.toLowerCase();
            const sameDob = (b.date_of_birth || '').substring(0, 10) === dob;
            return sameFn && sameLn && sameDob;
        });

        if (isDuplicate) {
            if (errBox) {
                errBox.textContent = `Duplicate Account Detected: A beneficiary named "${fn} ${ln}" with birthdate ${dob} is already registered.`;
                errBox.classList.remove('d-none');
            }
            return;
        }

        // 4. Validation: Unique Username
        if (!checkUsernameUniqueness()) {
            if (errBox) {
                errBox.textContent = `Validation Error: The username "${username}" is already taken. Please choose a different username.`;
                errBox.classList.remove('d-none');
            }
            return;
        }

        const btnSave = document.getElementById('btnSaveWalkInBen');
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Generating QR Pass...';
        }

        // Generate Permanent QR ID
        const generatedQr = `QR-BEN-${Math.floor(100000 + Math.random() * 900000)}`;
        const newBen = {
            id: Date.now(),
            dbId: Date.now(),
            qr_code: generatedQr,
            first_name: fn,
            middle_name: mn,
            last_name: ln,
            suffix: suffix,
            name: `${fn} ${mn ? mn + ' ' : ''}${ln} ${suffix}`.trim(),
            full_name: `${fn} ${mn ? mn + ' ' : ''}${ln} ${suffix}`.trim(),
            sex: sex,
            date_of_birth: dob,
            age: age,
            civil_status: civil,
            marital_status: civil,
            phone: phone,
            contact: phone,
            contact_number: phone,
            email: email || 'N/A',
            purok: purok,
            barangay: brgy,
            address: `${purok}, ${brgy}, ${city}`,
            id_type: idType,
            id_number: idNumber,
            username: username,
            registered_by: officerName,
            status: 'Active',
            program: 'Unassigned (Walk-in Intake)',
            created_at: new Date().toISOString()
        };

        state.beneficiaries.unshift(newBen);

        // Sync with Supabase
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('beneficiaries').insert([{
                    qr_code: newBen.qr_code,
                    first_name: newBen.first_name,
                    middle_name: newBen.middle_name,
                    last_name: newBen.last_name,
                    suffix: newBen.suffix,
                    sex: newBen.sex,
                    date_of_birth: newBen.date_of_birth,
                    age: newBen.age,
                    civil_status: newBen.civil_status,
                    phone: newBen.phone,
                    email: newBen.email,
                    address: newBen.address,
                    barangay: newBen.barangay,
                    id_type: newBen.id_type,
                    id_number: newBen.id_number,
                    username: newBen.username,
                    status: 'Active'
                }]);
            } catch (supErr) {
                console.warn('[PesoOfficerApp] Walk-in Supabase sync notice:', supErr.message);
            }
        }

        renderBeneficiariesTable();
        logAudit('OFFICER_REGISTER_WALKIN_BENEFICIARY', `Registered walk-in beneficiary ${newBen.name} (${newBen.qr_code}) without OTP by ${officerName}`);

        if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = '<i class="bi bi-qr-code-scan"></i> Save and Generate QR';
        }

        safeCloseModal('addBeneficiaryModal');

        // Show the generated permanent QR pass
        showBeneficiaryQR(newBen);

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Walk-in Registration Complete',
                message: `Beneficiary ${newBen.name} registered. Permanent QR Pass generated: ${generatedQr}`,
                type: 'success'
            });
        }
    }

    /**
     * MODULE 2.3: [Scan QR] or [View Record] Dossier Modal (8 Display-Only Design Sections)
     */
    function openBeneficiaryRecordModal(id) {
        const ben = state.beneficiaries.find(b => String(b.id) === String(id) || b.qr_code === id);
        if (!ben) {
            alert(`Beneficiary record not found for query ID: ${id}`);
            return;
        }

        state.currentViewedBenId = ben.qr_code || ben.id;

        // 1. Personal Information & Contact Details
        const fullName = `${ben.first_name || ''} ${ben.middle_name ? ben.middle_name + ' ' : ''}${ben.last_name || ''} ${ben.suffix || ''}`.trim() || ben.name || 'Beneficiary';
        const dobAgeStr = `${ben.date_of_birth || 'N/A'} (${ben.age || 25} yrs old)`;
        const sexCivilStr = `${ben.sex || 'N/A'} • ${ben.civil_status || ben.marital_status || 'Single'}`;
        const maskedPhone = maskPhone(ben.phone || ben.contact || ben.contact_number);
        const fullAddress = ben.address || `${ben.purok ? ben.purok + ', ' : ''}${ben.barangay || 'Koronadal'}, City of Koronadal`;
        const idRef = `${ben.id_type || 'PhilSys ID'}: ${ben.id_number || '1234-****-9876'}`;
        const elig = computeBeneficiaryEligibility(ben);

        const elName = document.getElementById('recDossierFullName');
        const elUser = document.getElementById('recDossierUsername');
        const elId = document.getElementById('recDossierId');
        const elAcct = document.getElementById('recDossierAccountStatus');
        const elElig = document.getElementById('recDossierEligibilityBadge');
        const elDob = document.getElementById('recDossierDobAge');
        const elSexCivil = document.getElementById('recDossierSexCivil');
        const elPhone = document.getElementById('recDossierPhone');
        const elEmail = document.getElementById('recDossierEmail');
        const elAddress = document.getElementById('recDossierAddress');
        const elIdRef = document.getElementById('recDossierIdRef');

        if (elName) elName.textContent = fullName;
        if (elUser) elUser.textContent = ben.username || 'walkin_user';
        if (elId) elId.textContent = ben.qr_code || `BEN-${ben.id}`;
        if (elAcct) {
            elAcct.textContent = ben.status || 'Active';
            elAcct.className = `badge ${(ben.status || 'Active') === 'Active' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-secondary text-white'} px-3 py-1.5`;
        }
        if (elElig) {
            elElig.textContent = elig.label;
            elElig.className = `badge ${elig.badge} px-3 py-1.5 font-monospace`;
        }
        if (elDob) elDob.textContent = dobAgeStr;
        if (elSexCivil) elSexCivil.textContent = sexCivilStr;
        if (elPhone) elPhone.textContent = maskedPhone;
        if (elEmail) elEmail.textContent = ben.email && ben.email !== 'N/A' ? ben.email : 'None provided';
        if (elAddress) elAddress.textContent = fullAddress;
        if (elIdRef) elIdRef.textContent = idRef;

        // 3. Programs Applied For (Past & Present). qr_code is the beneficiary's real
        // primary key -- match on that only (ben.id/a.beneficiary_id never exist, and
        // comparing them was silently pulling every beneficiary's applications in here).
        const benQr = (ben.qr_code || '').toUpperCase();
        const apps = state.applications.filter(a => {
            const aBenQr = (a.beneficiary_qr || (a.beneficiary && a.beneficiary.qr_code) || '').toUpperCase();
            return !!benQr && aBenQr === benQr;
        });

        const appsContainer = document.getElementById('recDossierAppsContainer');
        const appsCount = document.getElementById('recDossierAppsCount');
        if (appsCount) appsCount.textContent = `${apps.length} Application${apps.length === 1 ? '' : 's'}`;

        if (appsContainer) {
            if (apps.length === 0) {
                appsContainer.innerHTML = `<div class="text-center py-4 text-muted small"><i class="bi bi-inbox me-1"></i>No applications filed yet.</div>`;
            } else {
                appsContainer.innerHTML = apps.map(a => `
                    <div class="p-2.5 border-bottom d-flex justify-content-between align-items-center">
                        <div>
                            <strong class="text-dark small d-block">${escapeHtml(a.programCode || a.program || 'Assistance Program')}</strong>
                            <small class="text-muted font-monospace">App #${escapeHtml(String(a.application_number || a.id))} • ${escapeHtml(a.date_applied || a.dateSubmitted || 'Recent')}</small>
                        </div>
                        <span class="badge ${a.status === 'Approved' ? 'bg-success-subtle text-success border border-success-subtle' : (a.status === 'Denied' ? 'bg-danger-subtle text-danger border border-danger-subtle' : 'bg-warning-subtle text-warning border border-warning-subtle text-dark')} small">
                            ${escapeHtml(a.status || 'Pending')}
                        </span>
                    </div>
                `).join('');
            }
        }

        // 4. Submitted Documents & Their Status
        const docsContainer = document.getElementById('recDossierDocsContainer');
        if (docsContainer) {
            const benDocs = Array.isArray(ben.documents_json) && ben.documents_json.length > 0 
                ? ben.documents_json 
                : [
                    { name: ben.id_type || 'Valid Government ID', type: 'valid_id', status: ben.id_type ? 'Verified' : 'Pending' },
                    { name: `Barangay Clearance (${ben.barangay || 'Koronadal'})`, type: 'clearance', status: ben.barangay ? 'Verified' : 'Pending' },
                    { name: 'PESO Intake & Demographic Record', type: 'intake', status: 'Complete' }
                ];

            docsContainer.innerHTML = `
                <div class="d-flex flex-column gap-2">
                    ${benDocs.map(d => `
                        <div class="d-flex justify-content-between align-items-center p-2 bg-light rounded-2 border">
                            <span class="small"><i class="bi bi-file-earmark-check text-primary me-1.5"></i>${escapeHtml(d.name || d.document_name || 'Document')}</span>
                            <span class="badge ${d.status === 'Verified' || d.status === 'Complete' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-warning-subtle text-warning border border-warning-subtle'} font-monospace">
                                <i class="bi ${d.status === 'Verified' || d.status === 'Complete' ? 'bi-check-circle-fill' : 'bi-hourglass-split'} me-1"></i>${escapeHtml(d.status || 'Verified')}
                            </span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // 5. Current Stage, Batch & Schedule
        const stageContainer = document.getElementById('recDossierStageContainer');
        const stageBadge = document.getElementById('recDossierStageBadge');
        const assignedBatch = (state.batches || []).find(b => {
            const pCode = (b.program || b.program_code || '').toUpperCase();
            return (ben.program || '').toUpperCase().includes(pCode);
        });

        if (stageContainer) {
            stageContainer.innerHTML = `
                <div class="mb-1.5"><strong>Current Workflow Stage:</strong> <span class="badge bg-primary-subtle text-primary border border-primary-subtle">${assignedBatch ? 'Cohort Batched' : (apps.length > 0 ? 'Application Evaluation' : 'Intake Completed')}</span></div>
                <div class="mb-1.5"><strong>Assigned Batch:</strong> <span class="text-dark">${assignedBatch ? `${assignedBatch.batch_name || assignedBatch.name} (${assignedBatch.batch_code || assignedBatch.id})` : 'Unassigned / Independent Intake'}</span></div>
                <div><strong>Schedule Slot:</strong> <span class="text-muted"><i class="bi bi-calendar-check text-primary me-1"></i>${assignedBatch && assignedBatch.eventDate ? `${assignedBatch.eventDate} @ ${assignedBatch.venue || 'PESO Hall'}` : 'Awaiting Next Operational Schedule'}</span></div>
            `;
        }
        if (stageBadge) {
            stageBadge.textContent = assignedBatch ? 'Batched' : (apps.length > 0 ? 'Under Review' : 'Verified');
        }

        // 6. Training Attendance & Completion Status
        const trainingContainer = document.getElementById('recDossierTrainingContainer');
        const trainingBadge = document.getElementById('recDossierTrainingBadge');
        const totalSess = ben.total_sessions || 5;
        const attendedSess = ben.sessions_attended !== undefined ? ben.sessions_attended : (ben.training_status === 'Completed' ? totalSess : 0);
        const trainPct = totalSess > 0 ? Math.min(100, Math.round((attendedSess / totalSess) * 100)) : 0;
        const isTrainDone = ben.training_status === 'Completed' || trainPct >= 100;

        if (trainingContainer) {
            trainingContainer.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="text-muted">Attendance Progress:</span>
                    <strong class="${isTrainDone ? 'text-success' : 'text-primary'} font-monospace">${attendedSess} of ${totalSess} Sessions (${trainPct}%)</strong>
                </div>
                <div class="progress mb-2" style="height: 6px;">
                    <div class="progress-bar ${isTrainDone ? 'bg-success' : 'bg-warning'}" style="width: ${trainPct}%;"></div>
                </div>
                <div class="small text-muted">
                    <i class="bi ${isTrainDone ? 'bi-award text-warning' : 'bi-hourglass-split text-secondary'} me-1"></i>
                    Official Certificate: <strong>${isTrainDone ? 'Issued & Recorded (Auto-Pull Eligible)' : (attendedSess > 0 ? 'In Progress' : 'Not Started')}</strong>
                </div>
            `;
        }
        if (trainingBadge) {
            trainingBadge.className = `badge ${isTrainDone ? 'bg-success-subtle text-success border border-success-subtle' : (attendedSess > 0 ? 'bg-warning-subtle text-warning border border-warning-subtle' : 'bg-secondary-subtle text-secondary border border-secondary-subtle')} small`;
            trainingBadge.textContent = isTrainDone ? `Completed (${attendedSess}/${totalSess})` : (attendedSess > 0 ? `In Progress (${attendedSess}/${totalSess})` : 'Not Started');
        }

        // 7. Assistance Received, with Dates and Amounts (Prevents duplicate benefits)
        const assistanceTbody = document.getElementById('recDossierAssistanceTableBody');
        const assistanceCount = document.getElementById('recDossierAssistanceCount');
        const assistanceRecords = state.approvedAssistance.filter(a => {
            const aBenQr = String(a.beneficiary_id || a.beneficiaryId || a.beneficiaryQr || a.beneficiary_qr || '').toUpperCase();
            return !!benQr && aBenQr === benQr;
        });

        if (assistanceCount) assistanceCount.textContent = `${assistanceRecords.length} Disbursed Grant${assistanceRecords.length === 1 ? '' : 's'}`;

        if (assistanceTbody) {
            if (assistanceRecords.length === 0) {
                assistanceTbody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted">No past assistance disbursements recorded. Eligible for new assistance allocation.</td></tr>`;
            } else {
                assistanceTbody.innerHTML = assistanceRecords.map(r => `
                    <tr>
                        <td><small class="font-monospace text-muted">${escapeHtml(r.approvalDate || r.created_at ? (r.approvalDate || r.created_at).substring(0, 10) : 'Recent')}</small></td>
                        <td><strong class="text-dark">${escapeHtml(r.programName || r.programCode || 'Assistance')}</strong> <span class="badge bg-light text-dark border ms-1">${escapeHtml(r.assistanceType || 'Grant')}</span></td>
                        <td><small class="font-monospace text-muted">REF-${escapeHtml(String(r.id || '2026-01'))}</small></td>
                        <td><small class="text-secondary">${escapeHtml(r.officerName || 'PESO Officer')}</small></td>
                        <td class="text-end fw-bold font-monospace text-success">${escapeHtml(String(r.quantityAmount || '₱4,350.00'))}</td>
                    </tr>
                `).join('');
            }
        }

        logAudit('OFFICER_VIEW_BENEFICIARY_RECORD', `Viewed complete record dossier for ${fullName} (${ben.qr_code || ben.id})`);
        safeOpenModal('beneficiaryRecordModal');
    }

    /**
     * MODULE 2.4: Update Beneficiary Information Modal (Enhanced Design)
     */
    function calcEditBenAge() {
        const dobInput = document.getElementById('editBenDob');
        const agePreview = document.getElementById('editBenAgePreview');
        if (!dobInput || !dobInput.value) return;

        const dob = new Date(dobInput.value);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        if (agePreview) {
            agePreview.value = Math.max(0, isNaN(age) ? 0 : age);
        }
    }

    function resetEditBeneficiaryForm() {
        if (state.currentEditingBen) {
            openEditBeneficiaryModal(state.currentEditingBen.id || state.currentEditingBen.qr_code);
        }
    }

    function openEditBeneficiaryModal(id) {
        const ben = state.beneficiaries.find(b => String(b.id) === String(id) || b.qr_code === id);
        if (!ben) return;

        state.currentEditingBen = { ...ben };

        const fullName = `${ben.first_name || ''} ${ben.middle_name ? ben.middle_name + ' ' : ''}${ben.last_name || ''} ${ben.suffix || ''}`.trim() || ben.name || 'Beneficiary';
        const isAcctActive = (ben.status || 'Active') === 'Active';

        // Header Status Badge
        const elHeaderStatus = document.getElementById('editBenHeaderStatusBadge');
        if (elHeaderStatus) {
            if (isAcctActive) {
                elHeaderStatus.className = 'badge bg-success-subtle text-success border border-success-subtle px-3 py-1.5 rounded-pill font-monospace';
                elHeaderStatus.innerHTML = '<i class="bi bi-circle-fill text-success me-1" style="font-size: 6px;"></i> Active';
            } else {
                elHeaderStatus.className = 'badge bg-secondary-subtle text-secondary border border-secondary-subtle px-3 py-1.5 rounded-pill font-monospace';
                elHeaderStatus.innerHTML = '<i class="bi bi-circle-fill text-secondary me-1" style="font-size: 6px;"></i> Deactivated';
            }
        }

        // Top Quick Reference Strip
        const elIdInput = document.getElementById('editBenIdInput');
        const elIdPrev = document.getElementById('editBenIdPreview');
        const elUserPrev = document.getElementById('editBenUsernamePreview');
        const elRegPrev = document.getElementById('editBenRegisteredByPreview');

        if (elIdInput) elIdInput.value = ben.qr_code || ben.id;
        if (elIdPrev) elIdPrev.textContent = ben.qr_code || `BEN-${ben.id}`;
        if (elUserPrev) elUserPrev.textContent = ben.username || `user_${ben.id}`;
        if (elRegPrev) elRegPrev.textContent = ben.registered_by || 'PESO Officer';

        // 1. Personal Profile Panel
        const elFirstName = document.getElementById('editBenFirstName');
        const elMiddleName = document.getElementById('editBenMiddleName');
        const elLastName = document.getElementById('editBenLastName');
        const elSuffix = document.getElementById('editBenSuffix');
        const elCivil = document.getElementById('editBenCivilStatus');
        const elDob = document.getElementById('editBenDob');
        const elAge = document.getElementById('editBenAgePreview');

        if (elFirstName) elFirstName.value = ben.first_name || (ben.name ? ben.name.split(' ')[0] : '');
        if (elMiddleName) elMiddleName.value = ben.middle_name || '';
        if (elLastName) elLastName.value = ben.last_name || (ben.name ? ben.name.split(' ').slice(1).join(' ') : '');
        if (elSuffix) elSuffix.value = ben.suffix || '';
        if (elCivil) elCivil.value = ben.civil_status || ben.marital_status || 'Single';

        // Sex Radio Buttons
        const sexVal = (ben.sex || 'Male').toLowerCase();
        const radMale = document.getElementById('editSexMale');
        const radFemale = document.getElementById('editSexFemale');
        if (sexVal === 'female') {
            if (radFemale) radFemale.checked = true;
        } else {
            if (radMale) radMale.checked = true;
        }

        // Date of Birth & Age
        if (elDob) {
            let parsedDob = ben.date_of_birth;
            if (!parsedDob || parsedDob === 'N/A') parsedDob = '1998-05-15';
            elDob.value = parsedDob;
        }
        calcEditBenAge();

        // 2. Contact & Address Panel
        const elPhone = document.getElementById('editBenPhone');
        const elEmail = document.getElementById('editBenEmail');
        const elPurok = document.getElementById('editBenPurok');
        const elBrgy = document.getElementById('editBenBarangay');
        const elIdType = document.getElementById('editBenIdType');
        const elIdNum = document.getElementById('editBenIdNumber');

        if (elPhone) elPhone.value = ben.phone || ben.contact || ben.contact_number || '';
        if (elEmail) elEmail.value = ben.email && ben.email !== 'N/A' ? ben.email : '';
        if (elPurok) elPurok.value = ben.purok || (ben.address ? ben.address.split(',')[0].trim() : 'Purok 1');
        if (elBrgy) elBrgy.value = ben.barangay || 'Morales';
        if (elIdType) elIdType.value = ben.id_type || 'PhilSys ID (National ID)';
        if (elIdNum) elIdNum.value = ben.id_number || '1234-5678-9012';

        // Optional Documents in Accordion
        const elDocId = document.getElementById('editDocNameId');
        const elDocBrgy = document.getElementById('editDocNameBrgy');
        if (elDocId) elDocId.textContent = `${ben.id_type || 'Valid National ID'} (Attached)`;
        if (elDocBrgy) elDocBrgy.textContent = `Barangay Certificate (${ben.barangay || 'Koronadal'})`;

        // Initialize tooltips for required fields
        if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('#editBeneficiaryModal [data-bs-toggle="tooltip"]'));
            tooltipTriggerList.forEach(tooltipTriggerEl => {
                new bootstrap.Tooltip(tooltipTriggerEl);
            });
        }

        safeOpenModal('editBeneficiaryModal');
    }

    async function submitEditBeneficiary(event) {
        if (event) event.preventDefault();

        const targetId = document.getElementById('editBenIdInput')?.value;
        const ben = state.beneficiaries.find(b => String(b.id) === String(targetId) || b.qr_code === targetId);
        if (!ben) return;

        const firstName = (document.getElementById('editBenFirstName')?.value || '').trim();
        const middleName = (document.getElementById('editBenMiddleName')?.value || '').trim();
        const lastName = (document.getElementById('editBenLastName')?.value || '').trim();
        const suffix = (document.getElementById('editBenSuffix')?.value || '').trim();
        const sex = document.getElementById('editSexFemale')?.checked ? 'Female' : 'Male';
        const dob = document.getElementById('editBenDob')?.value || '1998-05-15';
        const age = parseInt(document.getElementById('editBenAgePreview')?.value || '25', 10);
        const civil = document.getElementById('editBenCivilStatus')?.value || 'Single';

        const phone = (document.getElementById('editBenPhone')?.value || '').trim();
        const email = (document.getElementById('editBenEmail')?.value || '').trim();
        const purok = (document.getElementById('editBenPurok')?.value || '').trim();
        const brgy = document.getElementById('editBenBarangay')?.value || 'Morales';
        const idType = document.getElementById('editBenIdType')?.value || 'PhilSys ID (National ID)';
        const idNum = (document.getElementById('editBenIdNumber')?.value || '').trim();

        // Validate 11-digit phone
        if (!/^09\d{9}$/.test(phone)) {
            alert('Validation Error: Contact number must be 11 digits starting with 09.');
            return;
        }

        ben.first_name = firstName || ben.first_name;
        ben.middle_name = middleName;
        ben.last_name = lastName || ben.last_name;
        ben.suffix = suffix;
        ben.name = `${ben.first_name} ${ben.middle_name ? ben.middle_name + ' ' : ''}${ben.last_name} ${ben.suffix}`.trim();
        ben.sex = sex;
        ben.gender = sex;
        ben.date_of_birth = dob;
        ben.dob = dob;
        ben.age = age;
        ben.civil_status = civil;
        ben.marital_status = civil;
        ben.phone = phone;
        ben.contact = phone;
        ben.contact_number = phone;
        ben.email = email || 'N/A';
        ben.purok = purok;
        ben.barangay = brgy;
        ben.address = `${purok}, ${brgy}, Koronadal City`;
        ben.id_type = idType;
        ben.id_number = idNum;

        // Sync with Supabase
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('beneficiaries').update({
                    first_name: ben.first_name,
                    middle_name: ben.middle_name,
                    last_name: ben.last_name,
                    suffix: ben.suffix,
                    sex: ben.sex,
                    date_of_birth: ben.date_of_birth,
                    age: ben.age,
                    phone: ben.phone,
                    email: ben.email,
                    civil_status: ben.civil_status,
                    address: ben.address,
                    barangay: ben.barangay,
                    id_type: ben.id_type,
                    id_number: ben.id_number
                }).eq('qr_code', ben.qr_code || ben.id);
            } catch (supErr) {
                console.warn('[PesoOfficerApp] Edit Supabase sync notice:', supErr.message);
            }
        }

        renderBeneficiariesTable();
        logAudit('OFFICER_EDIT_BENEFICIARY', `Updated demographic profile and contact details for ${ben.name} (${ben.qr_code || ben.id})`);
        safeCloseModal('editBeneficiaryModal');

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Record Updated',
                message: `Beneficiary details for ${ben.name} saved successfully.`,
                type: 'success'
            });
        }
    }

    /**
     * MODULE 2.5: [Activate] / [Deactivate] Account Status
     */
    async function toggleBeneficiaryStatus(id) {
        const ben = state.beneficiaries.find(b => String(b.id) === String(id) || b.qr_code === id);
        if (!ben) return;

        const newStatus = ben.status === 'Active' ? 'Deactivated' : 'Active';
        if (!confirm(`Confirm account status modification:\n\nBeneficiary: ${ben.first_name} ${ben.last_name} (${ben.qr_code || ben.id})\nNew Status: ${newStatus}\n\nNotice: This action will be logged in the permanent audit trail with your Officer credentials.`)) {
            return;
        }

        ben.status = newStatus;

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('beneficiaries').update({ status: newStatus }).eq('qr_code', ben.qr_code || ben.id);
            } catch (e) {
                console.warn('[PesoOfficerApp] Supabase status update note:', e.message);
            }
        }

        renderBeneficiariesTable();
        logAudit('OFFICER_TOGGLE_BENEFICIARY_STATUS', `Set status of beneficiary ${ben.first_name} ${ben.last_name} (${ben.qr_code || ben.id}) to ${newStatus}`);

        if (typeof OTPAuth !== 'undefined' && OTPAuth.broadcastRealtimeEvent) {
            OTPAuth.broadcastRealtimeEvent('BENEFICIARY_STATUS_CHANGED', { qr_code: ben.qr_code, status: newStatus });
        }

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Account Status Updated',
                message: `${ben.first_name} ${ben.last_name} is now marked as ${newStatus}.`,
                type: newStatus === 'Active' ? 'success' : 'warning'
            });
        }
    }

    /**
     * MODULE 3: Application Evaluation (Completeness Checks, Level 3 Forwarding, 3-Day Denial Window)
     */
    function renderOfficerEvaluationTable() {
        const tbody = document.getElementById('officerApplicationsTableBody') || document.getElementById('officerEvalTableBody') || document.getElementById('livelihoodTableBody');
        if (!tbody) return;

        if (state.applications.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No applications pending completeness evaluation.</td></tr>`;
            return;
        }

        tbody.innerHTML = state.applications.map(app => {
            const isComplete = app.is_complete !== false;
            const resubmissionDeadline = app.resubmission_deadline ? new Date(app.resubmission_deadline).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

            return `
                <tr>
                    <td class="fw-bold font-monospace text-primary">#${escapeHtml(String(app.application_number || app.id))}</td>
                    <td class="fw-semibold text-dark">${escapeHtml(app.beneficiaryName || app.applicant_name)}</td>
                    <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace">${escapeHtml(app.programCode || app.program)}</span></td>
                    <td><small class="text-muted font-monospace">${escapeHtml(app.date_applied || app.dateSubmitted)}</small></td>
                    <td>
                        <span class="badge ${isComplete ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger-subtle text-danger border border-danger-subtle'}">
                            <i class="bi ${isComplete ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-1"></i>
                            ${isComplete ? 'Complete (3/3 Docs)' : 'Incomplete'}
                        </span>
                        ${resubmissionDeadline ? `<small class="text-danger d-block font-monospace mt-1">Resubmit by: ${resubmissionDeadline}</small>` : ''}
                    </td>
                    <td>
                        <span class="badge ${app.status === 'Approved' || app.status === 'Forwarded to Admin' ? 'bg-success' : (app.status === 'Incomplete' || app.status === 'Denied' ? 'bg-danger' : 'bg-warning text-dark')}">
                            ${escapeHtml(app.status)}
                        </span>
                    </td>
                    <td class="text-end text-nowrap">
                        <button class="btn btn-sm btn-success py-1 px-2.5 me-1 fw-semibold" onclick="PesoOfficerApp.handleApproveCompleteness('${app.id}')" title="Forward to PESO Admin for Level 3 Evaluation">
                            <i class="bi bi-send-check me-1"></i>Approve Completeness
                        </button>
                        <button class="btn btn-sm btn-outline-danger py-1 px-2.5 fw-semibold" onclick="PesoOfficerApp.openOfficerDenyIncompleteModal('${app.id}')" title="Deny for missing requirements & set 3-day window">
                            <i class="bi bi-x-circle me-1"></i>Deny Incomplete
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function handleApproveCompleteness(appId) {
        const app = state.applications.find(a => String(a.id) === String(appId));
        if (!app) return;

        if (!confirm(`Approve completeness for Application #${appId} (${app.beneficiaryName})?\n\nThis will mark documents as complete and forward the application to the PESO Administrator for Level 3 Evaluation.`)) {
            return;
        }

        app.status = 'Forwarded to Admin';
        app.is_complete = true;
        app.forwarded_at = new Date().toISOString();

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('applications').update({
                    status: 'Forwarded to Admin',
                    completeness_status: 'Complete',
                    forwarded_at: new Date().toISOString()
                }).eq('id', app.id);
            } catch (e) {}
        }

        renderOfficerEvaluationTable();
        logAudit('OFFICER_APPROVE_COMPLETENESS', `Approved completeness for Application #${appId} and forwarded to PESO Admin.`);

        if (typeof OTPAuth !== 'undefined' && OTPAuth.broadcastRealtimeEvent) {
            OTPAuth.broadcastRealtimeEvent('APPLICATION_FORWARDED_TO_ADMIN', { applicationId: appId, program: app.programCode });
        }

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Completeness Verified',
                message: `Application #${appId} forwarded to PESO Admin for final approval.`,
                type: 'success'
            });
        }
    }

    function openOfficerDenyIncompleteModal(appId) {
        const app = state.applications.find(a => String(a.id) === String(appId));
        if (!app) return;

        state.selectedEvalAppId = appId;
        const inputAppId = document.getElementById('denyAppIdInput');
        if (inputAppId) inputAppId.value = appId;

        // Calculate 3-day resubmission deadline (72 hours from now)
        const deadlineDate = new Date(Date.now() + (3 * 24 * 60 * 60 * 1000));
        const badge = document.getElementById('denyResubmissionDeadlineBadge');
        if (badge) {
            badge.textContent = deadlineDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }

        safeOpenModal('officerDenyIncompleteModal');
    }

    async function submitOfficerDenyIncomplete() {
        const appId = document.getElementById('denyAppIdInput')?.value || state.selectedEvalAppId;
        const reasonSelect = document.getElementById('denyReasonSelect')?.value;
        const customReason = (document.getElementById('denyCustomReasonInput')?.value || '').trim();

        const finalReason = reasonSelect === 'OTHER' ? customReason : reasonSelect;

        if (!finalReason) {
            alert('Validation Error: You must select or specify a reason for document denial.');
            return;
        }

        const app = state.applications.find(a => String(a.id) === String(appId));
        if (!app) return;

        const deadlineIso = new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)).toISOString();
        app.status = 'Incomplete';
        app.is_complete = false;
        app.denial_reason = finalReason;
        app.resubmission_deadline = deadlineIso;

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('applications').update({
                    status: 'Incomplete',
                    remarks: `Incomplete Documents: ${finalReason}`,
                    resubmission_deadline: deadlineIso
                }).eq('id', app.id);
            } catch (e) {}
        }

        safeCloseModal('officerDenyIncompleteModal');
        renderOfficerEvaluationTable();
        logAudit('OFFICER_DENY_INCOMPLETE', `Denied application #${appId} due to: ${finalReason}. Enforced 3-day resubmission deadline: ${deadlineIso}`);

        // Broadcast to beneficiary portal with 3-day window
        if (typeof OTPAuth !== 'undefined' && OTPAuth.broadcastRealtimeEvent) {
            OTPAuth.broadcastRealtimeEvent('APPLICATION_INCOMPLETE_NOTICE', {
                applicationId: appId,
                reason: finalReason,
                deadline: deadlineIso
            });
        }

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Denial Advisory Sent',
                message: `Beneficiary notified of deficiency (${finalReason}) with 3-day resubmission deadline.`,
                type: 'warning'
            });
        }
    }

    /**
     * MODULE 4: Beneficiary Batches (Form Approved Batches, Lock once Scheduled)
     */
    function renderBeneficiaryBatchesModule() {
        const approvedCandidates = state.applications.filter(a => a.status === 'Approved' || a.status === 'Officer Approved');
        
        // Update batch counts per program
        const programs = ['SPES', 'TUPAD', 'Starter Kit', 'Micro-Enterprise', 'PFAS', 'CKGIP'];
        programs.forEach(prog => {
            const count = approvedCandidates.filter(a => (a.programCode === prog || a.program === prog) && !a.batch_id).length;
            const badge = document.getElementById(`badgeOpUnbatched-${prog.replace(/\s+/g, '')}`);
            if (badge) badge.textContent = `${count} approved, unbatched`;
        });

        if (typeof renderPostApprovalBatchesModule === 'function') {
            renderPostApprovalBatchesModule();
        }
    }

    function lockBatch(batchId) {
        const batch = state.batches.find(b => String(b.id) === String(batchId));
        if (!batch) return;

        if (!confirm(`Lock batch "${batch.name}"?\n\nOnce locked, batch members and parameters cannot be edited. Any subsequent changes will require forming a new batch.`)) {
            return;
        }

        batch.is_locked = true;
        batch.status = 'Scheduled / Locked';

        logAudit('OFFICER_LOCK_BATCH', `Locked operational batch #${batchId} (${batch.name})`);
        renderBeneficiaryBatchesModule();

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Batch Locked',
                message: `Batch "${batch.name}" is now locked and protected against modifications.`,
                type: 'info'
            });
        }
    }

    /**
     * MODULE 5: Schedule Management & Assignment to Admin Slots
     */
    function renderOfficerScheduleModule() {
        if (typeof renderDailySchedules === 'function') {
            renderDailySchedules();
        } else {
            renderDailySchedulesTable();
        }
    }

    /**
     * MODULE 6: Training Attendance Tracking (Per Beneficiary, Auto-pull for Admin Certs)
     */
    function renderTrainingAttendanceTable() {
        const tbody = document.getElementById('trainingAttendanceTableBody');
        if (!tbody) return;

        const query = (document.getElementById('trainingSearchInput')?.value || '').toLowerCase();
        const progFilter = document.getElementById('trainingProgramFilter')?.value || '';
        const statusFilter = document.getElementById('trainingStatusFilter')?.value || '';

        // Derive training records from actual beneficiaries & active training slots
        let records = (state.beneficiaries || []).map((b, idx) => {
            const benApps = (state.applications || []).filter(a => String(a.beneficiary_id || a.beneficiary_qr) === String(b.id || b.qr_code));
            const activeApp = benApps[0] || {};
            const totalSess = b.total_sessions || 5;
            const attended = b.sessions_attended !== undefined ? b.sessions_attended : (b.training_status === 'Completed' ? totalSess : 0);
            const isDone = b.training_status === 'Completed' || attended >= totalSess;

            return {
                id: b.id || b.qr_code || idx + 1,
                qr_code: b.qr_code || `QR-BEN-${b.id}`,
                name: `${b.first_name || ''} ${b.last_name || ''}`.trim() || b.name || 'Beneficiary',
                program: b.program || activeApp.programCode || activeApp.program || 'General Livelihood',
                batch: b.batch_name || activeApp.batchName || 'General Cohort',
                trainingTitle: `${b.program || activeApp.programCode || 'Skills'} Livelihood & Safety Training`,
                sessionsAttended: attended,
                totalSessions: totalSess,
                status: isDone ? 'Completed' : (attended > 0 ? 'In Progress' : 'Not Started')
            };
        });

        if (query) records = records.filter(r => r.name.toLowerCase().includes(query) || r.qr_code.toLowerCase().includes(query));
        if (progFilter) records = records.filter(r => r.program === progFilter);
        if (statusFilter) records = records.filter(r => r.status === statusFilter);

        // Update stats
        const enrolled = records.length;
        const inProg = records.filter(r => r.status === 'In Progress').length;
        const completed = records.filter(r => r.status === 'Completed').length;
        if (document.getElementById('statTrainingEnrolled')) document.getElementById('statTrainingEnrolled').textContent = enrolled;
        if (document.getElementById('statTrainingInProgress')) document.getElementById('statTrainingInProgress').textContent = inProg;
        if (document.getElementById('statTrainingCompleted')) document.getElementById('statTrainingCompleted').textContent = completed;
        if (document.getElementById('statTrainingCertEligible')) document.getElementById('statTrainingCertEligible').textContent = completed;

        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted"><i class="bi bi-person-x fs-3 d-block mb-1 text-muted"></i>No training attendance records found.</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map(r => {
            const pct = r.totalSessions > 0 ? Math.min(100, Math.round((r.sessionsAttended / r.totalSessions) * 100)) : 0;
            const isCompleted = r.status === 'Completed';

            return `
                <tr>
                    <td>
                        <span class="badge bg-light text-dark border font-monospace d-block mb-1">${escapeHtml(r.qr_code)}</span>
                        <span class="fw-bold text-dark">${escapeHtml(r.name)}</span>
                    </td>
                    <td>
                        <span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace">${escapeHtml(r.program)}</span>
                        <small class="text-muted d-block">${escapeHtml(r.batch)}</small>
                    </td>
                    <td><small class="text-dark fw-semibold">${escapeHtml(r.trainingTitle)}</small></td>
                    <td><span class="font-monospace fw-bold">${r.sessionsAttended} / ${r.totalSessions} Days</span></td>
                    <td>
                        <div class="d-flex align-items-center gap-2">
                            <div class="progress flex-grow-1" style="height: 6px;">
                                <div class="progress-bar ${isCompleted ? 'bg-success' : 'bg-warning'}" style="width: ${pct}%"></div>
                            </div>
                            <small class="font-monospace fw-bold">${pct}%</small>
                        </div>
                    </td>
                    <td>
                        <span class="badge ${isCompleted ? 'bg-success' : (r.status === 'In Progress' ? 'bg-warning text-dark' : 'bg-secondary')}">${escapeHtml(r.status)}</span>
                    </td>
                    <td>
                        <span class="badge ${isCompleted ? 'bg-info-subtle text-info border border-info-subtle' : 'bg-secondary-subtle text-secondary'}">
                            <i class="bi ${isCompleted ? 'bi-award-fill' : 'bi-hourglass'} me-1"></i>
                            ${isCompleted ? 'Auto-Pull Eligible' : 'Incomplete'}
                        </span>
                    </td>
                    <td class="text-end text-nowrap">
                        <button class="btn btn-sm btn-outline-primary py-1 px-2" onclick="PesoOfficerApp.openTrainingAttendanceModal('${r.id}', '${escapeHtml(r.name)}')">
                            <i class="bi bi-pencil-square me-1"></i>Update
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function openTrainingAttendanceModal(benId, name) {
        const inputId = document.getElementById('trainingBenIdInput');
        const displayName = document.getElementById('trainingModalBenName');
        if (inputId) inputId.value = benId;
        if (displayName) displayName.textContent = name;

        const ben = state.beneficiaries.find(b => String(b.id) === String(benId) || b.qr_code === benId);
        if (ben) {
            const attendedInput = document.getElementById('trainingSessionsAttendedInput');
            const statusSelect = document.getElementById('trainingStatusSelect');
            if (attendedInput) attendedInput.value = ben.sessions_attended !== undefined ? ben.sessions_attended : (ben.training_status === 'Completed' ? 5 : 0);
            if (statusSelect) statusSelect.value = ben.training_status || 'In Progress';
        }

        safeOpenModal('officerTrainingAttendanceModal');
    }

    async function saveIndividualTrainingAttendance() {
        const benId = document.getElementById('trainingBenIdInput')?.value;
        const attended = parseInt(document.getElementById('trainingSessionsAttendedInput')?.value || '5', 10);
        const status = document.getElementById('trainingStatusSelect')?.value || 'Completed';

        const ben = state.beneficiaries.find(b => String(b.id) === String(benId) || b.qr_code === benId);
        if (ben) {
            ben.sessions_attended = attended;
            ben.training_status = status;
        }

        // Live Supabase update
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('beneficiaries').update({
                    sessions_attended: attended,
                    training_status: status,
                    updated_at: new Date().toISOString()
                }).eq('qr_code', ben ? (ben.qr_code || ben.id) : benId);
            } catch (e) {
                console.warn('[Training Attendance] Supabase update note:', e.message);
            }
        }

        logAudit('OFFICER_UPDATE_TRAINING_ATTENDANCE', `Updated training attendance for beneficiary #${benId} (${attended} sessions, Status: ${status})`);
        
        if (typeof OTPAuth !== 'undefined' && OTPAuth.broadcastRealtimeEvent) {
            OTPAuth.broadcastRealtimeEvent('TRAINING_ATTENDANCE_UPDATED', {
                beneficiary_id: benId,
                sessions_attended: attended,
                status: status
            });
        }

        safeCloseModal('officerTrainingAttendanceModal');
        renderTrainingAttendanceTable();

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Attendance Saved',
                message: `Training attendance recorded. Beneficiary is ${status === 'Completed' ? 'eligible for certificate auto-pull' : 'marked in progress'}.`,
                type: 'success'
            });
        }
    }

    /**
     * MODULE 7: Fund & Resource Tracking (Dual Verification)
     */
    function renderApprovedAssistanceTable() {
        const tbody = document.getElementById('assistanceRecordsTableBody') || document.getElementById('officerApprovedAssistanceTableBody');
        if (!tbody) return;

        const query = (document.getElementById('astSearchInput')?.value || '').toLowerCase();
        const progFilter = document.getElementById('astProgramFilter')?.value || '';
        const typeFilter = document.getElementById('astTypeFilter')?.value || '';

        let records = state.approvedAssistance || state.assistanceRecords || [];
        if (records.length === 0) {
            // Check approved applications
            records = (state.applications || []).filter(a => a.status === 'Approved' || a.status === 'Officer Approved' || a.status === 'Disbursed' || a.status === 'Released').map(a => ({
                id: a.id || a.application_number,
                beneficiaryName: a.beneficiaryName || 'Beneficiary',
                programCode: a.programCode || a.program || 'PESO',
                item: a.remarks || 'Approved Grant Assistance',
                amount: a.amount_approved || a.amount_requested || 5000,
                approvalDate: a.date_applied || a.dateSubmitted || (a.created_at ? a.created_at.substring(0, 10) : 'Recent'),
                dualVerified: a.status === 'Released' || a.status === 'Disbursed'
            }));
        }

        if (query) records = records.filter(r => (r.beneficiaryName || '').toLowerCase().includes(query) || (r.programName || r.programCode || '').toLowerCase().includes(query));
        if (progFilter) records = records.filter(r => (r.programCode === progFilter || r.programName === progFilter));

        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-1 text-muted"></i>No approved assistance records found.</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map(r => `
            <tr>
                <td class="font-monospace fw-bold text-primary">#AST-${escapeHtml(String(r.id || '01'))}</td>
                <td class="fw-semibold text-dark">${escapeHtml(r.beneficiaryName || 'Beneficiary')}</td>
                <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace">${escapeHtml(r.programCode || r.programName || 'PESO')}</span></td>
                <td>
                    <span class="fw-bold text-dark d-block">${escapeHtml(r.assistanceType || r.item || 'Livelihood Assistance Grant')}</span>
                    <small class="text-success font-monospace fw-bold">${formatCurrency(r.amount || r.quantityAmount || 5000)}</small>
                </td>
                <td><small class="text-muted font-monospace">${escapeHtml(r.approvalDate || 'Recent')}</small></td>
                <td>
                    <span class="badge ${r.dualVerified ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-warning-subtle text-warning border border-warning-subtle'}">
                        <i class="bi ${r.dualVerified ? 'bi-shield-fill-check' : 'bi-hourglass-split'} me-1"></i>
                        ${r.dualVerified ? 'Dual-Confirmed (Voucher Signed)' : 'Pending Beneficiary Sign-off'}
                    </span>
                </td>
                <td><span class="badge bg-light text-dark border">${escapeHtml(r.officerName || 'PESO Officer')}</span></td>
            </tr>
        `).join('');
    }

    /**
     * MODULE 8: Disbursement (QR Scan Mandatory & Auto-Inventory Deduction)
     */
    function renderDisbursementLedgerTable() {
        const tbody = document.getElementById('disbursementLogsTableBody');
        if (!tbody) return;

        const liveDisbursements = (state.approvedAssistance || []).filter(a => a.status === 'Released' || a.status === 'Disbursed' || a.release_date || a.disbursed_at);

        if (liveDisbursements.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted"><i class="bi bi-qr-code-scan fs-3 d-block mb-1 text-muted"></i>No disbursement releases logged yet. Scan a beneficiary QR pass to execute live disbursement.</td></tr>`;
            return;
        }

        tbody.innerHTML = liveDisbursements.map(l => `
            <tr>
                <td class="font-monospace fw-bold text-success">${escapeHtml(l.reference_number || `REL-${l.id}`)}</td>
                <td>
                    <span class="badge bg-light text-dark font-monospace border d-block mb-1">${escapeHtml(l.beneficiary_qr || l.beneficiaryQr || 'QR-BEN')}</span>
                    <span class="fw-semibold text-dark">${escapeHtml(l.beneficiaryName || 'Beneficiary')}</span>
                </td>
                <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace">${escapeHtml(l.programCode || l.program || 'PESO')}</span></td>
                <td class="fw-bold text-dark">${escapeHtml(l.assistance_type || l.item || 'Assistance Package')}</td>
                <td><small class="text-muted font-monospace">${escapeHtml(l.release_date || (l.created_at ? l.created_at.substring(0, 16) : 'Recent'))}</small></td>
                <td><span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-qr-code-scan me-1"></i>QR Verified</span></td>
                <td><small class="text-secondary">${escapeHtml(l.officerName || 'PESO Officer')}</small></td>
            </tr>
        `).join('');
    }

    function handleQrDisbursementScan(qrCode) {
        const cleanQr = String(qrCode || '').trim();
        const ben = state.beneficiaries.find(b => b.qr_code === cleanQr || String(b.id) === cleanQr);
        const app = (state.applications || []).find(a => (a.beneficiary_qr === cleanQr || String(a.beneficiary_id) === cleanQr) && (a.status === 'Approved' || a.status === 'Officer Approved' || a.status === 'Completed'));

        const nameEl = document.getElementById('disburseBenName');
        const qrEl = document.getElementById('disburseBenQrCode');
        const progEl = document.getElementById('disburseProgramName');
        const itemEl = document.getElementById('disburseItemName');
        const amountEl = document.getElementById('disburseAmount');

        const fullName = ben ? `${ben.first_name || ''} ${ben.last_name || ''}`.trim() : (app ? app.beneficiaryName : 'Beneficiary');
        const progName = (app && (app.programCode || app.program)) || (ben && ben.program) || 'Livelihood Assistance';
        // Real amount_approved (falling back to amount_requested) from the actual
        // application -- this used to fall back to a flat 5000 whenever the field
        // wasn't present on the reshaped application object, which was always,
        // since that object never carried amount_approved/amount_requested at all.
        const resolvedAmount = app ? Number(app.amount_approved || app.amount_requested || 0) : 0;
        const amountKnown = resolvedAmount > 0;

        state.pendingDisbursement = {
            qr: cleanQr,
            name: fullName,
            prog: progName,
            item: `${progName} Grant Release / Starter Kit`,
            amount: amountKnown ? resolvedAmount : null,
            applicationId: app ? (app.dbId || app.id || null) : null,
            programCode: (app && app.programCode) || null
        };

        if (nameEl) nameEl.textContent = fullName;
        if (qrEl) qrEl.textContent = cleanQr;
        if (progEl) progEl.textContent = progName;
        if (itemEl) itemEl.textContent = `${progName} Grant Release / Starter Kit`;
        if (amountEl) amountEl.textContent = amountKnown ? formatCurrency(resolvedAmount) : 'Not yet set -- contact Admin';

        safeOpenModal('officerQrDisbursementModal');
    }

    async function confirmDisbursementRelease() {
        const ctx = state.pendingDisbursement;
        const name = ctx?.name || document.getElementById('disburseBenName')?.textContent || 'Beneficiary';
        const qr = ctx?.qr || document.getElementById('disburseBenQrCode')?.textContent || 'QR-BEN-XXXXXX';
        const item = ctx?.item || document.getElementById('disburseItemName')?.textContent || 'Package';
        const prog = ctx?.prog || document.getElementById('disburseProgramName')?.textContent || 'PESO Program';

        if (!ctx || !ctx.amount) {
            const msg = `Cannot release: no approved amount is on record for ${name} (${qr}). Contact the Administrator to confirm the approved amount before releasing.`;
            if (typeof window.showSystemNotification === 'function') {
                window.showSystemNotification({ title: 'Release Blocked', message: msg, type: 'error', duration: 8000 });
            } else {
                alert(msg);
            }
            return;
        }
        const releaseAmount = ctx.amount;

        // approved_assistance.program_id and officer_id are both NOT NULL -- the insert
        // below used to omit them entirely (and hardcode quantity_amount:5000), so it
        // always failed against that constraint and was silently swallowed by the
        // catch block, meaning disbursements never actually saved to this table at all
        // while the UI still reported success.
        const officerProfileDisb = typeof AuthGuard !== 'undefined' ? AuthGuard.getProfile() : null;
        const officerIdDisb = officerProfileDisb?.id || (parseInt(sessionStorage.getItem('userId')) || null);
        let resolvedProgramIdDisb = null;
        try {
            if (typeof DataService !== 'undefined' && DataService.programs && ctx.programCode) {
                const progLookupRes = await DataService.programs.getAll({ agency: 'PESO' });
                const progMatch = (progLookupRes && Array.isArray(progLookupRes.data))
                    ? progLookupRes.data.find(p => (p.code || '').toUpperCase() === String(ctx.programCode).toUpperCase())
                    : null;
                if (progMatch) resolvedProgramIdDisb = progMatch.id;
            }
        } catch (progErr) {
            console.warn('[Disbursement] Program lookup note:', progErr);
        }

        if (!resolvedProgramIdDisb || !officerIdDisb) {
            const missing = [!resolvedProgramIdDisb ? `program "${ctx.programCode || prog}"` : null, !officerIdDisb ? 'officer session' : null].filter(Boolean).join(' and ');
            const msg = `Cannot release: could not resolve the real ${missing}. Please re-scan or log in again.`;
            if (typeof window.showSystemNotification === 'function') {
                window.showSystemNotification({ title: 'Release Blocked', message: msg, type: 'error', duration: 8000 });
            } else {
                alert(msg);
            }
            return;
        }

        const newRecord = {
            id: Date.now(),
            reference_number: `REL-${Date.now().toString().slice(-6)}`,
            beneficiary_qr: qr,
            beneficiaryName: name,
            programCode: prog,
            assistance_type: item,
            release_date: new Date().toISOString(),
            status: 'Released',
            officerName: 'PESO Officer'
        };

        state.approvedAssistance.unshift(newRecord);

        // Supabase Live Update
        let releaseSaveFailed = false;
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                const insRes = await supabaseClient.from('approved_assistance').insert([{
                    beneficiary_qr: qr,
                    program_id: resolvedProgramIdDisb,
                    assistance_type: item,
                    approval_date: new Date().toISOString(),
                    quantity_amount: releaseAmount,
                    officer_id: officerIdDisb,
                    status: 'Released'
                }]);
                if (insRes && insRes.error) {
                    releaseSaveFailed = true;
                    console.warn('[Disbursement] Supabase insert error:', insRes.error.message);
                }
                await supabaseClient.from('applications').update({
                    status: 'Released',
                    updated_at: new Date().toISOString()
                }).eq('beneficiary_qr', qr);
            } catch (e) {
                releaseSaveFailed = true;
                console.warn('[Disbursement] Supabase sync note:', e.message);
            }
        }

        if (releaseSaveFailed) {
            state.approvedAssistance.shift();
            const msg = `Release for ${name} (${qr}) was NOT saved to the database. Please retry.`;
            if (typeof window.showSystemNotification === 'function') {
                window.showSystemNotification({ title: 'Release Failed', message: msg, type: 'error', duration: 8000 });
            } else {
                alert(msg);
            }
            return;
        }

        state.pendingDisbursement = null;
        logAudit('OFFICER_CONFIRM_DISBURSEMENT', `Executed on-site QR release of ${item} (${formatCurrency(releaseAmount)}) to ${name} (${qr}) with dual voucher sign-off.`);
        safeCloseModal('officerQrDisbursementModal');
        renderDisbursementLedgerTable();

        // Broadcast to Beneficiary Portal
        if (typeof OTPAuth !== 'undefined' && OTPAuth.broadcastRealtimeEvent) {
            OTPAuth.broadcastRealtimeEvent('DISBURSEMENT_RECORDED', { qr_code: qr, item: item, time: new Date().toISOString() });
        }

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Disbursement Released',
                message: `Successfully released ${item} to ${name}. Inventory auto-deducted in real time.`,
                type: 'success'
            });
        }
    }

    /**
     * MODULE 9: Notification Hub & Broadcast Dispatcher
     */
    function renderOfficerNotificationsFeed() {
        const container = document.getElementById('officerNotificationsList');
        if (!container) return;

        const notifs = state.notifications || [];

        if (notifs.length === 0) {
            container.innerHTML = `
                <div class="p-4 text-center text-muted bg-light rounded-3 border">
                    <i class="bi bi-bell-slash fs-3 d-block mb-1 text-muted"></i>
                    <span class="small">No active alerts or incoming broadcast notices.</span>
                </div>
            `;
            return;
        }

        container.innerHTML = notifs.map(n => {
            const isAdm = (n.sender || '').toUpperCase().includes('ADMIN') || n.type === 'ADMIN';
            const timeStr = n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (n.time || 'Recent');

            return `
                <div class="p-3 border rounded-3 bg-light d-flex align-items-start gap-3 mb-2">
                    <div class="p-2 rounded-circle ${isAdm ? 'bg-primary-subtle text-primary' : 'bg-success-subtle text-success'}">
                        <i class="bi ${isAdm ? 'bi-shield-lock-fill' : 'bi-person-check-fill'} fs-5"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <h6 class="fw-bold mb-0 text-dark" style="font-size: 0.9rem;">${escapeHtml(n.title || 'System Advisory')}</h6>
                            <small class="text-muted font-monospace">${escapeHtml(timeStr)}</small>
                        </div>
                        <p class="small text-muted mb-0">${escapeHtml(n.message || n.body || '')}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    function handleSendOfficerBroadcast(event) {
        if (event) event.preventDefault();

        const program = document.getElementById('broadcastTargetProgram')?.value;
        const priority = document.getElementById('broadcastPriority')?.value;
        const subject = (document.getElementById('broadcastSubject')?.value || '').trim();
        const body = (document.getElementById('broadcastMessage')?.value || '').trim();

        if (!subject || !body) {
            alert('Please provide notice subject and message body.');
            return;
        }

        const newNotif = {
            id: Date.now(),
            title: subject,
            message: body,
            priority: priority,
            target: program,
            sender: 'PESO Officer',
            created_at: new Date().toISOString()
        };

        if (!state.notifications) state.notifications = [];
        state.notifications.unshift(newNotif);

        logAudit('OFFICER_DISPATCH_BROADCAST', `Dispatched broadcast "${subject}" to target cohort ${program}`);

        if (typeof OTPAuth !== 'undefined' && OTPAuth.broadcastRealtimeEvent) {
            OTPAuth.broadcastRealtimeEvent('NEW_NOTIFICATION', newNotif);
        }

        // Live Supabase sync
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                supabaseClient.from('notifications').insert([{
                    title: subject,
                    message: body,
                    priority: priority,
                    target_role: 'Beneficiary',
                    created_at: new Date().toISOString()
                }]);
            } catch (e) {}
        }

        document.getElementById('officerBroadcastForm')?.reset();
        renderOfficerNotificationsFeed();

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Broadcast Dispatched',
                message: `Advisory sent to all beneficiaries under cohort: ${program}.`,
                type: 'success'
            });
        }
    }

    /**
     * MODULE 10: Reports Engine (8 Datasets, CSV & PDF Export)
     */
    function loadOfficerReportDataset() {
        const select = document.getElementById('officerReportDatasetSelect');
        const datasetKey = select ? select.value : 'applications';
        state.activeReportDataset = datasetKey;

        const titleEl = document.getElementById('officerReportTitleDisplay');
        const thead = document.getElementById('officerReportTableHead');
        const tbody = document.getElementById('officerReportTableBody');
        const badge = document.getElementById('officerReportRecordCountBadge');

        const headers = {
            'applications': '<tr><th>App #</th><th>Beneficiary Name</th><th>Program</th><th>Barangay</th><th>Date Filed</th><th>Completeness Status</th><th>Evaluation Outcome</th></tr>',
            'pending_reviews': '<tr><th>App #</th><th>Beneficiary Name</th><th>Program</th><th>Date Filed</th><th>Missing Documents</th><th>Officer Review Status</th></tr>',
            'ready_batching': '<tr><th>Ref #</th><th>Beneficiary Name</th><th>Program</th><th>Admin Approval Date</th><th>Batch Assignment Status</th></tr>',
            'batched_bens': '<tr><th>Batch Name</th><th>Program</th><th>Beneficiary Name</th><th>QR Pass ID</th><th>Event Schedule</th><th>Lock Status</th></tr>',
            'expired_apps': '<tr><th>App #</th><th>Beneficiary Name</th><th>Program</th><th>Denial Reason</th><th>3-Day Deadline</th><th>Final Status</th></tr>',
            'interview_outcomes': '<tr><th>Interview Slot</th><th>Beneficiary Name</th><th>Program</th><th>Date & Time</th><th>Venue</th><th>Attendance Outcome</th></tr>',
            'training_completions': '<tr><th>Trainee Name</th><th>Program & Batch</th><th>Sessions Completed</th><th>Attendance %</th><th>Training Status</th><th>Certificate Eligibility</th></tr>',
            'disbursement_records': '<tr><th>Release Ref #</th><th>Beneficiary QR & Name</th><th>Program</th><th>Disbursed Item</th><th>Release Timestamp</th><th>QR Verification</th></tr>'
        };

        if (thead) thead.innerHTML = headers[datasetKey] || headers['applications'];

        let datasetRows = [];

        if (datasetKey === 'applications') {
            datasetRows = (state.applications || []).map(a => `
                <tr>
                    <td class="font-monospace text-primary fw-bold">#APP-${escapeHtml(String(a.id || a.application_number))}</td>
                    <td class="fw-bold text-dark">${escapeHtml(a.beneficiaryName || 'Applicant')}</td>
                    <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace">${escapeHtml(a.programCode || a.program || 'PESO')}</span></td>
                    <td>${escapeHtml(a.barangay || 'Koronadal')}</td>
                    <td><small class="text-muted font-monospace">${escapeHtml(a.date_applied || a.dateSubmitted || 'Recent')}</small></td>
                    <td><span class="badge ${a.is_complete !== false ? 'bg-success' : 'bg-danger'}">${a.is_complete !== false ? 'Complete' : 'Incomplete'}</span></td>
                    <td><span class="badge ${a.status === 'Approved' ? 'bg-success' : (a.status === 'Denied' ? 'bg-danger' : 'bg-warning text-dark')}">${escapeHtml(a.status || 'Pending')}</span></td>
                </tr>
            `);
        } else if (datasetKey === 'training_completions') {
            datasetRows = (state.beneficiaries || []).map(b => {
                const total = b.total_sessions || 5;
                const attended = b.sessions_attended !== undefined ? b.sessions_attended : (b.training_status === 'Completed' ? total : 0);
                const pct = Math.round((attended / total) * 100);
                const isDone = b.training_status === 'Completed' || pct >= 100;
                return `
                    <tr>
                        <td class="fw-bold text-dark">${escapeHtml(b.name || `${b.first_name || ''} ${b.last_name || ''}`)}</td>
                        <td>${escapeHtml(b.program || 'Livelihood')} (${escapeHtml(b.batch_name || 'General')})</td>
                        <td><span class="font-monospace fw-bold">${attended} / ${total} Days</span></td>
                        <td><span class="badge ${isDone ? 'bg-success' : 'bg-warning text-dark'} font-monospace">${pct}%</span></td>
                        <td><span class="badge ${isDone ? 'bg-success' : 'bg-secondary'}">${isDone ? 'Completed' : 'In Progress'}</span></td>
                        <td><span class="badge ${isDone ? 'bg-info-subtle text-info border' : 'bg-light text-dark'}">${isDone ? 'Eligible' : 'Incomplete'}</span></td>
                    </tr>
                `;
            });
        } else if (datasetKey === 'disbursement_records') {
            datasetRows = (state.approvedAssistance || []).map(r => `
                <tr>
                    <td class="font-monospace fw-bold text-success">${escapeHtml(r.id || `REL-${r.dbId}`)}</td>
                    <td>${escapeHtml(r.beneficiaryName || 'Beneficiary')} (${escapeHtml(r.beneficiaryQr || 'QR-BEN')})</td>
                    <td><span class="badge bg-primary-subtle text-primary border">${escapeHtml(r.programCode || 'PESO')}</span></td>
                    <td class="fw-semibold">${escapeHtml(r.assistanceType || 'Assistance Package')}</td>
                    <td><small class="font-monospace text-muted">${escapeHtml(r.approvalDate || 'Recent')}</small></td>
                    <td><span class="badge bg-success-subtle text-success border"><i class="bi bi-qr-code-scan me-1"></i>QR Verified</span></td>
                </tr>
            `);
        } else if (datasetKey === 'pending_reviews') {
            // "Pending Completeness Reviews" -- applications still awaiting an
            // officer completeness decision (i.e. not yet Approved/Denied/Officer
            // Approved/Officer Denied by anyone).
            datasetRows = (state.applications || []).filter(a =>
                a.status === 'Pending' || a.status === 'Pending Requirements' || a.status === 'Under Review'
            ).map(a => `
                <tr>
                    <td class="font-monospace text-primary fw-bold">${escapeHtml(String(a.id))}</td>
                    <td class="fw-bold text-dark">${escapeHtml(a.beneficiaryName || 'Applicant')}</td>
                    <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace">${escapeHtml(a.programCode || 'PESO')}</span></td>
                    <td><small class="text-muted font-monospace">${escapeHtml(a.dateSubmitted || 'Recent')}</small></td>
                    <td class="small">${escapeHtml(a.missingNotes || a.remarks || 'None flagged yet')}</td>
                    <td><span class="badge ${a.status === 'Pending Requirements' ? 'bg-warning text-dark' : 'bg-secondary'}">${escapeHtml(a.status || 'Pending')}</span></td>
                </tr>
            `);
        } else if (datasetKey === 'ready_batching') {
            // "Ready for Batching (Admin-Approved)" -- Admin has approved these,
            // but they have not yet been placed into an operational batch.
            datasetRows = (state.applications || []).filter(a =>
                (a.status === 'Approved' || a.status === 'Officer Approved') && !a.operational_batch_id
            ).map(a => `
                <tr>
                    <td class="font-monospace text-primary fw-bold">${escapeHtml(String(a.id))}</td>
                    <td class="fw-bold text-dark">${escapeHtml(a.beneficiaryName || 'Applicant')}</td>
                    <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace">${escapeHtml(a.programCode || 'PESO')}</span></td>
                    <td><small class="text-muted font-monospace">${escapeHtml(a.evaluated_at ? String(a.evaluated_at).substring(0, 10) : (a.dateSubmitted || 'N/A'))}</small></td>
                    <td><span class="badge bg-warning text-dark">Awaiting Batch Assignment</span></td>
                </tr>
            `);
        } else if (datasetKey === 'batched_bens') {
            // "Batched Beneficiaries" -- flatten every operational batch's real
            // member roster instead of reusing the plain applications list.
            datasetRows = [];
            (state.batches || []).forEach(b => {
                const matchedSchedule = (state.schedules || []).find(s => String(s.batchId) === String(b.id));
                const eventSchedule = b.eventDate
                    ? `${b.eventDate}${b.eventTime ? ' ' + b.eventTime : ''}`
                    : (matchedSchedule ? `${matchedSchedule.startDate} ${matchedSchedule.scheduleTime}` : 'Not yet scheduled');
                (b.members || []).forEach(m => {
                    datasetRows.push(`
                <tr>
                    <td class="fw-bold text-dark">${escapeHtml(b.name || `Batch #${b.id}`)}</td>
                    <td><span class="badge bg-primary-subtle text-primary border">${escapeHtml(b.program || 'PESO')}</span></td>
                    <td>${escapeHtml(m.beneficiaryName || 'Applicant')}</td>
                    <td class="font-monospace">${escapeHtml(m.qrCodeId || 'QR-BEN')}</td>
                    <td><small class="text-muted font-monospace">${escapeHtml(eventSchedule)}</small></td>
                    <td><span class="badge ${b.is_locked ? 'bg-danger-subtle text-danger border' : 'bg-success-subtle text-success border'}">${b.is_locked ? 'Locked' : 'Open'}</span></td>
                </tr>
            `);
                });
            });
        } else if (datasetKey === 'expired_apps') {
            // "Expired / Incomplete Applications" -- applications the officer or
            // admin denied, with the real denial reason instead of a fabricated one.
            datasetRows = (state.applications || []).filter(a =>
                a.status === 'Denied' || a.status === 'Officer Denied' || a.status === 'Rejected'
            ).map(a => {
                const deadline = a.evaluated_at
                    ? new Date(new Date(a.evaluated_at).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
                    : 'N/A';
                return `
                <tr>
                    <td class="font-monospace text-primary fw-bold">${escapeHtml(String(a.id))}</td>
                    <td class="fw-bold text-dark">${escapeHtml(a.beneficiaryName || 'Applicant')}</td>
                    <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace">${escapeHtml(a.programCode || 'PESO')}</span></td>
                    <td class="small">${escapeHtml(a.remarks || a.missingNotes || 'Not specified')}</td>
                    <td><small class="font-monospace text-muted">${escapeHtml(deadline)}</small></td>
                    <td><span class="badge bg-danger">${escapeHtml(a.status || 'Denied')}</span></td>
                </tr>
            `;
            });
        } else if (datasetKey === 'interview_outcomes') {
            // "Interview Activity Outcomes" -- real scheduled activities, not the
            // applications list reused under mismatched headers.
            datasetRows = (state.schedules || []).map(s => `
                <tr>
                    <td class="font-monospace text-primary fw-bold">${escapeHtml(s.slot_id || String(s.id))}</td>
                    <td class="fw-bold text-dark">${escapeHtml(s.beneficiaryName || (s.batchName ? `Batch: ${s.batchName}` : 'Unassigned'))}</td>
                    <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace">${escapeHtml(s.programCode || 'PESO')}</span></td>
                    <td><small class="text-muted font-monospace">${escapeHtml(s.startDate || 'N/A')} ${escapeHtml(s.scheduleTime || '')}</small></td>
                    <td>${escapeHtml(s.venue || 'PESO Main Office')}</td>
                    <td><span class="badge ${s.attendance === 'Present' ? 'bg-success' : (s.attendance === 'Absent' ? 'bg-danger' : 'bg-secondary')}">${escapeHtml(s.attendance || 'Unmarked')}</span></td>
                </tr>
            `);
        } else {
            // General application fallback
            datasetRows = (state.applications || []).map(a => `
                <tr>
                    <td class="font-monospace text-primary">#APP-${escapeHtml(String(a.id || a.application_number))}</td>
                    <td class="fw-bold">${escapeHtml(a.beneficiaryName || 'Applicant')}</td>
                    <td><span class="badge bg-primary">${escapeHtml(a.programCode || a.program || 'PESO')}</span></td>
                    <td>${escapeHtml(a.barangay || 'Koronadal')}</td>
                    <td>${escapeHtml(a.date_applied || 'Recent')}</td>
                    <td><span class="badge bg-success">Complete</span></td>
                    <td><span class="badge bg-primary">${escapeHtml(a.status || 'Pending')}</span></td>
                </tr>
            `);
        }

        if (tbody) {
            if (datasetRows.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No records found for this dataset.</td></tr>`;
            } else {
                tbody.innerHTML = datasetRows.join('');
            }
        }

        if (badge) badge.textContent = `${datasetRows.length} Records`;
        if (titleEl) titleEl.textContent = select ? select.options[select.selectedIndex].text : 'Reports Dataset';
    }

    function exportOfficerReportsCSV() {
        const datasetKey = state.activeReportDataset || 'applications';
        let csvRows = [];
        
        if (datasetKey === 'applications') {
            csvRows = [
                ['Record ID', 'Beneficiary Name', 'Program', 'Status', 'Date Applied'],
                ...(state.applications || []).map(a => [
                    a.id || a.application_number || '',
                    `"${(a.beneficiaryName || '').replace(/"/g, '""')}"`,
                    `"${(a.programCode || a.program || '').replace(/"/g, '""')}"`,
                    a.status || '',
                    a.date_applied || ''
                ])
            ];
        } else if (datasetKey === 'training_completions') {
            csvRows = [
                ['Beneficiary ID', 'Name', 'Program', 'Sessions Attended', 'Total Sessions', 'Status'],
                ...(state.beneficiaries || []).map(b => [
                    b.qr_code || b.id || '',
                    `"${(b.name || '').replace(/"/g, '""')}"`,
                    `"${(b.program || '').replace(/"/g, '""')}"`,
                    b.sessions_attended || 0,
                    b.total_sessions || 5,
                    b.training_status || 'In Progress'
                ])
            ];
        } else {
            csvRows = [
                ['Reference Number', 'Beneficiary QR', 'Beneficiary Name', 'Program', 'Disbursed Item', 'Date'],
                ...(state.approvedAssistance || []).map(r => [
                    r.reference_number || r.id || '',
                    r.beneficiary_qr || '',
                    `"${(r.beneficiaryName || '').replace(/"/g, '""')}"`,
                    `"${(r.programCode || '').replace(/"/g, '""')}"`,
                    `"${(r.assistance_type || r.item || '').replace(/"/g, '""')}"`,
                    r.release_date || ''
                ])
            ];
        }

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `PESO_Officer_Report_${datasetKey}_${new Date().toISOString().substring(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function printOfficerReportsPDF() {
        window.print();
    }

    /**
     * Show Beneficiary QR Pass Modal
     */
    function showBeneficiaryQR(id) {
        const ben = state.beneficiaries.find(b => String(b.id) === String(id) || b.qr_code === id);
        const qrStr = ben ? ben.qr_code : (String(id).startsWith('QR-') ? id : `QR-BEN-${id}`);

        if (typeof showPesoOfficerBenQrModal === 'function') {
            showPesoOfficerBenQrModal(ben || { qr_code: qrStr });
        } else {
            alert(`Beneficiary Official QR Pass: ${qrStr}`);
        }
    }

    return Object.freeze({
        state,
        switchTab,
        loadAllOfficerData: async function() {
            renderOfficerDashboard();
            renderBeneficiariesTable();
            renderOfficerEvaluationTable();
            renderBeneficiaryBatchesModule();
            renderOfficerScheduleModule();
            renderTrainingAttendanceTable();
            renderApprovedAssistanceTable();
            renderDisbursementLedgerTable();
            renderOfficerNotificationsFeed();
            loadOfficerReportDataset();
        },
        getOfficerAssignedPrograms,
        navigateToStatusList,
        navigateToScheduleDay,
        openActionResolveModal,
        submitActionResolution,
        safeOpenModal,
        safeCloseModal,
        renderOfficerDashboard,
        renderBeneficiariesTable,
        calcWalkInAge,
        openWalkInRegistrationModal,
        checkUsernameUniqueness,
        submitWalkInRegistration,
        openBeneficiaryRecordModal,
        openEditBeneficiaryModal,
        calcEditBenAge,
        resetEditBeneficiaryForm,
        submitEditBeneficiary,
        toggleBeneficiaryStatus,
        showBeneficiaryQR,
        renderOfficerEvaluationTable,
        handleApproveCompleteness,
        openOfficerDenyIncompleteModal,
        submitOfficerDenyIncomplete,
        renderBeneficiaryBatchesModule,
        lockBatch,
        renderOfficerScheduleModule,
        renderTrainingAttendanceTable,
        openTrainingAttendanceModal,
        saveIndividualTrainingAttendance,
        renderApprovedAssistanceTable,
        renderDisbursementLedgerTable,
        handleQrDisbursementScan,
        confirmDisbursementRelease,
        renderOfficerNotificationsFeed,
        handleSendOfficerBroadcast,
        loadOfficerReportDataset,
        exportOfficerReportsCSV,
        printOfficerReportsPDF,
        VERSION: '1.0.0-FROZEN',
        STATUS: 'LOCKED',
        CONTRACT: typeof PESO_OFFICER_API_CONTRACT_V1 !== 'undefined' ? PESO_OFFICER_API_CONTRACT_V1 : null,
        isFrozen: () => true
    });
})();

// Global assignments
if (typeof window !== 'undefined') {
    window.PesoOfficerApp = PesoOfficerApp;
    window.PESO_OFFICER_VERSION = '1.0.0-FROZEN';
    window.switchTab = PesoOfficerApp.switchTab;
    window.refreshAllOfficerData = () => PesoOfficerApp.loadAllOfficerData();
    window.navigateToStatusList = PesoOfficerApp.navigateToStatusList;
    window.navigateToScheduleDay = PesoOfficerApp.navigateToScheduleDay;
    window.openActionResolveModal = PesoOfficerApp.openActionResolveModal;
    window.submitActionResolution = PesoOfficerApp.submitActionResolution;
    window.openAddBeneficiaryModal = PesoOfficerApp.openWalkInRegistrationModal;
    window.openBeneficiaryRecordModal = PesoOfficerApp.openBeneficiaryRecordModal;
    window.openEditBeneficiaryModal = PesoOfficerApp.openEditBeneficiaryModal;
    window.calcEditBenAge = PesoOfficerApp.calcEditBenAge;
    window.resetEditBeneficiaryForm = PesoOfficerApp.resetEditBeneficiaryForm;
    window.handleApproveCompleteness = PesoOfficerApp.handleApproveCompleteness;
    window.openOfficerDenyIncompleteModal = PesoOfficerApp.openOfficerDenyIncompleteModal;
    window.submitOfficerDenyIncomplete = PesoOfficerApp.submitOfficerDenyIncomplete;
    window.handleDenyReasonChange = (val) => {
        const customBox = document.getElementById('denyCustomReasonGroup');
        if (customBox) customBox.classList.toggle('d-none', val !== 'OTHER');
    };
    window.openTrainingAttendanceModal = PesoOfficerApp.openTrainingAttendanceModal;
    window.saveIndividualTrainingAttendance = PesoOfficerApp.saveIndividualTrainingAttendance;
    window.filterTrainingAttendanceTable = PesoOfficerApp.renderTrainingAttendanceTable;
    window.resetTrainingFilters = () => {
        const s = document.getElementById('trainingSearchInput');
        const p = document.getElementById('trainingProgramFilter');
        const st = document.getElementById('trainingStatusFilter');
        if (s) s.value = '';
        if (p) p.value = '';
        if (st) st.value = '';
        PesoOfficerApp.renderTrainingAttendanceTable();
    };
    window.exportTrainingAttendanceCSV = PesoOfficerApp.exportOfficerReportsCSV;
    window.printTrainingAttendancePDF = () => window.print();
    window.handleQrDisbursementScan = PesoOfficerApp.handleQrDisbursementScan;
    window.confirmDisbursementRelease = PesoOfficerApp.confirmDisbursementRelease;
    window.refreshOfficerNotifications = PesoOfficerApp.renderOfficerNotificationsFeed;
    window.handleSendOfficerBroadcast = PesoOfficerApp.handleSendOfficerBroadcast;
    window.loadOfficerReportDataset = PesoOfficerApp.loadOfficerReportDataset;
    window.exportOfficerReportsCSV = PesoOfficerApp.exportOfficerReportsCSV;
    window.printOfficerReportsPDF = PesoOfficerApp.printOfficerReportsPDF;
    window.resetOfficerReportFilters = () => {
        const p = document.getElementById('officerReportProgramFilter');
        const m = document.getElementById('officerReportMonthFilter');
        if (p) p.value = '';
        if (m) m.value = '';
        PesoOfficerApp.loadOfficerReportDataset();
    };
    window.toggleOfficerBeneficiaryStatus = PesoOfficerApp.toggleBeneficiaryStatus;
    window.filterBeneficiariesTable = PesoOfficerApp.renderBeneficiariesTable;
    window.resetBeneficiaryFilters = () => {
        const q = document.getElementById('benSearchInput') || document.getElementById('searchBeneficiaryQuery');
        const b = document.getElementById('benBarangayFilter');
        const s = document.getElementById('benStatusFilter');
        const e = document.getElementById('benEligibilityFilter');
        if (q) q.value = '';
        if (b) b.value = '';
        if (s) s.value = '';
        if (e) e.value = '';
        PesoOfficerApp.renderBeneficiariesTable();
    };
}

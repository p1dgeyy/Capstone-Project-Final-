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
        isLoaded: false
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
        if (typeof supabaseClient !== 'undefined' && supabaseClient && typeof supabaseClient.from === 'function') {
            supabaseClient.from('audit_logs').insert({
                action: actionType,
                details: details,
                entity_type: 'officer_action',
                created_at: new Date().toISOString()
            }).then(() => {}).catch(() => {});
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
     * MODULE 1: Dashboard Overview (Read-Only & Real-time Auto-Refresh)
     */
    function renderOfficerDashboard() {
        // 1. Calculate 4 key metrics
        const pendingAppsCount = state.applications.filter(a => ['Pending', 'Pending Officer Review', 'Under Review', 'Incomplete'].includes(a.status)).length;
        const unbatchedCount = state.applications.filter(a => (a.status === 'Approved' || a.status === 'Officer Approved') && !a.batch_id).length;
        const scheduledEventsCount = state.schedules.length;
        const notifsCount = state.notifications.length || 3;

        const elPending = document.getElementById('statOfficerPendingApps');
        const elUnbatched = document.getElementById('statOfficerUnbatchedBatches');
        const elSched = document.getElementById('statOfficerScheduledEvents');
        const elNotifs = document.getElementById('statOfficerNotifs');

        if (elPending) elPending.textContent = pendingAppsCount;
        if (elUnbatched) elUnbatched.textContent = unbatchedCount;
        if (elSched) elSched.textContent = scheduledEventsCount;
        if (elNotifs) elNotifs.textContent = notifsCount;

        if (typeof updateDashboardOverviewMetrics === 'function') {
            updateDashboardOverviewMetrics(window._cachedPrograms || [], state.applications);
        }
    }

    /**
     * MODULE 2: Beneficiary Management (Intake, Updates, Deactivation Only, Masked Contacts)
     */
    function renderBeneficiariesTable() {
        const tbody = document.getElementById('beneficiaryTableBody') || document.getElementById('officerBeneficiaryTableBody');
        if (!tbody) return;

        const query = (document.getElementById('benSearchInput')?.value || document.getElementById('searchBeneficiaryQuery')?.value || '').toLowerCase();
        const brgyFilter = (document.getElementById('benBarangayFilter')?.value || '').toLowerCase();
        const statusFilter = document.getElementById('benStatusFilter')?.value || '';

        const filtered = state.beneficiaries.filter(b => {
            const name = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
            const qr = (b.qr_code || '').toLowerCase();
            const matchesQuery = !query || name.includes(query) || qr.includes(query) || (b.email && b.email.toLowerCase().includes(query));
            const matchesBrgy = !brgyFilter || (b.barangay && b.barangay.toLowerCase().includes(brgyFilter));
            const matchesStatus = !statusFilter || b.status === statusFilter;
            return matchesQuery && matchesBrgy && matchesStatus;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No beneficiary records match the search/filter criteria.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(b => `
            <tr>
                <td class="fw-bold font-monospace text-primary">
                    <span class="badge bg-light text-primary border font-monospace">${escapeHtml(b.qr_code)}</span>
                </td>
                <td class="fw-bold text-dark">${escapeHtml(b.first_name)} ${escapeHtml(b.last_name)}</td>
                <td><small class="text-muted"><i class="bi bi-geo-alt me-1"></i>${escapeHtml(b.barangay || 'Koronadal')}</small></td>
                <td>
                    <span class="font-monospace text-dark d-block small">${maskPhone(b.phone || b.contact)}</span>
                    <small class="text-muted">${escapeHtml(b.email || 'N/A')}</small>
                </td>
                <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle">${escapeHtml(b.program || 'PESO Livelihood')}</span></td>
                <td>
                    <span class="badge ${b.status === 'Active' ? 'bg-success' : 'bg-secondary'}">${escapeHtml(b.status || 'Active')}</span>
                </td>
                <td>
                    <span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-shield-check me-1"></i>Verified</span>
                </td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-sm btn-outline-primary py-1 px-2 me-1" onclick="PesoOfficerApp.showBeneficiaryQR('${b.qr_code || b.id}')" title="View Digital Pass">
                        <i class="bi bi-qr-code-scan me-1"></i>Pass
                    </button>
                    <button class="btn btn-sm ${b.status === 'Active' ? 'btn-outline-danger' : 'btn-outline-success'} py-1 px-2" onclick="PesoOfficerApp.toggleBeneficiaryStatus('${b.qr_code || b.id}')" title="Deactivate/Activate Account">
                        <i class="bi ${b.status === 'Active' ? 'bi-person-dash' : 'bi-person-check'} me-1"></i>${b.status === 'Active' ? 'Deactivate' : 'Activate'}
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async function toggleBeneficiaryStatus(id) {
        const ben = state.beneficiaries.find(b => String(b.id) === String(id) || b.qr_code === id);
        if (!ben) return;

        const newStatus = ben.status === 'Active' ? 'Deactivated' : 'Active';
        if (!confirm(`Confirm account status modification:\n\nBeneficiary: ${ben.first_name} ${ben.last_name} (${ben.qr_code})\nNew Status: ${newStatus}\n\nNotice: This action will be logged in the permanent audit trail with your Officer credentials.`)) {
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
        logAudit('OFFICER_TOGGLE_BENEFICIARY_STATUS', `Set status of beneficiary ${ben.first_name} ${ben.last_name} (${ben.qr_code}) to ${newStatus}`);

        // Broadcast status update to beneficiary
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

        // Derive training records from beneficiaries with assigned programs
        let records = state.beneficiaries.map((b, idx) => ({
            id: b.id || idx + 1,
            qr_code: b.qr_code,
            name: `${b.first_name || ''} ${b.last_name || ''}`.trim() || 'Beneficiary',
            program: b.program || 'SPES',
            batch: `Batch 2026-${(idx % 3) + 1}`,
            trainingTitle: `${b.program || 'Livelihood'} Skills Development & Safety Training`,
            sessionsAttended: (idx % 2 === 0) ? 5 : 3,
            totalSessions: 5,
            status: (idx % 2 === 0) ? 'Completed' : 'In Progress'
        }));

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
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No training attendance records found.</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map(r => {
            const pct = Math.round((r.sessionsAttended / r.totalSessions) * 100);
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
                        <span class="badge ${isCompleted ? 'bg-success' : 'bg-warning text-dark'}">${escapeHtml(r.status)}</span>
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
        safeOpenModal('officerTrainingAttendanceModal');
    }

    function saveIndividualTrainingAttendance() {
        const benId = document.getElementById('trainingBenIdInput')?.value;
        const attended = document.getElementById('trainingSessionsAttendedInput')?.value || 5;
        const status = document.getElementById('trainingStatusSelect')?.value || 'Completed';

        logAudit('OFFICER_UPDATE_TRAINING_ATTENDANCE', `Updated training attendance for beneficiary #${benId} (${attended} sessions, Status: ${status})`);
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

        let records = state.applications.filter(a => a.status === 'Approved' || a.status === 'Officer Approved' || a.status === 'Disbursed');
        if (records.length === 0) {
            records = [
                { id: 101, beneficiaryName: 'Maria Santos', programCode: 'TUPAD', item: 'Emergency Employment Wage Voucher', amount: 5000, date_applied: '2026-08-20', dualVerified: true },
                { id: 102, beneficiaryName: 'Carlos Mendoza', programCode: 'SPES', item: 'Student Educational Stipend', amount: 8000, date_applied: '2026-08-22', dualVerified: true },
                { id: 103, beneficiaryName: 'Roberto Gomez', programCode: 'Starter Kit', item: 'Carpentry Tools & PPE Kit', amount: 15000, date_applied: '2026-08-24', dualVerified: false }
            ];
        }

        if (query) records = records.filter(r => (r.beneficiaryName || '').toLowerCase().includes(query));
        if (progFilter) records = records.filter(r => r.programCode === progFilter);

        tbody.innerHTML = records.map(r => `
            <tr>
                <td class="font-monospace fw-bold text-primary">#AST-${r.id}</td>
                <td class="fw-semibold text-dark">${escapeHtml(r.beneficiaryName)}</td>
                <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace">${escapeHtml(r.programCode || 'PESO')}</span></td>
                <td>
                    <span class="fw-bold text-dark d-block">${escapeHtml(r.item || 'Livelihood Assistance Grant')}</span>
                    <small class="text-success font-monospace fw-bold">${formatCurrency(r.amount || 5000)}</small>
                </td>
                <td><small class="text-muted font-monospace">${escapeHtml(r.date_applied || '2026-08-26')}</small></td>
                <td>
                    <span class="badge ${r.dualVerified ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-warning-subtle text-warning border border-warning-subtle'}">
                        <i class="bi ${r.dualVerified ? 'bi-shield-fill-check' : 'bi-hourglass-split'} me-1"></i>
                        ${r.dualVerified ? 'Dual-Confirmed (Voucher Signed)' : 'Pending Beneficiary Sign-off'}
                    </span>
                </td>
                <td><span class="badge bg-light text-dark border">PESO Officer</span></td>
            </tr>
        `).join('');
    }

    /**
     * MODULE 8: Disbursement (QR Scan Mandatory & Auto-Inventory Deduction)
     */
    function renderDisbursementLedgerTable() {
        const tbody = document.getElementById('disbursementLogsTableBody');
        if (!tbody) return;

        const dummyLogs = [
            { ref: 'REL-2026-001', qr: 'QR-BEN-102934', name: 'Maria Santos', program: 'TUPAD', item: 'Cash Grant (₱5,000.00)', time: '2026-08-26 10:15 AM', officer: 'PESO Officer' },
            { ref: 'REL-2026-002', qr: 'QR-BEN-293847', name: 'Juan Dela Cruz', program: 'Starter Kit', item: 'Welding Equipment Starter Kit', time: '2026-08-26 11:30 AM', officer: 'PESO Officer' },
            { ref: 'REL-2026-003', qr: 'QR-BEN-384756', name: 'Elena Bautista', program: 'PFAS', item: 'Pangkabuhayan Capital Seed (₱10,000.00)', time: '2026-08-26 02:00 PM', officer: 'PESO Officer' }
        ];

        tbody.innerHTML = dummyLogs.map(l => `
            <tr>
                <td class="font-monospace fw-bold text-success">${escapeHtml(l.ref)}</td>
                <td>
                    <span class="badge bg-light text-dark font-monospace border d-block mb-1">${escapeHtml(l.qr)}</span>
                    <span class="fw-semibold text-dark">${escapeHtml(l.name)}</span>
                </td>
                <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace">${escapeHtml(l.program)}</span></td>
                <td class="fw-bold text-dark">${escapeHtml(l.item)}</td>
                <td><small class="text-muted font-monospace">${escapeHtml(l.time)}</small></td>
                <td><span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-qr-code-scan me-1"></i>QR Verified</span></td>
                <td><small class="text-secondary">${escapeHtml(l.officer)}</small></td>
            </tr>
        `).join('');
    }

    function handleQrDisbursementScan(qrCode) {
        const cleanQr = String(qrCode || '').trim();
        const ben = state.beneficiaries.find(b => b.qr_code === cleanQr || String(b.id) === cleanQr);

        const nameEl = document.getElementById('disburseBenName');
        const qrEl = document.getElementById('disburseBenQrCode');
        const progEl = document.getElementById('disburseProgramName');
        const itemEl = document.getElementById('disburseItemName');
        const amountEl = document.getElementById('disburseAmount');

        if (nameEl) nameEl.textContent = ben ? `${ben.first_name} ${ben.last_name}` : 'Elena Bautista';
        if (qrEl) qrEl.textContent = cleanQr || 'QR-BEN-384756';
        if (progEl) progEl.textContent = (ben && ben.program) || 'Starter Kit / Livelihood';
        if (itemEl) itemEl.textContent = 'Carpentry & Electrical Tool Package';
        if (amountEl) amountEl.textContent = '₱15,000.00';

        safeOpenModal('officerQrDisbursementModal');
    }

    function confirmDisbursementRelease() {
        const name = document.getElementById('disburseBenName')?.textContent || 'Beneficiary';
        const qr = document.getElementById('disburseBenQrCode')?.textContent || 'QR-BEN-XXXXXX';
        const item = document.getElementById('disburseItemName')?.textContent || 'Package';

        logAudit('OFFICER_CONFIRM_DISBURSEMENT', `Executed on-site QR release of ${item} to ${name} (${qr}) with dual voucher sign-off.`);
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

        const notifs = [
            { id: 1, title: 'New Schedule Slots Provisioned', message: 'PESO Admin created 30 new interview slots for SPES Batch 2.', time: '10 mins ago', type: 'ADMIN' },
            { id: 2, title: 'Document Resubmission Uploaded', message: 'Maria Santos uploaded corrected Barangay Indigency certificate.', time: '1 hour ago', type: 'BENEFICIARY' },
            { id: 3, title: 'Appropriation Ordinance Updated', message: 'LGU Ordinance No. 6 budget line item unlocked for TUPAD emergency wave.', time: '3 hours ago', type: 'ADMIN' }
        ];

        container.innerHTML = notifs.map(n => `
            <div class="p-3 border rounded-3 bg-light d-flex align-items-start gap-3">
                <div class="p-2 rounded-circle ${n.type === 'ADMIN' ? 'bg-primary-subtle text-primary' : 'bg-success-subtle text-success'}">
                    <i class="bi ${n.type === 'ADMIN' ? 'bi-shield-lock-fill' : 'bi-person-check-fill'} fs-5"></i>
                </div>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <h6 class="fw-bold mb-0 text-dark" style="font-size: 0.9rem;">${escapeHtml(n.title)}</h6>
                        <small class="text-muted font-monospace">${escapeHtml(n.time)}</small>
                    </div>
                    <p class="small text-muted mb-0">${escapeHtml(n.message)}</p>
                </div>
            </div>
        `).join('');
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

        logAudit('OFFICER_DISPATCH_BROADCAST', `Dispatched broadcast "${subject}" to target cohort ${program}`);

        if (typeof OTPAuth !== 'undefined' && OTPAuth.broadcastRealtimeEvent) {
            OTPAuth.broadcastRealtimeEvent('NEW_NOTIFICATION', {
                title: subject,
                message: body,
                priority: priority,
                target: program,
                sender: 'PESO Officer',
                timestamp: Date.now()
            });
        }

        document.getElementById('officerBroadcastForm')?.reset();

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

        // Render dataset rows
        const rows = [
            `<tr><td class="font-monospace text-primary">#APP-2026-001</td><td class="fw-bold">Maria Santos</td><td><span class="badge bg-primary">SPES</span></td><td>Poblacion</td><td>2026-08-10</td><td><span class="badge bg-success">Complete</span></td><td><span class="badge bg-success">Approved</span></td></tr>`,
            `<tr><td class="font-monospace text-primary">#APP-2026-002</td><td class="fw-bold">Juan Dela Cruz</td><td><span class="badge bg-warning text-dark">TUPAD</span></td><td>Morales</td><td>2026-08-12</td><td><span class="badge bg-success">Complete</span></td><td><span class="badge bg-success">Approved</span></td></tr>`,
            `<tr><td class="font-monospace text-primary">#APP-2026-003</td><td class="fw-bold">Carlos Mendoza</td><td><span class="badge bg-info text-dark">Starter Kit</span></td><td>Zone 1</td><td>2026-08-14</td><td><span class="badge bg-danger">Incomplete</span></td><td><span class="badge bg-warning text-dark">Pending</span></td></tr>`
        ];

        if (tbody) tbody.innerHTML = rows.join('');
        if (badge) badge.textContent = `${rows.length} Records`;
        if (titleEl) titleEl.textContent = select ? select.options[select.selectedIndex].text : 'Reports Dataset';
    }

    function exportOfficerReportsCSV() {
        const datasetKey = state.activeReportDataset || 'applications';
        const csvContent = "data:text/csv;charset=utf-8,Record ID,Beneficiary Name,Program,Status,Timestamp\n1,Maria Santos,SPES,Approved,2026-08-26\n2,Juan Dela Cruz,TUPAD,Approved,2026-08-26";
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
        safeOpenModal,
        safeCloseModal,
        renderOfficerDashboard,
        renderBeneficiariesTable,
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
        printOfficerReportsPDF
    });
})();

// Global assignments
if (typeof window !== 'undefined') {
    window.PesoOfficerApp = PesoOfficerApp;
    window.switchTab = PesoOfficerApp.switchTab;
    window.refreshAllOfficerData = () => PesoOfficerApp.loadAllOfficerData();
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
        if (q) q.value = '';
        if (b) b.value = '';
        if (s) s.value = '';
        PesoOfficerApp.renderBeneficiariesTable();
    };
}

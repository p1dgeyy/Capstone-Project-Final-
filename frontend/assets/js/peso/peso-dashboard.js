/**
 * PESO Dashboard & KPI Analytics Module (peso-dashboard.js)
 * City Government of Koronadal - Public Employment Service Office
 * 
 * Handles:
 * 1. Live KPI metrics calculation (Active programs, evaluations, beneficiaries, funds)
 * 2. Chart.js visual distribution and trends
 * 3. Real-time activity feed & Supabase Realtime listener integration
 */

const PesoDashboard = (() => {
    'use strict';

    let _chartInstance = null;

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatCurrency(amount) {
        const num = Number(amount) || 0;
        return '₱' + num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    /**
     * Compute and render overview KPI metrics for PESO Admin
     */
    function renderAdminMetrics(programs = [], applications = [], funds = [], batches = [], schedules = []) {
        try {
            const activePrograms = programs.filter(p => p.status === 'Active');
            const archivedPrograms = programs.filter(p => p.status !== 'Active');
            const totalBudget = programs.reduce((sum, p) => sum + (Number(p.budget) || Number(p.budget_allocated) || 0), 0);

            const pendingEval = applications.filter(a => a.status === 'Pending' || a.status === 'Under Review');

            // Prefer real released amounts from the funds table; only fall back to summing
            // application amounts if there is no funds data to work from at all.
            const totalDisbursed = Array.isArray(funds) && funds.length > 0
                ? funds.reduce((sum, f) => sum + (Number(f.released_amount) || Number(f.amount_approved) || Number(f.amount) || 0), 0)
                : applications.filter(a => a.status === 'Released' || a.status === 'Completed' || a.status === 'Disbursed')
                    .reduce((sum, a) => sum + (Number(a.amount_approved) || Number(a.amount_requested) || 0), 0);

            const remainingBalance = Math.max(0, totalBudget - totalDisbursed);
            const utilPercent = totalBudget > 0 ? Math.min(100, Math.round((totalDisbursed / totalBudget) * 100)) : 0;
            const activeBatches = (Array.isArray(batches) ? batches : []).filter(b => b.status === 'Active').length;

            // 1. Executive Top-Banner KPI Cards (sectionOverview) -- these are the ids that
            // actually exist on peso_admin.html; statOverviewBeneficiaries/ApprovedApps/
            // CompletedApps do not exist anywhere on this page and were dead writes before.
            const elPendingApps = document.getElementById('statOverviewPendingApps');
            if (elPendingApps) elPendingApps.textContent = pendingEval.length;

            const elActiveBatches = document.getElementById('statOverviewActiveBatches');
            if (elActiveBatches) elActiveBatches.textContent = activeBatches;

            const elSchedEvents = document.getElementById('statOverviewScheduledEvents');
            if (elSchedEvents) elSchedEvents.textContent = (Array.isArray(schedules) ? schedules.length : 0);

            const elFundDisbursed = document.getElementById('statOverviewFundDisbursed');
            if (elFundDisbursed) elFundDisbursed.textContent = formatCurrency(totalDisbursed);

            const elFundPercent = document.getElementById('statOverviewFundPercent');
            if (elFundPercent) elFundPercent.textContent = `${utilPercent}% Disbursed of Budget`;

            const elOrdApprop = document.getElementById('overviewTotalAppropriation');
            if (elOrdApprop) elOrdApprop.textContent = formatCurrency(totalBudget);

            // 2. Fund Utilization Panel
            const elUtilBudget = document.getElementById('fundUtilTotalBudget');
            if (elUtilBudget) elUtilBudget.textContent = formatCurrency(totalBudget);

            const elUtilDisbursed = document.getElementById('fundUtilTotalDisbursed');
            if (elUtilDisbursed) elUtilDisbursed.textContent = formatCurrency(totalDisbursed);

            const elUtilRemaining = document.getElementById('fundUtilRemainingBalance');
            if (elUtilRemaining) elUtilRemaining.textContent = formatCurrency(remainingBalance);

            const elUtilPercentBadge = document.getElementById('fundUtilOverallPercent');
            if (elUtilPercentBadge) elUtilPercentBadge.textContent = `${utilPercent}% Disbursed`;

            const elUtilProgressBar = document.getElementById('fundUtilProgressBar');
            if (elUtilProgressBar) {
                elUtilProgressBar.style.width = `${utilPercent}%`;
                elUtilProgressBar.setAttribute('aria-valuenow', utilPercent);
            }

            // 3. Active Program Budget Bars List
            const budgetBarsContainer = document.getElementById('overviewProgramBudgetBars');
            if (budgetBarsContainer) {
                const topPrograms = activePrograms.slice(0, 5);
                if (topPrograms.length === 0) {
                    budgetBarsContainer.innerHTML = `<div class="text-muted small py-2">No active programs.</div>`;
                } else {
                    budgetBarsContainer.innerHTML = topPrograms.map(p => {
                        const b = Number(p.budget) || Number(p.budget_allocated) || 0;
                        const pct = totalBudget > 0 ? Math.round((b / totalBudget) * 100) : 0;
                        return `
                            <div class="mb-2">
                                <div class="d-flex justify-content-between small">
                                    <span class="fw-semibold text-dark font-monospace">${escapeHtml(p.code)}</span>
                                    <span class="text-muted">${formatCurrency(b)} (${pct}%)</span>
                                </div>
                                <div class="progress" style="height: 4px;">
                                    <div class="progress-bar bg-primary" role="progressbar" style="width: ${pct}%"></div>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }

            // 4. Backward Compatibility Count KPIs
            const elTotalProg = document.getElementById('statTotalPrograms');
            if (elTotalProg) elTotalProg.textContent = programs.length;

            const elActiveProg = document.getElementById('statActivePrograms');
            if (elActiveProg) elActiveProg.textContent = activePrograms.length;

            const elArchivedProg = document.getElementById('statArchivedPrograms');
            if (elArchivedProg) elArchivedProg.textContent = archivedPrograms.length;

            const elArchBadge = document.getElementById('archiveTabBadge');
            if (elArchBadge) elArchBadge.textContent = archivedPrograms.length;

            const elArchSecCount = document.getElementById('archiveSectionCountBadge');
            if (elArchSecCount) elArchSecCount.textContent = `${archivedPrograms.length} Deactivated Programs`;

            const elTotalBudgetStat = document.getElementById('statTotalBudget');
            if (elTotalBudgetStat) elTotalBudgetStat.textContent = formatCurrency(totalBudget);

            // 5. Render Chart Trends
            renderDashboardCharts(programs, applications);

        } catch (err) {
            console.warn('[PesoDashboard] Error updating admin metrics:', err.message);
        }
    }

    /**
     * Compute and render overview KPI metrics for PESO Officer (REQ062 - REQ067)
     */
    function renderOfficerMetrics(programs = [], applications = [], beneficiaries = [], schedules = []) {
        try {
            const activePrograms = programs.filter(p => (p.status || 'Active') === 'Active');
            const pendingPrograms = programs.filter(p => ['Pending', 'Pending Setup', 'Draft', 'Under Review'].includes(p.status));
            const completedPrograms = programs.filter(p => ['Completed', 'Archived', 'Closed'].includes(p.status));

            const pendingEval = applications.filter(a => a.status === 'Pending' || a.status === 'Under Review');
            const approvedEval = applications.filter(a => a.status === 'Approved' || a.status === 'Officer Approved');

            // 1. REQ062: Livelihood Programs & Beneficiaries Overview Stats
            const elActiveProgs = document.getElementById('statActivePrograms');
            if (elActiveProgs) elActiveProgs.textContent = activePrograms.length;

            const elPendingProgs = document.getElementById('statPendingPrograms');
            if (elPendingProgs) elPendingProgs.textContent = pendingPrograms.length;

            const elCompletedProgs = document.getElementById('statCompletedPrograms');
            if (elCompletedProgs) elCompletedProgs.textContent = completedPrograms.length;

            const elAssigned = document.getElementById('statAssignedBen');
            if (elAssigned) elAssigned.textContent = beneficiaries.length;

            const elPending = document.getElementById('statPendingEval');
            if (elPending) elPending.textContent = pendingEval.length;

            const elApproved = document.getElementById('statApprovedEval');
            if (elApproved) elApproved.textContent = approvedEval.length;

            // 2. Disbursed Funds & Total Appropriation
            const totalDisbursed = applications.filter(a => a.status === 'Released' || a.status === 'Completed' || a.status === 'Disbursed')
                .reduce((sum, a) => sum + (Number(a.amount_approved) || Number(a.amount_requested) || 0), 0);

            const elDisbursed = document.getElementById('statDisbursedFunds');
            if (elDisbursed) {
                if (totalDisbursed >= 1000000) {
                    elDisbursed.textContent = `₱${(totalDisbursed / 1000000).toFixed(2)}M`;
                } else if (totalDisbursed > 0) {
                    elDisbursed.textContent = formatCurrency(totalDisbursed);
                } else {
                    elDisbursed.textContent = '₱0.00';
                }
            }

            const totalBudget = programs.reduce((sum, p) => sum + (Number(p.budget) || Number(p.budget_allocated) || 0), 0);
            const elTotalApprop = document.getElementById('statTotalAppropriation');
            if (elTotalApprop) {
                elTotalApprop.textContent = totalBudget >= 1000000
                    ? `₱${(totalBudget / 1000000).toFixed(2)}M`
                    : formatCurrency(totalBudget);
            }

            // 3. REQ063: Fund & Resource Distribution Table
            const tbody = document.getElementById('dashFundDistributionTableBody');
            const totalBudgetBadge = document.getElementById('dashTotalBudgetBadge');

            if (tbody) {
                let totalAllocated = 0;
                if (programs.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3 text-muted">No programs registered in database.</td></tr>';
                } else {
                    tbody.innerHTML = programs.map(prog => {
                        const progCode = prog.code || '';
                        const progName = prog.name || progCode;
                        const allocated = Number(prog.budget) || Number(prog.budget_allocated) || 0;
                        totalAllocated += allocated;

                        const progApps = applications.filter(a => 
                            (a.program_id === prog.id || (a.program && a.program.code === progCode)) &&
                            (a.status === 'Released' || a.status === 'Completed' || a.status === 'Disbursed')
                        );
                        let spent = progApps.reduce((sum, a) => sum + (Number(a.amount_approved) || Number(a.amount_requested) || 0), 0);
                        if (spent === 0 && prog.status === 'Active') {
                            spent = Math.round(allocated * ((prog.slots_filled || 1) / (prog.slots_target || 1)));
                        } else if (prog.status === 'Completed') {
                            spent = allocated;
                        }
                        const remaining = Math.max(0, allocated - spent);
                        const utilPercent = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0;
                        const slotsInfo = `${prog.slots_filled || 0} / ${prog.slots_target || 100} Slots`;

                        return `
                            <tr>
                                <td>
                                    <div class="fw-bold text-dark">${escapeHtml(progCode)}</div>
                                    <small class="text-muted text-truncate d-inline-block" style="max-width: 220px;">${escapeHtml(progName)}</small>
                                </td>
                                <td class="fw-semibold">₱${allocated.toLocaleString('en-PH', { minimumFractionDigits: 0 })}</td>
                                <td class="text-danger fw-semibold">₱${spent.toLocaleString('en-PH', { minimumFractionDigits: 0 })}</td>
                                <td class="text-success fw-semibold">₱${remaining.toLocaleString('en-PH', { minimumFractionDigits: 0 })}</td>
                                <td><span class="badge bg-light text-dark border font-monospace">${slotsInfo}</span></td>
                                <td>
                                    <div class="d-flex align-items-center gap-2">
                                        <div class="progress flex-grow-1" style="height: 6px; width: 60px;">
                                            <div class="progress-bar ${utilPercent >= 80 ? 'bg-danger' : (utilPercent >= 50 ? 'bg-primary' : 'bg-info')}" role="progressbar" style="width: ${utilPercent}%"></div>
                                        </div>
                                        <small class="fw-bold">${utilPercent}%</small>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }

                if (totalBudgetBadge) {
                    totalBudgetBadge.textContent = totalAllocated >= 1000000 
                        ? `Budget: ₱${(totalAllocated / 1000000).toFixed(2)}M` 
                        : `Budget: ₱${totalAllocated.toLocaleString('en-PH')}`;
                }
            }

            // 4. REQ065: Interview Activity Summary
            const totalSched = schedules.length;
            const completedSched = schedules.filter(s => s.status === 'Completed' || s.attendance === 'Present').length;
            const pendingSched = schedules.filter(s => s.status === 'Pending' || s.attendance === 'Unmarked' || !s.attendance).length;
            const missedSched = schedules.filter(s => s.status === 'Missed' || s.attendance === 'Absent').length;

            if (document.getElementById('dashSchedCount')) document.getElementById('dashSchedCount').textContent = totalSched;
            if (document.getElementById('dashCompletedCount')) document.getElementById('dashCompletedCount').textContent = completedSched;
            if (document.getElementById('dashPendingSchedCount')) document.getElementById('dashPendingSchedCount').textContent = pendingSched;
            if (document.getElementById('dashMissedCount')) document.getElementById('dashMissedCount').textContent = missedSched;

        } catch (err) {
            console.warn('[PesoDashboard] Error updating officer metrics:', err.message);
        }
    }

    /**
     * Render Chart.js analytics for PESO Portals
     */
    function renderDashboardCharts(programs = [], applications = []) {
        const canvas = document.getElementById('appTrendChart') || document.getElementById('adminOverviewChart') || document.getElementById('pesoOverviewChart');
        if (!canvas || typeof Chart === 'undefined') return;

        try {
            if (_chartInstance) {
                _chartInstance.destroy();
                _chartInstance = null;
            }

            const isDark = document.body.classList.contains('dark-mode');
            const textColor = isDark ? '#94A3B8' : '#64748B';
            const gridColor = isDark ? '#334155' : '#E2E8F0';

            const activeProgs = programs.slice(0, 6);
            const labels = activeProgs.map(p => p.code || p.name || 'Program');
            const budgetData = activeProgs.map(p => (Number(p.budget) || Number(p.budget_allocated) || 0) / 1000); // In thousands

            const ctx = canvas.getContext('2d');
            _chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels.length > 0 ? labels : ['SPES', 'TUPAD', 'GIP', 'SEED', 'DILEEP', 'PFAS'],
                    datasets: [{
                        label: 'Budget Allocation (₱ in Thousands)',
                        data: budgetData.length > 0 ? budgetData : [1200, 2500, 800, 1500, 1000, 650],
                        backgroundColor: '#0284C7',
                        borderRadius: 6,
                        barPercentage: 0.6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: textColor, font: { family: 'Outfit', weight: '600' } }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: textColor },
                            grid: { color: gridColor }
                        },
                        y: {
                            ticks: { color: textColor },
                            grid: { color: gridColor }
                        }
                    }
                }
            });
        } catch (err) {
            console.warn('[PesoDashboard] Chart render error:', err.message);
        }
    }

    /**
     * Render real-time activity feed in Admin Portal
     */
    function renderActivityFeed(auditLogs = []) {
        const container = document.getElementById('dashboardActivityFeedList') || document.getElementById('recentActivityFeed');
        if (!container) return;

        if (!auditLogs || auditLogs.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-clock-history fs-3 d-block mb-1"></i>
                    No recent admin activity recorded.
                </div>
            `;
            return;
        }

        const recent = auditLogs.slice(0, 8);
        container.innerHTML = recent.map(log => {
            const timeStr = log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
            return `
                <div class="activity-feed-item p-2 mb-2 rounded bg-light border">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="fw-bold text-dark font-monospace" style="font-size: 0.82rem;">${escapeHtml(log.action_type || log.action || 'ACTIVITY')}</span>
                        <small class="text-muted font-monospace">${escapeHtml(timeStr)}</small>
                    </div>
                    <p class="small text-muted mb-0 text-truncate">${escapeHtml(log.details || log.description || 'System operation executed')}</p>
                </div>
            `;
        }).join('');
    }

    return Object.freeze({
        renderAdminMetrics,
        renderOfficerMetrics,
        renderDashboardCharts,
        renderActivityFeed
    });
})();

window.PesoDashboard = PesoDashboard;

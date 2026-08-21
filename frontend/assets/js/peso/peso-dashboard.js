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
    function renderAdminMetrics(programs = [], applications = [], beneficiaries = [], funds = []) {
        try {
            const activePrograms = programs.filter(p => p.status === 'Active');
            const archivedPrograms = programs.filter(p => p.status !== 'Active');
            const totalBudget = programs.reduce((sum, p) => sum + (Number(p.budget) || Number(p.budget_allocated) || 0), 0);
            
            const pendingEval = applications.filter(a => a.status === 'Pending' || a.status === 'Under Review');
            const approvedEval = applications.filter(a => a.status === 'Approved' || a.status === 'Officer Approved');

            // 1. Program Count KPIs
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

            const elTotalBudget = document.getElementById('statTotalBudget');
            if (elTotalBudget) elTotalBudget.textContent = formatCurrency(totalBudget);

            const elOrdApprop = document.getElementById('ordinanceTotalAppropriation');
            if (elOrdApprop) elOrdApprop.textContent = formatCurrency(totalBudget);

            // 2. Evaluation Badge KPIs
            const elEvalBadge = document.getElementById('evalTabBadge');
            if (elEvalBadge) elEvalBadge.textContent = pendingEval.length;

            // 3. Render Chart Trends
            renderDashboardCharts(programs, applications);

        } catch (err) {
            console.warn('[PesoDashboard] Error updating admin metrics:', err.message);
        }
    }

    /**
     * Compute and render overview KPI metrics for PESO Officer
     */
    function renderOfficerMetrics(programs = [], applications = [], beneficiaries = [], schedules = []) {
        try {
            const pendingEval = applications.filter(a => a.status === 'Pending' || a.status === 'Under Review');
            const approvedEval = applications.filter(a => a.status === 'Approved' || a.status === 'Officer Approved');

            // 1. Stat cards
            const elPending = document.getElementById('statPendingEval');
            if (elPending) elPending.textContent = pendingEval.length;

            const elApproved = document.getElementById('statApprovedEval');
            if (elApproved) elApproved.textContent = approvedEval.length;

            const elAssigned = document.getElementById('statAssignedBen');
            if (elAssigned) elAssigned.textContent = beneficiaries.length;

            // 2. Disbursed Funds
            const totalDisbursed = applications
                .filter(a => a.status === 'Approved' || a.status === 'Officer Approved' || a.status === 'Disbursed')
                .reduce((sum, a) => sum + (Number(a.amount_approved) || Number(a.amount_requested) || 0), 0);

            const elDisbursed = document.getElementById('statDisbursedFunds');
            if (elDisbursed) {
                if (totalDisbursed >= 1000000) {
                    elDisbursed.textContent = `₱${(totalDisbursed / 1000000).toFixed(2)}M`;
                } else {
                    elDisbursed.textContent = formatCurrency(totalDisbursed);
                }
            }

            // 3. Fund Distribution Table
            const tbody = document.getElementById('dashFundDistributionTableBody');
            const totalBudgetBadge = document.getElementById('dashTotalBudgetBadge');

            if (tbody) {
                let totalAllocated = 0;
                if (programs.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-muted">No programs registered in database.</td></tr>';
                } else {
                    tbody.innerHTML = programs.map(prog => {
                        const progCode = prog.code || '';
                        const progName = prog.name || progCode;
                        const allocated = Number(prog.budget) || Number(prog.budget_allocated) || 0;
                        totalAllocated += allocated;

                        const progApps = applications.filter(a => 
                            (a.program_id === prog.id || (a.program && a.program.code === progCode)) &&
                            (a.status === 'Approved' || a.status === 'Officer Approved' || a.status === 'Disbursed')
                        );
                        const spent = progApps.reduce((sum, a) => sum + (Number(a.amount_approved) || Number(a.amount_requested) || 0), 0);
                        const remaining = Math.max(0, allocated - spent);

                        return `
                            <tr>
                                <td class="fw-semibold">${escapeHtml(progCode)} (${escapeHtml(progName)})</td>
                                <td>₱${allocated.toLocaleString('en-PH', { minimumFractionDigits: 0 })}</td>
                                <td class="text-danger">₱${spent.toLocaleString('en-PH', { minimumFractionDigits: 0 })}</td>
                                <td class="text-success">₱${remaining.toLocaleString('en-PH', { minimumFractionDigits: 0 })}</td>
                            </tr>
                        `;
                    }).join('');
                }

                if (totalBudgetBadge) {
                    totalBudgetBadge.textContent = totalAllocated >= 1000000 
                        ? `Budget: ₱${(totalAllocated / 1000000).toFixed(1)}M` 
                        : `Budget: ₱${totalAllocated.toLocaleString('en-PH')}`;
                }
            }

            // 4. Interview Activity Summary
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
        const canvas = document.getElementById('adminOverviewChart') || document.getElementById('pesoOverviewChart');
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
                    labels: labels.length > 0 ? labels : ['SPES', 'TUPAD', 'GIP', 'SEED', 'DILEEP'],
                    datasets: [{
                        label: 'Budget Allocation (PHP in Thousands)',
                        data: budgetData.length > 0 ? budgetData : [1200, 2500, 800, 1500, 1000],
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
        const container = document.getElementById('recentActivityFeed');
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
                <div class="activity-feed-item">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="fw-bold text-dark" style="font-size: 0.85rem;">${escapeHtml(log.action_type || log.action || 'ACTIVITY')}</span>
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

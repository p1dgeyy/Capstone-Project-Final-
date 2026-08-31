/**
 * PESO Admin - Resource & Equipment Monitoring Module (peso-admin-resources.js)
 */
    // =========================================================================
    // 9. MODULE 7: RESOURCE AND ASSISTANCE MODULE (CONSOLIDATED OFFICER SYNC)
    // =========================================================================
    let resourceCategoryChartInstance = null;
    let resourceTrendChartInstance = null;

    function getConsolidatedResourcesList() {
        const list = [];
        let idCounter = 1;

        // Map directly from AdminStore.approvedAssistance
        (AdminStore.approvedAssistance || []).forEach(a => {
            const ben = a.beneficiary || {};
            const firstName = ben.first_name || '';
            const lastName = ben.last_name || '';
            const fullName = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : (ben.name || a.beneficiaryName || a.beneficiary_name || 'Beneficiary');
            const qtyStr = typeof a.quantity_amount === 'number' ? formatCurrency(a.quantity_amount) : (a.quantity_amount || '₱5,000.00');
            const assistType = a.assistance_type || a.item || 'Livelihood Assistance Grant';
            let cat = 'Cash Grant';
            if (assistType.toLowerCase().includes('kit') || assistType.toLowerCase().includes('equipment') || assistType.toLowerCase().includes('tool')) {
                cat = 'Equipment Starter Kit';
            } else if (assistType.toLowerCase().includes('material') || assistType.toLowerCase().includes('supply') || assistType.toLowerCase().includes('feed')) {
                cat = 'Livelihood Materials';
            } else if (assistType.toLowerCase().includes('seed') || assistType.toLowerCase().includes('fertilizer') || assistType.toLowerCase().includes('consumable')) {
                cat = 'Consumables';
            }

            list.push({
                id: a.id || idCounter++,
                qr: a.beneficiary_qr || ben.qr_code || `QR-BEN-${idCounter}`,
                name: fullName,
                phone: ben.phone || a.phone || '09XX-***-XXXX',
                prog: a.program?.code || a.program_code || a.programCode || 'PESO',
                batch: a.batch_num || a.batch?.name || 'Batch 1',
                type: assistType,
                category: cat,
                qty: qtyStr,
                date: (a.approval_date || a.release_date || a.created_at || new Date().toISOString()).substring(0, 10),
                officer: a.officer ? `${a.officer.first_name || ''} ${a.officer.last_name || ''}`.trim() : (a.officerName || 'PESO Officer'),
                voucher: a.voucher_number || a.reference_number || `VCH-2026-${1000 + idCounter}`
            });
        });

        // Also check if any approved applications with grant releases are not yet in approvedAssistance list
        (AdminStore.applications || []).filter(app => app.status === 'Released' || app.status === 'Disbursed').forEach(app => {
            const alreadyInList = list.some(item => item.qr === (app.beneficiary_qr || (app.beneficiary && app.beneficiary.qr_code)));
            if (!alreadyInList) {
                const ben = app.beneficiary || {};
                const fullName = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || ben.name || app.applicant_name || 'Beneficiary';
                list.push({
                    id: idCounter++,
                    qr: app.beneficiary_qr || ben.qr_code || `QR-BEN-${idCounter}`,
                    name: fullName,
                    phone: ben.phone || '09XX-***-XXXX',
                    prog: app.program?.code || app.program_code || 'PESO',
                    batch: app.batch?.name || 'Batch 1',
                    type: `${app.program?.name || 'Program'} Grant Package`,
                    category: 'Equipment Starter Kit',
                    qty: formatCurrency(app.amount_approved || 5000),
                    date: (app.updated_at || app.created_at || new Date().toISOString()).substring(0, 10),
                    officer: app.officer ? `${app.officer.first_name || ''} ${app.officer.last_name || ''}`.trim() : 'PESO Officer',
                    voucher: `VCH-2026-${1000 + idCounter}`
                });
            }
        });

        return list;
    }

    function renderResourcesModule() {
        const resources = getConsolidatedResourcesList();
        const search = (document.getElementById('resourceSearchInput')?.value || '').toLowerCase();
        const catF = document.getElementById('resourceCategoryFilter')?.value || 'ALL';
        const progF = document.getElementById('resourceProgramFilter')?.value || 'ALL';

        // Populate Program Filter if empty
        const progSelect = document.getElementById('resourceProgramFilter');
        if (progSelect && progSelect.options.length <= 1) {
            progSelect.innerHTML = '<option value="ALL">All Programs</option>' +
                (AdminStore.programs || []).map(p => `<option value="${p.code || p.id}">${escapeHtml(p.name)} (${p.code})</option>`).join('');
        }

        const filtered = resources.filter(r => {
            const str = `${r.name} ${r.qr} ${r.type} ${r.officer} ${r.voucher}`.toLowerCase();
            const matchesSearch = !search || str.includes(search);
            const matchesCat = catF === 'ALL' || r.category === catF;
            const matchesProg = progF === 'ALL' || r.prog === progF;
            return matchesSearch && matchesCat && matchesProg;
        });

        // 1. Update Summary Metric Cards
        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        const starterKitsCount = resources.filter(r => r.category === 'Equipment Starter Kit').length;
        const materialsCount = resources.filter(r => r.category === 'Livelihood Materials' || r.category === 'Consumables').length;
        const uniqueBens = new Set(resources.map(r => r.qr)).size;

        setTxt('resStatTotalResources', resources.length);
        setTxt('resStatStarterKits', starterKitsCount);
        setTxt('resStatMaterials', materialsCount);
        setTxt('resStatBensServed', uniqueBens);
        setTxt('resourcesTabBadge', resources.length);

        // 2. Render Charts
        initResourceMonitoringCharts(resources);

        // 3. Render Table Body
        const tbody = document.getElementById('resourcesConsolidatedTableBody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No consolidated resource records matching filter criteria.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(r => {
            let catBadge = 'bg-primary-subtle text-primary border border-primary-subtle';
            if (r.category === 'Equipment Starter Kit') catBadge = 'bg-success-subtle text-success border border-success-subtle';
            else if (r.category === 'Livelihood Materials') catBadge = 'bg-warning-subtle text-dark border border-warning-subtle';
            else if (r.category === 'Consumables') catBadge = 'bg-info-subtle text-info border border-info-subtle';

            return `
                <tr>
                    <td>
                        <div class="fw-bold text-dark">${escapeHtml(r.name)}</div>
                        <small class="text-muted font-monospace"><i class="bi bi-qr-code me-1"></i>${escapeHtml(r.qr)}</small>
                    </td>
                    <td>
                        <span class="badge bg-light text-dark border font-monospace">${escapeHtml(r.prog)}</span>
                        <small class="text-muted d-block">${escapeHtml(r.batch)}</small>
                    </td>
                    <td>
                        <div class="fw-semibold text-dark text-truncate" style="max-width: 220px;" title="${escapeHtml(r.type)}">${escapeHtml(r.type)}</div>
                        <small class="text-muted font-monospace"><i class="bi bi-receipt me-1"></i>${escapeHtml(r.voucher)}</small>
                    </td>
                    <td>
                        <span class="badge ${catBadge} px-2.5 py-1">${escapeHtml(r.category)}</span>
                    </td>
                    <td>
                        <strong class="text-success font-monospace">${escapeHtml(r.qty)}</strong>
                    </td>
                    <td>
                        <small class="text-dark fw-semibold"><i class="bi bi-calendar3 me-1 text-muted"></i>${formatDate(r.date)}</small>
                    </td>
                    <td>
                        <small class="text-muted"><i class="bi bi-person-badge text-primary me-1"></i>${escapeHtml(r.officer)}</small>
                    </td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-info fw-semibold" onclick="openResourceDetailsModal(${r.id})" title="View Resource Details (Strictly Read-Only)">
                            <i class="bi bi-eye"></i> Details
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function filterResourcesTable() {
        renderResourcesModule();
    }

    function initResourceMonitoringCharts(resources) {
        // 1. Doughnut Chart: Category Distribution
        const canvasCat = document.getElementById('resourceCategoryChart');
        if (canvasCat) {
            const ctx = canvasCat.getContext('2d');
            if (ctx) {
                if (resourceCategoryChartInstance) resourceCategoryChartInstance.destroy();
                
                const cats = ['Equipment Starter Kit', 'Cash Grant', 'Livelihood Materials', 'Consumables'];
                const counts = cats.map(c => resources.filter(r => r.category === c).length);

                resourceCategoryChartInstance = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Starter Kits', 'Cash Grants', 'Materials', 'Consumables'],
                        datasets: [{
                            data: counts,
                            backgroundColor: ['#10B981', '#0284C7', '#F59E0B', '#8B5CF6'],
                            borderWidth: 2,
                            borderColor: '#ffffff'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Outfit', size: 11 } } }
                        }
                    }
                });
            }
        }

        // 2. Bar Chart: Monthly Disbursement Trend
        const canvasTrend = document.getElementById('resourceMonthlyTrendChart');
        if (canvasTrend) {
            const ctx = canvasTrend.getContext('2d');
            if (ctx) {
                if (resourceTrendChartInstance) resourceTrendChartInstance.destroy();

                const monthlyPackages = new Array(12).fill(0);
                const monthlyGrants = new Array(12).fill(0);

                (resources || []).forEach(r => {
                    const dStr = r.date || r.created_at;
                    if (!dStr) return;
                    const d = new Date(dStr);
                    if (isNaN(d.getTime())) return;
                    const m = d.getMonth();
                    if (m >= 0 && m < 12) {
                        if (r.category === 'Equipment Starter Kit') monthlyPackages[m]++;
                        else if (r.category === 'Cash Grant') monthlyGrants[m]++;
                    }
                });

                resourceTrendChartInstance = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                        datasets: [{
                            label: 'Starter Packages Released',
                            data: monthlyPackages,
                            backgroundColor: 'rgba(2, 132, 199, 0.85)',
                            borderRadius: 4
                        }, {
                            label: 'Direct Cash Grants (₱)',
                            data: monthlyGrants,
                            backgroundColor: 'rgba(16, 185, 129, 0.85)',
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Outfit', size: 11 } } }
                        },
                        scales: {
                            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                            x: { grid: { display: false } }
                        }
                    }
                });
            }
        }
    }

    function openResourceDetailsModal(resourceId) {
        const resources = getConsolidatedResourcesList();
        const item = resources.find(r => r.id === resourceId);
        if (!item) return;

        const body = document.getElementById('resourceDetailsModalBody');
        if (!body) return;

        // Strictly Read-Only Modal per Rule 1
        body.innerHTML = `
            <div class="row g-3">
                <div class="col-12 col-md-6">
                    <div class="p-3 bg-light rounded-3">
                        <small class="text-muted d-block mb-1">Beneficiary Name</small>
                        <h6 class="fw-bold text-dark mb-1">${escapeHtml(item.name)}</h6>
                        <span class="badge bg-dark-subtle text-dark font-monospace">${escapeHtml(item.qr)}</span>
                        <div class="text-muted small mt-2"><i class="bi bi-telephone me-1"></i>${maskContactNumber(item.phone)}</div>
                    </div>
                </div>
                <div class="col-12 col-md-6">
                    <div class="p-3 bg-light rounded-3">
                        <small class="text-muted d-block mb-1">Program & Batch Assignment</small>
                        <h6 class="fw-bold text-primary mb-1">${escapeHtml(item.prog)}</h6>
                        <div class="text-dark small">${escapeHtml(item.batch)}</div>
                        <div class="text-muted small mt-2"><i class="bi bi-receipt me-1"></i>Voucher No: <strong>${escapeHtml(item.voucher)}</strong></div>
                    </div>
                </div>
                <div class="col-12">
                    <div class="p-3 border rounded-3 bg-white">
                        <small class="text-muted d-block mb-1">Resource / Equipment Package Details</small>
                        <h5 class="fw-bold text-dark mb-2">${escapeHtml(item.type)}</h5>
                        <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
                            <span class="badge bg-primary-subtle text-primary px-3 py-1.5 fw-bold">${escapeHtml(item.category)}</span>
                            <span class="badge bg-success-subtle text-success px-3 py-1.5 fw-bold">Released: ${escapeHtml(item.qty)}</span>
                        </div>
                    </div>
                </div>
                <div class="col-12 col-md-6">
                    <div class="p-2.5 bg-light rounded-3">
                        <small class="text-muted d-block">Release Date</small>
                        <div class="fw-semibold text-dark">${formatDate(item.date)}</div>
                    </div>
                </div>
                <div class="col-12 col-md-6">
                    <div class="p-2.5 bg-light rounded-3">
                        <small class="text-muted d-block">Releasing Officer</small>
                        <div class="fw-semibold text-dark"><i class="bi bi-person-check text-success me-1"></i>${escapeHtml(item.officer)}</div>
                    </div>
                </div>
            </div>
        `;

        openModal('resourceDetailsModal');
    }

    function exportResourcesCSV() {
        const resources = getConsolidatedResourcesList();
        const rows = [
            ['Beneficiary Name', 'Beneficiary QR', 'Contact (Masked)', 'Program Code', 'Batch', 'Resource Description', 'Category', 'Quantity / Amount', 'Release Date', 'Releasing Officer', 'Voucher Number']
        ];
        resources.forEach(r => {
            rows.push([
                r.name,
                r.qr,
                maskContactNumber(r.phone),
                r.prog,
                r.batch,
                r.type,
                r.category,
                r.qty,
                r.date,
                r.officer,
                r.voucher
            ]);
        });
        downloadCsvFile(rows, `PESO_Consolidated_Resources_${new Date().toISOString().substring(0, 10)}.csv`);
        notify('CSV Exported', `Successfully exported ${resources.length} resource records.`, 'success');
    }

    function printResourcesReport() {
        window.print();
    }


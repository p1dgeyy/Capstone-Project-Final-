/**
 * PESO Admin - Fund Allocation & Distribution Module (peso-admin-funds.js)
 */
    // =========================================================================
    // 8. MODULE 6: FUND ALLOCATION & DISTRIBUTION (REQ034-036, REQ042-046)
    // =========================================================================

    // Fetches everything this module (and the Dashboard KPI cards) reads out of
    // AdminStore. Previously nothing populated AdminStore at all -- it was only
    // ever declared in a legacy file (assets/js/peso/peso-admin.js) that is not
    // loaded by peso_admin.html -- so every AdminStore.* read silently fell back
    // to an empty array and this whole module always rendered zeros.
    async function initFundsData() {
        if (typeof DataService !== 'undefined' && window.AdminStore) {
            try {
                const [progRes, fundsRes, assistRes, batchesRes, benRes, notifRes, auditRes] = await Promise.all([
                    DataService.programs.getAll({ agency: 'PESO' }),
                    DataService.funds.getAll(),
                    DataService.approvedAssistance.getAll(),
                    DataService.batches.getAll({ simple: true }),
                    DataService.beneficiaries.getAll(),
                    (typeof DataService.notifications !== 'undefined' ? DataService.notifications.getAll({ limit: 200 }) : Promise.resolve({ data: [] })),
                    (typeof DataService.auditLogs !== 'undefined' ? DataService.auditLogs.getAll({ limit: 200 }) : Promise.resolve({ data: [] }))
                ]);
                window.AdminStore.programs = (progRes && Array.isArray(progRes.data)) ? progRes.data : [];
                window.AdminStore.funds = (fundsRes && Array.isArray(fundsRes.data)) ? fundsRes.data : [];
                window.AdminStore.approvedAssistance = (assistRes && Array.isArray(assistRes.data)) ? assistRes.data : [];
                window.AdminStore.batches = (batchesRes && Array.isArray(batchesRes.data)) ? batchesRes.data : [];
                window.AdminStore.beneficiaries = (benRes && Array.isArray(benRes.data)) ? benRes.data : [];
                window.AdminStore.notifications = (notifRes && Array.isArray(notifRes.data)) ? notifRes.data : [];
                window.AdminStore.auditLogs = (auditRes && Array.isArray(auditRes.data)) ? auditRes.data : [];
                window.AdminStore.applications = (typeof evalApplicationsList !== 'undefined' && Array.isArray(evalApplicationsList)) ? evalApplicationsList : [];
            } catch (e) {
                console.warn('[Funds] initFundsData notice:', e);
            }
        }
        if (typeof renderFundsModule === 'function') renderFundsModule();
    }
    window.initFundsData = initFundsData;

    function renderFundsModule() {
        const progs = (typeof AdminStore !== 'undefined' && Array.isArray(AdminStore.programs)) ? AdminStore.programs : [];
        const assist = (typeof AdminStore !== 'undefined' && Array.isArray(AdminStore.approvedAssistance)) ? AdminStore.approvedAssistance : [];
        const fundsList = (typeof AdminStore !== 'undefined' && Array.isArray(AdminStore.funds)) ? AdminStore.funds : [];
        let totalAllocated = 0;
        let totalDisbursed = 0;
        let criticalPrograms = [];

        // 1. Compute Totals & Check Low Balance Threshold (< 10% remaining) directly from funds.released_amount
        progs.forEach(p => {
            const fund = fundsList.find(f => f.program_code === p.code || f.program === p.name || f.program_id === p.id);
            const b = fund ? (Number(fund.allocated_budget) || 0) : (Number(p.budget) || 0);
            totalAllocated += b;
            const d = fund ? (Number(fund.released_amount) || 0) : (
                assist.filter(a => a.program_id === p.id || a.program_code === p.code || (a.program && a.program.code === p.code))
                    .reduce((s, i) => s + (Number(String(i.quantity_amount || i.amount_approved || 0).replace(/[^0-9.]/g, '')) || 0), 0)
            );
            totalDisbursed += d;
            const remaining = fund && fund.remaining_balance !== undefined ? Math.max(0, Number(fund.remaining_balance)) : Math.max(0, b - d);
            const pct = b > 0 ? Math.round((d / b) * 100) : 0;
            if (b > 0 && (remaining < b * 0.10 || pct >= 90)) {
                criticalPrograms.push({ name: p.name, code: p.code, remaining, pct });
            }
        });

        const totalRemaining = Math.max(0, totalAllocated - totalDisbursed);
        const overallPct = totalAllocated > 0 ? Math.round((totalDisbursed / totalAllocated) * 100) : 0;

        // 2. Update Live Budget Monitoring Metric Cards (REQ034)
        const elAppr = document.getElementById('statFundApprovedBudget');
        if (elAppr) elAppr.textContent = formatCurrency(totalAllocated);
        const elUtil = document.getElementById('statFundUtilizedBalance');
        if (elUtil) elUtil.textContent = formatCurrency(totalDisbursed);
        const elRem = document.getElementById('statFundRemainingBalance');
        if (elRem) elRem.textContent = formatCurrency(totalRemaining);
        const elPct = document.getElementById('statFundPercentUtilized');
        if (elPct) elPct.textContent = `${overallPct}%`;

        // 3. Update Overflow / Low Remaining Balance Alert Box (< 10% Remaining Balance Notice)
        const alertBox = document.getElementById('fundOverflowAlertBox');
        const alertText = document.getElementById('fundOverflowAlertText');
        if (alertBox) {
            if (criticalPrograms.length > 0) {
                alertBox.classList.remove('d-none');
                if (alertText) {
                    alertText.innerHTML = `Critical Budget Warning: The following programs have less than 10% remaining balance or &ge; 90% utilization: <strong>${criticalPrograms.map(c => `${escapeHtml(c.code)} (${formatCurrency(c.remaining)} remaining, ${c.pct}% used)`).join(', ')}</strong>. Review allocations before approving further assistance grants.`;
                }
            } else {
                alertBox.classList.add('d-none');
            }
        }

        // 4. Render Program Budget Allocations & Remaining Balances Table
        const tbody = document.getElementById('programFundsTableBody');
        if (tbody) {
            if (progs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No livelihood programs registered in system.</td></tr>';
            } else {
                tbody.innerHTML = progs.map(p => {
                    const fund = fundsList.find(f => f.program_code === p.code || f.program === p.name || f.program_id === p.id);
                    const budget = fund ? (Number(fund.allocated_budget) || 0) : (Number(p.budget) || 0);
                    const disbursed = fund ? (Number(fund.released_amount) || 0) : (
                        assist.filter(a => a.program_id === p.id || a.program_code === p.code || (a.program && a.program.code === p.code))
                            .reduce((s, i) => s + (Number(String(i.quantity_amount || i.amount_approved || 0).replace(/[^0-9.]/g, '')) || 0), 0)
                    );
                    const remaining = fund && fund.remaining_balance !== undefined ? Math.max(0, Number(fund.remaining_balance)) : Math.max(0, budget - disbursed);
                    const pct = budget > 0 ? Math.round((disbursed / budget) * 100) : 0;

                    // Budget Verification Status: Available, Pending Verification, Unavailable
                    let verificationBadge = '';
                    if (budget === 0 || remaining === 0) {
                        verificationBadge = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle px-2.5 py-1 font-monospace"><i class="bi bi-x-octagon-fill me-1"></i>Unavailable</span>';
                    } else if (remaining < budget * 0.15 || pct >= 85) {
                        verificationBadge = '<span class="badge bg-warning-subtle text-warning border border-warning-subtle px-2.5 py-1 font-monospace"><i class="bi bi-hourglass-split me-1"></i>Pending Verification</span>';
                    } else {
                        verificationBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1 font-monospace"><i class="bi bi-check-circle-fill me-1"></i>Available</span>';
                    }

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
                                        <div class="progress-bar ${pct >= 90 ? 'bg-danger' : (pct >= 70 ? 'bg-warning' : 'bg-success')}" style="width: ${Math.min(100, pct)}%;"></div>
                                    </div>
                                    <span class="small font-monospace">${pct}%</span>
                                </div>
                            </td>
                            <td class="text-center">${verificationBadge}</td>
                            <td class="text-end text-nowrap">
                                <button class="btn btn-sm btn-outline-primary fw-semibold px-2.5" onclick="quickEditFund(${p.id}, ${budget})" title="Edit Program Budget">
                                    <i class="bi bi-pencil-square me-1"></i>Edit
                                </button>
                                <button class="btn btn-sm btn-outline-secondary fw-semibold px-2.5 ms-1" onclick="viewProgramFundBreakdown(${p.id})" title="View Batch & Beneficiary Breakdown (REQ036)">
                                    <i class="bi bi-diagram-3 me-1"></i>Breakdown
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // 5. Render Batch & Beneficiary Budget Breakdown (REQ036)
        renderFundBreakdown();

        // 6. Render Distribution Logs
        const distTbody = document.getElementById('distributionLogsTableBody');
        if (distTbody) {
            if (assist.length === 0) {
                distTbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No distribution records recorded yet.</td></tr>';
            } else {
                distTbody.innerHTML = assist.map(a => {
                    const ben = a.beneficiary || {};
                    const fullName = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || a.beneficiary_qr;
                    const officerName = a.officer ? `${a.officer.first_name || ''} ${a.officer.last_name || ''}`.trim() : 'Officer';
                    const progCode = a.program?.code || a.program_code || 'PESO';
                    const amount = a.quantity_amount || a.amount_approved || a.amount || '0';
                    const formattedAmount = (typeof amount === 'number' || !isNaN(parseFloat(amount))) ? formatCurrency(amount) : escapeHtml(amount);

                    return `
                        <tr>
                            <td>
                                <div class="fw-bold text-dark">${escapeHtml(fullName)}</div>
                                <small class="text-muted font-monospace">${escapeHtml(a.beneficiary_qr || 'QR-BEN')}</small>
                            </td>
                            <td><span class="badge bg-light text-dark font-monospace border">${escapeHtml(progCode)}</span></td>
                            <td><span class="badge badge-category badge-livelihood">${escapeHtml(a.assistance_type || 'Livelihood Grant')}</span></td>
                            <td class="fw-bold text-success">${formattedAmount}</td>
                            <td>${formatDate(a.approval_date || a.release_date || a.created_at)}</td>
                            <td><small class="text-muted"><i class="bi bi-person-check me-1"></i>${escapeHtml(officerName)}</small></td>
                            <td><small class="text-muted">${escapeHtml(a.conditions || 'Approved by PESO Admin')}</small></td>
                            <td class="text-center">
                                <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1"><i class="bi bi-receipt me-1"></i>Signed Voucher</span>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
    }

    // =========================================================================
    // BATCH & BENEFICIARY BUDGET BREAKDOWN ENGINE (REQ036 - READ-ONLY)
    // =========================================================================
    function renderFundBreakdown() {
        const progSelect = document.getElementById('fundBreakdownProgSelect');
        const batchSelect = document.getElementById('fundBreakdownBatchSelect');
        const tbody = document.getElementById('fundBreakdownTableBody');
        const summaryLabel = document.getElementById('breakdownFilterLabel');
        const totalAllocEl = document.getElementById('breakdownTotalAllocated');
        const totalRecEl = document.getElementById('breakdownTotalReceived');
        const totalRemEl = document.getElementById('breakdownTotalRemaining');

        if (!tbody) return;

        // 1. Populate Program Filter Dropdown if empty
        if (progSelect && progSelect.options.length <= 1) {
            const currentVal = progSelect.value || 'ALL';
            progSelect.innerHTML = '<option value="ALL">All PESO Programs</option>' +
                AdminStore.programs.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${p.code})</option>`).join('');
            progSelect.value = currentVal;
        }

        const selectedProgId = progSelect ? progSelect.value : 'ALL';

        // 2. Populate Batch Filter Dropdown based on selected program
        if (batchSelect) {
            const currentBatchVal = batchSelect.value || 'ALL';
            let batchesForProg = AdminStore.batches;
            if (selectedProgId !== 'ALL') {
                const pid = parseInt(selectedProgId);
                batchesForProg = AdminStore.batches.filter(b => b.program_id === pid);
            }
            batchSelect.innerHTML = '<option value="ALL">All Batches</option>' +
                batchesForProg.map(b => `<option value="${b.id}">${escapeHtml(b.name || `Batch #${b.id}`)}</option>`).join('');
            if (batchesForProg.some(b => String(b.id) === currentBatchVal)) {
                batchSelect.value = currentBatchVal;
            } else {
                batchSelect.value = 'ALL';
            }
        }

        const selectedBatchId = batchSelect ? batchSelect.value : 'ALL';

        // 3. Filter Applications & Disbursed Beneficiary Grants
        let filteredApps = AdminStore.applications;
        if (selectedProgId !== 'ALL') {
            const pid = parseInt(selectedProgId);
            filteredApps = filteredApps.filter(a => a.program_id === pid || (a.program && a.program.id === pid));
        }
        if (selectedBatchId !== 'ALL') {
            const bid = parseInt(selectedBatchId);
            filteredApps = filteredApps.filter(a => a.batch_id === bid);
        }

        // Calculate Breakdown Totals
        let sumAllocated = 0;
        let sumReceived = 0;

        if (selectedProgId !== 'ALL') {
            const targetProg = AdminStore.programs.find(p => p.id === parseInt(selectedProgId));
            sumAllocated = targetProg ? Number(targetProg.budget) || 0 : 0;
        } else {
            sumAllocated = AdminStore.programs.reduce((s, p) => s + (Number(p.budget) || 0), 0);
        }

        const rows = filteredApps.map(a => {
            const ben = a.beneficiary || AdminStore.beneficiaries.find(b => b.qr_code === a.beneficiary_qr) || {};
            const fullName = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || ben.name || a.beneficiary_qr || 'Beneficiary';
            const maskedContact = maskContactNumber(ben.contact_number || ben.phone || a.contact_number);
            const prog = AdminStore.programs.find(p => p.id === a.program_id) || a.program || { code: a.program_code || 'PESO', name: 'Livelihood Program' };
            const batchObj = AdminStore.batches.find(b => b.id === a.batch_id);
            const batchName = batchObj ? batchObj.name : 'General Batch';

            const assistRecord = AdminStore.approvedAssistance.find(as => as.beneficiary_qr === a.beneficiary_qr && (as.program_id === a.program_id || as.program_code === a.program_code));
            const approvedAmount = Number(a.amount_approved || a.quantity_amount || (assistRecord ? assistRecord.quantity_amount : 0) || 5000);
            const isReleased = a.status === 'Completed' || a.status === 'Released' || a.status === 'Disbursed' || !!assistRecord;
            const receivedAmount = isReleased ? approvedAmount : 0;
            const balanceAmount = Math.max(0, approvedAmount - receivedAmount);

            sumReceived += receivedAmount;

            let statusBadge = '';
            if (isReleased) {
                statusBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-check-circle-fill me-1"></i>Released / Completed</span>';
            } else if (a.status === 'Approved' || a.status === 'Officer Approved') {
                statusBadge = '<span class="badge bg-primary-subtle text-primary border border-primary-subtle"><i class="bi bi-clock-history me-1"></i>Pending Release</span>';
            } else {
                statusBadge = `<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle">${escapeHtml(a.status || 'Under Review')}</span>`;
            }

            return `
                <tr>
                    <td>
                        <div class="fw-bold text-dark">${escapeHtml(fullName)}</div>
                        <small class="text-muted"><i class="bi bi-telephone me-1"></i>${escapeHtml(maskedContact)}</small>
                    </td>
                    <td><span class="badge bg-light text-dark font-monospace border">${escapeHtml(a.beneficiary_qr || 'QR-BEN')}</span></td>
                    <td>
                        <span class="badge bg-primary-subtle text-primary font-monospace me-1">${escapeHtml(prog.code)}</span>
                        <small class="text-muted">${escapeHtml(batchName)}</small>
                    </td>
                    <td><span class="badge badge-category badge-livelihood">${escapeHtml(a.assistance_type || prog.assistance_type || 'Direct Grant')}</span></td>
                    <td class="fw-bold text-dark font-monospace">${formatCurrency(approvedAmount)}</td>
                    <td class="fw-bold text-success font-monospace">${formatCurrency(receivedAmount)}</td>
                    <td class="fw-bold text-primary font-monospace">${formatCurrency(balanceAmount)}</td>
                    <td class="text-center">${statusBadge}</td>
                </tr>
            `;
        });

        // 4. Update Summary Bar
        if (summaryLabel) {
            let labelText = 'All Active Programs';
            if (selectedProgId !== 'ALL') {
                const targetProg = AdminStore.programs.find(p => p.id === parseInt(selectedProgId));
                labelText = targetProg ? targetProg.name : 'Selected Program';
            }
            if (selectedBatchId !== 'ALL') {
                const targetBatch = AdminStore.batches.find(b => b.id === parseInt(selectedBatchId));
                if (targetBatch) labelText += ` — ${targetBatch.name}`;
            }
            summaryLabel.textContent = labelText;
        }

        if (totalAllocEl) totalAllocEl.textContent = formatCurrency(sumAllocated);
        if (totalRecEl) totalRecEl.textContent = formatCurrency(sumReceived);
        if (totalRemEl) totalRemEl.textContent = formatCurrency(Math.max(0, sumAllocated - sumReceived));

        // 5. Update Table Body
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No beneficiary breakdown records found for the selected filter.</td></tr>';
        } else {
            tbody.innerHTML = rows.join('');
        }
    }

    function viewProgramFundBreakdown(progId) {
        const progSelect = document.getElementById('fundBreakdownProgSelect');
        if (progSelect) {
            progSelect.value = String(progId);
            renderFundBreakdown();
        }
        const breakdownCard = document.getElementById('fundBreakdownTable');
        if (breakdownCard) {
            breakdownCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function openFundAllocationModal() {
        const progSelect = document.getElementById('fundAllocProgSelect');
        if (progSelect) {
            progSelect.innerHTML = AdminStore.programs.map(p => `<option value="${p.id}" data-budget="${p.budget}">${escapeHtml(p.name)} (${p.code}) — Current: ${formatCurrency(p.budget)}</option>`).join('');
            handleFundProgSelectionChange();
        }
        const fundInput = document.getElementById('fundAllocNewBudget');
        if (fundInput) {
            attachCurrencyInputAutoFormat(fundInput);
        }
        document.getElementById('fundAllocForm')?.reset();
        if (fundInput) fundInput.classList.remove('is-invalid');
        safeOpenModal('fundAllocationModal');
    }

    function handleFundProgSelectionChange() {
        const progSelect = document.getElementById('fundAllocProgSelect');
        const selOpt = progSelect?.selectedOptions[0];
        if (selOpt) {
            const currentBudget = selOpt.getAttribute('data-budget') || 0;
            const input = document.getElementById('fundAllocNewBudget');
            if (input) {
                attachCurrencyInputAutoFormat(input);
                input.value = formatRawCurrencyString(currentBudget, true);
                input.classList.remove('is-invalid');
            }
        }
    }

    function quickEditFund(progId, currentBudget) {
        openFundAllocationModal();
        const progSelect = document.getElementById('fundAllocProgSelect');
        if (progSelect) {
            progSelect.value = String(progId);
            handleFundProgSelectionChange();
        }
    }

    // Alias for backward compatibility
    function quickAdjustFund(progId, currentBudget) {
        quickEditFund(progId, currentBudget);
    }
    
    let _isAllocatingBudget = false;
    async function handleFundAllocationSubmit(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (_isAllocatingBudget) return;
        _isAllocatingBudget = true;

        const submitBtn = document.getElementById('saveFundAllocBtn') || (e?.target?.querySelector ? e.target.querySelector('button[type="submit"]') : null);
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving Allocation...';
        }

        try {
            const progId = parseInt(document.getElementById('fundAllocProgSelect').value);
            const budgetInput = document.getElementById('fundAllocNewBudget');
            const newBudget = parseCurrencyToNumber(budgetInput?.value);
            const justification = document.getElementById('fundAllocJustification').value.trim();

            if (!budgetInput?.value.trim() || isNaN(newBudget) || newBudget < 0.01) {
                if (budgetInput) {
                    budgetInput.classList.add('is-invalid');
                    budgetInput.focus();
                }
                return;
            }

            if (budgetInput) {
                budgetInput.value = formatRawCurrencyString(newBudget, true);
                budgetInput.classList.remove('is-invalid');
            }

            // The budget ledger lives in the `funds` table (allocated_budget), keyed
            // by program_code -- that's what checkBalance()/adminApprove() actually
            // read at approval time. `programs` has no budget column at all, so
            // writing there (the old behavior) silently failed every time.
            const p = AdminStore.programs.find(x => x.id === progId);
            if (!p) {
                notify('Update Failed', 'Could not find the selected program to allocate a budget for.', 'danger');
                return;
            }

            if (typeof DataService !== 'undefined' && DataService.funds && DataService.funds.allocateBudget) {
                const allocRes = await DataService.funds.allocateBudget(p.code, p.name, newBudget);
                if (allocRes && allocRes.error) {
                    notify('Update Failed', allocRes.error.message || 'Error saving the budget allocation to the funds ledger.', 'danger');
                    return;
                }
            }

            // Sync with in-memory store
            p.budget = newBudget;

            await logAdminAction('EDIT_PROGRAM_BUDGET', 'program', progId, `Updated allocated budget for program #${progId} to ${formatCurrency(newBudget)} (REQ035). Reason/Ordinance Ref: ${justification}`);
            notify('Budget Allocation Saved', 'Program budget allocation updated and logged to audit trail.', 'success');
            safeCloseModal('fundAllocationModal');
            await refreshAllData();
            renderFundsModule();
        } catch (err) {
            notify('Update Failed', err.message || 'Error updating program budget.', 'danger');
        } finally {
            _isAllocatingBudget = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Save Allocation';
            }
        }
    }

    function filterDistributionLogsTable() {
        const search = (document.getElementById('distribFilterSearch')?.value || '').toLowerCase();
        const progF = document.getElementById('distribFilterProg')?.value || 'ALL';
        const batchF = document.getElementById('distribFilterBatch')?.value || 'ALL';
        const fromDate = document.getElementById('distribFilterFromDate')?.value || '';
        const toDate = document.getElementById('distribFilterToDate')?.value || '';

        // Populate program and batch filter options if needed
        const progSelect = document.getElementById('distribFilterProg');
        if (progSelect && progSelect.options.length <= 1) {
            progSelect.innerHTML = '<option value="ALL">All Programs</option>' +
                (AdminStore.programs || []).map(p => `<option value="${p.code || p.id}">${escapeHtml(p.name)} (${p.code})</option>`).join('');
        }
        const batchSelect = document.getElementById('distribFilterBatch');
        if (batchSelect && batchSelect.options.length <= 1) {
            batchSelect.innerHTML = '<option value="ALL">All Batches</option>' +
                (AdminStore.batches || []).map(b => `<option value="${b.id}">${escapeHtml(b.name || `Batch #${b.id}`)}</option>`).join('');
        }

        const assist = AdminStore.approvedAssistance || [];
        const filtered = assist.filter(a => {
            const ben = a.beneficiary || {};
            const benName = `${ben.first_name || ''} ${ben.last_name || ''} ${a.beneficiary_qr || ''}`.toLowerCase();
            const matchesSearch = !search || benName.includes(search);
            const pCode = a.program?.code || a.program_code || '';
            const matchesProg = progF === 'ALL' || pCode === progF || String(a.program_id) === progF;
            const matchesBatch = batchF === 'ALL' || String(a.batch_id) === batchF;
            const relDate = (a.approval_date || a.release_date || a.created_at || '').substring(0, 10);
            const matchesFrom = !fromDate || relDate >= fromDate;
            const matchesTo = !toDate || relDate <= toDate;
            return matchesSearch && matchesProg && matchesBatch && matchesFrom && matchesTo;
        });

        const tbody = document.getElementById('distributionLogsTableBody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No distribution records matching filter parameters.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(a => {
            const ben = a.beneficiary || {};
            const fullName = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || a.beneficiary_qr;
            const officerName = a.officer ? `${a.officer.first_name || ''} ${a.officer.last_name || ''}`.trim() : 'Officer Elena Santos';
            const progCode = a.program?.code || a.program_code || 'PESO';
            const amount = a.quantity_amount || a.amount_approved || a.amount || '₱5,000.00';
            const formattedAmount = (typeof amount === 'number' || (!isNaN(parseFloat(amount)) && !String(amount).includes('₱'))) ? formatCurrency(amount) : escapeHtml(amount);

            return `
                <tr>
                    <td>
                        <div class="fw-bold text-dark">${escapeHtml(fullName)}</div>
                        <small class="text-muted font-monospace">${escapeHtml(a.beneficiary_qr || 'QR-BEN')}</small>
                    </td>
                    <td><span class="badge bg-light text-dark font-monospace border">${escapeHtml(progCode)}</span></td>
                    <td><span class="badge badge-category badge-livelihood">${escapeHtml(a.assistance_type || 'Livelihood Grant')}</span></td>
                    <td class="fw-bold text-success font-monospace">${formattedAmount}</td>
                    <td>${formatDate(a.approval_date || a.release_date || a.created_at)}</td>
                    <td><small class="text-muted"><i class="bi bi-person-check me-1"></i>${escapeHtml(officerName)}</small></td>
                    <td><small class="text-muted">${escapeHtml(a.conditions || 'Approved by PESO Admin')}</small></td>
                    <td class="text-center">
                        <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1"><i class="bi bi-receipt me-1"></i>Signed Voucher</span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function exportDistributionLogsCsv() {
        const rows = [
            ['Beneficiary QR', 'Beneficiary Name', 'Program Code', 'Assistance Type', 'Amount/Quantity', 'Release Date', 'Conditions', 'Signed Voucher Status']
        ];
        AdminStore.approvedAssistance.forEach(a => {
            const ben = a.beneficiary || {};
            const name = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || a.beneficiary_qr;
            rows.push([
                a.beneficiary_qr || 'QR-BEN',
                name,
                a.program?.code || a.program_code || 'PESO',
                a.assistance_type || 'Livelihood Grant',
                a.quantity_amount || a.amount_approved || a.amount || '0.00',
                a.approval_date || a.release_date || a.created_at || '',
                a.conditions || 'Approved by PESO Admin',
                'Signed Receipt Verified'
            ]);
        });
        downloadCsvFile(rows, `PESO_Assistance_Distribution_Logs_${new Date().toISOString().substring(0, 10)}.csv`);
    }

    function printDistributionLogsPdf() {
        window.print();
    }


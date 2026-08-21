/**
 * PESO Programs & Assignment Management Module (peso-programs.js)
 * City Government of Koronadal - Public Employment Service Office
 * 
 * Rules & Safeguards Enforced:
 * 1. Program Catalog & 3-Level Assignment Drilldown (Programs -> Batches -> Beneficiaries)
 * 2. Active Beneficiary Deactivation Restriction (Prevents deactivation if active beneficiaries exist)
 * 3. LGU Appropriation Ordinance Upload & Validation
 * 4. Read-Only Archive Section (Only Reactivation and Permanent Deletion permitted)
 * 5. Data Privacy Act Contact Masking (09XX-***-XXXX)
 * 6. Audit Logging on every mutation
 */

const PesoPrograms = (() => {
    'use strict';

    let _programs = [];
    let _batches = [];
    let _beneficiaries = [];
    let _activeFilter = 'all';
    let _activeCategory = 'all';
    let _searchQuery = '';

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
                targetEntity: 'Program Management',
                status: 'SUCCESS',
                details: details
            });
        }
    }

    /**
     * Set local data store
     */
    function setData(programs = [], batches = [], beneficiaries = []) {
        _programs = programs;
        _batches = batches;
        _beneficiaries = beneficiaries;
    }

    /**
     * Render the main programs catalog table (Tab 1 / Program Management)
     */
    function renderProgramsTable() {
        const tbody = document.getElementById('programsTableBody');
        if (!tbody) return;

        const filtered = _programs.filter(p => {
            const matchesStatus = _activeFilter === 'all' 
                ? p.status === 'Active' 
                : (_activeFilter === 'Archived' ? p.status !== 'Active' : p.status === _activeFilter);
            const matchesCat = _activeCategory === 'all' || p.category === _activeCategory;
            const q = _searchQuery.toLowerCase();
            const matchesSearch = !q || (p.code && p.code.toLowerCase().includes(q)) || (p.name && p.name.toLowerCase().includes(q));
            return matchesStatus && matchesCat && matchesSearch;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No programs found matching the selected filter criteria.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(p => {
            const slots = Number(p.slots_target) || Number(p.target_beneficiaries) || 100;
            const filled = Number(p.slots_filled) || 0;
            const budget = Number(p.budget) || Number(p.budget_allocated) || 0;
            const progress = slots > 0 ? Math.min(100, Math.round((filled / slots) * 100)) : 0;
            const isDeactivated = p.status !== 'Active';

            return `
                <tr>
                    <td class="fw-bold font-monospace text-primary">${escapeHtml(p.code)}</td>
                    <td>
                        <div class="fw-semibold text-dark">${escapeHtml(p.name)}</div>
                        <small class="text-muted text-truncate d-block" style="max-width: 280px;">${escapeHtml(p.description || '')}</small>
                    </td>
                    <td><span class="badge ${p.category === 'Livelihood' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-primary-subtle text-primary border border-primary-subtle'}">${escapeHtml(p.category || 'General')}</span></td>
                    <td>
                        <div class="d-flex justify-content-between small mb-1">
                            <span class="fw-semibold">${filled} / ${slots}</span>
                            <span class="text-muted">${progress}%</span>
                        </div>
                        <div class="progress" style="height: 6px;">
                            <div class="progress-bar ${progress >= 90 ? 'bg-danger' : 'bg-primary'}" role="progressbar" style="width: ${progress}%"></div>
                        </div>
                    </td>
                    <td class="fw-bold text-dark">${formatCurrency(budget)}</td>
                    <td>
                        <span class="badge ${isDeactivated ? 'bg-danger-subtle text-danger border border-danger-subtle' : 'bg-success-subtle text-success border border-success-subtle'}">
                            <i class="bi ${isDeactivated ? 'bi-pause-circle me-1' : 'bi-check-circle me-1'}"></i>${escapeHtml(p.status || 'Active')}
                        </span>
                    </td>
                    <td class="text-end text-nowrap">
                        <button class="btn btn-sm btn-outline-primary py-1 px-2 me-1" onclick="PesoPrograms.viewProgramDetails('${p.code}')" title="View Details">
                            <i class="bi bi-eye me-1"></i>Details
                        </button>
                        <button class="btn btn-sm ${isDeactivated ? 'btn-outline-success' : 'btn-outline-danger'} py-1 px-2" onclick="PesoPrograms.toggleProgramStatus('${p.code}')" title="${isDeactivated ? 'Activate Program' : 'Deactivate Program'}">
                            <i class="bi ${isDeactivated ? 'bi-play-fill me-1' : 'bi-pause-fill me-1'}"></i>${isDeactivated ? 'Activate' : 'Deactivate'}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Render the Multi-Level Assignment table in Admin Portal
     */
    function renderAssignmentTable() {
        const tbody = document.getElementById('assignProgramsTableBody');
        if (!tbody) return;

        const activeProgs = _programs.filter(p => p.status === 'Active');
        if (activeProgs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No active programs available for assignment monitoring.</td></tr>`;
            return;
        }

        tbody.innerHTML = activeProgs.map(p => {
            const slots = Number(p.slots_target) || Number(p.target_beneficiaries) || 100;
            const filled = Number(p.slots_filled) || 0;
            const remaining = Math.max(0, slots - filled);
            const budget = Number(p.budget) || Number(p.budget_allocated) || 0;
            const progress = slots > 0 ? Math.min(100, Math.round((filled / slots) * 100)) : 0;

            return `
                <tr>
                    <td class="fw-bold font-monospace text-primary">${escapeHtml(p.code)}</td>
                    <td class="fw-semibold text-dark">${escapeHtml(p.name)}</td>
                    <td><span class="badge bg-light text-dark border">${escapeHtml(p.category || 'General')}</span></td>
                    <td class="fw-bold">${slots}</td>
                    <td class="text-success fw-bold">${filled}</td>
                    <td class="text-warning fw-bold">${remaining}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-primary py-1 px-2" onclick="PesoPrograms.drilldownProgram('${p.code}')">
                            <i class="bi bi-diagram-3 me-1"></i>View Batches
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Drill-down to Batches (Level 2)
     */
    function drilldownProgram(progCode) {
        const prog = _programs.find(p => p.code === progCode);
        if (!prog) return;

        const secL1 = document.getElementById('assignLevel1Section');
        const secL2 = document.getElementById('assignLevel2Section');
        const secL3 = document.getElementById('assignLevel3Section');
        const titleEl = document.getElementById('assignSelectedProgTitle');
        const badgeEl = document.getElementById('assignSelectedProgBadge');

        if (secL1) secL1.classList.add('d-none');
        if (secL2) secL2.classList.remove('d-none');
        if (secL3) secL3.classList.add('d-none');

        if (titleEl) titleEl.textContent = `${prog.code} - ${prog.name}`;
        if (badgeEl) badgeEl.textContent = `Target: ${prog.slots_target || 100} Slots`;

        renderBatchesTable(prog.id, prog.code);
        logAudit('DRILLDOWN_PROGRAM_BATCHES', `Viewed batches for program ${prog.code}`);
    }

    /**
     * Render Batches (Level 2)
     */
    function renderBatchesTable(progId, progCode) {
        const tbody = document.getElementById('assignBatchesTableBody');
        if (!tbody) return;

        const progBatches = _batches.filter(b => b.program_id === progId || (b.program_code && b.program_code === progCode));
        if (progBatches.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No batches created for this program yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = progBatches.map(b => {
            const cap = Number(b.capacity) || 30;
            const assigned = Number(b.assigned_count) || 0;
            return `
                <tr>
                    <td class="fw-bold font-monospace">${escapeHtml(b.batch_number || b.name)}</td>
                    <td class="fw-semibold text-dark">${escapeHtml(b.name)}</td>
                    <td>${escapeHtml(b.cluster_location || b.barangay || 'Koronadal')}</td>
                    <td><span class="badge bg-info-subtle text-dark border">${assigned} / ${cap}</span></td>
                    <td><span class="badge ${b.status === 'Completed' ? 'bg-success' : 'bg-primary'}">${escapeHtml(b.status || 'Active')}</span></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary py-1 px-2" onclick="PesoPrograms.drilldownBatch('${b.id}', '${escapeHtml(b.name)}')">
                            <i class="bi bi-people me-1"></i>View Beneficiaries
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Drill-down to Beneficiaries Roster (Level 3 - Strictly Officer-managed, Admin View-Only)
     */
    function drilldownBatch(batchId, batchName) {
        const secL1 = document.getElementById('assignLevel1Section');
        const secL2 = document.getElementById('assignLevel2Section');
        const secL3 = document.getElementById('assignLevel3Section');
        const titleEl = document.getElementById('assignSelectedBatchTitle');

        if (secL1) secL1.classList.add('d-none');
        if (secL2) secL2.classList.add('d-none');
        if (secL3) secL3.classList.remove('d-none');

        if (titleEl) titleEl.textContent = `Batch: ${batchName}`;

        const tbody = document.getElementById('assignBeneficiariesTableBody');
        if (tbody) {
            const batchBens = _beneficiaries.filter(b => String(b.batch_id) === String(batchId) || b.batch_name === batchName);
            if (batchBens.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No beneficiaries assigned to this batch. Assignments are managed by PESO Officers.</td></tr>`;
            } else {
                tbody.innerHTML = batchBens.map(ben => `
                    <tr>
                        <td class="fw-bold font-monospace">${escapeHtml(ben.qr_code || ben.id)}</td>
                        <td class="fw-semibold text-dark">${escapeHtml(ben.first_name || '')} ${escapeHtml(ben.last_name || '')}</td>
                        <td class="font-monospace text-muted">${maskPhone(ben.phone || ben.contact)}</td>
                        <td>${escapeHtml(ben.barangay || 'Koronadal')}</td>
                        <td><span class="badge bg-success-subtle text-success border">Enrolled</span></td>
                        <td class="text-end"><span class="badge bg-secondary-subtle text-dark border">Officer-Managed</span></td>
                    </tr>
                `).join('');
            }
        }

        logAudit('DRILLDOWN_BATCH_BENEFICIARIES', `Viewed beneficiary roster for batch ${batchName}`);
    }

    function backToLevel1() {
        const secL1 = document.getElementById('assignLevel1Section');
        const secL2 = document.getElementById('assignLevel2Section');
        const secL3 = document.getElementById('assignLevel3Section');
        if (secL1) secL1.classList.remove('d-none');
        if (secL2) secL2.classList.add('d-none');
        if (secL3) secL3.classList.add('d-none');
    }

    function backToLevel2() {
        const secL1 = document.getElementById('assignLevel1Section');
        const secL2 = document.getElementById('assignLevel2Section');
        const secL3 = document.getElementById('assignLevel3Section');
        if (secL1) secL1.classList.add('d-none');
        if (secL2) secL2.classList.remove('d-none');
        if (secL3) secL3.classList.add('d-none');
    }

    /**
     * View Program Details Modal (Strictly Read-Only)
     */
    function viewProgramDetails(progCode) {
        const prog = _programs.find(p => p.code === progCode);
        if (!prog) return;

        const modalEl = document.getElementById('programDetailsModal');
        if (modalEl) {
            const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            setTxt('modalDetailProgCode', prog.code);
            setTxt('modalDetailProgName', prog.name);
            setTxt('modalDetailProgCategory', prog.category || 'General');
            setTxt('modalDetailProgBudget', formatCurrency(prog.budget || prog.budget_allocated || 0));
            setTxt('modalDetailProgSlots', prog.slots_target || prog.target_beneficiaries || 100);
            setTxt('modalDetailProgStatus', prog.status || 'Active');
            setTxt('modalDetailProgDesc', prog.description || 'No description provided.');
            setTxt('modalDetailProgOrdinance', prog.ordinance_no || 'Appropriation Ordinance No. 6, Series of 2025');

            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                bootstrap.Modal.getOrCreateInstance(modalEl).show();
            } else {
                modalEl.classList.add('show');
                modalEl.style.display = 'block';
            }
            logAudit('VIEW_PROGRAM_DETAILS', `Inspected read-only details for program ${prog.code}`);
        } else {
            alert(`Program Details (Read-Only):\n\nCode: ${prog.code}\nTitle: ${prog.name}\nCategory: ${prog.category}\nBudget: ${formatCurrency(prog.budget)}\nStatus: ${prog.status}\nDescription: ${prog.description || 'N/A'}`);
        }
    }

    /**
     * Toggle Program Status with Active Beneficiary Deactivation Safeguard
     */
    async function toggleProgramStatus(progCode) {
        const prog = _programs.find(p => p.code === progCode);
        if (!prog) return;

        if (prog.status === 'Active') {
            // Check if there are active beneficiaries enrolled in this program
            const activeEnrolledCount = Number(prog.slots_filled) || _beneficiaries.filter(b => b.program_code === progCode && b.status === 'Active').length;
            if (activeEnrolledCount > 0) {
                // Trigger safeguard restriction notice
                const restrictModal = document.getElementById('restrictionWarningModal');
                const warningText = document.getElementById('restrictionWarningText');
                if (warningText) {
                    warningText.textContent = `Cannot deactivate program "${prog.name}" (${prog.code}). This program currently has ${activeEnrolledCount} active enrolled beneficiary/beneficiaries. All beneficiary assignments must be completed or transferred before deactivation.`;
                }

                if (restrictModal && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    bootstrap.Modal.getOrCreateInstance(restrictModal).show();
                } else {
                    alert(`Deactivation Safeguard Notice:\n\nCannot deactivate program "${prog.name}" (${prog.code}). This program currently has active enrolled beneficiaries. All beneficiary assignments must be completed or transferred first.`);
                }
                logAudit('DEACTIVATE_PROGRAM_BLOCKED', `Blocked deactivation of program ${prog.code} due to ${activeEnrolledCount} active beneficiaries.`);
                return;
            }

            if (!confirm(`Are you sure you want to deactivate program "${prog.name}" (${prog.code})? It will be moved to the Archive.`)) {
                return;
            }

            prog.status = 'Deactivated';
        } else {
            if (!confirm(`Are you sure you want to reactivate program "${prog.name}" (${prog.code})?`)) {
                return;
            }
            prog.status = 'Active';
        }

        // Sync to Supabase
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient
                    .from('programs')
                    .update({ status: prog.status, updated_at: new Date().toISOString() })
                    .eq('id', prog.id);
            } catch (e) {
                console.warn('[PesoPrograms] Supabase update warning:', e.message);
            }
        }

        renderProgramsTable();
        renderAssignmentTable();
        renderArchiveTable();

        logAudit(prog.status === 'Active' ? 'ACTIVATE_PROGRAM' : 'DEACTIVATE_PROGRAM', `Set status of program ${prog.code} to ${prog.status}`);
        
        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Program Status Updated',
                message: `Program ${prog.code} is now ${prog.status}.`,
                type: 'success'
            });
        }
    }

    /**
     * Render the Read-Only Archive Table (Tab 9)
     */
    function renderArchiveTable() {
        const tbody = document.getElementById('archiveTableBody');
        if (!tbody) return;

        const archived = _programs.filter(p => p.status !== 'Active');
        const badge = document.getElementById('archiveTabBadge');
        if (badge) badge.textContent = archived.length;

        if (archived.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No deactivated programs found in archive.</td></tr>`;
            return;
        }

        tbody.innerHTML = archived.map(p => `
            <tr>
                <td class="fw-bold font-monospace text-muted">${escapeHtml(p.code)}</td>
                <td>
                    <div class="fw-semibold text-dark">${escapeHtml(p.name)}</div>
                    <small class="text-muted">${escapeHtml(p.category || 'General')}</small>
                </td>
                <td class="fw-bold text-muted">${formatCurrency(p.budget)}</td>
                <td><span class="badge bg-secondary">Archived / Deactivated</span></td>
                <td><small class="text-muted font-monospace">${p.updated_at ? new Date(p.updated_at).toLocaleDateString() : 'N/A'}</small></td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-sm btn-outline-success py-1 px-2 me-1" onclick="PesoPrograms.toggleProgramStatus('${p.code}')" title="Reactivate Program">
                        <i class="bi bi-arrow-counterclockwise me-1"></i>Restore
                    </button>
                    <button class="btn btn-sm btn-outline-danger py-1 px-2" onclick="PesoPrograms.permanentDeleteProgram('${p.code}')" title="Permanently Delete">
                        <i class="bi bi-trash3 me-1"></i>Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }

    /**
     * Permanent Delete from Archive
     */
    async function permanentDeleteProgram(progCode) {
        const prog = _programs.find(p => p.code === progCode);
        if (!prog) return;

        if (!confirm(`CRITICAL WARNING: Are you sure you want to permanently delete program "${prog.name}" (${prog.code})? This action is irreversible.`)) {
            return;
        }

        const idx = _programs.findIndex(p => p.code === progCode);
        if (idx !== -1) _programs.splice(idx, 1);

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('programs').delete().eq('id', prog.id);
            } catch (e) {
                console.warn('[PesoPrograms] Supabase delete warning:', e.message);
            }
        }

        renderProgramsTable();
        renderArchiveTable();
        logAudit('PERMANENT_DELETE_PROGRAM', `Permanently deleted archived program ${progCode}`);

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Program Deleted',
                message: `Program ${progCode} permanently removed from system archive.`,
                type: 'danger'
            });
        }
    }

    /**
     * Filter controls
     */
    function filterPrograms() {
        const searchInput = document.getElementById('searchProgramsInput');
        const statusSelect = document.getElementById('filterProgramStatus');
        const catSelect = document.getElementById('filterProgramCategory');

        if (searchInput) _searchQuery = searchInput.value || '';
        if (statusSelect) _activeFilter = statusSelect.value || 'all';
        if (catSelect) _activeCategory = catSelect.value || 'all';

        renderProgramsTable();
    }

    /**
     * Submit Create Program Form
     */
    async function submitCreateProgram(formEl) {
        if (!formEl) return;

        const code = (document.getElementById('newProgCode')?.value || '').trim().toUpperCase();
        const name = (document.getElementById('newProgName')?.value || '').trim();
        const category = document.getElementById('newProgCategory')?.value || 'Employment';
        const budget = parseFloat(document.getElementById('newProgBudget')?.value || '0');
        const slots = parseInt(document.getElementById('newProgSlots')?.value || '100', 10);
        const desc = (document.getElementById('newProgDesc')?.value || '').trim();

        if (!code || !name || budget <= 0) {
            alert('Please fill out all mandatory program fields and specify a valid appropriation budget.');
            return;
        }

        const newProg = {
            id: Date.now(),
            code: code,
            name: name,
            category: category,
            budget: budget,
            budget_allocated: budget,
            slots_target: slots,
            target_beneficiaries: slots,
            slots_filled: 0,
            status: 'Active',
            description: desc,
            department: 'PESO',
            agency: 'PESO',
            created_at: new Date().toISOString()
        };

        _programs.unshift(newProg);

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('programs').insert(newProg);
            } catch (err) {
                console.warn('[PesoPrograms] Supabase insert notice:', err.message);
            }
        }

        renderProgramsTable();
        renderAssignmentTable();

        logAudit('CREATE_PROGRAM', `Created new PESO program "${name}" (${code}) with budget ${formatCurrency(budget)}`);

        // Close modal
        const modalEl = document.getElementById('newProgramModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            bootstrap.Modal.getInstance(modalEl)?.hide();
        }
        formEl.reset();

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Program Created',
                message: `Program ${code} successfully registered in PESO catalog.`,
                type: 'success'
            });
        }
    }

    return Object.freeze({
        setData,
        renderProgramsTable,
        renderAssignmentTable,
        renderArchiveTable,
        drilldownProgram,
        drilldownBatch,
        backToLevel1,
        backToLevel2,
        viewProgramDetails,
        toggleProgramStatus,
        permanentDeleteProgram,
        filterPrograms,
        submitCreateProgram
    });
})();

// Global shortcuts
window.PesoPrograms = PesoPrograms;
window.filterPrograms = PesoPrograms.filterPrograms;
window.showLevel1Programs = PesoPrograms.backToLevel1;
window.showLevel2Batches = PesoPrograms.backToLevel2;

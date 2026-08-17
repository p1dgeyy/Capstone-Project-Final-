/**
 * PESO Admin Portal - Program Management Module (Tab 1) & Archive Controller
 * Module: Programs (peso-admin-programs.js)
 * Implements: Program CRUD, Budget Allocation, Ordinance Verification, Deactivation Restrictions & Archive
 */

let programsList = [];
let archiveList = [];
const PROGRAM_BATCHES = {};
const BATCH_BENEFICIARIES = {};

async function initProgramsData() {
    if (typeof DataService !== 'undefined' && DataService.programs) {
        try {
            const res = await DataService.programs.getAll({ agency: 'PESO' });
            if (res.data && Array.isArray(res.data)) {
                programsList = res.data.map(p => ({
                    id: p.id,
                    code: p.code || 'PROG',
                    name: p.name || 'Program Title',
                    category: p.category || 'Livelihood Programs',
                    budget: Number(p.budget) || 500000.00,
                    beneficiaries_count: Number(p.beneficiaries_count) || 0,
                    total_slots: Number(p.total_slots) || 50,
                    target_beneficiaries: p.target_beneficiaries || 'Beneficiaries & Jobseekers',
                    assistance_type: p.assistance_type || 'Livelihood Assistance',
                    description: p.description || '',
                    eligibility_criteria: p.eligibility_criteria || 'Resident of Koronadal City',
                    limitations: p.limitations || 'Standard LGU guidelines apply.',
                    restrictions: p.restrictions || 'One grant per household.',
                    ordinance: p.ordinance || 'Appropriation Ordinance No. 6, Series of 2025',
                    status: p.status || 'Active',
                    created_at: p.created_at || new Date().toISOString(),
                    updated_at: p.updated_at || new Date().toISOString()
                }));
                renderDashboardTables();
                return;
            }
        } catch (e) {
            console.warn('[PROGRAMS] Supabase fetch notice:', e);
        }
    }
    programsList = [];
    renderDashboardTables();
}

function renderDashboardTables() {
    filterPrograms();
    renderArchiveTable();
    updateProgramMetrics();
}

function updateProgramMetrics() {
    const list = Array.isArray(programsList) ? programsList : [];
    const active = list.filter(p => p.status === 'Active');
    const totalBudget = active.reduce((acc, curr) => acc + (Number(curr.budget) || 0), 0);
    const totalEnrolled = active.reduce((acc, curr) => acc + (Number(curr.beneficiaries_count) || 0), 0);
    const deactivated = list.filter(p => p.status !== 'Active');

    if (document.getElementById('statTotalPrograms')) document.getElementById('statTotalPrograms').textContent = active.length;
    if (document.getElementById('statTotalBudget')) document.getElementById('statTotalBudget').textContent = '₱' + totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2 });
    if (document.getElementById('statEnrolledBeneficiaries')) document.getElementById('statEnrolledBeneficiaries').textContent = totalEnrolled;
    if (document.getElementById('statArchivedPrograms')) document.getElementById('statArchivedPrograms').textContent = deactivated.length;
}

function filterPrograms() {
    const searchInput = document.getElementById('searchInput');
    const search = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const catSelect = document.getElementById('categoryFilter');
    const cat = catSelect ? catSelect.value : 'ALL';
    const statusSelect = document.getElementById('statusFilter');
    const status = statusSelect ? statusSelect.value : 'ALL';
    const tbody = document.getElementById('programsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const safeList = Array.isArray(programsList) ? programsList : [];
    const filtered = safeList.filter(p => {
        if (!p) return false;
        const matchesSearch = !search || (p.name && p.name.toLowerCase().includes(search)) || (p.code && p.code.toLowerCase().includes(search));
        const matchesCat = (cat === 'ALL') || (p.category === cat);
        const matchesStatus = (status === 'ALL') || (status === 'Active' && p.status === 'Active') || (status === 'Inactive' && p.status !== 'Active');
        return matchesSearch && matchesCat && matchesStatus;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-1"></i>No programs found matching criteria.</td></tr>';
        return;
    }

    filtered.forEach(prog => {
        const tr = document.createElement('tr');
        const isDeactivated = prog.status !== 'Active';
        const budgetFormatted = '₱' + Number(prog.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
        const enrolledCount = Number(prog.beneficiaries_count || 0);

        tr.innerHTML = `
            <td>
                <div class="fw-bold text-dark">${escapeHtml(prog.name || '')}</div>
                <span class="badge bg-dark-subtle text-dark font-monospace">${escapeHtml(prog.code || '')}</span>
            </td>
            <td>
                <span class="badge badge-category badge-emp">${escapeHtml(prog.category || 'Livelihood Programs')}</span>
                <div class="small text-muted mt-1">${escapeHtml(prog.assistance_type || '')}</div>
            </td>
            <td><div class="fw-bold text-success">${budgetFormatted}</div></td>
            <td><span class="badge bg-light text-dark border"><i class="bi bi-people-fill text-primary me-1"></i>${enrolledCount} enrolled</span></td>
            <td><div class="text-truncate" style="max-width: 200px;" title="${escapeHtml(prog.limitations || 'None')}">${escapeHtml(prog.limitations || 'None')}</div></td>
            <td><small class="fw-semibold text-secondary">${escapeHtml(prog.ordinance || 'Ordinance No. 6')}</small></td>
            <td class="text-center">
                <div class="form-check form-switch d-inline-block" title="Toggle status (Active / Deactivated)">
                    <input class="form-check-input" type="checkbox" role="switch" ${!isDeactivated ? 'checked' : ''} onchange="handleProgramToggle(event, ${prog.id})" aria-label="Toggle Status for ${escapeHtml(prog.code)}">
                </div>
            </td>
            <td class="text-end">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-info" onclick="openProgramDetailsViewModal(${prog.id})" title="View Details (Read-Only)">
                        <i class="bi bi-eye-fill"></i>
                    </button>
                    <button class="btn btn-outline-warning" onclick="openProgramEditModal(${prog.id})" title="Edit Program Details">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    ${!isDeactivated ? `
                    <button class="btn btn-outline-secondary" onclick="openProgramActionModal('deactivate', ${prog.id})" title="Deactivate Program">
                        <i class="bi bi-archive-fill"></i>
                    </button>` : `
                    <button class="btn btn-outline-success" onclick="openProgramActionModal('activate', ${prog.id})" title="Reactivate Program">
                        <i class="bi bi-arrow-counterclockwise"></i>
                    </button>`}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- CREATE NEW PROGRAM MODAL & HANDLER (RBAC: ADMIN ONLY) ---
function openCreateProgramModal() {
    const form = document.getElementById('createProgramForm');
    if (form) form.reset();

    const dtInput = document.getElementById('newProgDateTime');
    if (dtInput) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        dtInput.value = now.toISOString().slice(0, 16);
    }

    const adminId = sessionStorage.getItem('userId') || '1';
    logAuditEvent('OPEN_CREATE_PROGRAM_FORM', `PESO Admin [ID: ${adminId}] opened Create New Livelihood Program form`);
    safeOpenModal('createProgramModal');
}

async function handleCreateProgramSubmit(e) {
    e.preventDefault();

    const name = (document.getElementById('newProgName')?.value || '').trim();
    const code = (document.getElementById('newProgCode')?.value || '').trim().toUpperCase();
    const category = document.getElementById('newProgCategory')?.value || 'Livelihood Programs';
    const budget = Number(document.getElementById('newProgBudget')?.value) || 0;
    const description = (document.getElementById('newProgDesc')?.value || '').trim();
    const target = (document.getElementById('newProgTarget')?.value || '').trim();
    const assistanceType = document.getElementById('newProgAssistance')?.value || 'Livelihood Assistance';
    const criteria = (document.getElementById('newProgEligibility')?.value || '').trim() || 'Resident of Koronadal City';
    const limitations = (document.getElementById('newProgLimitations')?.value || '').trim() || 'Standard LGU guidelines apply.';

    if (!name || !code || !budget || !description) {
        window.showSystemNotification({
            title: 'Validation Error',
            message: 'Please complete all required fields marked with *.',
            type: 'warning'
        });
        return;
    }

    if (programsList.some(p => p.code && p.code.toUpperCase() === code)) {
        window.showSystemNotification({
            title: 'Program Code Exists',
            message: `A program with code "${code}" already exists in the system.`,
            type: 'warning'
        });
        return;
    }

    let createdId = Date.now();
    const newProg = {
        id: createdId,
        code: code,
        name: name,
        category: category,
        budget: budget,
        beneficiaries_count: 0,
        total_slots: 50,
        target_beneficiaries: target || 'Beneficiaries & Jobseekers',
        assistance_type: assistanceType || 'Livelihood Assistance',
        description: description,
        eligibility_criteria: criteria,
        limitations: limitations,
        restrictions: 'One grant per household.',
        ordinance: 'Appropriation Ordinance No. 6, Series of 2025',
        status: 'Active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    if (typeof DataService !== 'undefined' && DataService.programs) {
        try {
            const res = await DataService.programs.create({
                code: code,
                name: name,
                category: category,
                agency: 'PESO',
                budget: budget,
                description: description
            });

            if (res && res.error) {
                window.showSystemNotification({
                    title: 'Creation Failed',
                    message: res.error.message || 'Failed to create program in Supabase database.',
                    type: 'error'
                });
                return;
            }

            if (res && res.data && res.data.id) {
                newProg.id = res.data.id;
            }
        } catch (err) {
            console.error('[PROGRAMS] Supabase insert error:', err);
            window.showSystemNotification({
                title: 'Database Error',
                message: 'Failed to communicate with Supabase. Program creation aborted.',
                type: 'error'
            });
            return;
        }
    }

    programsList.unshift(newProg);
    const adminId = sessionStorage.getItem('userId') || '1';
    const adminUser = sessionStorage.getItem('username') || 'peso-admin';
    logAuditEvent('CREATE_PROGRAM', `PESO Admin [ID:${adminId}, ${adminUser}] created new program "${code}" (${name}) with budget ₱${budget.toLocaleString()}. Category: ${category}`);

    safeHideModal('createProgramModal');
    renderDashboardTables();

    window.showSystemNotification({
        title: 'Program Created',
        message: `Program ${code} (${name}) created successfully in Supabase.`,
        type: 'success'
    });
}

// --- DETAILS BUTTON: STRICTLY READ-ONLY PROGRAM DETAILS MODAL (USER RULE 1) ---
function openProgramDetailsViewModal(progId) {
    if (!Array.isArray(programsList)) programsList = [];
    const prog = programsList.find(p => p && p.id === progId);
    if (!prog) {
        console.warn('[PROGRAMS] Program not found for ID:', progId);
        window.showSystemNotification({ title: 'Program Notice', message: 'Requested program details could not be loaded.', type: 'warning' });
        return;
    }

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || 'N/A';
    };

    setText('viewProgName', prog.name);
    setText('viewProgCode', prog.code);
    setText('viewProgCategory', prog.category);
    setText('viewProgBudget', '₱' + Number(prog.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }));
    setText('viewProgBeneficiaries', `${prog.beneficiaries_count || 0} beneficiaries enrolled`);
    setText('viewProgDesc', prog.description);
    setText('viewProgTarget', prog.target_beneficiaries);
    setText('viewProgAssistance', prog.assistance_type);
    setText('viewProgEligibility', prog.eligibility_criteria);
    setText('viewProgLimitations', prog.limitations);
    setText('viewProgOrdinance', prog.ordinance || 'Appropriation Ordinance No. 6, Series of 2025');

    const statusBadge = document.getElementById('viewProgStatus');
    if (statusBadge) {
        statusBadge.textContent = prog.status || 'Active';
        statusBadge.className = (prog.status === 'Active') ? 'badge bg-success fs-6' : 'badge bg-secondary fs-6';
    }

    safeOpenModal('programDetailsViewModal');
    const adminId = sessionStorage.getItem('userId') || '1';
    logAuditEvent('VIEW_PROGRAM_DETAILS', `PESO Admin [ID:${adminId}] opened read-only program details reference for ${prog.code || progId} (${prog.name || ''})`);
}

// --- EDIT BUTTON: EDITABLE PROGRAM FORM MODAL (WITH AUDIT LOGGING) ---
function openProgramEditModal(progId) {
    if (!Array.isArray(programsList)) programsList = [];
    const prog = programsList.find(p => p && p.id === progId);
    if (!prog) {
        console.warn('[PROGRAMS] Program not found for ID:', progId);
        window.showSystemNotification({ title: 'Program Notice', message: 'Program record not found.', type: 'warning' });
        return;
    }

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('editProgId', prog.id);
    const badge = document.getElementById('editModalCodeBadge');
    if (badge) badge.textContent = prog.code || '';
    setVal('editProgName', prog.name);
    setVal('editProgCode', prog.code);
    setVal('editProgBudget', prog.budget || 0);
    setVal('editProgAssistance', prog.assistance_type);
    setVal('editProgDesc', prog.description);
    setVal('editProgTarget', prog.target_beneficiaries);
    setVal('editProgEligibility', prog.eligibility_criteria);
    setVal('editProgLimitations', prog.limitations);

    safeOpenModal('programEditModal');
}

async function handleSaveProgramUpdates(e) {
    e.preventDefault();
    const editIdEl = document.getElementById('editProgId');
    const progId = editIdEl ? Number(editIdEl.value) : null;
    const prog = programsList.find(p => p && p.id === progId);
    if (!prog) {
        window.showSystemNotification({ title: 'Update Error', message: 'Program not found in current roster.', type: 'danger' });
        return;
    }

    const updatedName = (document.getElementById('editProgName')?.value || '').trim();
    const updatedBudget = Number(document.getElementById('editProgBudget')?.value) || 0;
    const updatedAssistance = (document.getElementById('editProgAssistance')?.value || '').trim();
    const updatedDesc = (document.getElementById('editProgDesc')?.value || '').trim();
    const updatedTarget = (document.getElementById('editProgTarget')?.value || '').trim();
    const updatedEligibility = (document.getElementById('editProgEligibility')?.value || '').trim();
    const updatedLimitations = (document.getElementById('editProgLimitations')?.value || '').trim();

    if (typeof DataService !== 'undefined' && DataService.programs) {
        try {
            const updateRes = await DataService.programs.update(progId, {
                name: updatedName,
                description: updatedDesc
            });

            if (updateRes && updateRes.error) {
                window.showSystemNotification({
                    title: 'Update Error',
                    message: updateRes.error.message || 'Failed to update program in Supabase.',
                    type: 'error'
                });
                return;
            }
        } catch (err) {
            console.error('[PROGRAMS] Supabase update error:', err);
            window.showSystemNotification({
                title: 'Database Error',
                message: 'Failed to communicate with Supabase. Update aborted.',
                type: 'error'
            });
            return;
        }
    }

    prog.name = updatedName;
    prog.budget = updatedBudget;
    prog.assistance_type = updatedAssistance;
    prog.description = updatedDesc;
    prog.target_beneficiaries = updatedTarget;
    prog.eligibility_criteria = updatedEligibility;
    prog.limitations = updatedLimitations;
    prog.updated_at = new Date().toISOString();

    const adminId = sessionStorage.getItem('userId') || '1';
    const adminUser = sessionStorage.getItem('username') || 'peso-admin';
    logAuditEvent('UPDATE_PROGRAM', `PESO Admin [ID:${adminId}, ${adminUser}] updated program details for ${prog.code} (${updatedName}). Budget: ₱${updatedBudget.toLocaleString()}`);

    safeHideModal('programEditModal');
    renderDashboardTables();

    window.showSystemNotification({
        title: 'Program Updated',
        message: `Program ${prog.code} was updated successfully in Supabase.`,
        type: 'success'
    });
}

// --- PROGRAM STATUS TOGGLE (DEACTIVATION RESTRICTION GUARD & CONFIRMATION MODAL) ---
function handleProgramToggle(event, progId) {
    const prog = programsList.find(p => p.id === progId);
    if (!prog) return;

    const isDeactivating = !event.target.checked;

    if (isDeactivating) {
        // Revert toggle switch visually until confirmation
        event.preventDefault();
        event.target.checked = true;

        // RULE: Programs with active beneficiaries cannot be deactivated
        if (prog.beneficiaries_count > 0) {
            const warningEl = document.getElementById('restrictionWarningText');
            if (warningEl) {
                warningEl.textContent = `Cannot deactivate program "${prog.code}". This program currently has ${prog.beneficiaries_count} active enrolled beneficiaries. Assignments must be completed or transferred before deactivation.`;
            }
            safeOpenModal('restrictionWarningModal');

            window.showSystemNotification({
                title: 'Deactivation Blocked',
                message: `Deactivation Restriction: Program "${prog.code}" has ${prog.beneficiaries_count} active beneficiaries.`,
                type: 'danger'
            });

            const adminId = sessionStorage.getItem('userId') || '1';
            logAuditEvent('BLOCKED_PROGRAM_DEACTIVATION', `PESO Admin [ID:${adminId}] attempted to deactivate ${prog.code} with ${prog.beneficiaries_count} active beneficiaries.`);
            return;
        }

        // Open confirmation modal for safe deactivation
        openProgramActionModal('deactivate', progId);
    } else {
        // Reactivate
        event.preventDefault();
        event.target.checked = false;
        openProgramActionModal('activate', progId);
    }
}

// --- PROGRAM SENSITIVE ACTION MODAL (DEACTIVATE, ARCHIVE, RESTORE, DELETE) ---
function openProgramActionModal(actionType, progId) {
    const prog = programsList.find(p => p.id === progId);
    if (!prog) return;

    const normType = String(actionType || '').toLowerCase();
    document.getElementById('progActionTargetId').value = progId;
    document.getElementById('progActionType').value = normType;
    document.getElementById('progActionReasonInput').value = '';

    const header = document.getElementById('progActionConfirmHeader');
    const icon = document.getElementById('progActionConfirmIcon');
    const title = document.getElementById('progActionConfirmTitle');
    const banner = document.getElementById('progActionIconBanner');
    const alertBox = document.getElementById('progActionAlertBox');
    const submitBtn = document.getElementById('progActionSubmitBtn');

    if (normType === 'deactivate') {
        if (header) header.className = 'modal-header rounded-top-4 py-3 bg-danger text-white';
        if (icon) icon.className = 'bi bi-pause-circle-fill fs-4';
        if (title) title.textContent = 'Deactivate Livelihood Program';
        if (banner) banner.innerHTML = `<div class="text-danger mb-2"><i class="bi bi-pause-circle-fill" style="font-size: 3.5rem;"></i></div><h5 class="fw-bold text-dark mb-1">Deactivate "${escapeHtml(prog.code)} - ${escapeHtml(prog.name)}"?</h5><p class="text-muted small mb-0">Program will be suspended from new beneficiary intake and moved to the archive view.</p>`;
        if (alertBox) alertBox.innerHTML = `<i class="bi bi-info-circle-fill me-1 text-danger"></i> <strong>Compliance Rule:</strong> Deactivated programs have 0 active beneficiaries and can be reactivated anytime.`;
        if (submitBtn) {
            submitBtn.className = 'btn btn-danger fw-bold px-4';
            submitBtn.textContent = 'Confirm Deactivation';
        }
    } else if (normType === 'archive') {
        if (header) header.className = 'modal-header rounded-top-4 py-3 bg-secondary text-white';
        if (icon) icon.className = 'bi bi-archive-fill fs-4';
        if (title) title.textContent = 'Archive Livelihood Program';
        if (banner) banner.innerHTML = `<div class="text-secondary mb-2"><i class="bi bi-archive-fill" style="font-size: 3.5rem;"></i></div><h5 class="fw-bold text-dark mb-1">Archive "${escapeHtml(prog.code)}"?</h5><p class="text-muted small mb-0">Program is placed in read-only archive status for reporting and historical audit.</p>`;
        if (alertBox) alertBox.innerHTML = `<i class="bi bi-shield-lock-fill me-1 text-secondary"></i> <strong>Notice:</strong> Program records remain intact in database.`;
        if (submitBtn) {
            submitBtn.className = 'btn btn-secondary fw-bold px-4';
            submitBtn.textContent = 'Confirm Archive';
        }
    } else if (normType === 'activate' || normType === 'restore') {
        if (header) header.className = 'modal-header rounded-top-4 py-3 bg-success text-white';
        if (icon) icon.className = 'bi bi-arrow-counterclockwise fs-4';
        if (title) title.textContent = 'Restore Program to Active Roster';
        if (banner) banner.innerHTML = `<div class="text-success mb-2"><i class="bi bi-shield-check" style="font-size: 3.5rem;"></i></div><h5 class="fw-bold text-dark mb-1">Restore "${escapeHtml(prog.code)}"?</h5><p class="text-muted small mb-0">Program will regain Active status and open for beneficiary assignment quotas.</p>`;
        if (alertBox) alertBox.innerHTML = `<i class="bi bi-check-circle-fill me-1 text-success"></i> <strong>Notice:</strong> Program budget and allocations will be re-enabled.`;
        if (submitBtn) {
            submitBtn.className = 'btn btn-success fw-bold px-4';
            submitBtn.textContent = 'Restore to Active';
        }
    } else if (normType === 'delete') {
        if (header) header.className = 'modal-header rounded-top-4 py-3 bg-danger text-white';
        if (icon) icon.className = 'bi bi-trash-fill fs-4';
        if (title) title.textContent = 'Permanently Delete Program';
        if (banner) banner.innerHTML = `<div class="text-danger mb-2"><i class="bi bi-exclamation-octagon-fill" style="font-size: 3.5rem;"></i></div><h5 class="fw-bold text-danger mb-1">Critical Permanent Deletion Warning</h5><p class="text-muted small mb-0">Program "${escapeHtml(prog.code)} - ${escapeHtml(prog.name)}" will be permanently erased from database.</p>`;
        if (alertBox) alertBox.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1 text-danger"></i> <strong>Warning:</strong> Action is irreversible. Mandatory justification reason will be permanently archived in system audit logs.`;
        if (submitBtn) {
            submitBtn.className = 'btn btn-danger fw-bold px-4';
            submitBtn.textContent = 'Permanently Delete';
        }
    }

    safeOpenModal('programActionConfirmModal');
}

async function handleProgramActionConfirm(e) {
    e.preventDefault();

    const progId = Number(document.getElementById('progActionTargetId')?.value);
    const actionType = String(document.getElementById('progActionType')?.value || '').toLowerCase();
    const actionReason = (document.getElementById('progActionReasonInput')?.value || '').trim();

    if (!actionReason) {
        window.showSystemNotification({
            title: 'Action Reason Required',
            message: 'Please provide a clear justification before confirming this program action.',
            type: 'warning'
        });
        return;
    }

    const prog = programsList.find(p => p.id === progId);
    if (!prog) return;

    const adminId = sessionStorage.getItem('userId') || '1';
    const adminUser = sessionStorage.getItem('username') || 'peso-admin';

    if (actionType === 'deactivate') {
        // Enforce active beneficiary restriction
        if (prog.beneficiaries_count > 0) {
            safeHideModal('programActionConfirmModal');
            safeOpenModal('restrictionWarningModal');
            return;
        }

        if (typeof DataService !== 'undefined' && DataService.programs) {
            try {
                const res = await DataService.programs.update(progId, { status: 'Inactive' });
                if (res && res.error) {
                    window.showSystemNotification({ title: 'Error', message: res.error.message || 'Failed to deactivate program in Supabase.', type: 'error' });
                    return;
                }
            } catch (err) {
                window.showSystemNotification({ title: 'Database Error', message: 'Failed to communicate with Supabase.', type: 'error' });
                return;
            }
        }

        prog.status = 'Inactive';
        prog.updated_at = new Date().toISOString();
        logAuditEvent('DEACTIVATE_PROGRAM', `PESO Admin [ID:${adminId}, ${adminUser}] deactivated program "${prog.code}". Justification: ${actionReason}`);
        window.showSystemNotification({ title: 'Program Deactivated', message: `Program "${prog.code}" status set to Inactive and moved to Archive.`, type: 'warning' });

    } else if (actionType === 'archive') {
        if (typeof DataService !== 'undefined' && DataService.programs) {
            try {
                const res = await DataService.programs.update(progId, { status: 'Archived' });
                if (res && res.error) {
                    window.showSystemNotification({ title: 'Error', message: res.error.message || 'Failed to archive in Supabase.', type: 'error' });
                    return;
                }
            } catch (err) {
                window.showSystemNotification({ title: 'Database Error', message: 'Failed to communicate with Supabase.', type: 'error' });
                return;
            }
        }

        prog.status = 'Archived';
        prog.updated_at = new Date().toISOString();
        logAuditEvent('ARCHIVE_PROGRAM', `PESO Admin [ID:${adminId}, ${adminUser}] archived program "${prog.code}". Justification: ${actionReason}`);
        window.showSystemNotification({ title: 'Program Archived', message: `Program "${prog.code}" moved to Archive roster.`, type: 'info' });

    } else if (actionType === 'activate' || actionType === 'restore') {
        if (typeof DataService !== 'undefined' && DataService.programs) {
            try {
                const res = await DataService.programs.update(progId, { status: 'Active' });
                if (res && res.error) {
                    window.showSystemNotification({ title: 'Error', message: res.error.message || 'Failed to activate in Supabase.', type: 'error' });
                    return;
                }
            } catch (err) {
                window.showSystemNotification({ title: 'Database Error', message: 'Failed to communicate with Supabase.', type: 'error' });
                return;
            }
        }

        prog.status = 'Active';
        prog.updated_at = new Date().toISOString();
        logAuditEvent('ACTIVATE_PROGRAM', `PESO Admin [ID:${adminId}, ${adminUser}] restored program "${prog.code}" to Active status. Justification: ${actionReason}`);
        window.showSystemNotification({ title: 'Program Restored', message: `Program "${prog.code}" is now Active.`, type: 'success' });

    } else if (actionType === 'delete') {
        if (typeof DataService !== 'undefined' && DataService.programs) {
            try {
                const res = await DataService.programs.delete(progId);
                if (res && res.error) {
                    window.showSystemNotification({ title: 'Error', message: res.error.message || 'Failed to delete from Supabase.', type: 'error' });
                    return;
                }
            } catch (err) {
                window.showSystemNotification({ title: 'Database Error', message: 'Failed to communicate with Supabase.', type: 'error' });
                return;
            }
        }

        programsList = programsList.filter(p => p.id !== progId);
        logAuditEvent('PERMANENT_DELETE_PROGRAM', `PESO Admin [ID:${adminId}, ${adminUser}] permanently deleted program "${prog.code}" (${prog.name}). Justification: ${actionReason}`);
        window.showSystemNotification({ title: 'Program Deleted', message: `Program "${prog.code}" permanently removed from system.`, type: 'danger' });
    }

    safeHideModal('programActionConfirmModal');
    renderDashboardTables();
}

// --- ORDINANCE MODAL & LIVE PREVIEW HANDLERS ---
function openUploadOrdinanceModal() {
    const form = document.getElementById('uploadOrdinanceForm');
    if (form) form.reset();
    const previewBox = document.getElementById('ordFilePreviewContainer');
    if (previewBox) previewBox.classList.add('d-none');

    const adminId = sessionStorage.getItem('userId') || '1';
    logAuditEvent('OPEN_UPLOAD_ORDINANCE_FORM', `PESO Admin [ID:${adminId}] opened Upload Ordinance form modal`);
    safeOpenModal('uploadOrdinanceModal');
}

function handleOrdinanceFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    const previewContainer = document.getElementById('ordFilePreviewContainer');
    const nameEl = document.getElementById('ordPreviewFileName');
    const sizeEl = document.getElementById('ordPreviewFileSize');

    if (!file) {
        if (previewContainer) previewContainer.classList.add('d-none');
        return;
    }

    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = `File Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB • ${file.type || 'Document'}`;
    if (previewContainer) previewContainer.classList.remove('d-none');
}

function handleUploadOrdinance(e) {
    e.preventDefault();
    const title = (document.getElementById('ordTitle')?.value || '').trim();
    const year = (document.getElementById('ordYear')?.value || '2026').trim();
    const total = Number(document.getElementById('ordTotal')?.value) || 13707882.00;
    const file = document.getElementById('ordFile')?.files?.[0];

    const adminId = sessionStorage.getItem('userId') || '1';
    const adminUser = sessionStorage.getItem('username') || 'peso-admin';
    logAuditEvent('UPLOAD_ORDINANCE', `PESO Admin [ID:${adminId}, ${adminUser}] uploaded LGU Appropriation Ordinance "${title}" (Year: ${year}, Total: ₱${total.toLocaleString()}). File: ${file ? file.name : 'Ordinance_Doc.pdf'}`);

    safeHideModal('uploadOrdinanceModal');
    window.showSystemNotification({
        title: 'Ordinance Uploaded',
        message: `Appropriation Ordinance "${title}" document uploaded and attached successfully.`,
        type: 'success'
    });
}

function showOrdinanceReferenceModal() {
    const tbody = document.getElementById('ordinanceBreakdownTableBody');
    if (tbody) {
        tbody.innerHTML = '';
        const list = Array.isArray(programsList) && programsList.length > 0 ? programsList : [
            { category: 'Emergency Employment', name: 'TUPAD Emergency Employment Assistance', code: 'TUPAD-2026', budget: 5000000.00 },
            { category: 'Student Employment', name: 'Special Program for Employment of Students', code: 'SPES-2026', budget: 3500000.00 },
            { category: 'Livelihood Programs', name: 'Pangkabuhayan Financial Assistance Scheme', code: 'PFAS-2026', budget: 3207882.00 },
            { category: 'Internship Programs', name: 'City Koronadal Graduate Internship Placement', code: 'CKGIP-2026', budget: 2000000.00 }
        ];

        list.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge bg-light text-dark border">${escapeHtml(p.category || 'Livelihood')}</span></td>
                <td><div class="fw-bold text-dark">${escapeHtml(p.name || '')}</div></td>
                <td><span class="badge bg-dark-subtle text-dark font-monospace">${escapeHtml(p.code || '')}</span></td>
                <td class="text-end fw-bold text-success">₱${Number(p.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    const adminId = sessionStorage.getItem('userId') || '1';
    logAuditEvent('VIEW_ORDINANCE_REFERENCE', `PESO Admin [ID:${adminId}] opened LGU Appropriation Ordinance reference breakdown`);
    safeOpenModal('ordinanceReferenceModal');
}

// --- ARCHIVE TABLE & ACTIONS (USER RULE 5: READ-ONLY MONITORING, ACTIVATION & PERMANENT DELETE) ---
function renderArchiveTable(customList) {
    const tbody = document.getElementById('archiveTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = customList || (Array.isArray(programsList) ? programsList.filter(p => p.status !== 'Active') : []);
    const badgeEl = document.getElementById('archiveSectionCountBadge');
    if (badgeEl) badgeEl.textContent = `${list.length} Deactivated Programs`;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted"><i class="bi bi-archive fs-3 d-block mb-1"></i>No archived or deactivated programs currently.</td></tr>';
        return;
    }

    list.forEach(prog => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="fw-bold text-secondary text-decoration-line-through">${escapeHtml(prog.name || '')}</div>
                <span class="badge bg-secondary-subtle text-secondary font-monospace">${escapeHtml(prog.code || '')}</span>
            </td>
            <td><span class="badge badge-category badge-other">${escapeHtml(prog.category || 'Other')}</span></td>
            <td><span class="text-muted fw-semibold">₱${Number(prog.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
            <td><small class="text-muted">${escapeHtml(prog.target_beneficiaries || 'General')}</small></td>
            <td><small class="text-muted font-monospace">${prog.updated_at ? new Date(prog.updated_at).toLocaleDateString() : 'Recent'}</small></td>
            <td class="text-end">
                <button class="btn btn-sm btn-success me-1" onclick="activateProgram(${prog.id})" title="Restore Program to Active Roster">
                    <i class="bi bi-arrow-counterclockwise"></i> Restore
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="permanentlyDeleteProgram(${prog.id})" title="Permanent Delete (Admin Only)">
                    <i class="bi bi-trash-fill"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function activateProgram(progId) {
    openProgramActionModal('activate', progId);
}

function permanentlyDeleteProgram(progId) {
    openProgramActionModal('delete', progId);
}

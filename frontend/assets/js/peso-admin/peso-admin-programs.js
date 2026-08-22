/**
 * PESO Admin Portal - Program Management Module (Tab 1) & Archive Controller
 * Module: Programs (peso-admin-programs.js)
 */

let programsList = [];
let archiveList = [];
const PROGRAM_BATCHES = {};
const BATCH_BENEFICIARIES = {};

async function initProgramsData() {
    if (typeof DataService !== 'undefined' && DataService.programs) {
        try {
            const [progRes, appRes] = await Promise.all([
                DataService.programs.getAll({ agency: 'PESO' }),
                DataService.applications.getAll({ agency: 'PESO' })
            ]);

            const appCountByProg = {};
            if (appRes && appRes.data && Array.isArray(appRes.data)) {
                appRes.data.forEach(a => {
                    const pid = a.program_id;
                    if (pid) appCountByProg[pid] = (appCountByProg[pid] || 0) + 1;
                });
            }

            if (progRes && progRes.data && Array.isArray(progRes.data)) {
                programsList = progRes.data.map(p => ({
                    id: p.id,
                    code: p.code || 'PROG',
                    name: p.name || 'Program Title',
                    category: p.category || 'Livelihood Programs',
                    budget: Number(p.budget) || 0,
                    beneficiaries_count: appCountByProg[p.id] || Number(p.beneficiaries_count) || 0,
                    total_slots: Number(p.total_slots) || 0,
                    target_beneficiaries: p.target_beneficiaries || 'Beneficiaries & Jobseekers',
                    assistance_type: p.assistance_type || 'Assistance Grant',
                    description: p.description || '',
                    eligibility_criteria: p.eligibility_criteria || 'Resident of Koronadal City',
                    limitations: p.limitations || 'Standard LGU guidelines apply.',
                    restrictions: p.restrictions || 'One grant per household.',
                    ordinance: p.ordinance || 'LGU General Fund Ordinance',
                    status: p.status || 'Active'
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

function filterPrograms() {
    const searchInput = document.getElementById('searchInput');
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    const catSelect = document.getElementById('categoryFilter');
    const cat = catSelect ? catSelect.value : 'ALL';
    const statusSelect = document.getElementById('statusFilter');
    const status = statusSelect ? statusSelect.value : 'ALL';
    const tbody = document.getElementById('programsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = programsList.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search) || p.code.toLowerCase().includes(search);
        const matchesCat = (cat === 'ALL') || (p.category === cat);
        const matchesStatus = (status === 'ALL') || (status === 'Active' && p.status === 'Active') || (status === 'Inactive' && p.status !== 'Active');
        return matchesSearch && matchesCat && matchesStatus;
    });

    filtered.forEach(prog => {
        const tr = document.createElement('tr');
        const isDeactivated = prog.status !== 'Active';
        tr.innerHTML = `
            <td><div class="fw-bold text-dark">${escapeHtml(prog.name)}</div><span class="badge bg-dark-subtle text-dark font-monospace">${escapeHtml(prog.code)}</span></td>
            <td><span class="badge badge-category badge-emp">${escapeHtml(prog.category)}</span><div class="small text-muted mt-1">${escapeHtml(prog.assistance_type || '')}</div></td>
            <td><div class="fw-bold text-success">₱${Number(prog.budget).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></td>
            <td><span class="badge bg-light text-dark border"><i class="bi bi-people-fill text-primary me-1"></i>${prog.beneficiaries_count || 0} enrolled</span></td>
            <td><div class="text-truncate" style="max-width: 200px;">${escapeHtml(prog.limitations || 'None')}</div></td>
            <td><small class="fw-semibold text-secondary">${escapeHtml(prog.ordinance || 'Ordinance No. 6')}</small></td>
            <td class="text-center">
                <div class="form-check form-switch d-inline-block">
                    <input class="form-check-input" type="checkbox" role="switch" ${!isDeactivated ? 'checked' : ''} onchange="handleProgramToggle(event, ${prog.id})" aria-label="Toggle Status">
                </div>
            </td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-info me-1" onclick="openProgramDetailsViewModal(${prog.id})">
                    <i class="bi bi-eye-fill"></i> Details
                </button>
                <button class="btn btn-sm btn-outline-warning" onclick="openProgramEditModal(${prog.id})">
                    <i class="bi bi-pencil-square"></i> Edit
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No programs found matching filters.</td></tr>';
    }
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

    logAuditEvent('OPEN_CREATE_PROGRAM_FORM', 'Admin opened Create New Livelihood Program form');
    safeOpenModal('createProgramModal');
}

async function handleCreateProgramSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('newProgName').value.trim();
    const code = document.getElementById('newProgCode').value.trim().toUpperCase();
    const category = document.getElementById('newProgCategory').value;
    const budget = Number(document.getElementById('newProgBudget').value) || 0;
    const description = document.getElementById('newProgDesc').value.trim();
    const target = document.getElementById('newProgTarget').value.trim();
    const assistanceType = document.getElementById('newProgAssistance').value;
    const criteria = (document.getElementById('newProgEligibility') ? document.getElementById('newProgEligibility').value : '').trim() || 'Resident of Koronadal City';
    const limitations = (document.getElementById('newProgLimitations') ? document.getElementById('newProgLimitations').value : '').trim() || 'Standard LGU guidelines apply.';

    if (!name || !code || !budget || !description) {
        window.showSystemNotification({
            title: 'Validation Error',
            message: 'Please complete all required fields.',
            type: 'warning'
        });
        return;
    }

    if (programsList.some(p => p.code.toUpperCase() === code)) {
        window.showSystemNotification({
            title: 'Program Code Exists',
            message: `A program with code "${code}" already exists.`,
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
        created_at: new Date().toISOString()
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
            if (res.data && res.data.id) {
                newProg.id = res.data.id;
            }
        } catch (err) {
            console.warn('[PROGRAMS] Supabase insert warning:', err);
        }
    }

    programsList.unshift(newProg);
    logAuditEvent('CREATE_PROGRAM', `Created new program "${code}" (${name}) with budget ₱${budget.toLocaleString()}. Category: ${category}`);

    safeHideModal('createProgramModal');
    renderDashboardTables();

    window.showSystemNotification({
        title: 'Program Created',
        message: `Program ${code} (${name}) created successfully.`,
        type: 'success'
    });
}

// --- DETAILS BUTTON: STRICTLY READ-ONLY PROGRAM DETAILS MODAL (RULE 1) ---
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
    logAuditEvent('VIEW_PROGRAM_DETAILS', `Opened read-only program details reference for ${prog.code || progId} (${prog.name || ''})`);
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

    prog.name = updatedName;
    prog.budget = updatedBudget;
    prog.assistance_type = updatedAssistance;
    prog.description = updatedDesc;
    prog.target_beneficiaries = updatedTarget;
    prog.eligibility_criteria = updatedEligibility;
    prog.limitations = updatedLimitations;
    prog.updated_at = new Date().toISOString();

    if (typeof DataService !== 'undefined' && DataService.programs) {
        try {
            await DataService.programs.update(progId, {
                name: updatedName,
                description: updatedDesc
            });
        } catch (err) {
            console.warn('[PROGRAMS] Supabase update notice:', err);
        }
    }

    logAuditEvent('UPDATE_PROGRAM', `Updated program details for ${prog.code} (${updatedName}). Budget: ₱${updatedBudget.toLocaleString()}`);

    safeHideModal('programEditModal');
    renderDashboardTables();

    window.showSystemNotification({
        title: 'Program Updated',
        message: `Program ${prog.code} was updated successfully.`,
        type: 'success'
    });
}

// --- PROGRAM STATUS TOGGLE (DEACTIVATION RESTRICTION GUARD) ---
async function handleProgramToggle(event, progId) {
    const prog = programsList.find(p => p.id === progId);
    if (!prog) return;

    const isDeactivating = !event.target.checked;

    // RULE: Programs with active beneficiaries cannot be deactivated
    if (isDeactivating && (prog.beneficiaries_count > 0)) {
        event.preventDefault();
        event.target.checked = true; // Revert toggle switch
        window.showSystemNotification({
            title: 'Deactivation Blocked',
            message: `Deactivation Restriction: Program "${prog.code}" has ${prog.beneficiaries_count} active beneficiaries. Assignments must be completed or transferred before deactivation.`,
            type: 'danger'
        });
        logAuditEvent('BLOCKED_PROGRAM_DEACTIVATION', `Attempted to deactivate ${prog.code} with ${prog.beneficiaries_count} active beneficiaries.`);
        return;
    }

    const newStatus = isDeactivating ? 'Inactive' : 'Active';
    prog.status = newStatus;
    prog.updated_at = new Date().toISOString();

    if (typeof DataService !== 'undefined' && DataService.programs) {
        try {
            await DataService.programs.update(progId, { status: newStatus });
        } catch (err) { }
    }

    logAuditEvent(isDeactivating ? 'DEACTIVATE_PROGRAM' : 'ACTIVATE_PROGRAM', `Program ${prog.code} status set to ${newStatus}`);
    renderDashboardTables();

    window.showSystemNotification({
        title: isDeactivating ? 'Program Deactivated' : 'Program Activated',
        message: `Program ${prog.code} is now ${newStatus}.`,
        type: isDeactivating ? 'warning' : 'success'
    });
}

// --- ORDINANCE MODAL HANDLERS ---
function openUploadOrdinanceModal() {
    const form = document.getElementById('uploadOrdinanceForm');
    if (form) form.reset();

    logAuditEvent('OPEN_UPLOAD_ORDINANCE_FORM', 'Opened Upload Ordinance form modal');
    safeOpenModal('uploadOrdinanceModal');
}

function handleUploadOrdinance(e) {
    e.preventDefault();
    logAuditEvent('UPLOAD_ORDINANCE', 'Uploaded Appropriation Ordinance document');
    safeHideModal('uploadOrdinanceModal');
    window.showSystemNotification({
        title: 'Ordinance Uploaded',
        message: 'Appropriation Ordinance document uploaded and attached successfully.',
        type: 'success'
    });
}

function showOrdinanceReferenceModal() {
    safeOpenModal('ordinanceReferenceModal');
}

// --- ARCHIVE TABLE & ACTIONS (USER RULE 5: READ-ONLY MONITORING, ACTIVATION & PERMANENT DELETE) ---
function renderArchiveTable(customList) {
    const tbody = document.getElementById('archiveTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = customList || programsList.filter(p => p.status !== 'Active');
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
                <div class="fw-bold text-secondary text-decoration-line-through">${escapeHtml(prog.name)}</div>
                <span class="badge bg-secondary-subtle text-secondary font-monospace">${escapeHtml(prog.code)}</span>
            </td>
            <td><span class="badge badge-category badge-other">${escapeHtml(prog.category)}</span></td>
            <td><span class="text-muted fw-semibold">₱${Number(prog.budget).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
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

async function activateProgram(progId) {
    const prog = programsList.find(p => p.id === progId);
    if (!prog) return;

    prog.status = 'Active';
    prog.updated_at = new Date().toISOString();

    if (typeof DataService !== 'undefined' && DataService.programs) {
        try {
            await DataService.programs.update(progId, { status: 'Active' });
        } catch (e) { }
    }

    logAuditEvent('RESTORE_PROGRAM', `Restored program ${prog.code} (${prog.name}) from archive to Active status.`);
    renderDashboardTables();

    window.showSystemNotification({
        title: 'Program Restored',
        message: `Program ${prog.code} is now Active.`,
        type: 'success'
    });
}

async function permanentlyDeleteProgram(progId) {
    const prog = programsList.find(p => p.id === progId);
    if (!prog) return;

    if (!confirm(`Critical Compliance Warning: Are you sure you want to permanently delete program "${prog.code} - ${prog.name}"? This action cannot be undone.`)) {
        return;
    }

    const code = prog.code;
    const name = prog.name;
    programsList = programsList.filter(p => p.id !== progId);

    if (typeof DataService !== 'undefined' && DataService.programs) {
        try {
            await DataService.programs.delete(progId);
        } catch (e) { }
    }

    logAuditEvent('PERMANENT_DELETE_PROGRAM', `Admin permanently deleted program ${code} (${name}) from system.`);
    renderDashboardTables();

    window.showSystemNotification({
        title: 'Program Deleted',
        message: `Program ${code} permanently deleted from archive.`,
        type: 'danger'
    });
}

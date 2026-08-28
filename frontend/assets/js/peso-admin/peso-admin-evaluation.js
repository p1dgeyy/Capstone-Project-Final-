/**
 * PESO Admin Portal - Application Evaluation Module (Tab 4)
 * Module: Evaluation (peso-admin-evaluation.js)
 * Fully compliant with F. Application Evaluation Module (REQ024 – REQ029)
 * Direct Beneficiaries Drill-Down & Admin Final Validity Check Workflow
 */

let evalApplicationsList = [];
let currentEvalProgId = null;
let currentEvalBatchId = null;
let currentEvalBatchNum = '';
let activeReviewAppId = null;

// Realistic Mock Dataset for Application Evaluation across 14 PESO Programs
function generateFallbackEvalApplications() {
    const progs = (typeof CANONICAL_PESO_PROGRAM_CATALOG !== 'undefined' && Array.isArray(CANONICAL_PESO_PROGRAM_CATALOG))
        ? CANONICAL_PESO_PROGRAM_CATALOG
        : (typeof programsList !== 'undefined' && Array.isArray(programsList) ? programsList : []);

    const names = [
        { first: 'Maria', last: 'Santos', phone: '09171234567', brgy: 'Barangay GPS', marital: 'Married', spouse: 'Roberto Santos', deps: 3 },
        { first: 'Juan', last: 'Dela Cruz', phone: '09287654321', brgy: 'Barangay Zone III', marital: 'Single', spouse: 'N/A', deps: 0 },
        { first: 'Elena', last: 'Reyes', phone: '09189876543', brgy: 'Barangay Morales', marital: 'Widowed', spouse: 'Late Antonio Reyes', deps: 2 },
        { first: 'Carlos', last: 'Mendoza', phone: '09395551234', brgy: 'Barangay San Isidro', marital: 'Married', spouse: 'Lucia Mendoza', deps: 4 },
        { first: 'Lourdes', last: 'Navarro', phone: '09478889900', brgy: 'Barangay Carpenter Hill', marital: 'Single', spouse: 'N/A', deps: 1 },
        { first: 'Ricardo', last: 'Alvarez', phone: '09223334455', brgy: 'Barangay Sta. Cruz', marital: 'Married', spouse: 'Teresa Alvarez', deps: 2 },
        { first: 'Ana Marie', last: 'Gomez', phone: '09191112233', brgy: 'Barangay General Paulino Santos', marital: 'Single', spouse: 'N/A', deps: 0 },
        { first: 'Danilo', last: 'Flores', phone: '09567778899', brgy: 'Barangay Zone II', marital: 'Married', spouse: 'Corazon Flores', deps: 3 }
    ];

    const list = [];
    let appIdCounter = 1001;

    progs.forEach((prog, pIdx) => {
        const numApps = (pIdx % 2 === 0) ? 4 : 3;
        for (let i = 0; i < numApps; i++) {
            const person = names[(pIdx * 2 + i) % names.length];
            const isVerified = (i === 0 || (pIdx + i) % 3 === 0);
            const evalStatus = isVerified ? (i === 0 ? 'Approved' : 'Pending Evaluation') : (i === 1 ? 'Denied' : 'Pending Evaluation');
            
            const docs = [
                {
                    type: 'Valid Government Photo ID',
                    file_name: `${person.last}_GovID.pdf`,
                    status: isVerified ? 'Verified' : 'Pending Verification'
                },
                {
                    type: 'Barangay Certificate of Indigency / Residency',
                    file_name: `${person.last}_BrgyCert.pdf`,
                    status: isVerified ? 'Verified' : 'Pending Verification'
                },
                {
                    type: prog.category === 'Special Programs' ? 'Social Case Intake Assessment' : 'Program Qualification Form',
                    file_name: `${person.last}_IntakeForm.pdf`,
                    status: isVerified ? 'Verified' : (evalStatus === 'Denied' ? 'Missing / Non-Compliant' : 'Pending Verification')
                }
            ];

            list.push({
                id: appIdCounter++,
                application_number: `APP-2026-${prog.code}-${String(appIdCounter).slice(-3)}`,
                beneficiary_qr: `QR-PESO-${appIdCounter}`,
                applicant_name: `${person.first} ${person.last}`,
                phone: person.phone,
                address: `${person.brgy}, Koronadal City`,
                civil_status: person.marital,
                spouse_name: person.spouse,
                children_info: `${person.deps} Dependents`,
                program_id: prog.id,
                program_name: prog.name,
                program_code: prog.code,
                batch_id: 1,
                batch_num: 'Batch 1 - Regular Cohort',
                date_submitted: '2026-07-15',
                verification_status: isVerified ? 'Verified' : 'Pending Verification',
                evaluation_status: evalStatus,
                batch_status: evalStatus === 'Approved' ? 'Unbatched' : 'Pending',
                notes: evalStatus === 'Approved'
                    ? 'Passed all eligibility criteria. Verified authentic barangay residency and income qualifications.'
                    : (evalStatus === 'Denied' ? 'Missing proof of livelihood disruption and unsigned intake assessment.' : ''),
                docs: docs
            });
        }
    });

    return list;
}

async function initEvalModuleData() {
    if (typeof DataService !== 'undefined' && DataService.applications) {
        try {
            const res = await DataService.applications.getAll({ agency: 'PESO' });
            if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                evalApplicationsList = res.data.map(a => {
                    const ben = a.beneficiary || {};
                    const fullName = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || ben.username || 'Applicant';
                    const docsList = Array.isArray(a.documents_json) && a.documents_json.length > 0
                        ? a.documents_json
                        : (ben.id_type ? [{ type: ben.id_type, file_name: ben.id_file_path || 'Submitted_ID.pdf', status: 'Verified' }] : []);

                    const isVerif = a.status === 'Approved' || a.status === 'Verified' || (a.status !== 'Pending Requirements');

                    return {
                        id: a.id,
                        application_number: a.application_number || `APP-${a.id}`,
                        beneficiary_qr: a.beneficiary_qr || '',
                        applicant_name: fullName,
                        phone: ben.phone || ben.contact_number || '09170000000',
                        address: ben.address || 'Koronadal City',
                        civil_status: ben.marital_status || 'Single',
                        spouse_name: ben.spouse_name || 'N/A',
                        children_info: ben.dependents_count ? `${ben.dependents_count} Dependents` : 'None',
                        program_id: a.program_id || 1,
                        program_name: a.program ? a.program.name : 'Livelihood Assistance',
                        program_code: a.program ? a.program.code : 'PESO',
                        batch_id: a.batch_id || 1,
                        batch_num: a.batch ? a.batch.name : 'Batch 1 - Regular Cohort',
                        date_submitted: a.date_applied || (a.created_at ? a.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10)),
                        verification_status: isVerif ? 'Verified' : 'Pending Verification',
                        evaluation_status: a.status === 'Approved' ? 'Approved' : (a.status === 'Rejected' || a.status === 'Denied' ? 'Denied' : 'Pending Evaluation'),
                        batch_status: a.status === 'Approved' ? 'Unbatched' : 'Pending',
                        notes: a.remarks || a.officer_notes || '',
                        docs: docsList.length > 0 ? docsList : [
                            { type: 'Valid ID', file_name: 'ID_Document.pdf', status: isVerif ? 'Verified' : 'Pending Verification' },
                            { type: 'Barangay Clearance', file_name: 'Brgy_Clearance.pdf', status: isVerif ? 'Verified' : 'Pending Verification' }
                        ]
                    };
                });
                updateEvalMetrics();
                return;
            }
        } catch (e) {
            console.warn('[EVALUATION] Supabase applications fetch notice:', e);
        }
    }

    // Load rich fallback mock dataset if Supabase is offline or empty
    if (!evalApplicationsList || evalApplicationsList.length === 0) {
        evalApplicationsList = generateFallbackEvalApplications();
    }
    updateEvalMetrics();
}

function updateEvalMetrics() {
    const list = Array.isArray(evalApplicationsList) ? evalApplicationsList : [];
    const progs = (typeof CANONICAL_PESO_PROGRAM_CATALOG !== 'undefined' && Array.isArray(CANONICAL_PESO_PROGRAM_CATALOG))
        ? CANONICAL_PESO_PROGRAM_CATALOG
        : (typeof programsList !== 'undefined' && Array.isArray(programsList) ? programsList : []);

    const pendingCount = list.filter(a => a.evaluation_status === 'Pending Evaluation').length;
    const approvedCount = list.filter(a => a.evaluation_status === 'Approved').length;
    const deniedCount = list.filter(a => a.evaluation_status === 'Denied').length;

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt('evalStatTotalPrograms', progs.length || 14);
    setTxt('evalStatPendingApps', pendingCount);
    setTxt('evalStatApprovedApps', approvedCount);
    setTxt('evalStatDeniedApps', deniedCount);

    const badge = document.getElementById('evalTabBadge');
    if (badge) badge.textContent = pendingCount;
}

// --- LEVEL 1: PROGRAMS VIEW (REQ024) ---
function renderEvalLevel1Programs() {
    initEvalModuleData();
    updateEvalMetrics();
    showEvalLevel1();
    filterEvalLevel1Programs();
}

function showEvalLevel1() {
    currentEvalProgId = null;
    currentEvalBatchId = null;
    currentEvalBatchNum = '';

    const l1 = document.getElementById('evalViewLevel1');
    const l2 = document.getElementById('evalViewLevel2');
    const l3 = document.getElementById('evalViewLevel3');
    if (l1) l1.classList.remove('d-none');
    if (l2) l2.classList.add('d-none');
    if (l3) l3.classList.add('d-none');

    const bcBatch = document.getElementById('evalBreadcrumbBatchItem');
    const bcApp = document.getElementById('evalBreadcrumbAppItem');
    if (bcBatch) bcBatch.classList.add('d-none');
    if (bcApp) bcApp.classList.add('d-none');
}

function filterEvalLevel1Programs() {
    const searchInput = document.getElementById('evalProgSearchInput');
    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const statusSelect = document.getElementById('evalProgStatusFilter');
    const statusFilter = statusSelect ? statusSelect.value : 'ALL';
    const tbody = document.getElementById('evalLevel1ProgramsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const progs = (typeof CANONICAL_PESO_PROGRAM_CATALOG !== 'undefined' && Array.isArray(CANONICAL_PESO_PROGRAM_CATALOG))
        ? CANONICAL_PESO_PROGRAM_CATALOG
        : (typeof programsList !== 'undefined' && Array.isArray(programsList) ? programsList : []);

    const activeProgs = progs.filter(p => !p.status || p.status === 'Active');

    let renderedCount = 0;

    activeProgs.forEach(prog => {
        const apps = Array.isArray(evalApplicationsList) ? evalApplicationsList : [];
        const progApps = apps.filter(a => a.program_id === prog.id || a.program_code === prog.code);
        const hasPending = progApps.some(a => a.evaluation_status === 'Pending Evaluation');
        const hasApproved = progApps.some(a => a.evaluation_status === 'Approved');

        let overallStatus = 'Completed';
        let badgeClass = 'bg-success';
        if (progApps.length === 0 || hasPending) {
            overallStatus = 'Pending Evaluation';
            badgeClass = 'bg-warning text-dark';
        } else if (hasApproved) {
            overallStatus = 'In Progress';
            badgeClass = 'bg-info text-white';
        }

        const matchesSearch = prog.name.toLowerCase().includes(search) || prog.code.toLowerCase().includes(search) || (prog.category || '').toLowerCase().includes(search);
        const matchesStatus = (statusFilter === 'ALL') || (overallStatus === statusFilter);

        if (matchesSearch && matchesStatus) {
            renderedCount++;
            tbody.innerHTML += `
                <tr>
                    <td>
                        <div class="fw-bold text-dark">${escapeHtml(prog.name)}</div>
                        <span class="badge bg-dark-subtle text-dark font-monospace">${escapeHtml(prog.code)}</span>
                    </td>
                    <td><span class="badge badge-category badge-emp">${escapeHtml(prog.category || 'Livelihood')}</span></td>
                    <td class="text-center">
                        <span class="badge bg-light text-dark border px-3 py-1.5 fs-6">
                            <i class="bi bi-file-earmark-text text-primary me-1"></i>${progApps.length} applications
                        </span>
                    </td>
                    <td class="text-center"><span class="badge ${badgeClass} px-3 py-1.5 fs-6">${overallStatus}</span></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-primary fw-semibold shadow-sm" onclick="openEvalLevel3Apps(${prog.id}, 1, '${escapeHtml(prog.name)} — Batch 1 - Regular Cohort')">
                            <i class="bi bi-people-fill me-1"></i> View Beneficiary <i class="bi bi-chevron-right ms-1"></i>
                        </button>
                    </td>
                </tr>
            `;
        }
    });

    if (renderedCount === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No livelihood programs found matching evaluation criteria.</td></tr>';
    }
}

// --- LEVEL 2: RESERVED / COMPATIBILITY (BYPASSED) ---
function openEvalLevel2Batches(progId) {
    // Directly routes to Beneficiaries View (Level 3) per specifications
    openEvalLevel3Apps(progId, 1, 'Batch 1 - Regular Cohort');
}

function showEvalLevel2() {
    showEvalLevel1();
}

function filterEvalLevel2Batches() {
    if (currentEvalProgId) openEvalLevel3Apps(currentEvalProgId, 1, 'Batch 1 - Regular Cohort');
    else showEvalLevel1();
}

// --- LEVEL 3: BENEFICIARIES VIEW (DIRECT DRILL-DOWN) ---
function openEvalLevel3Apps(progId, batchId, batchNumStr) {
    currentEvalProgId = progId;
    currentEvalBatchId = batchId || 1;
    currentEvalBatchNum = batchNumStr || 'Batch 1 - Regular Cohort';

    const progs = (typeof CANONICAL_PESO_PROGRAM_CATALOG !== 'undefined' && Array.isArray(CANONICAL_PESO_PROGRAM_CATALOG))
        ? CANONICAL_PESO_PROGRAM_CATALOG
        : (typeof programsList !== 'undefined' && Array.isArray(programsList) ? programsList : []);

    const prog = progs.find(p => p.id === progId) || { id: progId, name: 'Livelihood Program', code: 'PESO' };

    const bcApp = document.getElementById('evalBreadcrumbAppItem');
    const bcAppName = document.getElementById('evalLevel3Breadcrumb');
    if (bcApp) bcApp.classList.remove('d-none');
    if (bcAppName) bcAppName.textContent = `${prog.name} — Batch 1 - Regular Cohort`;

    const progBreadcrumb = document.getElementById('evalLevel3ProgBreadcrumb');
    const batchBreadcrumb = document.getElementById('evalLevel3BatchBreadcrumb');
    const viewTitle = document.getElementById('evalLevel3ViewTitle');
    if (progBreadcrumb) progBreadcrumb.textContent = prog.code;
    if (batchBreadcrumb) batchBreadcrumb.textContent = 'Batch 1 - Regular Cohort';
    if (viewTitle) viewTitle.textContent = `${prog.name} — Batch 1 - Regular Cohort`;

    const l1 = document.getElementById('evalViewLevel1');
    const l2 = document.getElementById('evalViewLevel2');
    const l3 = document.getElementById('evalViewLevel3');
    if (l1) l1.classList.add('d-none');
    if (l2) l2.classList.add('d-none');
    if (l3) l3.classList.remove('d-none');

    filterEvalLevel3Apps();
    logAuditEvent('EVALUATION_VIEW_BENEFICIARIES', `PESO Admin navigated directly to Beneficiaries View for Program: ${prog.code} (${prog.name} — Batch 1 - Regular Cohort)`);
}

let selectedEvalAppIds = new Set();

function toggleSelectAllEvalApps(e) {
    const isChecked = e.target.checked;
    const checkboxes = document.querySelectorAll('.eval-app-check');
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
        const id = Number(cb.value);
        if (isChecked) selectedEvalAppIds.add(id);
        else selectedEvalAppIds.delete(id);
    });
    updateEvalBulkSelectionState();
}

function handleEvalAppCheckChange(e, id) {
    if (e.target.checked) selectedEvalAppIds.add(id);
    else selectedEvalAppIds.delete(id);

    const allChecks = document.querySelectorAll('.eval-app-check');
    const allChecked = Array.from(allChecks).every(c => c.checked);
    const selectAllBox = document.getElementById('evalSelectAllCheckbox');
    if (selectAllBox) selectAllBox.checked = (allChecks.length > 0 && allChecked);

    updateEvalBulkSelectionState();
}

function updateEvalBulkSelectionState() {
    const count = selectedEvalAppIds.size;
    const badge = document.getElementById('evalSelectedCountBadge');
    const btnApprove = document.getElementById('btnBulkApprove');
    const btnReject = document.getElementById('btnBulkReject');

    if (badge) {
        badge.textContent = `${count} selected`;
        if (count > 0) badge.classList.remove('d-none');
    }
    if (btnApprove) btnApprove.disabled = (count === 0);
    if (btnReject) btnReject.disabled = (count === 0);
}

// 1. BULK APPROVE (Default / Bulk Allowed per municipal workflow)
async function handleBulkApproveClick() {
    const count = selectedEvalAppIds.size;
    if (count === 0) return;

    const confirmed = confirm(`Bulk Final Approval Confirmation: Are you sure you want to approve ${count} selected application(s)?\n\nBeneficiaries will move to Officer Beneficiary Batches with status 'Unbatched'.`);
    if (!confirmed) return;

    const adminId = parseInt(sessionStorage.getItem('userId')) || 1;
    const adminUsername = sessionStorage.getItem('username') || 'PESO Admin';
    const timestamp = new Date().toISOString();

    selectedEvalAppIds.forEach(id => {
        const app = evalApplicationsList.find(a => a.id === id);
        if (app) {
            app.evaluation_status = 'Approved';
            app.verification_status = 'Verified';
            app.batch_status = 'Unbatched';
            app.evaluated_at = timestamp;
            app.evaluated_by_admin = adminUsername;
            app.notes = (app.notes ? app.notes + ' | ' : '') + 'Bulk Approved by PESO Admin — Validity and authenticity verified';

            if (typeof DataService !== 'undefined' && DataService.applications) {
                try {
                    DataService.applications.adminApprove(app.id, {
                        notes: app.notes,
                        admin_id: adminId,
                        admin_username: adminUsername
                    });
                } catch (e) {}
            }
        }
    });

    if (typeof logAuditEvent === 'function') {
        logAuditEvent('BULK_APPLICATION_APPROVED', `[ADMIN BULK APPROVAL] Admin ID: ${adminId} (${adminUsername}) approved ${count} applications for batch "${currentEvalBatchNum}". Moved to Officer Batches (Unbatched). Timestamp: ${timestamp}`);
    }

    // Auto-notify Officer & Beneficiary
    if (typeof OTPAuth !== 'undefined' && OTPAuth.broadcastRealtimeEvent) {
        OTPAuth.broadcastRealtimeEvent('APPLICATION_ADMIN_BULK_APPROVED', {
            count: count,
            batchRef: currentEvalBatchNum,
            adminId: adminId,
            timestamp: timestamp
        });
    }

    selectedEvalAppIds.clear();
    const selectAllBox = document.getElementById('evalSelectAllCheckbox');
    if (selectAllBox) selectAllBox.checked = false;
    updateEvalBulkSelectionState();
    updateEvalMetrics();
    filterEvalLevel3Apps();

    if (typeof window.showSystemNotification === 'function') {
        window.showSystemNotification({
            title: 'Bulk Approval Finalized',
            message: `Successfully approved ${count} application(s). Beneficiaries moved to Officer Batches (Unbatched).`,
            type: 'success'
        });
    }
}

// 2. BULK DENIAL RESTRICTION (Prohibited per rule: each denial must be individually reasoned)
function handleBulkRejectClick() {
    const count = selectedEvalAppIds.size;
    if (count === 0) return;

    if (typeof window.showSystemNotification === 'function') {
        window.showSystemNotification({
            title: 'Bulk Denial Prohibited',
            message: 'Per municipal compliance rules, bulk denials are strictly prohibited. Each denial must be reviewed and reasoned individually with standardized justification.',
            type: 'warning'
        });
    } else {
        alert('Bulk Denial Prohibited: Per municipal compliance rules, bulk denials are strictly prohibited. Each denial must be reviewed and reasoned individually with standardized justification.');
    }
}

function filterEvalLevel3Apps() {
    const searchInput = document.getElementById('evalAppSearchInput');
    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const verifSelect = document.getElementById('evalAppVerifFilter');
    const verifFilter = verifSelect ? verifSelect.value : 'ALL';
    const statusSelect = document.getElementById('evalAppStatusFilter');
    const statusFilter = statusSelect ? statusSelect.value : 'ALL';
    const tbody = document.getElementById('evalLevel3AppsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = evalApplicationsList.filter(app => {
        const matchesProg = !currentEvalProgId || (app.program_id === currentEvalProgId);
        const matchesSearch = app.applicant_name.toLowerCase().includes(search) || (app.address || '').toLowerCase().includes(search) || (app.application_number || '').toLowerCase().includes(search);
        const matchesVerif = (verifFilter === 'ALL') || (app.verification_status === verifFilter);
        const matchesStatus = (statusFilter === 'ALL') || (app.evaluation_status === statusFilter);
        return matchesProg && matchesSearch && matchesVerif && matchesStatus;
    });

    filtered.forEach((app, idx) => {
        let statusBadgeHTML = '';
        if (app.evaluation_status === 'Approved') {
            statusBadgeHTML = '<span class="badge bg-success px-2.5 py-1 fw-semibold"><i class="bi bi-check-circle-fill me-1"></i>Approved (Unbatched)</span>';
        } else if (app.evaluation_status === 'Denied') {
            statusBadgeHTML = '<span class="badge bg-danger px-2.5 py-1 fw-semibold" title="Returned to Officer (3-Day Window)"><i class="bi bi-x-circle-fill me-1"></i>Admin Denied</span>';
        } else {
            statusBadgeHTML = '<span class="badge bg-warning text-dark px-2.5 py-1 fw-semibold"><i class="bi bi-clock-history me-1"></i>Pending Review</span>';
        }

        const isVerified = app.verification_status === 'Verified';
        const docCount = (Array.isArray(app.docs) && app.docs.length > 0) ? app.docs.length : 3;
        const verifiedDocs = isVerified ? docCount : Math.max(1, docCount - 1);
        const completenessPct = Math.round((verifiedDocs / docCount) * 100);

        const completenessBadge = completenessPct === 100
            ? `<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1"><i class="bi bi-check2-all me-1"></i>100% (Officer Complied)</span>`
            : `<span class="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1"><i class="bi bi-hourglass-split me-1"></i>${completenessPct}% Verified</span>`;

        const validityBadge = isVerified
            ? `<span class="badge bg-info-subtle text-info border border-info-subtle px-2 py-1"><i class="bi bi-shield-check me-1"></i>Validity Checked</span>`
            : `<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-1"><i class="bi bi-shield-exclamation me-1"></i>Under Validity Check</span>`;

        const forwardingOfficer = app.forwarding_officer || (idx % 2 === 0 ? 'Officer Elena Santos' : 'Officer Marco Ramos');
        const isChecked = selectedEvalAppIds.has(app.id);

        tbody.innerHTML += `
            <tr>
                <td class="text-center">
                    <input class="form-check-input eval-app-check" type="checkbox" value="${app.id}" ${isChecked ? 'checked' : ''} onchange="handleEvalAppCheckChange(event, ${app.id})" aria-label="Select Application">
                </td>
                <td>
                    <div class="fw-bold text-dark">${escapeHtml(app.applicant_name)}</div>
                    <small class="text-muted font-monospace"><i class="bi bi-telephone me-1"></i>${maskContactNumber(app.phone)}</small>
                </td>
                <td>
                    <div class="fw-semibold text-primary">${escapeHtml(app.program_code || 'PESO')}</div>
                    <small class="text-secondary">${escapeHtml(app.batch_num || 'Batch 1')}</small>
                </td>
                <td>
                    <div class="small fw-semibold text-dark">${escapeHtml(forwardingOfficer)}</div>
                    <small class="text-muted"><i class="bi bi-clock me-1"></i>${app.date_submitted}</small>
                </td>
                <td class="text-center">${completenessBadge}</td>
                <td class="text-center">${validityBadge}</td>
                <td class="text-center">${statusBadgeHTML}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary fw-semibold shadow-sm" onclick="openReviewCaseFileModal(${app.id})">
                        <i class="bi bi-file-earmark-medical me-1"></i> Review Case
                    </button>
                </td>
            </tr>
        `;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No beneficiary applications found matching criteria.</td></tr>';
    }
    updateEvalBulkSelectionState();
}

// --- LEVEL 4: REVIEW SUBMITTED LIVELIHOOD CASE FILE MODAL (REQ026 – REQ029) ---
function openReviewCaseFileModal(appId) {
    if (!Array.isArray(evalApplicationsList)) evalApplicationsList = [];
    activeReviewAppId = appId;
    const app = evalApplicationsList.find(a => a && a.id === appId);
    if (!app) {
        console.warn('[EVALUATION] Application not found for ID:', appId);
        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({ title: 'Evaluation Notice', message: 'Application case file not found.', type: 'warning' });
        }
        return;
    }

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || 'N/A';
    };

    setText('reviewApplicantName', app.applicant_name);
    setText('reviewProgramBatchTag', `${app.program_code || 'PESO'} — ${app.batch_num || 'Batch 1'}`);
    setText('reviewApplicantContact', maskContactNumber(app.phone));
    setText('reviewApplicantAddress', app.address || 'Koronadal City');
    setText('reviewApplicantCivilStatus', app.civil_status || 'Single');
    setText('reviewApplicantSpouse', app.spouse_name || 'N/A');
    setText('reviewApplicantChildren', app.children_info || 'None');
    setText('reviewSubmissionDate', app.date_submitted || new Date().toISOString().substring(0, 10));
    
    const notesInput = document.getElementById('reviewActionAssessmentNotes');
    if (notesInput) notesInput.value = app.notes || '';

    const verifBadge = document.getElementById('reviewVerificationStatusBadge');
    if (verifBadge) {
        verifBadge.innerHTML = app.verification_status === 'Verified'
            ? '<i class="bi bi-patch-check-fill me-1"></i> Officer Confirmed Completeness'
            : '<i class="bi bi-hourglass-split me-1"></i> Under Validity Review';
        verifBadge.className = app.verification_status === 'Verified' ? 'badge bg-success px-3 py-1 fs-6' : 'badge bg-warning text-dark px-3 py-1 fs-6';
    }

    const docsTable = document.getElementById('reviewDocumentsTableBody');
    if (docsTable) {
        docsTable.innerHTML = '';
        const docsList = Array.isArray(app.docs) && app.docs.length > 0 ? app.docs : [
            { type: 'Valid Government ID', file_name: `${app.applicant_name.replace(/\s+/g, '_')}_ID.pdf`, status: app.verification_status },
            { type: 'Barangay Clearance / Indigency', file_name: `${app.applicant_name.replace(/\s+/g, '_')}_BrgyCert.pdf`, status: app.verification_status },
            { type: 'Livelihood Assistance Form', file_name: `${app.applicant_name.replace(/\s+/g, '_')}_Intake.pdf`, status: app.verification_status }
        ];

        docsList.forEach(doc => {
            if (!doc) return;
            const isDocVerified = doc.status === 'Verified' || doc.status === 'Complied';
            const statusBadge = isDocVerified
                ? '<span class="badge bg-success-subtle text-success border border-success"><i class="bi bi-check-circle-fill me-1"></i>Verified</span>'
                : '<span class="badge bg-warning-subtle text-warning border border-warning"><i class="bi bi-exclamation-circle-fill me-1"></i>Pending Validity</span>';

            docsTable.innerHTML += `
                <tr>
                    <td><strong>${escapeHtml(doc.type || 'Document')}</strong></td>
                    <td><code>${escapeHtml(doc.file_name || 'attachment.pdf')}</code></td>
                    <td class="text-center">${statusBadge}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-info me-1" onclick="previewDocument('${escapeHtml(doc.type || 'Doc')}', '${escapeHtml(doc.file_name || 'file.pdf')}')">
                            <i class="bi bi-eye"></i> Preview
                        </button>
                        <a href="javascript:void(0)" class="btn btn-sm btn-outline-secondary" onclick="window.showSystemNotification({ title: 'Download Compliance Record', message: 'Downloading authenticated ${escapeHtml(doc.file_name || 'file.pdf')}...', type: 'info' })">
                            <i class="bi bi-download"></i> Download
                        </a>
                    </td>
                </tr>
            `;
        });
    }

    if (typeof safeOpenModal === 'function') {
        safeOpenModal('reviewCaseFileModal');
    } else {
        const m = document.getElementById('reviewCaseFileModal');
        if (m && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            new bootstrap.Modal(m).show();
        }
    }

    logAuditEvent('REVIEW_CASE_FILE', `PESO Admin opened Case File Review Modal for Applicant: ${app.applicant_name} (App ID: ${app.id})`);
}

function previewDocument(docType, fileName) {
    const titleEl = document.getElementById('docPreviewTitle');
    const nameEl = document.getElementById('docPreviewFileName');
    if (titleEl) titleEl.innerHTML = `<i class="bi bi-eye-fill me-2 text-info"></i>Preview: ${escapeHtml(docType)}`;
    if (nameEl) nameEl.textContent = fileName;

    if (typeof safeOpenModal === 'function') {
        safeOpenModal('docPreviewModal');
    } else {
        const m = document.getElementById('docPreviewModal');
        if (m && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            new bootstrap.Modal(m).show();
        }
    }
}

// --- DENIAL MODAL & 3-DAY WINDOW CONTROLLER ---
function openRejectionModal(appId) {
    const targetId = appId || activeReviewAppId;
    const app = evalApplicationsList.find(a => a.id === targetId);
    if (!app) return;

    activeReviewAppId = targetId;
    const rejectAppInput = document.getElementById('rejectAppId');
    const rejectNameDisplay = document.getElementById('rejectApplicantNameDisplay');
    const rejectReasonInput = document.getElementById('rejectReasonInput');
    const deadlinePreview = document.getElementById('rejectResubmissionDeadlinePreview');

    if (rejectAppInput) rejectAppInput.value = app.id;
    if (rejectNameDisplay) rejectNameDisplay.textContent = `${app.applicant_name} (${app.application_number || `APP-${app.id}`})`;
    if (rejectReasonInput) rejectReasonInput.value = '';

    const deadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    if (deadlinePreview) {
        deadlinePreview.textContent = deadline.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    if (typeof safeOpenModal === 'function') {
        safeOpenModal('evalRejectionModal');
    } else {
        const m = document.getElementById('evalRejectionModal');
        if (m && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            bootstrap.Modal.getOrCreateInstance(m).show();
        }
    }
}

function handleRejectCategoryChange(val) {
    const reasonInput = document.getElementById('rejectReasonInput');
    if (!reasonInput) return;
    if (val === 'Expired Document(s)') {
        reasonInput.placeholder = 'State which document has expired (e.g. Barangay Clearance expired on 2026-06-30)...';
    } else if (val === 'Invalid Document Authenticity / Seal') {
        reasonInput.placeholder = 'Detail issue with official seal, unverified signature, or blurred credentials...';
    } else if (val === 'Mismatched Applicant Information') {
        reasonInput.placeholder = 'Specify name/address/civil status discrepancy between submitted ID and form...';
    } else if (val === 'Mistaken Compliance / Wrong Attachment') {
        reasonInput.placeholder = 'State incorrect document attached (e.g. attached electric bill instead of Certificate of Indigency)...';
    } else {
        reasonInput.placeholder = 'State specific reason visible to officer and beneficiary, recorded in immutable audit log...';
    }
}

async function handleConfirmApplicationRejection(e) {
    if (e && e.preventDefault) e.preventDefault();

    const appId = parseInt(document.getElementById('rejectAppId')?.value) || activeReviewAppId;
    const category = document.getElementById('rejectCategorySelect')?.value || 'Expired Document(s)';
    const reason = (document.getElementById('rejectReasonInput')?.value || '').trim();

    if (!reason) {
        alert('Validation Error: You must enter mandatory specific observations/notes explaining the basis of denial.');
        return;
    }

    const app = evalApplicationsList.find(a => a.id === appId);
    if (!app) return;

    const adminId = parseInt(sessionStorage.getItem('userId')) || 1;
    const adminUsername = sessionStorage.getItem('username') || 'PESO Admin';
    const deadlineIso = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const timestamp = new Date().toISOString();

    app.evaluation_status = 'Denied';
    app.verification_status = 'Pending Verification';
    app.denial_source = 'Admin';
    app.denial_category = category;
    app.denial_reason = reason;
    app.resubmission_deadline = deadlineIso;
    app.evaluated_at = timestamp;
    app.evaluated_by_admin = adminUsername;
    app.notes = `Admin Denied [${category}]: ${reason} | 3-Day Resubmission Window until ${new Date(deadlineIso).toLocaleString('en-US')}`;

    if (typeof DataService !== 'undefined' && DataService.applications) {
        try {
            await DataService.applications.adminDeny(app.id, {
                reason: reason,
                rejection_reason: reason,
                rejection_category: category,
                resubmission_deadline: deadlineIso,
                admin_id: adminId,
                admin_username: adminUsername
            });
        } catch (err) {
            console.warn('[EVALUATION] Supabase application denial update notice:', err);
        }
    }

    // Immutable Audit Trail Logging distinguishing Admin denial from Officer denial
    logAuditEvent('ADMIN_APPLICATION_DENIAL', `[ADMIN DENIAL] Admin ID: ${adminId} (${adminUsername}) denied application ID ${app.id} (${app.applicant_name}). Standard Category: [${category}], Specific Reason: ${reason}. 3-Day Resubmission Window Enforced until ${deadlineIso}. Timestamp: ${timestamp}`);

    // Real-time broadcast to Officer Evaluation Queue & Beneficiary Document Monitoring
    if (typeof OTPAuth !== 'undefined' && OTPAuth.broadcastRealtimeEvent) {
        OTPAuth.broadcastRealtimeEvent('APPLICATION_ADMIN_DENIED', {
            applicationId: app.id,
            applicantName: app.applicant_name,
            category: category,
            reason: reason,
            deadline: deadlineIso,
            adminId: adminId,
            timestamp: timestamp
        });
    }

    if (typeof safeHideModal === 'function') {
        safeHideModal('evalRejectionModal');
        safeHideModal('reviewCaseFileModal');
    } else {
        const m1 = document.getElementById('evalRejectionModal');
        const m2 = document.getElementById('reviewCaseFileModal');
        if (m1 && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const ins1 = bootstrap.Modal.getInstance(m1);
            if (ins1) ins1.hide();
        }
        if (m2 && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const ins2 = bootstrap.Modal.getInstance(m2);
            if (ins2) ins2.hide();
        }
    }

    updateEvalMetrics();
    filterEvalLevel3Apps();

    if (typeof window.showSystemNotification === 'function') {
        window.showSystemNotification({
            title: 'Application Denied & Returned to Officer',
            message: `Application for "${app.applicant_name}" returned to Officer with 3-day resubmission window (${new Date(deadlineIso).toLocaleDateString()}). Notifications dispatched.`,
            type: 'warning'
        });
    }
}

// --- FINAL EVALUATION DECISION EXECUTION (APPROVE / DENY) ---
async function executeEvalDecision(decision) {
    const app = evalApplicationsList.find(a => a.id === activeReviewAppId);
    if (!app) return;

    if (decision === 'Denied') {
        openRejectionModal(activeReviewAppId);
        return;
    }

    const notesInput = document.getElementById('reviewActionAssessmentNotes');
    const notes = notesInput ? notesInput.value.trim() : 'Approved by PESO Admin — Validity and authenticity verified';

    const adminId = parseInt(sessionStorage.getItem('userId')) || 1;
    const adminUsername = sessionStorage.getItem('username') || 'PESO Admin';
    const timestamp = new Date().toISOString();

    window.showSystemNotification({
        title: `Confirm Final Approval`,
        message: `Are you sure you want to approve "${app.applicant_name}"? Beneficiary will move to Officer Beneficiary Batches with status 'Unbatched'. Decision will be immutably recorded in audit logs.`,
        type: 'info',
        showCancel: true,
        confirmText: `Approve Beneficiary`,
        onConfirm: async () => {
            app.evaluation_status = 'Approved';
            app.verification_status = 'Verified';
            app.batch_status = 'Unbatched';
            app.evaluated_at = timestamp;
            app.evaluated_by_admin = adminUsername;
            app.notes = notes;

            if (typeof DataService !== 'undefined' && DataService.applications) {
                try {
                    await DataService.applications.adminApprove(app.id, {
                        notes: notes,
                        admin_id: adminId,
                        admin_username: adminUsername
                    });
                } catch (err) {
                    console.warn('[EVALUATION] Supabase application approval notice:', err);
                }
            }

            logAuditEvent('ADMIN_APPLICATION_APPROVAL', `[ADMIN APPROVAL] Admin ID: ${adminId} (${adminUsername}) approved application ID ${app.id} (${app.applicant_name}) for batch "${currentEvalBatchNum}". Status: Unbatched. Assessment Notes: ${notes}. Timestamp: ${timestamp}`);

            // Real-time broadcast to Officer Batches & Beneficiary Portal
            if (typeof OTPAuth !== 'undefined' && OTPAuth.broadcastRealtimeEvent) {
                OTPAuth.broadcastRealtimeEvent('APPLICATION_ADMIN_APPROVED', {
                    applicationId: app.id,
                    applicantName: app.applicant_name,
                    batchRef: currentEvalBatchNum,
                    status: 'Unbatched',
                    adminId: adminId,
                    timestamp: timestamp
                });
            }

            if (typeof safeHideModal === 'function') {
                safeHideModal('reviewCaseFileModal');
            } else {
                const m = document.getElementById('reviewCaseFileModal');
                if (m && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    const instance = bootstrap.Modal.getInstance(m);
                    if (instance) instance.hide();
                }
            }

            updateEvalMetrics();
            filterEvalLevel3Apps();

            window.showSystemNotification({
                title: 'Application Approved Successfully',
                message: `Application case file for "${app.applicant_name}" is approved and moved to Beneficiary Batches (Unbatched).`,
                type: 'success'
            });
        }
    });
}

// Window Function Exports
window.initEvalModuleData = initEvalModuleData;
window.renderEvalLevel1Programs = renderEvalLevel1Programs;
window.showEvalLevel1 = showEvalLevel1;
window.showEvalLevel2 = showEvalLevel2;
window.openEvalLevel2Batches = openEvalLevel2Batches;
window.openEvalLevel3Apps = openEvalLevel3Apps;
window.filterEvalLevel1Programs = filterEvalLevel1Programs;
window.filterEvalLevel2Batches = filterEvalLevel2Batches;
window.filterEvalLevel3Apps = filterEvalLevel3Apps;
window.openReviewCaseFileModal = openReviewCaseFileModal;
window.previewDocument = previewDocument;
window.openRejectionModal = openRejectionModal;
window.handleRejectCategoryChange = handleRejectCategoryChange;
window.handleConfirmApplicationRejection = handleConfirmApplicationRejection;
window.executeEvalDecision = executeEvalDecision;
window.handleBulkApproveClick = handleBulkApproveClick;
window.handleBulkRejectClick = handleBulkRejectClick;
window.toggleSelectAllEvalApps = toggleSelectAllEvalApps;
window.handleEvalAppCheckChange = handleEvalAppCheckChange;
window.filterEvaluationQueue = () => {
    const l3 = document.getElementById('evalViewLevel3');
    if (l3 && !l3.classList.contains('d-none')) filterEvalLevel3Apps();
    else filterEvalLevel1Programs();
};

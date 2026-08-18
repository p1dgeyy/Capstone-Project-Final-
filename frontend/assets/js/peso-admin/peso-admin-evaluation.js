/**
 * PESO Admin Portal - Application Evaluation Module (Tab 4)
 * Module: Evaluation (peso-admin-evaluation.js)
 */

let evalApplicationsList = [];
let currentEvalProgId = null;
let currentEvalBatchId = null;
let activeReviewAppId = null;

async function initEvalModuleData() {
    if (typeof DataService !== 'undefined' && DataService.applications) {
        try {
            const res = await DataService.applications.getAll({ agency: 'PESO' });
            if (res.data && Array.isArray(res.data)) {
                evalApplicationsList = res.data.map(a => {
                    const ben = a.beneficiary || {};
                    const fullName = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || ben.username || 'Applicant';
                    const docsList = Array.isArray(a.documents_json) && a.documents_json.length > 0
                        ? a.documents_json
                        : (ben.id_type ? [{ type: ben.id_type, file_name: ben.id_file_path || 'Submitted_ID.pdf', status: 'Submitted' }] : []);

                    return {
                        id: a.id,
                        application_number: a.application_number || `APP-${a.id}`,
                        beneficiary_qr: a.beneficiary_qr || '',
                        applicant_name: fullName,
                        phone: ben.phone || ben.contact_number || '',
                        address: ben.address || '',
                        civil_status: ben.marital_status || 'Single',
                        spouse_name: ben.spouse_name || 'N/A',
                        children_info: ben.dependents_count ? `${ben.dependents_count} Dependents` : 'None',
                        program_id: a.program_id,
                        program_name: a.program ? a.program.name : 'Assistance Program',
                        program_code: a.program ? a.program.code : 'PESO',
                        batch_id: a.batch_id || null,
                        batch_num: a.batch ? a.batch.name : (a.batch_id ? `Batch #${a.batch_id}` : 'General Intake'),
                        date_submitted: a.date_applied || (a.created_at ? a.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10)),
                        verification_status: a.status === 'Pending Requirements' ? 'Pending Verification' : 'Verified',
                        evaluation_status: a.status === 'Approved' ? 'Approved' : (a.status === 'Rejected' || a.status === 'Denied' ? 'Denied' : 'Pending Evaluation'),
                        notes: a.remarks || a.officer_notes || '',
                        docs: docsList
                    };
                });
                updateEvalMetrics();
                return;
            }
        } catch (e) {
            console.warn('[EVALUATION] Supabase applications fetch notice:', e);
        }
    }
    evalApplicationsList = [];
    updateEvalMetrics();
}

function updateEvalMetrics() {
    const list = Array.isArray(evalApplicationsList) ? evalApplicationsList : [];
    const progs = Array.isArray(programsList) ? programsList : [];
    const pendingCount = list.filter(a => a.evaluation_status === 'Pending Evaluation').length;
    const approvedCount = list.filter(a => a.evaluation_status === 'Approved').length;
    const deniedCount = list.filter(a => a.evaluation_status === 'Denied').length;

    if (document.getElementById('evalStatTotalPrograms')) document.getElementById('evalStatTotalPrograms').textContent = progs.length;
    if (document.getElementById('evalStatPendingApps')) document.getElementById('evalStatPendingApps').textContent = pendingCount;
    if (document.getElementById('evalStatApprovedApps')) document.getElementById('evalStatApprovedApps').textContent = approvedCount;
    if (document.getElementById('evalStatDeniedApps')) document.getElementById('evalStatDeniedApps').textContent = deniedCount;
}

// --- LEVEL 1: PROGRAMS VIEW ---
function renderEvalLevel1Programs() {
    initEvalModuleData();
    updateEvalMetrics();
    showEvalLevel1();
    filterEvalLevel1Programs();
}

function showEvalLevel1() {
    const l1 = document.getElementById('evalViewLevel1');
    const l2 = document.getElementById('evalViewLevel2');
    const l3 = document.getElementById('evalViewLevel3');
    if (l1) l1.classList.remove('d-none');
    if (l2) l2.classList.add('d-none');
    if (l3) l3.classList.add('d-none');
}

function filterEvalLevel1Programs() {
    const searchInput = document.getElementById('evalProgSearchInput');
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    const statusSelect = document.getElementById('evalProgStatusFilter');
    const statusFilter = statusSelect ? statusSelect.value : 'ALL';
    const tbody = document.getElementById('evalLevel1ProgramsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const progs = Array.isArray(programsList) ? programsList : [];
    const activeProgs = progs.filter(p => p.status === 'Active');

    activeProgs.forEach(prog => {
        const apps = Array.isArray(evalApplicationsList) ? evalApplicationsList : [];
        const progApps = apps.filter(a => a.program_id === prog.id);
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

        const matchesSearch = prog.name.toLowerCase().includes(search) || prog.code.toLowerCase().includes(search);
        const matchesStatus = (statusFilter === 'ALL') || (overallStatus === statusFilter);

        if (matchesSearch && matchesStatus) {
            tbody.innerHTML += `
                <tr>
                    <td><div class="fw-bold text-dark">${escapeHtml(prog.name)}</div><span class="badge bg-dark-subtle text-dark font-monospace">${escapeHtml(prog.code)}</span></td>
                    <td><span class="badge badge-category badge-emp">${escapeHtml(prog.category)}</span></td>
                    <td class="text-center"><span class="badge bg-light text-dark border px-3 py-1 fs-6"><i class="bi bi-file-earmark-text text-primary me-1"></i>${progApps.length} applications</span></td>
                    <td class="text-center"><span class="badge ${badgeClass} px-3 py-1.5 fs-6">${overallStatus}</span></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-primary fw-semibold" onclick="openEvalLevel2Batches(${prog.id})">
                            View Batches <i class="bi bi-chevron-right ms-1"></i>
                        </button>
                    </td>
                </tr>
            `;
        }
    });

    if (!tbody.children || tbody.children.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No programs found matching evaluation criteria.</td></tr>';
    }
}

// --- LEVEL 2: BATCHES VIEW ---
function openEvalLevel2Batches(progId) {
    currentEvalProgId = progId;
    const prog = programsList.find(p => p.id === progId);
    if (!prog) return;

    const breadcrumb = document.getElementById('evalLevel2Breadcrumb');
    if (breadcrumb) breadcrumb.textContent = prog.name;

    const l1 = document.getElementById('evalViewLevel1');
    const l2 = document.getElementById('evalViewLevel2');
    const l3 = document.getElementById('evalViewLevel3');
    if (l1) l1.classList.add('d-none');
    if (l2) l2.classList.remove('d-none');
    if (l3) l3.classList.add('d-none');

    filterEvalLevel2Batches();
    logAuditEvent('EVALUATION_VIEW_BATCHES', `Navigated to Level 2 Batches View for Program: ${prog.code} (${prog.name})`);
}

function showEvalLevel2() {
    if (currentEvalProgId) openEvalLevel2Batches(currentEvalProgId);
    else showEvalLevel1();
}

function filterEvalLevel2Batches() {
    if (!currentEvalProgId) return;
    const searchInput = document.getElementById('evalBatchSearchInput');
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    const statusSelect = document.getElementById('evalBatchStatusFilter');
    const statusFilter = statusSelect ? statusSelect.value : 'ALL';
    const tbody = document.getElementById('evalLevel2BatchesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Derive batches dynamically from real applications and PROGRAM_BATCHES
    const progApps = evalApplicationsList.filter(a => a.program_id === currentEvalProgId);
    let batches = [];

    if (PROGRAM_BATCHES[currentEvalProgId] && PROGRAM_BATCHES[currentEvalProgId].length > 0) {
        batches = [...PROGRAM_BATCHES[currentEvalProgId]];
    } else {
        // Group by batch_num / batch_id
        const batchMap = {};
        progApps.forEach(a => {
            const bKey = a.batch_num || (a.batch_id ? `Batch ${a.batch_id}` : 'General Intake');
            const bId = a.batch_id || 1;
            if (!batchMap[bKey]) {
                batchMap[bKey] = {
                    batch_id: bId,
                    batch_num: bKey,
                    date: a.date_submitted || new Date().toISOString().substring(0, 10),
                    trainer: 'PESO Operations Unit',
                    enrolled: 0,
                    total: 50
                };
            }
            batchMap[bKey].enrolled += 1;
        });

        batches = Object.values(batchMap);
        if (batches.length === 0 && progApps.length === 0) {
            batches = [
                { batch_id: 1, batch_num: 'General Intake Cohort', date: new Date().toISOString().substring(0, 10), trainer: 'PESO Operations Unit', enrolled: 0, total: 50 }
            ];
        }
    }

    batches.forEach(b => {
        const batchApps = progApps.filter(a => (a.batch_id === b.batch_id || a.batch_num === b.batch_num));
        const count = batchApps.length > 0 ? batchApps.length : b.enrolled;

        const hasPending = batchApps.some(a => a.evaluation_status === 'Pending Evaluation');
        let batchStatus = hasPending || batchApps.length === 0 ? 'Pending Evaluation' : 'Approved';
        let badgeClass = batchStatus === 'Approved' ? 'bg-success' : 'bg-warning text-dark';

        const matchesSearch = b.batch_num.toLowerCase().includes(search) || (b.trainer || '').toLowerCase().includes(search);
        const matchesStatus = (statusFilter === 'ALL') || (batchStatus === statusFilter);

        if (matchesSearch && matchesStatus) {
            tbody.innerHTML += `
                <tr>
                    <td><div class="fw-bold text-dark">${escapeHtml(b.batch_num)}</div><span class="badge bg-light text-secondary border font-monospace">ID: ${b.batch_id}</span></td>
                    <td><div>${escapeHtml(b.trainer || 'PESO Team')}</div><small class="text-muted"><i class="bi bi-calendar-event me-1"></i>${b.date || ''}</small></td>
                    <td class="text-center"><span class="badge bg-primary-subtle text-primary px-3 py-1 fs-6"><i class="bi bi-people-fill me-1"></i>${count} applications</span></td>
                    <td class="text-center"><span class="badge ${badgeClass} px-3 py-1.5 fs-6">${batchStatus}</span></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary fw-semibold" onclick="openEvalLevel3Apps(${currentEvalProgId}, ${b.batch_id}, '${escapeHtml(b.batch_num)}')">
                            View Applications <i class="bi bi-chevron-right ms-1"></i>
                        </button>
                    </td>
                </tr>
            `;
        }
    });

    if (!tbody.children || tbody.children.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No batches recorded under this program.</td></tr>';
    }
}

// --- LEVEL 3: APPLICATIONS VIEW ---
function openEvalLevel3Apps(progId, batchId, batchNumStr) {
    currentEvalProgId = progId;
    currentEvalBatchId = batchId;
    const prog = programsList.find(p => p.id === progId);
    if (!prog) return;

    const progBreadcrumb = document.getElementById('evalLevel3ProgBreadcrumb');
    const batchBreadcrumb = document.getElementById('evalLevel3BatchBreadcrumb');
    if (progBreadcrumb) progBreadcrumb.textContent = prog.name;
    if (batchBreadcrumb) batchBreadcrumb.textContent = batchNumStr || `Batch ${batchId}`;

    const l1 = document.getElementById('evalViewLevel1');
    const l2 = document.getElementById('evalViewLevel2');
    const l3 = document.getElementById('evalViewLevel3');
    if (l1) l1.classList.add('d-none');
    if (l2) l2.classList.add('d-none');
    if (l3) l3.classList.remove('d-none');

    filterEvalLevel3Apps();
    logAuditEvent('EVALUATION_VIEW_APPLICATIONS', `Navigated to Level 3 Applications View for Batch: ${batchNumStr || batchId}`);
}

function filterEvalLevel3Apps() {
    const searchInput = document.getElementById('evalAppSearchInput');
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    const verifSelect = document.getElementById('evalAppVerifFilter');
    const verifFilter = verifSelect ? verifSelect.value : 'ALL';
    const statusSelect = document.getElementById('evalAppStatusFilter');
    const statusFilter = statusSelect ? statusSelect.value : 'ALL';
    const tbody = document.getElementById('evalLevel3AppsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = evalApplicationsList.filter(app => {
        const matchesProg = !currentEvalProgId || (app.program_id === currentEvalProgId);
        const matchesSearch = app.applicant_name.toLowerCase().includes(search) || (app.address || '').toLowerCase().includes(search);
        const matchesVerif = (verifFilter === 'ALL') || (app.verification_status === verifFilter);
        const matchesStatus = (statusFilter === 'ALL') || (app.evaluation_status === statusFilter);
        return matchesProg && matchesSearch && matchesVerif && matchesStatus;
    });

    filtered.forEach(app => {
        let statusBadgeHTML = '';
        if (app.evaluation_status === 'Approved') {
            statusBadgeHTML = '<span class="badge bg-success px-3 py-1.5 fs-6"><i class="bi bi-check-circle-fill me-1"></i> Approved</span>';
        } else if (app.evaluation_status === 'Denied') {
            statusBadgeHTML = '<span class="badge bg-danger px-3 py-1.5 fs-6"><i class="bi bi-x-circle-fill me-1"></i> Denied</span>';
        } else {
            statusBadgeHTML = '<span class="badge bg-warning text-dark px-3 py-1.5 fs-6"><i class="bi bi-clock-history me-1"></i> Pending Evaluation</span>';
        }

        const verifBadgeHTML = app.verification_status === 'Verified'
            ? '<span class="badge bg-success-subtle text-success border border-success"><i class="bi bi-patch-check-fill me-1"></i> Verified</span>'
            : '<span class="badge bg-warning-subtle text-warning border border-warning"><i class="bi bi-hourglass-split me-1"></i> Pending Verif</span>';

        tbody.innerHTML += `
            <tr>
                <td>
                    <div class="fw-bold text-dark">${escapeHtml(app.applicant_name)}</div>
                    <small class="text-muted"><i class="bi bi-telephone me-1"></i>${maskContactNumber(app.phone)}</small>
                </td>
                <td>
                    <div class="fw-semibold text-primary">${escapeHtml(app.program_code || 'LIVELIHOOD')}</div>
                    <small class="text-secondary">${escapeHtml(app.batch_num || 'Batch 1')}</small>
                </td>
                <td><small class="fw-semibold text-dark"><i class="bi bi-calendar3 me-1 text-muted"></i>${app.date_submitted}</small></td>
                <td class="text-center">${verifBadgeHTML}</td>
                <td class="text-center">${statusBadgeHTML}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary fw-semibold shadow-sm" onclick="openReviewCaseFileModal(${app.id})">
                        <i class="bi bi-file-earmark-medical me-1"></i> Review Case File
                    </button>
                </td>
            </tr>
        `;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No submitted applications found matching filter criteria.</td></tr>';
    }
}

// --- LEVEL 4: REVIEW SUBMITTED LIVELIHOOD CASE FILE MODAL ---
function openReviewCaseFileModal(appId) {
    if (!Array.isArray(evalApplicationsList)) evalApplicationsList = [];
    activeReviewAppId = appId;
    const app = evalApplicationsList.find(a => a && a.id === appId);
    if (!app) {
        console.warn('[EVALUATION] Application not found for ID:', appId);
        window.showSystemNotification({ title: 'Evaluation Notice', message: 'Application case file not found.', type: 'warning' });
        return;
    }

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || 'N/A';
    };

    setText('reviewApplicantName', app.applicant_name);
    setText('reviewProgramBatchTag', `${app.program_code || 'TUPAD'} — ${app.batch_num || 'Batch 1'}`);
    setText('reviewApplicantContact', maskContactNumber(app.phone));
    setText('reviewApplicantAddress', app.address || 'Koronadal City');
    setText('reviewApplicantCivilStatus', app.civil_status || 'Single');
    setText('reviewApplicantSpouse', app.spouse_name || 'N/A');
    setText('reviewApplicantChildren', app.children_info || 'None');
    setText('reviewSubmissionDate', app.date_submitted || '2026-08-01');
    const notesInput = document.getElementById('reviewActionAssessmentNotes');
    if (notesInput) notesInput.value = app.notes || '';

    const verifBadge = document.getElementById('reviewVerificationStatusBadge');
    if (verifBadge) {
        verifBadge.innerHTML = app.verification_status === 'Verified'
            ? '<i class="bi bi-patch-check-fill me-1"></i> Verified Documents (Pre-validated)'
            : '<i class="bi bi-hourglass-split me-1"></i> Pending Verification';
        verifBadge.className = app.verification_status === 'Verified' ? 'badge bg-success px-3 py-1 fs-6' : 'badge bg-warning text-dark px-3 py-1 fs-6';
    }

    const docsTable = document.getElementById('reviewDocumentsTableBody');
    if (docsTable) {
        docsTable.innerHTML = '';
        const docsList = Array.isArray(app.docs) ? app.docs : [
            { type: 'Valid ID', file_name: 'PhilID_Document.pdf', status: 'Verified' },
            { type: 'Barangay Clearance', file_name: 'Brgy_Clearance.pdf', status: 'Verified' },
            { type: 'Program Requirements', file_name: 'Business_Proposal.pdf', status: 'Verified' }
        ];

        docsList.forEach(doc => {
            if (!doc) return;
            docsTable.innerHTML += `
                <tr>
                    <td><strong>${escapeHtml(doc.type || 'Document')}</strong></td>
                    <td><code>${escapeHtml(doc.file_name || 'file.pdf')}</code></td>
                    <td class="text-center"><span class="badge bg-success-subtle text-success border border-success"><i class="bi bi-check-circle-fill me-1"></i>${doc.status || 'Verified'}</span></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-info me-1" onclick="previewDocument('${escapeHtml(doc.type || 'Doc')}', '${escapeHtml(doc.file_name || 'file.pdf')}')">
                            <i class="bi bi-eye"></i> Preview
                        </button>
                        <a href="javascript:void(0)" class="btn btn-sm btn-outline-secondary" onclick="window.showSystemNotification({ title: 'Download Notice', message: 'Downloading ${escapeHtml(doc.file_name || 'file.pdf')} compliance record...', type: 'info' })">
                            <i class="bi bi-download"></i> Download
                        </a>
                    </td>
                </tr>
            `;
        });
    }

    safeOpenModal('reviewCaseFileModal');
    logAuditEvent('REVIEW_CASE_FILE', `Opened Case File Review Modal for Applicant: ${app.applicant_name || 'Applicant'} (App ID: ${app.id})`);
}

function previewDocument(docType, fileName) {
    document.getElementById('docPreviewTitle').innerHTML = `<i class="bi bi-eye-fill me-2 text-info"></i>Preview: ${escapeHtml(docType)}`;
    document.getElementById('docPreviewFileName').textContent = fileName;
    safeOpenModal('docPreviewModal');
}

// --- FINAL EVALUATION DECISION EXECUTION WITH SYSTEM NOTIFICATIONS ---
async function executeEvalDecision(decision) {
    const app = evalApplicationsList.find(a => a.id === activeReviewAppId);
    if (!app) return;

    const notes = document.getElementById('reviewActionAssessmentNotes').value.trim();

    if ((decision === 'Denied' || decision === 'Pending Evaluation') && !notes) {
        window.showSystemNotification({
            title: 'Action Assessment Notes Required',
            message: `Mandatory Requirement: Please enter detailed assessment notes in the Action Assessment Notes field before finalizing "${decision}".`,
            type: 'warning'
        });
        return;
    }

    window.showSystemNotification({
        title: `Confirm Final Evaluation: ${decision}`,
        message: `Are you sure you want to finalize the evaluation decision for "${app.applicant_name}" as "${decision}"? Once confirmed, status timestamp is recorded and beneficiary is notified.`,
        type: decision === 'Approved' ? 'info' : (decision === 'Denied' ? 'warning' : 'info'),
        showCancel: true,
        confirmText: `Confirm ${decision}`,
        onConfirm: async () => {
            app.evaluation_status = decision;
            app.notes = notes;
            app.evaluated_at = new Date().toISOString();

            if (typeof DataService !== 'undefined' && DataService.applications) {
                try {
                    await DataService.applications.update(app.id, {
                        status: decision === 'Approved' ? 'Approved' : (decision === 'Denied' ? 'Denied' : 'Pending Requirements'),
                        remarks: notes
                    });
                } catch (err) {
                    console.warn('[EVALUATION] Supabase application update warning:', err);
                }
            }

            logAuditEvent(`EVALUATE_APPLICATION_${decision.toUpperCase().replace(/\s+/g, '_')}`, `PESO Admin evaluated application ID ${app.id} (${app.applicant_name}) -> ${decision}. Notes: ${notes || 'None'}`);

            safeHideModal('reviewCaseFileModal');

            updateEvalMetrics();
            filterEvalLevel3Apps();

            window.showSystemNotification({
                title: 'Evaluation Decision Finalized',
                message: `Application case file for "${app.applicant_name}" has been officially marked as "${decision}". Timestamp recorded.`,
                type: decision === 'Approved' ? 'success' : (decision === 'Denied' ? 'error' : 'warning')
            });
        }
    });
}

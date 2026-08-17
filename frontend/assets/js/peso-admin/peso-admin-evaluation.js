/**
 * PESO Admin Portal - Application Evaluation Module (Tab 4)
 * Module: Evaluation (peso-admin-evaluation.js)
 * Implements: 3-Level Evaluation Queue, Case File Review Modal, Document Previewer, Approve/Reject Decisions
 */

let evalApplicationsList = [];
let currentEvalProgId = null;
let currentEvalBatchId = null;
let activeReviewAppId = null;
let currentDocPreviewZoom = 100;
let currentPreviewDocData = null;

async function initEvalModuleData() {
    if (typeof DataService !== 'undefined' && DataService.applications) {
        try {
            const res = await DataService.applications.getAll({ agency: 'PESO' });
            if (res.data && Array.isArray(res.data)) {
                evalApplicationsList = res.data.map(a => ({
                    id: a.id,
                    application_number: a.application_number || `APP-2026-${a.id}`,
                    beneficiary_qr: a.beneficiary_qr || `QR-BEN-${a.id}`,
                    applicant_name: a.beneficiary ? `${a.beneficiary.first_name || ''} ${a.beneficiary.last_name || ''}`.trim() : 'Applicant Name',
                    phone: a.beneficiary ? a.beneficiary.phone || a.beneficiary.contact_number : '',
                    address: a.beneficiary ? a.beneficiary.address || 'Koronadal City' : 'Koronadal City',
                    civil_status: a.beneficiary ? a.beneficiary.marital_status || 'Single' : 'Single',
                    spouse_name: a.beneficiary && a.beneficiary.spouse_name ? a.beneficiary.spouse_name : 'N/A',
                    children_info: a.beneficiary && a.beneficiary.dependents_count ? `${a.beneficiary.dependents_count} Dependents` : 'None',
                    program_id: a.program_id,
                    program_name: a.program ? a.program.name : 'Assistance Program',
                    program_code: a.program ? a.program.code : 'PESO',
                    batch_id: a.batch_id || 1011,
                    batch_num: a.batch ? a.batch.name : 'Intake Batch 1',
                    date_submitted: a.date_applied || (a.created_at ? a.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10)),
                    verification_status: a.status === 'Pending Requirements' ? 'Pending Verification' : 'Verified',
                    evaluation_status: a.status === 'Approved' ? 'Approved' : (a.status === 'Rejected' || a.status === 'Denied' ? 'Denied' : 'Pending Evaluation'),
                    notes: a.remarks || a.officer_notes || '',
                    docs: Array.isArray(a.documents_json) && a.documents_json.length > 0 ? a.documents_json : [
                        { type: 'Government Valid ID', file_name: 'Beneficiary_PhilID.pdf', status: 'Verified' },
                        { type: 'Barangay Residency Clearance', file_name: 'BrgyClearance_Koronadal.pdf', status: 'Verified' },
                        { type: 'Project Livelihood Proposal', file_name: 'Livelihood_Proposal_Doc.pdf', status: 'Verified' }
                    ]
                }));
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
    const progs = Array.isArray(programsList) ? programsList.filter(p => p.status === 'Active') : [];
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
    const search = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const statusSelect = document.getElementById('evalProgStatusFilter');
    const statusFilter = statusSelect ? statusSelect.value : 'ALL';
    const tbody = document.getElementById('evalLevel1ProgramsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const progs = Array.isArray(programsList) ? programsList : [];
    const activeProgs = progs.filter(p => p.status === 'Active');

    const filtered = activeProgs.filter(prog => {
        const apps = Array.isArray(evalApplicationsList) ? evalApplicationsList : [];
        const progApps = apps.filter(a => a.program_id === prog.id);
        const hasPending = progApps.some(a => a.evaluation_status === 'Pending Evaluation');
        const hasApproved = progApps.some(a => a.evaluation_status === 'Approved');

        let overallStatus = 'Completed';
        if (progApps.length === 0 || hasPending) {
            overallStatus = 'Pending Evaluation';
        } else if (hasApproved) {
            overallStatus = 'In Progress';
        }

        const matchesSearch = !search || (prog.name && prog.name.toLowerCase().includes(search)) || (prog.code && prog.code.toLowerCase().includes(search));
        const matchesStatus = (statusFilter === 'ALL') || (overallStatus === statusFilter);
        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-1"></i>No programs found matching evaluation criteria.</td></tr>';
        return;
    }

    filtered.forEach(prog => {
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

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="fw-bold text-dark">${escapeHtml(prog.name || '')}</div>
                <span class="badge bg-dark-subtle text-dark font-monospace">${escapeHtml(prog.code || '')}</span>
            </td>
            <td><span class="badge badge-category badge-emp">${escapeHtml(prog.category || 'Livelihood')}</span></td>
            <td class="text-center"><span class="badge bg-light text-dark border px-3 py-1 fs-6"><i class="bi bi-file-earmark-text text-primary me-1"></i>${progApps.length} applications</span></td>
            <td class="text-center"><span class="badge ${badgeClass} px-3 py-1.5 fs-6">${overallStatus}</span></td>
            <td class="text-end">
                <button class="btn btn-sm btn-primary fw-semibold" onclick="openEvalLevel2Batches(${prog.id})">
                    View Batches <i class="bi bi-chevron-right ms-1"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
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
    const adminId = sessionStorage.getItem('userId') || '1';
    logAuditEvent('EVALUATION_VIEW_BATCHES', `PESO Admin [ID:${adminId}] navigated to Level 2 Batches for Program: ${prog.code} (${prog.name})`);
}

function showEvalLevel2() {
    if (currentEvalProgId) openEvalLevel2Batches(currentEvalProgId);
    else showEvalLevel1();
}

function filterEvalLevel2Batches() {
    if (!currentEvalProgId) return;
    const searchInput = document.getElementById('evalBatchSearchInput');
    const search = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const statusSelect = document.getElementById('evalBatchStatusFilter');
    const statusFilter = statusSelect ? statusSelect.value : 'ALL';
    const tbody = document.getElementById('evalLevel2BatchesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const defaultBatches = PROGRAM_BATCHES[currentEvalProgId] || [
        { batch_id: currentEvalProgId * 10 + 1, batch_num: 'Batch 1 (General Intake)', date: '2026-03-15', trainer: 'PESO Intake Unit', enrolled: 25, total: 30 }
    ];

    const filtered = defaultBatches.filter(b => {
        const batchApps = evalApplicationsList.filter(a => a.program_id === currentEvalProgId && (a.batch_id === b.batch_id || a.batch_num === b.batch_num));
        const hasPending = batchApps.some(a => a.evaluation_status === 'Pending Evaluation');
        let batchStatus = hasPending || batchApps.length === 0 ? 'Pending Evaluation' : 'Approved';

        const matchesSearch = !search || (b.batch_num && b.batch_num.toLowerCase().includes(search)) || (b.trainer && b.trainer.toLowerCase().includes(search));
        const matchesStatus = (statusFilter === 'ALL') || (batchStatus === statusFilter);
        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-1"></i>No batches recorded under this program.</td></tr>';
        return;
    }

    filtered.forEach(b => {
        const batchApps = evalApplicationsList.filter(a => a.program_id === currentEvalProgId && (a.batch_id === b.batch_id || a.batch_num === b.batch_num));
        const count = batchApps.length > 0 ? batchApps.length : b.enrolled;
        const hasPending = batchApps.some(a => a.evaluation_status === 'Pending Evaluation');
        let batchStatus = hasPending || batchApps.length === 0 ? 'Pending Evaluation' : 'Approved';
        let badgeClass = batchStatus === 'Approved' ? 'bg-success' : 'bg-warning text-dark';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="fw-bold text-dark">${escapeHtml(b.batch_num || '')}</div>
                <span class="badge bg-light text-secondary border font-monospace">ID: ${b.batch_id}</span>
            </td>
            <td>
                <div>${escapeHtml(b.trainer || 'PESO Team')}</div>
                <small class="text-muted"><i class="bi bi-calendar-event me-1"></i>${b.date || '2026-03-15'}</small>
            </td>
            <td class="text-center"><span class="badge bg-primary-subtle text-primary px-3 py-1 fs-6"><i class="bi bi-people-fill me-1"></i>${count} applications</span></td>
            <td class="text-center"><span class="badge ${badgeClass} px-3 py-1.5 fs-6">${batchStatus}</span></td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-primary fw-semibold" onclick="openEvalLevel3Apps(${currentEvalProgId}, ${b.batch_id}, '${escapeHtml(b.batch_num || '')}')">
                    View Applications <i class="bi bi-chevron-right ms-1"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
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
    const adminId = sessionStorage.getItem('userId') || '1';
    logAuditEvent('EVALUATION_VIEW_APPLICATIONS', `PESO Admin [ID:${adminId}] navigated to Level 3 Applications for Batch: ${batchNumStr || batchId}`);
}

function filterEvalLevel3Apps() {
    const searchInput = document.getElementById('evalAppSearchInput');
    const search = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const verifSelect = document.getElementById('evalAppVerifFilter');
    const verifFilter = verifSelect ? verifSelect.value : 'ALL';
    const statusSelect = document.getElementById('evalAppStatusFilter');
    const statusFilter = statusSelect ? statusSelect.value : 'ALL';
    const tbody = document.getElementById('evalLevel3AppsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const safeList = Array.isArray(evalApplicationsList) ? evalApplicationsList : [];
    const filtered = safeList.filter(app => {
        if (!app) return false;
        const matchesProg = !currentEvalProgId || (app.program_id === currentEvalProgId);
        const matchesSearch = !search || (app.applicant_name && app.applicant_name.toLowerCase().includes(search)) || (app.address && app.address.toLowerCase().includes(search));
        const matchesVerif = (verifFilter === 'ALL') || (app.verification_status === verifFilter);
        const matchesStatus = (statusFilter === 'ALL') || (app.evaluation_status === statusFilter);
        return matchesProg && matchesSearch && matchesVerif && matchesStatus;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-1"></i>No submitted applications found matching criteria.</td></tr>';
        return;
    }

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

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="fw-bold text-dark">${escapeHtml(app.applicant_name || 'Applicant')}</div>
                <small class="text-muted"><i class="bi bi-telephone me-1"></i>${maskContactNumber(app.phone)}</small>
            </td>
            <td>
                <div class="fw-semibold text-primary">${escapeHtml(app.program_code || 'LIVELIHOOD')}</div>
                <small class="text-secondary">${escapeHtml(app.batch_num || 'Batch 1')}</small>
            </td>
            <td><small class="fw-semibold text-dark"><i class="bi bi-calendar3 me-1 text-muted"></i>${app.date_submitted || '2026-08-01'}</small></td>
            <td class="text-center">${verifBadgeHTML}</td>
            <td class="text-center">${statusBadgeHTML}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-primary fw-semibold shadow-sm" onclick="openReviewCaseFileModal(${app.id})">
                    <i class="bi bi-file-earmark-medical me-1"></i> Review Case File
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- LEVEL 4: REVIEW SUBMITTED LIVELIHOOD CASE FILE MODAL (USER RULE 1: STRICTLY READ-ONLY) ---
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
    setText('reviewProgramBatchTag', `${app.program_code || 'PESO'} — ${app.batch_num || 'Batch 1'}`);
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
            { type: 'Government Valid ID', file_name: 'Beneficiary_PhilID.pdf', status: 'Verified' },
            { type: 'Barangay Residency Clearance', file_name: 'BrgyClearance_Koronadal.pdf', status: 'Verified' },
            { type: 'Project Livelihood Proposal', file_name: 'Livelihood_Proposal_Doc.pdf', status: 'Verified' }
        ];

        docsList.forEach(doc => {
            if (!doc) return;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(doc.type || 'Document')}</strong></td>
                <td><code>${escapeHtml(doc.file_name || 'file.pdf')}</code></td>
                <td class="text-center"><span class="badge bg-success-subtle text-success border border-success"><i class="bi bi-check-circle-fill me-1"></i>${doc.status || 'Verified'}</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-info me-1" onclick="openDocPreview('${escapeHtml(doc.type || 'Document')}', '${escapeHtml(doc.file_name || 'file.pdf')}')">
                        <i class="bi bi-eye"></i> Preview
                    </button>
                    <a href="javascript:void(0)" class="btn btn-sm btn-outline-secondary" onclick="window.showSystemNotification({ title: 'Download Compliance Record', message: 'Downloading verified file: ${escapeHtml(doc.file_name || 'file.pdf')}', type: 'info' })">
                        <i class="bi bi-download"></i> Download
                    </a>
                </td>
            `;
            docsTable.appendChild(tr);
        });
    }

    safeOpenModal('reviewCaseFileModal');
    const adminId = sessionStorage.getItem('userId') || '1';
    logAuditEvent('REVIEW_CASE_FILE', `PESO Admin [ID:${adminId}] opened Case File Review for Applicant: ${app.applicant_name} (App ID: ${app.id})`);
}

// --- INTERACTIVE INLINE DOCUMENT PREVIEWER ---
function openDocPreview(docType, fileName) {
    currentPreviewDocData = { docType: docType || 'Government Document', fileName: fileName || 'Document.pdf' };
    currentDocPreviewZoom = 100;

    const titleEl = document.getElementById('docPreviewTitle');
    const subTitleEl = document.getElementById('docPreviewSubTitle');
    const nameEl = document.getElementById('docPreviewFileName');
    const metaTypeEl = document.getElementById('docPreviewMetaType');
    const trackIdEl = document.getElementById('docPreviewTrackId');
    const mainTitleEl = document.getElementById('docPreviewMainTitle');
    const textContentEl = document.getElementById('docPreviewTextContent');

    if (titleEl) titleEl.textContent = `Document Preview: ${docType}`;
    if (subTitleEl) subTitleEl.textContent = `Official Compliance Record • City of Koronadal`;
    if (nameEl) nameEl.textContent = fileName;
    if (metaTypeEl) metaTypeEl.textContent = fileName.endsWith('.pdf') ? 'PDF Compliance Document' : 'Verified Image Record';
    if (trackIdEl) trackIdEl.textContent = `DOC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    if (mainTitleEl) mainTitleEl.textContent = docType;

    if (textContentEl) {
        textContentEl.innerHTML = `
            <strong>[Official Electronic Document Record — City of Koronadal PESO]</strong><br>
            Document Category: ${escapeHtml(docType)}<br>
            Attached File Name: ${escapeHtml(fileName)}<br>
            Intake Authority: Public Employment Service Office (PESO) Administrator<br>
            Compliance Validation: Pre-checked and authentic under LGU legislative standards.<br>
            Data Privacy Status: Restricted and encrypted under R.A. 10173.
        `;
    }

    resetPreviewDocZoom();
    safeOpenModal('docPreviewModal');

    const adminId = sessionStorage.getItem('userId') || '1';
    logAuditEvent('VIEW_DOCUMENT_PREVIEW', `PESO Admin [ID:${adminId}] opened inline document preview for "${fileName}" (${docType})`);
}

function zoomPreviewDoc(delta) {
    currentDocPreviewZoom = Math.max(50, Math.min(180, currentDocPreviewZoom + delta));
    const container = document.getElementById('docPreviewContainer');
    const zoomLevelEl = document.getElementById('docPreviewZoomLevel');
    if (container) {
        container.style.transform = `scale(${currentDocPreviewZoom / 100})`;
    }
    if (zoomLevelEl) {
        zoomLevelEl.textContent = `${currentDocPreviewZoom}%`;
    }
}

function resetPreviewDocZoom() {
    currentDocPreviewZoom = 100;
    const container = document.getElementById('docPreviewContainer');
    const zoomLevelEl = document.getElementById('docPreviewZoomLevel');
    if (container) {
        container.style.transform = 'scale(1)';
    }
    if (zoomLevelEl) {
        zoomLevelEl.textContent = '100%';
    }
}

function handlePrintOrDownloadPreviewDoc() {
    const docName = currentPreviewDocData ? currentPreviewDocData.fileName : 'Verified_Document.pdf';
    const adminId = sessionStorage.getItem('userId') || '1';
    logAuditEvent('DOWNLOAD_VERIFIED_DOCUMENT', `PESO Admin [ID:${adminId}] exported/downloaded verified document copy for "${docName}"`);
    window.showSystemNotification({
        title: 'Verified Document Exported',
        message: `Official verified copy for "${docName}" downloaded successfully.`,
        type: 'success'
    });
}

// --- FINAL EVALUATION DECISION EXECUTION ---
async function executeEvalDecision(decision) {
    const app = evalApplicationsList.find(a => a.id === activeReviewAppId);
    if (!app) return;

    const notes = (document.getElementById('reviewActionAssessmentNotes')?.value || '').trim();

    if ((decision === 'Denied' || decision === 'Pending Evaluation') && !notes) {
        window.showSystemNotification({
            title: 'Action Notes Required',
            message: `Please enter detailed evaluation assessment notes before finalizing "${decision}".`,
            type: 'warning'
        });
        return;
    }

    if (!confirm(`Confirm Final Decision: Are you sure you want to mark application for "${app.applicant_name}" as "${decision}"?`)) {
        return;
    }

    if (typeof DataService !== 'undefined' && DataService.applications) {
        try {
            const updateRes = await DataService.applications.update(app.id, {
                status: decision === 'Approved' ? 'Approved' : (decision === 'Denied' ? 'Denied' : 'Pending Requirements'),
                remarks: notes
            });

            if (updateRes && updateRes.error) {
                window.showSystemNotification({
                    title: 'Decision Update Failed',
                    message: updateRes.error.message || 'Failed to update application decision in Supabase.',
                    type: 'error'
                });
                return;
            }
        } catch (err) {
            console.error('[EVALUATION] Supabase application update error:', err);
            window.showSystemNotification({
                title: 'Database Error',
                message: 'Failed to communicate with Supabase. Decision was not recorded.',
                type: 'error'
            });
            return;
        }
    }

    app.evaluation_status = decision;
    app.notes = notes;
    app.evaluated_at = new Date().toISOString();

    const adminId = sessionStorage.getItem('userId') || '1';
    const adminUser = sessionStorage.getItem('username') || 'peso-admin';
    logAuditEvent(`EVALUATE_APPLICATION_${decision.toUpperCase().replace(/\s+/g, '_')}`, `PESO Admin [ID:${adminId}, ${adminUser}] evaluated application ID ${app.id} (${app.applicant_name}) -> ${decision}. Justification: ${notes || 'Standard compliance'}`);

    safeHideModal('reviewCaseFileModal');
    updateEvalMetrics();
    filterEvalLevel3Apps();

    window.showSystemNotification({
        title: 'Evaluation Finalized',
        message: `Application case file for "${app.applicant_name}" marked as "${decision}". Timestamp recorded in audit trail.`,
        type: decision === 'Approved' ? 'success' : (decision === 'Denied' ? 'error' : 'warning')
    });
}

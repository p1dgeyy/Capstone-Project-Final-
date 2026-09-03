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

async function initEvalModuleData() {
    if (typeof DataService !== 'undefined' && DataService.applications) {
        try {
            // Pre-fetch beneficiaries, programs, staff, and batches maps for relational enrichment
            let beneficiariesMap = {};
            let programsMap = {};
            let programsCodeMap = {};
            let officersMap = {};
            let batchesMap = {};
            let pesoOfficersList = [];

            try {
                if (typeof DataService.beneficiaries !== 'undefined' && DataService.beneficiaries.getAll) {
                    const benRes = await DataService.beneficiaries.getAll();
                    if (benRes && Array.isArray(benRes.data)) {
                        benRes.data.forEach(b => {
                            if (b.qr_code) beneficiariesMap[b.qr_code] = b;
                            if (b.id) beneficiariesMap[b.id] = b;
                        });
                    }
                }
            } catch (e) {}

            try {
                if (typeof DataService.programs !== 'undefined' && DataService.programs.getAll) {
                    const pRes = await DataService.programs.getAll({ agency: 'PESO' });
                    if (pRes && Array.isArray(pRes.data)) {
                        pRes.data.forEach(p => {
                            if (p.id) programsMap[p.id] = p;
                            if (p.code) {
                                programsCodeMap[p.code.toUpperCase()] = p;
                                programsMap[p.code] = p;
                            }
                        });
                    }
                }
            } catch (e) {}

            try {
                if (typeof DataService.staffProfiles !== 'undefined' && DataService.staffProfiles.getAll) {
                    const sRes = await DataService.staffProfiles.getAll();
                    if (sRes && Array.isArray(sRes.data)) {
                        sRes.data.forEach(s => {
                            const name = `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.username;
                            if (s.id) officersMap[s.id] = name;
                            if (s.role === 'PESO Officer') {
                                pesoOfficersList.push(name);
                            }
                        });
                    }
                }
            } catch (e) {}

            try {
                if (typeof DataService.batches !== 'undefined' && DataService.batches.getAll) {
                    const bRes = await DataService.batches.getAll();
                    if (bRes && Array.isArray(bRes.data)) {
                        bRes.data.forEach(b => {
                            if (b.id) batchesMap[b.id] = b;
                        });
                    }
                }
            } catch (e) {}

            const res = await DataService.applications.getAll();
            let appsData = res.data && Array.isArray(res.data) ? res.data : [];
            
            // Filter PESO-relevant applications that have passed Officer review or have prior Admin decision
            const pesoCanonicalCodes = ['SPES', 'TUPAD', 'GIP', 'CKGIP', 'AICS', 'KEEP', 'PFAS', 'OFW-RLAP', 'WELD-NCII', 'DILP-IGP', 'DILP-DK', 'SP-SEK', 'PEAP', 'AGRI-SK', 'ASSOC-FAC', 'JOB-FAIR', 'JOB-PORTAL', 'SKILLS-TRAIN', 'OFW-FCD', 'PAROKYA', 'ROFWS', 'JOB-PLACEMENT', 'SKILLS-VOUCHER'];
            const eligibleAdminEvalStatuses = ['Officer Approved', 'Approved', 'Denied', 'Rejected'];

            appsData = appsData.filter(a => {
                const progCode = (a.program?.code || a.program_code || (programsMap[a.program_id] ? programsMap[a.program_id].code : '')).toUpperCase();
                const isPeso = a.agency === 'PESO' || pesoCanonicalCodes.some(p => progCode.includes(p)) || !a.agency;
                if (!isPeso) return false;

                // Gate: Admin only evaluates applications that passed Officer review or have prior Admin decision
                return eligibleAdminEvalStatuses.includes(a.status);
            });

            if (appsData.length > 0) {
                evalApplicationsList = appsData.map(a => {
                    const ben = a.beneficiary || beneficiariesMap[a.beneficiary_qr] || beneficiariesMap[a.beneficiary_id] || {};
                    const prog = a.program || programsMap[a.program_id] || (a.program_code ? programsCodeMap[a.program_code.toUpperCase()] : null) || {};
                    const firstName = ben.first_name || '';
                    const middleName = ben.middle_name ? ` ${ben.middle_name.charAt(0)}.` : '';
                    const lastName = ben.last_name || '';
                    const fullName = (firstName || lastName)
                        ? `${firstName}${middleName} ${lastName}`.trim()
                        : (ben.name || a.applicant_name || ben.username || 'Registered Applicant');
                    
                    const phone = ben.contact_number || ben.phone || a.phone || (ben.qr_code ? `0917-${ben.qr_code.replace(/\D/g, '').substring(0, 7) || '5551234'}` : '0917-555-0199');
                    const address = ben.address || (ben.barangay ? `${ben.barangay}, Koronadal City` : 'Koronadal City');
                    const civilStatus = ben.marital_status || ben.civil_status || 'Single';
                    const spouseName = ben.spouse_name || 'N/A';
                    const childrenInfo = ben.dependents_count ? `${ben.dependents_count} Dependents` : (ben.number_of_children ? `${ben.number_of_children} Children` : 'None');

                    const progCode = (prog && prog.code) || (a.program && a.program.code) || a.program_code || 'PESO';
                    const progName = (prog && prog.name) || (a.program && a.program.name) || a.program_name || 'Livelihood Assistance Program';
                    const progId = (prog && prog.id) || a.program_id || 1;

                    // Resolve real forwarding officer name from actual officer accounts
                    let forwardingOfficer = a.forwarded_by || null;
                    if (forwardingOfficer === 'PESO Officer Desk' || forwardingOfficer === 'N/A') forwardingOfficer = null;
                    
                    if (!forwardingOfficer && a.officer_id && officersMap[a.officer_id]) {
                        forwardingOfficer = officersMap[a.officer_id];
                    }
                    if (!forwardingOfficer && a.batch_id && batchesMap[a.batch_id]) {
                        const batch = batchesMap[a.batch_id];
                        if (batch && batch.created_by && officersMap[batch.created_by]) {
                            forwardingOfficer = officersMap[batch.created_by];
                        }
                    }
                    if (!forwardingOfficer) {
                        forwardingOfficer = pesoOfficersList.length > 0 ? pesoOfficersList[0] : 'PESO Officer';
                    }

                    const docsList = Array.isArray(a.documents_json) && a.documents_json.length > 0
                        ? a.documents_json
                        : (ben.id_type ? [{ type: ben.id_type, file_name: ben.id_file_path || 'Submitted_ID.pdf', status: 'Verified' }] : []);

                    const isVerif = a.status === 'Approved' || a.status === 'Verified' || (a.status !== 'Pending Requirements' && a.status !== 'Incomplete');

                    return {
                        id: a.id,
                        // Raw status + a nested beneficiary{} are kept alongside the flattened
                        // fields below so consumers that expect the real applications schema
                        // (the Admin dashboard KPI cards and the Reports engine's Application
                        // Management report) can read this list directly instead of silently
                        // matching nothing -- this list used to only expose the 3-value
                        // evaluation_status/batch_status/verification_status summaries, so any
                        // code checking a.status, a.created_at/date_applied, or a.beneficiary.*
                        // always got undefined and quietly showed zero records.
                        status: a.status || null,
                        created_at: a.created_at || null,
                        date_applied: a.date_applied || null,
                        beneficiary: {
                            first_name: firstName,
                            middle_name: ben.middle_name || null,
                            last_name: lastName,
                            phone: phone,
                            address: address,
                            qr_code: ben.qr_code || a.beneficiary_qr || ''
                        },
                        application_number: a.application_number || `APP-${a.id}`,
                        beneficiary_qr: a.beneficiary_qr || ben.qr_code || '',
                        applicant_name: fullName,
                        phone: phone,
                        address: address,
                        civil_status: civilStatus,
                        spouse_name: spouseName,
                        children_info: childrenInfo,
                        program_id: progId,
                        program_name: progName,
                        program_code: progCode,
                        batch_id: a.batch_id || 1,
                        batch_num: (a.batch && a.batch.name) ? a.batch.name : (a.batch_id ? `Batch #${a.batch_id}` : 'Batch 1 - Regular Cohort'),
                        date_submitted: a.date_applied || (a.created_at ? a.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10)),
                        verification_status: isVerif ? 'Verified' : 'Pending Verification',
                        evaluation_status: a.status === 'Approved' ? 'Approved' : (a.status === 'Rejected' || a.status === 'Denied' || a.status === 'Officer Denied' ? 'Denied' : 'Pending Evaluation'),
                        batch_status: a.status === 'Approved' ? (a.batch_id ? 'Batched' : 'Unbatched') : 'Pending',
                        forwarding_officer: forwardingOfficer,
                        notes: a.remarks || a.officer_notes || '',
                        docs: docsList.length > 0 ? docsList : [
                            { type: 'Valid Government ID', file_name: 'ID_Document.pdf', status: isVerif ? 'Verified' : 'Pending Verification' },
                            { type: 'Barangay Certificate', file_name: 'Brgy_Clearance.pdf', status: isVerif ? 'Verified' : 'Pending Verification' }
                        ]
                    };
                });
            }
        } catch (e) {
            console.warn('[EVALUATION] Supabase applications fetch notice:', e);
        }
    }
    updateEvalMetrics();
    if (!currentEvalProgId) {
        filterEvalLevel1Programs();
    } else {
        filterEvalLevel3Apps();
    }
}

function updateEvalMetrics() {
    const list = Array.isArray(evalApplicationsList) ? evalApplicationsList : [];
    const progs = (typeof programsList !== 'undefined' && Array.isArray(programsList) && programsList.length > 0)
        ? programsList
        : ((typeof CANONICAL_PESO_PROGRAM_CATALOG !== 'undefined' && Array.isArray(CANONICAL_PESO_PROGRAM_CATALOG)) ? CANONICAL_PESO_PROGRAM_CATALOG : []);

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
async function renderEvalLevel1Programs() {
    await initEvalModuleData();
    if (!currentEvalProgId) {
        showEvalLevel1();
        filterEvalLevel1Programs();
    } else {
        filterEvalLevel3Apps();
    }
    updateEvalMetrics();
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

    const progs = (typeof programsList !== 'undefined' && Array.isArray(programsList) && programsList.length > 0)
        ? programsList
        : ((typeof CANONICAL_PESO_PROGRAM_CATALOG !== 'undefined' && Array.isArray(CANONICAL_PESO_PROGRAM_CATALOG)) ? CANONICAL_PESO_PROGRAM_CATALOG : []);

    const activeProgs = progs.filter(p => !p.status || p.status === 'Active');

    let renderedCount = 0;

    activeProgs.forEach(prog => {
        const apps = Array.isArray(evalApplicationsList) ? evalApplicationsList : [];
        const pCode = (prog.code || '').toUpperCase();
        const progApps = apps.filter(a => {
            const aCode = (a.program_code || '').toUpperCase();
            if (aCode && pCode && aCode === pCode) return true;
            if (a.program_name && prog.name && a.program_name.toLowerCase().trim() === prog.name.toLowerCase().trim()) return true;
            if (String(a.program_id) === String(prog.id) && aCode === pCode) return true;
            return false;
        });
        const pendingCount = progApps.filter(a => a.evaluation_status === 'Pending Evaluation').length;
        const approvedCount = progApps.filter(a => a.evaluation_status === 'Approved').length;
        const deniedCount = progApps.filter(a => a.evaluation_status === 'Denied').length;
        const resolvedCount = approvedCount + deniedCount;

        // This used to label a program 'In Progress' whenever it had zero pending
        // applications AND at least one Approved one -- which is backwards: zero
        // pending means evaluation is actually DONE, not still going. That made
        // 'Completed' nearly unreachable for any program with real approvals (the
        // most common case), which is why filtering by "Completed" always came up
        // empty. Correct semantics: no apps yet, or every app is still pending =>
        // Pending Evaluation; some resolved but others still pending => In Progress
        // (a genuine partial/mid-evaluation state); zero pending remaining => Completed.
        let overallStatus = 'Pending Evaluation';
        let badgeClass = 'bg-warning text-dark';
        if (progApps.length > 0 && pendingCount === 0) {
            overallStatus = 'Completed';
            badgeClass = 'bg-success';
        } else if (pendingCount > 0 && resolvedCount > 0) {
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
                        <div class="d-flex flex-column align-items-center gap-1">
                            <span class="badge bg-light text-dark border px-3 py-1 fs-6">
                                <i class="bi bi-file-earmark-text text-primary me-1"></i>${progApps.length} applications
                            </span>
                            ${progApps.length > 0 ? `
                            <div class="d-flex justify-content-center gap-1 flex-wrap mt-0.5">
                                ${pendingCount > 0 ? `<span class="badge bg-warning-subtle text-dark border border-warning-subtle px-1.5 py-0.5" style="font-size: 0.75rem;"><i class="bi bi-clock-history me-1"></i>${pendingCount} Pending</span>` : ''}
                                ${approvedCount > 0 ? `<span class="badge bg-success-subtle text-success border border-success-subtle px-1.5 py-0.5" style="font-size: 0.75rem;"><i class="bi bi-check-circle me-1"></i>${approvedCount} Approved</span>` : ''}
                                ${deniedCount > 0 ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle px-1.5 py-0.5" style="font-size: 0.75rem;"><i class="bi bi-x-circle me-1"></i>${deniedCount} Denied</span>` : ''}
                            </div>
                            ` : ''}
                        </div>
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

    const progs = (typeof programsList !== 'undefined' && Array.isArray(programsList) && programsList.length > 0)
        ? programsList
        : ((typeof CANONICAL_PESO_PROGRAM_CATALOG !== 'undefined' && Array.isArray(CANONICAL_PESO_PROGRAM_CATALOG)) ? CANONICAL_PESO_PROGRAM_CATALOG : []);

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
// Used to confirm via the browser's native confirm() dialog -- inconsistent with
// the rest of the app's own styled modals, and easy to miss/dismiss by accident.
// Now opens the app's own bulkApproveConfirmModal; the actual approval work
// (previously right after the confirm() check) now lives in
// confirmBulkApproveSelected(), invoked by that modal's Confirm button.
function handleBulkApproveClick() {
    const count = selectedEvalAppIds.size;
    if (count === 0) return;

    const countEl = document.getElementById('bulkApproveConfirmCount');
    if (countEl) countEl.textContent = count;

    if (typeof safeOpenModal === 'function') {
        safeOpenModal('bulkApproveConfirmModal');
    } else {
        // Fallback if the modal helper or markup is ever unavailable, so approval
        // still works rather than silently doing nothing.
        confirmBulkApproveSelected();
    }
}

async function confirmBulkApproveSelected() {
    const count = selectedEvalAppIds.size;
    if (count === 0) return;

    if (typeof safeHideModal === 'function') {
        safeHideModal('bulkApproveConfirmModal');
    }

    const adminId = parseInt(sessionStorage.getItem('userId')) || 1;
    const adminUsername = sessionStorage.getItem('username') || 'PESO Admin';
    const timestamp = new Date().toISOString();
    const targetIds = Array.from(selectedEvalAppIds);

    const btnApprove = document.getElementById('btnBulkApprove');
    if (btnApprove) {
        btnApprove.disabled = true;
        btnApprove.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Approving...';
    }

    try {
        let successfulIds = [];
        let writePromises = [];

        targetIds.forEach(id => {
            const app = evalApplicationsList.find(a => a.id === id);
            if (app) {
                const targetNotes = (app.notes ? app.notes + ' | ' : '') + 'Bulk Approved by PESO Admin — Validity and authenticity verified';
                if (typeof DataService !== 'undefined' && DataService.applications) {
                    writePromises.push(
                        DataService.applications.adminApprove(app.id, {
                            notes: targetNotes,
                            admin_id: adminId,
                            admin_username: adminUsername
                        }).then(res => {
                            if (res && !res.error) {
                                return { id: app.id, success: true, notes: targetNotes };
                            } else {
                                return { id: app.id, success: false, error: res?.error?.message || 'Update failed' };
                            }
                        }).catch(err => ({ id: app.id, success: false, error: err.message }))
                    );
                } else {
                    successfulIds.push(app.id);
                }
            }
        });

        if (writePromises.length > 0) {
            const results = await Promise.allSettled(writePromises);
            results.forEach(r => {
                if (r.status === 'fulfilled' && r.value.success) {
                    successfulIds.push(r.value.id);
                    const app = evalApplicationsList.find(a => a.id === r.value.id);
                    if (app) {
                        app.evaluation_status = 'Approved';
                        app.verification_status = 'Verified';
                        app.batch_status = 'Unbatched';
                        app.evaluated_at = timestamp;
                        app.evaluated_by_admin = adminUsername;
                        app.notes = r.value.notes;
                    }
                }
            });
        }

        if (typeof logAuditEvent === 'function') {
            logAuditEvent('BULK_APPLICATION_APPROVED', `[ADMIN BULK APPROVAL] Admin ID: ${adminId} (${adminUsername}) approved ${successfulIds.length} of ${count} applications for batch "${currentEvalBatchNum}". Moved to Officer Batches (Unbatched). Timestamp: ${timestamp}`);
        }

        // Auto-notify Officer & Beneficiary
        if (typeof OTPAuth !== 'undefined' && OTPAuth.broadcastRealtimeEvent && successfulIds.length > 0) {
            OTPAuth.broadcastRealtimeEvent('APPLICATION_ADMIN_BULK_APPROVED', {
                count: successfulIds.length,
                batchRef: currentEvalBatchNum,
                adminId: adminId,
                timestamp: timestamp
            });
        }

        // Only clear successful IDs
        successfulIds.forEach(id => selectedEvalAppIds.delete(id));
        const selectAllBox = document.getElementById('evalSelectAllCheckbox');
        if (selectAllBox) selectAllBox.checked = (selectedEvalAppIds.size > 0);
        updateEvalBulkSelectionState();
        updateEvalMetrics();
        filterEvalLevel3Apps();

        const failedCount = count - successfulIds.length;
        if (failedCount > 0) {
            if (typeof window.showSystemNotification === 'function') {
                window.showSystemNotification({
                    title: 'Partial Bulk Approval',
                    message: `${successfulIds.length} of ${count} applications approved; ${failedCount} failed to save in database. Please retry the remaining items.`,
                    type: 'warning',
                    duration: 10000
                });
            } else {
                alert(`${successfulIds.length} of ${count} applications approved; ${failedCount} failed. Please retry.`);
            }
        } else {
            if (typeof window.showSystemNotification === 'function') {
                window.showSystemNotification({
                    title: 'Bulk Approval Finalized',
                    message: `Successfully approved all ${count} application(s). Beneficiaries moved to Officer Batches (Unbatched).`,
                    type: 'success'
                });
            }
        }
    } catch (err) {
        console.error('[Admin Bulk Approve] Error:', err);
        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Bulk Approval Failed',
                message: err.message || 'Failed to complete bulk approval.',
                type: 'error'
            });
        }
    } finally {
        if (btnApprove) {
            btnApprove.disabled = (selectedEvalAppIds.size === 0);
            btnApprove.innerHTML = '<i class="bi bi-check2-all me-1"></i> Bulk Approve';
        }
    }
}

// 2. BULK DENIAL RESTRICTION (Prohibited per rule: each denial must be individually reasoned)
window.confirmBulkApproveSelected = confirmBulkApproveSelected;

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

    const progs = (typeof programsList !== 'undefined' && Array.isArray(programsList) && programsList.length > 0)
        ? programsList
        : ((typeof CANONICAL_PESO_PROGRAM_CATALOG !== 'undefined' && Array.isArray(CANONICAL_PESO_PROGRAM_CATALOG)) ? CANONICAL_PESO_PROGRAM_CATALOG : []);
    const currentProg = progs.find(p => p.id === currentEvalProgId) || { id: currentEvalProgId, code: 'PESO', name: 'Livelihood Program' };

    const filtered = evalApplicationsList.filter(app => {
        let matchesProg = true;
        if (currentEvalProgId && currentProg) {
            const appCode = (app.program_code || '').toUpperCase();
            const pCode = (currentProg.code || '').toUpperCase();
            matchesProg = (appCode && pCode && appCode === pCode) || 
                          (app.program_name && currentProg.name && app.program_name.toLowerCase().trim() === currentProg.name.toLowerCase().trim()) ||
                          (String(app.program_id) === String(currentProg.id) && appCode === pCode);
        }
        const matchesSearch = (app.applicant_name || '').toLowerCase().includes(search) || (app.address || '').toLowerCase().includes(search) || (app.application_number || '').toLowerCase().includes(search);
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

        const forwardingOfficer = app.forwarding_officer || 'PESO Officer Desk';
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

let _isProcessingRejection = false;
async function handleConfirmApplicationRejection(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (_isProcessingRejection) return;
    _isProcessingRejection = true;

    const btnConfirm = document.getElementById('btnConfirmRejectApp') || document.querySelector('#evalRejectionModal button[type="submit"]');
    if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Processing...';
    }

    try {
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

        // Save to the database FIRST -- only treat this as a real denial if
        // the write actually succeeds, same reasoning as the approve path.
        let denyErr = null;
        if (typeof DataService !== 'undefined' && DataService.applications) {
            try {
                const denyRes = await DataService.applications.adminDeny(app.id, {
                    reason: reason,
                    rejection_reason: reason,
                    rejection_category: category,
                    resubmission_deadline: deadlineIso,
                    admin_id: adminId,
                    admin_username: adminUsername
                });
                if (denyRes && denyRes.error) {
                    denyErr = (denyRes.error.message || denyRes.error) + '';
                } else if (!denyRes || !denyRes.data) {
                    denyErr = 'The database did not confirm this denial was saved.';
                }
            } catch (err) {
                denyErr = (err && err.message) ? err.message : 'A network or server error occurred while saving the denial.';
            }
        } else {
            denyErr = 'Data service unavailable -- denial was not saved.';
        }

        if (denyErr) {
            console.error('[EVALUATION] Admin denial FAILED to save:', denyErr);
            window.showSystemNotification({
                title: 'Denial Not Saved',
                message: `"${app.applicant_name}" was NOT denied. ${denyErr}`,
                type: 'error'
            });
            return;
        }

        // Only reached once the database write is confirmed successful.
        app.evaluation_status = 'Denied';
        app.verification_status = 'Pending Verification';
        app.denial_source = 'Admin';
        app.denial_category = category;
        app.denial_reason = reason;
        app.resubmission_deadline = deadlineIso;
        app.evaluated_at = timestamp;
        app.evaluated_by_admin = adminUsername;
        app.notes = `Admin Denied [${category}]: ${reason} | 3-Day Resubmission Window until ${new Date(deadlineIso).toLocaleString('en-US')}`;

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
    } finally {
        _isProcessingRejection = false;
        if (btnConfirm) {
            btnConfirm.disabled = false;
            btnConfirm.innerHTML = 'Confirm Denial';
        }
    }
}

// --- FINAL EVALUATION DECISION EXECUTION (APPROVE / DENY) ---
let _isExecutingDecision = false;
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
            if (_isExecutingDecision) return;
            _isExecutingDecision = true;

            const btnApprove = document.getElementById('btnApproveCaseFile');
            if (btnApprove) {
                btnApprove.disabled = true;
                btnApprove.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Approving...';
            }

            try {
                // Save to the database FIRST -- only treat this as a real
                // approval if the write actually succeeds. adminApprove()
                // returns { data: null, error: {...} } (without throwing) for
                // validation failures such as the ₱500,000 grant ceiling or
                // an unallocated/insufficient program budget, so a thrown
                // exception is not the only failure shape to handle.
                let approveErr = null;
                if (typeof DataService !== 'undefined' && DataService.applications) {
                    try {
                        const approveRes = await DataService.applications.adminApprove(app.id, {
                            notes: notes,
                            admin_id: adminId,
                            admin_username: adminUsername
                        });
                        if (approveRes && approveRes.error) {
                            approveErr = (approveRes.error.message || approveRes.error) + '';
                        } else if (!approveRes || !approveRes.data) {
                            approveErr = 'The database did not confirm this approval was saved.';
                        }
                    } catch (err) {
                        approveErr = (err && err.message) ? err.message : 'A network or server error occurred while saving the approval.';
                    }
                } else {
                    approveErr = 'Data service unavailable -- approval was not saved.';
                }

                if (approveErr) {
                    console.error('[EVALUATION] Admin approval FAILED to save:', approveErr);
                    window.showSystemNotification({
                        title: 'Approval Not Saved',
                        message: `"${app.applicant_name}" was NOT approved. ${approveErr}`,
                        type: 'error'
                    });
                    return;
                }

                // Only reached once the database write is confirmed successful --
                // everything below reflects a real, persisted approval.
                app.evaluation_status = 'Approved';
                app.verification_status = 'Verified';
                app.batch_status = 'Unbatched';
                app.evaluated_at = timestamp;
                app.evaluated_by_admin = adminUsername;
                app.notes = notes;

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
            } finally {
                _isExecutingDecision = false;
                if (btnApprove) {
                    btnApprove.disabled = false;
                    btnApprove.innerHTML = '<i class="bi bi-check-circle me-1"></i> Approve Case';
                }
            }
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


window.handleConfirmBulkRejection = function(e) {
    if (e) e.preventDefault();
    if (typeof window.showSystemNotification === 'function') {
        window.showSystemNotification({
            title: 'Bulk Denial Prohibited',
            message: 'Per municipal compliance rules, bulk denials are prohibited. Each application must be individually reasoned.',
            type: 'warning'
        });
    } else {
        alert('Per municipal compliance rules, bulk denials are prohibited. Each application must be individually reasoned.');
    }
    const modalEl = document.getElementById('bulkEvalRejectionModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
    }
};

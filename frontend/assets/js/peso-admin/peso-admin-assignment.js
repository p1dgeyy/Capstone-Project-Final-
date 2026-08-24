/**
 * PESO Admin Portal - Program Assignment Module (Tab 5)
 * Module: Assignment (peso-admin-assignment.js)
 */

let selectedProgramId = null;
let selectedBatchId = null;
let liveAssignmentBatches = [];
let liveAssignmentBeneficiaries = [];

function filterAssignPrograms() {
    const search = (document.getElementById('assignProgSearch')?.value || '').toLowerCase().trim();
    const status = document.getElementById('assignProgStatusFilter')?.value || 'ALL';
    const progs = Array.isArray(programsList) ? programsList : [];

    const filtered = progs.filter(prog => {
        if (!prog) return false;
        const matchesSearch = !search || (prog.name && prog.name.toLowerCase().includes(search)) || (prog.category && prog.category.toLowerCase().includes(search)) || (prog.code && prog.code.toLowerCase().includes(search));
        const matchesStatus = status === 'ALL' || prog.status === status;
        return matchesSearch && matchesStatus;
    });

    renderAssignProgramsTable(filtered);
}

async function loadBatchesForProgram(progId) {
    liveAssignmentBatches = [];
    if (typeof DataService !== 'undefined') {
        try {
            // Check batches table
            const bRes = await DataService.batches.getAll({ program_id: progId });
            if (bRes.data && Array.isArray(bRes.data) && bRes.data.length > 0) {
                liveAssignmentBatches = bRes.data.map(b => ({
                    batch_id: b.id,
                    batch_num: b.name || `Batch #${b.id}`,
                    date: b.created_at ? b.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10),
                    trainer: 'PESO Operations Unit',
                    enrolled: Array.isArray(b.applications) ? b.applications.length : 0,
                    total: b.capacity || 50
                }));
            } else {
                // Fallback: derive from applications list
                const progApps = evalApplicationsList.filter(a => a.program_id === progId);
                const batchMap = {};
                progApps.forEach(a => {
                    const bKey = a.batch_num || (a.batch_id ? `Batch #${a.batch_id}` : 'General Intake');
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
                liveAssignmentBatches = Object.values(batchMap);
            }
        } catch (e) {
            console.warn('[ASSIGNMENT] Error loading batches:', e);
        }
    }
}

async function filterBatches() {
    const search = (document.getElementById('batchSearchInput')?.value || '').toLowerCase().trim();
    const filtered = liveAssignmentBatches.filter(b => {
        return !search || (b.batch_num && b.batch_num.toLowerCase().includes(search)) || (b.trainer && b.trainer.toLowerCase().includes(search)) || (b.date && b.date.toLowerCase().includes(search));
    });
    renderBatchesTable(filtered);
}

function filterBeneficiaries() {
    const search = (document.getElementById('benSearchInput')?.value || '').toLowerCase().trim();
    const filtered = liveAssignmentBeneficiaries.filter(b => {
        return !search || (b.full_name && b.full_name.toLowerCase().includes(search)) || (b.phone && b.phone.includes(search)) || (b.address && b.address.toLowerCase().includes(search));
    });
    renderBeneficiariesTable(filtered);
}

function handleProgramSelectionChange() {
    const progSelect = document.getElementById('actProgram');
    const subCatInput = document.getElementById('actSubCategory');
    if (!progSelect || !subCatInput) return;
    const val = progSelect.value;
    const prog = Array.isArray(programsList) ? programsList.find(p => p.code === val || p.id == val) : null;
    if (prog && prog.description) {
        subCatInput.value = prog.description;
    }
}

function showLevel1Programs() {
    const l1 = document.getElementById('assignmentLevel1');
    const l2 = document.getElementById('assignmentLevel2');
    const l3 = document.getElementById('assignmentLevel3');
    if (l1) l1.classList.remove('d-none');
    if (l2) l2.classList.add('d-none');
    if (l3) l3.classList.add('d-none');
    renderAssignProgramsTable();
}

function renderAssignProgramsTable(customList) {
    const list = customList || (Array.isArray(programsList) ? programsList : []);
    const tbody = document.getElementById('assignProgramsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No programs match current filters.</td></tr>';
        return;
    }
    list.forEach(prog => {
        const total = prog.total_slots || 50;
        const rem = Math.max(0, total - (prog.beneficiaries_count || 0));
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><div class="fw-bold text-dark">${escapeHtml(prog.name)}</div><span class="badge bg-dark-subtle text-dark font-monospace">${escapeHtml(prog.code)}</span></td>
            <td><span class="badge badge-category badge-emp">${escapeHtml(prog.category)}</span></td>
            <td class="text-center fw-semibold">${total}</td>
            <td class="text-center"><span class="badge bg-success-subtle text-success">${rem} slots available</span></td>
            <td class="text-center"><span class="badge ${prog.status === 'Active' ? 'bg-success' : 'bg-secondary'}">${prog.status}</span></td>
            <td class="text-end"><button class="btn btn-primary btn-sm fw-semibold" onclick="showLevel2Batches(${prog.id})">View Batches →</button></td>
        `;
        tbody.appendChild(tr);
    });
}

async function showLevel2Batches(progId) {
    if (progId) selectedProgramId = progId;
    const prog = programsList.find(p => p.id === selectedProgramId);
    const l1 = document.getElementById('assignmentLevel1');
    const l2 = document.getElementById('assignmentLevel2');
    const l3 = document.getElementById('assignmentLevel3');
    if (l1) l1.classList.add('d-none');
    if (l2) l2.classList.remove('d-none');
    if (l3) l3.classList.add('d-none');

    const titleEl = document.getElementById('batchProgTitle');
    if (titleEl) titleEl.textContent = `${prog ? prog.name : ''} Batches`;

    await loadBatchesForProgram(selectedProgramId);
    renderBatchesTable();
}

function renderBatchesTable(customList) {
    const tbody = document.getElementById('batchesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const batches = customList || liveAssignmentBatches;
    if (!batches || batches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No batches recorded for this program.</td></tr>';
        return;
    }
    batches.forEach(b => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><div class="fw-bold text-dark">${escapeHtml(b.batch_num)}</div></td>
            <td><small class="text-muted"><i class="bi bi-calendar-event me-1"></i>${escapeHtml(b.date || '')}</small></td>
            <td>${escapeHtml(b.trainer || 'PESO Team')}</td>
            <td class="text-center fw-semibold">${b.enrolled} / ${b.total}</td>
            <td class="text-center"><span class="badge bg-info-subtle text-primary">${Math.max(0, b.total - b.enrolled)} slots</span></td>
            <td class="text-end"><button class="btn btn-outline-primary btn-sm fw-semibold" onclick="showLevel3Beneficiaries(${b.batch_id}, '${escapeHtml(b.batch_num)}')">View Beneficiaries →</button></td>
        `;
        tbody.appendChild(tr);
    });
}

async function showLevel3Beneficiaries(batchId, batchNum) {
    if (batchId) selectedBatchId = batchId;
    const l1 = document.getElementById('assignmentLevel1');
    const l2 = document.getElementById('assignmentLevel2');
    const l3 = document.getElementById('assignmentLevel3');
    if (l1) l1.classList.add('d-none');
    if (l2) l2.classList.add('d-none');
    if (l3) l3.classList.remove('d-none');

    const titleEl = document.getElementById('benBatchTitle');
    if (titleEl) titleEl.textContent = `Beneficiaries Roster — ${batchNum}`;

    // Load actual applicants / beneficiaries for this batch
    const matchingApps = evalApplicationsList.filter(a =>
        a.program_id === selectedProgramId && (a.batch_id === batchId || a.batch_num === batchNum || !batchId)
    );

    liveAssignmentBeneficiaries = matchingApps.map(a => ({
        id: a.id,
        app_id: a.id,
        beneficiary_qr: a.beneficiary_qr,
        full_name: a.applicant_name,
        phone: a.phone,
        address: a.address,
        civil_status: a.civil_status,
        spouse: a.spouse_name,
        children: a.children_info,
        program_code: a.program_code,
        checklist_status: a.verification_status === 'Verified' ? 'Complete' : 'Pending Verification',
        assignment_status: a.evaluation_status === 'Approved' ? 'Assigned & Approved' : a.evaluation_status,
        docs: a.docs || []
    }));

    renderBeneficiariesTable();
}

function renderBeneficiariesTable(customList) {
    const tbody = document.getElementById('beneficiariesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const list = customList || liveAssignmentBeneficiaries;
    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No beneficiaries enrolled in this batch yet.</td></tr>';
        return;
    }
    list.forEach(ben => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><div class="fw-bold text-dark">${escapeHtml(ben.full_name)}</div></td>
            <td><span class="masked-phone">${maskContactNumber(ben.phone)}</span></td>
            <td><span class="badge ${ben.checklist_status === 'Complete' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}">${escapeHtml(ben.checklist_status)}</span></td>
            <td><span class="badge ${ben.assignment_status === 'Assigned & Approved' ? 'bg-primary' : 'bg-secondary'}">${escapeHtml(ben.assignment_status)}</span></td>
            <td class="text-end"><button class="btn btn-sm btn-outline-info" onclick="openBeneficiaryProfileModal(${ben.id})"><i class="bi bi-eye-fill me-1"></i>View Profile</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// Strictly Read-Only Beneficiary Profile Modal (Rule 1 & Data Privacy Rule 4)
function openBeneficiaryProfileModal(benId) {
    const ben = liveAssignmentBeneficiaries.find(b => b.id === benId) || evalApplicationsList.find(a => a.id === benId);
    if (!ben) {
        window.showSystemNotification({ title: 'Profile Notice', message: 'Beneficiary profile data not found.', type: 'warning' });
        return;
    }

    const fullName = ben.full_name || ben.applicant_name || 'Applicant';
    const phone = ben.phone || '';
    const address = ben.address || 'Koronadal City';

    const rawDob = ben.birthday || ben.date_of_birth || null;
    let computedAge = ben.age;
    if ((!computedAge || computedAge === 0 || computedAge === 'N/A') && rawDob) {
        try {
            computedAge = Math.max(0, Math.floor((new Date() - new Date(rawDob)) / (365.25 * 24 * 60 * 60 * 1000)));
        } catch (e) {}
    }
    const ageDisplay = (computedAge && computedAge !== 'N/A') ? `${computedAge} yrs old` : '25 yrs old';

    if (document.getElementById('benProfileName')) document.getElementById('benProfileName').textContent = fullName;
    if (document.getElementById('pFullName')) document.getElementById('pFullName').textContent = fullName;
    if (document.getElementById('pContact')) document.getElementById('pContact').textContent = maskContactNumber(phone);
    if (document.getElementById('pAddress')) document.getElementById('pAddress').textContent = address;
    if (document.getElementById('pAge')) document.getElementById('pAge').textContent = ageDisplay;
    if (document.getElementById('pSex')) document.getElementById('pSex').textContent = ben.sex || 'Female';
    if (document.getElementById('pCivilStatus')) document.getElementById('pCivilStatus').textContent = ben.civil_status || ben.marital_status || 'Single';
    if (document.getElementById('pBirthday')) document.getElementById('pBirthday').textContent = rawDob || 'N/A';
    if (document.getElementById('pChildren')) document.getElementById('pChildren').textContent = ben.children || ben.children_info || `${ben.number_of_children || 0} dependent children`;
    if (document.getElementById('pSpouse')) document.getElementById('pSpouse').textContent = ben.spouse || ben.spouse_name || 'N/A';
    if (document.getElementById('pValidId')) document.getElementById('pValidId').textContent = (ben.docs && ben.docs[0] && ben.docs[0].type) || 'Valid ID';
    if (document.getElementById('pBusinessType')) document.getElementById('pBusinessType').textContent = ben.program_code || 'Livelihood';
    if (document.getElementById('pProgramComponent')) document.getElementById('pProgramComponent').textContent = ben.program_name || 'PESO Assistance';
    if (document.getElementById('pBusinessStatus')) document.getElementById('pBusinessStatus').textContent = ben.evaluation_status || ben.assignment_status || 'Enrolled';
    if (document.getElementById('pAmountNeeded')) document.getElementById('pAmountNeeded').textContent = ben.amount_approved ? `₱${Number(ben.amount_approved).toLocaleString()}` : 'Standard Allocation';
    if (document.getElementById('pProposedBusiness')) document.getElementById('pProposedBusiness').textContent = ben.program_code || 'Livelihood Assistance';
    if (document.getElementById('pEmploymentStatus')) document.getElementById('pEmploymentStatus').textContent = 'Beneficiary Applicant';
    if (document.getElementById('pSeminars')) document.getElementById('pSeminars').textContent = 'Pre-employment Orientation';
    if (document.getElementById('pChecklist')) document.getElementById('pChecklist').textContent = ben.checklist_status || 'Verified';
    if (document.getElementById('pAssignmentStatus')) document.getElementById('pAssignmentStatus').textContent = ben.assignment_status || 'Enrolled';
    if (document.getElementById('pDocsList')) {
        const docs = Array.isArray(ben.docs) && ben.docs.length > 0 ? ben.docs : [{ file_name: 'Verified_ID.pdf' }];
        document.getElementById('pDocsList').innerHTML = docs.map(d => `<span class="badge bg-secondary me-1">${escapeHtml(d.file_name || d.type || 'Doc')}</span>`).join('');
    }

    safeOpenModal('beneficiaryProfileModal');
    logAuditEvent('VIEW_BENEFICIARY_PROFILE', `Viewed read-only profile for beneficiary ${fullName}`);
}

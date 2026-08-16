/**
 * PESO Admin Portal - Program Assignment Module (Tab 5)
 * Module: Assignment (peso-admin-assignment.js)
 */

let selectedProgramId = null;
let selectedBatchId = null;

function filterAssignPrograms() {
    const search = (document.getElementById('assignProgSearch')?.value || '').toLowerCase().trim();
    const status = document.getElementById('assignProgStatusFilter')?.value || 'ALL';
    const progs = Array.isArray(programsList) ? programsList : [];

    const filtered = progs.filter(prog => {
        const matchesSearch = !search || (prog.name && prog.name.toLowerCase().includes(search)) || (prog.category && prog.category.toLowerCase().includes(search)) || (prog.code && prog.code.toLowerCase().includes(search));
        const matchesStatus = status === 'ALL' || prog.status === status;
        return matchesSearch && matchesStatus;
    });

    renderAssignProgramsTable(filtered);
}

function filterBatches() {
    const search = (document.getElementById('batchSearchInput')?.value || '').toLowerCase().trim();
    const batches = PROGRAM_BATCHES[selectedProgramId] || [{ batch_id: 1011, batch_num: 'Batch 2026-A', date: '2026-03-15', trainer: 'PESO Operations Team', enrolled: 15, total: 25 }];
    const filtered = batches.filter(b => {
        return !search || (b.batch_num && b.batch_num.toLowerCase().includes(search)) || (b.trainer && b.trainer.toLowerCase().includes(search)) || (b.date && b.date.toLowerCase().includes(search));
    });
    renderBatchesTable(filtered);
}

function filterBeneficiaries() {
    const search = (document.getElementById('benSearchInput')?.value || '').toLowerCase().trim();
    const list = BATCH_BENEFICIARIES[selectedBatchId] || [{ id: 6, full_name: 'Juan Santos Dela Cruz', phone: '0905-111-2222', checklist_status: '4/4 Complete', assignment_status: 'Assigned & Approved' }];
    const filtered = list.filter(b => {
        return !search || (b.full_name && b.full_name.toLowerCase().includes(search)) || (b.phone && b.phone.includes(search));
    });
    renderBeneficiariesTable(filtered);
}

function handleProgramSelectionChange() {
    const progSelect = document.getElementById('actProgram');
    const subCatInput = document.getElementById('actSubCategory');
    if (!progSelect || !subCatInput) return;
    const val = progSelect.value;
    const defaults = {
        'TUPAD': 'Emergency Community Employment Assistance',
        'SPES': 'Special Program for Employment of Students - Summer Cohort',
        'PFAS': 'Pangkabuhayan Assistance Livelihood Project',
        'CKGIP': 'City Graduate Internship Workplace Placement'
    };
    if (!subCatInput.value || Object.values(defaults).includes(subCatInput.value)) {
        subCatInput.value = defaults[val] || '';
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

function showLevel2Batches(progId) {
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
    renderBatchesTable();
}

function renderBatchesTable(customList) {
    const tbody = document.getElementById('batchesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const batches = customList || (PROGRAM_BATCHES[selectedProgramId] || [{ batch_id: 1011, batch_num: 'Batch 2026-A', date: '2026-03-15', trainer: 'PESO Operations Team', enrolled: 15, total: 25 }]);
    if (batches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No batches match current filter.</td></tr>';
        return;
    }
    batches.forEach(b => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><div class="fw-bold text-dark">${escapeHtml(b.batch_num)}</div></td>
            <td><small class="text-muted"><i class="bi bi-calendar-event me-1"></i>${escapeHtml(b.date)}</small></td>
            <td>${escapeHtml(b.trainer)}</td>
            <td class="text-center fw-semibold">${b.enrolled} / ${b.total}</td>
            <td class="text-center"><span class="badge bg-info-subtle text-primary">${b.total - b.enrolled} slots</span></td>
            <td class="text-end"><button class="btn btn-outline-primary btn-sm fw-semibold" onclick="showLevel3Beneficiaries(${b.batch_id}, '${escapeHtml(b.batch_num)}')">View Beneficiaries →</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function showLevel3Beneficiaries(batchId, batchNum) {
    if (batchId) selectedBatchId = batchId;
    const l1 = document.getElementById('assignmentLevel1');
    const l2 = document.getElementById('assignmentLevel2');
    const l3 = document.getElementById('assignmentLevel3');
    if (l1) l1.classList.add('d-none');
    if (l2) l2.classList.add('d-none');
    if (l3) l3.classList.remove('d-none');

    const titleEl = document.getElementById('benBatchTitle');
    if (titleEl) titleEl.textContent = `Beneficiaries Roster — ${batchNum}`;
    renderBeneficiariesTable();
}

function renderBeneficiariesTable(customList) {
    const tbody = document.getElementById('beneficiariesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const list = customList || (BATCH_BENEFICIARIES[selectedBatchId] || [{ id: 6, full_name: 'Juan Santos Dela Cruz', phone: '0905-111-2222', checklist_status: '4/4 Complete', assignment_status: 'Assigned & Approved' }]);
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No beneficiaries match current search.</td></tr>';
        return;
    }
    list.forEach(ben => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><div class="fw-bold text-dark">${escapeHtml(ben.full_name)}</div></td>
            <td><span class="masked-phone">${maskContactNumber(ben.phone)}</span></td>
            <td><span class="badge bg-success-subtle text-success">${escapeHtml(ben.checklist_status)}</span></td>
            <td><span class="badge bg-primary">${escapeHtml(ben.assignment_status)}</span></td>
            <td class="text-end"><button class="btn btn-sm btn-outline-info" onclick="openBeneficiaryProfileModal(${ben.id})"><i class="bi bi-eye-fill me-1"></i>View Profile</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// Strictly Read-Only Beneficiary Profile Modal (Rule 1 & Data Privacy Rule 4)
function openBeneficiaryProfileModal(benId) {
    const ben = {
        full_name: 'Juan Santos Dela Cruz',
        phone: '0905-111-2222',
        address: 'Barangay Zone IV, Koronadal City',
        age: 29,
        sex: 'Male',
        civil_status: 'Single',
        birthday: '1997-04-12',
        children: 0,
        spouse: 'N/A',
        valid_id: 'PhilID',
        business_type: 'Sari-Sari Store',
        program_component: 'CKGIP',
        business_status: 'Operational',
        proposed_business: 'Dela Cruz Sari-Sari Store',
        amount_needed: '₱35,000.00',
        employment_status: 'Underemployed',
        seminars: 'Entrepreneurship 101',
        checklist_status: '4/4 Complete',
        assignment_status: 'Assigned & Approved',
        docs: ['PhilID.pdf']
    };

    if (document.getElementById('benProfileName')) document.getElementById('benProfileName').textContent = ben.full_name;
    if (document.getElementById('pFullName')) document.getElementById('pFullName').textContent = ben.full_name;
    if (document.getElementById('pContact')) document.getElementById('pContact').textContent = maskContactNumber(ben.phone);
    if (document.getElementById('pAddress')) document.getElementById('pAddress').textContent = ben.address;
    if (document.getElementById('pAge')) document.getElementById('pAge').textContent = ben.age;
    if (document.getElementById('pSex')) document.getElementById('pSex').textContent = ben.sex;
    if (document.getElementById('pCivilStatus')) document.getElementById('pCivilStatus').textContent = ben.civil_status;
    if (document.getElementById('pBirthday')) document.getElementById('pBirthday').textContent = ben.birthday;
    if (document.getElementById('pChildren')) document.getElementById('pChildren').textContent = ben.children;
    if (document.getElementById('pSpouse')) document.getElementById('pSpouse').textContent = ben.spouse;
    if (document.getElementById('pValidId')) document.getElementById('pValidId').textContent = ben.valid_id;
    if (document.getElementById('pBusinessType')) document.getElementById('pBusinessType').textContent = ben.business_type;
    if (document.getElementById('pProgramComponent')) document.getElementById('pProgramComponent').textContent = ben.program_component;
    if (document.getElementById('pBusinessStatus')) document.getElementById('pBusinessStatus').textContent = ben.business_status;
    if (document.getElementById('pAmountNeeded')) document.getElementById('pAmountNeeded').textContent = ben.amount_needed;
    if (document.getElementById('pProposedBusiness')) document.getElementById('pProposedBusiness').textContent = ben.proposed_business;
    if (document.getElementById('pEmploymentStatus')) document.getElementById('pEmploymentStatus').textContent = ben.employment_status;
    if (document.getElementById('pSeminars')) document.getElementById('pSeminars').textContent = ben.seminars;
    if (document.getElementById('pChecklist')) document.getElementById('pChecklist').textContent = ben.checklist_status;
    if (document.getElementById('pAssignmentStatus')) document.getElementById('pAssignmentStatus').textContent = ben.assignment_status;
    if (document.getElementById('pDocsList')) document.getElementById('pDocsList').innerHTML = ben.docs.map(d => `<span class="badge bg-secondary me-1">${d}</span>`).join('');

    safeOpenModal('beneficiaryProfileModal');
    logAuditEvent('VIEW_BENEFICIARY_PROFILE', `Viewed read-only profile for beneficiary ${ben.full_name}`);
}

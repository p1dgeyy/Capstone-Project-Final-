/**
 * PESO Admin Portal - Program Assignment Module (Tab 5)
 * Module: Assignment (peso-admin-assignment.js)
 * Implements: 3-Level Quota Tracking, Read-only Beneficiary Roster, Masked Contact Compliance
 */

let selectedProgramId = null;
let selectedBatchId = null;

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

function filterBatches() {
    const search = (document.getElementById('batchSearchInput')?.value || '').toLowerCase().trim();
    const batches = PROGRAM_BATCHES[selectedProgramId] || [
        { batch_id: (selectedProgramId || 1) * 10 + 1, batch_num: 'Batch 2026-A (Cohort 1)', date: '2026-03-15', trainer: 'PESO Operations Team', enrolled: 15, total: 25 },
        { batch_id: (selectedProgramId || 1) * 10 + 2, batch_num: 'Batch 2026-B (Cohort 2)', date: '2026-04-10', trainer: 'PESO Livelihood Bureau', enrolled: 12, total: 25 }
    ];
    const filtered = batches.filter(b => {
        if (!b) return false;
        return !search || (b.batch_num && b.batch_num.toLowerCase().includes(search)) || (b.trainer && b.trainer.toLowerCase().includes(search)) || (b.date && b.date.toLowerCase().includes(search));
    });
    renderBatchesTable(filtered);
}

function filterBeneficiaries() {
    const search = (document.getElementById('benSearchInput')?.value || '').toLowerCase().trim();
    const list = BATCH_BENEFICIARIES[selectedBatchId] || [
        { id: 601, full_name: 'Juan Santos Dela Cruz', phone: '0917-111-2222', checklist_status: '4/4 Complete', assignment_status: 'Assigned & Approved', address: 'Barangay Zone IV, Koronadal City' },
        { id: 602, full_name: 'Maria Clara De Los Reyes', phone: '0918-222-3333', checklist_status: '4/4 Complete', assignment_status: 'Assigned & Approved', address: 'Barangay GPS, Koronadal City' },
        { id: 603, full_name: 'Roberto Gomez Hernandez', phone: '0919-333-4444', checklist_status: '3/4 In Progress', assignment_status: 'Enrolled', address: 'Barangay Morales, Koronadal City' }
    ];
    const filtered = list.filter(b => {
        if (!b) return false;
        return !search || (b.full_name && b.full_name.toLowerCase().includes(search)) || (b.phone && b.phone.includes(search)) || (b.address && b.address.toLowerCase().includes(search));
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
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-1"></i>No programs match current filters.</td></tr>';
        return;
    }
    list.forEach(prog => {
        const total = Number(prog.total_slots) || 50;
        const enrolled = Number(prog.beneficiaries_count) || 0;
        const rem = Math.max(0, total - enrolled);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="fw-bold text-dark">${escapeHtml(prog.name || '')}</div>
                <span class="badge bg-dark-subtle text-dark font-monospace">${escapeHtml(prog.code || '')}</span>
            </td>
            <td><span class="badge badge-category badge-emp">${escapeHtml(prog.category || 'Livelihood')}</span></td>
            <td class="text-center fw-semibold">${total}</td>
            <td class="text-center"><span class="badge bg-success-subtle text-success border border-success">${rem} slots available</span></td>
            <td class="text-center"><span class="badge ${prog.status === 'Active' ? 'bg-success' : 'bg-secondary'} px-3 py-1">${prog.status || 'Active'}</span></td>
            <td class="text-end"><button class="btn btn-primary btn-sm fw-semibold" onclick="showLevel2Batches(${prog.id})">View Batches <i class="bi bi-chevron-right ms-1"></i></button></td>
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
    if (titleEl) titleEl.textContent = `${prog ? prog.name : 'Program'} Batches`;
    renderBatchesTable();

    const adminId = sessionStorage.getItem('userId') || '1';
    logAuditEvent('ASSIGNMENT_VIEW_BATCHES', `PESO Admin [ID:${adminId}] inspected assignment batches for Program: ${prog ? prog.code : selectedProgramId}`);
}

function renderBatchesTable(customList) {
    const tbody = document.getElementById('batchesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const batches = customList || (PROGRAM_BATCHES[selectedProgramId] || [
        { batch_id: (selectedProgramId || 1) * 10 + 1, batch_num: 'Batch 2026-A (Cohort 1)', date: '2026-03-15', trainer: 'PESO Operations Team', enrolled: 15, total: 25 },
        { batch_id: (selectedProgramId || 1) * 10 + 2, batch_num: 'Batch 2026-B (Cohort 2)', date: '2026-04-10', trainer: 'PESO Livelihood Bureau', enrolled: 12, total: 25 }
    ]);
    if (batches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-1"></i>No batches match current filter.</td></tr>';
        return;
    }
    batches.forEach(b => {
        const remSlots = Math.max(0, b.total - b.enrolled);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><div class="fw-bold text-dark">${escapeHtml(b.batch_num || '')}</div></td>
            <td><small class="text-muted"><i class="bi bi-calendar-event me-1"></i>${escapeHtml(b.date || '2026-03-15')}</small></td>
            <td>${escapeHtml(b.trainer || 'PESO Team')}</td>
            <td class="text-center fw-semibold">${b.enrolled} / ${b.total}</td>
            <td class="text-center"><span class="badge bg-info-subtle text-primary border">${remSlots} slots remaining</span></td>
            <td class="text-end"><button class="btn btn-outline-primary btn-sm fw-semibold" onclick="showLevel3Beneficiaries(${b.batch_id}, '${escapeHtml(b.batch_num || '')}')">View Beneficiaries <i class="bi bi-chevron-right ms-1"></i></button></td>
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
    if (titleEl) titleEl.textContent = `Beneficiaries Roster — ${batchNum || `Batch ${batchId}`}`;
    renderBeneficiariesTable();

    const adminId = sessionStorage.getItem('userId') || '1';
    logAuditEvent('ASSIGNMENT_VIEW_BENEFICIARIES', `PESO Admin [ID:${adminId}] inspected beneficiary roster for Batch: ${batchNum || batchId}`);
}

function renderBeneficiariesTable(customList) {
    const tbody = document.getElementById('beneficiariesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const list = customList || (BATCH_BENEFICIARIES[selectedBatchId] || [
        { id: 601, full_name: 'Juan Santos Dela Cruz', phone: '0917-111-2222', checklist_status: '4/4 Complete', assignment_status: 'Assigned & Approved', address: 'Barangay Zone IV, Koronadal City' },
        { id: 602, full_name: 'Maria Clara De Los Reyes', phone: '0918-222-3333', checklist_status: '4/4 Complete', assignment_status: 'Assigned & Approved', address: 'Barangay GPS, Koronadal City' },
        { id: 603, full_name: 'Roberto Gomez Hernandez', phone: '0919-333-4444', checklist_status: '3/4 In Progress', assignment_status: 'Enrolled', address: 'Barangay Morales, Koronadal City' }
    ]);
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-1"></i>No beneficiaries match current search.</td></tr>';
        return;
    }
    list.forEach(ben => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="fw-bold text-dark">${escapeHtml(ben.full_name || 'Beneficiary')}</div>
                <small class="text-muted"><i class="bi bi-geo-alt me-1"></i>${escapeHtml(ben.address || 'Koronadal City')}</small>
            </td>
            <td><span class="masked-phone">${maskContactNumber(ben.phone)}</span></td>
            <td><span class="badge bg-success-subtle text-success border border-success">${escapeHtml(ben.checklist_status || 'Complete')}</span></td>
            <td><span class="badge bg-primary px-2.5 py-1">${escapeHtml(ben.assignment_status || 'Assigned')}</span></td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-info fw-semibold" onclick="openBeneficiaryProfileModal(${ben.id})">
                    <i class="bi bi-eye-fill me-1"></i> View Profile (Read-Only)
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Strictly Read-Only Beneficiary Profile Modal (Rule 1 & Data Privacy Rule 4)
function openBeneficiaryProfileModal(benId) {
    const fallbackBen = {
        full_name: 'Juan Santos Dela Cruz',
        phone: '0917-111-2222',
        address: 'Barangay Zone IV, Koronadal City',
        age: 29,
        sex: 'Male',
        civil_status: 'Single',
        birthday: '1997-04-12',
        children: 0,
        spouse: 'N/A',
        valid_id: 'PhilID (National ID)',
        business_type: 'Community Retail Store',
        program_component: 'Livelihood Assistance',
        business_status: 'Operational',
        proposed_business: 'Dela Cruz General Merchandise',
        amount_needed: '₱35,000.00',
        employment_status: 'Underemployed',
        seminars: 'Basic Financial Literacy & Entrepreneurship 101',
        checklist_status: '4/4 Complete',
        assignment_status: 'Assigned & Approved',
        docs: ['Beneficiary_PhilID.pdf', 'Barangay_Clearance.pdf', 'Livelihood_Proposal.pdf']
    };

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || 'N/A';
    };

    setText('benProfileName', fallbackBen.full_name);
    setText('pFullName', fallbackBen.full_name);
    setText('pContact', maskContactNumber(fallbackBen.phone));
    setText('pAddress', fallbackBen.address);
    setText('pAge', fallbackBen.age);
    setText('pSex', fallbackBen.sex);
    setText('pCivilStatus', fallbackBen.civil_status);
    setText('pBirthday', fallbackBen.birthday);
    setText('pChildren', fallbackBen.children);
    setText('pSpouse', fallbackBen.spouse);
    setText('pValidId', fallbackBen.valid_id);
    setText('pBusinessType', fallbackBen.business_type);
    setText('pProgramComponent', fallbackBen.program_component);
    setText('pBusinessStatus', fallbackBen.business_status);
    setText('pAmountNeeded', fallbackBen.amount_needed);
    setText('pProposedBusiness', fallbackBen.proposed_business);
    setText('pEmploymentStatus', fallbackBen.employment_status);
    setText('pSeminars', fallbackBen.seminars);
    setText('pChecklist', fallbackBen.checklist_status);
    setText('pAssignmentStatus', fallbackBen.assignment_status);

    const docsContainer = document.getElementById('pDocsList');
    if (docsContainer) {
        docsContainer.innerHTML = '';
        fallbackBen.docs.forEach(doc => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-sm btn-outline-primary me-2 mb-1';
            btn.innerHTML = `<i class="bi bi-file-earmark-pdf me-1 text-danger"></i>${escapeHtml(doc)}`;
            btn.onclick = () => {
                if (typeof openDocPreview === 'function') {
                    openDocPreview('Beneficiary Requirement Document', doc);
                }
            };
            docsContainer.appendChild(btn);
        });
    }

    safeOpenModal('beneficiaryProfileModal');
    const adminId = sessionStorage.getItem('userId') || '1';
    logAuditEvent('VIEW_BENEFICIARY_PROFILE', `PESO Admin [ID:${adminId}] viewed read-only profile for beneficiary: ${fallbackBen.full_name} (ID: ${benId})`);
}

function exportBeneficiariesCSV() {
    let csv = 'ID,Full Name,Phone (Masked),Address,Checklist Status,Assignment Status\n';
    const list = BATCH_BENEFICIARIES[selectedBatchId] || [
        { id: 601, full_name: 'Juan Santos Dela Cruz', phone: '0917-111-2222', checklist_status: '4/4 Complete', assignment_status: 'Assigned & Approved', address: 'Barangay Zone IV, Koronadal City' },
        { id: 602, full_name: 'Maria Clara De Los Reyes', phone: '0918-222-3333', checklist_status: '4/4 Complete', assignment_status: 'Assigned & Approved', address: 'Barangay GPS, Koronadal City' },
        { id: 603, full_name: 'Roberto Gomez Hernandez', phone: '0919-333-4444', checklist_status: '3/4 In Progress', assignment_status: 'Enrolled', address: 'Barangay Morales, Koronadal City' }
    ];

    list.forEach(b => {
        csv += `${b.id},"${b.full_name}","${maskContactNumber(b.phone)}","${b.address}","${b.checklist_status}","${b.assignment_status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `PESO_Beneficiaries_Batch_${selectedBatchId || 1011}_${new Date().toISOString().substring(0, 10)}.csv`;
    link.click();

    const adminId = sessionStorage.getItem('userId') || '1';
    logAuditEvent('EXPORT_BENEFICIARIES_CSV', `PESO Admin [ID:${adminId}] exported Beneficiary Roster CSV for Batch ${selectedBatchId || 1011}`);
    window.showSystemNotification({ title: 'Export Complete', message: 'Beneficiary roster CSV downloaded successfully.', type: 'info' });
}

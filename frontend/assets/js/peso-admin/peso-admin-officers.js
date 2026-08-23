/**
 * PESO Admin Portal - PESO Officers Management Module (Tab 6)
 * Module: Officers (peso-admin-officers.js)
 */

let officersList = [];

async function initOfficersData() {
    if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
        try {
            const res = await DataService.staffProfiles.getAll({ agency: 'PESO' });
            if (res.data && Array.isArray(res.data)) {
                // Strict Segregation: Exclude all CSWDO records
                officersList = res.data
                    .filter(off => !['CSWDO Admin', 'CSWDO Officer'].includes(off.role) && (off.department || 'PESO') !== 'CSWDO')
                    .map(off => ({
                        id: off.id,
                        first_name: off.first_name || '',
                        middle_name: off.middle_name || '',
                        last_name: off.last_name || '',
                        suffix: off.suffix || 'N/A',
                        username: off.username || '',
                        email: off.email || '',
                        role: off.role || 'PESO Officer',
                        department: off.department || 'PESO',
                        phone: off.phone || off.contact_number || 'N/A',
                        sex: off.sex || off.gender || 'Male',
                        address: off.address || 'City of Koronadal',
                        status: (off.status === 'Deactivated' || off.status === 'Inactive') ? 'Deactivated' : 'Active'
                    }));
                const adminOff = officersList.find(o => (o.username && o.username.toLowerCase() === 'peso-admin') || (o.email && (o.email.toLowerCase() === 'peso.admin@gmail.com' || o.email.toLowerCase() === 'peso.admin@koronadal.gov.ph')));
                if (adminOff) adminOff.status = 'Active';
                if (document.getElementById('sectionOfficers') && !document.getElementById('sectionOfficers').classList.contains('d-none')) {
                    renderOfficersTables();
                }
                return;
            }
        } catch (e) {
            console.warn('[OFFICERS] Supabase staff fetch notice:', e);
        }
    }
    officersList = [];
    if (document.getElementById('sectionOfficers') && !document.getElementById('sectionOfficers').classList.contains('d-none')) {
        renderOfficersTables();
    }
}

async function fetchOfficersFromApi() {
    await initOfficersData();
}

function filterOfficers() {
    renderOfficersTables();
}

function renderOfficersTables() {
    if (!Array.isArray(officersList)) {
        officersList = [];
    }

    const searchInput = document.getElementById('officerSearchInput');
    const search = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const roleSelect = document.getElementById('officerRoleFilter');
    const roleFilter = roleSelect ? roleSelect.value : 'ALL';
    const deptSelect = document.getElementById('officerDeptFilter');
    const deptFilter = deptSelect ? deptSelect.value : 'ALL';
    const statusSelect = document.getElementById('officerStatusFilter');
    const statusFilter = statusSelect ? statusSelect.value : 'ALL';

    const safeList = Array.isArray(officersList) ? officersList : [];
    const filtered = safeList.filter(off => {
        if (!off) return false;
        // Strict Segregation
        if (['CSWDO Admin', 'CSWDO Officer'].includes(off.role) || (off.department || '').toUpperCase() === 'CSWDO') {
            return false;
        }

        const fullName = `${off.first_name || ''} ${off.middle_name || ''} ${off.last_name || ''} ${off.suffix && off.suffix !== 'N/A' ? off.suffix : ''}`.toLowerCase();
        const matchesSearch = !search || fullName.includes(search) || (off.username || '').toLowerCase().includes(search) || (off.email || '').toLowerCase().includes(search);
        const matchesRole = roleFilter === 'ALL' || off.role === roleFilter;
        const matchesDept = deptFilter === 'ALL' || off.department === deptFilter;
        const matchesStatus = statusFilter === 'ALL' || off.status === statusFilter;
        return matchesSearch && matchesRole && matchesDept && matchesStatus;
    });

    const activeOfficers = filtered.filter(o => o.status === 'Active');
    const archivedOfficers = filtered.filter(o => o.status === 'Deactivated');

    // Render Active Officers Table
    const activeTbody = document.getElementById('activeOfficersTableBody');
    if (activeTbody) {
        activeTbody.innerHTML = activeOfficers.length === 0 ? `<tr><td colspan="8" class="text-center py-4 text-muted">No active officer accounts found matching criteria.</td></tr>` : '';
        activeOfficers.forEach(off => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            const fullName = `${escapeHtml(off.first_name)} ${escapeHtml(off.middle_name || '')} ${escapeHtml(off.last_name)} ${off.suffix && off.suffix !== 'N/A' ? escapeHtml(off.suffix) : ''}`.trim();
            tr.innerHTML = `
                <td onclick="openEditOfficerModal(${off.id})">
                    <div class="fw-bold text-dark">${fullName}</div>
                    <small class="text-muted"><i class="bi bi-gender-ambiguous me-1"></i>${escapeHtml(off.sex || 'N/A')}</small>
                </td>
                <td onclick="openEditOfficerModal(${off.id})"><span class="badge bg-light text-dark font-monospace border">${escapeHtml(off.username)}</span></td>
                <td onclick="openEditOfficerModal(${off.id})">${escapeHtml(off.email)}</td>
                <td onclick="openEditOfficerModal(${off.id})"><span class="badge bg-primary-subtle text-primary fw-semibold">${escapeHtml(off.role)}</span></td>
                <td onclick="openEditOfficerModal(${off.id})"><span class="badge bg-secondary-subtle text-dark">${escapeHtml(off.department)}</span></td>
                <td onclick="openEditOfficerModal(${off.id})"><span class="masked-phone">${escapeHtml(maskContactNumber(off.phone))}</span></td>
                <td onclick="openEditOfficerModal(${off.id})"><span class="badge bg-success px-2.5 py-1">Active</span></td>
                <td class="text-end" onclick="event.stopPropagation()">
                    <div class="d-inline-flex align-items-center gap-2">
                        <div class="form-check form-switch mb-0" title="Toggle status (Active / Deactivated)">
                            <input class="form-check-input" type="checkbox" role="switch" checked onchange="handleOfficerStatusToggle(event, ${off.id})" aria-label="Toggle Status">
                        </div>
                        <button class="btn btn-sm btn-outline-primary" onclick="openEditOfficerModal(${off.id})">
                            <i class="bi bi-pencil-square"></i> Details / Edit
                        </button>
                    </div>
                </td>
            `;
            activeTbody.appendChild(tr);
        });
    }

    // Render Archive Box Table (Deactivated Officers)
    const archiveTbody = document.getElementById('archivedOfficersTableBody');
    if (archiveTbody) {
        archiveTbody.innerHTML = archivedOfficers.length === 0 ? `<tr><td colspan="8" class="text-center py-4 text-muted">Archive box clean — no deactivated officer accounts.</td></tr>` : '';
        archivedOfficers.forEach(off => {
            const tr = document.createElement('tr');
            const fullName = `${escapeHtml(off.first_name)} ${escapeHtml(off.middle_name || '')} ${escapeHtml(off.last_name)} ${off.suffix && off.suffix !== 'N/A' ? escapeHtml(off.suffix) : ''}`.trim();
            tr.innerHTML = `
                <td>
                    <div class="fw-bold text-secondary text-decoration-line-through">${fullName}</div>
                    <small class="text-muted"><i class="bi bi-lock-fill text-warning me-1"></i>Access Revoked</small>
                </td>
                <td><span class="badge bg-light text-muted font-monospace border">${escapeHtml(off.username)}</span></td>
                <td>${escapeHtml(off.email)}</td>
                <td><span class="badge bg-secondary-subtle text-secondary">${escapeHtml(off.role)}</span></td>
                <td><span class="badge bg-light text-dark">${escapeHtml(off.department)}</span></td>
                <td><span class="masked-phone">${escapeHtml(maskContactNumber(off.phone))}</span></td>
                <td><span class="badge bg-danger px-2.5 py-1">Deactivated</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-success me-1" onclick="activateOfficerAccount(${off.id})">
                        <i class="bi bi-shield-check"></i> Restore (Activate)
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="permanentlyDeleteOfficer(${off.id})">
                        <i class="bi bi-trash-fill"></i> Delete
                    </button>
                </td>
            `;
            archiveTbody.appendChild(tr);
        });
    }

    // Update Badge Counts
    const totalActive = officersList.filter(o => o.status === 'Active').length;
    const totalDeactivated = officersList.filter(o => o.status === 'Deactivated').length;
    if (document.getElementById('activeOfficersBadge')) document.getElementById('activeOfficersBadge').textContent = `${totalActive} Active Officers`;
    if (document.getElementById('archiveOfficersBadge')) document.getElementById('archiveOfficersBadge').textContent = `${totalDeactivated} Archived Officers`;
}

function renderOfficersArchiveTable(customList) {
    renderOfficersTables();
}

function renderActiveOfficersTable() {
    renderOfficersTables();
}

function calcCreateOfficerAge() {
    const dobInput = document.getElementById('createOffDob') || document.getElementById('newOffDob');
    const ageInput = document.getElementById('createOffAge') || document.getElementById('newOffAge');
    if (!dobInput || !ageInput) return;
    const dobVal = dobInput.value;
    if (!dobVal) {
        ageInput.value = '';
        return;
    }
    const today = new Date();
    const birthDate = new Date(dobVal);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    ageInput.value = isNaN(age) || age < 0 ? '' : age;
}
const calcNewOfficerAge = calcCreateOfficerAge;

function openCreateOfficerModal() {
    const form = document.getElementById('createOfficerForm') || document.getElementById('newOfficerForm');
    if (form) {
        form.reset();
        form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    }
    const ageEl = document.getElementById('createOffAge') || document.getElementById('newOffAge');
    if (ageEl) ageEl.value = '';
    const roleEl = document.getElementById('createOffRole') || document.getElementById('newOffRole');
    if (roleEl) roleEl.value = '';

    logAuditEvent('OPEN_CREATE_OFFICER_FORM', 'Opened Create New Officer Account form modal');
    
    if (document.getElementById('createOfficerModal')) {
        safeOpenModal('createOfficerModal');
    } else if (document.getElementById('newOfficerModal')) {
        safeOpenModal('newOfficerModal');
    } else if (typeof openNewUserModal === 'function') {
        openNewUserModal();
    }
}
const openNewOfficerModal = openCreateOfficerModal;

async function handleCreateOfficerSubmit(e) {
    e.preventDefault();
    const form = document.getElementById('createOfficerForm') || e.target;

    // Reset previous inline validation states
    if (form) {
        form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    }

    const roleEl = document.getElementById('createOffRole') || document.getElementById('newOffRole');
    const firstNameEl = document.getElementById('createOffFirstName') || document.getElementById('newOffFirstName');
    const middleNameEl = document.getElementById('createOffMiddleName') || document.getElementById('newOffMiddleName');
    const lastNameEl = document.getElementById('createOffLastName') || document.getElementById('newOffLastName');
    const suffixEl = document.getElementById('createOffSuffix') || document.getElementById('newOffSuffix');
    const dobEl = document.getElementById('createOffDob') || document.getElementById('newOffDob');
    const ageEl = document.getElementById('createOffAge') || document.getElementById('newOffAge');
    const addressEl = document.getElementById('createOffAddress') || document.getElementById('newOffAddress');
    const phoneEl = document.getElementById('createOffPhone') || document.getElementById('newOffPhone') || document.getElementById('newOffContactNumber');
    const emailEl = document.getElementById('createOffEmail') || document.getElementById('newOffEmail');
    const usernameEl = document.getElementById('createOffUsername') || document.getElementById('newOffUsername');
    const passwordEl = document.getElementById('createOffPassword') || document.getElementById('newOffPassword');
    const confirmPasswordEl = document.getElementById('createOffConfirmPassword') || document.getElementById('newOffConfirmPassword');

    let isValid = true;
    function setInvalid(element, msg) {
        if (!element) return;
        element.classList.add('is-invalid');
        const feedback = element.parentElement ? element.parentElement.querySelector('.invalid-feedback') : null;
        if (feedback && msg) feedback.textContent = msg;
        if (isValid) {
            element.focus();
        }
        isValid = false;
    }

    // 1. Mandatory User Role validation (Only PESO Admin or PESO Officer allowed)
    const role = (roleEl?.value || '').trim();
    if (!role || !['PESO Admin', 'PESO Officer'].includes(role)) {
        setInvalid(roleEl, 'User role selection is mandatory (PESO Admin or PESO Officer).');
    }

    // 2. Personal Information validations
    const firstName = (firstNameEl?.value || '').trim();
    if (!firstName) {
        setInvalid(firstNameEl, 'First name is required.');
    }

    const middleName = (middleNameEl?.value || '').trim();
    const lastName = (lastNameEl?.value || '').trim();
    if (!lastName) {
        setInvalid(lastNameEl, 'Last name is required.');
    }

    const suffix = (suffixEl?.value || '').trim();
    const dob = dobEl?.value || '';
    if (!dob) {
        setInvalid(dobEl, 'Valid birthdate is required.');
    }

    const age = ageEl?.value || '';
    const address = (addressEl?.value || '').trim();
    if (!address) {
        setInvalid(addressEl, 'Address is required.');
    }

    // 3. Contact Number validation (PH based)
    const contactNumber = (phoneEl?.value || '').trim();
    const phoneDigits = contactNumber.replace(/[-\s]/g, '');
    const phoneRegex = /^(09|\+639)\d{9}$/;
    if (!contactNumber) {
        setInvalid(phoneEl, 'Contact number is required.');
    } else if (!phoneRegex.test(phoneDigits)) {
        setInvalid(phoneEl, 'Please enter a valid PH mobile number (e.g. 09123456789 or +639123456789).');
    }

    // 4. Email validation
    const email = (emailEl?.value || '').trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
        setInvalid(emailEl, 'Email address is required.');
    } else if (!emailRegex.test(email)) {
        setInvalid(emailEl, 'Please provide a valid email address (e.g. officer@gmail.com).');
    }

    // 5. Account Information validations
    const username = (usernameEl?.value || '').trim();
    if (!username) {
        setInvalid(usernameEl, 'Username is required.');
    } else if (username.length < 3) {
        setInvalid(usernameEl, 'Username must be at least 3 characters.');
    } else if (officersList.some(o => o.username && o.username.toLowerCase() === username.toLowerCase())) {
        setInvalid(usernameEl, `Username "${username}" is already assigned to another account.`);
    }

    const password = passwordEl?.value || '';
    const confirmPassword = confirmPasswordEl?.value || '';

    if (!password) {
        setInvalid(passwordEl, 'Password is required.');
    } else if (password.length < 8) {
        setInvalid(passwordEl, 'Password must be a minimum of 8 characters in length.');
    }

    if (!confirmPassword) {
        setInvalid(confirmPasswordEl, 'Confirm password is required.');
    } else if (password !== confirmPassword) {
        setInvalid(confirmPasswordEl, 'Passwords do not match.');
    }

    if (!isValid) {
        return;
    }

    const department = 'PESO';
    let createdId = Date.now();
    const newOff = {
        id: createdId,
        agency: 'PESO',
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName,
        suffix: (suffix && suffix !== 'N/A') ? suffix : null,
        birth_date: dob || null,
        age: age ? parseInt(age, 10) : null,
        username: username,
        email: email,
        role: role,
        department: department,
        phone: contactNumber,
        address: address,
        status: 'Active'
    };

    if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
        try {
            const createRes = await DataService.staffProfiles.create(newOff);
            if (createRes.data) {
                newOff.id = createRes.data.id;
            }
        } catch (err) {
            console.warn('[OFFICERS] Supabase staff creation notice:', err);
        }
    }

    officersList.unshift(newOff);
    logAuditEvent('CREATE_OFFICER_ACCOUNT', `Created new officer account "${username}" (${firstName} ${lastName}), Role: ${role}, Dept: ${department}`);

    if (document.getElementById('createOfficerModal')) {
        safeHideModal('createOfficerModal');
    } else {
        safeHideModal('newOfficerModal');
    }
    renderOfficersTables();

    window.showSystemNotification({
        title: 'Officer Account Created',
        message: `Officer account for ${firstName} ${lastName} (${username}) created successfully as ${role}.`,
        type: 'success'
    });
}

function calcEditOfficerAge() {
    const dobInput = document.getElementById('editOffDob');
    const ageInput = document.getElementById('editOffAge');
    if (!dobInput || !ageInput) return;
    const dobVal = dobInput.value;
    if (!dobVal) {
        ageInput.value = '';
        return;
    }
    const today = new Date();
    const birthDate = new Date(dobVal);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    ageInput.value = isNaN(age) || age < 0 ? '' : age;
}

function openEditOfficerModal(officerId) {
    if (!Array.isArray(officersList)) officersList = [];
    const off = officersList.find(o => o && o.id === officerId);
    if (!off) {
        console.warn('[OFFICERS] Officer record not found for ID:', officerId);
        window.showSystemNotification({ title: 'Officer Notice', message: 'Officer details not found.', type: 'warning' });
        return;
    }

    const form = document.getElementById('editOfficerForm');
    if (form) {
        form.reset();
        form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    }

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('editOffId', off.id);
    setVal('editOffFirstName', off.first_name || '');
    setVal('editOffMiddleName', off.middle_name || '');
    setVal('editOffLastName', off.last_name || '');
    setVal('editOffSuffix', off.suffix || '');
    setVal('editOffDob', off.birth_date || '');
    setVal('editOffAge', off.age || '');
    setVal('editOffAddress', off.address || '');
    setVal('editOffPhone', off.phone || '');
    setVal('editOffEmail', off.email || '');
    setVal('editOffUsername', off.username || '');
    setVal('editOffRole', off.role || 'PESO Officer');
    setVal('editOffPassword', '');
    setVal('editOffConfirmPassword', '');

    if (off.birth_date && !off.age) {
        calcEditOfficerAge();
    }

    logAuditEvent('OPEN_EDIT_OFFICER_FORM', `Opened Edit Officer Account form for "${off.username}" (ID: ${off.id})`);
    safeOpenModal('editOfficerModal');
}

async function handleSaveOfficerUpdates(e) {
    e.preventDefault();
    const form = document.getElementById('editOfficerForm') || e.target;
    if (form) {
        form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    }

    const offIdEl = document.getElementById('editOffId');
    const offId = offIdEl ? Number(offIdEl.value) : null;
    const off = officersList.find(o => o && o.id === offId);
    if (!off) {
        window.showSystemNotification({ title: 'Update Error', message: 'Target officer account not found.', type: 'danger' });
        return;
    }

    const roleEl = document.getElementById('editOffRole');
    const firstNameEl = document.getElementById('editOffFirstName');
    const middleNameEl = document.getElementById('editOffMiddleName');
    const lastNameEl = document.getElementById('editOffLastName');
    const suffixEl = document.getElementById('editOffSuffix');
    const dobEl = document.getElementById('editOffDob');
    const ageEl = document.getElementById('editOffAge');
    const addressEl = document.getElementById('editOffAddress');
    const phoneEl = document.getElementById('editOffPhone');
    const emailEl = document.getElementById('editOffEmail');
    const usernameEl = document.getElementById('editOffUsername');
    const passwordEl = document.getElementById('editOffPassword');
    const confirmPasswordEl = document.getElementById('editOffConfirmPassword');

    let isValid = true;
    function setInvalid(element, msg) {
        if (!element) return;
        element.classList.add('is-invalid');
        const feedback = element.parentElement ? element.parentElement.querySelector('.invalid-feedback') : null;
        if (feedback && msg) feedback.textContent = msg;
        if (isValid) {
            element.focus();
        }
        isValid = false;
    }

    // 1. Mandatory User Role validation (Only PESO Admin or PESO Officer allowed)
    const role = (roleEl?.value || '').trim();
    if (!role || !['PESO Admin', 'PESO Officer'].includes(role)) {
        setInvalid(roleEl, 'User role selection is mandatory (PESO Admin or PESO Officer).');
    }

    // 2. Personal Information validations
    const firstName = (firstNameEl?.value || '').trim();
    if (!firstName) {
        setInvalid(firstNameEl, 'First name is required.');
    }

    const middleName = (middleNameEl?.value || '').trim();
    const lastName = (lastNameEl?.value || '').trim();
    if (!lastName) {
        setInvalid(lastNameEl, 'Last name is required.');
    }

    const suffix = (suffixEl?.value || '').trim();
    const dob = dobEl?.value || '';
    if (!dob) {
        setInvalid(dobEl, 'Valid birthdate is required.');
    }

    const age = ageEl?.value || '';
    const address = (addressEl?.value || '').trim();
    if (!address) {
        setInvalid(addressEl, 'Address is required.');
    }

    // 3. Contact Number validation (PH based)
    const phone = (phoneEl?.value || '').trim();
    const phoneDigits = phone.replace(/[-\s]/g, '');
    const phoneRegex = /^(09|\+639)\d{9}$/;
    if (!phone) {
        setInvalid(phoneEl, 'Contact number is required.');
    } else if (!phoneRegex.test(phoneDigits)) {
        setInvalid(phoneEl, 'Please enter a valid PH mobile number (e.g. 09123456789 or +639123456789).');
    }

    // 4. Email validation
    const email = (emailEl?.value || '').trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
        setInvalid(emailEl, 'Email address is required.');
    } else if (!emailRegex.test(email)) {
        setInvalid(emailEl, 'Please provide a valid email address (e.g. officer@gmail.com).');
    }

    // 5. Account Information validations
    const username = (usernameEl?.value || '').trim();
    if (!username) {
        setInvalid(usernameEl, 'Username is required.');
    } else if (username.length < 3) {
        setInvalid(usernameEl, 'Username must be at least 3 characters.');
    } else if (officersList.some(o => o.id !== offId && o.username && o.username.toLowerCase() === username.toLowerCase())) {
        setInvalid(usernameEl, `Username "${username}" is already assigned to another account.`);
    }

    // 6. Optional Password Update validation
    const password = passwordEl?.value || '';
    const confirmPassword = confirmPasswordEl?.value || '';

    if (password) {
        if (password.length < 8) {
            setInvalid(passwordEl, 'Password must be a minimum of 8 characters in length.');
        }
        if (!confirmPassword) {
            setInvalid(confirmPasswordEl, 'Confirm password is required when changing password.');
        } else if (password !== confirmPassword) {
            setInvalid(confirmPasswordEl, 'Passwords do not match.');
        }
    }

    if (!isValid) {
        return;
    }

    off.first_name = firstName;
    off.middle_name = middleName || null;
    off.last_name = lastName;
    off.suffix = (suffix && suffix !== 'N/A') ? suffix : null;
    off.birth_date = dob || null;
    off.age = age ? parseInt(age, 10) : null;
    off.address = address;
    off.phone = phone;
    off.email = email;
    off.username = username;
    off.role = role;
    off.department = 'PESO';

    const updatePayload = {
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName,
        suffix: (suffix && suffix !== 'N/A') ? suffix : null,
        birth_date: dob || null,
        age: age ? parseInt(age, 10) : null,
        address: address,
        phone: phone,
        email: email,
        username: username,
        role: role,
        department: 'PESO'
    };

    if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
        try {
            await DataService.staffProfiles.update(offId, updatePayload);
        } catch (err) {
            console.warn('[OFFICERS] Supabase update warning:', err);
        }
    }

    logAuditEvent('UPDATE_OFFICER_ACCOUNT', `Updated details for officer account ID ${offId} (${username}), Role: ${role}`);

    safeHideModal('editOfficerModal');
    renderOfficersTables();

    window.showSystemNotification({
        title: 'Account Updated',
        message: `Officer profile for "${firstName} ${lastName}" (${username}) updated successfully as ${role}.`,
        type: 'success'
    });
}

async function handleOfficerStatusToggle(event, officerId) {
    const off = officersList.find(o => o.id === officerId);
    if (!off) return;

    const isDeactivating = !event.target.checked;
    const newStatus = isDeactivating ? 'Deactivated' : 'Active';

    off.status = newStatus;

    if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
        try {
            await DataService.staffProfiles.setStatus(officerId, newStatus);
        } catch (err) { }
    }

    logAuditEvent(isDeactivating ? 'DEACTIVATE_OFFICER_ACCOUNT' : 'ACTIVATE_OFFICER_ACCOUNT', `Updated status of officer account "${off.username}" to ${newStatus}`);
    renderOfficersTables();

    window.showSystemNotification({
        title: 'Officer Status Updated',
        message: `Officer account "${off.username}" set to ${newStatus}.`,
        type: isDeactivating ? 'warning' : 'success'
    });
}

async function activateOfficerAccount(officerId) {
    const off = officersList.find(o => o.id === officerId);
    if (!off) return;

    off.status = 'Active';

    if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
        try {
            await DataService.staffProfiles.setStatus(officerId, 'Active');
        } catch (err) { }
    }

    logAuditEvent('ACTIVATE_OFFICER_ACCOUNT', `Restored officer account "${off.username}" to Active status.`);
    renderOfficersTables();

    window.showSystemNotification({
        title: 'Account Restored',
        message: `Officer account "${off.username}" restored to Active status successfully.`,
        type: 'success'
    });
}

async function permanentlyDeleteOfficer(officerId) {
    const off = officersList.find(o => o.id === officerId);
    if (!off) return;

    if (!confirm(`Confirm Permanent Deletion: Are you sure you want to permanently delete officer account "${off.username}"?`)) {
        return;
    }

    const username = off.username;
    officersList = officersList.filter(o => o.id !== officerId);

    if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
        try {
            await DataService.staffProfiles.delete(officerId);
        } catch (err) { }
    }

    logAuditEvent('PERMANENT_DELETE_OFFICER', `Permanently deleted officer account "${username}" (ID: ${officerId})`);
    renderOfficersTables();

    window.showSystemNotification({
        title: 'Officer Account Deleted',
        message: `Officer account "${username}" permanently deleted.`,
        type: 'danger'
    });
}

// Global window exposure
window.openCreateOfficerModal = openCreateOfficerModal;
window.openNewOfficerModal = openCreateOfficerModal;
window.calcCreateOfficerAge = calcCreateOfficerAge;
window.calcNewOfficerAge = calcCreateOfficerAge;
window.calcEditOfficerAge = calcEditOfficerAge;
window.handleCreateOfficerSubmit = handleCreateOfficerSubmit;
window.openEditOfficerModal = openEditOfficerModal;
window.handleSaveOfficerUpdates = handleSaveOfficerUpdates;
window.handleOfficerStatusToggle = handleOfficerStatusToggle;

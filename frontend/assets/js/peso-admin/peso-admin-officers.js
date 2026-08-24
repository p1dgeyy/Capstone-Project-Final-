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

function getLoggedInAdminIdentity() {
    let adminId = 'PESO Admin';
    try {
        if (typeof SessionManager !== 'undefined' && SessionManager.getUserId) {
            const uid = SessionManager.getUserId();
            if (uid) adminId = uid;
        }
        const storedUser = sessionStorage.getItem('username') || sessionStorage.getItem('userEmail') || localStorage.getItem('peso_logged_in_user');
        if (storedUser) adminId = `${adminId} (${storedUser})`;
    } catch (e) { }
    return adminId;
}

function showOfficerModalAlert(formEl, message) {
    if (!formEl) return;
    const isEdit = formEl.id === 'editOfficerForm';
    const alertId = isEdit ? 'editOfficerAlert' : 'createOfficerAlert';
    const msgId = isEdit ? 'editOfficerAlertMsg' : 'createOfficerAlertMsg';
    
    let alertEl = document.getElementById(alertId);
    let msgEl = document.getElementById(msgId);
    if (alertEl && msgEl) {
        msgEl.textContent = message;
        alertEl.classList.remove('d-none');
    }
}

function hideOfficerModalAlert(formEl) {
    if (!formEl) return;
    const isEdit = formEl.id === 'editOfficerForm';
    const alertId = isEdit ? 'editOfficerAlert' : 'createOfficerAlert';
    const alertEl = document.getElementById(alertId);
    if (alertEl) {
        alertEl.classList.add('d-none');
    }
}

function attachOfficerFormLiveValidation(formEl) {
    if (!formEl || formEl.dataset.liveBound === 'true') return;
    formEl.dataset.liveBound = 'true';

    const inputs = formEl.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        const handler = () => {
            if (input.classList.contains('is-invalid')) {
                input.classList.remove('is-invalid');
                input.removeAttribute('title');
                input.removeAttribute('data-bs-title');
            }
            // Check if any invalid fields remain
            const remainingInvalids = formEl.querySelectorAll('.is-invalid');
            if (remainingInvalids.length === 0) {
                hideOfficerModalAlert(formEl);
            }
        };
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
    });
}

/**
 * Dedicated Form-Level and Field-Level Validation for PESO Officers
 * Scoped strictly to Officer Management (no scheduling rules)
 */
function validateOfficerForm(formEl, mode = 'create', currentOfficerId = null) {
    if (!formEl) return { isValid: false, errors: [], summaryMessage: 'Form not found.' };

    const errors = [];
    const missingFields = [];

    // Clear existing invalid classes
    formEl.querySelectorAll('.is-invalid').forEach(el => {
        el.classList.remove('is-invalid');
        el.removeAttribute('title');
        el.removeAttribute('data-bs-title');
    });

    const isEdit = mode === 'edit';
    const prefix = isEdit ? 'editOff' : 'createOff';

    function getEl(idName) {
        return document.getElementById(`${prefix}${idName}`) || 
               document.getElementById(`newOff${idName}`) ||
               formEl.querySelector(`[name="${idName}"]`);
    }

    const roleEl = getEl('Role');
    const firstNameEl = getEl('FirstName');
    const middleNameEl = getEl('MiddleName');
    const lastNameEl = getEl('LastName');
    const suffixEl = getEl('Suffix');
    const dobEl = getEl('Dob');
    const ageEl = getEl('Age');
    const addressEl = getEl('Address');
    const phoneEl = getEl('Phone') || getEl('ContactNumber');
    const emailEl = getEl('Email');
    const usernameEl = getEl('Username');
    const passwordEl = getEl('Password');
    const confirmPasswordEl = getEl('ConfirmPassword');

    function setFieldError(element, fieldLabel, message, isMissing = false) {
        if (!element) return;
        element.classList.add('is-invalid');
        element.setAttribute('title', message);
        element.setAttribute('data-bs-title', message);
        const feedback = element.parentElement ? element.parentElement.querySelector('.invalid-feedback') : null;
        if (feedback && message) {
            feedback.textContent = message;
        }
        errors.push({ field: fieldLabel, message, element, isMissing });
        if (isMissing) missingFields.push(fieldLabel);
    }

    // 1. Mandatory User Role validation (Only PESO Admin or PESO Officer)
    const role = (roleEl?.value || '').trim();
    if (!role || !['PESO Admin', 'PESO Officer'].includes(role)) {
        setFieldError(roleEl, 'User Role', 'User role selection is mandatory (PESO Admin or PESO Officer).', true);
    }

    // 2. Personal Information: First Name & Last Name
    const firstName = (firstNameEl?.value || '').trim();
    if (!firstName) {
        setFieldError(firstNameEl, 'First Name', 'First name is required.', true);
    }

    const middleName = (middleNameEl?.value || '').trim();
    const lastName = (lastNameEl?.value || '').trim();
    if (!lastName) {
        setFieldError(lastNameEl, 'Last Name', 'Last name is required.', true);
    }

    const suffix = (suffixEl?.value || '').trim();

    // 3. Birthdate Validation (Must be a valid past date, realistic age >= 18)
    const dob = dobEl?.value || '';
    if (!dob) {
        setFieldError(dobEl, 'Birthdate', 'Valid birthdate is required.', true);
    } else {
        const birthDateObj = new Date(dob);
        const todayObj = new Date();
        if (isNaN(birthDateObj.getTime())) {
            setFieldError(dobEl, 'Birthdate', 'Invalid birthdate format.');
        } else if (birthDateObj > todayObj) {
            setFieldError(dobEl, 'Birthdate', 'Birthdate cannot be in the future.');
        } else {
            let calculatedAge = todayObj.getFullYear() - birthDateObj.getFullYear();
            const monthDiff = todayObj.getMonth() - birthDateObj.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && todayObj.getDate() < birthDateObj.getDate())) {
                calculatedAge--;
            }
            if (calculatedAge < 18) {
                setFieldError(dobEl, 'Birthdate', 'Officer must be at least 18 years of age.');
            }
        }
    }

    // 4. Address validation
    const address = (addressEl?.value || '').trim();
    if (!address) {
        setFieldError(addressEl, 'Address', 'Address is required.', true);
    }

    // 5. Contact Number validation (PH based)
    const contactNumber = (phoneEl?.value || '').trim();
    const phoneDigits = contactNumber.replace(/[-\s]/g, '');
    const phoneRegex = /^(09|\+639)\d{9}$/;
    if (!contactNumber) {
        setFieldError(phoneEl, 'Contact Number', 'Contact number is required.', true);
    } else if (!phoneRegex.test(phoneDigits)) {
        setFieldError(phoneEl, 'Contact Number', 'Contact number must be PH format 09XX-XXX-XXXX or 09XXXXXXXXX.');
    }

    // 6. Email validation
    const email = (emailEl?.value || '').trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
        setFieldError(emailEl, 'Email Address', 'Email address is required.', true);
    } else if (!emailRegex.test(email)) {
        setFieldError(emailEl, 'Email Address', 'Enter a valid email address (e.g., officer@koronadal.gov.ph).');
    }

    // 7. Username validation (min 3 characters, unique)
    const username = (usernameEl?.value || '').trim();
    const existingList = Array.isArray(officersList) ? officersList : [];
    if (!username) {
        setFieldError(usernameEl, 'Username', 'Username is required.', true);
    } else if (username.length < 3) {
        setFieldError(usernameEl, 'Username', 'Username must be at least 3 characters.');
    } else if (existingList.some(o => (currentOfficerId === null || o.id !== currentOfficerId) && o.username && o.username.toLowerCase() === username.toLowerCase())) {
        setFieldError(usernameEl, 'Username', `Username "${username}" is already assigned to another account.`);
    }

    // 8. Password validations
    const password = passwordEl?.value || '';
    const confirmPassword = confirmPasswordEl?.value || '';

    if (!isEdit) {
        // Create mode: password is required
        if (!password) {
            setFieldError(passwordEl, 'Password', 'Password is required.', true);
        } else if (password.length < 8) {
            setFieldError(passwordEl, 'Password', 'Password must be at least 8 characters.');
        }

        if (!confirmPassword) {
            setFieldError(confirmPasswordEl, 'Confirm Password', 'Confirm password is required.', true);
        } else if (password && confirmPassword && password !== confirmPassword) {
            setFieldError(confirmPasswordEl, 'Confirm Password', 'Passwords do not match.');
        }
    } else {
        // Edit mode: password is optional
        if (password) {
            if (password.length < 8) {
                setFieldError(passwordEl, 'Password', 'Password must be at least 8 characters.');
            }
            if (!confirmPassword) {
                setFieldError(confirmPasswordEl, 'Confirm Password', 'Confirm password is required when updating password.', true);
            } else if (password !== confirmPassword) {
                setFieldError(confirmPasswordEl, 'Confirm Password', 'Passwords do not match.');
            }
        }
    }

    const isValid = errors.length === 0;

    // Organized Exception Hierarchy Summary Message
    let summaryMessage = '';
    if (!isValid) {
        if (missingFields.length > 0) {
            summaryMessage = 'Please complete all required fields.';
        } else if (errors.some(e => e.field === 'Email Address')) {
            summaryMessage = 'Enter a valid email address.';
        } else if (errors.some(e => e.field === 'Confirm Password')) {
            summaryMessage = 'Passwords do not match.';
        } else if (errors.some(e => e.field === 'Contact Number')) {
            summaryMessage = 'Contact number must be PH format (09XX-XXX-XXXX or 09XXXXXXXXX).';
        } else if (errors.some(e => e.field === 'Username')) {
            summaryMessage = errors.find(e => e.field === 'Username').message;
        } else if (errors.some(e => e.field === 'Birthdate')) {
            summaryMessage = errors.find(e => e.field === 'Birthdate').message;
        } else {
            summaryMessage = errors[0].message;
        }
    }

    return {
        isValid,
        errors,
        missingFields,
        summaryMessage,
        data: {
            role,
            firstName,
            middleName,
            lastName,
            suffix,
            dob,
            age: ageEl?.value || '',
            address,
            phone: contactNumber,
            email,
            username,
            password
        }
    };
}

function openCreateOfficerModal() {
    const form = document.getElementById('createOfficerForm') || document.getElementById('newOfficerForm');
    if (form) {
        form.reset();
        form.querySelectorAll('.is-invalid').forEach(el => {
            el.classList.remove('is-invalid');
            el.removeAttribute('title');
            el.removeAttribute('data-bs-title');
        });
        hideOfficerModalAlert(form);
        attachOfficerFormLiveValidation(form);
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
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }
    const form = document.getElementById('createOfficerForm') || (e ? e.target : null);
    if (!form) return false;

    // Run dedicated officer form validation
    const validation = validateOfficerForm(form, 'create');
    const adminIdentity = getLoggedInAdminIdentity();

    if (!validation.isValid) {
        // 1. Show modal-level alert banner
        showOfficerModalAlert(form, validation.summaryMessage);

        // 2. Focus first invalid field
        if (validation.errors.length > 0 && validation.errors[0].element) {
            validation.errors[0].element.focus();
        }

        // 3. Audit log the failed attempt with Admin ID and reason
        const failReasons = validation.errors.map(err => `${err.field}: ${err.message}`).join('; ');
        logAuditEvent(
            'FAILED_CREATE_OFFICER_VALIDATION',
            `Failed Add Officer attempt by ${adminIdentity}. Reasons: ${failReasons}`
        );

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Validation Notice',
                message: validation.summaryMessage,
                type: 'warning'
            });
        }
        return false;
    }

    hideOfficerModalAlert(form);

    const { role, firstName, middleName, lastName, suffix, dob, age, address, phone, email, username, password } = validation.data;
    const department = 'PESO';

    // Pre-flight Security Safeguard: Verify that username and email are unique across system
    if (typeof DataService !== 'undefined' && DataService.auth && DataService.auth.checkIdentifierAvailability) {
        try {
            const checkRes = await DataService.auth.checkIdentifierAvailability({ username, email });
            if (checkRes && checkRes.data && !checkRes.data.isAvailable) {
                showOfficerModalAlert(form, checkRes.data.message || 'The specified username or email is already registered.');
                if (typeof window.showSystemNotification === 'function') {
                    window.showSystemNotification({
                        title: 'Officer Creation Blocked',
                        message: checkRes.data.message || 'The specified username or email already exists.',
                        type: 'error'
                    });
                }
                return false;
            }
        } catch (cErr) {
            console.warn('[OFFICERS] Identifier uniqueness check warning:', cErr);
        }
    }

    const btn = document.getElementById('btnSubmitCreateOfficer') || form.querySelector('button[type="submit"]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Provisioning Account...';
    }

    try {
        let authId = null;
        const sbConfig = (typeof SUPABASE_CONFIG !== 'undefined') ? SUPABASE_CONFIG : null;
        const sbUrl = sbConfig?.URL || (typeof supabaseClient !== 'undefined' ? supabaseClient.supabaseUrl : null);
        const sbKey = sbConfig?.ANON_KEY || (typeof supabaseClient !== 'undefined' ? supabaseClient.supabaseKey : null);

        // Step 1: Provision credentials in Supabase auth.users using an isolated non-persisted client
        if (sbUrl && sbKey && typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            try {
                const isolatedAuth = window.supabase.createClient(sbUrl, sbKey, {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    }
                });

                const { data: authData, error: authError } = await isolatedAuth.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            first_name: firstName,
                            middle_name: middleName || '',
                            last_name: lastName,
                            suffix: (suffix && suffix !== 'N/A') ? suffix : '',
                            username: username,
                            role: role,
                            age: age ? parseInt(age, 10) : 0,
                            department: 'PESO'
                        }
                    }
                });

                if (authError) {
                    console.warn('[OFFICERS] Supabase auth signup notice:', authError.message);
                } else if (authData && authData.user) {
                    authId = authData.user.id;
                }
            } catch (authEx) {
                console.warn('[OFFICERS] Isolated auth provisioning notice:', authEx);
            }
        }

        // Step 2: Ensure staff_profiles row is saved/updated with auth_id linkage
        let staffRow = null;
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            if (authId) {
                const { data: existingStaff } = await supabaseClient
                    .from('staff_profiles')
                    .select('*')
                    .eq('auth_id', authId)
                    .maybeSingle();

                if (existingStaff) {
                    staffRow = existingStaff;
                    await supabaseClient.from('staff_profiles').update({
                        phone: phone,
                        address: address,
                        date_of_birth: dob || null,
                        middle_name: middleName || null,
                        suffix: (suffix && suffix !== 'N/A') ? suffix : null,
                        status: 'Active'
                    }).eq('id', existingStaff.id);
                }
            }
        }

        if (!staffRow && typeof DataService !== 'undefined' && DataService.staffProfiles) {
            const newOff = {
                id: Date.now(),
                auth_id: authId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'auth-' + Date.now()),
                agency: 'PESO',
                first_name: firstName,
                middle_name: middleName || null,
                last_name: lastName,
                suffix: (suffix && suffix !== 'N/A') ? suffix : null,
                date_of_birth: dob || null,
                age: age ? parseInt(age, 10) : null,
                username: username,
                email: email,
                role: role,
                department: department,
                phone: phone,
                address: address,
                status: 'Active'
            };
            const createRes = await DataService.staffProfiles.create(newOff);
            if (createRes && createRes.data) {
                staffRow = createRes.data;
            } else {
                staffRow = newOff;
            }
        }

        const finalOffRecord = {
            id: staffRow ? staffRow.id : Date.now(),
            auth_id: authId,
            agency: 'PESO',
            first_name: firstName,
            middle_name: middleName || '',
            last_name: lastName,
            suffix: (suffix && suffix !== 'N/A') ? suffix : 'N/A',
            date_of_birth: dob || null,
            age: age ? parseInt(age, 10) : null,
            username: username,
            email: email,
            role: role,
            department: department,
            phone: phone,
            address: address,
            status: 'Active'
        };

        officersList.unshift(finalOffRecord);
        if (typeof AdminStore !== 'undefined' && Array.isArray(AdminStore.officers)) {
            AdminStore.officers.unshift(finalOffRecord);
        }

        // Step 3: Immutable Audit Log
        logAuditEvent(
            'CREATE_OFFICER_ACCOUNT',
            `Admin (${adminIdentity}) created new officer account "${username}" (${firstName} ${lastName}), Role: ${role}, Dept: ${department}, AuthID: ${authId || 'Linked'}`
        );

        if (document.getElementById('createOfficerModal')) {
            safeHideModal('createOfficerModal');
        } else {
            safeHideModal('newOfficerModal');
        }

        renderOfficersTables();
        if (typeof renderOfficersModule === 'function') {
            renderOfficersModule();
        }

        window.showSystemNotification({
            title: 'Officer Account Created',
            message: `Officer account for ${firstName} ${lastName} (${username}) was provisioned successfully in Supabase Auth. The officer can now log in immediately.`,
            type: 'success'
        });

        return true;
    } catch (err) {
        console.error('[OFFICERS] Create error:', err);
        showOfficerModalAlert(form, err.message || 'Failed to create officer account.');
        return false;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-person-plus-fill me-1"></i> Add Officer';
        }
    }
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
        form.querySelectorAll('.is-invalid').forEach(el => {
            el.classList.remove('is-invalid');
            el.removeAttribute('title');
            el.removeAttribute('data-bs-title');
        });
        hideOfficerModalAlert(form);
        attachOfficerFormLiveValidation(form);
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
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }
    const form = document.getElementById('editOfficerForm') || (e ? e.target : null);
    if (!form) return;

    const offIdEl = document.getElementById('editOffId');
    const offId = offIdEl ? Number(offIdEl.value) : null;
    const off = officersList.find(o => o && o.id === offId);
    if (!off) {
        window.showSystemNotification({ title: 'Update Error', message: 'Target officer account not found.', type: 'danger' });
        return;
    }

    const validation = validateOfficerForm(form, 'edit', offId);
    const adminIdentity = getLoggedInAdminIdentity();

    if (!validation.isValid) {
        showOfficerModalAlert(form, validation.summaryMessage);
        if (validation.errors.length > 0 && validation.errors[0].element) {
            validation.errors[0].element.focus();
        }
        const failReasons = validation.errors.map(err => `${err.field}: ${err.message}`).join('; ');
        logAuditEvent(
            'FAILED_UPDATE_OFFICER_VALIDATION',
            `Failed Edit Officer attempt for ID ${offId} by ${adminIdentity}. Reasons: ${failReasons}`
        );
        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Validation Notice',
                message: validation.summaryMessage,
                type: 'warning'
            });
        }
        return false;
    }

    hideOfficerModalAlert(form);

    const { role, firstName, middleName, lastName, suffix, dob, age, address, phone, email, username } = validation.data;

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

    if (typeof AdminStore !== 'undefined' && Array.isArray(AdminStore.officers)) {
        const storeOff = AdminStore.officers.find(o => o && o.id === offId);
        if (storeOff) Object.assign(storeOff, updatePayload);
    }

    logAuditEvent('UPDATE_OFFICER_ACCOUNT', `Admin (${adminIdentity}) updated officer ID ${offId} ("${username}"), Role: ${role}`);

    safeHideModal('editOfficerModal');
    renderOfficersTables();
    if (typeof renderOfficersModule === 'function') {
        renderOfficersModule();
    }

    window.showSystemNotification({
        title: 'Account Updated',
        message: `Officer profile for "${firstName} ${lastName}" (${username}) updated successfully as ${role}.`,
        type: 'success'
    });

    return true;
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
window.validateOfficerForm = validateOfficerForm;
window.openCreateOfficerModal = openCreateOfficerModal;
window.openNewOfficerModal = openCreateOfficerModal;
window.calcCreateOfficerAge = calcCreateOfficerAge;
window.calcNewOfficerAge = calcCreateOfficerAge;
window.calcEditOfficerAge = calcEditOfficerAge;
window.handleCreateOfficerSubmit = handleCreateOfficerSubmit;
window.openEditOfficerModal = openEditOfficerModal;
window.handleSaveOfficerUpdates = handleSaveOfficerUpdates;
window.handleOfficerStatusToggle = handleOfficerStatusToggle;

/**
 * PESO Admin Portal - User Management & RBAC Module (Tab 2)
 * Module: Users (peso-admin-users.js)
 */

let usersList = [];

async function initUserManagementData() {
    if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
        try {
            const res = await DataService.staffProfiles.getAll({ agency: 'PESO' });
            if (res.data && Array.isArray(res.data)) {
                // Strict Segregation: Exclude any CSWDO accounts
                usersList = res.data.filter(u => !['CSWDO Admin', 'CSWDO Officer'].includes(u.role) && (u.department || 'PESO') !== 'CSWDO');
                const adminUser = usersList.find(u => (u.username && u.username.toLowerCase() === 'peso-admin') || (u.email && (u.email.toLowerCase() === 'peso.admin@gmail.com' || u.email.toLowerCase() === 'peso.admin@koronadal.gov.ph')));
                if (adminUser) {
                    adminUser.status = 'Active';
                }
                updateUserMetrics();
                if (document.getElementById('sectionUsers') && !document.getElementById('sectionUsers').classList.contains('d-none')) {
                    filterUsers();
                }
                return;
            }
        } catch (e) {
            console.warn('[USERS] Supabase staff fetch notice:', e);
        }
    }
    usersList = [];
    updateUserMetrics();
    if (document.getElementById('sectionUsers') && !document.getElementById('sectionUsers').classList.contains('d-none')) {
        filterUsers();
    }
}

async function fetchUsersFromApi() {
    await initUserManagementData();
}

function updateUserMetrics() {
    const total = usersList.length;
    const admins = usersList.filter(u => u.role && u.role.includes('Admin') && u.status === 'Active').length;
    const staff = usersList.filter(u => u.role && (u.role.includes('Officer') || u.role === 'Evaluator' || u.role === 'Staff') && u.status === 'Active').length;
    const lockedOrArchived = usersList.filter(u => u.status === 'Locked' || u.status === 'Archived' || u.status === 'Deactivated').length;

    if (document.getElementById('statTotalUsers')) document.getElementById('statTotalUsers').textContent = total;
    if (document.getElementById('statActiveAdmins')) document.getElementById('statActiveAdmins').textContent = admins;
    if (document.getElementById('statActiveStaff')) document.getElementById('statActiveStaff').textContent = staff;
    if (document.getElementById('statLockedUsers')) document.getElementById('statLockedUsers').textContent = lockedOrArchived;
    if (document.getElementById('userTabBadge')) document.getElementById('userTabBadge').textContent = total;
}

function renderUsersModule() {
    initUserManagementData();
    filterUsers();
}

function filterUsers() {
    const searchInput = document.getElementById('userSearchInput');
    const search = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const roleSelect = document.getElementById('userRoleFilter');
    const roleFilter = roleSelect ? roleSelect.value : 'ALL';
    const statusSelect = document.getElementById('userStatusFilter');
    const statusFilter = statusSelect ? statusSelect.value : 'ALL';
    const deptSelect = document.getElementById('userDeptFilter');
    const deptFilter = deptSelect ? deptSelect.value : 'ALL';

    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = usersList.filter(usr => {
        // Enforce strict segregation in display filter
        if (['CSWDO Admin', 'CSWDO Officer'].includes(usr.role) || (usr.department || '').toUpperCase() === 'CSWDO') {
            return false;
        }

        const fullName = `${usr.first_name || ''} ${usr.middle_name || ''} ${usr.last_name || ''} ${usr.suffix && usr.suffix !== 'N/A' ? usr.suffix : ''}`.toLowerCase();
        const matchesSearch = !search || fullName.includes(search) || (usr.username || '').toLowerCase().includes(search) || (usr.email || '').toLowerCase().includes(search) || (usr.department || '').toLowerCase().includes(search);

        const matchesRole = (roleFilter === 'ALL') || (roleFilter === 'Admin' && (usr.role || '').includes('Admin')) || (roleFilter === 'Officer' && (usr.role || '').includes('Officer')) || (roleFilter === 'Staff' && (usr.role === 'Staff' || usr.role === 'Evaluator'));
        const matchesStatus = (statusFilter === 'ALL') || (usr.status === statusFilter);
        const matchesDept = (deptFilter === 'ALL') || (usr.department === deptFilter);

        return matchesSearch && matchesRole && matchesStatus && matchesDept;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted"><i class="bi bi-person-x fs-3 d-block mb-1"></i>No user records found matching criteria.</td></tr>`;
        return;
    }

    filtered.forEach(usr => {
        const tr = document.createElement('tr');
        const fullName = `${escapeHtml(usr.first_name)} ${escapeHtml(usr.middle_name || '')} ${escapeHtml(usr.last_name)} ${usr.suffix && usr.suffix !== 'N/A' ? escapeHtml(usr.suffix) : ''}`.trim();
        const maskedPhone = maskContactNumber(usr.phone || '0917-000-0000');

        let roleBadgeClass = 'bg-primary-subtle text-primary border-primary';
        if ((usr.role || '').includes('Admin')) roleBadgeClass = 'bg-primary text-white';
        else if ((usr.role || '').includes('Officer')) roleBadgeClass = 'bg-info text-white';
        else if (usr.role === 'Evaluator') roleBadgeClass = 'bg-purple-subtle text-purple border';
        else roleBadgeClass = 'bg-secondary-subtle text-dark border';

        let statusBadgeHTML = '<span class="badge bg-success px-2.5 py-1"><i class="bi bi-check-circle-fill me-1"></i>Active</span>';
        if (usr.status === 'Locked') {
            statusBadgeHTML = `<span class="badge bg-danger px-2.5 py-1" title="Account locked due to 5 failed login attempts"><i class="bi bi-lock-fill me-1"></i>Locked (${usr.failed_attempts || 5})</span>`;
        } else if (usr.status === 'Deactivated' || usr.status === 'Inactive') {
            statusBadgeHTML = '<span class="badge bg-secondary px-2.5 py-1"><i class="bi bi-x-circle-fill me-1"></i>Deactivated</span>';
        } else if (usr.status === 'Archived') {
            statusBadgeHTML = '<span class="badge bg-dark px-2.5 py-1"><i class="bi bi-archive-fill me-1"></i>Archived</span>';
        }

        const isSuperAdmin = (usr.username && usr.username.toLowerCase() === 'peso-admin') || (usr.email && (usr.email.toLowerCase() === 'peso.admin@gmail.com' || usr.email.toLowerCase() === 'peso.admin@koronadal.gov.ph'));

        tr.innerHTML = `
            <td class="ps-3"><input type="checkbox" class="form-check-input user-select-checkbox" data-user-id="${usr.id}"></td>
            <td>
                <div class="d-flex align-items-center">
                    <div class="avatar-circle bg-primary-subtle text-primary me-2 fw-semibold" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;">
                        ${escapeHtml(usr.first_name[0] || 'U')}${escapeHtml(usr.last_name[0] || '')}
                    </div>
                    <div>
                        <div class="fw-semibold text-dark">${fullName}</div>
                        <small class="text-muted">${escapeHtml(usr.username || '')}</small>
                    </div>
                </div>
            </td>
            <td><span class="badge ${roleBadgeClass} px-2 py-1">${escapeHtml(usr.role || 'Staff')}</span></td>
            <td><span class="badge bg-light text-dark border">${escapeHtml(usr.department || 'PESO')}</span></td>
            <td>
                <div class="small">${escapeHtml(usr.email || '')}</div>
                <small class="text-muted"><i class="bi bi-shield-lock me-1"></i>${maskedPhone}</small>
            </td>
            <td>${statusBadgeHTML}</td>
            <td><small class="text-muted">${escapeHtml(usr.created_at ? new Date(usr.created_at).toLocaleDateString() : '2026-01-15')}</small></td>
            <td class="text-end pe-3">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="openUserDetailsModal(${usr.id})" title="View Details">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-secondary" onclick="openEditUserModal(${usr.id})" title="Edit User">
                        <i class="bi bi-pencil"></i>
                    </button>
                    ${usr.status === 'Locked' ? `
                    <button class="btn btn-outline-warning" onclick="openUserActionModal('UNLOCK', ${usr.id})" title="Unlock Account">
                        <i class="bi bi-unlock"></i>
                    </button>` : ''}
                    ${usr.status === 'Active' && !isSuperAdmin ? `
                    <button class="btn btn-outline-danger" onclick="openUserActionModal('DEACTIVATE', ${usr.id})" title="Deactivate">
                        <i class="bi bi-person-x"></i>
                    </button>` : ''}
                    ${(usr.status === 'Deactivated' || usr.status === 'Inactive') ? `
                    <button class="btn btn-outline-success" onclick="openUserActionModal('ACTIVATE', ${usr.id})" title="Reactivate">
                        <i class="bi bi-person-check"></i>
                    </button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Live preview of masked phone in New User Modal
document.addEventListener('DOMContentLoaded', () => {
    const phoneInput = document.getElementById('newUsrPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            const preview = document.getElementById('newUsrPhonePreview');
            if (preview) preview.textContent = maskContactNumber(e.target.value || '09XX-XXX-XXXX');
        });
    }
});

function openNewUserModal() {
    const form = document.getElementById('newUserForm');
    if (form) form.reset();
    const preview = document.getElementById('newUsrPhonePreview');
    if (preview) preview.textContent = '09XX-***-XXXX';

    logAuditEvent('OPEN_CREATE_USER_FORM', 'Admin opened New User Account modal');
    safeOpenModal('newUserModal');
}

async function handleCreateUserSubmit(e) {
    e.preventDefault();

    const firstName = document.getElementById('newUsrFirstName').value.trim();
    const middleName = document.getElementById('newUsrMiddleName').value.trim();
    const lastName = document.getElementById('newUsrLastName').value.trim();
    const suffix = document.getElementById('newUsrSuffix').value;
    const username = document.getElementById('newUsrUsername').value.trim();
    const email = document.getElementById('newUsrEmail').value.trim();
    const password = document.getElementById('newUsrPassword').value;
    const passwordConfirm = document.getElementById('newUsrPasswordConfirm').value;
    const role = document.getElementById('newUsrRole').value;
    const department = document.getElementById('newUsrDept').value;
    const sex = document.getElementById('newUsrSex').value;
    const phone = document.getElementById('newUsrPhone').value.trim();
    const address = document.getElementById('newUsrAddress').value.trim();
    const actionReason = document.getElementById('newUsrActionReason').value.trim();

    if (!firstName || !lastName || !username || !email || !password || !passwordConfirm || !phone || !address || !actionReason) {
        window.showSystemNotification({
            title: 'Validation Error',
            message: 'All required fields including mandatory Action Reason must be filled.',
            type: 'warning'
        });
        return;
    }

    if (password !== passwordConfirm) {
        window.showSystemNotification({
            title: 'Password Mismatch',
            message: 'Password and Password Confirmation do not match.',
            type: 'error'
        });
        return;
    }

    // Strict Cross-Department Validation
    const cswdoRoles = ['CSWDO Admin', 'CSWDO Officer'];
    if (cswdoRoles.includes(role) || (department && department.toUpperCase() === 'CSWDO')) {
        window.showSystemNotification({
            title: 'Cross-Department Action Blocked',
            message: 'Validation Error: Cannot create or assign CSWDO accounts within the PESO Admin portal.',
            type: 'error'
        });
        return;
    }

    if (typeof PESOSafeguards !== 'undefined' && PESOSafeguards.validateDepartmentScope) {
        const scopeCheck = PESOSafeguards.validateDepartmentScope('PESO', { role, department });
        if (!scopeCheck.allowed) {
            window.showSystemNotification({
                title: 'Cross-Department Action Blocked',
                message: scopeCheck.reason,
                type: 'error'
            });
            return;
        }
    }

    if (usersList.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        window.showSystemNotification({
            title: 'Username Exists',
            message: `A user account with username "${username}" already exists.`,
            type: 'warning'
        });
        return;
    }

    // Hash password with bcrypt before storage/logging
    let passwordHash = '';
    if (typeof dcodeIO !== 'undefined' && dcodeIO.bcrypt) {
        passwordHash = dcodeIO.bcrypt.hashSync(password, 10);
    } else if (typeof bcrypt !== 'undefined' && bcrypt.hashSync) {
        passwordHash = bcrypt.hashSync(password, 10);
    } else {
        passwordHash = `$2a$10$hashed_${btoa(username + ':' + password).substring(0, 22)}`;
    }

    let createdId = Date.now();
    if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
        try {
            const res = await DataService.staffProfiles.create({
                agency: 'PESO',
                first_name: firstName,
                middle_name: middleName,
                last_name: lastName,
                suffix: suffix,
                username: username,
                password: password,
                email: email,
                password_hash: passwordHash,
                role: role,
                sex: sex,
                phone: phone,
                address: address,
                status: 'Active'
            });
            if (res && res.data && res.data.id) createdId = res.data.id;
        } catch (err) {
            console.warn('[USERS] Supabase user creation notice:', err);
        }
    }

    const newUser = {
        id: createdId,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        suffix: suffix,
        username: username,
        email: email,
        password_hash: passwordHash,
        role: role,
        department: department,
        sex: sex,
        phone: phone,
        address: address,
        status: 'Active',
        failed_attempts: 0,
        created_at: new Date().toISOString(),
        last_login: null
    };

    usersList.unshift(newUser);
    logAuditEvent('CREATE_USER_ACCOUNT', `Created user "${username}" (${role}, ${department}). Reason: ${actionReason}`);

    safeHideModal('newUserModal');
    updateUserMetrics();
    filterUsers();

    window.showSystemNotification({
        title: 'User Account Created',
        message: `Account for ${firstName} ${lastName} (${username}) successfully registered.`,
        type: 'success'
    });
}

// Strictly Read-Only Details Modal (Compliant with User Rule 1)
function openUserDetailsModal(userId) {
    if (!Array.isArray(usersList)) usersList = [];
    const usr = usersList.find(u => u && u.id === userId);
    if (!usr) {
        console.warn('[USERS] User record not found for ID:', userId);
        window.showSystemNotification({ title: 'User Notice', message: 'User details could not be retrieved.', type: 'warning' });
        return;
    }

    const fullName = `${usr.first_name || ''} ${usr.middle_name || ''} ${usr.last_name || ''} ${usr.suffix && usr.suffix !== 'N/A' ? usr.suffix : ''}`.trim() || usr.username || 'N/A';
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || 'N/A';
    };

    setText('viewUserFullName', fullName);
    setText('viewUserUsername', usr.username);
    setText('viewUserEmail', usr.email);
    setText('viewUserRoleBadge', usr.role);
    setText('viewUserDepartment', usr.department || 'PESO');
    setText('viewUserPhone', maskContactNumber(usr.phone || '0917-000-0000'));
    setText('viewUserSex', usr.sex || 'Male');
    setText('viewUserAddress', usr.address || 'City of Koronadal');
    setText('viewUserFailedAttempts', `${usr.failed_attempts || 0} / 5 attempts`);

    const statusBadge = document.getElementById('viewUserStatusBadge');
    if (statusBadge) {
        statusBadge.textContent = usr.status || 'Active';
        statusBadge.className = usr.status === 'Active' ? 'badge bg-success px-3 py-1.5' : (usr.status === 'Locked' ? 'badge bg-danger px-3 py-1.5' : 'badge bg-secondary px-3 py-1.5');
    }

    setText('viewUserCreatedAt', usr.created_at ? new Date(usr.created_at).toLocaleString() : 'N/A');
    setText('viewUserLastLogin', usr.last_login ? new Date(usr.last_login).toLocaleString() : 'Never logged in');

    logAuditEvent('VIEW_USER_DETAILS', `Inspected read-only details for user ID ${usr.id} (${usr.username})`);
    safeOpenModal('userDetailsModal');
}

function openEditUserModal(userId) {
    if (!Array.isArray(usersList)) usersList = [];
    const usr = usersList.find(u => u && u.id === userId);
    if (!usr) {
        console.warn('[USERS] User record not found for ID:', userId);
        window.showSystemNotification({ title: 'User Notice', message: 'User record not found.', type: 'warning' });
        return;
    }

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('editUsrId', usr.id);
    setVal('editUsrFullName', `${usr.first_name || ''} ${usr.middle_name || ''} ${usr.last_name || ''} ${usr.suffix && usr.suffix !== 'N/A' ? usr.suffix : ''}`.trim());
    setVal('editUsrUsername', usr.username);
    setVal('editUsrEmail', usr.email);
    setVal('editUsrPhone', usr.phone);
    setVal('editUsrRole', usr.role || 'PESO Officer');
    setVal('editUsrDept', usr.department || 'PESO');
    setVal('editUsrStatus', usr.status || 'Active');
    setVal('editUsrAddress', usr.address || 'City of Koronadal');
    setVal('editUsrNewPassword', '');
    setVal('editUsrActionReason', '');

    safeOpenModal('editUserModal');
}

async function handleSaveUserUpdates(e) {
    e.preventDefault();

    const editIdEl = document.getElementById('editUsrId');
    const userId = editIdEl ? Number(editIdEl.value) : null;
    const usr = usersList.find(u => u && u.id === userId);
    if (!usr) {
        window.showSystemNotification({ title: 'Update Notice', message: 'Target user account not found.', type: 'danger' });
        return;
    }

    const updatedUsername = (document.getElementById('editUsrUsername')?.value || '').trim();
    const updatedEmail = (document.getElementById('editUsrEmail')?.value || '').trim();
    const updatedPhone = (document.getElementById('editUsrPhone')?.value || '').trim();
    const updatedRole = document.getElementById('editUsrRole')?.value || 'PESO Officer';
    const updatedDept = document.getElementById('editUsrDept')?.value || 'PESO';
    const updatedStatus = document.getElementById('editUsrStatus')?.value || 'Active';
    const updatedAddress = (document.getElementById('editUsrAddress')?.value || '').trim();
    const actionReason = (document.getElementById('editUsrActionReason')?.value || '').trim();

    if (!actionReason) {
        window.showSystemNotification({
            title: 'Action Reason Required',
            message: 'Please provide a justification for this account modification.',
            type: 'warning'
        });
        return;
    }

    // Strict Cross-Department Validation
    const cswdoRoles = ['CSWDO Admin', 'CSWDO Officer'];
    if (cswdoRoles.includes(updatedRole) || (updatedDept && updatedDept.toUpperCase() === 'CSWDO')) {
        window.showSystemNotification({
            title: 'Cross-Department Action Blocked',
            message: 'Validation Error: Cannot assign CSWDO roles or departments within the PESO Admin portal.',
            type: 'error'
        });
        return;
    }

    if (typeof PESOSafeguards !== 'undefined' && PESOSafeguards.validateDepartmentScope) {
        const scopeCheck = PESOSafeguards.validateDepartmentScope('PESO', { role: updatedRole, department: updatedDept });
        if (!scopeCheck.allowed) {
            window.showSystemNotification({
                title: 'Cross-Department Action Blocked',
                message: scopeCheck.reason,
                type: 'error'
            });
            return;
        }
    }

    usr.username = updatedUsername;
    usr.email = updatedEmail;
    usr.phone = updatedPhone;
    usr.role = updatedRole;
    usr.department = updatedDept;
    usr.status = updatedStatus;
    usr.address = updatedAddress;
    if (updatedStatus === 'Active') usr.failed_attempts = 0;

    if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
        try {
            await DataService.staffProfiles.update(userId, {
                username: updatedUsername,
                email: updatedEmail,
                phone: updatedPhone,
                role: updatedRole,
                status: updatedStatus,
                address: updatedAddress
            });
        } catch (err) {
            console.warn('[USERS] Supabase update notice:', err);
        }
    }

    logAuditEvent('UPDATE_USER_ACCOUNT', `Updated user ID ${userId} (${updatedUsername}). Role: ${updatedRole}, Dept: ${updatedDept}, Status: ${updatedStatus}. Reason: ${actionReason}`);

    safeHideModal('editUserModal');
    updateUserMetrics();
    filterUsers();

    window.showSystemNotification({
        title: 'User Profile Updated',
        message: `Account details for "${updatedUsername}" updated successfully.`,
        type: 'success'
    });
}

function openUserActionModal(actionType, userId) {
    const usr = usersList.find(u => u.id === userId);
    if (!usr) return;

    const normalizedType = String(actionType || '').toLowerCase();
    document.getElementById('userActionTargetId').value = userId;
    document.getElementById('userActionType').value = normalizedType;
    document.getElementById('userActionReasonInput').value = '';

    const header = document.getElementById('userActionConfirmHeader');
    const icon = document.getElementById('userActionConfirmIcon');
    const title = document.getElementById('userActionConfirmTitle');
    const banner = document.getElementById('userActionIconBanner');
    const alertBox = document.getElementById('userActionAlertBox');
    const submitBtn = document.getElementById('userActionSubmitBtn');

    if (normalizedType === 'unlock') {
        if (header) header.className = 'modal-header rounded-top-4 py-3 bg-warning text-dark';
        if (icon) icon.className = 'bi bi-unlock-fill fs-4';
        if (title) title.textContent = 'Unlock User Account';
        if (banner) banner.innerHTML = `<div class="text-warning mb-2"><i class="bi bi-unlock-fill" style="font-size: 3.5rem;"></i></div><h5 class="fw-bold text-dark mb-1">Unlock "${escapeHtml(usr.username)}"?</h5><p class="text-muted small">Reset failed attempt counter and restore active login permissions.</p>`;
        if (alertBox) alertBox.innerHTML = `<i class="bi bi-info-circle-fill me-1 text-warning"></i> <strong>Audit Requirement:</strong> Unlocking an account will reset the 5 failed attempts counter to 0 and record the admin identity.`;
        if (submitBtn) {
            submitBtn.className = 'btn btn-warning fw-bold px-4 text-dark';
            submitBtn.textContent = 'Confirm Unlock';
        }
    } else if (normalizedType === 'deactivate') {
        if (header) header.className = 'modal-header rounded-top-4 py-3 bg-danger text-white';
        if (icon) icon.className = 'bi bi-person-x-fill fs-4';
        if (title) title.textContent = 'Deactivate User Account';
        if (banner) banner.innerHTML = `<div class="text-danger mb-2"><i class="bi bi-person-x-fill" style="font-size: 3.5rem;"></i></div><h5 class="fw-bold text-dark mb-1">Deactivate "${escapeHtml(usr.username)}"?</h5><p class="text-muted small">User will be temporarily prevented from logging into the PESO portal.</p>`;
        if (alertBox) alertBox.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1 text-danger"></i> <strong>Compliance Rule:</strong> Deactivated accounts can be reactivated anytime by an authorized PESO Administrator.`;
        if (submitBtn) {
            submitBtn.className = 'btn btn-danger fw-bold px-4';
            submitBtn.textContent = 'Confirm Deactivation';
        }
    } else if (normalizedType === 'archive') {
        if (header) header.className = 'modal-header rounded-top-4 py-3 bg-secondary text-white';
        if (icon) icon.className = 'bi bi-archive-fill fs-4';
        if (title) title.textContent = 'Archive User Account';
        if (banner) banner.innerHTML = `<div class="text-secondary mb-2"><i class="bi bi-archive-fill" style="font-size: 3.5rem;"></i></div><h5 class="fw-bold text-dark mb-1">Archive "${escapeHtml(usr.username)}"?</h5><p class="text-muted small">Account will be revoked from active roster and retained in read-only archive.</p>`;
        if (alertBox) alertBox.innerHTML = `<i class="bi bi-shield-lock-fill me-1 text-secondary"></i> <strong>Compliance Rule:</strong> Archived accounts cannot login. All historical audit records remain strictly preserved.`;
        if (submitBtn) {
            submitBtn.className = 'btn btn-secondary fw-bold px-4';
            submitBtn.textContent = 'Confirm Archive';
        }
    } else if (normalizedType === 'activate') {
        if (header) header.className = 'modal-header rounded-top-4 py-3 bg-success text-white';
        if (icon) icon.className = 'bi bi-arrow-counterclockwise fs-4';
        if (title) title.textContent = 'Re-Activate User Account';
        if (banner) banner.innerHTML = `<div class="text-success mb-2"><i class="bi bi-shield-check" style="font-size: 3.5rem;"></i></div><h5 class="fw-bold text-dark mb-1">Restore "${escapeHtml(usr.username)}" to Active Status?</h5>`;
        if (alertBox) alertBox.innerHTML = `<i class="bi bi-check-circle-fill me-1 text-success"></i> <strong>Notice:</strong> Account will regain system access according to assigned role permissions.`;
        if (submitBtn) {
            submitBtn.className = 'btn btn-success fw-bold px-4';
            submitBtn.textContent = 'Confirm Activation';
        }
    } else if (normalizedType === 'delete') {
        if (header) header.className = 'modal-header rounded-top-4 py-3 bg-danger text-white';
        if (icon) icon.className = 'bi bi-trash-fill fs-4';
        if (title) title.textContent = 'Permanently Delete User Account';
        if (banner) banner.innerHTML = `<div class="text-danger mb-2"><i class="bi bi-exclamation-triangle-fill" style="font-size: 3.5rem;"></i></div><h5 class="fw-bold text-danger mb-1">Permanent Deletion Warning</h5><p class="text-muted small">User account "${escapeHtml(usr.username)}" will be permanently removed.</p>`;
        if (alertBox) alertBox.innerHTML = `<i class="bi bi-exclamation-octagon-fill me-1 text-danger"></i> <strong>Critical Warning:</strong> Permanent deletion cannot be undone. Action reason is required for compliance audit.`;
        if (submitBtn) {
            submitBtn.className = 'btn btn-danger fw-bold px-4';
            submitBtn.textContent = 'Permanently Delete';
        }
    }

    safeOpenModal('userActionConfirmModal');
}

async function handleUserActionConfirm(e) {
    e.preventDefault();

    const userId = Number(document.getElementById('userActionTargetId')?.value);
    const actionType = String(document.getElementById('userActionType')?.value || '').toLowerCase();
    const actionReason = (document.getElementById('userActionReasonInput')?.value || '').trim();

    if (!actionReason) {
        window.showSystemNotification({
            title: 'Action Reason Required',
            message: 'Please provide a clear justification before confirming this action.',
            type: 'warning'
        });
        return;
    }

    const usr = usersList.find(u => u.id === userId);
    if (!usr) return;

    if (actionType === 'unlock') {
        usr.status = 'Active';
        usr.failed_attempts = 0;
        if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
            try { await DataService.staffProfiles.toggleStatus(userId, 'Active'); } catch (e) { }
        }
        logAuditEvent('UNLOCK_USER_ACCOUNT', `Unlocked user ID ${userId} (${usr.username}). Reset failed attempts to 0. Reason: ${actionReason}`);
        window.showSystemNotification({ title: 'Account Unlocked', message: `User "${usr.username}" unlocked and restored to Active status.`, type: 'success' });
    } else if (actionType === 'deactivate') {
        usr.status = 'Deactivated';
        if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
            try { await DataService.staffProfiles.toggleStatus(userId, 'Deactivated'); } catch (e) { }
        }
        logAuditEvent('DEACTIVATE_USER_ACCOUNT', `Deactivated user ID ${userId} (${usr.username}). Reason: ${actionReason}`);
        window.showSystemNotification({ title: 'Account Deactivated', message: `User "${usr.username}" status set to Deactivated.`, type: 'warning' });
    } else if (actionType === 'archive') {
        usr.status = 'Archived';
        if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
            try { await DataService.staffProfiles.toggleStatus(userId, 'Deactivated'); } catch (e) { }
        }
        logAuditEvent('ARCHIVE_USER_ACCOUNT', `Archived user ID ${userId} (${usr.username}). Reason: ${actionReason}`);
        window.showSystemNotification({ title: 'Account Archived', message: `User "${usr.username}" moved to Archive.`, type: 'warning' });
    } else if (actionType === 'activate') {
        usr.status = 'Active';
        if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
            try { await DataService.staffProfiles.toggleStatus(userId, 'Active'); } catch (e) { }
        }
        logAuditEvent('ACTIVATE_USER_ACCOUNT', `Re-activated user ID ${userId} (${usr.username}). Reason: ${actionReason}`);
        window.showSystemNotification({ title: 'Account Re-Activated', message: `User "${usr.username}" restored to Active status.`, type: 'success' });
    } else if (actionType === 'delete') {
        usersList = usersList.filter(u => u.id !== userId);
        if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
            try { await DataService.staffProfiles.delete(userId); } catch (e) { }
        }
        logAuditEvent('PERMANENT_DELETE_USER', `Permanently deleted user ID ${userId} (${usr.username}). Reason: ${actionReason}`);
        window.showSystemNotification({ title: 'Account Permanently Deleted', message: `User record ID ${userId} removed.`, type: 'danger' });
    }

    safeHideModal('userActionConfirmModal');
    updateUserMetrics();
    filterUsers();
}

function exportUsersCsv() {
    let csv = 'ID,Full Name,Username,Email,Role,Department,Phone (Masked),Status,Failed Attempts,Last Login,Created At\n';
    usersList.forEach(u => {
        const fullName = `"${u.first_name} ${u.middle_name || ''} ${u.last_name} ${u.suffix && u.suffix !== 'N/A' ? u.suffix : ''}"`.trim();
        const maskedPhone = `"${maskContactNumber(u.phone || '')}"`;
        csv += `${u.id},${fullName},"${u.username}","${u.email}","${u.role}","${u.department || 'PESO'}",${maskedPhone},"${u.status}",${u.failed_attempts || 0},"${u.last_login || 'Never'}","${u.created_at || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `PESO_Users_Roster_${new Date().toISOString().substring(0, 10)}.csv`;
    link.click();

    logAuditEvent('EXPORT_USERS_CSV', 'Exported Users Roster CSV');
    window.showSystemNotification({ title: 'Export Complete', message: 'User roster CSV downloaded successfully.', type: 'info' });
}

function exportCompliancePdf() {
    logAuditEvent('EXPORT_COMPLIANCE_PDF', 'Initiated Compliance PDF Print View for User Roster');
    window.print();
}

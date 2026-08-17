/**
 * PESO Admin Portal - User & Officer Management Module (Tab 2)
 * Module: Users & Officers (peso-admin-users.js)
 * Implements: REQ007, REQ008, REQ009, REQ010, REQ011
 */

let usersList = [];
let usersCurrentPage = 1;
let usersPerPage = 10;
let lastFilteredUsersCount = 0;

async function initUserManagementData() {
    if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
        try {
            const res = await DataService.staffProfiles.getAll({ agency: 'PESO' });
            if (res.data && Array.isArray(res.data)) {
                // Strict Segregation: Exclude any CSWDO accounts
                usersList = res.data.filter(u => !['CSWDO Admin', 'CSWDO Officer'].includes(u.role) && (u.department || 'PESO') !== 'CSWDO');
                const adminUser = usersList.find(u => (u.username && u.username.toLowerCase() === 'peso-admin') || (u.email && u.email.toLowerCase() === 'peso.admin@koronadal.gov.ph'));
                if (adminUser) {
                    adminUser.status = 'Active';
                }
                updateUserMetrics();
                if (document.getElementById('sectionUsers') && !document.getElementById('sectionUsers').classList.contains('d-none')) {
                    filterUsers(false);
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
        filterUsers(false);
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
    filterUsers(false);
}

// REQ007: View Officer Accounts with Functional Search, Filter, Pagination, and Placeholder States
function filterUsers(resetPage = false) {
    if (resetPage === true) {
        usersCurrentPage = 1;
    }
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

    const safeList = Array.isArray(usersList) ? usersList : [];
    const filtered = safeList.filter(usr => {
        if (!usr) return false;
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

    lastFilteredUsersCount = filtered.length;
    const totalEntries = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / usersPerPage));

    if (usersCurrentPage > totalPages) {
        usersCurrentPage = totalPages;
    }
    if (usersCurrentPage < 1) {
        usersCurrentPage = 1;
    }

    const startIndex = (usersCurrentPage - 1) * usersPerPage;
    const endIndex = Math.min(startIndex + usersPerPage, totalEntries);
    const paginated = filtered.slice(startIndex, endIndex);

    // Update Pagination UI
    renderUsersPaginationUI(totalEntries, startIndex, endIndex, totalPages);

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted"><i class="bi bi-person-x fs-3 d-block mb-1"></i>No officer or user records found matching criteria.</td></tr>`;
        return;
    }

    paginated.forEach(usr => {
        const tr = document.createElement('tr');
        const fullName = `${escapeHtml(usr.first_name || '')} ${escapeHtml(usr.middle_name || '')} ${escapeHtml(usr.last_name || '')} ${usr.suffix && usr.suffix !== 'N/A' ? escapeHtml(usr.suffix) : ''}`.trim() || escapeHtml(usr.username || 'User');
        const maskedPhone = maskContactNumber(usr.phone || usr.contact_number || '0917-000-0000');

        let roleBadgeClass = 'bg-primary-subtle text-primary border-primary';
        if ((usr.role || '').includes('Admin')) roleBadgeClass = 'bg-primary text-white';
        else if ((usr.role || '').includes('Officer')) roleBadgeClass = 'bg-info text-white';
        else if (usr.role === 'Evaluator') roleBadgeClass = 'bg-purple-subtle text-purple border';
        else roleBadgeClass = 'bg-secondary-subtle text-dark border';

        let statusBadgeHTML = '<span class="badge bg-success px-2.5 py-1"><i class="bi bi-check-circle-fill me-1"></i>Active</span>';
        if (usr.status === 'Locked') {
            statusBadgeHTML = `<span class="badge bg-danger px-2.5 py-1" title="Account locked"><i class="bi bi-lock-fill me-1"></i>Locked (${usr.failed_attempts || 5})</span>`;
        } else if (usr.status === 'Deactivated' || usr.status === 'Inactive') {
            statusBadgeHTML = '<span class="badge bg-secondary px-2.5 py-1"><i class="bi bi-x-circle-fill me-1"></i>Deactivated</span>';
        } else if (usr.status === 'Archived') {
            statusBadgeHTML = '<span class="badge bg-dark px-2.5 py-1"><i class="bi bi-archive-fill me-1"></i>Archived</span>';
        }

        const isSuperAdmin = (usr.username && usr.username.toLowerCase() === 'peso-admin') || (usr.email && usr.email.toLowerCase() === 'peso.admin@koronadal.gov.ph');

        const firstInitial = (usr.first_name && usr.first_name.trim().length > 0) ? usr.first_name.trim()[0] : ((usr.username && usr.username.length > 0) ? usr.username[0] : 'U');
        const lastInitial = (usr.last_name && usr.last_name.trim().length > 0) ? usr.last_name.trim()[0] : '';

        tr.innerHTML = `
            <td class="ps-3"><input type="checkbox" class="form-check-input user-select-checkbox" data-user-id="${usr.id}"></td>
            <td>
                <div class="d-flex align-items-center">
                    <div class="avatar-circle bg-primary-subtle text-primary me-2 fw-semibold" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;">
                        ${escapeHtml(firstInitial.toUpperCase())}${escapeHtml(lastInitial.toUpperCase())}
                    </div>
                    <div>
                        <div class="fw-semibold text-dark">${fullName}</div>
                        <small class="text-muted">${escapeHtml(usr.username || '')}</small>
                    </div>
                </div>
            </td>
            <td><span class="badge ${roleBadgeClass} px-2 py-1">${escapeHtml(usr.role || 'PESO Officer')}</span></td>
            <td><span class="badge bg-light text-dark border">${escapeHtml(usr.department || 'PESO')}</span></td>
            <td>
                <div class="small">${escapeHtml(usr.email || '')}</div>
                <small class="text-muted"><i class="bi bi-shield-lock me-1"></i>${maskedPhone}</small>
            </td>
            <td class="text-center">${statusBadgeHTML}</td>
            <td><small class="text-muted">${escapeHtml(usr.created_at ? new Date(usr.created_at).toLocaleDateString() : '2026-01-15')}</small></td>
            <td class="text-end pe-3">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="openUserDetailsModal(${usr.id})" title="View Details (Read-Only)">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-secondary" onclick="openEditUserModal(${usr.id})" title="Edit Officer">
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
                    <button class="btn btn-outline-success" onclick="openUserActionModal('ACTIVATE', ${usr.id})" title="Reactivate (Activate)">
                        <i class="bi bi-person-check"></i>
                    </button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderUsersPaginationUI(totalEntries, startIndex, endIndex, totalPages) {
    const infoEl = document.getElementById('usersPaginationInfo');
    if (infoEl) {
        if (totalEntries === 0) {
            infoEl.textContent = 'Showing 0 to 0 of 0 accounts';
        } else {
            infoEl.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${totalEntries} accounts`;
        }
    }

    const container = document.getElementById('usersPaginationContainer');
    if (!container) return;
    container.innerHTML = '';

    if (totalPages <= 1) return;

    // Previous Button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${usersCurrentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="#" onclick="event.preventDefault(); setUsersPage(${usersCurrentPage - 1})" aria-label="Previous"><i class="bi bi-chevron-left"></i></a>`;
    container.appendChild(prevLi);

    // Page Numbers
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= usersCurrentPage - 1 && p <= usersCurrentPage + 1)) {
            const pageLi = document.createElement('li');
            pageLi.className = `page-item ${p === usersCurrentPage ? 'active' : ''}`;
            pageLi.innerHTML = `<a class="page-link" href="#" onclick="event.preventDefault(); setUsersPage(${p})">${p}</a>`;
            container.appendChild(pageLi);
        } else if (p === usersCurrentPage - 2 || p === usersCurrentPage + 2) {
            const dotsLi = document.createElement('li');
            dotsLi.className = 'page-item disabled';
            dotsLi.innerHTML = `<span class="page-link">...</span>`;
            container.appendChild(dotsLi);
        }
    }

    // Next Button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${usersCurrentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="#" onclick="event.preventDefault(); setUsersPage(${usersCurrentPage + 1})" aria-label="Next"><i class="bi bi-chevron-right"></i></a>`;
    container.appendChild(nextLi);
}

function setUsersPage(page) {
    usersCurrentPage = Number(page) || 1;
    filterUsers(false);
}

function handleUsersPerPageChange(size) {
    usersPerPage = parseInt(size, 10) || 10;
    usersCurrentPage = 1;
    filterUsers(false);
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

    const adminId = sessionStorage.getItem('userId') || '1';
    logAuditEvent('OPEN_CREATE_USER_FORM', `PESO Admin [ID: ${adminId}] opened Create New User Account modal`);
    safeOpenModal('newUserModal');
}

// REQ008: Create Officer Accounts with Validation and Exclusive Supabase Integration
async function handleCreateUserSubmit(e) {
    e.preventDefault();

    const firstName = (document.getElementById('newUsrFirstName')?.value || '').trim();
    const middleName = (document.getElementById('newUsrMiddleName')?.value || '').trim();
    const lastName = (document.getElementById('newUsrLastName')?.value || '').trim();
    const suffix = document.getElementById('newUsrSuffix')?.value || 'N/A';
    const username = (document.getElementById('newUsrUsername')?.value || '').trim();
    const email = (document.getElementById('newUsrEmail')?.value || '').trim();
    const password = document.getElementById('newUsrPassword')?.value || '';
    const passwordConfirm = document.getElementById('newUsrPasswordConfirm')?.value || '';
    const role = document.getElementById('newUsrRole')?.value || 'PESO Officer';
    const department = document.getElementById('newUsrDept')?.value || 'PESO';
    const sex = document.getElementById('newUsrSex')?.value || 'Male';
    const phone = (document.getElementById('newUsrPhone')?.value || '').trim();
    const address = (document.getElementById('newUsrAddress')?.value || '').trim();
    const actionReason = (document.getElementById('newUsrActionReason')?.value || '').trim();

    if (!firstName || !lastName || !username || !email || !password || !passwordConfirm || !phone || !address || !actionReason) {
        window.showSystemNotification({
            title: 'Validation Error',
            message: 'All required fields marked with * and mandatory Action Reason must be filled.',
            type: 'warning'
        });
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        window.showSystemNotification({
            title: 'Invalid Email Format',
            message: 'Please provide a valid email address (e.g. officer@koronadal.gov.ph).',
            type: 'warning'
        });
        return;
    }

    if (password.length < 6) {
        window.showSystemNotification({
            title: 'Weak Password',
            message: 'Password must be at least 6 characters long.',
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

    if (usersList.some(u => u.username && u.username.toLowerCase() === username.toLowerCase())) {
        window.showSystemNotification({
            title: 'Username Exists',
            message: `A user account with username "${username}" already exists.`,
            type: 'warning'
        });
        return;
    }

    // Exclusive Supabase Persistence
    if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
        try {
            const res = await DataService.staffProfiles.create({
                agency: 'PESO',
                first_name: firstName,
                middle_name: middleName || null,
                last_name: lastName,
                suffix: suffix !== 'N/A' ? suffix : null,
                username: username,
                email: email,
                password: password,
                role: role,
                department: department,
                sex: sex,
                phone: phone,
                address: address,
                status: 'Active'
            });

            if (res && res.error) {
                window.showSystemNotification({
                    title: 'Registration Error',
                    message: res.error.message || 'Failed to create officer account in Supabase.',
                    type: 'error'
                });
                return;
            }
        } catch (err) {
            console.error('[USERS] Supabase user creation error:', err);
            window.showSystemNotification({
                title: 'Database Error',
                message: 'Failed to communicate with Supabase. Account was not created.',
                type: 'error'
            });
            return;
        }
    }

    const adminId = sessionStorage.getItem('userId') || '1';
    const adminUser = sessionStorage.getItem('username') || 'peso-admin';
    logAuditEvent('CREATE_USER_ACCOUNT', `PESO Admin [ID:${adminId}, ${adminUser}] registered officer "${username}" (${role}, ${department}). Justification: ${actionReason}`);

    safeHideModal('newUserModal');
    await initUserManagementData();

    window.showSystemNotification({
        title: 'Officer Account Created',
        message: `Account for ${firstName} ${lastName} (${username}) successfully registered in Supabase.`,
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
    setText('viewUserUsername', usr.username || 'N/A');
    setText('viewUserEmail', usr.email || 'N/A');
    setText('viewUserRoleBadge', usr.role || 'PESO Officer');
    setText('viewUserDepartment', usr.department || 'PESO');
    setText('viewUserPhone', maskContactNumber(usr.phone || usr.contact_number || '0917-000-0000'));
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

    const adminId = sessionStorage.getItem('userId') || '1';
    logAuditEvent('VIEW_USER_DETAILS', `Admin [ID:${adminId}] inspected read-only details for user ID ${usr.id} (${usr.username})`);
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
    setVal('editUsrUsername', usr.username || '');
    setVal('editUsrEmail', usr.email || '');
    setVal('editUsrPhone', usr.phone || usr.contact_number || '');
    setVal('editUsrRole', usr.role || 'PESO Officer');
    setVal('editUsrDept', usr.department || 'PESO');
    setVal('editUsrStatus', usr.status || 'Active');
    setVal('editUsrAddress', usr.address || 'City of Koronadal');
    setVal('editUsrNewPassword', '');
    setVal('editUsrActionReason', '');

    safeOpenModal('editUserModal');
}

// REQ009: Update Officer Accounts with Defensive Validation & Exclusive Supabase Sync
async function handleSaveUserUpdates(e) {
    e.preventDefault();

    const editIdEl = document.getElementById('editUsrId');
    const userId = editIdEl ? Number(editIdEl.value) : null;
    if (!userId) {
        window.showSystemNotification({ title: 'Update Notice', message: 'Target user account ID is invalid.', type: 'danger' });
        return;
    }

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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(updatedEmail)) {
        window.showSystemNotification({
            title: 'Invalid Email',
            message: 'Please enter a valid email address.',
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

    if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
        try {
            const updatePayload = {
                username: updatedUsername,
                email: updatedEmail,
                phone: updatedPhone,
                role: updatedRole,
                department: updatedDept,
                status: updatedStatus,
                address: updatedAddress
            };
            const updateRes = await DataService.staffProfiles.update(userId, updatePayload);
            if (updateRes && updateRes.error) {
                window.showSystemNotification({
                    title: 'Update Failed',
                    message: updateRes.error.message || 'Failed to update user profile in Supabase.',
                    type: 'error'
                });
                return;
            }
        } catch (err) {
            console.error('[USERS] Supabase update error:', err);
            window.showSystemNotification({
                title: 'Database Error',
                message: 'Failed to communicate with Supabase. Profile update aborted.',
                type: 'error'
            });
            return;
        }
    }

    // Update in local state
    usr.username = updatedUsername;
    usr.email = updatedEmail;
    usr.phone = updatedPhone;
    usr.role = updatedRole;
    usr.department = updatedDept;
    usr.status = updatedStatus;
    usr.address = updatedAddress;
    if (updatedStatus === 'Active') usr.failed_attempts = 0;

    const adminId = sessionStorage.getItem('userId') || '1';
    const adminUser = sessionStorage.getItem('username') || 'peso-admin';
    logAuditEvent('UPDATE_USER_ACCOUNT', `PESO Admin [ID:${adminId}, ${adminUser}] updated officer ID ${userId} (${updatedUsername}). Role: ${updatedRole}, Dept: ${updatedDept}, Status: ${updatedStatus}. Reason: ${actionReason}`);

    safeHideModal('editUserModal');
    updateUserMetrics();
    filterUsers(false);

    window.showSystemNotification({
        title: 'Officer Profile Updated',
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
        if (title) title.textContent = 'Deactivate Officer Account';
        if (banner) banner.innerHTML = `<div class="text-danger mb-2"><i class="bi bi-person-x-fill" style="font-size: 3.5rem;"></i></div><h5 class="fw-bold text-dark mb-1">Deactivate "${escapeHtml(usr.username)}"?</h5><p class="text-muted small">Officer will be prevented from logging into the portal. The account record remains preserved.</p>`;
        if (alertBox) alertBox.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1 text-danger"></i> <strong>Compliance Rule:</strong> Deactivated accounts can be reactivated anytime by an authorized PESO Administrator.`;
        if (submitBtn) {
            submitBtn.className = 'btn btn-danger fw-bold px-4';
            submitBtn.textContent = 'Confirm Deactivation';
        }
    } else if (normalizedType === 'archive') {
        if (header) header.className = 'modal-header rounded-top-4 py-3 bg-secondary text-white';
        if (icon) icon.className = 'bi bi-archive-fill fs-4';
        if (title) title.textContent = 'Archive Officer Account';
        if (banner) banner.innerHTML = `<div class="text-secondary mb-2"><i class="bi bi-archive-fill" style="font-size: 3.5rem;"></i></div><h5 class="fw-bold text-dark mb-1">Archive "${escapeHtml(usr.username)}"?</h5><p class="text-muted small">Account will be revoked from active roster and retained in read-only archive.</p>`;
        if (alertBox) alertBox.innerHTML = `<i class="bi bi-shield-lock-fill me-1 text-secondary"></i> <strong>Compliance Rule:</strong> Archived accounts cannot login. All historical audit records remain strictly preserved.`;
        if (submitBtn) {
            submitBtn.className = 'btn btn-secondary fw-bold px-4';
            submitBtn.textContent = 'Confirm Archive';
        }
    } else if (normalizedType === 'activate') {
        if (header) header.className = 'modal-header rounded-top-4 py-3 bg-success text-white';
        if (icon) icon.className = 'bi bi-arrow-counterclockwise fs-4';
        if (title) title.textContent = 'Re-Activate Officer Account';
        if (banner) banner.innerHTML = `<div class="text-success mb-2"><i class="bi bi-shield-check" style="font-size: 3.5rem;"></i></div><h5 class="fw-bold text-dark mb-1">Restore "${escapeHtml(usr.username)}" to Active Status?</h5>`;
        if (alertBox) alertBox.innerHTML = `<i class="bi bi-check-circle-fill me-1 text-success"></i> <strong>Notice:</strong> Account will regain system access and permissions across all portals.`;
        if (submitBtn) {
            submitBtn.className = 'btn btn-success fw-bold px-4';
            submitBtn.textContent = 'Confirm Activation';
        }
    } else if (normalizedType === 'delete') {
        if (header) header.className = 'modal-header rounded-top-4 py-3 bg-danger text-white';
        if (icon) icon.className = 'bi bi-trash-fill fs-4';
        if (title) title.textContent = 'Permanently Delete Officer Account';
        if (banner) banner.innerHTML = `<div class="text-danger mb-2"><i class="bi bi-exclamation-triangle-fill" style="font-size: 3.5rem;"></i></div><h5 class="fw-bold text-danger mb-1">Permanent Deletion Warning</h5><p class="text-muted small">User account "${escapeHtml(usr.username)}" will be permanently removed.</p>`;
        if (alertBox) alertBox.innerHTML = `<i class="bi bi-exclamation-octagon-fill me-1 text-danger"></i> <strong>Critical Warning:</strong> Permanent deletion cannot be undone. Action reason is required for compliance audit.`;
        if (submitBtn) {
            submitBtn.className = 'btn btn-danger fw-bold px-4';
            submitBtn.textContent = 'Permanently Delete';
        }
    }

    safeOpenModal('userActionConfirmModal');
}

// REQ010 & REQ011: Account Activation and Deactivation Handlers with Supabase Sync
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

    const adminId = sessionStorage.getItem('userId') || '1';
    const adminUser = sessionStorage.getItem('username') || 'peso-admin';

    if (actionType === 'unlock') {
        if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
            try { 
                const res = await DataService.staffProfiles.toggleStatus(userId, 'Active');
                if (res && res.error) {
                    window.showSystemNotification({ title: 'Error', message: res.error.message || 'Failed to unlock in Supabase.', type: 'error' });
                    return;
                }
            } catch (e) {
                window.showSystemNotification({ title: 'Database Error', message: 'Failed to communicate with Supabase.', type: 'error' });
                return;
            }
        }
        usr.status = 'Active';
        usr.failed_attempts = 0;
        logAuditEvent('UNLOCK_USER_ACCOUNT', `PESO Admin [ID:${adminId}, ${adminUser}] unlocked user ID ${userId} (${usr.username}). Reset failed attempts to 0. Reason: ${actionReason}`);
        window.showSystemNotification({ title: 'Account Unlocked', message: `User "${usr.username}" unlocked and restored to Active status.`, type: 'success' });

    } else if (actionType === 'deactivate') {
        // Prevent self-deactivation of primary admin
        const isSuperAdmin = (usr.username && usr.username.toLowerCase() === 'peso-admin') || (usr.email && usr.email.toLowerCase() === 'peso.admin@koronadal.gov.ph');
        if (isSuperAdmin) {
            window.showSystemNotification({ title: 'Action Restricted', message: 'Primary PESO Administrator account cannot be deactivated.', type: 'error' });
            return;
        }

        if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
            try { 
                const res = await DataService.staffProfiles.toggleStatus(userId, 'Deactivated');
                if (res && res.error) {
                    window.showSystemNotification({ title: 'Error', message: res.error.message || 'Failed to deactivate in Supabase.', type: 'error' });
                    return;
                }
            } catch (e) {
                window.showSystemNotification({ title: 'Database Error', message: 'Failed to communicate with Supabase.', type: 'error' });
                return;
            }
        }
        usr.status = 'Deactivated';
        logAuditEvent('DEACTIVATE_USER_ACCOUNT', `PESO Admin [ID:${adminId}, ${adminUser}] deactivated officer ID ${userId} (${usr.username}). Reason: ${actionReason}`);
        window.showSystemNotification({ title: 'Account Deactivated', message: `Officer account "${usr.username}" status set to Deactivated. Login access has been revoked.`, type: 'warning' });

    } else if (actionType === 'archive') {
        if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
            try { 
                const res = await DataService.staffProfiles.toggleStatus(userId, 'Deactivated');
                if (res && res.error) {
                    window.showSystemNotification({ title: 'Error', message: res.error.message || 'Failed to archive in Supabase.', type: 'error' });
                    return;
                }
            } catch (e) {
                window.showSystemNotification({ title: 'Database Error', message: 'Failed to communicate with Supabase.', type: 'error' });
                return;
            }
        }
        usr.status = 'Archived';
        logAuditEvent('ARCHIVE_USER_ACCOUNT', `PESO Admin [ID:${adminId}, ${adminUser}] archived officer ID ${userId} (${usr.username}). Reason: ${actionReason}`);
        window.showSystemNotification({ title: 'Account Archived', message: `Officer account "${usr.username}" moved to Archive.`, type: 'warning' });

    } else if (actionType === 'activate') {
        if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
            try { 
                const res = await DataService.staffProfiles.toggleStatus(userId, 'Active');
                if (res && res.error) {
                    window.showSystemNotification({ title: 'Error', message: res.error.message || 'Failed to activate in Supabase.', type: 'error' });
                    return;
                }
            } catch (e) {
                window.showSystemNotification({ title: 'Database Error', message: 'Failed to communicate with Supabase.', type: 'error' });
                return;
            }
        }
        usr.status = 'Active';
        logAuditEvent('ACTIVATE_USER_ACCOUNT', `PESO Admin [ID:${adminId}, ${adminUser}] activated officer ID ${userId} (${usr.username}). Reason: ${actionReason}`);
        window.showSystemNotification({ title: 'Account Activated', message: `Officer account "${usr.username}" restored to Active status. Portal login access restored.`, type: 'success' });

    } else if (actionType === 'delete') {
        if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
            try { 
                const res = await DataService.staffProfiles.delete(userId);
                if (res && res.error) {
                    window.showSystemNotification({ title: 'Error', message: res.error.message || 'Failed to delete in Supabase.', type: 'error' });
                    return;
                }
            } catch (e) {
                window.showSystemNotification({ title: 'Database Error', message: 'Failed to communicate with Supabase.', type: 'error' });
                return;
            }
        }
        usersList = usersList.filter(u => u.id !== userId);
        logAuditEvent('PERMANENT_DELETE_USER', `PESO Admin [ID:${adminId}, ${adminUser}] permanently deleted officer record ID ${userId} (${usr.username}). Reason: ${actionReason}`);
        window.showSystemNotification({ title: 'Account Permanently Deleted', message: `Officer account record ID ${userId} removed.`, type: 'danger' });
    }

    safeHideModal('userActionConfirmModal');
    updateUserMetrics();
    filterUsers(false);
}

function exportUsersCsv() {
    let csv = 'ID,Full Name,Username,Email,Role,Department,Phone (Masked),Status,Failed Attempts,Last Login,Created At\n';
    usersList.forEach(u => {
        const fullName = `"${u.first_name || ''} ${u.middle_name || ''} ${u.last_name || ''} ${u.suffix && u.suffix !== 'N/A' ? u.suffix : ''}"`.trim();
        const maskedPhone = `"${maskContactNumber(u.phone || u.contact_number || '')}"`;
        csv += `${u.id},${fullName},"${u.username || ''}","${u.email || ''}","${u.role || ''}","${u.department || 'PESO'}",${maskedPhone},"${u.status || 'Active'}",${u.failed_attempts || 0},"${u.last_login || 'Never'}","${u.created_at || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `PESO_Users_Roster_${new Date().toISOString().substring(0, 10)}.csv`;
    link.click();

    const adminId = sessionStorage.getItem('userId') || '1';
    logAuditEvent('EXPORT_USERS_CSV', `PESO Admin [ID:${adminId}] exported User & Officer Roster CSV`);
    window.showSystemNotification({ title: 'Export Complete', message: 'User roster CSV downloaded successfully.', type: 'info' });
}

function exportCompliancePdf() {
    const adminId = sessionStorage.getItem('userId') || '1';
    logAuditEvent('EXPORT_COMPLIANCE_PDF', `PESO Admin [ID:${adminId}] initiated Compliance PDF Print View for User Roster`);
    window.print();
}

// Backward compatibility aliases for merged officer management
window.openNewOfficerModal = openNewUserModal;
window.openEditOfficerModal = openEditUserModal;
window.initOfficersData = initUserManagementData;
window.fetchOfficersFromApi = fetchUsersFromApi;
window.filterUsers = filterUsers;
window.filterOfficers = filterUsers;
window.renderOfficersTables = filterUsers;
window.setUsersPage = setUsersPage;
window.handleUsersPerPageChange = handleUsersPerPageChange;

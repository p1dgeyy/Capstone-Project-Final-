/**
 * PESO Admin Portal - PESO Officers Management Module (Tab 6)
 * Module: Officers (peso-admin-officers.js)
 * Implements: REQ007, REQ008, REQ009, REQ010, REQ011
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
                const adminOff = officersList.find(o => (o.username && o.username.toLowerCase() === 'peso-admin') || (o.email && o.email.toLowerCase() === 'peso.admin@koronadal.gov.ph'));
                if (adminOff) adminOff.status = 'Active';
                if (document.getElementById('sectionOfficers') && !document.getElementById('sectionOfficers').classList.contains('d-none')) {
                    renderOfficersTables();
                } else if (document.getElementById('sectionUsers') && !document.getElementById('sectionUsers').classList.contains('d-none')) {
                    if (typeof filterUsers === 'function') filterUsers(false);
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
    if (document.getElementById('activeOfficersTableBody')) {
        renderOfficersTables();
    } else if (typeof filterUsers === 'function') {
        filterUsers(false);
    }
}

function renderOfficersTables() {
    if (!Array.isArray(officersList)) {
        officersList = [];
    }

    const activeTbody = document.getElementById('activeOfficersTableBody');
    const archiveTbody = document.getElementById('archivedOfficersTableBody');

    // If unified users table is active in DOM, delegate to filterUsers
    if (!activeTbody && !archiveTbody && typeof filterUsers === 'function') {
        filterUsers(false);
        return;
    }

    const searchInput = document.getElementById('officerSearchInput') || document.getElementById('userSearchInput');
    const search = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const roleSelect = document.getElementById('officerRoleFilter') || document.getElementById('userRoleFilter');
    const roleFilter = roleSelect ? roleSelect.value : 'ALL';
    const deptSelect = document.getElementById('officerDeptFilter') || document.getElementById('userDeptFilter');
    const deptFilter = deptSelect ? deptSelect.value : 'ALL';
    const statusSelect = document.getElementById('officerStatusFilter') || document.getElementById('userStatusFilter');
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
    if (activeTbody) {
        activeTbody.innerHTML = activeOfficers.length === 0 ? `<tr><td colspan="8" class="text-center py-4 text-muted">No active officer accounts found matching criteria.</td></tr>` : '';
        activeOfficers.forEach(off => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            const fullName = `${escapeHtml(off.first_name || '')} ${escapeHtml(off.middle_name || '')} ${escapeHtml(off.last_name || '')} ${off.suffix && off.suffix !== 'N/A' ? escapeHtml(off.suffix) : ''}`.trim() || escapeHtml(off.username || 'Officer');
            tr.innerHTML = `
                <td onclick="openEditOfficerModal(${off.id})">
                    <div class="fw-bold text-dark">${fullName}</div>
                    <small class="text-muted"><i class="bi bi-gender-ambiguous me-1"></i>${escapeHtml(off.sex || 'N/A')}</small>
                </td>
                <td onclick="openEditOfficerModal(${off.id})"><span class="badge bg-light text-dark font-monospace border">${escapeHtml(off.username || '')}</span></td>
                <td onclick="openEditOfficerModal(${off.id})">${escapeHtml(off.email || '')}</td>
                <td onclick="openEditOfficerModal(${off.id})"><span class="badge bg-primary-subtle text-primary fw-semibold">${escapeHtml(off.role || 'PESO Officer')}</span></td>
                <td onclick="openEditOfficerModal(${off.id})"><span class="badge bg-secondary-subtle text-dark">${escapeHtml(off.department || 'PESO')}</span></td>
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
    if (archiveTbody) {
        archiveTbody.innerHTML = archivedOfficers.length === 0 ? `<tr><td colspan="8" class="text-center py-4 text-muted">Archive box clean — no deactivated officer accounts.</td></tr>` : '';
        archivedOfficers.forEach(off => {
            const tr = document.createElement('tr');
            const fullName = `${escapeHtml(off.first_name || '')} ${escapeHtml(off.middle_name || '')} ${escapeHtml(off.last_name || '')} ${off.suffix && off.suffix !== 'N/A' ? escapeHtml(off.suffix) : ''}`.trim() || escapeHtml(off.username || 'Officer');
            tr.innerHTML = `
                <td>
                    <div class="fw-bold text-secondary text-decoration-line-through">${fullName}</div>
                    <small class="text-muted"><i class="bi bi-lock-fill text-warning me-1"></i>Access Revoked</small>
                </td>
                <td><span class="badge bg-light text-muted font-monospace border">${escapeHtml(off.username || '')}</span></td>
                <td>${escapeHtml(off.email || '')}</td>
                <td><span class="badge bg-secondary-subtle text-secondary">${escapeHtml(off.role || 'PESO Officer')}</span></td>
                <td><span class="badge bg-light text-dark">${escapeHtml(off.department || 'PESO')}</span></td>
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

function openNewOfficerModal() {
    if (document.getElementById('newOfficerModal')) {
        const form = document.getElementById('newOfficerForm');
        if (form) form.reset();
        const adminId = sessionStorage.getItem('userId') || '1';
        logAuditEvent('OPEN_CREATE_OFFICER_FORM', `PESO Admin [ID: ${adminId}] opened Create New Officer Account form modal`);
        safeOpenModal('newOfficerModal');
    } else if (typeof openNewUserModal === 'function') {
        openNewUserModal();
    }
}

async function handleCreateOfficerSubmit(e) {
    e.preventDefault();

    const firstName = (document.getElementById('newOffFirstName')?.value || '').trim();
    const middleName = (document.getElementById('newOffMiddleName')?.value || '').trim();
    const lastName = (document.getElementById('newOffLastName')?.value || '').trim();
    const suffix = document.getElementById('newOffSuffix')?.value || 'N/A';
    const username = (document.getElementById('newOffUsername')?.value || '').trim();
    const password = document.getElementById('newOffPassword')?.value || '';
    const confirmPassword = document.getElementById('newOffConfirmPassword')?.value || '';
    const email = (document.getElementById('newOffEmail')?.value || '').trim();
    const role = document.getElementById('newOffRole')?.value || 'PESO Officer';
    const gender = document.getElementById('newOffGender')?.value || 'Male';
    const address = (document.getElementById('newOffAddress')?.value || '').trim();
    const contactNumber = (document.getElementById('newOffContactNumber')?.value || '').trim();
    const department = (document.getElementById('newOffDepartment')?.value || 'PESO').trim();

    if (!firstName || !lastName || !username || !email || !password || !confirmPassword || !contactNumber) {
        window.showSystemNotification({
            title: 'Validation Error',
            message: 'Please complete all required fields marked with *.',
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

    if (password !== confirmPassword) {
        window.showSystemNotification({
            title: 'Password Mismatch',
            message: 'Password and Confirm Password do not match.',
            type: 'error'
        });
        return;
    }

    // Strict Cross-Department Validation
    const cswdoRoles = ['CSWDO Admin', 'CSWDO Officer'];
    if (cswdoRoles.includes(role) || (department && department.toUpperCase() === 'CSWDO')) {
        window.showSystemNotification({
            title: 'Cross-Department Action Blocked',
            message: 'Validation Error: Cross-department assignment blocked. PESO portal only manages PESO officers.',
            type: 'error'
        });
        return;
    }

    if (officersList.some(o => o.username && o.username.toLowerCase() === username.toLowerCase())) {
        window.showSystemNotification({
            title: 'Username Taken',
            message: `Username "${username}" is already assigned to another account.`,
            type: 'warning'
        });
        return;
    }

    const newOff = {
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
        sex: gender,
        phone: contactNumber,
        address: address,
        status: 'Active'
    };

    if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
        try {
            const createRes = await DataService.staffProfiles.create(newOff);
            if (createRes && createRes.error) {
                window.showSystemNotification({
                    title: 'Registration Error',
                    message: createRes.error.message || 'Failed to create officer account in Supabase.',
                    type: 'error'
                });
                return;
            }
        } catch (err) {
            console.error('[OFFICERS] Supabase staff creation error:', err);
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
    logAuditEvent('CREATE_OFFICER_ACCOUNT', `PESO Admin [ID:${adminId}, ${adminUser}] created new officer account "${username}" (${firstName} ${lastName}), Role: ${role}, Dept: ${department}`);

    safeHideModal('newOfficerModal');
    await initOfficersData();
    if (typeof initUserManagementData === 'function') await initUserManagementData();

    window.showSystemNotification({
        title: 'Officer Account Created',
        message: `Officer account for ${firstName} ${lastName} (${username}) created successfully in Supabase.`,
        type: 'success'
    });
}

function openEditOfficerModal(officerId) {
    if (!document.getElementById('editOfficerModal')) {
        if (typeof openEditUserModal === 'function') {
            return openEditUserModal(officerId);
        }
    }

    if (!Array.isArray(officersList)) officersList = [];
    const off = officersList.find(o => o && o.id === officerId);
    if (!off) {
        console.warn('[OFFICERS] Officer record not found for ID:', officerId);
        window.showSystemNotification({ title: 'Officer Notice', message: 'Officer details not found.', type: 'warning' });
        return;
    }

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('editOffId', off.id);
    setVal('editOffFullName', `${off.first_name || ''} ${off.middle_name || ''} ${off.last_name || ''} ${off.suffix && off.suffix !== 'N/A' ? off.suffix : ''}`.trim());
    setVal('editOffUsername', off.username);
    setVal('editOffEmail', off.email);
    setVal('editOffPhone', off.phone);
    setVal('editOffRole', off.role || 'PESO Officer');
    setVal('editOffDepartment', off.department || 'PESO');
    setVal('editOffAddress', off.address || 'City of Koronadal');
    setVal('editOffStatus', off.status || 'Active');

    safeOpenModal('editOfficerModal');
}

async function handleSaveOfficerUpdates(e) {
    e.preventDefault();
    const offIdEl = document.getElementById('editOffId');
    const offId = offIdEl ? Number(offIdEl.value) : null;
    const off = officersList.find(o => o && o.id === offId);
    if (!off) {
        window.showSystemNotification({ title: 'Update Error', message: 'Target officer account not found.', type: 'danger' });
        return;
    }

    const updatedUsername = (document.getElementById('editOffUsername')?.value || '').trim();
    const updatedEmail = (document.getElementById('editOffEmail')?.value || '').trim();
    const updatedPhone = (document.getElementById('editOffPhone')?.value || '').trim();
    const updatedRole = document.getElementById('editOffRole')?.value || 'PESO Officer';
    const updatedDept = document.getElementById('editOffDepartment')?.value || 'PESO';
    const updatedAddress = (document.getElementById('editOffAddress')?.value || '').trim();

    // Strict Cross-Department Validation
    const cswdoRoles = ['CSWDO Admin', 'CSWDO Officer'];
    if (cswdoRoles.includes(updatedRole) || (updatedDept && updatedDept.toUpperCase() === 'CSWDO')) {
        window.showSystemNotification({
            title: 'Cross-Department Action Blocked',
            message: 'Validation Error: Cross-department assignment blocked. PESO portal only manages PESO officers.',
            type: 'error'
        });
        return;
    }

    if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
        try {
            const updateRes = await DataService.staffProfiles.update(offId, {
                username: updatedUsername,
                email: updatedEmail,
                phone: updatedPhone,
                role: updatedRole,
                department: updatedDept,
                address: updatedAddress
            });

            if (updateRes && updateRes.error) {
                window.showSystemNotification({
                    title: 'Update Error',
                    message: updateRes.error.message || 'Failed to update officer details in Supabase.',
                    type: 'error'
                });
                return;
            }
        } catch (err) {
            console.error('[OFFICERS] Supabase update error:', err);
            window.showSystemNotification({
                title: 'Database Error',
                message: 'Failed to communicate with Supabase. Update aborted.',
                type: 'error'
            });
            return;
        }
    }

    off.username = updatedUsername;
    off.email = updatedEmail;
    off.phone = updatedPhone;
    off.role = updatedRole;
    off.department = updatedDept;
    off.address = updatedAddress;

    const adminId = sessionStorage.getItem('userId') || '1';
    const adminUser = sessionStorage.getItem('username') || 'peso-admin';
    logAuditEvent('UPDATE_OFFICER_ACCOUNT', `PESO Admin [ID:${adminId}, ${adminUser}] updated details for officer account ID ${offId} (${updatedUsername}), Role: ${updatedRole}, Dept: ${updatedDept}`);

    safeHideModal('editOfficerModal');
    renderOfficersTables();
    if (typeof filterUsers === 'function') filterUsers(false);

    window.showSystemNotification({
        title: 'Account Updated',
        message: `Officer account details for "${updatedUsername}" updated successfully in Supabase.`,
        type: 'success'
    });
}

// REQ010 & REQ011: Status toggle using toggleStatus with Supabase error checking
async function handleOfficerStatusToggle(event, officerId) {
    const off = officersList.find(o => o.id === officerId);
    if (!off) return;

    const isDeactivating = !event.target.checked;
    const newStatus = isDeactivating ? 'Deactivated' : 'Active';

    if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
        try {
            const res = await DataService.staffProfiles.toggleStatus(officerId, newStatus);
            if (res && res.error) {
                event.target.checked = !event.target.checked; // Revert UI
                window.showSystemNotification({
                    title: 'Status Update Error',
                    message: res.error.message || 'Failed to update officer status in Supabase.',
                    type: 'error'
                });
                return;
            }
        } catch (err) {
            event.target.checked = !event.target.checked;
            window.showSystemNotification({
                title: 'Database Error',
                message: 'Failed to communicate with Supabase.',
                type: 'error'
            });
            return;
        }
    }

    off.status = newStatus;

    const adminId = sessionStorage.getItem('userId') || '1';
    const adminUser = sessionStorage.getItem('username') || 'peso-admin';
    logAuditEvent(isDeactivating ? 'DEACTIVATE_OFFICER_ACCOUNT' : 'ACTIVATE_OFFICER_ACCOUNT', `PESO Admin [ID:${adminId}, ${adminUser}] set status of officer "${off.username}" to ${newStatus}`);
    
    renderOfficersTables();
    if (typeof filterUsers === 'function') filterUsers(false);

    window.showSystemNotification({
        title: 'Officer Status Updated',
        message: `Officer account "${off.username}" status set to ${newStatus}.`,
        type: isDeactivating ? 'warning' : 'success'
    });
}

async function activateOfficerAccount(officerId) {
    const off = officersList.find(o => o.id === officerId);
    if (!off) return;

    if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
        try {
            const res = await DataService.staffProfiles.toggleStatus(officerId, 'Active');
            if (res && res.error) {
                window.showSystemNotification({
                    title: 'Activation Error',
                    message: res.error.message || 'Failed to activate officer in Supabase.',
                    type: 'error'
                });
                return;
            }
        } catch (err) {
            window.showSystemNotification({
                title: 'Database Error',
                message: 'Failed to communicate with Supabase.',
                type: 'error'
            });
            return;
        }
    }

    off.status = 'Active';

    const adminId = sessionStorage.getItem('userId') || '1';
    const adminUser = sessionStorage.getItem('username') || 'peso-admin';
    logAuditEvent('ACTIVATE_OFFICER_ACCOUNT', `PESO Admin [ID:${adminId}, ${adminUser}] restored officer "${off.username}" to Active status.`);
    
    renderOfficersTables();
    if (typeof filterUsers === 'function') filterUsers(false);

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

    if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
        try {
            const res = await DataService.staffProfiles.delete(officerId);
            if (res && res.error) {
                window.showSystemNotification({
                    title: 'Delete Error',
                    message: res.error.message || 'Failed to delete officer in Supabase.',
                    type: 'error'
                });
                return;
            }
        } catch (err) {
            window.showSystemNotification({
                title: 'Database Error',
                message: 'Failed to communicate with Supabase.',
                type: 'error'
            });
            return;
        }
    }

    officersList = officersList.filter(o => o.id !== officerId);

    const adminId = sessionStorage.getItem('userId') || '1';
    const adminUser = sessionStorage.getItem('username') || 'peso-admin';
    logAuditEvent('PERMANENT_DELETE_OFFICER', `PESO Admin [ID:${adminId}, ${adminUser}] permanently deleted officer "${username}" (ID: ${officerId})`);
    
    renderOfficersTables();
    if (typeof filterUsers === 'function') filterUsers(false);

    window.showSystemNotification({
        title: 'Officer Account Deleted',
        message: `Officer account "${username}" permanently deleted.`,
        type: 'danger'
    });
}

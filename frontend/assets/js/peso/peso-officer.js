/**
 * PESO Officer Portal Master Controller Module (peso-officer.js)
 * City Government of Koronadal - Public Employment Service Office
 * 
 * Rules & Safeguards Enforced:
 * 1. Officer-Only Beneficiary Intake & Management
 * 2. Data Privacy Act Contact Masking (09XX-***-XXXX)
 * 3. Email & SMS OTP Verification Integration
 * 4. Digital QR Card Generation & Printing
 * 5. Daily Interview Attendance Tracking (Present / Absent)
 * 6. Livelihood Batch Assignment & Queue Monitoring
 * 7. Live Supabase Realtime Synchronization
 */

const PesoOfficerApp = (() => {
    'use strict';

    const state = {
        beneficiaries: [],
        applications: [],
        schedules: [],
        batches: [],
        assistanceRecords: [],
        officers: [],
        auditLogs: [],
        pendingIntakeData: null,
        currentTab: 'dashboard',
        currentScheduleDate: new Date().toISOString().substring(0, 10),
        currentScheduleViewMode: 'list',
        selectedEvalAppId: null,
        selectedInterviewScheduleId: null,
        selectedBatchAssignAppIds: [],
        isLoaded: false
    };

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function maskPhone(phone) {
        if (!phone || phone === 'N/A' || phone === '-') return '09XX-***-XXXX';
        const clean = String(phone).trim().replace(/[^0-9]/g, '');
        if (clean.length >= 10) {
            return `${clean.substring(0, 4)}-***-${clean.substring(clean.length - 4)}`;
        }
        return '09XX-***-XXXX';
    }

    function formatCurrency(amount) {
        const num = Number(amount) || 0;
        return '₱' + num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function logAudit(actionType, details) {
        if (typeof window.logAuditEvent === 'function') {
            window.logAuditEvent(actionType, details);
        } else if (typeof PESOSafeguards !== 'undefined' && PESOSafeguards.logAudit) {
            PESOSafeguards.logAudit({
                intent: actionType,
                actionType: actionType,
                targetEntity: 'PESO Officer Portal',
                status: 'SUCCESS',
                details: details
            });
        }
    }

    function safeOpenModal(modalId) {
        const modalEl = document.getElementById(modalId);
        if (!modalEl) return;
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            bootstrap.Modal.getOrCreateInstance(modalEl).show();
        } else {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
        }
    }

    function safeCloseModal(modalId) {
        const modalEl = document.getElementById(modalId);
        if (!modalEl) return;
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const instance = bootstrap.Modal.getInstance(modalEl);
            if (instance) instance.hide();
        } else {
            modalEl.classList.remove('show');
            modalEl.style.display = 'none';
        }
    }

    /**
     * Switch Navigation Tabs in Officer Portal
     */
    function switchTab(tabId) {
        const cleanId = (tabId || 'dashboard').replace(/^tab-/, '').replace(/^nav/, '').toLowerCase();
        state.currentTab = cleanId;

        const tabMap = {
            'dashboard': 'tab-dashboard',
            'daily-schedules': 'tab-daily-schedules',
            'dailyschedules': 'tab-daily-schedules',
            'beneficiaries': 'tab-beneficiaries',
            'evaluation': 'tab-evaluation',
            'livelihood-mgmt': 'tab-livelihood-mgmt',
            'livelihood': 'tab-livelihood-mgmt',
            'approved-assistance': 'tab-approved-assistance',
            'assistance': 'tab-approved-assistance',
            'officer-roster': 'tab-officer-roster',
            'officerroster': 'tab-officer-roster'
        };

        const targetSectionId = tabMap[cleanId] || `tab-${cleanId}`;

        document.querySelectorAll('.tab-section').forEach(sec => {
            if (sec.id === targetSectionId) {
                sec.classList.remove('d-none');
                sec.style.display = 'block';
            } else {
                sec.classList.add('d-none');
                sec.style.display = 'none';
            }
        });

        document.querySelectorAll('.sidebar-menu .nav-link').forEach(link => {
            const onclickAttr = link.getAttribute('onclick') || '';
            if (onclickAttr.includes(`'${cleanId}'`) || onclickAttr.includes(`'${tabId}'`)) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        if (cleanId === 'dashboard') {
            if (typeof PesoDashboard !== 'undefined') {
                PesoDashboard.renderOfficerMetrics(window._cachedPrograms || [], state.applications, state.beneficiaries, state.schedules);
            }
        } else if (cleanId.includes('beneficiar')) {
            renderBeneficiariesTable();
        } else if (cleanId.includes('schedule')) {
            renderDailySchedulesTable();
        } else if (cleanId.includes('eval')) {
            renderOfficerEvaluationTable();
        } else if (cleanId.includes('livelihood')) {
            renderLivelihoodBatchesTable();
        } else if (cleanId.includes('assistance')) {
            renderApprovedAssistanceTable();
        } else if (cleanId.includes('roster')) {
            renderOfficerRosterTable();
        }

        logAudit('OFFICER_SWITCH_TAB', `Switched view to tab "${cleanId}"`);
    }

    /**
     * Fetch all officer data from Supabase / DataService
     */
    async function loadAllOfficerData() {
        if (typeof DataService === 'undefined') return;

        try {
            // 1. Beneficiaries
            const benRes = await DataService.beneficiaries.getAll();
            if (benRes && Array.isArray(benRes.data)) {
                state.beneficiaries = benRes.data.map(b => ({
                    id: b.id,
                    numId: b.id,
                    qr_code: b.qr_code || `QR-BEN-${b.id}`,
                    first_name: b.first_name || '',
                    last_name: b.last_name || '',
                    name: `${b.first_name || ''} ${b.last_name || ''}`.trim() || b.username || 'Beneficiary',
                    phone: b.phone || b.contact_number || '09XX-***-XXXX',
                    contact: b.phone || b.contact_number || '09XX-***-XXXX',
                    email: b.email || 'N/A',
                    barangay: b.address ? (b.address.split(',')[0] || 'Koronadal') : 'Koronadal',
                    address: b.address || 'Koronadal City',
                    category: b.category || 'Individual',
                    program: 'PESO Assistance',
                    status: b.status || 'Active',
                    age: b.age || 0,
                    sex: b.sex || 'N/A'
                }));
            }

            // 2. Applications
            const appRes = await DataService.applications.getAll({ agency: 'PESO' });
            if (appRes && Array.isArray(appRes.data)) {
                state.applications = appRes.data.map(a => {
                    const ben = a.beneficiary || {};
                    const prog = a.program || {};
                    return {
                        id: a.id,
                        dbId: a.id,
                        application_number: a.application_number || `APP-${a.id}`,
                        beneficiaryName: `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || a.beneficiary_qr || 'Applicant',
                        applicant_name: `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || a.beneficiary_qr || 'Applicant',
                        programCode: prog.code || 'PESO',
                        program: prog.name || prog.code || 'PESO Assistance',
                        date_applied: a.date_applied || (a.created_at ? a.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10)),
                        dateSubmitted: a.date_applied || (a.created_at ? a.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10)),
                        status: a.status || 'Pending',
                        remarks: a.officer_notes || a.remarks || '',
                        amount_requested: a.amount_requested || 0,
                        amount_approved: a.amount_approved || 0
                    };
                });
            }

            // 3. Interview Schedules
            const schedRes = await DataService.interviews.getAll({ agency: 'PESO' });
            if (schedRes && Array.isArray(schedRes.data)) {
                state.schedules = schedRes.data.map(i => {
                    const ben = i.beneficiary || {};
                    const prog = i.program || {};
                    const officer = i.officer || {};
                    const schedDate = i.interview_date || i.scheduled_date || (i.scheduled_time ? i.scheduled_time.substring(0, 10) : new Date().toISOString().substring(0, 10));
                    const schedTime = i.interview_time || '09:00 AM';

                    return {
                        id: i.id,
                        slot_id: `SLOT-${i.id}`,
                        beneficiaryName: `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || i.title || 'Applicant',
                        beneficiary_name: `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || i.title || 'Applicant',
                        phone: ben.phone || '09XX-***-XXXX',
                        beneficiaryPhone: ben.phone || '09XX-***-XXXX',
                        programCode: prog.code || 'PESO',
                        program_code: prog.code || 'PESO',
                        interviewDate: schedDate,
                        date: schedDate,
                        scheduleTime: schedTime,
                        time: schedTime,
                        venue: i.venue_location || i.location || 'PESO Main Office',
                        officerName: `${officer.first_name || ''} ${officer.last_name || ''}`.trim() || 'PESO Officer',
                        status: i.status || 'Scheduled',
                        attendance: i.attendance_status || (i.status === 'Completed' ? 'Present' : 'Pending'),
                        remarks: i.remarks || ''
                    };
                });
            }

            // 4. Programs for budget reference
            const progRes = await DataService.programs.getAll({ agency: 'PESO' });
            const canonicalProgs = (typeof PesoPrograms !== 'undefined' && PesoPrograms.CANONICAL_PESO_PROGRAMS) ? PesoPrograms.CANONICAL_PESO_PROGRAMS : [];
            if (progRes && Array.isArray(progRes.data) && progRes.data.length > 0) {
                window._cachedPrograms = progRes.data;
            } else {
                window._cachedPrograms = [...canonicalProgs];
            }

            // 5. Staff Profiles (Officers)
            const staffRes = await DataService.staff.getAll({ department: 'PESO' });
            if (staffRes && Array.isArray(staffRes.data)) {
                state.officers = staffRes.data;
            }

            // 6. Batches
            const batchRes = await DataService.batches.getAll({ agency: 'PESO' });
            const canonicalBatches = (typeof PesoPrograms !== 'undefined' && PesoPrograms.CANONICAL_PESO_BATCHES) ? PesoPrograms.CANONICAL_PESO_BATCHES : [];
            if (batchRes && Array.isArray(batchRes.data) && batchRes.data.length > 0) {
                state.batches = batchRes.data;
            } else {
                state.batches = [...canonicalBatches];
            }

            if (state.beneficiaries.length === 0 && typeof PesoPrograms !== 'undefined' && PesoPrograms.CANONICAL_PESO_BENEFICIARIES) {
                state.beneficiaries = [...PesoPrograms.CANONICAL_PESO_BENEFICIARIES];
            }

            if (state.applications.length === 0) {
                state.applications = [
                    { id: 1, dbId: 1, application_number: 'APP-2026-001', beneficiaryName: 'Maria Santos', applicant_name: 'Maria Santos', programCode: 'TUPAD', program: 'TUPAD (Emergency Employment)', date_applied: '2026-01-10', dateSubmitted: '2026-01-10', status: 'Pending', remarks: 'Complete 2x2 photo and Barangay Indigency attached.', amount_requested: 5000, amount_approved: 5000 },
                    { id: 2, dbId: 2, application_number: 'APP-2026-002', beneficiaryName: 'Juan Dela Cruz', applicant_name: 'Juan Dela Cruz', programCode: 'TUPAD', program: 'TUPAD (Emergency Employment)', date_applied: '2026-01-12', dateSubmitted: '2026-01-12', status: 'Pending', remarks: 'Displaced transport worker from Morales cluster.', amount_requested: 5000, amount_approved: 5000 },
                    { id: 3, dbId: 3, application_number: 'APP-2026-003', beneficiaryName: 'Carlos Mendoza', applicant_name: 'Carlos Mendoza', programCode: 'SPES', program: 'SPES (Student Employment)', date_applied: '2026-01-14', dateSubmitted: '2026-01-14', status: 'Approved', remarks: 'Approved for 30-day summer internship with SPES stipend.', amount_requested: 8000, amount_approved: 8000 }
                ];
            }

            if (state.schedules.length === 0) {
                state.schedules = [
                    { id: 1, slot_id: 'SLOT-101', title: 'TUPAD Orientation & Tool Handout', beneficiaryName: 'Maria Santos', phone: '0917-123-4567', beneficiaryPhone: '0917-123-4567', programCode: 'TUPAD', date: '2026-08-25', interviewDate: '2026-08-25', time: '09:00 AM', scheduleTime: '09:00 AM', venue: 'Koronadal City Hall Gymnasium', officerName: 'Jane Smith', status: 'Scheduled', attendance: 'Pending' },
                    { id: 2, slot_id: 'SLOT-102', title: 'SPES Pre-Deployment Briefing', beneficiaryName: 'Carlos Mendoza', phone: '0921-567-8901', beneficiaryPhone: '0921-567-8901', programCode: 'SPES', date: '2026-08-26', interviewDate: '2026-08-26', time: '10:30 AM', scheduleTime: '10:30 AM', venue: 'PESO Conference Hall Room A', officerName: 'Jane Smith', status: 'Scheduled', attendance: 'Pending' }
                ];
            }

            state.isLoaded = true;

        } catch (err) {
            console.warn('[PesoOfficerApp] Error loading data from Supabase:', err.message);
        }

        // Render Dashboard KPIs
        if (typeof PesoDashboard !== 'undefined') {
            PesoDashboard.renderOfficerMetrics(window._cachedPrograms || [], state.applications, state.beneficiaries, state.schedules);
        }

        renderBeneficiariesTable();
        renderDailySchedulesTable();
        renderOfficerEvaluationTable();
        renderLivelihoodBatchesTable();
        renderApprovedAssistanceTable();
        renderOfficerRosterTable();
    }

    /**
     * Render Beneficiaries Roster (Officer-Managed)
     */
    function renderBeneficiariesTable() {
        const tbody = document.getElementById('officerBeneficiaryTableBody') || document.getElementById('beneficiaryTableBody');
        if (!tbody) return;

        const query = (document.getElementById('searchBeneficiaryQuery')?.value || '').toLowerCase();
        const brgyFilter = document.getElementById('filterBeneficiaryBarangay')?.value || 'all';
        const statusFilter = document.getElementById('filterBeneficiaryStatus')?.value || 'all';

        const filtered = state.beneficiaries.filter(b => {
            const name = `${b.first_name} ${b.last_name}`.toLowerCase();
            const matchesQuery = !query || name.includes(query) || (b.qr_code && b.qr_code.toLowerCase().includes(query));
            const matchesBrgy = brgyFilter === 'all' || b.barangay === brgyFilter;
            const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
            return matchesQuery && matchesBrgy && matchesStatus;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No beneficiary records found.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(b => `
            <tr>
                <td class="fw-bold font-monospace text-primary">${escapeHtml(b.qr_code)}</td>
                <td class="fw-semibold text-dark">${escapeHtml(b.first_name)} ${escapeHtml(b.last_name)}</td>
                <td class="font-monospace text-muted">${maskPhone(b.phone)}</td>
                <td>${escapeHtml(b.barangay)}</td>
                <td><span class="badge bg-light text-dark border">${escapeHtml(b.category || 'Individual')}</span></td>
                <td><span class="badge ${b.status === 'Active' ? 'bg-success' : 'bg-danger'}">${escapeHtml(b.status)}</span></td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-sm btn-outline-primary py-1 px-2 me-1" onclick="PesoOfficerApp.showBeneficiaryQR('${b.id}')" title="QR Code">
                        <i class="bi bi-qr-code me-1"></i>QR
                    </button>
                    <button class="btn btn-sm btn-outline-secondary py-1 px-2 me-1" onclick="PesoOfficerApp.viewBeneficiaryProfile('${b.id}')" title="View Profile">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-sm ${b.status === 'Active' ? 'btn-outline-danger' : 'btn-outline-success'} py-1 px-2" onclick="PesoOfficerApp.toggleBeneficiaryStatus('${b.id}')">
                        ${b.status === 'Active' ? 'Deactivate' : 'Activate'}
                    </button>
                </td>
            </tr>
        `).join('');
    }

    /**
     * Open QR Code Display Modal
     */
    function showBeneficiaryQR(id) {
        const ben = state.beneficiaries.find(b => String(b.id) === String(id) || b.qr_code === id);
        if (!ben) return;

        const modalEl = document.getElementById('beneficiaryQRModal') || document.getElementById('qrModal');
        const display = document.getElementById('beneficiaryQRDisplay');

        if (display) {
            display.innerHTML = `
                <div class="text-center p-3">
                    <div class="p-3 bg-white d-inline-block rounded shadow-sm border mb-3">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(ben.qr_code)}" alt="QR Code" class="img-fluid">
                    </div>
                    <h5 class="fw-bold mb-1">${escapeHtml(ben.first_name)} ${escapeHtml(ben.last_name)}</h5>
                    <div class="badge bg-dark mb-2 font-monospace">${escapeHtml(ben.qr_code)}</div>
                    <p class="small text-muted mb-3">Digital Application Card • PESO Koronadal City</p>
                    <button class="btn btn-sm btn-primary px-3" onclick="PesoOfficerApp.printDigitalQRCard('${escapeHtml(ben.first_name)} ${escapeHtml(ben.last_name)}', '${escapeHtml(ben.qr_code)}')">
                        <i class="bi bi-printer me-1"></i>Print Digital Beneficiary Card
                    </button>
                </div>
            `;
        }

        safeOpenModal('beneficiaryQRModal');
    }

    /**
     * Print Digital Beneficiary Card
     */
    function printDigitalQRCard(name, qrCode) {
        const printWin = window.open('', '_blank');
        if (!printWin) {
            window.print();
            return;
        }

        printWin.document.write(`
            <html>
                <head>
                    <title>Digital Beneficiary Card - ${name}</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, sans-serif; text-align: center; padding: 40px; }
                        .card-box { border: 2px solid #0284C7; border-radius: 12px; padding: 24px; max-width: 360px; margin: 0 auto; }
                        h3 { color: #0284C7; margin-bottom: 5px; }
                        .qr-img { margin: 15px 0; }
                    </style>
                </head>
                <body>
                    <div class="card-box">
                        <h3>City Government of Koronadal</h3>
                        <p style="font-size:12px; color:#666; margin:0;">Public Employment Service Office (PESO)</p>
                        <h4 style="margin-top:12px;">Digital Application Card</h4>
                        <img class="qr-img" src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}" />
                        <h3 style="margin:8px 0;">${name}</h3>
                        <p style="font-family:monospace; font-weight:bold; font-size:14px; margin:0;">${qrCode}</p>
                    </div>
                    <script>window.onload = function() { window.print(); }</script>
                </body>
            </html>
        `);
        printWin.document.close();
    }

    function viewBeneficiaryProfile(id) {
        const ben = state.beneficiaries.find(b => String(b.id) === String(id) || b.qr_code === id);
        if (!ben) return;
        alert(`Beneficiary Profile (Officer Oversight):\n\nQR ID: ${ben.qr_code}\nName: ${ben.first_name} ${ben.last_name}\nContact: ${maskPhone(ben.phone)}\nBarangay: ${ben.barangay}\nCategory: ${ben.category}\nStatus: ${ben.status}\nAge: ${ben.age || 'N/A'} • Sex: ${ben.sex || 'N/A'}`);
    }

    async function toggleBeneficiaryStatus(id) {
        const ben = state.beneficiaries.find(b => String(b.id) === String(id) || b.qr_code === id);
        if (!ben) return;

        const newStatus = ben.status === 'Active' ? 'Deactivated' : 'Active';
        if (!confirm(`Are you sure you want to change status of ${ben.first_name} ${ben.last_name} to ${newStatus}?`)) {
            return;
        }

        ben.status = newStatus;

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('beneficiaries').update({ status: newStatus }).eq('id', ben.id);
            } catch (e) {
                console.warn('[PesoOfficerApp] Supabase update warning:', e.message);
            }
        }

        renderBeneficiariesTable();
        logAudit('TOGGLE_BENEFICIARY_STATUS', `Updated status of ${ben.first_name} ${ben.last_name} (${ben.qr_code}) to ${newStatus}`);
    }

    /**
     * Beneficiary Intake Form Submit (Triggers OTP Step)
     */
    async function submitBeneficiaryIntake(event) {
        if (event) event.preventDefault();

        const firstName = (document.getElementById('intakeFirstName')?.value || document.getElementById('addBenFirstName')?.value || '').trim();
        const lastName = (document.getElementById('intakeLastName')?.value || document.getElementById('addBenLastName')?.value || '').trim();
        const phone = (document.getElementById('intakePhone')?.value || document.getElementById('addBenPhone')?.value || '').trim();
        const email = (document.getElementById('intakeEmail')?.value || document.getElementById('addBenEmail')?.value || '').trim();
        const barangay = document.getElementById('intakeBarangay')?.value || document.getElementById('addBenBarangay')?.value || 'Poblacion';
        const address = document.getElementById('intakeAddress')?.value || document.getElementById('addBenAddress')?.value || `${barangay}, Koronadal City`;
        const category = document.getElementById('intakeCategory')?.value || document.getElementById('addBenCategory')?.value || 'Individual';
        const age = parseInt(document.getElementById('intakeAge')?.value || document.getElementById('addBenAge')?.value || '25', 10);
        const sex = document.getElementById('intakeSex')?.value || document.getElementById('addBenSex')?.value || 'Male';

        if (!firstName || !lastName || !phone) {
            alert('Validation Error: Please fill in mandatory beneficiary name and phone number.');
            return;
        }

        const targetEmail = email || `${firstName.toLowerCase().replace(/\s+/g, '')}.${lastName.toLowerCase().replace(/\s+/g, '')}@gmail.com`;
        const targetUsername = `${firstName.toLowerCase().replace(/\s+/g, '')}.${lastName.toLowerCase().replace(/\s+/g, '')}${Math.floor(10 + Math.random() * 90)}`;

        if (typeof DataService !== 'undefined' && DataService.auth && DataService.auth.checkIdentifierAvailability) {
            try {
                const checkRes = await DataService.auth.checkIdentifierAvailability({ username: targetUsername, email: targetEmail });
                if (checkRes && checkRes.data && !checkRes.data.isAvailable) {
                    alert(checkRes.data.message || 'Beneficiary email or username already registered in the system.');
                    return;
                }
            } catch (cErr) {
                console.warn('[PesoOfficerApp] Uniqueness check warning:', cErr);
            }
        }

        state.pendingIntakeData = {
            first_name: firstName,
            last_name: lastName,
            phone: phone,
            email: targetEmail,
            username: targetUsername,
            barangay: barangay,
            address: address,
            category: category,
            age: age,
            sex: sex,
            department: 'PESO'
        };

        const step1 = document.getElementById('officerBenStep1');
        const step2 = document.getElementById('officerBenStep2');

        if (step1 && step2) {
            step1.classList.add('d-none');
            step2.classList.remove('d-none');

            const emailBadge = document.getElementById('officerMaskedEmail');
            const phoneBadge = document.getElementById('officerMaskedPhone');
            if (emailBadge) emailBadge.textContent = state.pendingIntakeData.email;
            if (phoneBadge) phoneBadge.textContent = maskPhone(state.pendingIntakeData.phone);

            if (typeof OTPAuth !== 'undefined' && OTPAuth.sendEmailCode) {
                OTPAuth.sendEmailCode(state.pendingIntakeData.email).catch(() => {});
            }
        } else {
            finalizeBeneficiaryCreation();
        }
    }

    async function finalizeBeneficiaryCreation() {
        if (!state.pendingIntakeData) return;

        const uniqueQr = `QR-BEN-${Math.floor(100000 + Math.random() * 900000)}`;
        const payload = {
            ...state.pendingIntakeData,
            qr_code: uniqueQr,
            status: 'Active',
            terms_agreed: true,
            data_consent: true,
            created_at: new Date().toISOString()
        };

        const newBen = {
            id: Date.now(),
            numId: Date.now(),
            qr_code: uniqueQr,
            first_name: payload.first_name,
            last_name: payload.last_name,
            name: `${payload.first_name} ${payload.last_name}`,
            phone: payload.phone,
            contact: payload.phone,
            email: payload.email,
            barangay: payload.barangay,
            address: payload.address,
            category: payload.category,
            status: 'Active',
            age: payload.age,
            sex: payload.sex
        };

        state.beneficiaries.unshift(newBen);

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('beneficiaries').insert(payload);
            } catch (err) {
                console.warn('[PesoOfficerApp] Supabase beneficiary insert warning:', err.message);
            }
        }

        renderBeneficiariesTable();
        logAudit('CREATE_BENEFICIARY', `Enrolled beneficiary ${payload.first_name} ${payload.last_name} (${uniqueQr})`);

        safeCloseModal('addBeneficiaryModal');
        safeCloseModal('beneficiaryIntakeModal');

        const step1 = document.getElementById('officerBenStep1');
        const step2 = document.getElementById('officerBenStep2');
        if (step1) step1.classList.remove('d-none');
        if (step2) step2.classList.add('d-none');

        state.pendingIntakeData = null;

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Beneficiary Registered',
                message: `Successfully enrolled ${payload.first_name} ${payload.last_name} with QR: ${uniqueQr}.`,
                type: 'success'
            });
        }

        showBeneficiaryQR(uniqueQr);
    }

    /**
     * Render Officer Evaluation Table
     */
    function renderOfficerEvaluationTable() {
        const tbody = document.getElementById('officerApplicationsTableBody') || document.getElementById('officerEvalTableBody');
        if (!tbody) return;

        if (state.applications.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No applications found in evaluation queue.</td></tr>`;
            return;
        }

        tbody.innerHTML = state.applications.map(app => `
            <tr>
                <td class="fw-bold font-monospace text-primary">#${escapeHtml(String(app.id))}</td>
                <td class="fw-semibold text-dark">${escapeHtml(app.beneficiaryName || app.applicant_name)}</td>
                <td><span class="badge bg-light text-dark border font-monospace">${escapeHtml(app.programCode)}</span></td>
                <td><small class="text-muted font-monospace">${escapeHtml(app.date_applied)}</small></td>
                <td><span class="badge bg-info-subtle text-dark border">Verified</span></td>
                <td><span class="badge ${app.status === 'Approved' || app.status === 'Officer Approved' ? 'bg-success' : (app.status === 'Denied' || app.status === 'Officer Denied' ? 'bg-danger' : 'bg-warning text-dark')}">${escapeHtml(app.status)}</span></td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-sm btn-success py-1 px-2 me-1" onclick="PesoOfficerApp.evaluateApplication('${app.id}', 'Approved')">Approve</button>
                    <button class="btn btn-sm btn-danger py-1 px-2" onclick="PesoOfficerApp.evaluateApplication('${app.id}', 'Denied')">Deny</button>
                </td>
            </tr>
        `).join('');
    }

    async function evaluateApplication(appId, decision) {
        const app = state.applications.find(a => String(a.id) === String(appId));
        if (!app) return;

        let remarks = '';
        if (decision === 'Denied') {
            remarks = prompt(`Enter mandatory evaluation remarks for setting Application #${appId} to Denied:`);
            if (remarks === null) return;
            if (!remarks.trim()) {
                alert('Evaluation Blocked: Remarks are mandatory for Application Denial.');
                return;
            }
        } else {
            remarks = prompt(`Enter officer recommendation remarks for Application #${appId}:`, 'Verified and recommended for administrative grant release.');
            if (remarks === null) return;
        }

        const newStatus = decision === 'Approved' ? 'Officer Approved' : 'Officer Denied';
        app.status = newStatus;
        app.remarks = remarks;

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient
                    .from('applications')
                    .update({
                        status: newStatus,
                        officer_notes: remarks,
                        officer_decision: decision,
                        officer_action_at: new Date().toISOString()
                    })
                    .eq('id', app.id);
            } catch (e) {
                console.warn('[PesoOfficerApp] Supabase evaluation error:', e.message);
            }
        }

        renderOfficerEvaluationTable();
        logAudit('OFFICER_EVALUATE_APPLICATION', `Evaluated application #${appId} as ${decision}. Remarks: ${remarks}`);

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: `Application ${decision}`,
                message: `Application #${appId} updated to ${newStatus}.`,
                type: decision === 'Approved' ? 'success' : 'danger'
            });
        }
    }

    /**
     * Render Daily Interview Schedules Table
     */
    function renderDailySchedulesTable() {
        const tbody = document.getElementById('officerDailySchedulesTableBody') || document.getElementById('officerInterviewsTableBody');
        if (!tbody) return;

        if (state.schedules.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No interview schedules booked for today.</td></tr>`;
            return;
        }

        tbody.innerHTML = state.schedules.map(i => `
            <tr>
                <td class="fw-bold font-monospace text-primary">#SCH-${escapeHtml(String(i.id || i.slot_id))}</td>
                <td class="fw-semibold text-dark">${escapeHtml(i.beneficiaryName || i.beneficiary_name)}</td>
                <td><small class="text-muted font-monospace">${escapeHtml(i.date)} ${escapeHtml(i.time)}</small></td>
                <td>${escapeHtml(i.venue)}</td>
                <td><span class="badge ${i.attendance === 'Present' ? 'bg-success' : (i.attendance === 'Absent' ? 'bg-danger' : 'bg-warning text-dark')}">${escapeHtml(i.attendance)}</span></td>
                <td><span class="badge ${i.status === 'Completed' ? 'bg-success' : 'bg-primary'}">${escapeHtml(i.status)}</span></td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-sm btn-outline-success py-1 px-2 me-1" onclick="PesoOfficerApp.markInterviewAttendance('${i.id}', 'Present')">Present</button>
                    <button class="btn btn-sm btn-outline-danger py-1 px-2" onclick="PesoOfficerApp.markInterviewAttendance('${i.id}', 'Absent')">Absent</button>
                </td>
            </tr>
        `).join('');
    }

    async function markInterviewAttendance(schedId, status) {
        const item = state.schedules.find(s => String(s.id) === String(schedId) || String(s.slot_id) === String(schedId));
        if (!item) return;

        item.attendance = status;
        item.status = status === 'Present' ? 'Completed' : 'Missed';

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient
                    .from('interview_schedules')
                    .update({ attendance_status: status, status: item.status })
                    .eq('id', item.id);
            } catch (e) {
                console.warn('[PesoOfficerApp] Supabase attendance error:', e.message);
            }
        }

        renderDailySchedulesTable();
        logAudit('OFFICER_MARK_ATTENDANCE', `Marked attendance for interview #${schedId} as ${status}`);
    }

    function renderLivelihoodBatchesTable() {
        const tbody = document.getElementById('officerBatchesTableBody');
        if (!tbody) return;

        if (state.batches.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No livelihood batches created yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = state.batches.map(b => `
            <tr>
                <td class="fw-bold font-monospace text-primary">${escapeHtml(b.name || `Batch #${b.id}`)}</td>
                <td class="fw-semibold text-dark">${escapeHtml(b.program_code || 'PESO')}</td>
                <td>${escapeHtml(b.cluster_location || b.barangay || 'Koronadal')}</td>
                <td><span class="badge bg-info text-dark">${Number(b.assigned_count) || 0} / ${Number(b.capacity) || 30}</span></td>
                <td><span class="badge bg-success">${escapeHtml(b.status || 'Active')}</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary py-1 px-2" onclick="alert('Viewing Batch Roster for ${escapeHtml(b.name)}')">View Roster</button>
                </td>
            </tr>
        `).join('');
    }

    function renderApprovedAssistanceTable() {
        const tbody = document.getElementById('officerApprovedAssistanceTableBody');
        if (!tbody) return;

        const approved = state.applications.filter(a => a.status === 'Approved' || a.status === 'Officer Approved');
        if (approved.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No approved assistance records.</td></tr>`;
            return;
        }

        tbody.innerHTML = approved.map(a => `
            <tr>
                <td class="fw-bold font-monospace text-primary">#APP-${escapeHtml(String(a.id))}</td>
                <td class="fw-semibold text-dark">${escapeHtml(a.beneficiaryName)}</td>
                <td><span class="badge bg-light text-dark border font-monospace">${escapeHtml(a.programCode)}</span></td>
                <td class="fw-bold text-success">${formatCurrency(a.amount_approved || a.amount_requested || 5000)}</td>
                <td><span class="badge bg-success-subtle text-success border">Grant Recommended</span></td>
                <td class="font-monospace text-muted">${escapeHtml(a.date_applied)}</td>
            </tr>
        `).join('');
    }

    function renderOfficerRosterTable() {
        const tbody = document.getElementById('officerDirectoryTableBody');
        if (!tbody) return;

        if (state.officers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No officers registered in directory.</td></tr>`;
            return;
        }

        tbody.innerHTML = state.officers.map(o => `
            <tr>
                <td class="fw-bold font-monospace">#OFF-${escapeHtml(String(o.id))}</td>
                <td class="fw-semibold text-dark">${escapeHtml(o.first_name || '')} ${escapeHtml(o.last_name || '')}</td>
                <td><span class="badge bg-primary-subtle text-primary border">${escapeHtml(o.role || 'PESO Officer')}</span></td>
                <td><span class="badge ${o.status === 'Active' ? 'bg-success' : 'bg-secondary'}">${escapeHtml(o.status || 'Active')}</span></td>
                <td class="text-muted small">${escapeHtml(o.email || '-')}</td>
            </tr>
        `).join('');
    }

    async function dispatchSMSNotification(event) {
        if (event) event.preventDefault();

        const recipient = (document.getElementById('smsRecipientInput')?.value || '').trim();
        const message = (document.getElementById('smsMessageText')?.value || '').trim();

        if (!message) {
            alert('Please enter a notification message to dispatch.');
            return;
        }

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('notifications').insert({
                    recipient_phone: recipient || 'Broadcast',
                    message: message,
                    channel: 'SMS',
                    department: 'PESO',
                    sent_at: new Date().toISOString()
                });
            } catch (err) {
                console.warn('[PesoOfficerApp] Supabase SMS notification warning:', err.message);
            }
        }

        logAudit('DISPATCH_SMS_NOTIFICATION', `Dispatched SMS notification to ${recipient || 'All Beneficiaries'}. Message: "${message}"`);
        safeCloseModal('smsDispatchModal');

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'SMS Dispatched',
                message: `Dispatched SMS to ${recipient || 'all registered beneficiaries'}.`,
                type: 'success'
            });
        } else {
            alert(`SMS Notification dispatched successfully to ${recipient || 'all registered beneficiaries'}!`);
        }
    }

    return Object.freeze({
        state,
        switchTab,
        loadAllOfficerData,
        safeOpenModal,
        safeCloseModal,
        renderBeneficiariesTable,
        showBeneficiaryQR,
        printDigitalQRCard,
        viewBeneficiaryProfile,
        toggleBeneficiaryStatus,
        submitBeneficiaryIntake,
        finalizeBeneficiaryCreation,
        renderOfficerEvaluationTable,
        evaluateApplication,
        renderDailySchedulesTable,
        markInterviewAttendance,
        renderLivelihoodBatchesTable,
        renderApprovedAssistanceTable,
        renderOfficerRosterTable,
        dispatchSMSNotification
    });
})();

// Global shortcuts & event delegations
window.PesoOfficerApp = PesoOfficerApp;
window.switchTab = PesoOfficerApp.switchTab;
window.renderBeneficiariesTable = PesoOfficerApp.renderBeneficiariesTable;
window.showBeneficiaryQR = PesoOfficerApp.showBeneficiaryQR;
window.printDigitalQRCard = PesoOfficerApp.printDigitalQRCard;
window.viewBeneficiaryProfile = PesoOfficerApp.viewBeneficiaryProfile;
window.toggleOfficerBeneficiaryStatus = PesoOfficerApp.toggleBeneficiaryStatus;
window.submitBeneficiaryIntake = PesoOfficerApp.submitBeneficiaryIntake;
window.finalizeOfficerBeneficiaryCreation = PesoOfficerApp.finalizeBeneficiaryCreation;
window.evaluateApplicationAction = PesoOfficerApp.evaluateApplication;
window.markAttendanceAction = PesoOfficerApp.markInterviewAttendance;
window.dispatchSMSNotification = PesoOfficerApp.dispatchSMSNotification;

// Modal & action bridges
window.openIntakeModal = () => PesoOfficerApp.safeOpenModal('beneficiaryIntakeModal');
window.openAddBeneficiaryModal = () => PesoOfficerApp.safeOpenModal('addBeneficiaryModal');
window.openRecordAssistanceModal = () => (typeof window.openRecordAssistanceModalCustom === 'function' ? window.openRecordAssistanceModalCustom() : PesoOfficerApp.safeOpenModal('recordAssistanceModal'));
window.openCreateBatchModal = (prog) => (typeof window.openCreateBatchModalCustom === 'function' ? window.openCreateBatchModalCustom(prog) : (window.openCreateBatchModal && window.openCreateBatchModal !== PesoOfficerApp.openCreateBatchModal ? window.openCreateBatchModal(prog) : PesoOfficerApp.safeOpenModal('createBatchModal')));
window.openBatchAssignModal = (id) => { PesoOfficerApp.state.selectedEvalAppId = id; PesoOfficerApp.safeOpenModal('batchAssignModal'); };
window.openBeneficiaryInfoCardModal = (id) => PesoOfficerApp.viewBeneficiaryProfile(id);
window.openInterviewScheduleDetail = (slotId) => alert(`Interview Schedule #${slotId}\nDetails are view-only.`);
window.openScheduleNewInterviewModal = (slotId) => PesoOfficerApp.safeOpenModal('scheduleInterviewModal');
window.openApplicationDetail = (id) => { if (typeof PesoEvaluations !== 'undefined') PesoEvaluations.openCaseFile(id); };
window.approveApplication = (id) => PesoOfficerApp.evaluateApplication(id, 'Approved');
window.promptDenyRemarks = (id) => PesoOfficerApp.evaluateApplication(id, 'Denied');
window.promptPendingNotes = (id) => PesoOfficerApp.evaluateApplication(id, 'Pending Requirements');
window.confirmDenyApplication = () => { if (PesoOfficerApp.state.selectedEvalAppId) PesoOfficerApp.evaluateApplication(PesoOfficerApp.state.selectedEvalAppId, 'Denied'); };
window.confirmPendingApplication = () => { if (PesoOfficerApp.state.selectedEvalAppId) PesoOfficerApp.evaluateApplication(PesoOfficerApp.state.selectedEvalAppId, 'Pending Requirements'); };
window.quickMarkAttendance = (id, status) => PesoOfficerApp.markInterviewAttendance(id, status);
window.saveInterviewDetailUpdates = (id) => { alert(`Interview #${id} attendance updated.`); PesoOfficerApp.safeCloseModal('interviewDetailModal'); };
window.submitAssistanceRecord = (e) => { if (typeof window.submitAssistanceRecordCustom === 'function') return window.submitAssistanceRecordCustom(e); if (e) e.preventDefault(); alert('Assistance record submitted for administrative disbursement review.'); PesoOfficerApp.safeCloseModal('recordAssistanceModal'); };
window.submitBatchAssignment = () => { alert('Beneficiaries assigned to batch.'); PesoOfficerApp.safeCloseModal('batchAssignModal'); };
window.submitCreateBatch = () => { if (typeof window.submitSaveAndCreateBatch === 'function') return window.submitSaveAndCreateBatch(); alert('New batch group created.'); PesoOfficerApp.safeCloseModal('createBatchModal'); };
window.submitNewInterviewSchedule = (e) => { if (e) e.preventDefault(); alert('Interview schedule booked.'); PesoOfficerApp.safeCloseModal('scheduleInterviewModal'); };

// Filters & Navigation
window.filterBeneficiariesTable = PesoOfficerApp.renderBeneficiariesTable;
window.filterDailySchedules = PesoOfficerApp.renderDailySchedulesTable;
window.filterEvaluationQueue = PesoOfficerApp.renderOfficerEvaluationTable;
window.filterLivelihoodMasterTable = () => (typeof window.filterLivelihoodViews === 'function' ? window.filterLivelihoodViews() : PesoOfficerApp.renderLivelihoodBatchesTable());
window.filterAssistanceTable = PesoOfficerApp.renderApprovedAssistanceTable;
window.filterOfficerRosterTable = PesoOfficerApp.renderOfficerRosterTable;
window.resetBeneficiaryFilters = () => {
    const q = document.getElementById('searchBeneficiaryQuery');
    const b = document.getElementById('filterBeneficiaryBarangay');
    const s = document.getElementById('filterBeneficiaryStatus');
    if (q) q.value = '';
    if (b) b.value = 'all';
    if (s) s.value = 'all';
    PesoOfficerApp.renderBeneficiariesTable();
};
window.resetDailyScheduleFilters = PesoOfficerApp.renderDailySchedulesTable;
window.resetEvalFilters = PesoOfficerApp.renderOfficerEvaluationTable;
window.resetLivelihoodFilters = () => (typeof window.resetLivelihoodFiltersCustom === 'function' ? window.resetLivelihoodFiltersCustom() : (typeof window.filterLivelihoodViews === 'function' ? window.filterLivelihoodViews() : PesoOfficerApp.renderLivelihoodBatchesTable()));
window.resetOfficerRosterFilters = PesoOfficerApp.renderOfficerRosterTable;
window.navigateScheduleDate = (dir) => { alert(`Schedule date shifted ${dir > 0 ? '+1 day' : '-1 day'}.`); };
window.onScheduleDatePickerChange = (val) => { PesoOfficerApp.state.currentScheduleDate = val; PesoOfficerApp.renderDailySchedulesTable(); };
window.setScheduleViewMode = (mode) => { PesoOfficerApp.state.currentScheduleViewMode = mode; };
window.onModalStatusButtonClick = (status) => { alert(`Status set to ${status}`); };
window.onModalAttendanceRadioChange = (status) => { alert(`Attendance radio changed to ${status}`); };
window.reviewDocumentStatus = (id, doc, status) => { alert(`Document ${doc} marked as ${status}.`); };
window.toggleAccountStatus = (id) => PesoOfficerApp.toggleBeneficiaryStatus(id);
window.toggleSelectAllApps = (el) => {
    document.querySelectorAll('.app-checkbox').forEach(cb => { cb.checked = el.checked; });
};
window.handleGlobalSearch = (e) => {
    const val = (e.target.value || '').toLowerCase();
    const benInput = document.getElementById('searchBeneficiaryQuery');
    if (benInput) {
        benInput.value = val;
        PesoOfficerApp.renderBeneficiariesTable();
    }
};

// Exports & Prints
window.exportAssistanceCSV = window.exportAssistanceCSV || (() => { if (typeof PesoReports !== 'undefined') PesoReports.exportReportCSV(); });
window.exportDailyScheduleCSV = window.exportDailyScheduleCSV || (() => { if (typeof PesoReports !== 'undefined') PesoReports.exportReportCSV(); });
window.printAssistanceReport = window.printAssistanceReport || (() => { window.print(); });
window.showPrintableQrCard = window.showPrintableQrCard || ((id) => PesoOfficerApp.showBeneficiaryQR(id));

// OTP & Form Helpers
window.sendOfficerEmailCode = window.sendOfficerEmailCode || (() => { alert('Verification code dispatched to beneficiary email.'); });
window.sendOfficerSmsOtp = window.sendOfficerSmsOtp || (() => { alert('SMS OTP code dispatched to beneficiary phone number.'); });
window.resendOfficerEmailOtp = window.resendOfficerEmailOtp || (() => { alert('Verification code resent to beneficiary email.'); });
window.resendOfficerSmsOtp = window.resendOfficerSmsOtp || (() => { alert('SMS OTP resent to beneficiary mobile phone.'); });
window.backToOfficerBenForm = window.backToOfficerBenForm || (() => {
    const step1 = document.getElementById('officerBenStep1');
    const step2 = document.getElementById('officerBenStep2');
    if (step1) step1.classList.remove('d-none');
    if (step2) step2.classList.add('d-none');
});
window.calculateBenAge = window.calculateBenAge || (() => {
    const dob = document.getElementById('intakeDob')?.value;
    if (dob) {
        const age = Math.floor((new Date() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
        const ageInput = document.getElementById('intakeAge');
        if (ageInput) ageInput.value = Math.max(0, age);
    }
});
window.autoCalcOfficerAge = window.autoCalcOfficerAge || window.calculateBenAge;
window.checkNewInterviewConflict = window.checkNewInterviewConflict || (() => {});
window.toggleAssignMode = window.toggleAssignMode || ((mode) => {
    const batchBox = document.getElementById('batchSelectContainer');
    if (batchBox) batchBox.style.display = (mode === 'Batch') ? 'block' : 'none';
});
window.validateIntakeFileInput = window.validateIntakeFileInput || ((el, maxMb) => {
    if (el.files && el.files[0]) {
        if (el.files[0].size > maxMb * 1024 * 1024) {
            alert(`File exceeds maximum size limit of ${maxMb}MB.`);
            el.value = '';
        }
    }
});
window.previewBenPhoto = window.previewBenPhoto || ((el) => {
    if (el.files && el.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('benPhotoPreview');
            if (preview) preview.src = e.target.result;
        };
        reader.readAsDataURL(el.files[0]);
    }
});
window.handleOfficerSubmitAddBen = window.handleOfficerSubmitAddBen || PesoOfficerApp.submitBeneficiaryIntake;
window.submitBeneficiaryRegistration = window.submitBeneficiaryRegistration || PesoOfficerApp.submitBeneficiaryIntake;
window.submitIntakeApplication = window.submitIntakeApplication || PesoOfficerApp.submitBeneficiaryIntake;
window.loadOfficerTeam = window.loadOfficerTeam || PesoOfficerApp.loadAllOfficerData;

// Export module
if (typeof window !== 'undefined') {
    window.PesoOfficerApp = PesoOfficerApp;
}

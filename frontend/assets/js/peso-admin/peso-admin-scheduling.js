/**
 * PESO Admin Portal - Scheduling Management Module (Tab 3)
 * Module: Scheduling (peso-admin-scheduling.js)
 */

let activitiesList = [];
let adminScheduleViewMode = 'calendar'; // 'calendar' or 'list'
let currentCalendarYear = 2026;
let currentCalendarMonth = 7; // August (0-indexed: 7 = August)
let focusedCalendarDay = 8;
let activeViewingActivityId = null;

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

async function initSchedulingData() {
    await initSchedulingModuleData();
    if (typeof initAlarmEngine === 'function') initAlarmEngine();
}

async function initSchedulingModuleData() {
    if (typeof DataService !== 'undefined' && DataService.interviews) {
        try {
            const res = await DataService.interviews.getAll({ agency: 'PESO' });
            if (res.data && Array.isArray(res.data)) {
                activitiesList = res.data.map(i => ({
                    id: i.id,
                    slot_id: `SLOT-${i.id}`,
                    program_id: i.program_id,
                    program_code: (i.program && i.program.code) || 'PESO',
                    program_name: (i.program && i.program.name) || 'Livelihood Assistance',
                    program_sub_category: 'Program Activity',
                    barangay_cluster: 'Koronadal Central',
                    title: i.title || `${(i.program && i.program.code) || 'PESO'} Assessment Session`,
                    category: i.category || 'Interview',
                    date: i.scheduled_date || (i.scheduled_time ? i.scheduled_time.substring(0, 10) : '2026-08-15'),
                    start_datetime: i.scheduled_time || `${i.scheduled_date || '2026-08-15'}T09:00`,
                    end_datetime: `${i.scheduled_date || '2026-08-15'}T12:00`,
                    time: '09:00 AM - 12:00 PM',
                    schedule_time: '09:00 AM - 12:00 PM',
                    duration: '3 Hours',
                    venue: i.location || 'PESO Office, Koronadal City',
                    location: i.location || 'PESO Office, Koronadal City',
                    officer_id: i.officer_id,
                    officer_name: (i.officer && `${i.officer.first_name} ${i.officer.last_name}`) || 'Jane Smith',
                    assigned_officer_id: i.officer_id,
                    assigned_officer_name: (i.officer && `${i.officer.first_name} ${i.officer.last_name} (PESO Officer)`) || 'Jane Smith (PESO Officer)',
                    remarks: i.notes || '',
                    slot_status: i.status || 'Active',
                    status: i.status || 'Active',
                    is_locked: false,
                    lock_status: 'Unlocked',
                    scheduling_mode: i.beneficiary_qr ? 'Individual' : 'Unassigned',
                    beneficiary_name: i.beneficiary ? `${i.beneficiary.first_name} ${i.beneficiary.last_name}` : '',
                    beneficiary_phone: i.beneficiary ? i.beneficiary.contact_number : '',
                    attendance_status: i.status === 'Completed' ? 'Present' : (i.status === 'Cancelled' ? 'Cancelled' : 'Pending'),
                    batch_name: '',
                    batch_count: 0,
                    created_at: i.created_at || new Date().toISOString(),
                    created_by: 'PESO Admin',
                    updated_at: i.created_at || new Date().toISOString()
                }));
                renderSchedulingModule();
                populateSchedulingDropdowns();
                return;
            }
        } catch (e) {
            console.warn('[SCHEDULING] Supabase fetch notice:', e);
        }
    }
    activitiesList = [];
    populateSchedulingDropdowns();
    renderSchedulingModule();
}

function populateSchedulingDropdowns() {
    const progFilter = document.getElementById('schedProgramFilter');
    if (progFilter) {
        progFilter.innerHTML = '<option value="ALL">All Program Types</option>' +
            '<option value="TUPAD">TUPAD (Emergency Employment)</option>' +
            '<option value="SPES">SPES (Student Employment)</option>' +
            '<option value="PFAS">PFAS (Pangkabuhayan Special)</option>' +
            '<option value="CKGIP">CKGIP (Internship Program)</option>';
    }

    const offFilter = document.getElementById('schedOfficerFilter');
    const actOff = document.getElementById('actOfficer');
    const editActOff = document.getElementById('editActOfficer');

    const sourceOfficers = Array.isArray(officersList) && officersList.length > 0
        ? officersList
        : (Array.isArray(usersList) ? usersList.filter(u => u.role && (u.role.includes('Officer') || u.role === 'Staff')) : []);

    if (offFilter) {
        offFilter.innerHTML = '<option value="ALL">All Assigned Officers</option>';
        sourceOfficers.forEach(o => {
            const name = `${o.first_name} ${o.last_name}`;
            offFilter.innerHTML += `<option value="${escapeHtml(name)}">${escapeHtml(name)} (${o.role})</option>`;
        });
    }

    if (actOff) {
        actOff.innerHTML = '';
        sourceOfficers.forEach(o => {
            const name = `${o.first_name} ${o.last_name}`;
            actOff.innerHTML += `<option value="${o.id}" data-name="${escapeHtml(name)}">${escapeHtml(name)} (${o.role})</option>`;
        });
    }

    if (editActOff) {
        editActOff.innerHTML = '';
        sourceOfficers.forEach(o => {
            const name = `${o.first_name} ${o.last_name}`;
            editActOff.innerHTML += `<option value="${o.id}" data-name="${escapeHtml(name)}">${escapeHtml(name)} (${o.role})</option>`;
        });
    }
}

function setAdminScheduleViewMode(mode) {
    adminScheduleViewMode = mode;
    const btnCal = document.getElementById('adminBtnViewCalendar');
    const btnList = document.getElementById('adminBtnViewList');
    const calCol = document.querySelector('.col-12.col-xl-8');
    const panelCol = document.querySelector('.col-12.col-xl-4');

    if (mode === 'calendar') {
        if (btnCal) btnCal.classList.add('active');
        if (btnList) btnList.classList.remove('active');
        if (calCol) calCol.style.display = 'block';
        if (panelCol) {
            panelCol.className = 'col-12 col-xl-4';
        }
    } else {
        if (btnCal) btnCal.classList.remove('active');
        if (btnList) btnList.classList.add('active');
        if (calCol) calCol.style.display = 'none';
        if (panelCol) {
            panelCol.className = 'col-12';
        }
    }
    renderScheduledActivitiesPanel();
}

function renderSchedulingModule() {
    populateSchedulingDropdowns();
    updateSchedulingMetrics();
    renderCalendar();
    renderScheduledActivitiesPanel();
    renderSchedulingArchive();
}

function updateSchedulingMetrics() {
    const total = activitiesList.length;
    const active = activitiesList.filter(a => (a.slot_status === 'Active' || a.status === 'Active' || a.status === 'Ongoing' || a.status === 'Scheduled') && !a.is_locked).length;
    const locked = activitiesList.filter(a => a.is_locked || a.slot_status === 'Locked' || a.lock_status === 'Locked').length;
    const completed = activitiesList.filter(a => a.slot_status === 'Completed' || a.status === 'Completed').length;
    const cancelled = activitiesList.filter(a => a.slot_status === 'Cancelled' || a.status === 'Cancelled').length;
    const archived = cancelled + completed;

    if (document.getElementById('schedStatTotal')) document.getElementById('schedStatTotal').textContent = total;
    if (document.getElementById('schedStatActive')) document.getElementById('schedStatActive').textContent = active;
    if (document.getElementById('schedStatLocked')) document.getElementById('schedStatLocked').textContent = locked;
    if (document.getElementById('schedStatCompleted')) document.getElementById('schedStatCompleted').textContent = completed;
    if (document.getElementById('schedStatCancelled')) document.getElementById('schedStatCancelled').textContent = cancelled;
    if (document.getElementById('schedulingArchiveCountBadge')) document.getElementById('schedulingArchiveCountBadge').textContent = archived;
    if (document.getElementById('archiveBoxCountBadge')) document.getElementById('archiveBoxCountBadge').textContent = `${archived} Archived Slots`;
}

function renderCalendar() {
    const displayEl = document.getElementById('calendarMonthYearDisplay');
    if (displayEl) {
        displayEl.textContent = `${MONTH_NAMES[currentCalendarMonth]} ${currentCalendarYear}`;
    }

    const gridBody = document.getElementById('calendarGridBody');
    if (!gridBody) return;
    gridBody.innerHTML = '';

    const firstDayIndex = new Date(currentCalendarYear, currentCalendarMonth, 1).getDay();
    const daysInMonth = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
    const prevMonthDays = new Date(currentCalendarYear, currentCalendarMonth, 0).getDate();

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === currentCalendarYear && today.getMonth() === currentCalendarMonth;
    const todayDateNum = isCurrentMonth ? today.getDate() : 8;

    // 1. Previous month days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = prevMonthDays - i;
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell other-month';
        cell.innerHTML = `<div class="calendar-day-top"><span class="calendar-day-number">${dayNum}</span></div>`;
        gridBody.appendChild(cell);
    }

    // 2. Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        const isToday = (day === todayDateNum);
        const isFocused = (day === focusedCalendarDay);
        cell.className = `calendar-day-cell ${isToday ? 'today' : ''} ${isFocused ? 'selected-focus' : ''}`;
        cell.setAttribute('tabindex', '0');
        cell.setAttribute('data-day', day);
        cell.setAttribute('aria-label', `Day ${day} ${MONTH_NAMES[currentCalendarMonth]} ${currentCalendarYear}`);

        const dateStr = `${currentCalendarYear}-${String(currentCalendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        cell.innerHTML = `
            <div class="calendar-day-top">
                <span class="calendar-day-number ${isToday ? 'day-num-badge' : ''}">${day}</span>
                <button class="day-add-btn btn btn-sm" onclick="event.stopPropagation(); openCreateScheduleSlotModal('${dateStr}')" title="Create slot on this day">
                    <i class="bi bi-plus-circle"></i>
                </button>
            </div>
            <div class="calendar-events-container" id="dayEvents-${day}"></div>
        `;

        cell.addEventListener('click', () => {
            focusedCalendarDay = day;
            updateCalendarFocus(day);
        });

        gridBody.appendChild(cell);
    }

    // 3. Next month days
    const totalRendered = firstDayIndex + daysInMonth;
    const nextMonthCells = (totalRendered % 7 === 0) ? 0 : 7 - (totalRendered % 7);
    for (let j = 1; j <= nextMonthCells; j++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell other-month';
        cell.innerHTML = `<div class="calendar-day-top"><span class="calendar-day-number">${j}</span></div>`;
        gridBody.appendChild(cell);
    }

    populateCalendarEventChips();
    updateCalendarFocus(focusedCalendarDay);
}

function populateCalendarEventChips() {
    const filtered = getFilteredActivitiesList();

    filtered.forEach(act => {
        const actDateStr = act.date || (act.start_datetime ? act.start_datetime.substring(0, 10) : '2026-08-08');
        const actDate = new Date(actDateStr + 'T00:00:00');
        if (actDate.getFullYear() === currentCalendarYear && actDate.getMonth() === currentCalendarMonth) {
            const dayNum = actDate.getDate();
            const container = document.getElementById(`dayEvents-${dayNum}`);
            if (container) {
                const chip = document.createElement('div');
                let chipClass = 'status-chip-blue';
                let statusIcon = '🟢';
                let label = act.program_code || 'SLOT';

                if (act.is_locked || act.slot_status === 'Locked') {
                    chipClass = 'status-chip-gray';
                    statusIcon = '🔒';
                } else if (act.slot_status === 'Completed' || act.status === 'Completed') {
                    chipClass = 'status-chip-green';
                    statusIcon = '⚫';
                } else if (act.slot_status === 'Cancelled' || act.status === 'Cancelled') {
                    chipClass = 'status-chip-red';
                    statusIcon = '🔴';
                }

                const timeFormatted = act.time || act.schedule_time || '09:00 AM';
                chip.className = `calendar-event-chip ${chipClass}`;
                chip.innerHTML = `
                    <span>${statusIcon}</span>
                    <span class="text-truncate"><strong>${escapeHtml(label)}</strong> (${timeFormatted.split(' - ')[0]})</span>
                `;
                chip.onclick = (e) => {
                    e.stopPropagation();
                    openViewSlotDetailsModal(act.id);
                };
                container.appendChild(chip);
            }
        }
    });
}

function updateCalendarFocus(dayNum) {
    focusedCalendarDay = dayNum;
    const cells = document.querySelectorAll('.calendar-day-cell:not(.other-month)');
    cells.forEach(c => {
        if (parseInt(c.getAttribute('data-day')) === dayNum) {
            c.classList.add('selected-focus');
        } else {
            c.classList.remove('selected-focus');
        }
    });
    const focusLabel = document.getElementById('calendarFocusedDateLabel');
    if (focusLabel) {
        focusLabel.textContent = `Selected Date: ${MONTH_NAMES[currentCalendarMonth]} ${dayNum}, ${currentCalendarYear}`;
    }
}

function navigateCalendarMonth(delta) {
    currentCalendarMonth += delta;
    if (currentCalendarMonth < 0) {
        currentCalendarMonth = 11;
        currentCalendarYear -= 1;
    } else if (currentCalendarMonth > 11) {
        currentCalendarMonth = 0;
        currentCalendarYear += 1;
    }
    focusedCalendarDay = 1;
    renderCalendar();
    renderScheduledActivitiesPanel();
}

function jumpToCalendarToday() {
    currentCalendarYear = 2026;
    currentCalendarMonth = 7; // August
    focusedCalendarDay = 8;
    renderCalendar();
    renderScheduledActivitiesPanel();
    window.showSystemNotification({
        title: 'Calendar Reset to Today',
        message: 'Viewing August 8, 2026 program schedule.',
        type: 'info'
    });
}

function handleCalendarKeyNav(event) {
    const daysInMonth = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
    if (event.key === 'ArrowLeft') {
        event.preventDefault();
        focusedCalendarDay = Math.max(1, focusedCalendarDay - 1);
        updateCalendarFocus(focusedCalendarDay);
    } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        focusedCalendarDay = Math.min(daysInMonth, focusedCalendarDay + 1);
        updateCalendarFocus(focusedCalendarDay);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        focusedCalendarDay = Math.max(1, focusedCalendarDay - 7);
        updateCalendarFocus(focusedCalendarDay);
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusedCalendarDay = Math.min(daysInMonth, focusedCalendarDay + 7);
        updateCalendarFocus(focusedCalendarDay);
    } else if (event.key === 'Enter') {
        event.preventDefault();
        const dateStr = `${currentCalendarYear}-${String(currentCalendarMonth + 1).padStart(2, '0')}-${String(focusedCalendarDay).padStart(2, '0')}`;
        const dayAct = activitiesList.find(a => (a.date || a.start_datetime || '').startsWith(dateStr));
        if (dayAct) {
            openViewSlotDetailsModal(dayAct.id);
        } else {
            openCreateScheduleSlotModal(dateStr);
        }
    }
}

function getFilteredActivitiesList() {
    const searchInput = document.getElementById('schedSearchInput');
    const search = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const program = document.getElementById('schedProgramFilter') ? document.getElementById('schedProgramFilter').value : 'ALL';
    const officer = document.getElementById('schedOfficerFilter') ? document.getElementById('schedOfficerFilter').value : 'ALL';
    const status = document.getElementById('schedStatusFilter') ? document.getElementById('schedStatusFilter').value : 'ALL';
    const venue = document.getElementById('schedVenueFilter') ? document.getElementById('schedVenueFilter').value : 'ALL';
    const startDate = document.getElementById('schedDateRangeStart') ? document.getElementById('schedDateRangeStart').value : '';

    return activitiesList.filter(act => {
        const actTitle = (act.title || act.program_name || '').toLowerCase();
        const actProg = (act.program_code || '').toLowerCase();
        const actLoc = (act.venue || act.location || '').toLowerCase();
        const actOff = (act.officer_name || act.assigned_officer_name || '').toLowerCase();
        const actBatch = (act.batch_name || act.batch_num || '').toLowerCase();
        const actBeneficiary = (act.beneficiary_name || '').toLowerCase();
        const slotId = String(act.slot_id || act.id || '').toLowerCase();

        const matchesSearch = !search || actTitle.includes(search) || actProg.includes(search) || actLoc.includes(search) || actOff.includes(search) || actBatch.includes(search) || actBeneficiary.includes(search) || slotId.includes(search);
        const matchesProg = (program === 'ALL') || (act.program_code === program);
        const matchesOff = (officer === 'ALL') || ((act.officer_name || act.assigned_officer_name || '').includes(officer));

        let matchesStatus = true;
        if (status === 'Active') {
            matchesStatus = !act.is_locked && (act.slot_status === 'Active' || act.status === 'Scheduled' || act.status === 'Ongoing' || act.status === 'Active');
        } else if (status === 'Locked') {
            matchesStatus = act.is_locked || act.slot_status === 'Locked' || act.lock_status === 'Locked';
        } else if (status === 'Completed') {
            matchesStatus = act.slot_status === 'Completed' || act.status === 'Completed';
        } else if (status === 'Cancelled') {
            matchesStatus = act.slot_status === 'Cancelled' || act.status === 'Cancelled';
        }

        const matchesVenue = (venue === 'ALL') || ((act.venue || act.location || '').includes(venue));

        let matchesDate = true;
        if (startDate) {
            const actStart = (act.date || act.start_datetime || '').substring(0, 10);
            matchesDate = matchesDate && (actStart >= startDate);
        }

        return matchesSearch && matchesProg && matchesOff && matchesStatus && matchesVenue && matchesDate;
    });
}

function renderScheduledActivitiesPanel() {
    const container = document.getElementById('scheduledActivitiesPanelList');
    if (!container) return;
    container.innerHTML = '';

    const filtered = getFilteredActivitiesList();

    if (document.getElementById('activitiesPanelCountBadge')) {
        document.getElementById('activitiesPanelCountBadge').textContent = `${filtered.length} Slots`;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-calendar-x fs-1 d-block mb-2 text-secondary"></i>
                <h6>No program slots match your criteria</h6>
                <small>Adjust filters or click "+ Create Schedule Slot" to publish new slots.</small>
            </div>
        `;
        return;
    }

    filtered.forEach(act => {
        const card = document.createElement('div');
        card.className = 'card border rounded-3 p-3 mb-3 shadow-sm hover-shadow transition';

        const isLocked = act.is_locked || act.slot_status === 'Locked' || act.lock_status === 'Locked';
        const isCompleted = act.slot_status === 'Completed' || act.status === 'Completed';
        const isCancelled = act.slot_status === 'Cancelled' || act.status === 'Cancelled';

        let statusBadge = '<span class="badge bg-success text-white"><i class="bi bi-broadcast me-1"></i>Active</span>';
        if (isLocked) {
            statusBadge = '<span class="badge bg-dark text-white"><i class="bi bi-lock-fill me-1"></i>Locked</span>';
        } else if (isCompleted) {
            statusBadge = '<span class="badge bg-success text-white"><i class="bi bi-check2-all me-1"></i>Completed</span>';
        } else if (isCancelled) {
            statusBadge = '<span class="badge bg-danger-subtle text-danger border border-danger"><i class="bi bi-x-octagon-fill me-1"></i>Cancelled</span>';
        }

        let assignmentHtml = '<span class="text-muted small"><i class="bi bi-hourglass-split me-1 text-warning"></i>Awaiting Officer Assignment</span>';
        if (act.scheduling_mode === 'Individual' && act.beneficiary_name) {
            assignmentHtml = `<span class="badge bg-info-subtle text-dark border"><i class="bi bi-person-fill me-1"></i>${escapeHtml(act.beneficiary_name)} (${escapeHtml(act.beneficiary_phone || '09XX-***-XXXX')})</span>`;
        } else if (act.scheduling_mode === 'Batch' && act.batch_name) {
            assignmentHtml = `<span class="badge bg-primary-subtle text-primary border"><i class="bi bi-people-fill me-1"></i>${escapeHtml(act.batch_name)} (${act.batch_count || 25} Beneficiaries)</span>`;
        }

        const slotId = act.slot_id || `SLOT-${act.id}`;
        const progCode = act.program_code || 'TUPAD';
        const dateDisplay = act.date || (act.start_datetime ? act.start_datetime.substring(0, 10) : '2026-08-08');
        const timeDisplay = act.time || act.schedule_time || '09:00 AM - 10:00 AM';
        const venueDisplay = act.venue || act.location || 'PESO Main Office';
        const officerDisplay = act.officer_name || act.assigned_officer_name || 'Assigned Officer';

        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-primary font-monospace">${escapeHtml(progCode)}</span>
                    <span class="badge bg-light text-dark border font-monospace">${escapeHtml(slotId)}</span>
                </div>
                <div>${statusBadge}</div>
            </div>

            <h6 class="fw-bold text-dark mb-1">${escapeHtml(act.title || act.program_name || 'Program Session')}</h6>
            ${act.program_sub_category ? `<div class="text-muted small mb-2"><i class="bi bi-tag-fill me-1 text-secondary"></i>${escapeHtml(act.program_sub_category)}</div>` : ''}

            <div class="small text-muted mb-2">
                <div><i class="bi bi-calendar-event me-1.5 text-primary"></i><strong>${dateDisplay}</strong> • ${timeDisplay}</div>
                <div><i class="bi bi-geo-alt me-1.5 text-danger"></i>${escapeHtml(venueDisplay)}</div>
                <div><i class="bi bi-person-badge me-1.5 text-info"></i>Assigned: <strong class="text-dark">${escapeHtml(officerDisplay)}</strong></div>
            </div>

            <div class="p-2 bg-light rounded-2 mb-3">
                <div class="small fw-semibold text-secondary mb-1">Operational Assignment:</div>
                ${assignmentHtml}
            </div>

            <div class="d-flex flex-wrap justify-content-between align-items-center gap-1 pt-2 border-top">
                <button class="btn btn-sm btn-outline-info" onclick="openViewSlotDetailsModal(${act.id})" title="Strictly View-Only Details">
                    <i class="bi bi-eye-fill me-1"></i> View Details
                </button>
                <div class="d-flex gap-1">
                    ${!isLocked && !isCancelled && !isCompleted ? `
                        <button class="btn btn-sm btn-outline-warning text-dark" onclick="openEditSlotModal(${act.id})" title="Admin Edit / Reassign Officer">
                            <i class="bi bi-pencil-square"></i> Reassign
                        </button>
                        <button class="btn btn-sm btn-outline-dark" onclick="toggleSlotLock(${act.id})" title="Lock Slot (Prevents Reassignment)">
                            <i class="bi bi-lock-fill"></i> Lock
                        </button>
                    ` : ''}
                    ${isLocked && !isCancelled && !isCompleted ? `
                        <button class="btn btn-sm btn-dark text-white" onclick="toggleSlotLock(${act.id})" title="Unlock Slot (Allow Reassignment)">
                            <i class="bi bi-unlock-fill"></i> Unlock
                        </button>
                    ` : ''}
                    ${!isCompleted && !isCancelled ? `
                        <button class="btn btn-sm btn-outline-success" onclick="markSlotCompleted(${act.id})" title="Finalize Lifecycle as Completed">
                            <i class="bi bi-check2-circle"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="openCancelSlotModal(${act.id})" title="Cancel Slot (Retains Red Label)">
                            <i class="bi bi-x-circle"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

function filterSchedulingData() {
    renderScheduledActivitiesPanel();
    renderCalendar();
}

function resetSchedulingFilters() {
    if (document.getElementById('schedSearchInput')) document.getElementById('schedSearchInput').value = '';
    if (document.getElementById('schedProgramFilter')) document.getElementById('schedProgramFilter').value = 'ALL';
    if (document.getElementById('schedOfficerFilter')) document.getElementById('schedOfficerFilter').value = 'ALL';
    if (document.getElementById('schedStatusFilter')) document.getElementById('schedStatusFilter').value = 'ALL';
    if (document.getElementById('schedVenueFilter')) document.getElementById('schedVenueFilter').value = 'ALL';
    if (document.getElementById('schedDateRangeStart')) document.getElementById('schedDateRangeStart').value = '';
    filterSchedulingData();
}

// --- CREATE SCHEDULE SLOT (PAST DATE & CONFLICT VALIDATION RESTRICTIONS) ---

// =======================================================================
// SMARTPHONE-STYLE WHEEL TIME PICKER & DAY TOGGLES RECURRENCE CONTROLLER
// =======================================================================

let selectedDayToggles = [1, 3, 5]; // Default: Mon, Wed, Fri (1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat, 0 = Sun)
let currentRecurrenceMode = 'weekly'; // 'single', 'multi_day', 'weekly'
let wheelPickerInstances = {};

// Initialize Smartphone-Style Wheel Columns
function initWheelPicker(prefix, defaultHour = 9, defaultMinute = 0, defaultAmPm = 'AM') {
    const hourCol = document.getElementById(`${prefix}HourCol`);
    const minCol = document.getElementById(`${prefix}MinCol`);
    const ampmCol = document.getElementById(`${prefix}AmPmCol`);

    if (!hourCol || !minCol || !ampmCol) return;

    // 1. Populate Hours 01 - 12
    hourCol.innerHTML = '';
    for (let h = 1; h <= 12; h++) {
        const hStr = String(h).padStart(2, '0');
        const item = document.createElement('div');
        item.className = `wheel-item ${h === defaultHour ? 'selected' : ''}`;
        item.setAttribute('data-val', hStr);
        item.textContent = hStr;
        item.onclick = () => selectWheelItem(hourCol, item, prefix);
        hourCol.appendChild(item);
    }

    // 2. Populate Minutes 00 - 55 (5-minute steps)
    minCol.innerHTML = '';
    for (let m = 0; m < 60; m += 5) {
        const mStr = String(m).padStart(2, '0');
        const item = document.createElement('div');
        item.className = `wheel-item ${m === defaultMinute ? 'selected' : ''}`;
        item.setAttribute('data-val', mStr);
        item.textContent = mStr;
        item.onclick = () => selectWheelItem(minCol, item, prefix);
        minCol.appendChild(item);
    }

    // 3. Populate AM / PM
    ampmCol.innerHTML = '';
    ['AM', 'PM'].forEach(ampm => {
        const item = document.createElement('div');
        item.className = `wheel-item ${ampm === defaultAmPm ? 'selected' : ''}`;
        item.setAttribute('data-val', ampm);
        item.textContent = ampm;
        item.onclick = () => selectWheelItem(ampmCol, item, prefix);
        ampmCol.appendChild(item);
    });

    // Attach scroll snap sync
    [hourCol, minCol, ampmCol].forEach(col => {
        col.onscroll = () => handleWheelScroll(col, prefix);
    });

    // Initial positioning
    setTimeout(() => {
        scrollSelectedIntoView(hourCol);
        scrollSelectedIntoView(minCol);
        scrollSelectedIntoView(ampmCol);
        updateLiveTimeDisplay();
    }, 50);
}

function selectWheelItem(col, item, prefix) {
    col.querySelectorAll('.wheel-item').forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');
    scrollSelectedIntoView(col);
    updateLiveTimeDisplay();
}

function scrollSelectedIntoView(col) {
    const sel = col.querySelector('.wheel-item.selected');
    if (sel) {
        const targetScroll = sel.offsetTop - (col.clientHeight / 2) + (sel.clientHeight / 2);
        col.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
}

function handleWheelScroll(col, prefix) {
    clearTimeout(col._scrollTimeout);
    col._scrollTimeout = setTimeout(() => {
        const center = col.scrollTop + (col.clientHeight / 2);
        let closestItem = null;
        let minDiff = Infinity;

        col.querySelectorAll('.wheel-item').forEach(item => {
            const itemCenter = item.offsetTop + (item.clientHeight / 2);
            const diff = Math.abs(center - itemCenter);
            if (diff < minDiff) {
                minDiff = diff;
                closestItem = item;
            }
        });

        if (closestItem && !closestItem.classList.contains('selected')) {
            col.querySelectorAll('.wheel-item').forEach(i => i.classList.remove('selected'));
            closestItem.classList.add('selected');
            updateLiveTimeDisplay();
        }
    }, 80);
}

function getWheelSelectedTime(prefix) {
    const hourCol = document.getElementById(`${prefix}HourCol`);
    const minCol = document.getElementById(`${prefix}MinCol`);
    const ampmCol = document.getElementById(`${prefix}AmPmCol`);

    const h = hourCol ? (hourCol.querySelector('.wheel-item.selected')?.getAttribute('data-val') || '09') : '09';
    const m = minCol ? (minCol.querySelector('.wheel-item.selected')?.getAttribute('data-val') || '00') : '00';
    const a = ampmCol ? (ampmCol.querySelector('.wheel-item.selected')?.getAttribute('data-val') || 'AM') : 'AM';

    return `${h}:${m} ${a}`;
}

function setWheelTime(prefix, timeStr) {
    if (!timeStr) return;
    const parts = timeStr.trim().split(/[: ]+/);
    if (parts.length < 3) return;
    const h = String(parseInt(parts[0])).padStart(2, '0');
    const m = String(parseInt(parts[1])).padStart(2, '0');
    const a = parts[2].toUpperCase();

    const hourCol = document.getElementById(`${prefix}HourCol`);
    const minCol = document.getElementById(`${prefix}MinCol`);
    const ampmCol = document.getElementById(`${prefix}AmPmCol`);

    if (hourCol) {
        hourCol.querySelectorAll('.wheel-item').forEach(i => {
            i.classList.toggle('selected', i.getAttribute('data-val') === h);
        });
        scrollSelectedIntoView(hourCol);
    }
    if (minCol) {
        minCol.querySelectorAll('.wheel-item').forEach(i => {
            i.classList.toggle('selected', i.getAttribute('data-val') === m);
        });
        scrollSelectedIntoView(minCol);
    }
    if (ampmCol) {
        ampmCol.querySelectorAll('.wheel-item').forEach(i => {
            i.classList.toggle('selected', i.getAttribute('data-val') === a);
        });
        scrollSelectedIntoView(ampmCol);
    }
    updateLiveTimeDisplay();
}

function calculateTimeDuration(startTimeStr, endTimeStr) {
    const parseMins = (tStr) => {
        const p = tStr.split(/[: ]+/);
        let h = parseInt(p[0]);
        const m = parseInt(p[1]);
        const ampm = p[2];
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return h * 60 + m;
    };

    const startMins = parseMins(startTimeStr);
    const endMins = parseMins(endTimeStr);
    let diff = endMins - startMins;
    if (diff <= 0) diff += 24 * 60; // next day wrap if applicable

    const hours = Math.floor(diff / 60);
    const mins = diff % 60;

    if (hours > 0 && mins > 0) return `${hours} hr ${mins} mins`;
    if (hours > 0) return `${hours} Hour${hours === 1 ? '' : 's'}`;
    return `${mins} Mins`;
}

function updateLiveTimeDisplay() {
    const start = getWheelSelectedTime('start');
    const end = getWheelSelectedTime('end');
    const duration = calculateTimeDuration(start, end);

    const windowBadge = document.getElementById('createSlotTimeWindowBadge');
    const durationBadge = document.getElementById('createSlotDurationBadge');
    const hiddenTimeSlot = document.getElementById('actTimeSlot');

    if (windowBadge) windowBadge.textContent = `${start} - ${end}`;
    if (durationBadge) durationBadge.textContent = `(${duration})`;
    if (hiddenTimeSlot) hiddenTimeSlot.value = `${start} - ${end}`;

    updateRecurrencePreview();
}

// ---------------------------------------------------------------------
// DAY TOGGLES & RECURRENCE ENGINE (M T W T F S S)
// ---------------------------------------------------------------------

function toggleDayChip(dayNum) {
    const idx = selectedDayToggles.indexOf(dayNum);
    if (idx > -1) {
        if (selectedDayToggles.length > 1) { // keep at least 1 day selected
            selectedDayToggles.splice(idx, 1);
        }
    } else {
        selectedDayToggles.push(dayNum);
        selectedDayToggles.sort((a, b) => a - b);
    }
    renderDayToggles();
    updateRecurrencePreview();
}

function renderDayToggles() {
    for (let d = 0; d < 7; d++) {
        const btn = document.getElementById(`dayToggleBtn_${d}`);
        if (btn) {
            btn.classList.toggle('active', selectedDayToggles.includes(d));
        }
    }
}

function setRecurrenceMode(mode) {
    currentRecurrenceMode = mode;
    const weeksContainer = document.getElementById('recurrenceWeeksContainer');
    const freqContainer = document.getElementById('recurrenceFreqContainer');

    if (weeksContainer) weeksContainer.style.display = (mode === 'weekly') ? 'block' : 'none';
    if (freqContainer) freqContainer.style.display = (mode === 'weekly') ? 'block' : 'none';

    updateRecurrencePreview();
}

function calculateRecurringScheduleDates(startDateStr, selectedDays, mode, weeksCount = 4, frequency = 1) {
    if (!startDateStr) return ['2026-08-10'];
    const start = new Date(startDateStr + 'T00:00:00');
    if (isNaN(start.getTime())) return ['2026-08-10'];

    if (mode === 'single') {
        return [startDateStr];
    }

    const dates = [];
    const totalWeeks = Math.max(1, parseInt(weeksCount) || 1);
    const stepWeeks = Math.max(1, parseInt(frequency) || 1);

    for (let w = 0; w < totalWeeks; w += stepWeeks) {
        for (let d = 0; d < 7; d++) {
            if (selectedDays.includes(d)) {
                // Calculate date for day d in week w
                const currentWeekStart = new Date(start);
                currentWeekStart.setDate(start.getDate() + (w * 7));
                
                // Align to target day of week
                const startDay = currentWeekStart.getDay(); // 0 = Sun, 1 = Mon ...
                const diffDays = d - startDay;
                const targetDate = new Date(currentWeekStart);
                targetDate.setDate(currentWeekStart.getDate() + diffDays);

                // Only include dates on or after the chosen start date
                if (targetDate >= start) {
                    const yyyy = targetDate.getFullYear();
                    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(targetDate.getDate()).padStart(2, '0');
                    const dateStr = `${yyyy}-${mm}-${dd}`;
                    if (!dates.includes(dateStr)) {
                        dates.push(dateStr);
                    }
                }
            }
        }
    }

    dates.sort();
    return dates.length > 0 ? dates : [startDateStr];
}

function updateRecurrencePreview() {
    const startDateInput = document.getElementById('actSlotDate');
    const startDateStr = startDateInput ? startDateInput.value : '2026-08-10';
    const weeksInput = document.getElementById('actRecurrenceWeeks');
    const weeksCount = weeksInput ? parseInt(weeksInput.value) || 4 : 4;
    const freqSelect = document.getElementById('actRecurrenceFrequency');
    const freq = freqSelect ? parseInt(freqSelect.value) || 1 : 1;

    const dates = calculateRecurringScheduleDates(startDateStr, selectedDayToggles, currentRecurrenceMode, weeksCount, freq);

    const countBadge = document.getElementById('recurrenceSlotCountBadge');
    const dateListEl = document.getElementById('recurrenceDateListContainer');
    const durationBadge = document.getElementById('createSlotDurationBadge');

    if (countBadge) {
        countBadge.textContent = `${dates.length} Slot${dates.length === 1 ? '' : 's'} Generated`;
    }

    if (dateListEl) {
        const previewDates = dates.slice(0, 8);
        const moreCount = dates.length - previewDates.length;

        dateListEl.innerHTML = previewDates.map(d => {
            const dt = new Date(d + 'T00:00:00');
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()];
            return `<span class="date-pill-tag"><i class="bi bi-calendar-event me-1 text-primary"></i>${dayName} ${d}</span>`;
        }).join('') + (moreCount > 0 ? `<span class="date-pill-tag bg-primary-subtle text-primary fw-bold">+${moreCount} more dates</span>` : '');
    }
}

// Multi-Date Conflict Detection
function detectMultiSlotConflicts(datesArray, timeSlot, officerId) {
    if (!Array.isArray(datesArray) || !officerId || !Array.isArray(activitiesList)) {
        return { hasConflict: false, conflicts: [] };
    }

    const conflicts = [];
    datesArray.forEach(d => {
        activitiesList.forEach(slot => {
            if (!slot || slot.slot_status === 'Cancelled' || slot.status === 'Cancelled') return;
            const slotDate = slot.date || (slot.start_datetime ? slot.start_datetime.substring(0, 10) : '');
            const slotTime = slot.time || slot.schedule_time || '';
            const slotOfficerId = slot.officer_id || slot.assigned_officer_id;

            const isSameDate = (slotDate === d);
            const isSameTime = (slotTime === timeSlot || slotTime.split(' - ')[0] === timeSlot.split(' - ')[0]);
            const isSameOfficer = (slotOfficerId === officerId);

            if (isSameDate && isSameTime && isSameOfficer) {
                conflicts.push({
                    date: d,
                    time: slotTime,
                    conflictingSlotId: slot.slot_id || slot.id,
                    conflictingSlotTitle: slot.title || slot.program_name
                });
            }
        });
    });

    return {
        hasConflict: conflicts.length > 0,
        conflicts: conflicts
    };
}

function openCreateScheduleSlotModal(defaultDate) {
    const form = document.getElementById('createActivityForm');
    if (form) form.reset();

    const dateInput = document.getElementById('actSlotDate');
    if (dateInput) {
        dateInput.value = defaultDate || '2026-08-10';
    }

    const labelInput = document.getElementById('actSlotLabel');
    if (labelInput) {
        labelInput.value = 'TUPAD: Batch 1 Community Orientation Session';
    }

    const alertBox = document.getElementById('createActivitySafeguardAlert');
    if (alertBox) alertBox.classList.add('d-none');

    populateSchedulingDropdowns();
    renderDayToggles();

    // Initialize Smartphone-Style Wheel Pickers
    initWheelPicker('start', 9, 0, 'AM');
    initWheelPicker('end', 12, 0, 'PM');

    setRecurrenceMode('weekly');
    updateRecurrencePreview();

    safeOpenModal('createActivityModal');
}
window.openCreateActivityModal = openCreateScheduleSlotModal;

async function handleCreateScheduleSlotSubmit(e) {
    e.preventDefault();

    const progSelect = document.getElementById('actProgram');
    const programCode = progSelect ? progSelect.value : 'TUPAD';
    const programName = progSelect && progSelect.selectedIndex >= 0 ? progSelect.options[progSelect.selectedIndex].text : 'TUPAD';
    const slotLabel = (document.getElementById('actSlotLabel') ? document.getElementById('actSlotLabel').value : '').trim() || `${programCode}: Assessment Session`;
    const subCategory = (document.getElementById('actSubCategory') ? document.getElementById('actSubCategory').value : '').trim() || slotLabel;
    const barangayCluster = (document.getElementById('actBarangayCluster') ? document.getElementById('actBarangayCluster').value : '').trim();

    const slotDate = document.getElementById('actSlotDate').value || '2026-08-10';
    const startTime = getWheelSelectedTime('start');
    const endTime = getWheelSelectedTime('end');
    const timeSlot = `${startTime} - ${endTime}`;
    const duration = calculateTimeDuration(startTime, endTime);
    const venue = document.getElementById('actLocation').value.trim();

    const offSelect = document.getElementById('actOfficer');
    const officerId = offSelect ? Number(offSelect.value) : 1;
    const officer = (Array.isArray(officersList) ? officersList : usersList).find(o => o.id === officerId);
    const officerName = officer ? `${officer.first_name} ${officer.last_name}` : (offSelect && offSelect.selectedIndex >= 0 ? offSelect.options[offSelect.selectedIndex].text : 'Officer');

    const remarks = (document.getElementById('actRemarks') ? document.getElementById('actRemarks').value : '').trim();

    // RULE 1: PAST DATE RESTRICTION
    const todayStr = '2026-08-01';
    if (slotDate < todayStr) {
        const alertBox = document.getElementById('createActivitySafeguardAlert');
        const alertMsg = document.getElementById('createActivitySafeguardAlertMsg');
        if (alertBox && alertMsg) {
            alertMsg.textContent = 'Past Date Restriction: System strictly blocks scheduling program slots on past dates.';
            alertBox.classList.remove('d-none');
        }
        window.showSystemNotification({
            title: 'Past Date Restriction',
            message: 'Cannot create schedule slots on past dates.',
            type: 'warning'
        });
        return;
    }

    // Generate Recurring Dates Series
    const weeksInput = document.getElementById('actRecurrenceWeeks');
    const weeksCount = weeksInput ? parseInt(weeksInput.value) || 4 : 4;
    const freqSelect = document.getElementById('actRecurrenceFrequency');
    const freq = freqSelect ? parseInt(freqSelect.value) || 1 : 1;
    const targetDates = calculateRecurringScheduleDates(slotDate, selectedDayToggles, currentRecurrenceMode, weeksCount, freq);

    // RULE 2: MULTI-DATE CONFLICT DETECTION
    const conflictResult = detectMultiSlotConflicts(targetDates, timeSlot, officerId);
    if (conflictResult.hasConflict) {
        const alertBox = document.getElementById('createActivitySafeguardAlert');
        const alertMsg = document.getElementById('createActivitySafeguardAlertMsg');
        const firstConflict = conflictResult.conflicts[0];
        if (alertBox && alertMsg) {
            alertMsg.textContent = `Schedule Conflict Restriction: ${officerName} already has an assigned slot (${firstConflict.conflictingSlotId}) at ${firstConflict.time} on ${firstConflict.date}. Please pick another time slot or officer.`;
            alertBox.classList.remove('d-none');
        }
        window.showSystemNotification({
            title: 'Schedule Conflict Restriction',
            message: `${officerName} is already booked on ${firstConflict.date} (${firstConflict.time}).`,
            type: 'warning'
        });
        return;
    }

    // Create Slot Instances for all target recurring dates
    const createdSlotIds = [];
    for (let i = 0; i < targetDates.length; i++) {
        const dateItem = targetDates[i];
        const newSlotId = 'SLOT-' + String(Date.now() + i).slice(-4);
        const slotInstance = {
            id: Date.now() + i,
            slot_id: newSlotId,
            program_code: programCode,
            program_name: programName,
            program_sub_category: subCategory,
            barangay_cluster: barangayCluster || '',
            title: targetDates.length > 1 ? `${slotLabel} (Session ${i + 1}/${targetDates.length})` : slotLabel,
            category: 'Program Activity',
            date: dateItem,
            start_datetime: `${dateItem}T${startTime.split(' ')[0]}`,
            end_datetime: `${dateItem}T${endTime.split(' ')[0]}`,
            time: timeSlot,
            schedule_time: timeSlot,
            duration: duration,
            venue: venue,
            location: venue,
            officer_id: officerId,
            officer_name: officerName,
            assigned_officer_id: officerId,
            assigned_officer_name: `${officerName} (PESO Officer)`,
            remarks: remarks,
            slot_status: 'Active',
            status: 'Active',
            is_locked: false,
            lock_status: 'Unlocked',
            scheduling_mode: 'Unassigned',
            beneficiary_name: '',
            batch_name: '',
            batch_count: 0,
            created_at: new Date().toISOString(),
            created_by: 'PESO Admin',
            updated_at: new Date().toISOString(),
            alarm_config: {
                enabled: true,
                tiers: {
                    tier_24h: { enabled: true, lead_minutes: 1440, triggered: false, acknowledged: false },
                    tier_1h: { enabled: true, lead_minutes: 60, triggered: false, acknowledged: false },
                    tier_10m: { enabled: true, lead_minutes: 10, triggered: false, acknowledged: false }
                },
                channels: { portal_banner: true, audio_chime: true, push_notification: true },
                snooze: { is_snoozed: false, snooze_until: null, snoozed_by: null, snooze_count: 0 }
            }
        };

        if (typeof DataService !== 'undefined' && DataService.interviews) {
            try {
                const prog = (Array.isArray(programsList) ? programsList : []).find(p => p.code === programCode);
                await DataService.interviews.create({
                    agency: 'PESO',
                    program_id: prog ? prog.id : null,
                    officer_id: officerId,
                    title: slotInstance.title,
                    scheduled_date: dateItem,
                    scheduled_time: slotInstance.start_datetime,
                    location: venue,
                    notes: remarks,
                    status: 'Active'
                });
            } catch (err) {
                console.warn('[SCHEDULING] Database sync notice:', err);
            }
        }

        activitiesList.unshift(slotInstance);
        createdSlotIds.push(newSlotId);
    }

    const adminId = sessionStorage.getItem('userId') || '1';
    const adminUser = sessionStorage.getItem('username') || 'peso-admin';
    logAuditEvent('CREATE_RECURRING_SCHEDULE_SLOTS', `PESO Admin [${adminUser}] created ${targetDates.length} schedule slot(s) for ${programCode} spanning ${targetDates[0]} to ${targetDates[targetDates.length - 1]} (${timeSlot}) at ${venue}. Assigned Officer: ${officerName}`, 'interview_schedule');

    safeHideModal('createActivityModal');
    renderSchedulingModule();

    window.showSystemNotification({
        title: `${targetDates.length} Schedule Slot(s) Created`,
        message: `Successfully published ${targetDates.length} recurring session(s) dispatched to ${officerName}.`,
        type: 'success'
    });
}
window.handleCreateActivitySubmit = handleCreateScheduleSlotSubmit;

// --- VIEW SLOT DETAILS MODAL (STRICTLY READ-ONLY, RULE 1) ---
function openViewSlotDetailsModal(slotId) {
    if (!Array.isArray(activitiesList)) activitiesList = [];
    activeViewingActivityId = slotId;
    const act = activitiesList.find(a => a && (a.id === slotId || a.slot_id === slotId));
    if (!act) {
        console.warn('[SCHEDULING] Slot details not found for ID:', slotId);
        window.showSystemNotification({ title: 'Schedule Notice', message: 'Slot details could not be retrieved.', type: 'warning' });
        return;
    }

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || 'N/A';
    };

    setText('viewActModalTitle', `Program Slot: ${act.slot_id || 'SLOT-' + act.id}`);
    setText('viewActSlotIdBadge', act.slot_id || `SLOT-${act.id}`);
    setText('viewActProgramBadge', act.program_code || 'TUPAD');
    setText('viewActTitle', act.title || act.program_name || 'Program Schedule Session');
    setText('viewActSubCategory', act.program_sub_category ? `Sub-category: ${act.program_sub_category}` : 'General Program Operations');

    const dateStr = act.date || (act.start_datetime ? act.start_datetime.substring(0, 10) : '2026-08-08');
    const timeStr = act.time || act.schedule_time || '09:00 AM - 10:00 AM';
    setText('viewActDateTime', `${dateStr} • ${timeStr}`);
    setText('viewActDuration', `Assigned Cluster: ${act.barangay_cluster || 'Citywide / General'}`);

    setText('viewActLocation', act.venue || act.location || 'PESO Main Office');
    setText('viewActCluster', act.remarks ? `Admin Remarks: "${act.remarks}"` : 'No special remarks entered.');
    setText('viewActAssignedOfficer', act.officer_name || act.assigned_officer_name || 'Assigned Officer');

    const isLocked = act.is_locked || act.slot_status === 'Locked' || act.lock_status === 'Locked';
    const isCancelled = act.slot_status === 'Cancelled' || act.status === 'Cancelled';
    const isCompleted = act.slot_status === 'Completed' || act.status === 'Completed';
    const lockBadge = document.getElementById('viewActLockBadge');
    if (lockBadge) {
        lockBadge.className = isLocked ? 'badge bg-dark text-white' : 'badge bg-secondary-subtle text-dark border';
        lockBadge.innerHTML = isLocked ? '<i class="bi bi-lock-fill me-1"></i>Locked (Protected)' : '<i class="bi bi-unlock me-1"></i>Unlocked';
    }

    const statusBadge = document.getElementById('viewActStatusBadge');
    if (statusBadge) {
        if (act.slot_status === 'Cancelled' || act.status === 'Cancelled') {
            statusBadge.className = 'badge bg-danger-subtle text-danger border border-danger px-3 py-1.5 fs-6';
            statusBadge.textContent = '🔴 Cancelled';
        } else if (act.slot_status === 'Completed' || act.status === 'Completed') {
            statusBadge.className = 'badge bg-success text-white px-3 py-1.5 fs-6';
            statusBadge.textContent = '⚫ Completed';
        } else if (isLocked) {
            statusBadge.className = 'badge bg-dark text-white px-3 py-1.5 fs-6';
            statusBadge.textContent = '🔒 Locked Slot';
        } else {
            statusBadge.className = 'badge bg-success text-white px-3 py-1.5 fs-6';
            statusBadge.textContent = '🟢 Active Slot';
        }
    }

    const mode = act.scheduling_mode || 'Unassigned';
    document.getElementById('viewActTargetBeneficiaries').textContent = `Mode: ${mode}`;

    const paramsContainer = document.getElementById('viewActCategoryParams');
    if (paramsContainer) {
        if (mode === 'Individual' && act.beneficiary_name) {
            paramsContainer.innerHTML = `
                <div class="col-md-6"><span class="text-muted">Beneficiary Name:</span> <strong class="text-dark">${escapeHtml(act.beneficiary_name)}</strong></div>
                <div class="col-md-6"><span class="text-muted">Contact Number:</span> <span class="badge bg-light text-dark font-monospace">${escapeHtml(maskContactNumber(act.beneficiary_phone || '09XX-***-XXXX'))}</span></div>
                <div class="col-md-6"><span class="text-muted">Barangay:</span> <strong>${escapeHtml(act.barangay || 'Poblacion')}</strong></div>
                <div class="col-md-6"><span class="text-muted">Attendance Status:</span> <span class="badge ${act.attendance_status === 'Present' ? 'bg-success' : (act.attendance_status === 'Absent' ? 'bg-danger' : 'bg-warning text-dark')}">${act.attendance_status || 'Pending'}</span></div>
            `;
        } else if (mode === 'Batch' && act.batch_name) {
            paramsContainer.innerHTML = `
                <div class="col-md-6"><span class="text-muted">Batch Identifier:</span> <strong class="text-primary">${escapeHtml(act.batch_name)}</strong></div>
                <div class="col-md-3"><span class="text-muted">Beneficiary Count:</span> <span class="badge bg-primary">${act.batch_count || 25} Pax</span></div>
                <div class="col-md-3"><span class="text-muted">Attendance:</span> <span class="badge bg-success text-white">${act.attendance_status || 'Enrolled'}</span></div>
                <div class="col-12"><span class="text-muted">Cluster Metadata:</span> <strong class="text-dark">${escapeHtml(act.barangay_cluster || 'Cluster Assigned')}</strong></div>
            `;
        } else {
            paramsContainer.innerHTML = `
                <div class="col-12 text-muted fst-italic">
                    <i class="bi bi-info-circle me-1 text-primary"></i>Slot is ready for PESO Officer to assign individual beneficiaries or community batch rosters.
                </div>
            `;
        }
    }

    const cancelBox = document.getElementById('viewActCancellationBox');
    if (cancelBox) {
        if (act.slot_status === 'Cancelled' || act.status === 'Cancelled') {
            cancelBox.classList.remove('d-none');
            document.getElementById('viewActCancellationReason').textContent = act.cancellation_reason || 'Administrative cancellation recorded.';
            document.getElementById('viewActCancellationTimestamp').textContent = `Cancelled on: ${new Date(act.cancelled_at || act.updated_at).toLocaleString()} by ${act.cancelled_by || 'PESO Admin'}`;
        } else {
            cancelBox.classList.add('d-none');
        }
    }

    if (document.getElementById('viewActAuditTimestamp')) document.getElementById('viewActAuditTimestamp').textContent = new Date(act.created_at || Date.now()).toLocaleString();
    if (document.getElementById('viewActAuditHash')) document.getElementById('viewActAuditHash').textContent = `Hash: SHA-${Math.abs(act.id).toString(16).toUpperCase()}`;

    const editBtn = document.getElementById('viewModalEditBtn');
    const lockBtn = document.getElementById('viewModalLockToggleBtn');
    const compBtn = document.getElementById('viewModalCompleteBtn');
    const cancelBtn = document.getElementById('viewModalCancelBtn');

    if (editBtn) editBtn.style.display = isLocked || isCancelled || isCompleted ? 'none' : 'inline-block';
    if (lockBtn) {
        lockBtn.style.display = isCancelled || isCompleted ? 'none' : 'inline-block';
        lockBtn.innerHTML = isLocked ? '<i class="bi bi-unlock-fill me-1"></i> Unlock Slot' : '<i class="bi bi-lock-fill me-1"></i> Lock Slot';
    }
    if (compBtn) compBtn.style.display = isCompleted || isCancelled ? 'none' : 'inline-block';
    if (cancelBtn) cancelBtn.style.display = isCancelled || isCompleted ? 'none' : 'inline-block';

    safeOpenModal('viewActivityDetailsModal');
    logAuditEvent('VIEW_SCHEDULE_SLOT_DETAILS', `Inspected read-only details for slot ${act.slot_id || act.id} (${act.program_code})`);
}
window.openViewActivityDetailsModal = openViewSlotDetailsModal;

function triggerEditFromView() {
    safeHideModal('viewActivityDetailsModal');
    if (activeViewingActivityId) openEditSlotModal(activeViewingActivityId);
}

function triggerLockFromView() {
    safeHideModal('viewActivityDetailsModal');
    if (activeViewingActivityId) toggleSlotLock(activeViewingActivityId);
}

function triggerCompleteFromView() {
    safeHideModal('viewActivityDetailsModal');
    if (activeViewingActivityId) markSlotCompleted(activeViewingActivityId);
}

function triggerCancelFromView() {
    safeHideModal('viewActivityDetailsModal');
    if (activeViewingActivityId) openCancelSlotModal(activeViewingActivityId);
}

// --- EDIT PROGRAM SLOT (ADMIN ONLY) ---
function openEditSlotModal(slotId) {
    if (!Array.isArray(activitiesList)) activitiesList = [];
    const act = activitiesList.find(a => a && (a.id === slotId || a.slot_id === slotId));
    if (!act) {
        console.warn('[SCHEDULING] Slot not found for ID:', slotId);
        window.showSystemNotification({ title: 'Schedule Notice', message: 'Slot details not found.', type: 'warning' });
        return;
    }

    if (act.is_locked || act.slot_status === 'Locked' || act.lock_status === 'Locked') {
        window.showSystemNotification({
            title: 'Slot Locked',
            message: 'Lock Restriction: This slot is locked by Admin. Unlock it first if you need to reassign officers.',
            type: 'warning'
        });
        return;
    }

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('editActId', act.id);
    const badge = document.getElementById('editActIdBadge');
    if (badge) badge.textContent = act.slot_id || `ID: ${act.id}`;
    setVal('editActTitleInput', act.title || act.program_name || 'Program Schedule Session');
    setVal('editActProgramCode', `${act.program_code || 'TUPAD'} - ${act.program_name || 'Program Linkage'}`);

    populateSchedulingDropdowns();
    setVal('editActOfficer', act.officer_id || act.assigned_officer_id || 1);
    setVal('editActDate', act.date || (act.start_datetime ? act.start_datetime.substring(0, 10) : '2026-08-10'));
    setVal('editActTimeSlot', act.time || act.schedule_time || '09:00 AM - 12:00 PM');
    setVal('editActLocation', act.venue || act.location || 'PESO Main Office');
    setVal('editActRemarks', act.remarks || '');

    safeOpenModal('editActivityModal');
}
window.openEditActivityModal = openEditSlotModal;

async function handleSaveSlotUpdates(e) {
    e.preventDefault();
    const actIdEl = document.getElementById('editActId');
    const actId = actIdEl ? Number(actIdEl.value) : null;
    const act = activitiesList.find(a => a && a.id === actId);
    if (!act) {
        window.showSystemNotification({ title: 'Update Notice', message: 'Target schedule slot not found.', type: 'danger' });
        return;
    }

    if (act.is_locked || act.slot_status === 'Locked') {
        window.showSystemNotification({
            title: 'Lock Restriction',
            message: 'Slot is locked and cannot be updated.',
            type: 'warning'
        });
        return;
    }

    const newTitle = (document.getElementById('editActTitleInput') ? document.getElementById('editActTitleInput').value : '').trim() || act.title;
    const offSelect = document.getElementById('editActOfficer');
    const newOfficerId = Number(offSelect.value);
    const officer = (Array.isArray(officersList) ? officersList : usersList).find(o => o.id === newOfficerId);
    const newOfficerName = officer ? `${officer.first_name} ${officer.last_name}` : offSelect.options[offSelect.selectedIndex].text;

    const newDate = document.getElementById('editActDate').value;
    const newTime = document.getElementById('editActTimeSlot').value;
    const newVenue = document.getElementById('editActLocation').value.trim();
    const newRemarks = document.getElementById('editActRemarks').value.trim();

    // Check conflict for new officer/date/time
    const hasConflict = activitiesList.some(a => {
        if (a.id === actId) return false;
        const isSameOfficer = (a.officer_id === newOfficerId || a.assigned_officer_id === newOfficerId);
        const isSameDate = (a.date === newDate || (a.start_datetime || '').startsWith(newDate));
        const isSameTime = (a.time === newTime || a.schedule_time === newTime);
        const isNotCancelled = a.slot_status !== 'Cancelled' && a.status !== 'Cancelled';
        return isSameOfficer && isSameDate && isSameTime && isNotCancelled;
    });

    if (hasConflict) {
        window.showSystemNotification({
            title: 'Schedule Conflict',
            message: `${newOfficerName} already has an assigned slot at ${newTime} on ${newDate}.`,
            type: 'warning'
        });
        return;
    }

    const previousOfficer = act.officer_name || act.assigned_officer_name;

    if (typeof DataService !== 'undefined' && DataService.interviews) {
        try {
            const updateRes = await DataService.interviews.update(actId, {
                officer_id: newOfficerId,
                scheduled_date: newDate,
                scheduled_time: `${newDate}T${newTime.split(' - ')[0] || '09:00'}`,
                location: newVenue,
                notes: newRemarks
            });

            if (updateRes && updateRes.error) {
                window.showSystemNotification({
                    title: 'Update Failed',
                    message: updateRes.error.message || 'Failed to update schedule slot in Supabase.',
                    type: 'error'
                });
                return;
            }
        } catch (err) {
            console.error('[SCHEDULING] Supabase interview update error:', err);
            window.showSystemNotification({
                title: 'Database Error',
                message: 'Failed to communicate with Supabase. Update aborted.',
                type: 'error'
            });
            return;
        }
    }

    act.officer_id = newOfficerId;
    act.officer_name = newOfficerName;
    act.assigned_officer_id = newOfficerId;
    act.assigned_officer_name = `${newOfficerName} (PESO Officer)`;
    act.date = newDate;
    act.time = newTime;
    act.schedule_time = newTime;
    act.venue = newVenue;
    act.location = newVenue;
    act.remarks = newRemarks;
    act.title = newTitle;
    act.updated_at = new Date().toISOString();

    const adminId = sessionStorage.getItem('userId') || '1';
    const adminUser = sessionStorage.getItem('username') || 'peso-admin';
    logAuditEvent('REASSIGN_SLOT_OFFICER', `PESO Admin [ID:${adminId}, ${adminUser}] updated slot ${act.slot_id || act.id}. Reassigned officer from "${previousOfficer}" to "${newOfficerName}". Scheduled for ${newDate} (${newTime}) at ${newVenue}`, 'interview_schedule');

    safeHideModal('editActivityModal');
    renderSchedulingModule();

    window.showSystemNotification({
        title: 'Slot Updated & Reassigned',
        message: `Slot ${act.slot_id || act.id} reassigned to ${newOfficerName} successfully in Supabase.`,
        type: 'success'
    });
}
window.handleSaveActivityUpdates = handleSaveSlotUpdates;

// --- LOCK / UNLOCK SLOT TOGGLE ---
function toggleSlotLock(slotId) {
    const act = activitiesList.find(a => a.id === slotId || a.slot_id === slotId);
    if (!act) return;

    const nextLockState = !act.is_locked;
    act.is_locked = nextLockState;
    act.lock_status = nextLockState ? 'Locked' : 'Unlocked';
    if (nextLockState && act.slot_status === 'Active') {
        act.slot_status = 'Locked';
    } else if (!nextLockState && act.slot_status === 'Locked') {
        act.slot_status = 'Active';
    }
    act.updated_at = new Date().toISOString();

    logAuditEvent('LOCK_SCHEDULE_SLOT', `Admin ${nextLockState ? 'locked' : 'unlocked'} slot ${act.slot_id || act.id} (${act.program_code}). Reassignment ${nextLockState ? 'prevented' : 'permitted'}.`);
    renderSchedulingModule();

    window.showSystemNotification({
        title: nextLockState ? 'Slot Locked 🔒' : 'Slot Unlocked 🔓',
        message: nextLockState
            ? `Slot ${act.slot_id || act.id} is now locked. Officer reassignment is prevented.`
            : `Slot ${act.slot_id || act.id} is unlocked and open for workload rebalancing.`,
        type: nextLockState ? 'dark' : 'info'
    });
}

// --- COMPLETE SLOT (LIFECYCLE FINALIZATION) ---
function markSlotCompleted(slotId) {
    const act = activitiesList.find(a => a.id === slotId || a.slot_id === slotId);
    if (!act) return;

    act.slot_status = 'Completed';
    act.status = 'Completed';
    act.updated_at = new Date().toISOString();

    logAuditEvent('COMPLETE_SCHEDULE_SLOT', `Admin marked slot ${act.slot_id || act.id} (${act.program_code}) as Completed.`);
    renderSchedulingModule();

    window.showSystemNotification({
        title: 'Slot Marked Completed',
        message: `Slot ${act.slot_id || act.id} lifecycle finalized and archived for reporting.`,
        type: 'success'
    });
}

// --- CANCEL PROGRAM SLOT (RED LABEL RETENTION & MANDATORY REASON) ---
function openCancelSlotModal(slotId) {
    const act = activitiesList.find(a => a.id === slotId || a.slot_id === slotId);
    if (!act) return;

    document.getElementById('cancelActId').value = act.id;
    document.getElementById('cancelActTitlePrompt').textContent = `${act.slot_id || 'SLOT'} (${act.program_code}: ${act.venue || 'PESO Office'})`;
    document.getElementById('cancelActReason').value = '';

    safeOpenModal('cancelActivityModal');
}
window.openCancelActivityModal = openCancelSlotModal;

async function handleConfirmSlotCancellation() {
    const actId = Number(document.getElementById('cancelActId')?.value);
    const act = activitiesList.find(a => a.id === actId);
    if (!act) return;

    const reason = (document.getElementById('cancelActReason')?.value || '').trim();
    if (!reason) {
        window.showSystemNotification({
            title: 'Cancellation Reason Required',
            message: 'Mandatory Compliance: Please enter a reason for cancelling this slot.',
            type: 'warning'
        });
        return;
    }

    if (typeof DataService !== 'undefined' && DataService.interviews) {
        try {
            const updateRes = await DataService.interviews.update(actId, {
                status: 'Cancelled',
                notes: reason
            });

            if (updateRes && updateRes.error) {
                window.showSystemNotification({
                    title: 'Cancellation Failed',
                    message: updateRes.error.message || 'Failed to record cancellation in Supabase.',
                    type: 'error'
                });
                return;
            }
        } catch (err) {
            console.error('[SCHEDULING] Supabase interview cancellation error:', err);
            window.showSystemNotification({
                title: 'Database Error',
                message: 'Failed to communicate with Supabase. Cancellation aborted.',
                type: 'error'
            });
            return;
        }
    }

    act.slot_status = 'Cancelled';
    act.status = 'Cancelled';
    act.cancellation_reason = reason;
    act.cancelled_at = new Date().toISOString();
    act.cancelled_by = 'PESO Admin';
    act.updated_at = new Date().toISOString();

    const adminId = sessionStorage.getItem('userId') || '1';
    const adminUser = sessionStorage.getItem('username') || 'peso-admin';
    logAuditEvent('CANCEL_SCHEDULE_SLOT', `PESO Admin [ID:${adminId}, ${adminUser}] cancelled slot ID ${act.slot_id || act.id} (${act.program_code}). Reason: "${reason}". Red label retained for compliance tracking.`, 'interview_schedule');

    safeHideModal('cancelActivityModal');
    renderSchedulingModule();

    window.showSystemNotification({
        title: 'Slot Cancelled',
        message: `Slot ${act.slot_id || act.id} is marked Cancelled (🔴 Red label visible in calendar and archive).`,
        type: 'warning'
    });
}
window.handleConfirmActivityCancellation = handleConfirmSlotCancellation;

// --- SCHEDULING ARCHIVE BOX ---
function renderSchedulingArchive() {
    const tbody = document.getElementById('schedulingArchiveTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const search = (document.getElementById('archiveSchedSearchInput') ? document.getElementById('archiveSchedSearchInput').value : '').toLowerCase().trim();
    const statusFilter = document.getElementById('archiveSchedStatusFilter') ? document.getElementById('archiveSchedStatusFilter').value : 'ALL';

    const archivedList = activitiesList.filter(act => {
        const isArchived = (act.slot_status === 'Cancelled' || act.status === 'Cancelled' || act.slot_status === 'Completed' || act.status === 'Completed');
        if (!isArchived) return false;

        const matchesSearch = !search || (act.title || '').toLowerCase().includes(search) || (act.program_code || '').toLowerCase().includes(search) || (act.venue || act.location || '').toLowerCase().includes(search);

        let matchesStatus = true;
        if (statusFilter === 'Cancelled') matchesStatus = (act.slot_status === 'Cancelled' || act.status === 'Cancelled');
        if (statusFilter === 'Completed') matchesStatus = (act.slot_status === 'Completed' || act.status === 'Completed');

        return matchesSearch && matchesStatus;
    });

    if (archivedList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">Scheduling archive box clean.</td></tr>';
        return;
    }

    archivedList.forEach(act => {
        const tr = document.createElement('tr');
        const isCanc = (act.slot_status === 'Cancelled' || act.status === 'Cancelled');
        let statusBadge = isCanc
            ? '<span class="legend-badge status-pill-red">🔴 Cancelled</span>'
            : '<span class="legend-badge status-pill-gray">⚫ Completed</span>';

        const auditSnippet = isCanc
            ? `<div class="small text-danger fw-semibold"><i class="bi bi-x-octagon me-1"></i>${escapeHtml(act.cancellation_reason || 'Administrative cancellation')}</div><small class="text-muted font-monospace">${new Date(act.cancelled_at || act.updated_at).toLocaleString()}</small>`
            : `<div class="small text-success"><i class="bi bi-check2-circle me-1"></i>Completed & Archived</div><small class="text-muted font-monospace">${new Date(act.updated_at).toLocaleString()}</small>`;

        const dateFormatted = `${act.date || (act.start_datetime ? act.start_datetime.substring(0, 10) : '2026-08-08')} • ${act.time || act.schedule_time || '09:00 AM'}`;

        tr.innerHTML = `
            <td>
                <div class="fw-bold text-dark">${escapeHtml(act.title || act.program_name || 'Program Slot')}</div>
                <span class="badge bg-light text-secondary border font-monospace">${escapeHtml(act.slot_id || 'SLOT-' + act.id)}</span>
            </td>
            <td><span class="badge bg-primary font-monospace">${escapeHtml(act.program_code || 'TUPAD')}</span></td>
            <td><small class="fw-semibold text-dark">${dateFormatted}</small></td>
            <td><div class="small text-truncate" style="max-width: 180px;">${escapeHtml(act.venue || act.location)}</div></td>
            <td><small class="text-secondary">${escapeHtml(act.officer_name || act.assigned_officer_name)}</small></td>
            <td class="text-center">${statusBadge}</td>
            <td>${auditSnippet}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-info" onclick="openViewSlotDetailsModal(${act.id})" title="Read-only view">
                    <i class="bi bi-eye-fill"></i> View Details
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterSchedulingArchive() {
    renderSchedulingArchive();
}

function resetArchiveFilters() {
    if (document.getElementById('archiveSchedSearchInput')) document.getElementById('archiveSchedSearchInput').value = '';
    if (document.getElementById('archiveSchedStatusFilter')) document.getElementById('archiveSchedStatusFilter').value = 'ALL';
    renderSchedulingArchive();
}


// =======================================================================
// DUAL-ROLE ALARM ENGINE & SNOOZE / CONFLICT MANAGEMENT
// =======================================================================

let globalAlarmSettings = {
    masterEnabled: true,
    tier24h: true,
    tier1h: true,
    tier10m: true,
    soundEnabled: true,
    browserPushEnabled: false,
    autoSnoozeMins: 15
};

let pendingRescheduleRequests = [
    {
        id: 'REQ-2026-001',
        slot_id: 'SLOT-102',
        slot_title: 'PFAS: Livelihood Grant Evaluation & Interview',
        program_code: 'PFAS',
        officer_name: 'Jane Smith',
        beneficiary_name: 'Generoso Alcantara',
        current_time: '01:30 PM - 03:00 PM',
        requested_delay_mins: 30,
        requested_new_time: '02:00 PM - 03:30 PM',
        reason: 'Beneficiary encountered transport delay from Barangay Morales.',
        requested_at: '2026-08-08T08:30:00Z',
        status: 'Pending'
    }
];

let alarmTickerInterval = null;
let activeAlarmAlertSlot = null;

// Web Audio API Synthesizer (Two-tone Chime, zero external file dependency)
function playAlarmChime(type = 'chime') {
    if (!globalAlarmSettings.soundEnabled) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        if (type === 'imminent') {
            // Urgent 10-minute alert chime
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(880, now);
            osc1.frequency.setValueAtTime(1046.50, now + 0.15);

            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(440, now);

            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.6);
            osc2.stop(now + 0.6);
        } else {
            // Gentle 24h / 1h reminder chime
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.setValueAtTime(880, now + 0.2); // A5

            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.8);
        }
    } catch (e) {
        console.warn('[ALARM-ENGINE] Audio synth notice:', e);
    }
}

// Start Alarm Ticker
function initAlarmEngine() {
    if (alarmTickerInterval) clearInterval(alarmTickerInterval);
    alarmTickerInterval = setInterval(checkScheduleAlarms, 20000);
    // Initial check
    setTimeout(checkScheduleAlarms, 2000);
    updatePendingRescheduleBadge();
}

// Check schedule slots against reminder tiers
function checkScheduleAlarms() {
    if (!globalAlarmSettings.masterEnabled || !Array.isArray(activitiesList)) return;

    const now = new Date();
    activitiesList.forEach(slot => {
        if (!slot || slot.slot_status === 'Cancelled' || slot.status === 'Cancelled' || slot.slot_status === 'Completed') return;
        
        const slotConfig = slot.alarm_config || {
            enabled: true,
            tiers: {
                tier_24h: { enabled: true, lead_minutes: 1440, triggered: false, acknowledged: false },
                tier_1h: { enabled: true, lead_minutes: 60, triggered: false, acknowledged: false },
                tier_10m: { enabled: true, lead_minutes: 10, triggered: false, acknowledged: false }
            }
        };

        if (!slotConfig.enabled) return;

        const slotDateTimeStr = slot.start_datetime || (slot.date ? `${slot.date}T${(slot.time || '09:00').split(' - ')[0].replace(' AM', '').replace(' PM', '')}` : null);
        if (!slotDateTimeStr) return;

        const slotDate = new Date(slotDateTimeStr);
        if (isNaN(slotDate.getTime())) return;

        const diffMinutes = Math.round((slotDate.getTime() - now.getTime()) / (1000 * 60));

        // 1. 24h Tier (1410m to 1470m)
        if (globalAlarmSettings.tier24h && slotConfig.tiers && slotConfig.tiers.tier_24h && slotConfig.tiers.tier_24h.enabled && !slotConfig.tiers.tier_24h.triggered) {
            if (diffMinutes <= 1440 && diffMinutes > 120) {
                triggerSlotAlarm(slot, 'tier_24h', '24 Hours Before Start (Day-Ahead Preparation)');
            }
        }

        // 2. 1h Tier (50m to 70m)
        if (globalAlarmSettings.tier1h && slotConfig.tiers && slotConfig.tiers.tier_1h && slotConfig.tiers.tier_1h.enabled && !slotConfig.tiers.tier_1h.triggered) {
            if (diffMinutes <= 60 && diffMinutes > 15) {
                triggerSlotAlarm(slot, 'tier_1h', '1 Hour Before Start (Preparation & Readiness)');
            }
        }

        // 3. 10m Tier (1m to 15m)
        if (globalAlarmSettings.tier10m && slotConfig.tiers && slotConfig.tiers.tier_10m && slotConfig.tiers.tier_10m.enabled && !slotConfig.tiers.tier_10m.triggered) {
            if (diffMinutes <= 10 && diffMinutes >= 0) {
                triggerSlotAlarm(slot, 'tier_10m', '10 Minutes Before Start (Imminent Session Alert)', true);
            }
        }
    });
}

// Trigger Slot Alarm
function triggerSlotAlarm(slot, tierKey, tierLabel, isImminent = false) {
    if (!slot.alarm_config) {
        slot.alarm_config = {
            enabled: true,
            tiers: {
                tier_24h: { enabled: true, lead_minutes: 1440, triggered: false, acknowledged: false },
                tier_1h: { enabled: true, lead_minutes: 60, triggered: false, acknowledged: false },
                tier_10m: { enabled: true, lead_minutes: 10, triggered: false, acknowledged: false }
            }
        };
    }

    if (slot.alarm_config.tiers && slot.alarm_config.tiers[tierKey]) {
        slot.alarm_config.tiers[tierKey].triggered = true;
    }

    playAlarmChime(isImminent ? 'imminent' : 'chime');

    // Desktop Push Notification
    if (globalAlarmSettings.browserPushEnabled && 'Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification(`PESO Schedule Alarm: ${slot.program_code} Slot`, {
                body: `${tierLabel} - ${slot.title} on ${slot.date} (${slot.time}). Assigned: ${slot.officer_name || 'Officer'}`,
                icon: 'assets/images/peso-logo.png'
            });
        } catch (e) {
            console.warn('[PUSH-NOTIFICATION] Push dispatch notice:', e);
        }
    }

    // System Toast
    if (typeof window.showSystemNotification === 'function') {
        window.showSystemNotification({
            title: `⏰ Schedule Reminder: ${slot.program_code}`,
            message: `${tierLabel}: ${slot.title} at ${slot.venue} (${slot.time}).`,
            type: isImminent ? 'danger' : 'warning'
        });
    }

    // Log Audit Trail
    const adminUser = sessionStorage.getItem('username') || 'PESO System';
    logAuditEvent('TRIGGER_SLOT_ALARM', `Alarm triggered for slot ${slot.slot_id || slot.id} (${slot.program_code}) at tier [${tierLabel}]. Assigned Officer: ${slot.officer_name}`, 'interview_schedule');

    // Open Interactive Alert Modal
    openSlotAlarmAlertModal(slot, tierLabel, isImminent);
}

// Open Interactive Slot Alarm Alert Modal
function openSlotAlarmAlertModal(slot, tierLabel, isImminent = false) {
    activeAlarmAlertSlot = slot;
    const titleEl = document.getElementById('alarmAlertModalTitle');
    const badgeEl = document.getElementById('alarmAlertTierBadge');
    const slotBadgeEl = document.getElementById('alarmAlertSlotIdBadge');
    const progBadgeEl = document.getElementById('alarmAlertProgBadge');
    const progNameEl = document.getElementById('alarmAlertProgName');
    const timeEl = document.getElementById('alarmAlertDateTime');
    const venueEl = document.getElementById('alarmAlertVenue');
    const officerEl = document.getElementById('alarmAlertOfficer');
    const benEl = document.getElementById('alarmAlertBeneficiary');

    if (titleEl) titleEl.textContent = isImminent ? '🚨 Imminent Schedule Session Alert' : '⏰ Scheduled Slot Reminder';
    if (badgeEl) {
        badgeEl.className = isImminent ? 'badge bg-danger px-3 py-1.5' : 'badge bg-warning text-dark px-3 py-1.5';
        badgeEl.innerHTML = `<i class="bi bi-alarm-fill me-1"></i>${tierLabel}`;
    }
    if (slotBadgeEl) slotBadgeEl.textContent = slot.slot_id || `SLOT-${slot.id}`;
    if (progBadgeEl) progBadgeEl.textContent = slot.program_code || 'PESO';
    if (progNameEl) progNameEl.textContent = slot.title || slot.program_name;
    if (timeEl) timeEl.textContent = `${slot.date || '2026-08-08'} • ${slot.time || slot.schedule_time}`;
    if (venueEl) venueEl.textContent = slot.venue || slot.location || 'PESO Main Office';
    if (officerEl) officerEl.textContent = slot.officer_name || slot.assigned_officer_name || 'Assigned Officer';
    if (benEl) {
        if (slot.scheduling_mode === 'Individual' && slot.beneficiary_name) {
            benEl.textContent = `${slot.beneficiary_name} (Masked: ${maskContactNumber(slot.beneficiary_phone || '0917-123-4567')})`;
        } else if (slot.scheduling_mode === 'Batch' && slot.batch_name) {
            benEl.textContent = `${slot.batch_name} (${slot.batch_count || 25} Beneficiaries)`;
        } else {
            benEl.textContent = 'Unassigned Beneficiary (Awaiting Officer)';
        }
    }

    safeOpenModal('slotAlarmAlertModal');
}

// Acknowledge Alarm
function acknowledgeActiveAlarm() {
    if (activeAlarmAlertSlot) {
        const slot = activeAlarmAlertSlot;
        const role = sessionStorage.getItem('userRole') || 'PESO Admin';
        const user = sessionStorage.getItem('username') || 'peso-admin';
        logAuditEvent('ACKNOWLEDGE_SLOT_ALARM', `User [${user}, ${role}] acknowledged alarm for slot ${slot.slot_id || slot.id} (${slot.program_code}).`, 'interview_schedule');
        
        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Alarm Acknowledged',
                message: `Reminder acknowledged for slot ${slot.slot_id || slot.id}.`,
                type: 'success'
            });
        }
    }
    safeHideModal('slotAlarmAlertModal');
}

// Test Alarm Function
function triggerTestAlarm() {
    const sampleSlot = (Array.isArray(activitiesList) && activitiesList.length > 0)
        ? activitiesList[0]
        : {
            id: 999,
            slot_id: 'SLOT-TEST',
            program_code: 'TUPAD',
            program_name: 'Emergency Employment Assistance Program',
            title: 'TUPAD: Batch 1 Community Orientation Session',
            date: '2026-08-08',
            time: '09:00 AM - 12:00 PM',
            venue: 'City Gymnasium, Koronadal City',
            officer_name: 'Jane Smith',
            scheduling_mode: 'Batch',
            batch_name: 'Batch 1 - Central Koronadal',
            batch_count: 35
        };

    triggerSlotAlarm(sampleSlot, 'tier_10m', 'TEST ALARM (10m Imminent Session Simulation)', true);
}

// Conflict Detection Helper
function detectScheduleConflicts(targetSlot, slotList = activitiesList) {
    if (!targetSlot || !Array.isArray(slotList)) return { hasConflict: false, conflicts: [] };

    const targetDate = targetSlot.date || (targetSlot.start_datetime ? targetSlot.start_datetime.substring(0, 10) : '');
    const targetTime = targetSlot.time || targetSlot.schedule_time || '';
    const targetOfficerId = targetSlot.officer_id || targetSlot.assigned_officer_id;
    const targetId = targetSlot.id;

    const conflicts = slotList.filter(s => {
        if (!s || s.id === targetId) return false;
        if (s.slot_status === 'Cancelled' || s.status === 'Cancelled') return false;

        const isSameDate = (s.date === targetDate || (s.start_datetime || '').startsWith(targetDate));
        const isSameTime = (s.time === targetTime || s.schedule_time === targetTime);
        const isSameOfficer = targetOfficerId && (s.officer_id === targetOfficerId || s.assigned_officer_id === targetOfficerId);

        return isSameDate && isSameTime && isSameOfficer;
    });

    return {
        hasConflict: conflicts.length > 0,
        conflicts: conflicts
    };
}

// Open Snooze Slot Modal (Admin direct snooze)
function openSnoozeSlotModal(slotId) {
    if (!Array.isArray(activitiesList)) activitiesList = [];
    const act = activitiesList.find(a => a && (a.id === slotId || a.slot_id === slotId));
    if (!act) {
        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({ title: 'Snooze Notice', message: 'Slot details not found.', type: 'warning' });
        }
        return;
    }

    const idInput = document.getElementById('snoozeSlotIdInput');
    const badgeEl = document.getElementById('snoozeSlotBadge');
    const titleEl = document.getElementById('snoozeSlotTitle');
    const currentEl = document.getElementById('snoozeSlotCurrentTime');
    const reasonInput = document.getElementById('snoozeReasonInput');

    if (idInput) idInput.value = act.id;
    if (badgeEl) badgeEl.textContent = act.slot_id || `SLOT-${act.id}`;
    if (titleEl) titleEl.textContent = act.title || act.program_name;
    if (currentEl) currentEl.textContent = `${act.date} • ${act.time || act.schedule_time}`;
    if (reasonInput) reasonInput.value = '';

    safeHideModal('slotAlarmAlertModal');
    safeHideModal('viewActivityDetailsModal');
    safeOpenModal('snoozeSlotModal');
}

// Handle Admin Snooze Submission
function handleAdminSnoozeSubmit(e) {
    e.preventDefault();
    const idInput = document.getElementById('snoozeSlotIdInput');
    const slotId = idInput ? Number(idInput.value) : null;
    const act = activitiesList.find(a => a && a.id === slotId);

    if (!act) {
        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({ title: 'Error', message: 'Target slot not found.', type: 'danger' });
        }
        return;
    }

    const durationSelect = document.getElementById('snoozeDurationSelect');
    const delayMins = durationSelect ? Number(durationSelect.value) : 15;
    const reason = (document.getElementById('snoozeReasonInput') ? document.getElementById('snoozeReasonInput').value : '').trim() || 'Operational delay / Officer request';

    // Apply snooze
    if (!act.alarm_config) {
        act.alarm_config = {
            enabled: true,
            tiers: {
                tier_24h: { enabled: true, lead_minutes: 1440, triggered: false, acknowledged: false },
                tier_1h: { enabled: true, lead_minutes: 60, triggered: false, acknowledged: false },
                tier_10m: { enabled: true, lead_minutes: 10, triggered: false, acknowledged: false }
            },
            snooze: { is_snoozed: false, snooze_until: null, snoozed_by: null, snooze_count: 0 }
        };
    }

    act.alarm_config.snooze = {
        is_snoozed: true,
        snooze_until: new Date(Date.now() + delayMins * 60000).toISOString(),
        snoozed_by: sessionStorage.getItem('username') || 'PESO Admin',
        snooze_count: (act.alarm_config.snooze?.snooze_count || 0) + 1,
        reason: reason
    };

    // Update time label with snooze indicator
    act.time = `${act.time.split(' (Snoozed')[0]} (Snoozed +${delayMins}m)`;
    act.schedule_time = act.time;

    const adminUser = sessionStorage.getItem('username') || 'peso-admin';
    logAuditEvent('SNOOZE_SCHEDULE_SLOT', `Admin [${adminUser}] snoozed slot ${act.slot_id || act.id} by ${delayMins} minutes. Reason: "${reason}".`, 'interview_schedule');

    safeHideModal('snoozeSlotModal');
    renderSchedulingModule();

    if (typeof window.showSystemNotification === 'function') {
        window.showSystemNotification({
            title: 'Slot Snoozed Successfully',
            message: `Slot ${act.slot_id || act.id} delayed by ${delayMins} minutes.`,
            type: 'info'
        });
    }
}

// Global Alarm Settings Modal
function openAlarmSettingsModal() {
    const swMaster = document.getElementById('alarmMasterSwitch');
    const sw24h = document.getElementById('alarm24hSwitch');
    const sw1h = document.getElementById('alarm1hSwitch');
    const sw10m = document.getElementById('alarm10mSwitch');
    const swSound = document.getElementById('alarmSoundSwitch');
    const swPush = document.getElementById('alarmPushSwitch');

    if (swMaster) swMaster.checked = globalAlarmSettings.masterEnabled;
    if (sw24h) sw24h.checked = globalAlarmSettings.tier24h;
    if (sw1h) sw1h.checked = globalAlarmSettings.tier1h;
    if (sw10m) sw10m.checked = globalAlarmSettings.tier10m;
    if (swSound) swSound.checked = globalAlarmSettings.soundEnabled;
    if (swPush) swPush.checked = globalAlarmSettings.browserPushEnabled;

    safeOpenModal('alarmSettingsModal');
}

function handleSaveAlarmSettings(e) {
    e.preventDefault();
    globalAlarmSettings.masterEnabled = document.getElementById('alarmMasterSwitch') ? document.getElementById('alarmMasterSwitch').checked : true;
    globalAlarmSettings.tier24h = document.getElementById('alarm24hSwitch') ? document.getElementById('alarm24hSwitch').checked : true;
    globalAlarmSettings.tier1h = document.getElementById('alarm1hSwitch') ? document.getElementById('alarm1hSwitch').checked : true;
    globalAlarmSettings.tier10m = document.getElementById('alarm10mSwitch') ? document.getElementById('alarm10mSwitch').checked : true;
    globalAlarmSettings.soundEnabled = document.getElementById('alarmSoundSwitch') ? document.getElementById('alarmSoundSwitch').checked : true;
    globalAlarmSettings.browserPushEnabled = document.getElementById('alarmPushSwitch') ? document.getElementById('alarmPushSwitch').checked : false;

    if (globalAlarmSettings.browserPushEnabled && 'Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }

    const adminUser = sessionStorage.getItem('username') || 'peso-admin';
    logAuditEvent('CONFIG_ALARM_TIERS', `Admin [${adminUser}] updated global alarm rules (24h: ${globalAlarmSettings.tier24h}, 1h: ${globalAlarmSettings.tier1h}, 10m: ${globalAlarmSettings.tier10m}, Sound: ${globalAlarmSettings.soundEnabled}, Push: ${globalAlarmSettings.browserPushEnabled}).`, 'interview_schedule');

    safeHideModal('alarmSettingsModal');
    if (typeof window.showSystemNotification === 'function') {
        window.showSystemNotification({
            title: 'Alarm Rules Saved',
            message: 'Global multi-tier reminder settings updated.',
            type: 'success'
        });
    }
}

// Pending Reschedule Requests Queue Management
function updatePendingRescheduleBadge() {
    const badge = document.getElementById('pendingRescheduleCountBadge');
    if (badge) {
        const count = pendingRescheduleRequests.filter(r => r.status === 'Pending').length;
        badge.textContent = count;
        badge.className = count > 0 ? 'badge bg-danger text-white ms-1' : 'badge bg-secondary-subtle text-dark ms-1';
    }
}

function openPendingRescheduleModal() {
    const tbody = document.getElementById('pendingRescheduleTableBody');
    if (!tbody) return;

    const pending = pendingRescheduleRequests.filter(r => r.status === 'Pending');
    if (pending.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-muted">
                    <i class="bi bi-check-circle fs-3 d-block mb-1 text-success"></i>
                    No pending reschedule or snooze requests from officers.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = pending.map(req => `
            <tr>
                <td><span class="badge bg-primary-subtle text-primary font-monospace">${escapeHtml(req.slot_id)}</span></td>
                <td>
                    <div class="fw-bold text-dark">${escapeHtml(req.slot_title)}</div>
                    <small class="text-muted">${escapeHtml(req.officer_name)} • Beneficiary: ${escapeHtml(req.beneficiary_name || 'N/A')}</small>
                </td>
                <td>
                    <div class="text-muted small">Current: ${escapeHtml(req.current_time)}</div>
                    <div class="text-primary fw-bold small">Proposed: ${escapeHtml(req.requested_new_time)}</div>
                </td>
                <td><span class="badge bg-warning text-dark">+${req.requested_delay_mins} Mins</span></td>
                <td><small class="text-dark fst-italic">"${escapeHtml(req.reason)}"</small></td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-sm btn-success me-1" onclick="approveRescheduleRequest('${req.id}')" title="Approve Request">
                        <i class="bi bi-check-lg"></i> Approve
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="rejectRescheduleRequest('${req.id}')" title="Reject Request">
                        <i class="bi bi-x-lg"></i> Reject
                    </button>
                </td>
            </tr>
        `).join('');
    }

    safeOpenModal('pendingRescheduleRequestsModal');
}

function approveRescheduleRequest(reqId) {
    const reqIndex = pendingRescheduleRequests.findIndex(r => r.id === reqId);
    if (reqIndex === -1) return;

    const req = pendingRescheduleRequests[reqIndex];
    req.status = 'Approved';

    // Update target slot
    const slot = activitiesList.find(s => s && (s.id === req.slot_id || s.slot_id === req.slot_id));
    if (slot) {
        slot.time = req.requested_new_time;
        slot.schedule_time = req.requested_new_time;
        if (!slot.alarm_config) slot.alarm_config = { enabled: true, tiers: {}, snooze: {} };
        slot.alarm_config.snooze = {
            is_snoozed: true,
            snoozed_by: req.officer_name,
            reason: req.reason,
            approved_by: sessionStorage.getItem('username') || 'PESO Admin'
        };
    }

    const adminUser = sessionStorage.getItem('username') || 'peso-admin';
    logAuditEvent('APPROVE_RESCHEDULE_REQUEST', `Admin [${adminUser}] approved reschedule request for slot ${req.slot_id}. New time: ${req.requested_new_time}. Reason: "${req.reason}"`, 'interview_schedule');

    updatePendingRescheduleBadge();
    openPendingRescheduleModal();
    renderSchedulingModule();

    if (typeof window.showSystemNotification === 'function') {
        window.showSystemNotification({
            title: 'Reschedule Approved',
            message: `Slot ${req.slot_id} shifted to ${req.requested_new_time}.`,
            type: 'success'
        });
    }
}

function rejectRescheduleRequest(reqId) {
    const reqIndex = pendingRescheduleRequests.findIndex(r => r.id === reqId);
    if (reqIndex === -1) return;

    const req = pendingRescheduleRequests[reqIndex];
    req.status = 'Rejected';

    const adminUser = sessionStorage.getItem('username') || 'peso-admin';
    logAuditEvent('REJECT_RESCHEDULE_REQUEST', `Admin [${adminUser}] rejected reschedule request for slot ${req.slot_id} submitted by ${req.officer_name}.`, 'interview_schedule');

    updatePendingRescheduleBadge();
    openPendingRescheduleModal();

    if (typeof window.showSystemNotification === 'function') {
        window.showSystemNotification({
            title: 'Reschedule Rejected',
            message: `Request for slot ${req.slot_id} was rejected.`,
            type: 'info'
        });
    }
}

// Window Exports for Alarm Engine
window.openAlarmSettingsModal = openAlarmSettingsModal;
window.handleSaveAlarmSettings = handleSaveAlarmSettings;
window.openSnoozeSlotModal = openSnoozeSlotModal;
window.handleAdminSnoozeSubmit = handleAdminSnoozeSubmit;
window.openPendingRescheduleModal = openPendingRescheduleModal;
window.approveRescheduleRequest = approveRescheduleRequest;
window.rejectRescheduleRequest = rejectRescheduleRequest;
window.triggerTestAlarm = triggerTestAlarm;
window.acknowledgeActiveAlarm = acknowledgeActiveAlarm;
window.playAlarmChime = playAlarmChime;
window.initAlarmEngine = initAlarmEngine;

function scrollToSchedulingArchive() {
    const archiveEl = document.getElementById('schedulingArchiveBox');
    if (archiveEl) {
        archiveEl.scrollIntoView({ behavior: 'smooth' });
        archiveEl.classList.add('shadow');
        setTimeout(() => archiveEl.classList.remove('shadow'), 2000);
    }
}

// --- EXPORT SUITE ---
function exportCombinedLguReport() {
    const exportData = activitiesList.map(a => ({
        slot_id: a.slot_id || `SLOT-${a.id}`,
        program_code: a.program_code || 'TUPAD',
        program_name: a.program_name || 'Assistance Program',
        barangay_cluster: a.barangay_cluster || 'N/A',
        date: a.date || '2026-08-08',
        time: a.time || '09:00 AM - 10:00 AM',
        venue: a.venue || a.location || 'PESO Office',
        assigned_officer: a.officer_name || a.assigned_officer_name || 'Officer',
        slot_status: a.slot_status || a.status || 'Active',
        is_locked: a.is_locked ? 'Locked' : 'Unlocked',
        scheduling_mode: a.scheduling_mode || 'Unassigned',
        beneficiary_or_batch_name: a.beneficiary_name || a.batch_name || 'Unassigned',
        masked_contact: maskContactNumber(a.beneficiary_phone || '09XX-***-XXXX'),
        attendance_status: a.attendance_status || 'Pending'
    }));

    const headers = ['Slot ID', 'Program Code', 'Program Name', 'Barangay Cluster', 'Date', 'Time Slot', 'Venue', 'Assigned Officer', 'Slot Status', 'Lock State', 'Scheduling Mode', 'Beneficiary / Batch Name', 'Masked Contact', 'Attendance Status'];
    const rows = exportData.map(d => [
        d.slot_id,
        `"${d.program_code}"`,
        `"${(d.program_name || '').replace(/"/g, '""')}"`,
        `"${(d.barangay_cluster || '').replace(/"/g, '""')}"`,
        d.date,
        `"${d.time || ''}"`,
        `"${(d.venue || '').replace(/"/g, '""')}"`,
        `"${(d.assigned_officer || '').replace(/"/g, '""')}"`,
        d.slot_status,
        d.is_locked,
        d.scheduling_mode,
        `"${(d.beneficiary_or_batch_name || '').replace(/"/g, '""')}"`,
        `"${d.masked_contact}"`,
        d.attendance_status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PESO_Combined_LGU_Compliance_Report_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logAuditEvent('EXPORT_COMBINED_LGU_REPORT', 'Exported combined Admin program slot & Officer operational beneficiary dataset to CSV');
    window.showSystemNotification({
        title: 'Combined LGU Report Exported',
        message: 'Comprehensive Admin + Officer LGU compliance dataset downloaded.',
        type: 'success'
    });
}

function exportSchedulingCSV() {
    const headers = ['Slot ID', 'Program Code', 'Program Name', 'Cluster', 'Date', 'Time', 'Venue', 'Assigned Officer', 'Status', 'Locked', 'Mode', 'Beneficiary/Batch'];
    const rows = activitiesList.map(a => [
        a.slot_id || `SLOT-${a.id}`,
        `"${a.program_code}"`,
        `"${(a.program_name || '').replace(/"/g, '""')}"`,
        `"${(a.barangay_cluster || '').replace(/"/g, '""')}"`,
        a.date || (a.start_datetime ? a.start_datetime.substring(0, 10) : ''),
        `"${a.time || a.schedule_time || ''}"`,
        `"${(a.venue || a.location || '').replace(/"/g, '""')}"`,
        `"${(a.officer_name || a.assigned_officer_name || '').replace(/"/g, '""')}"`,
        `"${a.slot_status || a.status}"`,
        a.is_locked ? 'YES' : 'NO',
        `"${a.scheduling_mode || 'Unassigned'}"`,
        `"${(a.beneficiary_name || a.batch_name || 'Unassigned').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PESO_Program_Slots_Roster_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logAuditEvent('EXPORT_SCHEDULE_CSV', 'Exported full program schedule slots roster to CSV');
    window.showSystemNotification({
        title: 'Slots Roster Exported',
        message: 'Full program schedule slots roster generated and downloaded.',
        type: 'success'
    });
}

function exportArchiveCSV() {
    const archived = activitiesList.filter(a => a.slot_status === 'Cancelled' || a.status === 'Cancelled' || a.slot_status === 'Completed' || a.status === 'Completed');
    const headers = ['Slot ID', 'Program Code', 'Date', 'Venue', 'Officer', 'Status', 'Audit Reason/Notes'];
    const rows = archived.map(a => [
        a.slot_id || `SLOT-${a.id}`,
        `"${a.program_code}"`,
        a.date || (a.start_datetime ? a.start_datetime.substring(0, 10) : ''),
        `"${(a.venue || a.location || '').replace(/"/g, '""')}"`,
        `"${(a.officer_name || a.assigned_officer_name || '').replace(/"/g, '""')}"`,
        `"${a.slot_status || a.status}"`,
        `"${(a.cancellation_reason || 'Archived').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PESO_Scheduling_Archive_Box_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logAuditEvent('EXPORT_ARCHIVE_CSV', 'Exported scheduling archive box to CSV');
    window.showSystemNotification({
        title: 'Archive Exported',
        message: 'Scheduling Archive box CSV report downloaded.',
        type: 'info'
    });
}

function exportSchedulingPDF() {
    window.print();
    logAuditEvent('PRINT_SCHEDULE_REPORT', 'Generated printable PDF compliance report for PESO activities');
}

// --- AUTO-PULLED ELIGIBLE RECIPIENTS (CERTIFICATE DISTRIBUTION RESTRICTION) ---
function openEligibleRecipientsModal(progCode, batchNum) {
    const tbody = document.getElementById('eligibleRecipientsTableBody');
    const tag = document.getElementById('eligibleRecipientsBatchTag');
    if (tag) tag.textContent = `${progCode} — ${batchNum}`;
    if (!tbody) return;

    const sampleGraduates = [
        { name: 'Juan Santos Dela Cruz', phone: '0905-111-2222', comp: '100% (Completed All Modules)', philId: 'Verified' },
        { name: 'Maria Clara Santos', phone: '0917-333-4444', comp: '100% (Completed All Modules)', philId: 'Verified' },
        { name: 'Roberto Fernandez', phone: '0928-555-6666', comp: '100% (Completed All Modules)', philId: 'Verified' },
        { name: 'Ana Reyes', phone: '0939-777-8888', comp: '100% (Completed All Modules)', philId: 'Verified' },
        { name: 'Jose Protacio Mercado', phone: '0945-888-9999', comp: '100% (Completed All Modules)', philId: 'Verified' },
        { name: 'Gabriela Silang', phone: '0956-123-4567', comp: '100% (Completed All Modules)', philId: 'Verified' },
        { name: 'Andres Bonifacio', phone: '0967-234-5678', comp: '100% (Completed All Modules)', philId: 'Verified' },
        { name: 'Emilio Aguinaldo', phone: '0978-345-6789', comp: '100% (Completed All Modules)', philId: 'Verified' },
        { name: 'Apolinario Mabini', phone: '0989-456-7890', comp: '100% (Completed All Modules)', philId: 'Verified' },
        { name: 'Melchora Aquino', phone: '0912-567-8901', comp: '100% (Completed All Modules)', philId: 'Verified' },
        { name: 'Marcelo H. Del Pilar', phone: '0923-678-9012', comp: '100% (Completed All Modules)', philId: 'Verified' },
        { name: 'Juan Luna', phone: '0934-789-0123', comp: '100% (Completed All Modules)', philId: 'Verified' },
        { name: 'Antonio Luna', phone: '0945-890-1234', comp: '100% (Completed All Modules)', philId: 'Verified' },
        { name: 'Graciano Lopez Jaena', phone: '0956-901-2345', comp: '100% (Completed All Modules)', philId: 'Verified' },
        { name: 'Teresa Magbanua', phone: '0967-012-3456', comp: '100% (Completed All Modules)', philId: 'Verified' }
    ];

    tbody.innerHTML = sampleGraduates.map(g => `
        <tr>
            <td class="fw-bold text-dark">${escapeHtml(g.name)}</td>
            <td><span class="masked-phone">${maskContactNumber(g.phone)}</span></td>
            <td><span class="badge bg-primary-subtle text-primary font-monospace">${progCode} - ${batchNum}</span></td>
            <td><span class="badge bg-success-subtle text-success"><i class="bi bi-patch-check-fill me-1"></i>${g.comp}</span></td>
            <td class="text-center"><span class="badge bg-success">Clear for Certificate</span></td>
        </tr>
    `).join('');

    safeOpenModal('eligibleRecipientsModal');
    logAuditEvent('VIEW_ELIGIBLE_RECIPIENTS_ROSTER', `Inspected auto-pulled training records roster for Certificate Distribution (${progCode} - ${batchNum})`);
}

function scrollToSchedulingArchive() {
    const archiveBox = document.getElementById('schedulingArchiveCard') || document.getElementById('schedulingArchiveTableBody');
    if (archiveBox) {
        archiveBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.showSystemNotification({
            title: 'Scheduling Archive Box',
            message: 'Viewing completed and cancelled schedule records.',
            type: 'info'
        });
    }
}
window.scrollToSchedulingArchive = scrollToSchedulingArchive;
window.exportCombinedLguReport = exportCombinedLguReport;
window.exportSchedulingCSV = exportSchedulingCSV;
window.exportSchedulingPDF = exportSchedulingPDF;
window.exportArchiveCSV = exportArchiveCSV;
window.jumpToCalendarToday = jumpToCalendarToday;
window.openEligibleRecipientsModal = openEligibleRecipientsModal;

window.initWheelPicker = initWheelPicker;
window.getWheelSelectedTime = getWheelSelectedTime;
window.setWheelTime = setWheelTime;
window.toggleDayChip = toggleDayChip;
window.setRecurrenceMode = setRecurrenceMode;
window.updateRecurrencePreview = updateRecurrencePreview;



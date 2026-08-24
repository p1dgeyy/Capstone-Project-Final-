/**
 * PESO Admin Portal - Scheduling Management Module
 * File: frontend/assets/js/peso-admin/peso-admin-scheduling.js
 * 
 * Provides complete streamlined schedule slot management for Livelihood Program Activities:
 * - Assistance Distribution activities
 * - Certificate Distribution with qualified recipient auto-pull
 * - Custom specified activities
 * Features:
 * - 5 Overview Stat Cards (Total, Active/Scheduled, Postponed, Completed, Cancelled)
 * - Monthly Calendar with 5-color status indicators (🟢 Today, 🔵 Scheduled, 🟡 Postponed, 🔴 Cancelled, ⚫ Completed)
 * - Slots List View toggle
 * - Dual Right-Side Panels (Upcoming Activities Agenda & Archive Box)
 * - Streamlined creation form (optional officer, auto-populated program name, date range, start/end time, optional notes)
 * - Conflict & Past-Date Validation
 * - Edit / Reschedule / Postpone / Cancel Lifecycle
 * - Realtime Supabase Data Synchronization
 */

let activitiesList = [];
let adminScheduleViewMode = 'calendar'; // 'calendar' or 'list'
let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth(); // 0-indexed
let focusedCalendarDay = new Date().getDate();
let activeViewingActivityId = null;

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Initialize and load scheduling data from DataService / Supabase
 */
async function initSchedulingData() {
    await initSchedulingModuleData();
}

async function initSchedulingModuleData() {
    try {
        if (typeof DataService !== 'undefined' && DataService.interviews) {
            const res = await DataService.interviews.getAll({ agency: 'PESO' });
            if (res && res.data && Array.isArray(res.data)) {
                activitiesList = res.data.map(i => {
                    const schedStartDate = i.interview_date || (i.scheduled_time ? i.scheduled_time.substring(0, 10) : new Date().toISOString().substring(0, 10));
                    const schedEndDate = i.end_date || schedStartDate;
                    const schedStartTime = i.interview_time || '09:00 AM';
                    const schedEndTime = i.end_time || '11:00 AM';
                    const officerFullName = i.officer ? `${i.officer.first_name || ''} ${i.officer.last_name || ''}`.trim() : (i.officer_name || '');
                    const progCode = (i.program && i.program.code) || 'PESO';
                    const progName = (i.program && i.program.name) || 'Assistance Program';

                    return {
                        id: i.id,
                        slot_id: `SLOT-${i.id}`,
                        title: i.title || `${progCode} Scheduled Activity Slot`,
                        category: i.category || 'Assistance Distribution',
                        category_other: i.category_other || '',
                        program_id: i.program_id,
                        program_code: progCode,
                        program_name: progName,
                        date: schedStartDate,
                        start_date: schedStartDate,
                        end_date: schedEndDate,
                        start_datetime: `${schedStartDate}T${schedStartTime.replace(/[^0-9:]/g, '') || '09:00'}`,
                        end_datetime: `${schedEndDate}T${schedEndTime.replace(/[^0-9:]/g, '') || '11:00'}`,
                        time: `${schedStartTime} - ${schedEndTime}`,
                        start_time: schedStartTime,
                        end_time: schedEndTime,
                        duration: i.duration || '2 Hours',
                        venue: i.venue_location || i.location || 'PESO Main Office - Multi-Purpose Hall',
                        location: i.venue_location || i.location || 'PESO Main Office - Multi-Purpose Hall',
                        location_other: i.location_other || '',
                        officer_id: i.officer_id || null,
                        officer_name: officerFullName || 'Unassigned / General',
                        status: i.status || 'Scheduled',
                        attendance_status: i.attendance_status || 'Unmarked',
                        remarks: i.remarks || '',
                        postponed_at: i.postponed_at || null,
                        postponed_by: i.postponed_by || null,
                        postponement_reason: i.postponement_reason || null,
                        cancelled_at: i.cancelled_at || null,
                        cancelled_by: i.cancelled_by || null,
                        cancellation_reason: i.cancellation_reason || null,
                        recipient_count: i.recipient_count || 0,
                        created_at: i.created_at || new Date().toISOString()
                    };
                });
                renderSchedulingModule();
                return;
            }
        }
    } catch (e) {
        console.warn('[SCHEDULING] Data fetch notice:', e);
    }
    renderSchedulingModule();
}

/**
 * Populate Dropdowns for Filters and Modals strictly from live Supabase DataService
 */
async function populateSchedulingDropdowns() {
    // 1. Live Programs
    let programs = Array.isArray(window.programsList) && window.programsList.length > 0 ? window.programsList : [];
    if (programs.length === 0 && typeof DataService !== 'undefined' && DataService.programs) {
        try {
            const progRes = await DataService.programs.getAll({ agency: 'PESO' });
            if (progRes.data && Array.isArray(progRes.data)) {
                programs = progRes.data;
                window.programsList = programs;
            }
        } catch (e) {
            console.warn('[SCHEDULING] Live programs query notice:', e);
        }
    }

    const progFilter = document.getElementById('schedProgramFilter');
    const actProgSelect = document.getElementById('actTargetProgramSelect');
    const editProgSelect = document.getElementById('editActTargetProgramSelect');

    if (progFilter) {
        let opts = '<option value="ALL">All Programs</option>';
        programs.forEach(p => {
            opts += `<option value="${escapeHtml(p.code)}">${escapeHtml(p.code)} - ${escapeHtml(p.name)}</option>`;
        });
        progFilter.innerHTML = opts;
    }

    const buildProgOptions = () => {
        if (programs.length === 0) {
            return '<option value="">No Active Programs Available</option>';
        }
        let opts = '<option value="">Select Target Program...</option>';
        programs.forEach(p => {
            opts += `<option value="${p.id}" data-code="${escapeHtml(p.code)}" data-name="${escapeHtml(p.name)}">${escapeHtml(p.code)} - ${escapeHtml(p.name)}</option>`;
        });
        return opts;
    };

    if (actProgSelect) actProgSelect.innerHTML = buildProgOptions();
    if (editProgSelect) editProgSelect.innerHTML = buildProgOptions();

    // 2. Live PESO Officers
    let officers = Array.isArray(window.officersList) && window.officersList.length > 0 ? window.officersList : [];
    if (officers.length === 0 && typeof DataService !== 'undefined' && DataService.staffProfiles) {
        try {
            const offRes = await DataService.staffProfiles.getAll({ role: 'PESO Officer' });
            if (offRes.data && Array.isArray(offRes.data)) {
                officers = offRes.data;
                window.officersList = officers;
            }
        } catch (e) {
            console.warn('[SCHEDULING] Live officers query notice:', e);
        }
    }

    const offFilter = document.getElementById('schedOfficerFilter');
    const actOffSelect = document.getElementById('actOfficerSelect');
    const editOffSelect = document.getElementById('editActOfficerSelect');

    if (offFilter) {
        let opts = '<option value="ALL">All Officers</option>';
        officers.forEach(o => {
            const name = `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.username;
            opts += `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
        });
        offFilter.innerHTML = opts;
    }

    const buildOfficerOptions = () => {
        let opts = '<option value="">Unassigned / General Schedule (Optional)</option>';
        officers.forEach(o => {
            const name = `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.username;
            opts += `<option value="${o.id}" data-name="${escapeHtml(name)}">${escapeHtml(name)} (${o.role || 'Officer'})</option>`;
        });
        return opts;
    };

    if (actOffSelect) actOffSelect.innerHTML = buildOfficerOptions();
    if (editOffSelect) editOffSelect.innerHTML = buildOfficerOptions();
}

/**
 * Switch between Calendar View and Slots List View
 */
function setSchedViewMode(mode) {
    adminScheduleViewMode = mode;
    const btnCal = document.getElementById('schedBtnViewCalendar');
    const btnList = document.getElementById('schedBtnViewList');
    const calContainer = document.getElementById('schedCalendarViewContainer');
    const listContainer = document.getElementById('schedListViewContainer');

    if (mode === 'calendar') {
        if (btnCal) btnCal.classList.add('active');
        if (btnList) btnList.classList.remove('active');
        if (calContainer) calContainer.classList.remove('d-none');
        if (listContainer) listContainer.classList.add('d-none');
    } else {
        if (btnCal) btnCal.classList.remove('active');
        if (btnList) btnList.classList.add('active');
        if (calContainer) calContainer.classList.add('d-none');
        if (listContainer) listContainer.classList.remove('d-none');
    }
    renderSlotsListView();
}
window.setSchedViewMode = setSchedViewMode;

/**
 * Main Render Trigger
 */
function renderSchedulingModule() {
    populateSchedulingDropdowns();
    updateSchedulingMetrics();
    renderCalendar();
    renderUpcomingActivitiesAgenda();
    renderSchedulingArchive();
    renderSlotsListView();
}

/**
 * Update 5 Overview Stat Cards
 */
function updateSchedulingMetrics() {
    const total = activitiesList.length;
    const active = activitiesList.filter(a => a.status === 'Scheduled' || a.status === 'Active' || a.status === 'Ongoing').length;
    const postponed = activitiesList.filter(a => a.status === 'Postponed').length;
    const completed = activitiesList.filter(a => a.status === 'Completed').length;
    const cancelled = activitiesList.filter(a => a.status === 'Cancelled').length;

    const elTotal = document.getElementById('schedStatTotalSlots');
    const elActive = document.getElementById('schedStatActiveSlots');
    const elPostponed = document.getElementById('schedStatPostponedSlots');
    const elCompleted = document.getElementById('schedStatCompletedSlots');
    const elCancelled = document.getElementById('schedStatCancelledSlots');
    const elTabBadge = document.getElementById('schedTabBadge');

    if (elTotal) elTotal.textContent = total;
    if (elActive) elActive.textContent = active;
    if (elPostponed) elPostponed.textContent = postponed;
    if (elCompleted) elCompleted.textContent = completed;
    if (elCancelled) elCancelled.textContent = cancelled;
    if (elTabBadge) elTabBadge.textContent = active;
}

/**
 * Filter Activities based on Search and Filter Bar
 */
function getFilteredActivitiesList() {
    const search = (document.getElementById('schedSearchInput')?.value || '').toLowerCase().trim();
    const category = document.getElementById('schedCategoryFilter')?.value || 'ALL';
    const program = document.getElementById('schedProgramFilter')?.value || 'ALL';
    const officer = document.getElementById('schedOfficerFilter')?.value || 'ALL';
    const status = document.getElementById('schedStatusFilter')?.value || 'ALL';

    return activitiesList.filter(act => {
        const title = (act.title || '').toLowerCase();
        const prog = (act.program_code || '').toLowerCase();
        const off = (act.officer_name || '').toLowerCase();
        const loc = (act.location || act.venue || '').toLowerCase();
        const cat = (act.category || '').toLowerCase();

        const matchesSearch = !search || title.includes(search) || prog.includes(search) || off.includes(search) || loc.includes(search) || cat.includes(search);
        const matchesCategory = (category === 'ALL') || (act.category === category);
        const matchesProg = (program === 'ALL') || (act.program_code === program);
        const matchesOff = (officer === 'ALL') || (act.officer_name.includes(officer));

        let matchesStatus = true;
        if (status === 'Active') {
            matchesStatus = act.status === 'Scheduled' || act.status === 'Active' || act.status === 'Ongoing';
        } else if (status === 'Postponed') {
            matchesStatus = act.status === 'Postponed';
        } else if (status === 'Completed') {
            matchesStatus = act.status === 'Completed';
        } else if (status === 'Cancelled') {
            matchesStatus = act.status === 'Cancelled';
        }

        return matchesSearch && matchesCategory && matchesProg && matchesOff && matchesStatus;
    });
}

function filterSchedulingData() {
    renderCalendar();
    renderUpcomingActivitiesAgenda();
    renderSchedulingArchive();
    renderSlotsListView();
}
window.filterSchedulingData = filterSchedulingData;

function resetSchedulingFilters() {
    if (document.getElementById('schedSearchInput')) document.getElementById('schedSearchInput').value = '';
    if (document.getElementById('schedCategoryFilter')) document.getElementById('schedCategoryFilter').value = 'ALL';
    if (document.getElementById('schedProgramFilter')) document.getElementById('schedProgramFilter').value = 'ALL';
    if (document.getElementById('schedOfficerFilter')) document.getElementById('schedOfficerFilter').value = 'ALL';
    if (document.getElementById('schedStatusFilter')) document.getElementById('schedStatusFilter').value = 'ALL';
    filterSchedulingData();
}
window.resetSchedulingFilters = resetSchedulingFilters;

/**
 * Render Monthly Calendar Grid
 */
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

    const now = new Date();
    const isCurrentRealMonth = (now.getFullYear() === currentCalendarYear && now.getMonth() === currentCalendarMonth);
    const todayRealDate = now.getDate();

    // 1. Previous month trailing days
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
        const isToday = isCurrentRealMonth && (day === todayRealDate);
        const isFocused = (day === focusedCalendarDay);
        cell.className = `calendar-day-cell ${isToday ? 'today' : ''} ${isFocused ? 'selected-focus' : ''}`;
        cell.setAttribute('tabindex', '0');
        cell.setAttribute('data-day', day);

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
            document.querySelectorAll('.calendar-day-cell').forEach(c => c.classList.remove('selected-focus'));
            cell.classList.add('selected-focus');
        });

        gridBody.appendChild(cell);
    }

    // 3. Next month leading days
    const totalRendered = firstDayIndex + daysInMonth;
    const nextMonthCells = (totalRendered % 7 === 0) ? 0 : 7 - (totalRendered % 7);
    for (let j = 1; j <= nextMonthCells; j++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell other-month';
        cell.innerHTML = `<div class="calendar-day-top"><span class="calendar-day-number">${j}</span></div>`;
        gridBody.appendChild(cell);
    }

    populateCalendarChips();
}

/**
 * Populate 5-color status event chips into calendar cells
 */
function populateCalendarChips() {
    const filtered = getFilteredActivitiesList();
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    filtered.forEach(act => {
        const actStartDate = act.start_date || act.date || '';
        if (!actStartDate) return;

        const dateParts = actStartDate.split('-');
        if (dateParts.length !== 3) return;

        const yr = parseInt(dateParts[0], 10);
        const mo = parseInt(dateParts[1], 10) - 1;
        const dy = parseInt(dateParts[2], 10);

        if (yr === currentCalendarYear && mo === currentCalendarMonth) {
            const container = document.getElementById(`dayEvents-${dy}`);
            if (container) {
                const chip = document.createElement('div');

                // Color Legend Logic:
                // 🟢 Today: Happening Today
                // 🔵 Scheduled: Upcoming / Active
                // 🟡 Postponed: Postponed
                // 🔴 Cancelled: Cancelled
                // ⚫ Completed: Completed
                let chipClass = 'status-chip-blue';
                let iconSymbol = '🔵';

                if (act.status === 'Cancelled') {
                    chipClass = 'status-chip-red';
                    iconSymbol = '🔴';
                } else if (act.status === 'Postponed') {
                    chipClass = 'status-chip-yellow';
                    iconSymbol = '🟡';
                } else if (act.status === 'Completed') {
                    chipClass = 'status-chip-gray';
                    iconSymbol = '⚫';
                } else if (actStartDate === todayStr) {
                    chipClass = 'status-chip-green';
                    iconSymbol = '🟢';
                }

                chip.className = `calendar-event-chip ${chipClass}`;
                chip.innerHTML = `
                    <span>${iconSymbol}</span>
                    <span class="text-truncate"><strong>${escapeHtml(act.program_code)}</strong> - ${escapeHtml(act.title)}</span>
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
}
window.navigateCalendarMonth = navigateCalendarMonth;

function jumpToCalendarToday() {
    const now = new Date();
    currentCalendarYear = now.getFullYear();
    currentCalendarMonth = now.getMonth();
    focusedCalendarDay = now.getDate();
    renderCalendar();
}
window.jumpToCalendarToday = jumpToCalendarToday;

/**
 * 1. Upcoming Activities Panel (Top Right Box)
 */
function renderUpcomingActivitiesAgenda() {
    const container = document.getElementById('scheduledAgendaList');
    const badge = document.getElementById('upcomingActivitiesCountBadge');
    if (!container) return;

    const filtered = getFilteredActivitiesList().filter(a => a.status === 'Scheduled' || a.status === 'Active' || a.status === 'Ongoing');

    if (badge) {
        badge.textContent = `${filtered.length} Upcoming`;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="bi bi-calendar-check fs-2 d-block mb-1 text-secondary opacity-50"></i>
                <div class="fw-semibold small">No upcoming scheduled activities.</div>
                <small class="text-muted">Click "+ Create Schedule Slot" to publish new slots.</small>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(act => {
        const catBadge = act.category === 'Certificate Distribution' 
            ? '<span class="badge bg-warning text-dark font-monospace" style="font-size: 0.7rem;">Certificate Distribution</span>'
            : (act.category === 'Assistance Distribution' ? '<span class="badge bg-primary font-monospace" style="font-size: 0.7rem;">Assistance Distribution</span>' : '<span class="badge bg-info text-dark" style="font-size: 0.7rem;">Special Event</span>');

        return `
            <div class="card border rounded-3 p-2.5 mb-2 shadow-sm hover-shadow transition cursor-pointer" onclick="openViewSlotDetailsModal(${act.id})">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    ${catBadge}
                    <span class="badge bg-success-subtle text-success border border-success" style="font-size: 0.68rem;"><i class="bi bi-broadcast me-1"></i>Active</span>
                </div>
                <h6 class="fw-bold text-dark mb-1 text-truncate" style="font-size: 0.88rem;">${escapeHtml(act.title)}</h6>
                <div class="text-muted small" style="font-size: 0.76rem;">
                    <div><i class="bi bi-calendar-event me-1 text-primary"></i><strong>${act.start_date}</strong> • ${act.time}</div>
                    <div class="text-truncate"><i class="bi bi-geo-alt me-1 text-danger"></i>${escapeHtml(act.location)}</div>
                    <div><i class="bi bi-person-badge me-1 text-info"></i>Officer: <strong>${escapeHtml(act.officer_name)}</strong></div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * 2. Archive Box (Bottom Right Box)
 */
function renderSchedulingArchive() {
    const container = document.getElementById('schedulingArchiveList');
    const badge = document.getElementById('archiveBoxCountBadge');
    if (!container) return;

    const archived = getFilteredActivitiesList().filter(a => a.status === 'Completed' || a.status === 'Cancelled' || a.status === 'Postponed');

    if (badge) {
        badge.textContent = `${archived.length} Archived Slots`;
    }

    if (archived.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="bi bi-archive fs-2 d-block mb-1 text-secondary opacity-50"></i>
                <div class="fw-semibold small">No archived activities recorded.</div>
                <small class="text-muted">Completed and cancelled slots will appear here.</small>
            </div>
        `;
        return;
    }

    container.innerHTML = archived.map(act => {
        let statusBadge = '<span class="badge bg-secondary text-white"><i class="bi bi-check2-all me-1"></i>Completed</span>';
        if (act.status === 'Cancelled') {
            statusBadge = '<span class="badge bg-danger text-white"><i class="bi bi-x-octagon-fill me-1"></i>Cancelled</span>';
        } else if (act.status === 'Postponed') {
            statusBadge = '<span class="badge bg-warning text-dark"><i class="bi bi-clock-history me-1"></i>Postponed</span>';
        }

        return `
            <div class="card border rounded-3 p-2.5 mb-2 shadow-sm hover-shadow transition cursor-pointer" onclick="openViewSlotDetailsModal(${act.id})">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="badge bg-light text-dark border font-monospace" style="font-size: 0.7rem;">${escapeHtml(act.program_code)}</span>
                    ${statusBadge}
                </div>
                <h6 class="fw-bold text-dark mb-1 text-truncate" style="font-size: 0.85rem;">${escapeHtml(act.title)}</h6>
                <div class="text-muted small" style="font-size: 0.75rem;">
                    <div><i class="bi bi-calendar-event me-1"></i>Date: ${act.start_date}</div>
                    <div class="text-truncate"><i class="bi bi-geo-alt me-1"></i>${escapeHtml(act.location)}</div>
                    ${act.status === 'Cancelled' && act.cancellation_reason ? `<div class="text-danger mt-1 text-truncate"><i class="bi bi-info-circle me-1"></i>Reason: ${escapeHtml(act.cancellation_reason)}</div>` : ''}
                    ${act.status === 'Postponed' && act.postponement_reason ? `<div class="text-warning mt-1 text-truncate"><i class="bi bi-clock me-1"></i>Reason: ${escapeHtml(act.postponement_reason)}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Slots List View (Alternative Flat View)
 */
function renderSlotsListView() {
    const tbody = document.getElementById('schedulesRosterTableBody');
    const badge = document.getElementById('schedListCountBadge');
    if (!tbody) return;

    const filtered = getFilteredActivitiesList();
    if (badge) badge.textContent = `${filtered.length} Total Slots`;

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No scheduled slots matching filter criteria.</td></tr>';
        return;
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    tbody.innerHTML = filtered.map(act => {
        let statusBadge = '<span class="badge bg-primary text-white"><i class="bi bi-broadcast me-1"></i>Scheduled</span>';
        if (act.status === 'Cancelled') {
            statusBadge = '<span class="badge bg-danger text-white"><i class="bi bi-x-octagon-fill me-1"></i>Cancelled</span>';
        } else if (act.status === 'Postponed') {
            statusBadge = '<span class="badge bg-warning text-dark"><i class="bi bi-clock-history me-1"></i>Postponed</span>';
        } else if (act.status === 'Completed') {
            statusBadge = '<span class="badge bg-secondary text-white"><i class="bi bi-check2-all me-1"></i>Completed</span>';
        } else if (act.start_date === todayStr) {
            statusBadge = '<span class="badge bg-success text-white"><i class="bi bi-play-circle-fill me-1"></i>Today</span>';
        }

        return `
            <tr>
                <td>
                    <div class="fw-bold text-dark">${escapeHtml(act.category)}</div>
                    <span class="badge bg-light text-primary border font-monospace">${escapeHtml(act.program_code)}</span>
                </td>
                <td>
                    <strong class="text-dark">${escapeHtml(act.title)}</strong>
                    <div class="small text-muted"><i class="bi bi-award me-1"></i>${escapeHtml(act.program_name)}</div>
                </td>
                <td>
                    <div class="fw-semibold text-dark"><i class="bi bi-calendar-event me-1 text-primary"></i>${act.start_date}${act.end_date && act.end_date !== act.start_date ? ' to ' + act.end_date : ''}</div>
                    <small class="text-muted">${act.time} (${act.duration})</small>
                </td>
                <td>
                    <div class="text-dark text-truncate" style="max-width: 180px;"><i class="bi bi-geo-alt me-1 text-danger"></i>${escapeHtml(act.location)}</div>
                </td>
                <td>
                    <div class="text-dark"><i class="bi bi-person-badge me-1 text-info"></i>${escapeHtml(act.officer_name)}</div>
                </td>
                <td class="text-center">${statusBadge}</td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info" onclick="openViewSlotDetailsModal(${act.id})" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        ${act.status !== 'Cancelled' && act.status !== 'Completed' ? `
                            <button class="btn btn-outline-primary" onclick="openEditActivityModal(${act.id})" title="Edit Activity">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-warning text-dark" onclick="openPostponeModal(${act.id})" title="Postpone Activity">
                                <i class="bi bi-clock-history"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="openCancelModal(${act.id})" title="Cancel Activity">
                                <i class="bi bi-x-octagon"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Open Streamlined Create Schedule Slot Modal
 */
function openCreateScheduleSlotModal(defaultDate) {
    const form = document.getElementById('createSchedSlotForm');
    if (form) form.reset();

    const dateInput = document.getElementById('actStartDate');
    const endDateInput = document.getElementById('actEndDate');
    const startTimeInput = document.getElementById('actStartTime');
    const endTimeInput = document.getElementById('actEndTime');
    const progSelect = document.getElementById('actTargetProgramSelect');

    const todayStr = new Date().toISOString().substring(0, 10);
    if (dateInput) dateInput.value = defaultDate || todayStr;
    if (endDateInput) endDateInput.value = defaultDate || todayStr;
    if (startTimeInput) startTimeInput.value = '09:00';
    if (endTimeInput) endTimeInput.value = '11:00';

    // Auto-select the first active program by default
    if (progSelect && progSelect.options.length > 1) {
        progSelect.selectedIndex = 1;
    }

    const alertBox = document.getElementById('schedSafeguardAlert');
    if (alertBox) alertBox.classList.add('d-none');

    populateSchedulingDropdowns();
    handleActCategoryChange();
    handleActLocationChange();
    calculateActDuration();

    safeOpenModal('createActivityModal');
}
window.openCreateScheduleSlotModal = openCreateScheduleSlotModal;

/**
 * Category Change Handler: Toggle Others Category & Cert Recipients Engine
 */
function handleActCategoryChange() {
    const catSelect = document.getElementById('actCategorySelect');
    const otherCont = document.getElementById('actCategoryOtherContainer');
    const certCont = document.getElementById('actCertRecipientsContainer');

    if (!catSelect) return;
    const val = catSelect.value;

    if (otherCont) {
        if (val === 'Others') otherCont.classList.remove('d-none');
        else otherCont.classList.add('d-none');
    }

    if (certCont) {
        if (val === 'Certificate Distribution') {
            certCont.classList.remove('d-none');
            pullCertificateEligibleRecipients();
        } else {
            certCont.classList.add('d-none');
        }
    }
}
window.handleActCategoryChange = handleActCategoryChange;

function handleActLocationChange() {
    const locSelect = document.getElementById('actLocationSelect');
    const otherCont = document.getElementById('actLocationOtherContainer');
    if (!locSelect || !otherCont) return;

    if (locSelect.value === 'Others') {
        otherCont.classList.remove('d-none');
    } else {
        otherCont.classList.add('d-none');
    }
}
window.handleActLocationChange = handleActLocationChange;

function handleActProgramChange() {
    pullCertificateEligibleRecipients();
}
window.handleActProgramChange = handleActProgramChange;

/**
 * Auto-Pull Eligible Recipients for Certificate Distribution
 */
async function pullCertificateEligibleRecipients() {
    const listEl = document.getElementById('actCertRecipientsList');
    const badge = document.getElementById('actCertRecipientCountBadge');
    if (!listEl) return;

    const progSelect = document.getElementById('actTargetProgramSelect');
    const progId = progSelect?.value;

    listEl.innerHTML = '<div class="text-muted py-2"><span class="spinner-border spinner-border-sm me-1"></span>Pulling completed beneficiaries...</div>';

    try {
        let applications = [];
        if (typeof DataService !== 'undefined' && DataService.applications) {
            const res = await DataService.applications.getAll({ status: 'Approved' });
            if (res.data) applications = res.data;
        }

        let eligible = applications;
        if (progId) {
            eligible = applications.filter(a => String(a.program_id) === String(progId));
        }

        if (badge) badge.textContent = `${eligible.length} Eligible Recipients`;

        if (eligible.length === 0) {
            listEl.innerHTML = '<div class="text-muted py-1">No completed beneficiaries currently pending certificate distribution for this program.</div>';
        } else {
            listEl.innerHTML = eligible.slice(0, 8).map((app, idx) => `
                <div class="d-flex justify-content-between align-items-center py-1 border-bottom">
                    <div><strong>${idx + 1}. ${escapeHtml((app.beneficiary && `${app.beneficiary.first_name} ${app.beneficiary.last_name}`) || app.beneficiary_qr)}</strong></div>
                    <span class="badge bg-success-subtle text-success">Completed</span>
                </div>
            `).join('') + (eligible.length > 8 ? `<div class="text-primary text-center pt-1">+ ${eligible.length - 8} more completed recipients</div>` : '');
        }
    } catch (e) {
        listEl.innerHTML = '<div class="text-muted py-1">All enrolled program participants included.</div>';
    }
}

/**
 * Calculate Activity Duration (Supports minute precision and multi-day spans)
 */
function calculateActDuration() {
    const startD = document.getElementById('actStartDate')?.value;
    const endD = document.getElementById('actEndDate')?.value || startD;
    const startT = document.getElementById('actStartTime')?.value || '09:00';
    const endT = document.getElementById('actEndTime')?.value || '11:00';
    const display = document.getElementById('actCalculatedDuration');

    if (!startD || !display) return;

    const startDateTime = new Date(`${startD}T${startT}:00`);
    const endDateTime = new Date(`${endD}T${endT}:00`);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        display.textContent = 'Invalid Time';
        return;
    }

    const diffMs = endDateTime - startDateTime;
    if (diffMs <= 0) {
        display.textContent = '0 Minutes (End must be after Start)';
        display.className = 'p-2 bg-danger-subtle border border-danger rounded text-center fw-bold text-danger';
        return;
    }

    display.className = 'p-2 bg-light border rounded text-center fw-bold text-primary';

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(diffMinutes / (60 * 24));
    const hours = Math.floor((diffMinutes % (60 * 24)) / 60);
    const mins = diffMinutes % 60;

    let parts = [];
    if (days > 0) parts.push(`${days} Day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} Hour${hours > 1 ? 's' : ''}`);
    if (mins > 0) parts.push(`${mins} Minute${mins > 1 ? 's' : ''}`);

    display.textContent = parts.join(' ') || '0 Minutes';
}
window.calculateActDuration = calculateActDuration;

/**
 * Submit Create Schedule Slot Form (Streamlined)
 */
async function handleCreateScheduleSlotSubmit(event) {
    if (event) event.preventDefault();

    const title = document.getElementById('actSubjectTitle')?.value.trim();
    const category = document.getElementById('actCategorySelect')?.value;
    const categoryOther = document.getElementById('actCategoryOtherInput')?.value.trim();
    const progId = document.getElementById('actTargetProgramSelect')?.value;
    const officerId = document.getElementById('actOfficerSelect')?.value || null; // Optional
    const locationSelect = document.getElementById('actLocationSelect')?.value;
    const locationOther = document.getElementById('actLocationOtherInput')?.value.trim();
    const startDate = document.getElementById('actStartDate')?.value;
    const endDate = document.getElementById('actEndDate')?.value || startDate;
    const startTime = document.getElementById('actStartTime')?.value;
    const endTime = document.getElementById('actEndTime')?.value;
    const duration = document.getElementById('actCalculatedDuration')?.textContent.trim();
    const remarks = document.getElementById('actRemarks')?.value.trim();

    const alertBox = document.getElementById('schedSafeguardAlert');
    const alertMsg = document.getElementById('schedSafeguardAlertMsg');

    const showAlert = (msg) => {
        if (alertBox && alertMsg) {
            alertMsg.textContent = msg;
            alertBox.classList.remove('d-none');
        } else {
            alert(msg);
        }
    };

    // 1. Validation Rules
    if (!title || !category || !progId || !startDate || !startTime || !endTime) {
        showAlert('Validation Error: Please fill in all required fields marked with *.');
        return;
    }

    if (category === 'Others' && !categoryOther) {
        showAlert('Validation Error: Please specify the custom category name.');
        return;
    }

    const finalLocation = locationSelect === 'Others' ? locationOther : locationSelect;
    if (locationSelect === 'Others' && !locationOther) {
        showAlert('Validation Error: Please specify the custom location address.');
        return;
    }

    // 2. Date Validations
    if (endDate < startDate) {
        showAlert('Validation Error: End Date cannot be earlier than Start Date.');
        return;
    }

    if (startDate === endDate && endTime <= startTime) {
        showAlert('Validation Error: End Time must be later than Start Time on the same day.');
        return;
    }

    // 3. Past Date Guard
    const todayStr = new Date().toISOString().substring(0, 10);
    if (startDate < todayStr) {
        showAlert('Past Date Restriction: System blocks scheduling activities on past dates. Please select today or a future date.');
        return;
    }

    // 4. Conflict Detection
    if (officerId) {
        const hasOfficerConflict = activitiesList.some(a => {
            if (a.status === 'Cancelled' || a.status === 'Completed') return false;
            if (String(a.officer_id) !== String(officerId)) return false;
            if (a.start_date !== startDate) return false;
            return (a.start_time === startTime || a.time.includes(startTime));
        });

        if (hasOfficerConflict) {
            showAlert('Schedule Conflict Detected: The assigned PESO Officer already has another scheduled activity during this time slot.');
            return;
        }
    }

    const hasVenueConflict = activitiesList.some(a => {
        if (a.status === 'Cancelled' || a.status === 'Completed') return false;
        if (a.location !== finalLocation) return false;
        if (a.start_date !== startDate) return false;
        return (a.start_time === startTime || a.time.includes(startTime));
    });

    if (hasVenueConflict) {
        showAlert('Venue Conflict Detected: The selected location/venue is already booked for another activity during this time slot.');
        return;
    }

    // 5. Build Payload & Save via DataService
    const payload = {
        title: title,
        category: category === 'Others' ? categoryOther : category,
        category_other: category === 'Others' ? categoryOther : null,
        program_id: parseInt(progId, 10),
        officer_id: officerId ? parseInt(officerId, 10) : null,
        venue_location: finalLocation,
        location_other: locationSelect === 'Others' ? locationOther : null,
        interview_date: startDate,
        start_date: startDate,
        end_date: endDate,
        interview_time: startTime,
        start_time: startTime,
        end_time: endTime,
        duration: duration,
        status: 'Scheduled',
        remarks: remarks
    };

    const submitBtn = document.getElementById('btnSubmitCreateSchedSlot');
    if (submitBtn) submitBtn.disabled = true;

    try {
        let res = null;
        if (typeof DataService !== 'undefined' && DataService.interviews) {
            res = await DataService.interviews.create(payload);
        } else if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            res = await supabaseClient.from('interview_schedules').insert(payload).select().single();
        }

        if (res && res.error) {
            throw res.error;
        }

        safeHideModal('createActivityModal');
        alert(`Success: Scheduled activity slot "${title}" created and published in real-time.`);
        await initSchedulingModuleData();
    } catch (err) {
        console.error('[SCHEDULING] Creation error:', err);
        showAlert(`Error saving schedule slot: ${err.message || err}`);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}
window.handleCreateScheduleSlotSubmit = handleCreateScheduleSlotSubmit;

/**
 * View Activity Details Modal
 */
function openViewSlotDetailsModal(id) {
    const act = activitiesList.find(a => String(a.id) === String(id));
    if (!act) return;

    activeViewingActivityId = id;

    const modalBody = document.getElementById('viewSchedDetailsModalBody');
    const actionsDiv = document.getElementById('viewSchedDetailsActions');

    let statusBadge = '<span class="badge bg-primary text-white"><i class="bi bi-broadcast me-1"></i>Scheduled</span>';
    if (act.status === 'Cancelled') {
        statusBadge = '<span class="badge bg-danger text-white"><i class="bi bi-x-octagon-fill me-1"></i>Cancelled</span>';
    } else if (act.status === 'Postponed') {
        statusBadge = '<span class="badge bg-warning text-dark"><i class="bi bi-clock-history me-1"></i>Postponed</span>';
    } else if (act.status === 'Completed') {
        statusBadge = '<span class="badge bg-secondary text-white"><i class="bi bi-check2-all me-1"></i>Completed</span>';
    }

    if (modalBody) {
        modalBody.innerHTML = `
            <div class="d-flex justify-content-between align-items-start mb-3 pb-2 border-bottom">
                <div>
                    <span class="badge bg-light text-dark border font-monospace me-1">${escapeHtml(act.slot_id)}</span>
                    <span class="badge bg-primary-subtle text-primary font-monospace">${escapeHtml(act.category)}</span>
                    <h5 class="fw-bold text-dark mt-2 mb-0">${escapeHtml(act.title)}</h5>
                </div>
                <div>${statusBadge}</div>
            </div>

            <div class="row g-3 small">
                <div class="col-md-6">
                    <label class="text-muted fw-semibold">Target Program</label>
                    <div class="fw-bold text-dark fs-6">${escapeHtml(act.program_name)} (${escapeHtml(act.program_code)})</div>
                </div>
                <div class="col-md-6">
                    <label class="text-muted fw-semibold">Assigned PESO Officer</label>
                    <div class="fw-bold text-dark fs-6"><i class="bi bi-person-badge text-info me-1"></i>${escapeHtml(act.officer_name)}</div>
                </div>
                <div class="col-md-6">
                    <label class="text-muted fw-semibold">Schedule Date & Time</label>
                    <div class="fw-bold text-dark"><i class="bi bi-calendar-event text-primary me-1"></i>${act.start_date}${act.end_date && act.end_date !== act.start_date ? ' to ' + act.end_date : ''}</div>
                    <div class="text-muted">${act.time}</div>
                </div>
                <div class="col-md-6">
                    <label class="text-muted fw-semibold">Calculated Duration</label>
                    <div class="fw-bold text-primary"><i class="bi bi-hourglass-split me-1"></i>${act.duration}</div>
                </div>
                <div class="col-12">
                    <label class="text-muted fw-semibold">Location / Platform</label>
                    <div class="fw-bold text-dark"><i class="bi bi-geo-alt text-danger me-1"></i>${escapeHtml(act.location)}</div>
                </div>
                ${act.remarks ? `
                    <div class="col-12">
                        <label class="text-muted fw-semibold">Notes / Remarks</label>
                        <div class="p-2 bg-light rounded border text-secondary">${escapeHtml(act.remarks)}</div>
                    </div>
                ` : ''}
                ${act.status === 'Postponed' && act.postponement_reason ? `
                    <div class="col-12">
                        <div class="alert alert-warning py-2 mb-0">
                            <strong><i class="bi bi-clock-history me-1"></i>Postponement Record:</strong> ${escapeHtml(act.postponement_reason)}
                            ${act.postponed_by ? `<div class="small text-muted mt-1">Recorded by ${escapeHtml(act.postponed_by)} on ${act.postponed_at ? new Date(act.postponed_at).toLocaleString() : 'Recent'}</div>` : ''}
                        </div>
                    </div>
                ` : ''}
                ${act.status === 'Cancelled' && act.cancellation_reason ? `
                    <div class="col-12">
                        <div class="alert alert-danger py-2 mb-0">
                            <strong><i class="bi bi-x-octagon-fill me-1"></i>Cancellation Record:</strong> ${escapeHtml(act.cancellation_reason)}
                            ${act.cancelled_by ? `<div class="small text-muted mt-1">Recorded by ${escapeHtml(act.cancelled_by)} on ${act.cancelled_at ? new Date(act.cancelled_at).toLocaleString() : 'Recent'}</div>` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    if (actionsDiv) {
        if (act.status !== 'Cancelled' && act.status !== 'Completed') {
            actionsDiv.innerHTML = `
                <button type="button" class="btn btn-outline-primary fw-semibold" onclick="openEditActivityModal(${act.id})">
                    <i class="bi bi-pencil-square me-1"></i> Edit / Reschedule
                </button>
                <button type="button" class="btn btn-warning fw-semibold text-dark" onclick="openPostponeModal(${act.id})">
                    <i class="bi bi-clock-history me-1"></i> Postpone Activity
                </button>
                <button type="button" class="btn btn-danger fw-semibold" onclick="openCancelModal(${act.id})">
                    <i class="bi bi-x-octagon-fill me-1"></i> Cancel Activity
                </button>
            `;
        } else {
            actionsDiv.innerHTML = `<span class="badge bg-light text-muted border py-2 px-3">Archived Record • Read Only</span>`;
        }
    }

    safeOpenModal('viewScheduleSlotDetailsModal');
}
window.openViewSlotDetailsModal = openViewSlotDetailsModal;

/**
 * Open Edit / Reschedule Activity Modal
 */
function openEditActivityModal(id) {
    const act = activitiesList.find(a => String(a.id) === String(id));
    if (!act) return;

    safeHideModal('viewScheduleSlotDetailsModal');
    populateSchedulingDropdowns();

    document.getElementById('editSlotId').value = act.id;
    document.getElementById('editActSubjectTitle').value = act.title;
    document.getElementById('editActCategorySelect').value = (act.category === 'Assistance Distribution' || act.category === 'Certificate Distribution') ? act.category : 'Others';
    
    if (act.category !== 'Assistance Distribution' && act.category !== 'Certificate Distribution') {
        document.getElementById('editActCategoryOtherContainer').classList.remove('d-none');
        document.getElementById('editActCategoryOtherInput').value = act.category;
    } else {
        document.getElementById('editActCategoryOtherContainer').classList.add('d-none');
    }

    document.getElementById('editActTargetProgramSelect').value = act.program_id;
    document.getElementById('editActOfficerSelect').value = act.officer_id || '';

    const locSelect = document.getElementById('editActLocationSelect');
    let matchedLoc = false;
    for (let opt of locSelect.options) {
        if (opt.value === act.location) {
            locSelect.value = act.location;
            matchedLoc = true;
            break;
        }
    }
    if (!matchedLoc) {
        locSelect.value = 'Others';
        document.getElementById('editActLocationOtherContainer').classList.remove('d-none');
        document.getElementById('editActLocationOtherInput').value = act.location;
    } else {
        document.getElementById('editActLocationOtherContainer').classList.add('d-none');
    }

    document.getElementById('editActStartDate').value = act.start_date;
    document.getElementById('editActEndDate').value = act.end_date || act.start_date;
    document.getElementById('editActStartTime').value = act.start_time || '09:00';
    document.getElementById('editActEndTime').value = act.end_time || '11:00';
    document.getElementById('editActRemarks').value = act.remarks || '';

    calculateEditActDuration();

    const alertBox = document.getElementById('editSchedSafeguardAlert');
    if (alertBox) alertBox.classList.add('d-none');

    safeOpenModal('editActivityModal');
}
window.openEditActivityModal = openEditActivityModal;

function handleEditActCategoryChange() {
    const cat = document.getElementById('editActCategorySelect')?.value;
    const cont = document.getElementById('editActCategoryOtherContainer');
    if (cont) {
        if (cat === 'Others') cont.classList.remove('d-none');
        else cont.classList.add('d-none');
    }
}
window.handleEditActCategoryChange = handleEditActCategoryChange;

function handleEditActLocationChange() {
    const loc = document.getElementById('editActLocationSelect')?.value;
    const cont = document.getElementById('editActLocationOtherContainer');
    if (cont) {
        if (loc === 'Others') cont.classList.remove('d-none');
        else cont.classList.add('d-none');
    }
}
window.handleEditActLocationChange = handleEditActLocationChange;

function calculateEditActDuration() {
    const startD = document.getElementById('editActStartDate')?.value;
    const endD = document.getElementById('editActEndDate')?.value || startD;
    const startT = document.getElementById('editActStartTime')?.value || '09:00';
    const endT = document.getElementById('editActEndTime')?.value || '11:00';
    const display = document.getElementById('editActCalculatedDuration');

    if (!startD || !display) return;

    const startDateTime = new Date(`${startD}T${startT}:00`);
    const endDateTime = new Date(`${endD}T${endT}:00`);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        display.textContent = 'Invalid Time';
        return;
    }

    const diffMs = endDateTime - startDateTime;
    if (diffMs <= 0) {
        display.textContent = '0 Minutes (End must be after Start)';
        display.className = 'p-2 bg-danger-subtle border border-danger rounded text-center fw-bold text-danger';
        return;
    }

    display.className = 'p-2 bg-light border rounded text-center fw-bold text-primary';

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(diffMinutes / (60 * 24));
    const hours = Math.floor((diffMinutes % (60 * 24)) / 60);
    const mins = diffMinutes % 60;

    let parts = [];
    if (days > 0) parts.push(`${days} Day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} Hour${hours > 1 ? 's' : ''}`);
    if (mins > 0) parts.push(`${mins} Minute${mins > 1 ? 's' : ''}`);

    display.textContent = parts.join(' ') || '0 Minutes';
}
window.calculateEditActDuration = calculateEditActDuration;

/**
 * Handle Save Activity Updates / Reschedule
 */
async function handleSaveActivityUpdates(event) {
    if (event) event.preventDefault();

    const id = document.getElementById('editSlotId')?.value;
    const title = document.getElementById('editActSubjectTitle')?.value.trim();
    const category = document.getElementById('editActCategorySelect')?.value;
    const categoryOther = document.getElementById('editActCategoryOtherInput')?.value.trim();
    const progId = document.getElementById('editActTargetProgramSelect')?.value;
    const officerId = document.getElementById('editActOfficerSelect')?.value || null;
    const locationSelect = document.getElementById('editActLocationSelect')?.value;
    const locationOther = document.getElementById('editActLocationOtherInput')?.value.trim();
    const startDate = document.getElementById('editActStartDate')?.value;
    const endDate = document.getElementById('editActEndDate')?.value || startDate;
    const startTime = document.getElementById('editActStartTime')?.value;
    const endTime = document.getElementById('editActEndTime')?.value;
    const duration = document.getElementById('editActCalculatedDuration')?.textContent.trim();
    const remarks = document.getElementById('editActRemarks')?.value.trim();

    const alertBox = document.getElementById('editSchedSafeguardAlert');
    const alertMsg = document.getElementById('editSchedSafeguardAlertMsg');

    const showAlert = (msg) => {
        if (alertBox && alertMsg) {
            alertMsg.textContent = msg;
            alertBox.classList.remove('d-none');
        } else {
            alert(msg);
        }
    };

    if (!id || !title || !category || !progId || !startDate || !startTime || !endTime) {
        showAlert('Validation Error: Please fill in all required fields.');
        return;
    }

    if (endDate < startDate) {
        showAlert('Validation Error: End Date cannot be earlier than Start Date.');
        return;
    }

    if (startDate === endDate && endTime <= startTime) {
        showAlert('Validation Error: End Time must be later than Start Time on the same day.');
        return;
    }

    const finalLocation = locationSelect === 'Others' ? locationOther : locationSelect;

    // Conflict Check (excluding current slot)
    if (officerId) {
        const hasOfficerConflict = activitiesList.some(a => {
            if (String(a.id) === String(id)) return false;
            if (a.status === 'Cancelled' || a.status === 'Completed') return false;
            if (String(a.officer_id) !== String(officerId)) return false;
            if (a.start_date !== startDate) return false;
            return (a.start_time === startTime || a.time.includes(startTime));
        });

        if (hasOfficerConflict) {
            showAlert('Schedule Conflict Detected: The assigned PESO Officer already has another scheduled activity during this time slot.');
            return;
        }
    }

    const updatePayload = {
        title: title,
        category: category === 'Others' ? categoryOther : category,
        category_other: category === 'Others' ? categoryOther : null,
        program_id: parseInt(progId, 10),
        officer_id: officerId ? parseInt(officerId, 10) : null,
        venue_location: finalLocation,
        location_other: locationSelect === 'Others' ? locationOther : null,
        interview_date: startDate,
        start_date: startDate,
        end_date: endDate,
        interview_time: startTime,
        start_time: startTime,
        end_time: endTime,
        duration: duration,
        status: 'Scheduled', // Updates status back to Scheduled if previously Postponed
        remarks: remarks
    };

    const btn = document.getElementById('btnSubmitEditSchedSlot');
    if (btn) btn.disabled = true;

    try {
        let res = null;
        if (typeof DataService !== 'undefined' && DataService.interviews) {
            res = await DataService.interviews.update(id, updatePayload);
        } else if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            res = await supabaseClient.from('interview_schedules').update(updatePayload).eq('id', id);
        }

        if (res && res.error) throw res.error;

        safeHideModal('editActivityModal');
        alert('Success: Activity schedule updated and re-published.');
        await initSchedulingModuleData();
    } catch (err) {
        console.error('[SCHEDULING] Update error:', err);
        showAlert(`Error saving updates: ${err.message || err}`);
    } finally {
        if (btn) btn.disabled = false;
    }
}
window.handleSaveActivityUpdates = handleSaveActivityUpdates;

/**
 * Postpone Activity Handlers
 */
function openPostponeModal(id) {
    const act = activitiesList.find(a => String(a.id) === String(id));
    if (!act) return;

    safeHideModal('viewScheduleSlotDetailsModal');

    document.getElementById('postponeSlotId').value = id;
    const titleEl = document.getElementById('postponeActivityTitleDisplay');
    if (titleEl) titleEl.textContent = `${act.title} (${act.start_date})`;
    if (document.getElementById('postponeReasonInput')) document.getElementById('postponeReasonInput').value = '';

    safeOpenModal('postponeActivityModal');
}
window.openPostponeModal = openPostponeModal;

async function handlePostponeActivitySubmit(event) {
    if (event) event.preventDefault();

    const id = document.getElementById('postponeSlotId')?.value;
    const reason = document.getElementById('postponeReasonInput')?.value.trim();

    if (!id || !reason) {
        alert('Please provide a reason for postponing this activity.');
        return;
    }

    try {
        let res = null;
        if (typeof DataService !== 'undefined' && DataService.interviews && DataService.interviews.postpone) {
            res = await DataService.interviews.postpone(id, { reason: reason, postponed_by: sessionStorage.getItem('username') || 'PESO Admin' });
        } else if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            res = await supabaseClient.from('interview_schedules').update({
                status: 'Postponed',
                postponed_at: new Date().toISOString(),
                postponement_reason: reason,
                postponed_by: sessionStorage.getItem('username') || 'PESO Admin'
            }).eq('id', id);
        }

        safeHideModal('postponeActivityModal');
        alert('Success: Activity status updated to Postponed (Yellow). Administrative log recorded.');
        await initSchedulingModuleData();
    } catch (err) {
        console.error('[SCHEDULING] Postpone error:', err);
        alert(`Error postponing activity: ${err.message || err}`);
    }
}
window.handlePostponeActivitySubmit = handlePostponeActivitySubmit;

/**
 * Cancel Activity Handlers
 */
function openCancelModal(id) {
    const act = activitiesList.find(a => String(a.id) === String(id));
    if (!act) return;

    safeHideModal('viewScheduleSlotDetailsModal');

    document.getElementById('cancelSlotId').value = id;
    const titleEl = document.getElementById('cancelActivityTitleDisplay');
    if (titleEl) titleEl.textContent = `${act.title} (${act.start_date})`;
    if (document.getElementById('cancelReasonInput')) document.getElementById('cancelReasonInput').value = '';

    safeOpenModal('cancelActivityModal');
}
window.openCancelModal = openCancelModal;

async function handleCancelActivitySubmit(event) {
    if (event) event.preventDefault();

    const id = document.getElementById('cancelSlotId')?.value;
    const reason = document.getElementById('cancelReasonInput')?.value.trim();

    if (!id || !reason) {
        alert('Please provide a reason for cancelling this activity.');
        return;
    }

    try {
        let res = null;
        if (typeof DataService !== 'undefined' && DataService.interviews && DataService.interviews.cancel) {
            res = await DataService.interviews.cancel(id, { reason: reason, cancelled_by: sessionStorage.getItem('username') || 'PESO Admin' });
        } else if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            res = await supabaseClient.from('interview_schedules').update({
                status: 'Cancelled',
                cancelled_at: new Date().toISOString(),
                cancellation_reason: reason,
                cancelled_by: sessionStorage.getItem('username') || 'PESO Admin'
            }).eq('id', id);
        }

        safeHideModal('cancelActivityModal');
        alert('Success: Activity cancelled and moved to Archive Box while retained on historical calendar.');
        await initSchedulingModuleData();
    } catch (err) {
        console.error('[SCHEDULING] Cancel error:', err);
        alert(`Error cancelling activity: ${err.message || err}`);
    }
}
window.handleCancelActivitySubmit = handleCancelActivitySubmit;

// Window Exports
window.initSchedulingData = initSchedulingData;
window.initSchedulingModuleData = initSchedulingModuleData;
window.renderSchedulingModule = renderSchedulingModule;
window.handleCreateScheduleSlotSubmit = handleCreateScheduleSlotSubmit;
window.handleSaveActivityUpdates = handleSaveActivityUpdates;
window.handlePostponeActivitySubmit = handlePostponeActivitySubmit;
window.handleCancelActivitySubmit = handleCancelActivitySubmit;

// Explicit Form Event Binding on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    const createForm = document.getElementById('createSchedSlotForm');
    if (createForm) {
        createForm.addEventListener('submit', handleCreateScheduleSlotSubmit);
    }
    const editForm = document.getElementById('editActivityForm');
    if (editForm) {
        editForm.addEventListener('submit', handleSaveActivityUpdates);
    }
    const postponeForm = document.getElementById('postponeActivityForm');
    if (postponeForm) {
        postponeForm.addEventListener('submit', handlePostponeActivitySubmit);
    }
    const cancelForm = document.getElementById('cancelActivityForm');
    if (cancelForm) {
        cancelForm.addEventListener('submit', handleCancelActivitySubmit);
    }
});

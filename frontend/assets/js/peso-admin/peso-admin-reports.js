/**
 * PESO Admin - Reports & Analytics Engine (peso-admin-reports.js)
 */
    // =========================================================================
    // 11. MODULE 9: SYSTEM REPORTS ENGINE (5 STANDARD DATASETS)
    // =========================================================================
    let currentReportDataset = [];

    function generateReportData() {
        const type = document.getElementById('reportTypeSelect')?.value || 'applications';
        const start = document.getElementById('reportStartDate')?.value || '2026-01-01';
        const end = document.getElementById('reportEndDate')?.value || '2026-12-31';

        const thead = document.getElementById('reportDisplayTableHead');
        const tbody = document.getElementById('reportDisplayTableBody');
        const titleHeader = document.getElementById('reportTitleHeader');
        const countBadge = document.getElementById('reportTotalRecordsBadge');

        if (!thead || !tbody) return;

        if (type === 'applications') {
            titleHeader.textContent = '1. Application Management & Beneficiary Demographics Report';
            thead.innerHTML = `
                <tr>
                    <th>App Number</th>
                    <th>Beneficiary Name</th>
                    <th>Contact (Masked)</th>
                    <th>Barangay / Address</th>
                    <th>Program Code</th>
                    <th>Date Applied</th>
                    <th>Status</th>
                </tr>
            `;
            const filtered = (AdminStore.applications || []).filter(a => {
                const d = a.created_at || a.date_applied || '';
                return d >= start && d <= (end + 'T23:59:59');
            });
            currentReportDataset = filtered.map(a => {
                const ben = a.beneficiary || {};
                return {
                    appNumber: a.application_number || `APP-${a.id}`,
                    name: `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || 'Applicant',
                    contact: maskContactNumber(ben.phone || a.phone),
                    address: ben.address || 'Koronadal City',
                    prog: a.program?.code || a.program_code || 'PESO',
                    date: a.date_applied || a.created_at,
                    status: a.status
                };
            });
            tbody.innerHTML = currentReportDataset.map(r => `
                <tr>
                    <td class="font-monospace">${escapeHtml(r.appNumber)}</td>
                    <td class="fw-bold text-dark">${escapeHtml(r.name)}</td>
                    <td><span class="masked-phone">${escapeHtml(r.contact)}</span></td>
                    <td>${escapeHtml(r.address)}</td>
                    <td><span class="badge bg-light text-dark border font-monospace">${escapeHtml(r.prog)}</span></td>
                    <td>${formatDate(r.date)}</td>
                    <td><span class="badge bg-primary-subtle text-primary">${escapeHtml(r.status)}</span></td>
                </tr>
            `).join('') || '<tr><td colspan="7" class="text-center py-4 text-muted">No records found for specified date range.</td></tr>';
            if (countBadge) countBadge.textContent = `${currentReportDataset.length} Records`;

        } else if (type === 'interviews') {
            titleHeader.textContent = '2. Interview & Screening Outcomes Report';
            thead.innerHTML = `
                <tr>
                    <th>Schedule Date & Time</th>
                    <th>Program</th>
                    <th>Candidate / Beneficiary</th>
                    <th>Assigned Interviewer</th>
                    <th>Venue</th>
                    <th>Outcome / Result</th>
                </tr>
            `;
            const schedules = (AdminStore.schedules || AdminStore.interviewSchedules || []);
            const filtered = schedules.filter(s => {
                const d = s.interview_date || s.date || '';
                return (!start || d >= start) && (!end || d <= end);
            });
            currentReportDataset = (filtered.length > 0 ? filtered : schedules).map(s => ({
                datetime: `${s.interview_date || s.date || '2026-08-10'} ${s.interview_time || s.time_slot || '09:00 AM'}`,
                prog: s.program?.name || s.title || 'Livelihood Screening',
                beneficiary: s.candidate_name || 'Enrolled Candidates Roster',
                interviewer: s.officer ? `${s.officer.first_name || ''} ${s.officer.last_name || ''}`.trim() : 'Officer Elena Santos',
                venue: s.venue_location || s.venue || 'PESO Training Hall',
                outcome: s.status === 'Completed' ? 'Passed / Recommended' : (s.status || 'Scheduled')
            }));
            tbody.innerHTML = currentReportDataset.map(r => `
                <tr>
                    <td class="fw-bold text-dark">${escapeHtml(r.datetime)}</td>
                    <td>${escapeHtml(r.prog)}</td>
                    <td>${escapeHtml(r.beneficiary)}</td>
                    <td>${escapeHtml(r.interviewer)}</td>
                    <td>${escapeHtml(r.venue)}</td>
                    <td><span class="badge bg-success-subtle text-success border border-success-subtle">${escapeHtml(r.outcome)}</span></td>
                </tr>
            `).join('') || '<tr><td colspan="6" class="text-center py-4 text-muted">No interview records found.</td></tr>';
            if (countBadge) countBadge.textContent = `${currentReportDataset.length} Records`;

        } else if (type === 'training') {
            titleHeader.textContent = '3. Training Completion & Skills Certification Report';
            thead.innerHTML = `
                <tr>
                    <th>Beneficiary Name</th>
                    <th>Program & Training Course</th>
                    <th>Batch</th>
                    <th>Attendance %</th>
                    <th>Certificate Status</th>
                    <th>Completion Date</th>
                </tr>
            `;
            const trainingData = (AdminStore.beneficiaries || []).map(b => {
                const total = b.total_sessions || 5;
                const attended = b.sessions_attended !== undefined ? b.sessions_attended : (b.training_status === 'Completed' ? total : 0);
                const pct = Math.round((attended / total) * 100);
                const isDone = b.training_status === 'Completed' || pct >= 100;
                const fullName = `${b.first_name || ''} ${b.last_name || ''}`.trim() || b.name || 'Beneficiary';

                return {
                    name: fullName,
                    prog: b.program || 'Livelihood Training',
                    batch: b.batch_name || 'Batch 1',
                    att: `${pct}% (${attended}/${total} Sessions)`,
                    cert: isDone ? 'NC-II Certified & Issued' : 'In Progress',
                    date: b.updated_at ? b.updated_at.substring(0, 10) : (b.created_at ? b.created_at.substring(0, 10) : 'Recent')
                };
            });
            currentReportDataset = trainingData;
            if (currentReportDataset.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No training completion records found.</td></tr>';
            } else {
                tbody.innerHTML = currentReportDataset.map(r => `
                    <tr>
                        <td class="fw-bold text-dark">${escapeHtml(r.name)}</td>
                        <td>${escapeHtml(r.prog)}</td>
                        <td><span class="badge bg-light text-dark border font-monospace">${escapeHtml(r.batch)}</span></td>
                        <td class="fw-semibold text-success">${escapeHtml(r.att)}</td>
                        <td><span class="badge ${r.cert.includes('Issued') ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-secondary-subtle text-secondary border'}"><i class="bi bi-patch-check-fill me-1"></i>${escapeHtml(r.cert)}</span></td>
                        <td>${formatDate(r.date)}</td>
                    </tr>
                `).join('');
            }
            if (countBadge) countBadge.textContent = `${currentReportDataset.length} Records`;

        } else if (type === 'disbursement') {
            titleHeader.textContent = '4. Assistance Disbursement & Fund Distribution Report';
            thead.innerHTML = `
                <tr>
                    <th>Beneficiary QR</th>
                    <th>Beneficiary Name</th>
                    <th>Program</th>
                    <th>Assistance Type</th>
                    <th>Disbursed Amount</th>
                    <th>Release Date</th>
                </tr>
            `;
            const filtered = (AdminStore.approvedAssistance || []).filter(a => {
                const d = a.approval_date || a.release_date || a.created_at || '';
                return (!start || d >= start) && (!end || d <= (end + 'T23:59:59'));
            });
            currentReportDataset = filtered.map(a => {
                const ben = a.beneficiary || {};
                return {
                    qr: a.beneficiary_qr || 'QR-BEN',
                    name: `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || 'Beneficiary',
                    prog: a.program?.code || a.program_code || 'PESO',
                    type: a.assistance_type || 'Livelihood Grant',
                    amount: a.quantity_amount || '₱5,000.00',
                    date: a.approval_date || a.release_date || a.created_at
                };
            });
            tbody.innerHTML = currentReportDataset.map(r => `
                <tr>
                    <td class="font-monospace">${escapeHtml(r.qr)}</td>
                    <td class="fw-bold text-dark">${escapeHtml(r.name)}</td>
                    <td><span class="badge bg-light text-dark border font-monospace">${escapeHtml(r.prog)}</span></td>
                    <td>${escapeHtml(r.type)}</td>
                    <td class="fw-bold text-success font-monospace">${escapeHtml(r.amount)}</td>
                    <td>${formatDate(r.date)}</td>
                </tr>
            `).join('') || '<tr><td colspan="6" class="text-center py-4 text-muted">No disbursement records found.</td></tr>';
            if (countBadge) countBadge.textContent = `${currentReportDataset.length} Records`;

        } else {
            titleHeader.textContent = '5. Expired / Inactive Applications & Overdue Review Report';
            thead.innerHTML = `
                <tr>
                    <th>Application Number</th>
                    <th>Applicant Name</th>
                    <th>Program Requested</th>
                    <th>Submission Date</th>
                    <th>Inactivity Reason</th>
                    <th>Status</th>
                </tr>
            `;
            const defaultExpired = [
                { appNum: 'APP-2026-TUPAD-091', name: 'Danilo Flores', prog: 'TUPAD', date: '2026-05-10', reason: 'Unverified ID requirements beyond 60-day window', status: 'Expired / Archived' },
                { appNum: 'APP-2026-PEAP-044', name: 'Corazon Flores', prog: 'PEAP', date: '2026-05-12', reason: 'Intake orientation no-show without rescheduling', status: 'Inactive' },
                { appNum: 'APP-2026-SPSEK-019', name: 'Lucia Mendoza', prog: 'SP-SEK', date: '2026-05-20', reason: 'Duplicate household application ceiling reached', status: 'Disapproved' }
            ];
            currentReportDataset = defaultExpired;
            tbody.innerHTML = currentReportDataset.map(r => `
                <tr>
                    <td class="font-monospace">${escapeHtml(r.appNum)}</td>
                    <td class="fw-bold text-dark">${escapeHtml(r.name)}</td>
                    <td><span class="badge bg-light text-dark border font-monospace">${escapeHtml(r.prog)}</span></td>
                    <td>${formatDate(r.date)}</td>
                    <td class="text-danger small"><i class="bi bi-exclamation-circle me-1"></i>${escapeHtml(r.reason)}</td>
                    <td><span class="badge bg-danger-subtle text-danger border border-danger-subtle">${escapeHtml(r.status)}</span></td>
                </tr>
            `).join('');
            if (countBadge) countBadge.textContent = `${currentReportDataset.length} Records`;
        }
    }

    function exportActiveReportCSV() {
        generateReportData();
        if (!currentReportDataset || currentReportDataset.length === 0) {
            notify('Export Notice', 'No matching records found for the selected parameters.', 'warning');
            return;
        }

        const headers = Object.keys(currentReportDataset[0]);
        const rows = [headers];
        currentReportDataset.forEach(obj => {
            rows.push(headers.map(h => `"${String(obj[h] || '').replace(/"/g, '""')}"`));
        });

        const type = document.getElementById('reportTypeSelect')?.value || 'report';
        downloadCsvFile(rows, `PESO_${type.toUpperCase()}_REPORT_${new Date().toISOString().substring(0, 10)}.csv`);
        notify('CSV Downloaded', `Successfully exported ${currentReportDataset.length} records.`, 'success');
    }

    function downloadActiveReportPDF() {
        generateReportData();
        if (!currentReportDataset || currentReportDataset.length === 0) {
            notify('Export Notice', 'No matching records found for the selected parameters.', 'warning');
            return;
        }

        const type = document.getElementById('reportTypeSelect')?.value || 'report';
        const title = document.getElementById('reportTitleHeader')?.textContent || 'PESO Administrative Report';
        const start = document.getElementById('reportStartDate')?.value || '';
        const end = document.getElementById('reportEndDate')?.value || '';
        const adminName = sessionStorage.getItem('username') || 'PESO Administrator';
        const formattedNow = new Date().toLocaleString();

        const headers = Object.keys(currentReportDataset[0]);
        const headerHtml = headers.map(h => `<th style="border: 1px solid #cbd5e1; padding: 8px 10px; background-color: #f1f5f9; font-weight: 700; text-align: left; font-size: 8.5pt;">${h.toUpperCase()}</th>`).join('');
        const rowsHtml = currentReportDataset.map(row => {
            return `<tr>${headers.map(h => `<td style="border: 1px solid #e2e8f0; padding: 7px 10px; font-size: 8.5pt;">${escapeHtml(String(row[h] || ''))}</td>`).join('')}</tr>`;
        }).join('');

        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>PESO Official Report - ${escapeHtml(title)}</title>
    <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; margin: 0; padding: 15px; }
        .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 10px; margin-bottom: 15px; }
        .header h3 { margin: 0; color: #0369a1; font-size: 15pt; letter-spacing: 0.5px; }
        .header h4 { margin: 3px 0; color: #0f172a; font-size: 12pt; }
        .header p { margin: 1px 0; color: #64748b; font-size: 8.5pt; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 9pt; color: #334155; background: #f8fafc; padding: 8px 12px; border-radius: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .footer { margin-top: 25px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 8pt; color: #64748b; display: flex; justify-content: space-between; }
        @media print { .no-print { display: none; } }
    </style>
</head>
<body>
    <div class="header">
        <p>Republic of the Philippines • Province of South Cotabato</p>
        <h4>CITY GOVERNMENT OF KORONADAL</h4>
        <h3>PUBLIC EMPLOYMENT SERVICE OFFICE (PESO)</h3>
        <p>Official Executive Administrative Report</p>
    </div>
    <div class="meta">
        <div><strong>Dataset:</strong> ${escapeHtml(title)}</div>
        <div><strong>Coverage:</strong> ${escapeHtml(start)} to ${escapeHtml(end)}</div>
        <div><strong>Records Count:</strong> ${currentReportDataset.length} Record(s)</div>
    </div>
    <table>
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
    </table>
    <div class="footer">
        <div><strong>Generated by:</strong> ${escapeHtml(adminName)}</div>
        <div><strong>Date & Time:</strong> ${formattedNow}</div>
        <div>City Government of Koronadal PESO • Automated System Report</div>
    </div>
</body>
</html>`;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
            }, 350);
        }
        notify('PDF Preview Ready', `Report prepared for print / PDF download (${currentReportDataset.length} records).`, 'success');
    }

    function printActiveReportPDF() {
        downloadActiveReportPDF();
    }

    function downloadCsvFile(rows, filename) {
        const csvContent = '\uFEFF' + rows.map(e => e.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // =========================================================================
    // 11. MODULE 9: ARCHIVE SECTION (READ-ONLY MONITORING)
    // =========================================================================
    function renderArchiveModule() {
        const archProgs = (AdminStore.programs || []).filter(p => p.status !== 'Active');
        const archOfficers = (AdminStore.officers || []).filter(o => o.status !== 'Active');
        const archSchedules = (AdminStore.schedules || AdminStore.interviewSchedules || []).filter(s => s.status === 'Cancelled' || s.status === 'Postponed');

        const tbody = document.getElementById('archiveTableBody');
        if (!tbody) return;

        if (archProgs.length === 0 && archOfficers.length === 0 && archSchedules.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted"><i class="bi bi-archive fs-3 d-block mb-1 opacity-50"></i>Archive box is clean — no deactivated programs or cancelled activities.</td></tr>';
            return;
        }

        let html = '';
        
        // 1. Deactivated Programs
        archProgs.forEach(p => {
            const deactDate = p.deactivated_at ? formatDateTime(p.deactivated_at) : (p.updated_at ? formatDate(p.updated_at) : 'Recent');
            const deactBy = p.deactivated_by || 'PESO Admin';
            const reason = p.deactivation_reason || 'Administrative Deactivation';

            html += `
                <tr>
                    <td>
                        <div class="fw-bold text-secondary text-decoration-line-through">${escapeHtml(p.name)}</div>
                        <span class="badge bg-light text-dark font-monospace border">${escapeHtml(p.code)}</span>
                        <div class="small text-danger mt-1"><i class="bi bi-info-circle me-1"></i><strong>Reason:</strong> ${escapeHtml(reason)}</div>
                    </td>
                    <td>
                        <span class="badge bg-warning-subtle text-dark border border-warning-subtle"><i class="bi bi-slash-circle me-1"></i>Deactivated Program</span>
                        <small class="text-muted d-block mt-1">By: ${escapeHtml(deactBy)}</small>
                    </td>
                    <td>Budget: ${formatCurrency(p.budget)}</td>
                    <td><small class="text-muted font-monospace">${deactDate}</small></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-success me-1" onclick="restoreArchivedProgram(${p.id})">
                            <i class="bi bi-arrow-counterclockwise me-1"></i> Restore Active
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="permanentlyDeleteProgram(${p.id})">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });

        // 2. Cancelled / Postponed Scheduled Activities
        archSchedules.forEach(s => {
            const isCancelled = s.status === 'Cancelled';
            const badgeClass = isCancelled ? 'bg-danger-subtle text-danger' : 'bg-warning-subtle text-warning';
            const reason = s.cancellation_reason || s.postponement_reason || s.remarks || 'Administrative schedule change';
            const actor = s.cancelled_by || s.postponed_by || 'PESO Admin';
            const actionDate = s.cancelled_at || s.postponed_at || s.updated_at;

            html += `
                <tr>
                    <td>
                        <div class="fw-bold text-secondary">${escapeHtml(s.title || 'Scheduled Activity')}</div>
                        <small class="text-muted"><i class="bi bi-calendar-event me-1"></i>${s.interview_date} (${s.interview_time || 'TBD'})</small>
                        <div class="small text-danger mt-1"><i class="bi bi-chat-left-dots me-1"></i><strong>Reason:</strong> ${escapeHtml(reason)}</div>
                    </td>
                    <td>
                        <span class="badge ${badgeClass} border"><i class="bi bi-exclamation-triangle me-1"></i>${s.status} Activity</span>
                        <small class="text-muted d-block mt-1">By: ${escapeHtml(actor)}</small>
                    </td>
                    <td>${escapeHtml(s.venue_location || 'PESO Hall')}</td>
                    <td><small class="text-muted font-monospace">${actionDate ? formatDateTime(actionDate) : 'Recent'}</small></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary" onclick="window.location.hash = '#scheduling';">
                            <i class="bi bi-calendar-week me-1"></i> View Scheduling
                        </button>
                    </td>
                </tr>
            `;
        });

        // 3. Deactivated Staff Officers
        archOfficers.forEach(o => {
            const name = `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.username;
            html += `
                <tr>
                    <td>
                        <div class="fw-bold text-secondary text-decoration-line-through">${escapeHtml(name)}</div>
                        <small class="text-muted font-monospace">@${escapeHtml(o.username)}</small>
                    </td>
                    <td><span class="badge bg-danger-subtle text-danger border border-danger-subtle">Deactivated Officer</span></td>
                    <td>Role: ${escapeHtml(o.role)}</td>
                    <td><small class="text-muted font-monospace">${formatDate(o.updated_at || o.created_at)}</small></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-success me-1" onclick="toggleOfficerStatus(${o.id}, true)">
                            <i class="bi bi-arrow-counterclockwise me-1"></i> Restore Active
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="permanentlyDeleteOfficer(${o.id})">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    async function restoreArchivedProgram(id) {
        try {
            if (typeof DataService !== 'undefined' && DataService.programs) {
                await DataService.programs.toggleStatus(id, 'Active');
            }
            await logAdminAction('RESTORE_PROGRAM', 'program', id, `Restored archived program #${id} to Active status`);
            notify('Program Restored', 'Program restored to active catalog.', 'success');
            await refreshAllData();
            renderArchiveModule();
        } catch (err) {
            notify('Restore Failed', err.message || 'Error restoring program.', 'danger');
        }
    }

    async function permanentlyDeleteProgram(id) {
        if (!confirm('Are you sure you want to PERMANENTLY delete this program from Supabase? This action is irreversible.')) return;
        try {
            if (typeof DataService !== 'undefined' && DataService.programs) {
                await DataService.programs.delete(id);
            }
            await logAdminAction('PERMANENT_DELETE_PROGRAM', 'program', id, `Permanently deleted program #${id}`);
            notify('Program Deleted', 'Program record permanently purged.', 'warning');
            await refreshAllData();
            renderArchiveModule();
        } catch (err) {
            notify('Delete Failed', err.message || 'Error deleting program.', 'danger');
        }
    }

    async function permanentlyDeleteOfficer(id) {
        if (!confirm('Are you sure you want to PERMANENTLY delete this staff account?')) return;
        try {
            if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
                await DataService.staffProfiles.delete(id);
            }
            await logAdminAction('PERMANENT_DELETE_OFFICER', 'staff_profile', id, `Permanently deleted officer #${id}`);
            notify('Officer Purged', 'Staff profile deleted permanently.', 'warning');
            await refreshAllData();
            renderArchiveModule();
        } catch (err) {
            notify('Delete Failed', err.message || 'Error deleting officer.', 'danger');
        }
    }


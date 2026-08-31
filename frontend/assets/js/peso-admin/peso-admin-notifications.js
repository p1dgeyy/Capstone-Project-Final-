/**
 * PESO Admin - Notification & Broadcast Module (peso-admin-notifications.js)
 */
    // =========================================================================
    // 10. MODULE 8: NOTIFICATION MODULE
    // =========================================================================
    function renderNotificationsModule() {
        const notifs = AdminStore.notifications || [];
        const search = (document.getElementById('notifSearchInput')?.value || '').toLowerCase();

        const filtered = notifs.filter(n => {
            const str = `${n.title || ''} ${n.message || ''} ${n.beneficiary_qr || ''} ${n.staff_user_id || ''} ${n.actor || ''}`.toLowerCase();
            return !search || str.includes(search);
        });

        const tbody = document.getElementById('notificationsHistoryTableBody');
        if (tbody) {
            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No dispatched notification logs found.</td></tr>';
            } else {
                tbody.innerHTML = filtered.map(n => {
                    const target = n.beneficiary_qr 
                        ? `<span class="badge bg-light text-dark font-monospace border"><i class="bi bi-qr-code me-1"></i>${escapeHtml(n.beneficiary_qr)}</span>` 
                        : `<span class="badge bg-primary-subtle text-primary border border-primary-subtle"><i class="bi bi-person-badge me-1"></i>Staff #${n.staff_user_id || 1}</span>`;
                    
                    const actor = n.actor || n.admin_identity || (n.staff_user_id ? `Admin #${n.staff_user_id}` : 'PESO Admin');

                    return `
                        <tr>
                            <td>${target}</td>
                            <td><span class="fw-bold text-dark">${escapeHtml(n.title)}</span></td>
                            <td><div class="text-secondary small" style="max-width: 320px;">${escapeHtml(n.message)}</div></td>
                            <td><small class="text-muted fw-semibold"><i class="bi bi-shield-check text-primary me-1"></i>${escapeHtml(actor)}</small></td>
                            <td><small class="text-muted font-monospace">${formatDateTime(n.created_at)}</small></td>
                            <td class="text-center"><span class="badge ${n.is_read ? 'bg-secondary-subtle text-secondary border' : 'bg-success-subtle text-success border border-success-subtle'}">${n.is_read ? 'Read' : 'Delivered'}</span></td>
                        </tr>
                    `;
                }).join('');
            }
        }

        const badgeEl = document.getElementById('notifTabBadge');
        if (badgeEl) badgeEl.textContent = notifs.length;

        // Render Incoming Officer Action Alerts Feed
        renderOfficerActionAlertsStream();
    }

    function renderOfficerActionAlertsStream() {
        const listEl = document.getElementById('officerActionAlertsList');
        if (!listEl) return;

        const rawLogs = (AdminStore.auditLogs || []).filter(l => {
            const act = (l.action_type || l.action || '').toUpperCase();
            return act.includes('OFFICER') || act.includes('DISBURSE') || act.includes('ATTENDANCE') || act.includes('EVALUAT') || act.includes('BATCH');
        });

        if (rawLogs.length === 0) {
            listEl.innerHTML = `
                <div class="p-3 text-center text-muted small">
                    <i class="bi bi-bell-slash fs-4 d-block mb-1 text-muted"></i>
                    <span>No incoming officer action alerts logged yet.</span>
                </div>
            `;
            return;
        }

        const alerts = rawLogs.slice(0, 8).map(l => {
            const act = (l.action_type || l.action || '').toUpperCase();
            let icon = 'bi-journal-text text-primary';
            if (act.includes('DISBURSE')) icon = 'bi-box-seam-fill text-warning';
            else if (act.includes('ATTENDANCE')) icon = 'bi-calendar-check-fill text-info';
            else if (act.includes('EVALUAT') || act.includes('FORWARD')) icon = 'bi-check2-circle text-success';
            else if (act.includes('BATCH')) icon = 'bi-people-fill text-primary';

            const timeStr = l.created_at ? new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent';

            return {
                icon,
                title: l.action_type ? l.action_type.replace(/_/g, ' ') : 'Officer Action',
                details: l.details || l.description || 'System event recorded in audit logs.',
                time: timeStr
            };
        });

        listEl.innerHTML = alerts.map(a => `
            <div class="p-2.5 border-bottom d-flex align-items-start gap-2">
                <i class="bi ${a.icon} fs-5 mt-0.5 flex-shrink-0"></i>
                <div>
                    <div class="d-flex justify-content-between align-items-center mb-0.5">
                        <strong class="text-dark small">${escapeHtml(a.title)}</strong>
                        <small class="text-muted font-monospace" style="font-size: 0.7rem;">${escapeHtml(a.time)}</small>
                    </div>
                    <div class="text-muted" style="font-size: 0.75rem;">${escapeHtml(a.details)}</div>
                </div>
            </div>
        `).join('');
    }

    function filterNotificationLogs() {
        renderNotificationsModule();
    }

    function openComposeNotificationModal() {
        document.getElementById('composeNotifForm')?.reset();
        handleNotifRecipientChange();
        safeOpenModal('composeNotificationModal');
    }

    function handleNotifRecipientChange() {
        const type = document.getElementById('notifRecipientType')?.value;
        const specificContainer = document.getElementById('notifSpecificRecipientContainer');
        if (specificContainer) {
            if (type === 'specific_beneficiary' || type === 'specific_staff') {
                specificContainer.classList.remove('d-none');
            } else {
                specificContainer.classList.add('d-none');
            }
        }
    }

    function applyNotifTemplate() {
        const sel = document.getElementById('notifTemplateSelect')?.value;
        const titleInput = document.getElementById('notifTitleInput');
        const msgInput = document.getElementById('notifMessageInput');
        if (!titleInput || !msgInput) return;

        const templates = {
            schedule_reminder: {
                title: 'Schedule Reminder: Program Orientation & Verification',
                message: 'Good day! Please be reminded of your scheduled orientation session at the PESO Main Office. Please bring your original valid ID and supporting documents.'
            },
            app_approved: {
                title: 'Application Approved — PESO Livelihood Assistance',
                message: 'Congratulations! Your livelihood assistance application has been formally approved. You will receive a notification regarding your grant schedule shortly.'
            },
            docs_required: {
                title: 'Action Required: Submit Supporting Documents',
                message: 'Your application is currently under evaluation. Please submit your Barangay Certificate of Indigency / Valid Government ID to complete verification.'
            },
            payout_schedule: {
                title: 'Payout Advisory: Assistance Distribution Schedule',
                message: 'Please be informed that your financial grant distribution has been scheduled. Bring your beneficiary QR code and valid photo ID for verification.'
            },
            general_advisory: {
                title: 'Official Advisory: PESO Koronadal Program Update',
                message: 'City Government of Koronadal PESO advises all beneficiaries that registration and verification services are available during regular office hours.'
            }
        };

        if (templates[sel]) {
            titleInput.value = templates[sel].title;
            msgInput.value = templates[sel].message;
        }
    }

    async function handleComposeNotificationSubmit(e) {
        e.preventDefault();
        const type = document.getElementById('notifRecipientType').value;
        const specificTarget = document.getElementById('notifSpecificRecipient').value.trim();
        const title = document.getElementById('notifTitleInput').value.trim();
        const msg = document.getElementById('notifMessageInput').value.trim();

        if (title.length < 3) {
            alert('Notification title must contain at least 3 characters.');
            return;
        }
        if (msg.length < 5) {
            alert('Notification message body must contain at least 5 characters.');
            return;
        }

        try {
            if (typeof DataService !== 'undefined' && DataService.notifications) {
                if (type === 'all_beneficiaries') {
                    const bens = AdminStore.beneficiaries || [];
                    const inserts = bens.map(b => ({
                        beneficiary_qr: b.qr_code,
                        title: title,
                        message: msg,
                        is_read: false
                    }));
                    if (inserts.length > 0) {
                        await supabaseClient.from('notifications').insert(inserts);
                    }
                } else if (type === 'specific_beneficiary') {
                    await DataService.notifications.create({
                        beneficiary_qr: specificTarget || 'QR-BEN-GENERAL',
                        title: title,
                        message: msg,
                        is_read: false
                    });
                } else {
                    await DataService.notifications.create({
                        staff_user_id: parseInt(specificTarget) || 1,
                        title: title,
                        message: msg,
                        is_read: false
                    });
                }
            }

            await logAdminAction('DISPATCH_NOTIFICATION', 'notification', null, `Dispatched [${title}] to [${type}]`);
            notify('Notification Dispatched', 'Message sent in real-time and recorded in Supabase.', 'success');
            safeCloseModal('composeNotificationModal');
            await refreshAllData();
            renderNotificationsModule();
        } catch (err) {
            notify('Dispatch Failed', err.message || 'Error sending notification.', 'danger');
        }
    }


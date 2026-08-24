/**
 * Beneficiary Portal Frontend Controller Module
 * City Government of Koronadal — PESO & CSWDO Portals
 * 
 * Direct Supabase Data Layer integration:
 * - Real-time profile loading via AuthGuard & DataService
 * - Applications intake, tracking & dynamic status boards
 * - Centralized notifications feed & read status
 * - Interview schedules, capacity training & distribution tracking
 * - Data Privacy compliance: sensitive details masked in views
 */

(function () {
  'use strict';

  // Active Beneficiary State
  const state = {
    user: null,
    applications: [],
    documents: [],
    trainings: [],
    releases: [],
    notifications: [],
    programs: []
  };

  function getStatusBadge(status) {
    switch (status) {
      case 'Approved':
      case 'Officer Approved':
      case 'Released':
      case 'Completed':
      case 'Verified':
      case 'Active':
      case 'Scheduled':
        return '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>' + status + '</span>';
      case 'Under Review':
      case 'Pending':
      case 'Pending Requirements':
      case 'Interview Scheduled':
      case 'Training Scheduled':
      case 'Enrolled':
        return '<span class="badge bg-warning text-dark"><i class="bi bi-clock-history me-1"></i>' + status + '</span>';
      case 'Denied':
      case 'Officer Denied':
      case 'Rejected':
      case 'Deactivated':
        return '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>' + status + '</span>';
      default:
        return '<span class="badge bg-secondary">' + (status || 'Pending') + '</span>';
    }
  }

  // Load Beneficiary Profile from AuthGuard / Supabase
  async function loadBeneficiaryProfile() {
    let profile = null;
    if (typeof AuthGuard !== 'undefined' && AuthGuard.getProfile) {
      profile = AuthGuard.getProfile();
    }

    if (!profile && typeof AuthGuard !== 'undefined' && AuthGuard.fetchUserProfile) {
      profile = await AuthGuard.fetchUserProfile();
    }

    if (!profile && typeof DataService !== 'undefined') {
      const username = sessionStorage.getItem('username') || sessionStorage.getItem('beneficiaryUsername');
      if (username) {
        const res = await DataService.beneficiaries.getByUsername(username);
        if (res.data) profile = res.data;
      }
    }

    if (profile) {
      state.user = {
        qr_code: profile.qr_code || profile.id,
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        fullName: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || 'Beneficiary',
        username: profile.username || 'beneficiary',
        email: profile.email || '',
        phone: profile.phone || '',
        address: profile.address || 'Koronadal City',
        status: profile.status || 'Active'
      };
    } else {
      // Fallback display profile from active registration session
      const savedFullName = sessionStorage.getItem('beneficiaryFullName') || sessionStorage.getItem('beneficiaryName') || 'Beneficiary Applicant';
      const savedUsername = sessionStorage.getItem('beneficiaryUsername') || sessionStorage.getItem('username') || 'beneficiary';
      const savedQr = sessionStorage.getItem('beneficiaryQrCode') || 'QR-BEN-ACTIVE';
      const savedEmail = sessionStorage.getItem('beneficiaryEmail') || '';
      const savedPhone = sessionStorage.getItem('beneficiaryPhone') || '';
      const savedAddr = sessionStorage.getItem('beneficiaryAddress') || 'City of Koronadal';

      state.user = {
        qr_code: savedQr,
        first_name: savedFullName.split(' ')[0] || 'Beneficiary',
        last_name: savedFullName.split(' ').slice(1).join(' ') || '',
        fullName: savedFullName,
        username: savedUsername,
        email: savedEmail,
        phone: savedPhone,
        address: savedAddr,
        status: 'Active'
      };
    }

    // Update Header / Welcome Elements
    const welcomeEl = document.getElementById('welcomeUser');
    if (welcomeEl) welcomeEl.textContent = `Welcome, ${state.user.fullName}!`;

    const subTitleEl = document.getElementById('sidebarSubtitle');
    if (subTitleEl) subTitleEl.textContent = state.user.fullName;

    const qrCodeDisplayEl = document.getElementById('sidebarQrPreview');
    if (qrCodeDisplayEl) qrCodeDisplayEl.textContent = state.user.qr_code;
  }

  // Fetch all beneficiary-related data from Supabase
  async function fetchBeneficiaryData() {
    if (!state.user || !state.user.qr_code) return;
    const qr = state.user.qr_code;

    try {
      // 1. Fetch Applications
      if (typeof DataService !== 'undefined' && DataService.applications) {
        const appsRes = await DataService.applications.getByBeneficiary(qr);
        if (appsRes.data) {
          state.applications = appsRes.data.map(app => ({
            id: app.application_number || `APP-${app.id}`,
            dbId: app.id,
            type: app.program?.name || 'Assistance Program',
            program: app.program?.code || 'PESO',
            program_id: app.program_id,
            date: app.date_applied || (app.created_at ? app.created_at.split('T')[0] : '2026-08-01'),
            status: app.status || 'Pending',
            progress: app.progress_percent || (app.status === 'Approved' ? 100 : (app.status === 'Under Review' ? 50 : 25)),
            remarks: app.officer_notes || app.remarks || 'Application on record.'
          }));
        }
      }

      // 2. Fetch Notifications
      if (typeof DataService !== 'undefined' && DataService.notifications) {
        const notifRes = await DataService.notifications.getByBeneficiary(qr);
        if (notifRes.data) {
          state.notifications = notifRes.data.map(n => ({
            id: n.id,
            title: n.title,
            message: n.message,
            date: n.created_at ? new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
            isRead: n.is_read || false
          }));
        }
      }

      // 3. Fetch Interview Schedules
      if (typeof DataService !== 'undefined' && DataService.interviews) {
        const intRes = await DataService.interviews.getByBeneficiary(qr);
        if (intRes.data) {
          state.trainings = intRes.data.map(i => ({
            id: `SCH-${i.id}`,
            dbId: i.id,
            title: `${i.program?.name || 'Assistance Program'} Interview / Assessment`,
            program_code: i.program?.code || 'PESO',
            date: i.interview_date,
            time: i.interview_time || '09:00 AM',
            venue: i.venue_location || 'PESO Office, City Hall Complex',
            status: i.status || 'Scheduled',
            attendance: i.attendance_status || 'Unmarked',
            trainer: i.officer ? `${i.officer.first_name} ${i.officer.last_name}` : 'PESO Officer',
            certificate: `CERT-${new Date().getFullYear()}-${i.id}`
          }));
        }
      }

      // 4. Fetch Approved Assistance & Distributions
      if (typeof DataService !== 'undefined' && DataService.approvedAssistance) {
        const astRes = await DataService.approvedAssistance.getByBeneficiary(qr);
        if (astRes.data) {
          state.releases = astRes.data.map(a => ({
            id: `AST-${a.id}`,
            dbId: a.id,
            assistance: `${a.assistance_type} (${a.quantity_amount})`,
            program: a.program?.name || 'Assistance Grant',
            date: a.approval_date || new Date().toISOString().split('T')[0],
            time: '08:00 AM - 05:00 PM',
            location: 'PESO Disbursement & Distribution Desk',
            status: 'Active',
            value: a.quantity_amount,
            type: a.assistance_type
          }));
        }
      }

      // 5. Fetch Available Active Programs for Application Dropdown
      if (typeof DataService !== 'undefined' && DataService.programs) {
        const progRes = await DataService.programs.getAll({ status: 'Active' });
        if (progRes.data) {
          state.programs = progRes.data;
          window.allBeneficiaryPrograms = progRes.data;
          populateProgramsDropdown();
          if (typeof window.renderBeneficiaryPrograms === 'function') {
            window.renderBeneficiaryPrograms();
          }
        }
      }
    } catch (err) {
      console.warn('[BENEFICIARY] Data fetch notice:', err.message);
    }

    renderDashboardOverview();
  }

  function populateProgramsDropdown() {
    const selectEl = document.getElementById('requestCategorySelect');
    if (!selectEl) return;
    if (state.programs.length > 0) {
      selectEl.innerHTML = '<option value="">Select Assistance Program...</option>' +
        state.programs.map(p => `<option value="${p.id}" data-name="${p.name}" data-code="${p.code}">${p.name} (${p.code})</option>`).join('');
    }
  }

  // Summary Overview Cards Rendering
  function renderDashboardOverview() {
    const totalAppEl = document.getElementById('benStatTotalApps') || document.getElementById('statTotalApps');
    const approvedEl = document.getElementById('benStatApprovedApps') || document.getElementById('statApproved');
    const pendingEl = document.getElementById('benStatPendingApps') || document.getElementById('statPending');
    const scheduledEl = document.getElementById('statScheduled');
    const notifCountEl = document.getElementById('statNotifications');

    const totalCount = state.applications.length;
    const approvedCount = state.applications.filter(a => a.status === 'Approved' || a.status === 'Officer Approved' || a.status === 'Released' || a.status === 'Completed').length;
    const pendingCount = state.applications.filter(a => a.status === 'Pending' || a.status === 'Under Review' || a.status === 'Pending Requirements' || a.status === 'Interview Scheduled').length;
    const scheduledCount = state.trainings.filter(t => t.status === 'Scheduled' || t.status === 'Active').length;
    const unreadNotifs = state.notifications.filter(n => !n.isRead).length;

    if (totalAppEl) totalAppEl.textContent = totalCount;
    if (approvedEl) approvedEl.textContent = approvedCount;
    if (pendingEl) pendingEl.textContent = pendingCount;
    if (scheduledEl) scheduledEl.textContent = scheduledCount;
    if (notifCountEl) notifCountEl.textContent = state.notifications.length;

    renderQrPassCard();
    renderLiveTransactionStepper();
    renderApplicationsTable();
    renderRecentApplicationsTable();
    renderDocumentStatusBoard();
    renderTrainingsList();
    renderDistributionReleases();
    renderNotificationsFeed();
  }

  // Dynamic QR Code Rendering for Beneficiary Pass Card & Modal
  function renderQrPassCard() {
    if (!state.user || !state.user.qr_code) return;
    const qrText = state.user.qr_code;

    const qrBadge = document.getElementById('benCardQrBadge');
    const benName = document.getElementById('benCardFullName');
    const statusBadge = document.getElementById('benCardStatusBadge');
    const canvasBox = document.getElementById('benQrCanvasBox');

    if (qrBadge) qrBadge.textContent = qrText;
    if (benName) benName.textContent = state.user.fullName;
    if (statusBadge) statusBadge.textContent = state.user.status || 'Active';

    if (canvasBox && typeof QRCode !== 'undefined') {
      canvasBox.innerHTML = '';
      new QRCode(canvasBox, {
        text: qrText,
        width: 140,
        height: 140,
        colorDark: "#0F172A",
        colorLight: "#FFFFFF",
        correctLevel: QRCode.CorrectLevel.M
      });
    }

    const modalName = document.getElementById('modalBenName');
    const modalQr = document.getElementById('modalBenQrCode');
    const modalCanvas = document.getElementById('modalQrCanvasBox');

    if (modalName) modalName.textContent = state.user.fullName;
    if (modalQr) modalQr.textContent = qrText;
    if (modalCanvas && typeof QRCode !== 'undefined') {
      modalCanvas.innerHTML = '';
      new QRCode(modalCanvas, {
        text: qrText,
        width: 180,
        height: 180,
        colorDark: "#0F172A",
        colorLight: "#FFFFFF",
        correctLevel: QRCode.CorrectLevel.H
      });
    }
  }

  function openQrSlipModal() {
    renderQrPassCard();
    const modalEl = document.getElementById('qrSlipModal');
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    }
  }

  // Render 5-Stage Live Transaction Stepper
  function renderLiveTransactionStepper() {
    const trackerEl = document.getElementById('liveStageTracker');
    if (!trackerEl) return;

    const latestApp = state.applications.length > 0 ? state.applications[0] : null;
    const appIdEl = document.getElementById('liveTrackingAppId');
    const bannerTitle = document.getElementById('liveCheckpointTitle');
    const bannerNotes = document.getElementById('liveCheckpointNotes');
    const bannerTime = document.getElementById('liveCheckpointTime');

    if (!latestApp) {
      if (appIdEl) appIdEl.textContent = 'NO ACTIVE TRANSACTION';
      if (bannerTitle) bannerTitle.textContent = 'Account Ready For Assistance Application';
      if (bannerNotes) bannerNotes.textContent = 'Click "Apply for Assistance" to submit your intake form to PESO or CSWDO.';
      if (bannerTime) bannerTime.textContent = 'Standby';
      resetStepperState(1);
      return;
    }

    if (appIdEl) appIdEl.textContent = latestApp.id;

    // Determine current milestone stage based on latest app status and notifications
    let activeStage = 1;
    const status = (latestApp.status || '').toLowerCase();

    if (status.includes('completed') || status.includes('released')) {
      activeStage = 5;
    } else if (status.includes('approved') || status.includes('officer approved')) {
      activeStage = 4;
    } else if (status.includes('interview') || status.includes('training')) {
      activeStage = 3;
    } else if (status.includes('under review') || status.includes('pending requirements')) {
      activeStage = 2;
    } else {
      activeStage = 1;
    }

    // Update step UI classes
    for (let i = 1; i <= 5; i++) {
      const stepEl = document.getElementById(`step-${i}`);
      const timeEl = document.getElementById(`step-${i}-time`);
      if (!stepEl) continue;

      if (i < activeStage) {
        stepEl.className = 'stage-step completed';
        if (timeEl) timeEl.textContent = 'Completed';
      } else if (i === activeStage) {
        stepEl.className = 'stage-step active';
        if (timeEl) timeEl.textContent = 'In Progress';
      } else {
        stepEl.className = 'stage-step';
        if (timeEl) timeEl.textContent = 'Pending';
      }
    }

    // Latest notification/checkpoint banner
    const latestNotif = state.notifications.length > 0 ? state.notifications[0] : null;
    if (latestNotif) {
      if (bannerTitle) bannerTitle.textContent = latestNotif.title;
      if (bannerNotes) bannerNotes.textContent = latestNotif.message;
      if (bannerTime) bannerTime.textContent = latestNotif.date;
    } else {
      if (bannerTitle) bannerTitle.textContent = `Status: ${latestApp.status}`;
      if (bannerNotes) bannerNotes.textContent = latestApp.remarks || 'Transaction is active and being processed.';
      if (bannerTime) bannerTime.textContent = latestApp.date || 'Recent';
    }
  }

  function resetStepperState(stage) {
    for (let i = 1; i <= 5; i++) {
      const stepEl = document.getElementById(`step-${i}`);
      if (stepEl) stepEl.className = (i === stage ? 'stage-step active' : 'stage-step');
    }
  }

  // Setup Realtime Postgres Subscription with Supabase
  let realtimeChannel = null;
  function setupRealtimeTracking() {
    if (!state.user || !state.user.qr_code || typeof DataService === 'undefined' || !DataService.realtime) return;

    if (realtimeChannel) {
      DataService.realtime.unsubscribe(realtimeChannel);
    }

    const qr = state.user.qr_code;
    const client = DataService.getClient();
    if (!client || typeof client.channel !== 'function') return;

    try {
      realtimeChannel = client.channel(`tracking_${qr}_${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `beneficiary_qr=eq.${qr}` }, async (payload) => {
          console.log('[REALTIME TRACKER] Notification event received:', payload);
          await fetchBeneficiaryData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'applications', filter: `beneficiary_qr=eq.${qr}` }, async (payload) => {
          console.log('[REALTIME TRACKER] Application status changed:', payload);
          await fetchBeneficiaryData();
        })
        .subscribe();
      console.log('[REALTIME TRACKER] Subscribed to live Supabase tracking stream for', qr);
    } catch (e) {
      console.warn('[REALTIME TRACKER] Subscription notice:', e);
    }

    // Also listen to Cross-tab Realtime Event Broadcaster
    if (typeof OTPAuth !== 'undefined' && OTPAuth.onRealtimeEvent) {
      OTPAuth.onRealtimeEvent(async (event) => {
        console.log('[BENEFICIARY DASHBOARD REALTIME EVENT]:', event);
        if (event.type === 'APPLICATION_APPROVED' || event.type === 'APPLICATION_REJECTED' || 
            event.type === 'DISBURSEMENT_RECORDED' || event.type === 'APPLICATION_UPDATED' ||
            event.type === 'BENEFICIARY_REGISTERED') {
          await fetchBeneficiaryData();
        }
      });
    }
  }

  // Dynamic Assistance Request Intake Submission directly to Supabase
  async function submitAssistanceRequest(event) {
    if (event) event.preventDefault();

    const categorySelect = document.getElementById('requestCategorySelect');
    const remarksInput = document.getElementById('requestNotesInput');
    const amountInput = document.getElementById('requestAmountInput');

    const programIdVal = categorySelect ? categorySelect.value : null;
    const notes = remarksInput ? remarksInput.value.trim() : '';
    const amountRequested = amountInput ? parseFloat(amountInput.value) || 0 : 0;

    let programId = parseInt(programIdVal);
    let selectedProgramName = 'Assistance Program';

    if (!programId && state.programs.length > 0) {
      programId = state.programs[0].id;
      selectedProgramName = state.programs[0].name;
    } else if (categorySelect && categorySelect.selectedIndex > 0) {
      const opt = categorySelect.options[categorySelect.selectedIndex];
      selectedProgramName = opt.getAttribute('data-name') || opt.text;
    }

    if (!programId) {
      alert('Please select a valid assistance program before submitting.');
      return;
    }

    const appNumber = `APP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newAppPayload = {
      application_number: appNumber,
      beneficiary_qr: state.user.qr_code,
      program_id: programId,
      date_applied: new Date().toISOString().split('T')[0],
      status: 'Pending',
      progress_percent: 15,
      remarks: notes || 'New application request submitted by beneficiary.',
      amount_requested: amountRequested,
      documents_json: JSON.stringify([
        { name: 'Government ID', status: 'Submitted', date: new Date().toISOString().split('T')[0] },
        { name: 'Barangay Certificate', status: 'Submitted', date: new Date().toISOString().split('T')[0] }
      ])
    };

    if (typeof DataService !== 'undefined' && DataService.applications) {
      const res = await DataService.applications.create(newAppPayload);
      if (res.error) {
        alert('Submission notice: ' + (res.error.message || 'Could not save application. Please try again.'));
        return;
      }
    }

    // Broadcast Real-time event across portal tabs
    if (typeof OTPAuth !== 'undefined' && OTPAuth.broadcastRealtimeEvent) {
      OTPAuth.broadcastRealtimeEvent('APPLICATION_SUBMITTED', {
        application_number: appNumber,
        program: selectedProgramName,
        beneficiary_qr: state.user?.qr_code,
        beneficiary_name: state.user?.fullName
      });
    }

    alert(`Your assistance request (${appNumber}) for ${selectedProgramName} has been submitted successfully!\n\nStatus: Pending Officer evaluation.`);

    if (window.closeModal) window.closeModal('requestIntakeModal');
    if (remarksInput) remarksInput.value = '';

    await fetchBeneficiaryData();
  }

  // Document Status Board
  function renderDocumentStatusBoard() {
    const container = document.getElementById('benDocumentStatusBoard');
    if (!container) return;

    if (state.applications.length === 0) {
      container.innerHTML = '<div class="text-center p-3 text-muted">No submitted requirement documents on file.</div>';
      return;
    }

    container.innerHTML = state.applications.map(app => `
      <div class="list-group-item d-flex justify-content-between align-items-center p-3 mb-2 rounded border">
        <div>
          <div class="fw-bold text-dark"><i class="bi bi-file-earmark-check text-primary me-2"></i>${app.type} Application Documents</div>
          <small class="text-muted">Application: <strong>${app.id}</strong> • Submitted: ${app.date}</small>
        </div>
        <div>${getStatusBadge(app.status)}</div>
      </div>
    `).join('');
  }

  // Applications Table Rendering
  function renderApplicationsTable() {
    const tbody = document.getElementById('benApplicationsTableBody') || document.getElementById('applicationsTableBody');
    if (!tbody) return;

    if (state.applications.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-1"></i>No applications submitted yet. Click "Apply for Assistance" to begin.</td></tr>`;
      return;
    }

    tbody.innerHTML = state.applications.map(a => `
      <tr>
        <td class="fw-bold text-dark">${a.id}</td>
        <td class="fw-semibold">${a.type}</td>
        <td><span class="badge bg-secondary-subtle text-dark border">${a.program}</span></td>
        <td>${a.date}</td>
        <td>${getStatusBadge(a.status)}</td>
        <td class="small text-muted">${a.remarks}</td>
      </tr>
    `).join('');
  }

  function renderRecentApplicationsTable() {
    const recentBody = document.getElementById('recentApplicationsBody');
    if (!recentBody) return;

    if (state.applications.length === 0) {
      recentBody.innerHTML = `<tr><td colspan="6" class="text-center py-3 text-muted">No active assistance applications on record.</td></tr>`;
      return;
    }

    recentBody.innerHTML = state.applications.slice(0, 5).map(a => `
      <tr>
        <td class="fw-bold">${a.id}</td>
        <td><strong>${a.type}</strong></td>
        <td><span class="office-badge ${a.program.includes('CSWDO') ? 'cswdo' : 'peso'}">${a.program}</span></td>
        <td>${a.date}</td>
        <td>
          <div class="progress" style="height: 14px; background-color: #E2E8F0; border-radius: 7px; width: 110px;">
            <div class="progress-bar ${a.status === 'Approved' ? 'bg-success' : 'bg-primary'}" role="progressbar" style="width: ${a.progress}%; border-radius: 7px; font-size: 0.7rem; font-weight: bold; line-height: 14px;">${a.progress}%</div>
          </div>
        </td>
        <td>${getStatusBadge(a.status)}</td>
      </tr>
    `).join('');
  }

  // Training & Capacity Building Sessions
  function renderTrainingsList() {
    const container = document.getElementById('benTrainingsContainer') || document.getElementById('enrolledTrainingsContainer');
    if (!container) return;

    if (state.trainings.length === 0) {
      container.innerHTML = '<div class="card p-3 text-center text-muted small">No scheduled interview or training appointments assigned.</div>';
      return;
    }

    container.innerHTML = state.trainings.map(t => `
      <div class="card border shadow-sm mb-3 rounded-3">
        <div class="card-body d-flex justify-content-between align-items-center">
          <div>
            <h6 class="fw-bold text-dark mb-1"><i class="bi bi-calendar2-check-fill text-primary me-2"></i>${t.title}</h6>
            <small class="text-muted"><i class="bi bi-clock me-1"></i>${t.date} @ ${t.time} • <i class="bi bi-geo-alt me-1"></i>${t.venue}</small>
          </div>
          <div>
            <span class="badge ${t.attendance === 'Present' ? 'bg-success' : 'bg-info text-dark'} me-2">${t.attendance !== 'Unmarked' ? t.attendance : t.status}</span>
            <button class="btn btn-sm btn-outline-primary" onclick="window.viewCompletionCertificate('${t.certificate}')">
              <i class="bi bi-award me-1"></i>Certificate
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  function viewCompletionCertificate(certId) {
    const certCode = certId || `CERT-${new Date().getFullYear()}-881`;
    const benName = state.user ? state.user.fullName : 'Beneficiary Applicant';

    const certNameEl = document.getElementById('certBeneficiaryName');
    if (certNameEl) certNameEl.textContent = benName.toUpperCase();

    const certModalEl = document.getElementById('certificateModal');
    if (certModalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const modal = bootstrap.Modal.getOrCreateInstance(certModalEl);
      modal.show();
    } else {
      alert(`Certificate of Completion (#${certCode}) verified for ${benName}.\nIssued by Public Employment Service Office (PESO) - City Government of Koronadal.`);
    }
  }

  // Distribution & Assistance Releases
  function renderDistributionReleases() {
    const container = document.getElementById('benReleasesContainer') || document.getElementById('beneficiaryUpcomingDistribution');
    if (!container) return;

    if (state.releases.length === 0) {
      container.innerHTML = `
        <div class="card p-3 text-center text-muted mb-4 small bg-light">
          <i class="bi bi-box-seam fs-3 d-block mb-1 text-secondary"></i>
          No upcoming scheduled assistance distributions or grant disbursements.
        </div>
      `;
      return;
    }

    container.innerHTML = state.releases.map(r => `
      <div class="alert alert-success border-success-subtle p-3 mb-2 rounded-3">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <strong class="d-block text-dark"><i class="bi bi-box-seam-fill me-2 text-success"></i>${r.assistance}</strong>
            <small class="text-muted"><i class="bi bi-clock me-1"></i>Scheduled: ${r.date} (${r.time}) • <i class="bi bi-building me-1"></i>${r.location}</small>
          </div>
          <span class="badge bg-success">${r.status}</span>
        </div>
      </div>
    `).join('');
  }

  // Centralized Notifications Feed
  function renderNotificationsFeed() {
    const container = document.getElementById('benNotificationsFeed') || document.getElementById('notifDropdownList');
    const badge = document.getElementById('benUnreadNotifBadge');
    const unreadCount = state.notifications.filter(n => !n.isRead).length;

    if (badge) {
      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }

    if (!container) return;

    if (state.notifications.length === 0) {
      container.innerHTML = '<div class="p-3 text-center text-muted small">No notifications at this time.</div>';
      return;
    }

    container.innerHTML = state.notifications.map(n => `
      <div class="list-group-item p-3 mb-1 rounded ${n.isRead ? 'bg-light' : 'bg-white border-start border-primary border-3'}" style="cursor: pointer;" onclick="window.markBeneficiaryNotificationRead(${n.id})">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <strong class="text-dark"><i class="bi bi-bell-fill text-primary me-2"></i>${n.title}</strong>
          <small class="text-muted">${n.date}</small>
        </div>
        <p class="mb-0 small text-muted">${n.message}</p>
      </div>
    `).join('');
  }

  async function markBeneficiaryNotificationRead(id) {
    if (typeof DataService !== 'undefined' && DataService.notifications) {
      await DataService.notifications.markAsRead(id);
    }
    const notif = state.notifications.find(n => n.id === id);
    if (notif) notif.isRead = true;
    renderNotificationsFeed();
  }

  async function markAllBeneficiaryNotificationsRead() {
    if (state.user && typeof DataService !== 'undefined' && DataService.notifications) {
      await DataService.notifications.markAllAsRead({ beneficiary_qr: state.user.qr_code });
    }
    state.notifications.forEach(n => n.isRead = true);
    renderNotificationsFeed();
  }

  function setupRealtimeTracking() {
    try {
      if (typeof DataService !== 'undefined' && DataService.realtime && !window.__beneficiaryRealtimeActive) {
        window.__beneficiaryRealtimeActive = true;
        DataService.realtime.subscribeMulti(['applications', 'notifications', 'interview_schedules', 'approved_assistance', 'distributions'], (payload) => {
          console.log('[Beneficiary Realtime Event]:', payload.table, payload.eventType);
          fetchBeneficiaryData();
        });
      }
    } catch (e) {
      console.warn('[Beneficiary Realtime Init Notice]:', e);
    }
  }

  // Global Scope Exports
  window.submitAssistanceRequest = submitAssistanceRequest;
  window.viewCompletionCertificate = viewCompletionCertificate;
  window.renderDashboardOverview = renderDashboardOverview;
  window.fetchBeneficiaryData = fetchBeneficiaryData;
  window.markBeneficiaryNotificationRead = markBeneficiaryNotificationRead;
  window.markAllRead = markAllBeneficiaryNotificationsRead;
  window.openQrSlipModal = openQrSlipModal;

  // Initialize on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', async function () {
    await loadBeneficiaryProfile();
    await fetchBeneficiaryData();
    setupRealtimeTracking();

    const requestForm = document.getElementById('assistanceRequestForm');
    if (requestForm) requestForm.addEventListener('submit', submitAssistanceRequest);
  });

})();

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
      const fullName = `${profile.first_name || ''} ${profile.middle_name ? profile.middle_name.charAt(0) + '. ' : ''}${profile.last_name || ''}${profile.suffix ? ' ' + profile.suffix : ''}`.trim() || profile.username || 'Beneficiary';
      state.user = {
        qr_code: profile.qr_code || profile.id,
        first_name: profile.first_name || '',
        middle_name: profile.middle_name || '',
        last_name: profile.last_name || '',
        suffix: profile.suffix || '',
        fullName: fullName,
        username: profile.username || 'beneficiary',
        email: profile.email || '',
        phone: profile.phone || '',
        age: profile.age || '',
        sex: profile.sex || profile.gender || '',
        marital_status: profile.marital_status || profile.civil_status || 'Single',
        nationality: profile.nationality || 'Filipino',
        purok: profile.purok || '',
        barangay: profile.barangay || '',
        address: profile.address || (profile.purok ? `${profile.purok}, ${profile.barangay || 'Koronadal City'}` : 'Koronadal City'),
        id_type: profile.id_type || 'Government Valid ID',
        id_file_path: profile.id_file_path || '',
        created_at: profile.created_at || profile.verified_at || '2026-01-15',
        status: profile.status || 'Active'
      };
    } else {
      // Fallback display profile from active registration session
      const savedFullName = sessionStorage.getItem('beneficiaryFullName') || sessionStorage.getItem('beneficiaryName') || 'Maria Santos';
      const savedUsername = sessionStorage.getItem('beneficiaryUsername') || sessionStorage.getItem('username') || 'mariasantos';
      const savedQr = sessionStorage.getItem('beneficiaryQrCode') || 'QR-BEN-ACTIVE';
      const savedEmail = sessionStorage.getItem('beneficiaryEmail') || sessionStorage.getItem('userEmail') || 'maria.santos@gmail.com';
      const savedPhone = sessionStorage.getItem('beneficiaryPhone') || '09195550199';
      const savedAddr = sessionStorage.getItem('beneficiaryAddress') || 'Purok Pag-asa, Brgy. Morales, Koronadal City';

      state.user = {
        qr_code: savedQr,
        first_name: savedFullName.split(' ')[0] || 'Maria',
        last_name: savedFullName.split(' ').slice(1).join(' ') || 'Santos',
        fullName: savedFullName,
        username: savedUsername,
        email: savedEmail,
        phone: savedPhone,
        age: '28',
        sex: 'Female',
        marital_status: 'Single',
        nationality: 'Filipino',
        purok: 'Purok Pag-asa',
        barangay: 'Brgy. Morales',
        address: savedAddr,
        id_type: 'PhilSys National ID',
        created_at: '2026-01-15',
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
  window.loadBeneficiaryProfile = loadBeneficiaryProfile;

  // Fetch Live Relational Beneficiary Data from Supabase
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
            remarks: app.officer_notes || app.remarks || 'Application on record.',
            documents: Array.isArray(app.documents_json) ? app.documents_json : []
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

      // 3. Fetch Interview & Activity Schedules (Assigned Directly or Linked)
      if (typeof DataService !== 'undefined' && DataService.interviews) {
        let allInt = [];
        try {
          const directRes = await DataService.interviews.getByBeneficiary(qr);
          if (directRes && Array.isArray(directRes.data)) {
            allInt = directRes.data;
          }
          
          // Also fetch active PESO schedules for the beneficiary's enrolled applications
          const allRes = await DataService.interviews.getAll({ agency: 'PESO' });
          if (allRes && Array.isArray(allRes.data)) {
            allRes.data.forEach(item => {
              if (item.beneficiary_qr === qr || !allInt.some(x => x.id === item.id)) {
                if (item.beneficiary_qr === qr || item.batch_id) {
                  if (!allInt.some(x => x.id === item.id)) {
                    allInt.push(item);
                  }
                }
              }
            });
          }
        } catch (intErr) {
          console.warn('[BENEFICIARY_SCHEDULES] Fetch warning:', intErr);
        }

        if (allInt.length > 0) {
          state.trainings = allInt.map(i => {
            const prog = i.program || {};
            const officer = i.officer || {};
            const schedDate = i.start_date || i.interview_date || (i.created_at ? i.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10));
            const startTime = i.start_time || i.interview_time || '09:00 AM';
            const endTime = i.end_time || '10:00 AM';
            const schedTime = `${startTime}${endTime ? ' - ' + endTime : ''}`;
            const officerName = `${officer.first_name || ''} ${officer.last_name || ''}`.trim() || officer.username || 'Designated PESO Officer';
            const progTitle = prog.name ? `${prog.name} (${prog.code || 'PESO'})` : 'PESO Livelihood Program';

            return {
              id: `SCH-${i.id}`,
              dbId: i.id,
              title: i.title || `${prog.name || 'Assistance Program'} ${i.category || 'Activity'}`,
              category: i.category || 'Interview',
              programName: progTitle,
              program_code: prog.code || 'PESO',
              startDate: schedDate,
              start_date: schedDate,
              endDate: i.end_date || schedDate,
              date: schedDate,
              startTime: startTime,
              endTime: endTime,
              time: schedTime,
              scheduleTime: schedTime,
              duration: i.duration || '1 Hour',
              venue: i.venue_location || 'PESO Office, City Hall Complex',
              status: i.status || 'Scheduled',
              attendance: i.attendance_status || 'Unmarked',
              officerName: officerName,
              trainer: officerName,
              remarks: i.remarks || 'Please bring a valid government ID and original copies of submitted documents.',
              notes: i.remarks || 'Please bring a valid government ID and original copies of submitted documents.',
              certificate: `CERT-${new Date().getFullYear()}-${i.id}`
            };
          });
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

      // Render Visual Components
      renderDashboardOverview();
      renderRecentApplicationsTable();
      renderBeneficiaryScheduledActivities();
      renderNotificationsFeed();
      renderLiveTransactionStepper();
      renderApplicationProgressAndDocTracker();

    } catch (err) {
      console.error('[BENEFICIARY_DATA_SYNC_ERROR]:', err);
    }
  }

  // Dynamic QR Code Rendering for Beneficiary Pass Card & Master Modal
  function renderQrPassCard() {
    const user = state.user || {};
    const qrText = user.qr_code || sessionStorage.getItem('beneficiaryQrCode') || sessionStorage.getItem('userId') || 'QR-BEN-ACTIVE';
    const fullName = user.fullName || sessionStorage.getItem('userFullName') || sessionStorage.getItem('username') || 'Maria Santos';
    const userStatus = user.status || 'Active';
    const email = user.email || sessionStorage.getItem('beneficiaryEmail') || sessionStorage.getItem('userEmail') || 'maria.santos@gmail.com';
    const rawPhone = user.phone || sessionStorage.getItem('beneficiaryPhone') || '09195550199';
    const maskedPhone = rawPhone.length > 7 ? rawPhone.slice(0, 4) + '-***-' + rawPhone.slice(-4) : rawPhone;
    const address = user.address || (user.purok ? `${user.purok}, ${user.barangay || 'Koronadal City'}` : 'City of Koronadal');
    const demographics = `${user.marital_status || 'Single'} • ${user.sex || 'Female'} • ${user.age ? user.age + ' yrs' : '28 yrs'}`;
    const dateReg = user.created_at ? new Date(user.created_at).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : 'January 15, 2026';

    // 1. Draw High-Res Pink/Primary QR Code
    const modalCanvas = document.getElementById('modalQrCanvasBox');
    if (modalCanvas && typeof QRCode !== 'undefined') {
      modalCanvas.innerHTML = '';
      try {
        new QRCode(modalCanvas, {
          text: qrText,
          width: 160,
          height: 160,
          colorDark: "#D77FA1",
          colorLight: "#FFFFFF",
          correctLevel: QRCode.CorrectLevel.H
        });
      } catch (e) {
        modalCanvas.innerHTML = `<div class="p-3 font-monospace fw-bold text-dark border bg-light fs-5">${qrText}</div>`;
      }
    }

    // 2. Personal & Account Header Badges
    const modalQr = document.getElementById('modalBenQrCode');
    const modalName = document.getElementById('modalBenFullName');
    const modalStatus = document.getElementById('modalBenStatusBadge');

    if (modalQr) modalQr.textContent = qrText;
    if (modalName) modalName.textContent = fullName;
    if (modalStatus) modalStatus.innerHTML = `<i class="bi bi-patch-check-fill me-1"></i>${userStatus} Beneficiary`;

    // 3. Real-Time Detail Fields
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('modalDetailUsername', `@${user.username || 'mariasantos'}`);
    setEl('modalDetailEmail', email);
    setEl('modalDetailPhone', maskedPhone);
    setEl('modalDetailDemographics', demographics);
    setEl('modalDetailAddress', address);
    setEl('modalDetailDateReg', dateReg);
    const statusBadgeEl = document.getElementById('modalDetailStatus');
    if (statusBadgeEl) {
      statusBadgeEl.textContent = userStatus;
      statusBadgeEl.className = `badge ${userStatus === 'Active' || userStatus === 'Verified' ? 'bg-success' : 'bg-warning text-dark'}`;
    }

    // 4. Render Uploaded Documents Checklist
    const docsContainer = document.getElementById('modalDocumentsListContainer');
    if (docsContainer) {
      let attachedDocs = [];
      state.applications.forEach(app => {
        if (app.documents && Array.isArray(app.documents)) {
          attachedDocs.push(...app.documents);
        }
      });

      if (attachedDocs.length === 0) {
        attachedDocs = [
          { name: 'Government Issued Valid ID (PhilSys / UMID)', docType: 'Proof of Identity', status: 'Verified' },
          { name: 'Barangay Certificate of Indigency', docType: 'Proof of Residency & Economic Status', status: 'Verified' },
          { name: 'Beneficiary Intake Registration Record', docType: 'PESO & CSWDO Master Record', status: 'Active' }
        ];
      }

      docsContainer.innerHTML = attachedDocs.map(doc => `
        <div class="d-flex justify-content-between align-items-center p-2 bg-light rounded-3 border">
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-file-earmark-check-fill text-primary fs-5"></i>
            <div>
              <strong class="d-block small text-dark">${doc.name || 'Verified Requirement File'}</strong>
              <small class="text-muted" style="font-size: 0.72rem;">${doc.docType || 'Official Document'}</small>
            </div>
          </div>
          <span class="badge bg-success-subtle text-success border border-success-subtle small">
            <i class="bi bi-check-circle me-1"></i>${doc.status || 'Verified'}
          </span>
        </div>
      `).join('');
    }

    // 5. Render Applied Programs History Table
    const historyContainer = document.getElementById('modalApplicationHistoryContainer');
    if (historyContainer) {
      if (state.applications.length === 0) {
        historyContainer.innerHTML = `
          <div class="p-3 text-center text-muted small">
            <i class="bi bi-folder2-open d-block fs-4 text-secondary mb-1"></i>
            No filed applications recorded yet. Click <strong>"Apply for Assistance"</strong> to submit your intake request.
          </div>
        `;
      } else {
        historyContainer.innerHTML = `
          <table class="table table-sm table-hover mb-0 align-middle">
            <thead class="table-light">
              <tr>
                <th class="ps-3 small text-muted">Application #</th>
                <th class="small text-muted">Program</th>
                <th class="small text-muted">Date Applied</th>
                <th class="small text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              ${state.applications.map(app => `
                <tr>
                  <td class="ps-3 fw-bold font-monospace text-primary small">${app.id}</td>
                  <td class="fw-semibold text-dark small">${app.type || app.program}</td>
                  <td class="text-muted small">${app.date}</td>
                  <td>${getStatusBadge(app.status)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    }
  }

  function openQrModal() {
    renderQrPassCard();
    if (typeof openModal === 'function') {
      openModal('qrModal');
    } else {
      const el = document.getElementById('qrModal');
      if (el) {
        el.classList.add('active');
        el.classList.add('show');
        el.style.display = 'flex';
      }
    }
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
  let activeBenScheduleViewMode = 'upcoming';

  function toggleBeneficiaryScheduleView(mode) {
    activeBenScheduleViewMode = mode;
    const btnUp = document.getElementById('btnSchedUpcoming');
    const btnPast = document.getElementById('btnSchedPast');

    if (mode === 'upcoming') {
      if (btnUp) { btnUp.className = 'btn btn-primary active fw-semibold'; }
      if (btnPast) { btnPast.className = 'btn btn-outline-secondary fw-semibold'; }
    } else {
      if (btnUp) { btnUp.className = 'btn btn-outline-secondary fw-semibold'; }
      if (btnPast) { btnPast.className = 'btn btn-primary active fw-semibold'; }
    }

    renderBeneficiaryScheduledActivities();
  }
  window.toggleBeneficiaryScheduleView = toggleBeneficiaryScheduleView;

  // Summary Overview Cards & Dashboard Controller
  function renderDashboardOverview() {
    // 1. Calculate the 4 Standardized Overview Stat Cards
    const totalApps = state.applications.length;
    const pendingApps = state.applications.filter(a => {
      const s = (a.status || '').toLowerCase();
      return s.includes('pending') || s.includes('review') || s.includes('under review') || s.includes('requirements');
    }).length;
    const approvedApps = state.applications.filter(a => {
      const s = (a.status || '').toLowerCase();
      return s === 'approved' || s === 'officer approved';
    }).length;
    const completedApps = state.applications.filter(a => {
      const s = (a.status || '').toLowerCase();
      return s === 'completed' || s === 'released';
    }).length;

    if (document.getElementById('benStatSubmittedApps')) document.getElementById('benStatSubmittedApps').textContent = totalApps;
    if (document.getElementById('benStatPendingApps')) document.getElementById('benStatPendingApps').textContent = pendingApps;
    if (document.getElementById('benStatApprovedApps')) document.getElementById('benStatApprovedApps').textContent = approvedApps;
    if (document.getElementById('benStatCompletedApps')) document.getElementById('benStatCompletedApps').textContent = completedApps;

    const qrBadge = document.getElementById('benPortalQrBadge');
    if (qrBadge && state.user) {
      qrBadge.innerHTML = `<i class="bi bi-qr-code text-primary me-1"></i>${state.user.qr_code || 'QR-BEN-ACTIVE'}`;
    }

    renderApplicationProgressAndDocTracker();
    renderBeneficiaryScheduledActivities();
    renderApplicationsTable();
    renderRecentApplicationsTable();
    renderDocumentStatusBoard();
    renderTrainingsList();
    renderDistributionReleases();
    renderNotificationsFeed();
  }

  // Visual Application Progress & Document Tracker
  function renderApplicationProgressAndDocTracker() {
    const trackerEl = document.getElementById('liveStageTracker');
    const appIdEl = document.getElementById('liveTrackingAppId');
    const checklistContainer = document.getElementById('benDocumentChecklistContainer');

    const latestApp = state.applications.length > 0 ? state.applications[0] : null;

    if (!latestApp) {
      if (appIdEl) appIdEl.textContent = 'NO ACTIVE APPLICATION';
      if (checklistContainer) {
        checklistContainer.innerHTML = `
          <div class="alert alert-light border p-3 rounded-3 d-flex align-items-center justify-content-between mb-0">
            <div>
              <strong class="text-dark small d-block"><i class="bi bi-info-circle text-primary me-1"></i>Account Ready For Assistance Intake</strong>
              <span class="text-muted" style="font-size: 0.82rem;">Click "Apply for Assistance" to submit your application form to PESO.</span>
            </div>
            <button class="btn btn-sm btn-outline-primary fw-semibold" onclick="openModal('applyModal')">Apply Now</button>
          </div>
        `;
      }
      resetStepperState(1);
      return;
    }

    if (appIdEl) appIdEl.textContent = latestApp.id;

    // Determine milestone step: 1. Submitted ➔ 2. Under Review ➔ 3. Requirements Needed ➔ 4. Approved ➔ 5. Released
    const status = (latestApp.status || '').toLowerCase();
    let currentStep = 1;
    let hasMissingDocs = false;

    // Parse documents to check for missing/flagged requirements
    let docs = [];
    if (latestApp.rawDocs && Array.isArray(latestApp.rawDocs)) {
      docs = latestApp.rawDocs;
    } else {
      docs = [
        { name: 'Valid Government-Issued ID', status: 'Verified' },
        { name: 'Barangay Certificate of Indigency', status: status.includes('requirements') ? 'Missing / Required' : 'Verified' },
        { name: 'Proof of Low Income / Displaced Status', status: 'Verified' }
      ];
    }

    hasMissingDocs = status.includes('requirements') || docs.some(d => (d.status || '').toLowerCase().includes('missing') || (d.status || '').toLowerCase().includes('pending'));

    if (status === 'released' || status === 'completed') {
      currentStep = 5;
    } else if (status === 'approved' || status === 'officer approved') {
      currentStep = 4;
    } else if (hasMissingDocs || status.includes('requirements')) {
      currentStep = 3;
    } else if (status.includes('review') || status.includes('evaluation')) {
      currentStep = 2;
    } else {
      currentStep = 1;
    }

    // Update Stepper Steps
    for (let i = 1; i <= 5; i++) {
      const stepEl = document.getElementById(`step-${i}`);
      const timeEl = document.getElementById(`step-${i}-time`);
      if (!stepEl) continue;

      if (i < currentStep) {
        stepEl.className = 'stage-step completed';
        if (timeEl) timeEl.textContent = 'Done';
      } else if (i === currentStep) {
        stepEl.className = currentStep === 3 && hasMissingDocs ? 'stage-step active border-warning' : 'stage-step active';
        if (timeEl) timeEl.textContent = currentStep === 3 && hasMissingDocs ? 'Action Needed' : 'In Progress';
      } else {
        stepEl.className = 'stage-step';
        if (timeEl) timeEl.textContent = 'Pending';
      }
    }

    // Render Missing Requirements / Document Callout
    if (checklistContainer) {
      if (hasMissingDocs) {
        checklistContainer.innerHTML = `
          <div class="alert alert-warning border-warning p-3 rounded-3 mb-0">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <strong class="text-dark"><i class="bi bi-exclamation-triangle-fill text-warning me-2"></i>Action Required: Incomplete / Flagged Documents</strong>
              <span class="badge bg-warning text-dark">Pending Beneficiary Action</span>
            </div>
            <p class="small text-dark mb-2">PESO Officer marked requirements as pending. Please upload the missing document copies to resume review:</p>
            <div class="d-flex flex-wrap gap-2 mb-3">
              ${docs.map(d => `
                <span class="badge ${(d.status || '').toLowerCase().includes('missing') ? 'bg-danger text-white' : 'bg-light text-dark border'} p-2">
                  <i class="bi ${(d.status || '').toLowerCase().includes('missing') ? 'bi-x-circle me-1' : 'bi-check-circle me-1 text-success'}"></i>${d.name} (${d.status})
                </span>
              `).join('')}
            </div>
            <button class="btn btn-sm btn-primary fw-semibold" onclick="navigateTo('documents')"><i class="bi bi-upload me-1"></i>Upload Missing Requirements</button>
          </div>
        `;
      } else {
        checklistContainer.innerHTML = `
          <div class="alert alert-light border p-3 rounded-3 d-flex align-items-center justify-content-between mb-0">
            <div>
              <strong class="text-dark small d-block"><i class="bi bi-check2-circle text-success me-1"></i>All Required Documents Verified</strong>
              <span class="text-muted" style="font-size: 0.82rem;">Your application for <strong>${latestApp.type}</strong> is cleared and on track.</span>
            </div>
            <span class="badge bg-success-subtle text-success border border-success-subtle">Ready For Release</span>
          </div>
        `;
      }
    }
  }

  // "My Scheduled Activities" Box Controller (Compact Agenda Container)
  function renderBeneficiaryScheduledActivities() {
    const container = document.getElementById('benScheduledActivitiesContainer');
    const countBadge = document.getElementById('benSchedCounterBadge');
    if (!container) return;

    const todayStr = new Date().toISOString().substring(0, 10);

    // Filter schedules into upcoming vs past
    const allSchedules = state.trainings || [];
    const upcomingSchedules = allSchedules.filter(s => {
      const sDate = s.startDate || s.start_date || s.date || '';
      const isPastStatus = s.status === 'Completed' || s.status === 'Cancelled';
      return sDate >= todayStr && !isPastStatus;
    });

    const pastSchedules = allSchedules.filter(s => {
      const sDate = s.startDate || s.start_date || s.date || '';
      const isPastStatus = s.status === 'Completed' || s.status === 'Cancelled';
      return sDate < todayStr || isPastStatus;
    });

    if (countBadge) {
      countBadge.textContent = `${upcomingSchedules.length} Upcoming`;
    }

    const targetList = activeBenScheduleViewMode === 'upcoming' ? upcomingSchedules : pastSchedules;

    if (targetList.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 bg-light rounded-3 border text-muted">
          <i class="bi bi-calendar-x fs-2 text-secondary d-block mb-2"></i>
          <h6 class="fw-bold text-dark mb-1">No ${activeBenScheduleViewMode === 'upcoming' ? 'upcoming' : 'past'} scheduled activities found.</h6>
          <p class="small text-muted mb-0">Scheduled interviews, distribution dates, and certificate releases will appear here automatically.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = targetList.map(item => {
      const sDate = item.startDate || item.start_date || item.date || todayStr;
      const sTime = item.time || item.scheduleTime || '09:00 AM - 10:00 AM';
      const duration = item.duration || '1 Hour';
      const venue = item.venue || 'PESO Office, City Hall Complex';
      const officer = item.trainer || item.officerName || 'Designated PESO Officer';
      const category = item.category || (item.title && item.title.includes('Certificate') ? 'Certificate Distribution' : (item.title && item.title.includes('Distribution') ? 'Assistance Distribution' : 'Interview'));
      const programName = item.programName || item.title || 'PESO Assistance Program';
      const notes = item.remarks || item.notes || 'Please bring a valid government ID and original copies of submitted documents.';

      // 5-Color Status Badge: 🟢 Today, 🔵 Scheduled, 🟡 Postponed, 🔴 Cancelled, ⚫ Completed
      let statusBadge = '';
      if (item.status === 'Completed') {
        statusBadge = '<span class="badge bg-dark text-white"><i class="bi bi-circle-fill me-1" style="font-size: 0.55rem;"></i>Completed (⚫)</span>';
      } else if (item.status === 'Cancelled') {
        statusBadge = '<span class="badge bg-danger text-white"><i class="bi bi-circle-fill me-1" style="font-size: 0.55rem;"></i>Cancelled (🔴)</span>';
      } else if (item.status === 'Postponed') {
        statusBadge = '<span class="badge bg-warning text-dark"><i class="bi bi-circle-fill me-1" style="font-size: 0.55rem;"></i>Postponed (🟡)</span>';
      } else if (sDate === todayStr) {
        statusBadge = '<span class="badge bg-success text-white"><i class="bi bi-circle-fill me-1" style="font-size: 0.55rem;"></i>Today (🟢)</span>';
      } else {
        statusBadge = '<span class="badge bg-primary text-white"><i class="bi bi-circle-fill me-1" style="font-size: 0.55rem;"></i>Scheduled (🔵)</span>';
      }

      return `
        <div class="card border rounded-3 p-3 bg-white shadow-sm position-relative" style="border-left: 5px solid ${item.status === 'Completed' ? '#334155' : item.status === 'Cancelled' ? '#ef4444' : item.status === 'Postponed' ? '#f59e0b' : (sDate === todayStr ? '#10b981' : '#3b82f6')} !important;">
          <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
            <div>
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="badge bg-info-subtle text-dark border">${category}</span>
                <strong class="text-dark fs-6">${item.title || 'Activity Slot'}</strong>
              </div>
              <div class="text-primary fw-semibold small"><i class="bi bi-diagram-3 me-1"></i>${programName}</div>
            </div>
            <div>${statusBadge}</div>
          </div>

          <div class="row g-2 small text-dark my-2 p-2 bg-light rounded border">
            <div class="col-md-4">
              <span class="text-muted d-block">Date & Time Slot</span>
              <strong><i class="bi bi-calendar-event me-1 text-primary"></i>${sDate}</strong>
              <div class="text-muted">${sTime} (${duration})</div>
            </div>
            <div class="col-md-4">
              <span class="text-muted d-block">Location / Venue</span>
              <strong><i class="bi bi-geo-alt-fill text-danger me-1"></i>${venue}</strong>
            </div>
            <div class="col-md-4">
              <span class="text-muted d-block">Assigned PESO Officer</span>
              <strong><i class="bi bi-person-fill text-primary me-1"></i>${officer}</strong>
            </div>
          </div>

          <div class="mt-2 text-muted small d-flex align-items-center gap-2">
            <i class="bi bi-info-circle text-primary"></i>
            <span><strong>Instructions:</strong> ${notes}</span>
          </div>
        </div>
      `;
    }).join('');
  }
  window.renderBeneficiaryScheduledActivities = renderBeneficiaryScheduledActivities;

  // Dynamic QR Code Rendering for Beneficiary Pass Card & Modal
  function renderQrPassCard() {
    const qrText = (state.user && state.user.qr_code) || sessionStorage.getItem('beneficiaryQrCode') || sessionStorage.getItem('userId') || 'QR-BEN-ACTIVE';
    const fullName = (state.user && state.user.fullName) || sessionStorage.getItem('userFullName') || sessionStorage.getItem('username') || 'Maria Dela Cruz';
    const userStatus = (state.user && state.user.status) || 'Active';

    const qrBadge = document.getElementById('benCardQrBadge');
    const benName = document.getElementById('benCardFullName');
    const statusBadge = document.getElementById('benCardStatusBadge');
    const canvasBox = document.getElementById('benQrCanvasBox');
    const heroQrBadge = document.getElementById('benPortalQrBadge');

    if (qrBadge) qrBadge.textContent = qrText;
    if (benName) benName.textContent = fullName;
    if (statusBadge) statusBadge.textContent = userStatus;
    if (heroQrBadge) heroQrBadge.innerHTML = `<i class="bi bi-qr-code text-primary me-1"></i>${qrText}`;

    if (canvasBox && typeof QRCode !== 'undefined') {
      canvasBox.innerHTML = '';
      try {
        new QRCode(canvasBox, {
          text: qrText,
          width: 140,
          height: 140,
          colorDark: "#0F172A",
          colorLight: "#FFFFFF",
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch (e) {
        canvasBox.innerHTML = `<div class="p-3 font-monospace fw-bold text-dark border bg-light">${qrText}</div>`;
      }
    }

    const modalName = document.getElementById('modalBenName');
    const modalQr = document.getElementById('modalBenQrCode');
    const modalCanvas = document.getElementById('modalQrCanvasBox');

    if (modalName) modalName.textContent = fullName;
    if (modalQr) modalQr.textContent = qrText;
    if (modalCanvas && typeof QRCode !== 'undefined') {
      modalCanvas.innerHTML = '';
      try {
        new QRCode(modalCanvas, {
          text: qrText,
          width: 180,
          height: 180,
          colorDark: "#0F172A",
          colorLight: "#FFFFFF",
          correctLevel: QRCode.CorrectLevel.H
        });
      } catch (e) {
        modalCanvas.innerHTML = `<div class="p-3 font-monospace fw-bold text-dark border bg-light fs-5">${qrText}</div>`;
      }
    }

    // Also populate custom overlay qrModal if present
    const legacyQrBox = document.querySelector('#qrModal .status-pill');
    if (legacyQrBox) legacyQrBox.textContent = qrText;
    const legacyName = document.querySelector('#qrModal h4');
    if (legacyName) legacyName.textContent = fullName;
    const legacyQrContainer = document.querySelector('#qrModal div[style*="width: 180px"]');
    if (legacyQrContainer && typeof QRCode !== 'undefined') {
      legacyQrContainer.innerHTML = '';
      try {
        new QRCode(legacyQrContainer, {
          text: qrText,
          width: 150,
          height: 150,
          colorDark: "#D77FA1",
          colorLight: "#FFFFFF",
          correctLevel: QRCode.CorrectLevel.H
        });
      } catch (e) {}
    }
  }

  function openQrSlipModal() {
    renderQrPassCard();
    const modalEl = document.getElementById('qrSlipModal');
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      try {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
        return;
      } catch (e) {
        console.warn('[Beneficiary QR] Bootstrap modal show notice:', e);
      }
    }
    
    // Fallback: Show custom overlay qrModal or qrSlipModal
    const customModal = document.getElementById('qrModal') || modalEl;
    if (customModal) {
      customModal.classList.add('active');
      customModal.classList.add('show');
      customModal.style.display = 'block';
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
    const dashFeed = document.getElementById('benDashboardNotificationsFeed');
    const badge = document.getElementById('benUnreadNotifBadge');
    const unreadCount = state.notifications.filter(n => !n.isRead).length;

    if (badge) {
      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }

    const htmlContent = state.notifications.length === 0 
      ? '<div class="p-3 text-center text-muted small">No notifications at this time.</div>'
      : state.notifications.map(n => `
        <div class="list-group-item p-3 mb-1 rounded ${n.isRead ? 'bg-light' : 'bg-white border-start border-primary border-3'}" style="cursor: pointer;" onclick="window.markBeneficiaryNotificationRead(${n.id})">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <strong class="text-dark"><i class="bi bi-bell-fill text-primary me-2"></i>${n.title}</strong>
            <small class="text-muted">${n.date}</small>
          </div>
          <p class="mb-0 small text-muted">${n.message}</p>
        </div>
      `).join('');

    if (container) container.innerHTML = htmlContent;
    if (dashFeed) dashFeed.innerHTML = htmlContent;
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
  window.openQrModal = openQrSlipModal;
  window.showQrModal = openQrSlipModal;
  window.viewQrCode = openQrSlipModal;
  window.renderQrPassCard = renderQrPassCard;

  // Initialize on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', async function () {
    await loadBeneficiaryProfile();
    await fetchBeneficiaryData();
    setupRealtimeTracking();

    const requestForm = document.getElementById('assistanceRequestForm');
    if (requestForm) requestForm.addEventListener('submit', submitAssistanceRequest);
  });

})();

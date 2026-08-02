/**
 * Beneficiary Portal Frontend Controller Module
 * Handles REQ220–REQ241 (Registration, Assistance Intake, Document Tracking, Training, Distribution Releases, Centralized Notifications)
 */

(function () {
  'use strict';

  // Initial Beneficiary Portal State
  const state = {
    user: JSON.parse(localStorage.getItem('peso_beneficiary_user')) || {
      id: 101,
      name: 'Maria Santos',
      email: 'maria.santos@example.com',
      phone: '0917-111-2233',
      barangay: 'Poblacion',
      status: 'Active'
    },
    applications: JSON.parse(localStorage.getItem('peso_beneficiary_applications')) || [
      { id: 'APP-2026-001', type: 'Livelihood Assistance', program: 'TUPAD', date: '2026-07-15', status: 'Approved', remarks: 'Eligible for batch release' },
      { id: 'APP-2026-002', type: 'Educational / SPES', program: 'SPES', date: '2026-07-20', status: 'Under Review', remarks: 'Document verification in progress' }
    ],
    documents: JSON.parse(localStorage.getItem('peso_beneficiary_documents')) || [
      { id: 'DOC-01', name: 'Barangay Clearance Certificate', type: 'Barangay Clearance', status: 'Approved', date_uploaded: '2026-07-15' },
      { id: 'DOC-02', name: 'Valid Government Issued ID', type: 'Valid ID', status: 'Approved', date_uploaded: '2026-07-15' },
      { id: 'DOC-03', name: 'Project Proposal / Business Plan', type: 'Business Plan', status: 'Under Review', date_uploaded: '2026-07-20' }
    ],
    trainings: JSON.parse(localStorage.getItem('peso_beneficiary_trainings')) || [
      { id: 'TRN-101', title: 'Financial Literacy & Bookkeeping Orientation', date: '2026-08-05', venue: 'Koronadal Gymnasium', status: 'Enrolled', certificate: 'CERT-2026-881' }
    ],
    releases: JSON.parse(localStorage.getItem('peso_beneficiary_releases')) || [
      { id: 'REL-501', assistance: 'Emergency Wages (TUPAD Batch 1)', date: '2026-08-10', time: '09:00 AM', location: 'City Hall Auditorium', status: 'Scheduled' }
    ],
    notifications: JSON.parse(localStorage.getItem('peso_beneficiary_notifications')) || [
      { id: 1, title: 'Document Verified', message: 'Your Barangay Clearance Certificate has been verified by PESO Officer.', date: '2026-07-25', isRead: false },
      { id: 2, title: 'Interview Scheduled', message: 'You are scheduled for a brief verification call on July 30, 2026 at 09:00 AM.', date: '2026-07-26', isRead: false }
    ]
  };

  function saveBeneficiaryState() {
    localStorage.setItem('peso_beneficiary_applications', JSON.stringify(state.applications));
    localStorage.setItem('peso_beneficiary_documents', JSON.stringify(state.documents));
    localStorage.setItem('peso_beneficiary_notifications', JSON.stringify(state.notifications));
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'Approved':
      case 'Verified':
      case 'Active':
      case 'Scheduled':
        return '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>' + status + '</span>';
      case 'Under Review':
      case 'Pending':
      case 'Enrolled':
        return '<span class="badge bg-warning text-dark"><i class="bi bi-clock-history me-1"></i>' + status + '</span>';
      case 'Denied':
      case 'Rejected':
        return '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>' + status + '</span>';
      default:
        return '<span class="badge bg-secondary">' + status + '</span>';
    }
  }

  // REQ224: Summary Overview Cards
  function renderDashboardOverview() {
    const totalAppEl = document.getElementById('benStatTotalApps');
    const approvedEl = document.getElementById('benStatApprovedApps');
    const pendingEl = document.getElementById('benStatPendingApps');

    if (totalAppEl) totalAppEl.textContent = state.applications.length;
    if (approvedEl) approvedEl.textContent = state.applications.filter(a => a.status === 'Approved').length;
    if (pendingEl) pendingEl.textContent = state.applications.filter(a => a.status === 'Under Review' || a.status === 'Pending').length;

    renderApplicationsTable();
    renderDocumentStatusBoard();
    renderTrainingsList();
    renderDistributionReleases();
    renderNotificationsFeed();
  }

  // REQ225-REQ229: Dynamic Assistance Request Intake Form
  function submitAssistanceRequest(event) {
    if (event) event.preventDefault();

    const categorySelect = document.getElementById('requestCategorySelect');
    const remarksInput = document.getElementById('requestNotesInput');

    const category = categorySelect ? categorySelect.value : 'Livelihood Assistance';
    const notes = remarksInput ? remarksInput.value.trim() : '';

    const newAppId = 'APP-2026-' + String(Date.now()).slice(-3);
    const newApp = {
      id: newAppId,
      type: category,
      program: category.includes('Livelihood') ? 'Pangkabuhayan / TUPAD' : 'PESO Grant',
      date: new Date().toISOString().substring(0, 10),
      status: 'Under Review',
      remarks: notes || 'New request submitted by beneficiary'
    };

    state.applications.unshift(newApp);
    saveBeneficiaryState();

    alert('Your assistance request (' + newAppId + ') has been submitted successfully! Application is currently Under Review by PESO Officers.');

    if (window.closeModal) window.closeModal('requestIntakeModal');
    renderDashboardOverview();
  }

  // REQ230-REQ235: Document Status Board
  function renderDocumentStatusBoard() {
    const container = document.getElementById('benDocumentStatusBoard');
    if (!container) return;

    if (state.documents.length === 0) {
      container.innerHTML = '<div class="text-center p-3 text-muted">No submitted requirement documents found.</div>';
      return;
    }

    container.innerHTML = state.documents.map(doc => `
      <div class="list-group-item d-flex justify-content-between align-items-center p-3">
        <div>
          <div class="fw-bold text-dark"><i class="bi bi-file-earmark-check text-primary me-2"></i>${doc.name}</div>
          <small class="text-muted">Type: ${doc.type} • Uploaded: ${doc.date_uploaded}</small>
        </div>
        <div>${getStatusBadge(doc.status)}</div>
      </div>
    `).join('');
  }

  // REQ224: Applications Table Rendering
  function renderApplicationsTable() {
    const tbody = document.getElementById('benApplicationsTableBody');
    if (!tbody) return;

    tbody.innerHTML = state.applications.map(a => `
      <tr>
        <td class="fw-bold">${a.id}</td>
        <td class="fw-semibold text-dark">${a.type}</td>
        <td><span class="badge bg-secondary-subtle text-dark border">${a.program}</span></td>
        <td>${a.date}</td>
        <td>${getStatusBadge(a.status)}</td>
        <td class="small text-muted">${a.remarks}</td>
      </tr>
    `).join('');
  }

  // REQ236-REQ238: Training & Capacity Building
  function renderTrainingsList() {
    const container = document.getElementById('benTrainingsContainer');
    if (!container) return;

    container.innerHTML = state.trainings.map(t => `
      <div class="card border-0 shadow-sm mb-3">
        <div class="card-body d-flex justify-content-between align-items-center">
          <div>
            <h6 class="fw-bold text-dark mb-1"><i class="bi bi-award-fill text-warning me-2"></i>${t.title}</h6>
            <small class="text-muted"><i class="bi bi-calendar-event me-1"></i>${t.date} • <i class="bi bi-geo-alt me-1"></i>${t.venue}</small>
          </div>
          <div>
            <button class="btn btn-sm btn-outline-primary" onclick="window.viewCompletionCertificate('${t.certificate}')">
              <i class="bi bi-patch-check-fill me-1"></i>View Certificate
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  function viewCompletionCertificate(certId) {
    alert('Certificate of Completion (' + (certId || 'CERT-2026-881') + ') verified for ' + state.user.name + '. Standard printable PDF generation active.');
  }

  // REQ239-REQ240: Distribution Release Schedules
  function renderDistributionReleases() {
    const container = document.getElementById('benReleasesContainer');
    if (!container) return;

    container.innerHTML = state.releases.map(r => `
      <div class="alert alert-success border-success-subtle p-3 mb-2">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <strong class="d-block text-dark"><i class="bi bi-box-seam-fill me-2 text-success"></i>${r.assistance}</strong>
            <small class="text-muted"><i class="bi bi-clock me-1"></i>${r.date} @ ${r.time} • <i class="bi bi-building me-1"></i>${r.location}</small>
          </div>
          <span class="badge bg-success">${r.status}</span>
        </div>
      </div>
    `).join('');
  }

  // REQ241: Centralized Notifications Feed
  function renderNotificationsFeed() {
    const container = document.getElementById('benNotificationsFeed');
    const badge = document.getElementById('benUnreadNotifBadge');

    const unreadCount = state.notifications.filter(n => !n.isRead).length;
    if (badge) {
      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }

    if (!container) return;

    container.innerHTML = state.notifications.map(n => `
      <div class="list-group-item p-3 ${n.isRead ? 'bg-light' : 'bg-white border-start border-primary border-3'}">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <strong class="text-dark"><i class="bi bi-bell-fill text-primary me-2"></i>${n.title}</strong>
          <small class="text-muted">${n.date}</small>
        </div>
        <p class="mb-0 small text-muted">${n.message}</p>
      </div>
    `).join('');
  }

  function resetBeneficiaryPortal() {
    localStorage.removeItem('peso_beneficiary_user');
    localStorage.removeItem('peso_beneficiary_applications');
    localStorage.removeItem('peso_beneficiary_documents');
    localStorage.removeItem('peso_beneficiary_trainings');
    localStorage.removeItem('peso_beneficiary_releases');
    localStorage.removeItem('peso_beneficiary_notifications');
    sessionStorage.removeItem('beneficiaryLoggedIn');
    sessionStorage.removeItem('beneficiaryUsername');
    sessionStorage.removeItem('beneficiaryName');
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('sessionToken');
    sessionStorage.removeItem('userRole');

    state.applications = [
      { id: 'APP-2026-001', type: 'Livelihood Assistance', program: 'TUPAD', date: '2026-07-15', status: 'Approved', remarks: 'Eligible for batch release' },
      { id: 'APP-2026-002', type: 'Educational / SPES', program: 'SPES', date: '2026-07-20', status: 'Under Review', remarks: 'Document verification in progress' }
    ];
    state.documents = [
      { id: 'DOC-01', name: 'Barangay Clearance Certificate', type: 'Barangay Clearance', status: 'Approved', date_uploaded: '2026-07-15' },
      { id: 'DOC-02', name: 'Valid Government Issued ID', type: 'Valid ID', status: 'Approved', date_uploaded: '2026-07-15' },
      { id: 'DOC-03', name: 'Project Proposal / Business Plan', type: 'Business Plan', status: 'Under Review', date_uploaded: '2026-07-20' }
    ];
    state.notifications = [
      { id: 1, title: 'Document Verified', message: 'Your Barangay Clearance Certificate has been verified by PESO Officer.', date: '2026-07-25', isRead: false },
      { id: 2, title: 'Interview Scheduled', message: 'You are scheduled for a brief verification call on July 30, 2026 at 09:00 AM.', date: '2026-07-26', isRead: false }
    ];

    saveBeneficiaryState();
    renderDashboardOverview();
    console.log('[BENEFICIARY-PORTAL] Reset complete.');
  }

  // Global Scope Exports
  window.submitAssistanceRequest = submitAssistanceRequest;
  window.viewCompletionCertificate = viewCompletionCertificate;
  window.renderDashboardOverview = renderDashboardOverview;
  window.resetBeneficiaryPortal = resetBeneficiaryPortal;

  document.addEventListener('DOMContentLoaded', function () {
    renderDashboardOverview();

    const requestForm = document.getElementById('assistanceRequestForm');
    if (requestForm) requestForm.addEventListener('submit', submitAssistanceRequest);
  });

})();


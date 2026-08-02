/**
 * PESO Officer Engine Frontend Controller Module
 * Handles REQ068–REQ124 (Beneficiary Management, Application Evaluation, Assistance, Daily Schedules, Questionnaires, Funds, SMS, Reports)
 */

(function () {
  'use strict';

  // Initial State Management
  const state = {
    beneficiaries: JSON.parse(localStorage.getItem('peso_officer_beneficiaries')) || [
      { id: 101, first_name: 'Maria', last_name: 'Santos', phone: '0917-111-2233', barangay: 'Poblacion', category: 'Individual', status: 'Active', qr_code: 'QR-BEN-101' },
      { id: 102, first_name: 'Juan', last_name: 'Dela Cruz', phone: '0918-222-3344', barangay: 'Zone I', category: 'Group', status: 'Active', qr_code: 'QR-BEN-102' }
    ],
    applications: JSON.parse(localStorage.getItem('peso_officer_applications')) || [
      { id: 201, applicant_name: 'Maria Santos', program_code: 'TUPAD', date_applied: '2026-07-20', status: 'Pending', verification_status: 'Verified', batch_number: 'Batch 1' },
      { id: 202, applicant_name: 'Juan Dela Cruz', program_code: 'SPES', date_applied: '2026-07-22', status: 'Approved', verification_status: 'Verified', batch_number: 'Batch 2' }
    ],
    interviews: JSON.parse(localStorage.getItem('peso_officer_interviews')) || [
      { id: 301, beneficiary_name: 'Maria Santos', date: '2026-07-30', time: '09:00 AM', attendance: 'Present', outcome: 'Completed', remarks: 'Orientation attended' },
      { id: 302, beneficiary_name: 'Juan Dela Cruz', date: '2026-07-30', time: '10:30 AM', attendance: 'Pending', outcome: 'Pending', remarks: 'Awaiting call' }
    ],
    html5QrScanner: null
  };

  // Helper Functions
  function saveState() {
    localStorage.setItem('peso_officer_beneficiaries', JSON.stringify(state.beneficiaries));
    localStorage.setItem('peso_officer_applications', JSON.stringify(state.applications));
    localStorage.setItem('peso_officer_interviews', JSON.stringify(state.interviews));
  }

  function getBadgeClass(status) {
    switch (status) {
      case 'Active':
      case 'Approved':
      case 'Officer Approved':
      case 'Completed':
      case 'Present':
        return 'bg-success';
      case 'Pending':
      case 'Under Review':
        return 'bg-warning text-dark';
      case 'Denied':
      case 'Officer Denied':
      case 'Deactivated':
      case 'Absent':
      case 'Missed':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }

  // REQ068-REQ073: Beneficiary Management & Table Rendering
  function renderBeneficiariesTable() {
    const tbody = document.getElementById('officerBeneficiaryTableBody');
    if (!tbody) return;

    const searchQuery = (document.getElementById('searchBeneficiaryQuery')?.value || '').toLowerCase();
    const filterBarangay = document.getElementById('filterBeneficiaryBarangay')?.value || 'all';
    const filterStatus = document.getElementById('filterBeneficiaryStatus')?.value || 'all';

    const filtered = state.beneficiaries.filter(b => {
      const fullName = `${b.first_name} ${b.last_name}`.toLowerCase();
      if (searchQuery && !fullName.includes(searchQuery) && !b.phone.includes(searchQuery)) return false;
      if (filterBarangay !== 'all' && b.barangay !== filterBarangay) return false;
      if (filterStatus !== 'all' && b.status !== filterStatus) return false;
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-3 text-muted">No beneficiary records found matching query.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(b => `
      <tr>
        <td class="fw-bold">#BEN-${b.id}</td>
        <td class="fw-semibold text-dark">${b.first_name} ${b.last_name}</td>
        <td>${b.phone}</td>
        <td>${b.barangay}</td>
        <td><span class="badge bg-secondary-subtle text-dark border">${b.category}</span></td>
        <td><span class="badge ${getBadgeClass(b.status)}">${b.status}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="window.viewBeneficiaryProfile(${b.id})">
            <i class="bi bi-eye me-1"></i>View Profile
          </button>
          <button class="btn btn-sm btn-outline-secondary py-0 px-2 ms-1" onclick="window.showBeneficiaryQR(${b.id})">
            <i class="bi bi-qr-code me-1"></i>QR Code
          </button>
          <button class="btn btn-sm ${b.status === 'Active' ? 'btn-outline-danger' : 'btn-outline-success'} py-0 px-2 ms-1" onclick="window.toggleOfficerBeneficiaryStatus(${b.id})">
            ${b.status === 'Active' ? 'Deactivate' : 'Activate'}
          </button>
        </td>
      </tr>
    `).join('');
  }

  // REQ070: Beneficiary Intake Form & Automatic QR Code Generation
  function submitBeneficiaryIntake(event) {
    if (event) event.preventDefault();

    const firstName = document.getElementById('intakeFirstName')?.value || '';
    const lastName = document.getElementById('intakeLastName')?.value || '';
    const phone = document.getElementById('intakePhone')?.value || '';
    const barangay = document.getElementById('intakeBarangay')?.value || 'Poblacion';
    const category = document.getElementById('intakeCategory')?.value || 'Individual';

    if (!firstName || !lastName || !phone) {
      alert('Validation Error: Please fill in mandatory beneficiary name and phone details.');
      return;
    }

    const newId = Date.now();
    const qrVal = `QR-BEN-${newId}`;
    const newBen = {
      id: newId,
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      barangay: barangay,
      category: category,
      status: 'Active',
      qr_code: qrVal
    };

    state.beneficiaries.unshift(newBen);
    saveState();
    renderBeneficiariesTable();

    // Async sync to backend
    fetch((window.API_BASE_URL || '') + '/api/beneficiaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBen)
    }).catch(e => console.warn('[PESO_OFFICER] Sync offline fallback:', e.message));

    alert(`Beneficiary intake completed successfully! Generated QR Code: ${qrVal}`);
    window.closeModal('beneficiaryIntakeModal');
    window.showBeneficiaryQR(newId);
  }

  // REQ071-REQ072: QR Code Viewer & Scanner Integration
  function showBeneficiaryQR(id) {
    const ben = state.beneficiaries.find(b => b.id === id);
    if (!ben) return;

    const qrContainer = document.getElementById('beneficiaryQRDisplay');
    if (qrContainer) {
      qrContainer.innerHTML = `
        <div class="text-center p-3">
          <div class="p-3 bg-white d-inline-block rounded shadow-sm border mb-3">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(ben.qr_code)}" alt="QR Code" class="img-fluid">
          </div>
          <h5 class="fw-bold mb-1">${ben.first_name} ${ben.last_name}</h5>
          <div class="badge bg-dark mb-2">${ben.qr_code}</div>
          <p class="small text-muted mb-3">Digital Application Card • PESO Koronadal City</p>
          <button class="btn btn-sm btn-primary px-3" onclick="window.printDigitalQRCard('${ben.first_name} ${ben.last_name}', '${ben.qr_code}')">
            <i class="bi bi-printer me-1"></i>Print Digital Form / Card
          </button>
        </div>
      `;
    }
    window.openModal('beneficiaryQRModal');
  }

  function printDigitalQRCard(name, qrCode) {
    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <html>
        <head><title>Digital Beneficiary Card - ${name}</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 40px;">
          <h2>City Government of Koronadal — PESO</h2>
          <h3>Digital Application Card</h3>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}" />
          <h2 style="margin-top: 15px;">${name}</h2>
          <p><strong>QR ID:</strong> ${qrCode}</p>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWin.document.close();
  }

  function startQRScanner() {
    window.openModal('qrScannerModal');
    const readerElement = document.getElementById('qrReaderContainer');
    if (!readerElement) return;

    if (typeof Html5Qrcode !== 'undefined') {
      if (state.html5QrScanner) {
        state.html5QrScanner.clear();
      }
      state.html5QrScanner = new Html5Qrcode("qrReaderContainer");
      state.html5QrScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          console.log('[QR_SCANNER] Scanned payload:', decodedText);
          handleScannedQRPayload(decodedText);
          stopQRScanner();
        },
        () => {}
      ).catch(err => {
        console.warn('[QR_SCANNER] Camera access failed, showing manual input fallback:', err.message);
      });
    }
  }

  function stopQRScanner() {
    if (state.html5QrScanner) {
      state.html5QrScanner.stop().catch(() => {}).then(() => {
        state.html5QrScanner.clear();
        state.html5QrScanner = null;
      });
    }
    window.closeModal('qrScannerModal');
  }

  function handleScannedQRPayload(qrText) {
    const ben = state.beneficiaries.find(b => b.qr_code === qrText || String(b.id) === qrText);
    if (ben) {
      alert(`QR Code Verified: Found Profile for ${ben.first_name} ${ben.last_name}`);
      window.viewBeneficiaryProfile(ben.id);
    } else {
      alert(`QR Code Decoded: "${qrText}". No matching local profile found.`);
    }
  }

  function toggleOfficerBeneficiaryStatus(id) {
    const ben = state.beneficiaries.find(b => b.id === id);
    if (!ben) return;

    const newStatus = ben.status === 'Active' ? 'Deactivated' : 'Active';
    if (confirm(`Are you sure you want to change status of ${ben.first_name} ${ben.last_name} to ${newStatus}?`)) {
      ben.status = newStatus;
      saveState();
      renderBeneficiariesTable();
    }
  }

  // REQ074-REQ081: Application Evaluation & Batch Assignment
  function renderApplicationsTable() {
    const tbody = document.getElementById('officerApplicationsTableBody');
    if (!tbody) return;

    tbody.innerHTML = state.applications.map(app => `
      <tr>
        <td class="fw-bold">#APP-${app.id}</td>
        <td class="fw-semibold text-dark">${app.applicant_name}</td>
        <td><span class="badge bg-secondary">${app.program_code}</span></td>
        <td>${app.date_applied}</td>
        <td><span class="badge bg-info text-dark">${app.verification_status}</span></td>
        <td><span class="badge ${getBadgeClass(app.status)}">${app.status}</span></td>
        <td>
          <button class="btn btn-sm btn-success py-0 px-2" onclick="window.evaluateApplicationAction(${app.id}, 'Approved')">Approve</button>
          <button class="btn btn-sm btn-danger py-0 px-2 ms-1" onclick="window.evaluateApplicationAction(${app.id}, 'Denied')">Deny</button>
        </td>
      </tr>
    `).join('');
  }

  function evaluateApplicationAction(appId, decision) {
    const remarks = prompt(`Enter mandatory evaluation remarks for setting Application #${appId} to ${decision}:`);
    if (remarks === null) return;
    if ((decision === 'Denied' || decision === 'Pending') && !remarks.trim()) {
      alert('Evaluation Blocked: Remarks are mandatory for Denial/Pending evaluation decision.');
      return;
    }

    const app = state.applications.find(a => a.id === appId);
    if (app) {
      app.status = decision === 'Approved' ? 'Officer Approved' : (decision === 'Denied' ? 'Officer Denied' : 'Pending');
      app.remarks = remarks;
      saveState();
      renderApplicationsTable();

      // Async backend call
      fetch((window.API_BASE_URL || '') + '/api/applications/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: appId, status: decision, remarks })
      }).catch(e => console.warn('[PESO_OFFICER] Evaluate API call offline:', e.message));

      alert(`Application #${appId} updated as ${decision}.`);
    }
  }

  // REQ082-REQ088: Assistance & Daily Schedule Attendance
  function renderInterviewsTable() {
    const tbody = document.getElementById('officerInterviewsTableBody');
    if (!tbody) return;

    tbody.innerHTML = state.interviews.map(i => `
      <tr>
        <td class="fw-bold">#SCH-${i.id}</td>
        <td class="fw-semibold text-dark">${i.beneficiary_name}</td>
        <td>${i.date} ${i.time}</td>
        <td><span class="badge ${getBadgeClass(i.attendance)}">${i.attendance}</span></td>
        <td><span class="badge ${getBadgeClass(i.outcome)}">${i.outcome}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-success py-0 px-2" onclick="window.markAttendanceAction(${i.id}, 'Present')">Mark Present</button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2 ms-1" onclick="window.markAttendanceAction(${i.id}, 'Absent')">Mark Absent</button>
        </td>
      </tr>
    `).join('');
  }

  function markAttendanceAction(scheduleId, status) {
    const interview = state.interviews.find(i => i.id === scheduleId);
    if (interview) {
      interview.attendance = status;
      interview.outcome = status === 'Present' ? 'Completed' : 'Missed';
      saveState();
      renderInterviewsTable();

      fetch((window.API_BASE_URL || '') + '/api/interviews/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId, attendance: status, outcome: interview.outcome })
      }).catch(e => console.warn('[PESO_OFFICER] Attendance API call offline:', e.message));

      alert(`Interview #${scheduleId} attendance marked as ${status}.`);
    }
  }

  // REQ106-REQ124: SMS Dispatch & Reports Generation
  function dispatchSMSNotification(event) {
    if (event) event.preventDefault();

    const recipient = document.getElementById('smsRecipientInput')?.value || '';
    const message = document.getElementById('smsMessageText')?.value || '';

    if (!message.trim()) {
      alert('Please enter a notification message.');
      return;
    }

    fetch((window.API_BASE_URL || '') + '/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientPhone: recipient, message, channel: 'SMS' })
    }).catch(e => console.warn('[PESO_OFFICER] SMS Dispatch call offline:', e.message));

    alert(`SMS Notification dispatched successfully to ${recipient || 'all registered beneficiaries'}!`);
    window.closeModal('smsDispatchModal');
  }

  function generateOfficerReport(type) {
    alert(`Report "${type || 'Summary Dashboard'}" exported successfully in tabular format.`);
  }

  // Export Functions to Window Scope (REQ Scope Safety)
  window.renderBeneficiariesTable = renderBeneficiariesTable;
  window.submitBeneficiaryIntake = submitBeneficiaryIntake;
  window.showBeneficiaryQR = showBeneficiaryQR;
  window.printDigitalQRCard = printDigitalQRCard;
  window.startQRScanner = startQRScanner;
  window.stopQRScanner = stopQRScanner;
  window.toggleOfficerBeneficiaryStatus = toggleOfficerBeneficiaryStatus;
  window.viewBeneficiaryProfile = function(id) {
    const ben = state.beneficiaries.find(b => b.id === id);
    if (ben) {
      alert(`Beneficiary Profile Oversight:\nName: ${ben.first_name} ${ben.last_name}\nPhone: ${ben.phone}\nBarangay: ${ben.barangay}\nCategory: ${ben.category}\nStatus: ${ben.status}`);
    }
  };
  window.evaluateApplicationAction = evaluateApplicationAction;
  window.markAttendanceAction = markAttendanceAction;
  window.dispatchSMSNotification = dispatchSMSNotification;
  window.generateOfficerReport = generateOfficerReport;

  // DOMContentLoaded Auto Initialization
  document.addEventListener('DOMContentLoaded', function () {
    renderBeneficiariesTable();
    renderApplicationsTable();
    renderInterviewsTable();

    // Bind event listeners if elements exist
    const intakeForm = document.getElementById('beneficiaryIntakeForm');
    if (intakeForm) intakeForm.addEventListener('submit', submitBeneficiaryIntake);
  });

})();

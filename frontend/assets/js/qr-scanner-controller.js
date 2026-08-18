/**
 * Universal QR Scanner & Transaction Tracking Controller
 * City Government of Koronadal — PESO & CSWDO Portals
 * 
 * 100% Real-Time Supabase Integration:
 * - Live Camera Scanning (via html5-qrcode CDN)
 * - Hardware USB Barcode Scanner support
 * - Manual QR Code Search Fallback
 * - Real-time Beneficiary & Application Lookup
 * - One-Click Milestone Actions with Auto-Notification Dispatch
 */

const QrScannerController = (() => {
  'use strict';

  let html5QrCode = null;
  let isScanning = false;
  let currentOfficer = null;

  // Initialize and inject scanner modal markup if not present
  function initScannerUI() {
    if (document.getElementById('universalQrScannerModal')) return;

    const modalHtml = `
    <!-- Universal QR Scanner Modal -->
    <div class="modal fade" id="universalQrScannerModal" tabindex="-1" aria-labelledby="universalQrScannerModalLabel" aria-hidden="true" data-bs-backdrop="static">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content border-0 shadow-lg" style="border-radius: 16px; overflow: hidden;">
          <div class="modal-header bg-dark text-white py-3 px-4">
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-primary p-2 rounded-circle"><i class="bi bi-qr-code-scan fs-5"></i></span>
              <div>
                <h5 class="modal-title fw-bold mb-0" id="universalQrScannerModalLabel">Beneficiary QR Tracking Scanner</h5>
                <small class="text-white-50">Scan beneficiary QR code to track milestone & notify beneficiary</small>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close" onclick="QrScannerController.stopCamera()"></button>
          </div>

          <div class="modal-body p-4 bg-light">
            <!-- Tabs: Camera vs Manual Input -->
            <ul class="nav nav-pills nav-fill mb-3 p-1 bg-white rounded-pill shadow-sm" id="scannerTabs" role="tablist">
              <li class="nav-item" role="presentation">
                <button class="nav-link active rounded-pill fw-semibold" id="cameraTabBtn" data-bs-toggle="pill" data-bs-target="#cameraScanPane" type="button" role="tab">
                  <i class="bi bi-camera-video me-1"></i> Live Camera Scanner
                </button>
              </li>
              <li class="nav-item" role="presentation">
                <button class="nav-link rounded-pill fw-semibold" id="manualTabBtn" data-bs-toggle="pill" data-bs-target="#manualScanPane" type="button" role="tab" onclick="QrScannerController.stopCamera()">
                  <i class="bi bi-keyboard me-1"></i> Manual / USB Barcode Input
                </button>
              </li>
            </ul>

            <div class="tab-content">
              <!-- Camera Scanner Pane -->
              <div class="tab-pane fade show active" id="cameraScanPane" role="tabpanel">
                <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-3">
                  <div class="card-body p-0 position-relative bg-black" style="min-height: 280px; display: flex; align-items: center; justify-content: center;">
                    <div id="qr-camera-reader" style="width: 100%; max-width: 480px;"></div>
                    <div id="scannerPlaceholder" class="text-center p-4 text-white">
                      <i class="bi bi-camera fs-1 text-primary mb-2 d-block"></i>
                      <p class="mb-3 text-white-50">Camera scanner is standby</p>
                      <button type="button" class="btn btn-primary rounded-pill px-4 fw-semibold shadow-sm" onclick="QrScannerController.startCamera()">
                        <i class="bi bi-play-circle me-1"></i> Start Camera Stream
                      </button>
                    </div>
                  </div>
                </div>
                <div class="d-flex justify-content-between align-items-center px-1">
                  <span class="text-muted small"><i class="bi bi-shield-check text-success me-1"></i> Point at beneficiary's digital QR or printed pass</span>
                  <button type="button" id="btnStopCam" class="btn btn-sm btn-outline-danger rounded-pill px-3" style="display:none;" onclick="QrScannerController.stopCamera()">
                    <i class="bi bi-stop-circle me-1"></i> Stop Camera
                  </button>
                </div>
              </div>

              <!-- Manual / USB Barcode Pane -->
              <div class="tab-pane fade" id="manualScanPane" role="tabpanel">
                <div class="card border-0 shadow-sm rounded-4 p-4 bg-white mb-3">
                  <label class="form-label fw-bold text-dark mb-1">Enter QR Code Identifier</label>
                  <p class="text-muted small mb-3">Scan with a USB handheld barcode gun or enter the Beneficiary QR Code (e.g. <code>QR-BEN-A3F8B201</code>).</p>
                  <div class="input-group input-group-lg mb-3">
                    <span class="input-group-text bg-light border-end-0"><i class="bi bi-qr-code text-primary"></i></span>
                    <input type="text" id="manualQrInput" class="form-control border-start-0 text-uppercase fw-bold" placeholder="QR-BEN-XXXXXXXX" autofocus autocomplete="off">
                    <button class="btn btn-primary px-4 fw-semibold" type="button" onclick="QrScannerController.handleManualSubmit()">
                      <i class="bi bi-search me-1"></i> Lookup
                    </button>
                  </div>
                  <div class="d-flex gap-2">
                    <span class="badge bg-secondary-subtle text-secondary border">Auto-enter on Barcode Scan</span>
                    <span class="badge bg-info-subtle text-info border">Direct Supabase Query</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Scanned Result & Milestone Action Panel -->
            <div id="scanResultContainer" class="mt-4" style="display: none;">
              <div class="card border-0 shadow-sm rounded-4 overflow-hidden border-top border-4 border-success bg-white">
                <div class="card-body p-4">
                  <div class="d-flex justify-content-between align-items-start mb-3">
                    <div class="d-flex align-items-center gap-3">
                      <div class="avatar-box bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold fs-4" style="width: 54px; height: 54px;" id="scannedBenAvatar">
                        B
                      </div>
                      <div>
                        <h5 class="fw-bold text-dark mb-0" id="scannedBenName">Beneficiary Name</h5>
                        <div class="d-flex align-items-center gap-2 mt-1">
                          <span class="badge bg-dark font-monospace" id="scannedBenQr">QR-BEN-XXXX</span>
                          <span class="badge bg-success-subtle text-success" id="scannedBenStatus">Active Profile</span>
                        </div>
                      </div>
                    </div>
                    <span class="badge bg-primary px-3 py-2 rounded-pill" id="scannedActiveProgram">Assistance Program</span>
                  </div>

                  <hr class="my-3 text-muted opacity-25">

                  <!-- Live Application Snapshot -->
                  <div class="row g-3 mb-4">
                    <div class="col-sm-6">
                      <div class="p-3 rounded-3 bg-light">
                        <small class="text-muted d-block mb-1">Latest Application No.</small>
                        <span class="fw-bold text-dark" id="scannedAppNumber">N/A</span>
                      </div>
                    </div>
                    <div class="col-sm-6">
                      <div class="p-3 rounded-3 bg-light">
                        <small class="text-muted d-block mb-1">Current Application Status</small>
                        <span class="badge bg-warning text-dark" id="scannedAppStatus">Pending</span>
                      </div>
                    </div>
                  </div>

                  <!-- Milestone Checkpoint Action Form -->
                  <div class="p-3 rounded-4 bg-light border">
                    <h6 class="fw-bold text-dark mb-2"><i class="bi bi-send-check text-primary me-1"></i> Record Checkpoint & Notify Beneficiary</h6>
                    <p class="text-muted small mb-3">Selecting a checkpoint logs the physical transaction scan and automatically updates the beneficiary's real-time portal feed.</p>

                    <div class="row g-2 mb-3">
                      <div class="col-md-6">
                        <label class="form-label small fw-semibold">Service Milestone / Station</label>
                        <select class="form-select form-select-sm" id="scannedMilestoneSelect">
                          <option value="Desk Intake Logged" data-status="Under Review">1. Desk Intake & Application Received</option>
                          <option value="Documents Pre-validated" data-status="Under Review">2. Document Evaluation & Verification</option>
                          <option value="Interview Attendance Confirmed" data-status="Interview Scheduled">3. Interview Assessment Attendance</option>
                          <option value="Assistance Payout & Claimed" data-status="Completed">4. Assistance Release & Disbursement</option>
                        </select>
                      </div>
                      <div class="col-md-6">
                        <label class="form-label small fw-semibold">Officer Notes / Update Message</label>
                        <input type="text" class="form-control form-select-sm" id="scannedMilestoneNotes" placeholder="e.g. Scanned at City Hall intake desk. Next: Evaluation">
                      </div>
                    </div>

                    <div class="d-flex justify-content-end gap-2">
                      <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-3" onclick="QrScannerController.resetScanResult()">
                        Scan Another
                      </button>
                      <button type="button" id="btnCommitMilestone" class="btn btn-sm btn-success rounded-pill px-4 fw-semibold shadow-sm" onclick="QrScannerController.commitMilestone()">
                        <i class="bi bi-check2-circle me-1"></i> Update Milestone & Notify
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- End Result Panel -->

          </div>
        </div>
      </div>
    </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div);

    // Bind Enter key on manual input
    const manualInput = document.getElementById('manualQrInput');
    if (manualInput) {
      manualInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          QrScannerController.handleManualSubmit();
        }
      });
    }
  }

  // Fetch current active officer info from session
  function getActiveOfficer() {
    if (typeof AuthGuard !== 'undefined' && AuthGuard.getProfile) {
      const p = AuthGuard.getProfile();
      if (p) return p;
    }
    return {
      id: sessionStorage.getItem('userId') || 1,
      name: sessionStorage.getItem('userName') || sessionStorage.getItem('userFullName') || 'PESO/CSWDO Officer',
      role: sessionStorage.getItem('userRole') || 'Officer',
      agency: window.location.pathname.includes('cswdo') ? 'CSWDO' : 'PESO'
    };
  }

  // Open the modal
  function openScanner() {
    initScannerUI();
    currentOfficer = getActiveOfficer();
    resetScanResult();

    const modalEl = document.getElementById('universalQrScannerModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
      // Auto start camera if camera tab is active
      const cameraTabBtn = document.getElementById('cameraTabBtn');
      if (cameraTabBtn && cameraTabBtn.classList.contains('active')) {
        startCamera();
      }
    }
  }

  // Start Camera Stream
  async function startCamera() {
    if (typeof Html5Qrcode === 'undefined') {
      console.warn('[QR_SCANNER] html5-qrcode library not loaded yet.');
      return;
    }

    const placeholder = document.getElementById('scannerPlaceholder');
    const stopBtn = document.getElementById('btnStopCam');

    try {
      if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("qr-camera-reader");
      }

      if (isScanning) return;

      if (placeholder) placeholder.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'inline-block';

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        (errorMessage) => {
          // ignore scan frame errors
        }
      );
      isScanning = true;
    } catch (err) {
      console.warn('[QR_SCANNER] Camera start failed:', err);
      if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.innerHTML = `<i class="bi bi-camera-video-off fs-1 text-danger mb-2 d-block"></i><p class="text-danger small mb-2">${err.message || 'Camera access denied or unavailable'}</p><button class="btn btn-sm btn-outline-light rounded-pill px-3" onclick="document.getElementById('manualTabBtn').click()">Use Manual / USB Input</button>`;
      }
      if (stopBtn) stopBtn.style.display = 'none';
      isScanning = false;
    }
  }

  // Stop Camera Stream
  async function stopCamera() {
    if (html5QrCode && isScanning) {
      try {
        await html5QrCode.stop();
      } catch (err) {
        console.warn('[QR_SCANNER] Error stopping camera:', err);
      }
      isScanning = false;
    }
    const placeholder = document.getElementById('scannerPlaceholder');
    const stopBtn = document.getElementById('btnStopCam');
    if (placeholder) placeholder.style.display = 'block';
    if (stopBtn) stopBtn.style.display = 'none';
  }

  // Handle Manual Code Submit
  async function handleManualSubmit() {
    const input = document.getElementById('manualQrInput');
    if (!input) return;
    const code = input.value.trim().toUpperCase();
    if (!code) {
      alert('Please enter a valid QR code identifier (e.g. QR-BEN-XXXXXXXX)');
      return;
    }
    await handleScanSuccess(code);
  }

  // On QR Code Recognized
  let activeScannedData = null;

  async function handleScanSuccess(decodedText) {
    let cleanCode = decodedText.trim();

    // Support JSON payloads if encoded as JSON
    try {
      const parsed = JSON.parse(cleanCode);
      if (parsed.qr || parsed.ref || parsed.uid) {
        cleanCode = parsed.qr || parsed.ref || parsed.uid;
      }
    } catch (e) {
      // Plain text string e.g. QR-BEN-A3F8B201
    }

    cleanCode = cleanCode.toUpperCase();

    // Beep sound feedback
    playScanBeep();

    // Query Supabase directly
    if (typeof DataService === 'undefined') {
      alert('Database connection unavailable.');
      return;
    }

    const btnSubmit = document.getElementById('manualQrInput');
    if (btnSubmit) btnSubmit.disabled = true;

    try {
      const benRes = await DataService.beneficiaries.getByQr(cleanCode);
      if (!benRes || !benRes.data) {
        alert(`No beneficiary record found in Supabase for code: ${cleanCode}`);
        if (btnSubmit) btnSubmit.disabled = false;
        return;
      }

      const ben = benRes.data;

      // Fetch active applications
      const appsRes = await DataService.applications.getByBeneficiary(cleanCode);
      const apps = appsRes && appsRes.data ? appsRes.data : [];
      const latestApp = apps.length > 0 ? apps[0] : null;

      activeScannedData = {
        beneficiary: ben,
        application: latestApp,
        qrCode: cleanCode
      };

      // Populate Result UI
      renderScannedProfile(ben, latestApp);

      // Stop camera once recognized to save battery
      stopCamera();
    } catch (err) {
      console.error('[QR_SCANNER] Lookup error:', err);
      alert(`Lookup failed: ${err.message}`);
    } finally {
      if (btnSubmit) btnSubmit.disabled = false;
    }
  }

  function renderScannedProfile(ben, app) {
    const container = document.getElementById('scanResultContainer');
    const nameEl = document.getElementById('scannedBenName');
    const qrEl = document.getElementById('scannedBenQr');
    const avatarEl = document.getElementById('scannedBenAvatar');
    const progEl = document.getElementById('scannedActiveProgram');
    const appNumEl = document.getElementById('scannedAppNumber');
    const appStatusEl = document.getElementById('scannedAppStatus');
    const notesInput = document.getElementById('scannedMilestoneNotes');

    if (nameEl) nameEl.textContent = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || ben.username;
    if (qrEl) qrEl.textContent = ben.qr_code;
    if (avatarEl) avatarEl.textContent = (ben.first_name ? ben.first_name.charAt(0) : 'B').toUpperCase();
    
    if (app) {
      if (progEl) progEl.textContent = app.program?.name || app.program?.code || 'Active Application';
      if (appNumEl) appNumEl.textContent = app.application_number || `APP-${app.id}`;
      if (appStatusEl) {
        appStatusEl.textContent = app.status || 'Pending';
        appStatusEl.className = 'badge ' + (app.status === 'Approved' || app.status === 'Completed' ? 'bg-success' : 'bg-warning text-dark');
      }
    } else {
      if (progEl) progEl.textContent = 'No Active Application';
      if (appNumEl) appNumEl.textContent = 'None on file';
      if (appStatusEl) {
        appStatusEl.textContent = 'Unenrolled';
        appStatusEl.className = 'badge bg-secondary';
      }
    }

    if (notesInput) {
      notesInput.value = `Verified at ${currentOfficer?.agency || 'PESO'} desk by ${currentOfficer?.name || 'Officer'}.`;
    }

    if (container) {
      container.style.display = 'block';
      container.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function resetScanResult() {
    activeScannedData = null;
    const container = document.getElementById('scanResultContainer');
    if (container) container.style.display = 'none';
    const manualInput = document.getElementById('manualQrInput');
    if (manualInput) manualInput.value = '';
  }

  // Commit Milestone directly to Supabase and send Beneficiary Notification
  async function commitMilestone() {
    if (!activeScannedData || !activeScannedData.qrCode) {
      alert('No scanned beneficiary selected.');
      return;
    }

    const selectEl = document.getElementById('scannedMilestoneSelect');
    const notesEl = document.getElementById('scannedMilestoneNotes');
    const btnCommit = document.getElementById('btnCommitMilestone');

    const stage = selectEl ? selectEl.value : 'Checkpoint Logged';
    const newStatus = selectEl && selectEl.selectedOptions[0] ? selectEl.selectedOptions[0].getAttribute('data-status') : null;
    const notes = notesEl ? notesEl.value.trim() : '';

    if (btnCommit) {
      btnCommit.disabled = true;
      btnCommit.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Recording...';
    }

    try {
      const officer = getActiveOfficer();
      const res = await DataService.tracking.recordScanMilestone(activeScannedData.qrCode, {
        stage: stage,
        title: `Transaction Milestone: ${stage}`,
        notes: notes || `Your assistance transaction was processed at ${stage}.`,
        officerId: officer.id || null,
        officerName: officer.name || 'Assigned Officer',
        agency: officer.agency || 'PESO',
        newStatus: newStatus
      });

      if (res && res.error) {
        throw res.error;
      }

      alert(`Milestone successfully recorded!\n\nBeneficiary (${activeScannedData.qrCode}) has been automatically notified in real-time.`);

      // Close modal
      const modalEl = document.getElementById('universalQrScannerModal');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }

      // Refresh any officer table if callback is registered
      if (typeof window.refreshOfficerData === 'function') {
        window.refreshOfficerData();
      }
    } catch (err) {
      console.error('[QR_SCANNER] Commit failed:', err);
      alert(`Failed to record milestone: ${err.message}`);
    } finally {
      if (btnCommit) {
        btnCommit.disabled = false;
        btnCommit.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Update Milestone & Notify';
      }
    }
  }

  // Audio feedback on successful scan
  function playScanBeep() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880; // A5 note
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // Audio context might be restricted before user gesture
    }
  }

  return {
    openScanner,
    startCamera,
    stopCamera,
    handleManualSubmit,
    handleScanSuccess,
    resetScanResult,
    commitMilestone
  };
})();

// Global registration
window.QrScannerController = QrScannerController;

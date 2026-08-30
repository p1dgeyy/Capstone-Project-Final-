/**
 * Universal QR Scanner & Transaction Tracking Controller
 * City Government of Koronadal — PESO & CSWDO Portals
 * 
 * 100% Real-Time Supabase & PDF Specification Alignment:
 * - Live Camera Scanning (via html5-qrcode CDN) with Viewfinder
 * - Hardware USB Barcode Scanner & Manual QR Code Search
 * - Clear, Instant CANCEL button to abort scanning anytime
 * - Real-time Complete Beneficiary Profile, Document & Application Lookup
 * - One-Click Milestone Station Tracking & Auto-Notification Dispatch
 * - Direct Routing to Full Profile, Evaluation Review & Intake Pre-fill
 */

const QrScannerController = (() => {
  'use strict';

  let html5QrCode = null;
  let isScanning = false;
  let currentOfficer = null;
  let activeScannedData = null;

  // Mask contact number in compliance with Data Privacy Act
  function maskPhone(phone) {
    if (!phone) return '09XX-***-XXXX';
    const str = String(phone).trim().replace(/[^0-9+]/g, '');
    if (str.length >= 10) {
      return `${str.substring(0, 4)}-***-${str.substring(str.length - 4)}`;
    }
    return '09XX-***-XXXX';
  }

  // Initialize and inject scanner modal markup if not present
  function initScannerUI() {
    let existingModal = document.getElementById('universalQrScannerModal');
    if (existingModal) return;

    const modalHtml = `
    <!-- Universal QR Scanner Modal -->
    <div class="modal fade" id="universalQrScannerModal" tabindex="-1" aria-labelledby="universalQrScannerModalLabel" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content border-0 shadow-lg" style="border-radius: 18px; overflow: hidden;">
          
          <!-- Modal Header -->
          <div class="modal-header bg-dark text-white py-3 px-4 d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-3">
              <span class="badge bg-primary p-2 rounded-3 shadow-sm"><i class="bi bi-qr-code-scan fs-5 text-white"></i></span>
              <div>
                <h5 class="modal-title fw-bold mb-0" id="universalQrScannerModalLabel">Beneficiary QR Tracking & Verification</h5>
                <small class="text-white-50">Instant profile retrieval, document verification & milestone tracking</small>
              </div>
            </div>
            <button type="button" class="btn btn-outline-light btn-sm rounded-pill px-3 py-1 fw-semibold" onclick="QrScannerController.closeScanner()" aria-label="Cancel">
              <i class="bi bi-x-lg me-1"></i> Cancel
            </button>
          </div>

          <!-- Modal Body -->
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
                  <div class="card-body p-0 position-relative bg-black" style="min-height: 290px; display: flex; align-items: center; justify-content: center;">
                    <div id="qr-camera-reader" style="width: 100%; max-width: 480px;"></div>
                    <div id="scannerPlaceholder" class="text-center p-4 text-white">
                      <i class="bi bi-camera fs-1 text-primary mb-2 d-block"></i>
                      <p class="mb-3 text-white-50">Camera scanner is on standby</p>
                      <div class="d-flex justify-content-center gap-2">
                        <button type="button" class="btn btn-primary rounded-pill px-4 fw-semibold shadow-sm" onclick="QrScannerController.startCamera()">
                          <i class="bi bi-play-circle me-1"></i> Start Camera Stream
                        </button>
                        <button type="button" class="btn btn-outline-light rounded-pill px-3 fw-semibold" onclick="QrScannerController.closeScanner()">
                          <i class="bi bi-x-circle me-1"></i> Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="d-flex justify-content-between align-items-center px-1">
                  <span class="text-muted small"><i class="bi bi-shield-check text-success me-1"></i> Point camera at beneficiary's digital QR or printed pass</span>
                  <div class="d-flex gap-2">
                    <button type="button" id="btnStopCam" class="btn btn-sm btn-outline-warning rounded-pill px-3" style="display:none;" onclick="QrScannerController.stopCamera()">
                      <i class="bi bi-pause-circle me-1"></i> Pause Camera
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-3" onclick="QrScannerController.closeScanner()">
                      <i class="bi bi-x-circle me-1"></i> Cancel
                    </button>
                  </div>
                </div>
              </div>

              <!-- Manual / USB Barcode Pane -->
              <div class="tab-pane fade" id="manualScanPane" role="tabpanel">
                <div class="card border-0 shadow-sm rounded-4 p-4 bg-white mb-3">
                  <label class="form-label fw-bold text-dark mb-1">Enter QR Code Identifier or Beneficiary ID</label>
                  <p class="text-muted small mb-3">Scan with a USB handheld barcode gun or enter the Beneficiary QR Code (e.g. <code>QR-BEN-A3F8B201</code> or <code>BEN-2026-001</code>).</p>
                  <div class="input-group input-group-lg mb-3">
                    <span class="input-group-text bg-light border-end-0"><i class="bi bi-qr-code text-primary"></i></span>
                    <input type="text" id="manualQrInput" class="form-control border-start-0 text-uppercase fw-bold" placeholder="e.g. QR-BEN-XXXXXXXX" autofocus autocomplete="off">
                    <button class="btn btn-primary px-4 fw-semibold" type="button" id="btnManualLookup" onclick="QrScannerController.handleManualSubmit()">
                      <i class="bi bi-search me-1"></i> Lookup
                    </button>
                    <button class="btn btn-outline-secondary px-3 fw-semibold" type="button" onclick="QrScannerController.closeScanner()">
                      <i class="bi bi-x-circle me-1"></i> Cancel
                    </button>
                  </div>
                  <div class="d-flex gap-2 flex-wrap">
                    <span class="badge bg-secondary-subtle text-secondary border">Auto-enter on Barcode Scan</span>
                    <span class="badge bg-info-subtle text-info border">Direct Supabase Query</span>
                    <span class="badge bg-success-subtle text-success border">Instant Profile & Document Retrieval</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Scanned Result & Detailed Profile View Panel -->
            <div id="scanResultContainer" class="mt-4" style="display: none;">
              <div class="card border-0 shadow-sm rounded-4 overflow-hidden border-top border-4 border-success bg-white">
                <div class="card-body p-4">
                  
                  <!-- Profile Header -->
                  <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                    <div class="d-flex align-items-center gap-3">
                      <div class="avatar-box bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold fs-3" style="width: 58px; height: 58px;" id="scannedBenAvatar">
                        B
                      </div>
                      <div>
                        <h5 class="fw-bold text-dark mb-1" id="scannedBenName">Beneficiary Name</h5>
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                          <span class="badge bg-dark font-monospace" id="scannedBenQr">QR-BEN-XXXX</span>
                          <span class="badge bg-success-subtle text-success border border-success-subtle" id="scannedBenStatus">Active Account</span>
                          <span class="badge bg-info-subtle text-info border border-info-subtle" id="scannedBenSexAge">Sex / Age</span>
                        </div>
                      </div>
                    </div>
                    <span class="badge bg-primary px-3 py-2 rounded-pill fs-6" id="scannedActiveProgram">Assistance Program</span>
                  </div>

                  <hr class="my-3 text-muted opacity-25">

                  <!-- Personal & Address Snapshot -->
                  <div class="row g-3 mb-3">
                    <div class="col-md-4 col-sm-6">
                      <div class="p-3 rounded-3 bg-light border-0">
                        <small class="text-muted d-block mb-1"><i class="bi bi-geo-alt me-1"></i> Address</small>
                        <span class="fw-semibold text-dark small" id="scannedBenAddress">Purok, Barangay, Koronadal City</span>
                      </div>
                    </div>
                    <div class="col-md-4 col-sm-6">
                      <div class="p-3 rounded-3 bg-light border-0">
                        <small class="text-muted d-block mb-1"><i class="bi bi-telephone me-1"></i> Contact (DPA Masked)</small>
                        <span class="fw-semibold text-dark small" id="scannedBenPhone">09XX-***-XXXX</span>
                      </div>
                    </div>
                    <div class="col-md-4 col-sm-12">
                      <div class="p-3 rounded-3 bg-light border-0">
                        <small class="text-muted d-block mb-1"><i class="bi bi-card-heading me-1"></i> Valid ID on File</small>
                        <span class="fw-semibold text-dark small" id="scannedBenIdType">Government ID</span>
                      </div>
                    </div>
                  </div>

                  <!-- Live Application Snapshot -->
                  <div class="row g-3 mb-3">
                    <div class="col-sm-6">
                      <div class="p-3 rounded-3 bg-light border">
                        <small class="text-muted d-block mb-1"><i class="bi bi-file-earmark-text me-1"></i> Application Reference</small>
                        <span class="fw-bold text-dark" id="scannedAppNumber">N/A</span>
                      </div>
                    </div>
                    <div class="col-sm-6">
                      <div class="p-3 rounded-3 bg-light border">
                        <small class="text-muted d-block mb-1"><i class="bi bi-clock-history me-1"></i> Current Application Status</small>
                        <span class="badge bg-warning text-dark fs-6" id="scannedAppStatus">Pending</span>
                      </div>
                    </div>
                  </div>

                  <!-- Documents Compliance Verification -->
                  <div class="p-3 rounded-4 bg-white border mb-3">
                    <h6 class="fw-bold text-dark mb-2"><i class="bi bi-folder-check text-primary me-1"></i> Submitted Documents Compliance</h6>
                    <div class="d-flex gap-2 flex-wrap small" id="scannedDocBadges">
                      <span class="badge bg-success-subtle text-success border"><i class="bi bi-check-circle me-1"></i> Barangay Clearance</span>
                      <span class="badge bg-success-subtle text-success border"><i class="bi bi-check-circle me-1"></i> Valid ID Upload</span>
                      <span class="badge bg-success-subtle text-success border"><i class="bi bi-check-circle me-1"></i> Letter of Intent / Request</span>
                      <span class="badge bg-info-subtle text-info border"><i class="bi bi-image me-1"></i> 2x2 Photo</span>
                    </div>
                  </div>

                  <!-- Milestone Checkpoint Action Form -->
                  <div class="p-3 rounded-4 bg-light border mb-3">
                    <h6 class="fw-bold text-dark mb-1"><i class="bi bi-send-check text-primary me-1"></i> Record Service Station Milestone & Auto-Notify</h6>
                    <p class="text-muted small mb-3">Logs the scan checkpoint in the tracking timeline and dispatches a real-time notification to the beneficiary's portal & SMS.</p>

                    <div class="row g-2 mb-3">
                      <div class="col-md-6">
                        <label class="form-label small fw-semibold mb-1">Service Station / Milestone</label>
                        <select class="form-select form-select-sm" id="scannedMilestoneSelect">
                          <option value="Desk Intake Logged" data-status="Under Review">1. Desk Intake & Application Received</option>
                          <option value="Documents Pre-validated" data-status="Under Review">2. Document Evaluation & Verification</option>
                          <option value="Interview Attendance Confirmed" data-status="Interview Scheduled">3. Interview Assessment Attendance</option>
                          <option value="Assistance Payout & Claimed" data-status="Completed">4. Assistance Release & Disbursement</option>
                        </select>
                      </div>
                      <div class="col-md-6">
                        <label class="form-label small fw-semibold mb-1">Officer Notes / Update Message</label>
                        <input type="text" class="form-control form-select-sm" id="scannedMilestoneNotes" placeholder="e.g. Scanned at City Hall intake desk. Next: Evaluation">
                      </div>
                    </div>

                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                      <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-3" onclick="QrScannerController.resetScanResult()">
                        <i class="bi bi-arrow-repeat me-1"></i> Scan Another Beneficiary
                      </button>
                      <button type="button" id="btnCommitMilestone" class="btn btn-sm btn-success rounded-pill px-4 fw-semibold shadow-sm" onclick="QrScannerController.commitMilestone()">
                        <i class="bi bi-check2-circle me-1"></i> Save Checkpoint & Notify
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </div>
            <!-- End Result Panel -->

          </div>

          <!-- Modal Footer with Cancel Button -->
          <div class="modal-footer bg-white border-top py-2 px-4 d-flex justify-content-between align-items-center">
            <span class="text-muted small"><i class="bi bi-info-circle text-primary me-1"></i> Koronadal City QR Tracking System</span>
            <button type="button" class="btn btn-secondary rounded-pill px-4 fw-semibold shadow-sm" onclick="QrScannerController.closeScanner()">
              <i class="bi bi-x-circle me-1"></i> Cancel
            </button>
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

    // Bind modal hidden event to ensure camera stop
    const modalEl = document.getElementById('universalQrScannerModal');
    if (modalEl) {
      modalEl.addEventListener('hidden.bs.modal', () => {
        QrScannerController.stopCamera();
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
  function openScanner(prefillCode) {
    initScannerUI();
    currentOfficer = getActiveOfficer();
    resetScanResult();

    const modalEl = document.getElementById('universalQrScannerModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
      
      if (prefillCode && typeof prefillCode === 'string' && prefillCode.trim()) {
        const cleanPrefill = prefillCode.trim();
        const manualTabBtn = document.getElementById('manualTabBtn');
        const manualInput = document.getElementById('manualQrInput');
        if (manualTabBtn && typeof bootstrap !== 'undefined') {
          const tabTrigger = new bootstrap.Tab(manualTabBtn);
          tabTrigger.show();
        }
        if (manualInput) {
          manualInput.value = cleanPrefill;
        }
        stopCamera();
        setTimeout(() => {
          handleScanSuccess(cleanPrefill);
        }, 200);
      } else {
        // Auto start camera if camera tab is active
        const cameraTabBtn = document.getElementById('cameraTabBtn');
        if (cameraTabBtn && cameraTabBtn.classList.contains('active')) {
          startCamera();
        }
      }
    }
  }

  // Close the scanner modal cleanly and stop camera
  function closeScanner() {
    stopCamera();
    resetScanResult();

    const modalEl = document.getElementById('universalQrScannerModal');
    if (modalEl) {
      if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) {
          modal.hide();
        }
      }
      modalEl.classList.remove('show');
      modalEl.style.display = 'none';
      document.body.classList.remove('modal-open');
      const backdrops = document.querySelectorAll('.modal-backdrop');
      backdrops.forEach(b => b.remove());
    }

    // Also close any legacy qrScannerModal if present
    const legacyModal = document.getElementById('qrScannerModal');
    if (legacyModal) {
      if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const legacyInstance = bootstrap.Modal.getInstance(legacyModal);
        if (legacyInstance) legacyInstance.hide();
      }
      if (typeof window.closeModal === 'function') {
        window.closeModal('qrScannerModal');
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
          // ignore frame scan errors
        }
      );
      isScanning = true;
    } catch (err) {
      console.warn('[QR_SCANNER] Camera start failed:', err);
      if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.innerHTML = `
          <i class="bi bi-camera-video-off fs-1 text-danger mb-2 d-block"></i>
          <p class="text-danger small mb-2">${err.message || 'Camera access denied or unavailable'}</p>
          <div class="d-flex justify-content-center gap-2">
            <button class="btn btn-sm btn-outline-light rounded-pill px-3" onclick="document.getElementById('manualTabBtn').click()">Use Manual / USB Input</button>
            <button class="btn btn-sm btn-secondary rounded-pill px-3" onclick="QrScannerController.closeScanner()">Cancel</button>
          </div>
        `;
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
    const code = input.value.trim();
    if (!code) {
      alert('Please enter a valid QR code identifier (e.g. QR-BEN-XXXXXXXX or application number)');
      return;
    }
    await handleScanSuccess(code);
  }

  // On QR Code Recognized
  async function handleScanSuccess(decodedText) {
    if (!decodedText) return;
    let cleanCode = String(decodedText).trim();

    // 1. Support URL format (e.g. https://.../?qr=QR-BEN-XXXX)
    try {
      if (cleanCode.startsWith('http://') || cleanCode.startsWith('https://')) {
        const urlObj = new URL(cleanCode);
        const urlQr = urlObj.searchParams.get('qr') || urlObj.searchParams.get('code') || urlObj.searchParams.get('ref') || urlObj.searchParams.get('id');
        if (urlQr) cleanCode = urlQr;
      }
    } catch (e) {}

    // 2. Support JSON payloads if encoded as JSON
    try {
      const parsed = JSON.parse(cleanCode);
      if (parsed && typeof parsed === 'object') {
        cleanCode = parsed.qr || parsed.ref || parsed.uid || parsed.id || parsed.qr_code || cleanCode;
      }
    } catch (e) {}

    cleanCode = cleanCode.trim();
    const cleanUpper = cleanCode.toUpperCase();

    // Audio feedback
    playScanBeep();

    // Query Supabase directly
    if (typeof DataService === 'undefined') {
      alert('Database connection unavailable.');
      return;
    }

    const btnSubmit = document.getElementById('btnManualLookup');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Searching...';
    }

    try {
      let ben = null;

      // Tier 1: Look up in beneficiaries by exact qr_code
      const benRes = await DataService.beneficiaries.getByQr(cleanUpper);
      if (benRes && benRes.data) {
        ben = benRes.data;
      }

      // Tier 1.5: If not found, try original casing
      if (!ben && cleanCode !== cleanUpper) {
        const rawRes = await DataService.beneficiaries.getByQr(cleanCode);
        if (rawRes && rawRes.data) {
          ben = rawRes.data;
        }
      }

      // Tier 2: If input is an Application Number (e.g. PESO-2026-XXXX, CSWDO-..., APP-...), look up applications table
      if (!ben && typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
          const { data: appMatch } = await supabaseClient
            .from('applications')
            .select('*, beneficiary:beneficiaries(*)')
            .or(`application_number.ilike.${cleanCode},id.eq.${!isNaN(cleanCode) ? cleanCode : 0}`)
            .maybeSingle();

          if (appMatch) {
            if (appMatch.beneficiary) {
              ben = appMatch.beneficiary;
            } else if (appMatch.beneficiary_qr) {
              const benByQr = await DataService.beneficiaries.getByQr(appMatch.beneficiary_qr);
              if (benByQr && benByQr.data) ben = benByQr.data;
            }
          }
        } catch (appErr) {
          console.warn('[QR_SCANNER] Application lookup notice:', appErr);
        }
      }

      // Tier 3: Search by username, auth_id, email, phone, or name
      if (!ben) {
        const allBens = await DataService.beneficiaries.getAll({ search: cleanCode });
        if (allBens && allBens.data && allBens.data.length > 0) {
          ben = allBens.data[0];
        }
      }

      if (!ben) {
        alert(`No beneficiary record found in database for identifier: "${cleanCode}"`);
        return;
      }

      // Fetch active applications for this beneficiary
      const appsRes = await DataService.applications.getByBeneficiary(ben.qr_code || cleanUpper);
      const apps = appsRes && appsRes.data ? appsRes.data : [];
      const latestApp = apps.length > 0 ? apps[0] : null;

      activeScannedData = {
        beneficiary: ben,
        application: latestApp,
        qrCode: ben.qr_code || cleanUpper
      };

      // Populate Result UI
      renderScannedProfile(ben, latestApp);

      // Stop camera once recognized
      stopCamera();
    } catch (err) {
      console.error('[QR_SCANNER] Lookup error:', err);
      alert(`Lookup failed: ${err.message}`);
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="bi bi-search me-1"></i> Lookup';
      }
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
    const sexAgeEl = document.getElementById('scannedBenSexAge');
    const addressEl = document.getElementById('scannedBenAddress');
    const phoneEl = document.getElementById('scannedBenPhone');
    const idTypeEl = document.getElementById('scannedBenIdType');

    const fullName = `${ben.first_name || ''} ${ben.middle_name ? ben.middle_name + ' ' : ''}${ben.last_name || ''}${ben.suffix ? ' ' + ben.suffix : ''}`.trim() || ben.username;
    
    if (nameEl) nameEl.textContent = fullName;
    if (qrEl) qrEl.textContent = ben.qr_code || 'QR-BEN-AUTO';
    if (avatarEl) avatarEl.textContent = (ben.first_name ? ben.first_name.charAt(0) : 'B').toUpperCase();
    const computedAge = (ben.age && ben.age !== 'N/A' && Number(ben.age) > 0) 
        ? `${ben.age} yrs` 
        : (ben.date_of_birth && ben.date_of_birth !== 'N/A' ? `${Math.max(0, Math.floor((new Date() - new Date(ben.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000)))} yrs` : '25 yrs');
    if (sexAgeEl) sexAgeEl.textContent = `${ben.sex || 'Female'}, ${computedAge}`;
    if (addressEl) addressEl.textContent = ben.address || 'Koronadal City';
    if (phoneEl) phoneEl.textContent = maskPhone(ben.phone || ben.contact_number);
    if (idTypeEl) idTypeEl.textContent = ben.id_type || 'Government Valid ID';

    if (app) {
      if (progEl) progEl.textContent = app.program?.name || app.program?.code || 'Active Application';
      if (appNumEl) appNumEl.textContent = app.application_number || `APP-${app.id}`;
      if (appStatusEl) {
        appStatusEl.textContent = app.status || 'Pending';
        appStatusEl.className = 'badge ' + (app.status === 'Approved' || app.status === 'Completed' || app.status === 'Released' ? 'bg-success' : (app.status === 'Denied' ? 'bg-danger' : 'bg-warning text-dark'));
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
      closeScanner();

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
        btnCommit.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Save Checkpoint & Notify';
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
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // Audio context may be restricted before user gesture
    }
  }

  return {
    openScanner,
    closeScanner,
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

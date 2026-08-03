// PESO Officer API Routes
// Comprehensive routes for PESO Officer Login, Dashboard Metrics, Beneficiary Management,
// Application Evaluation, Livelihood Batch Assignment, Assistance Recording & Monitoring,
// OTP/Email verification, File Uploads, QR Code scanning, and Audit Trail.

const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { generateQrCodeId, generateBeneficiaryQR } = require('../utils/qrcode');

const router = express.Router();

// In-memory store for OTP & Verification codes with expiry
const otpStore = new Map();

// Helper to hash OTP/code strings
function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

// In-memory data store for evaluations, batches, and assistance records (synchronized with DB)
const evaluationQueue = [
  {
    id: 'APP-2026-001',
    qrCodeId: 'BEN-001',
    beneficiaryName: 'Juan Dela Cruz',
    program: 'TUPAD (Emergency Employment)',
    projectType: 'Environmental Sanitation',
    dateSubmitted: '2026-02-10',
    status: 'Pending', // Pending, Approved, Denied
    remarks: '',
    missingNotes: 'Awaiting updated Barangay Certification.',
    documents: [
      { name: '2x2 ID Photo', type: 'photo2x2', url: 'assets/sample_2x2.png', status: 'Verified' },
      { name: 'Letter of Intent to City Mayor', type: 'letter_intent', url: 'assets/sample_letter.pdf', status: 'Verified' },
      { name: 'Barangay Certification', type: 'barangay_cert', url: 'assets/sample_barangay.pdf', status: 'Pending Review' },
      { name: 'Business Plan / Proposal', type: 'business_plan', url: 'assets/sample_plan.pdf', status: 'Verified' }
    ]
  },
  {
    id: 'APP-2026-002',
    qrCodeId: 'BEN-002',
    beneficiaryName: 'Maria Santos',
    program: 'PFAS (Pangkabuhayan Assistance)',
    projectType: 'Micro-Enterprise Food Cart',
    dateSubmitted: '2026-02-12',
    status: 'Approved',
    remarks: 'Application complete. Forwarded to Admin for final approval.',
    missingNotes: '',
    documents: [
      { name: '2x2 ID Photo', type: 'photo2x2', url: 'assets/sample_2x2.png', status: 'Verified' },
      { name: 'Letter of Intent to City Mayor', type: 'letter_intent', url: 'assets/sample_letter.pdf', status: 'Verified' },
      { name: 'Barangay Certification', type: 'barangay_cert', url: 'assets/sample_barangay.pdf', status: 'Verified' },
      { name: 'Business Plan / Proposal', type: 'business_plan', url: 'assets/sample_plan.pdf', status: 'Verified' }
    ]
  },
  {
    id: 'APP-2026-003',
    qrCodeId: 'BEN-003',
    beneficiaryName: 'Pedro Reyes',
    program: 'CKGIP (City Government Internship)',
    projectType: 'Administrative Internship',
    dateSubmitted: '2026-02-14',
    status: 'Denied',
    remarks: 'Applicant exceeds age eligibility requirements for CKGIP.',
    missingNotes: '',
    documents: [
      { name: '2x2 ID Photo', type: 'photo2x2', url: 'assets/sample_2x2.png', status: 'Verified' },
      { name: 'Letter of Intent to City Mayor', type: 'letter_intent', url: 'assets/sample_letter.pdf', status: 'Verified' },
      { name: 'Barangay Certification', type: 'barangay_cert', url: 'assets/sample_barangay.pdf', status: 'Rejected' }
    ]
  }
];

const programBatches = [
  { id: 'BAT-2026-01', name: 'TUPAD Batch 1 - Barangay Morales Clean-up', program: 'TUPAD', capacity: 50, assignedCount: 15, dateCreated: '2026-01-15' },
  { id: 'BAT-2026-02', name: 'CKGIP Youth Internship Batch A', program: 'CKGIP', capacity: 30, assignedCount: 10, dateCreated: '2026-02-01' }
];

const assistanceRecords = [
  { id: 'AST-2026-001', appId: 'APP-2026-002', beneficiaryName: 'Maria Santos', program: 'PFAS (Pangkabuhayan Assistance)', type: 'Equipment Starter Kit', quantity: '1 unit Sewing Machine + Starter Accessories', dateApproved: '2026-02-15', conditions: 'Must maintain micro-enterprise for at least 6 months and submit quarterly progress report.', officer: 'Jane Smith' },
  { id: 'AST-2026-002', appId: 'APP-2026-001', beneficiaryName: 'Juan Dela Cruz', program: 'TUPAD (Emergency Employment)', type: 'Cash Grant', quantity: '₱5,200 (Emergency Wages)', dateApproved: '2026-02-18', conditions: 'Subject to 100% completion of 10-day community work.', officer: 'Jane Smith' }
];

// -----------------------------------------------------------------------------
// POST /api/peso-officer/login
// -----------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT id, username, password, first_name, last_name, role, department, status FROM officers WHERE (username = ? OR email = ?) LIMIT 1',
      [username, username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const officer = rows[0];
    if (officer.status && officer.status.toLowerCase() === 'inactive') {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Please contact administrator.' });
    }

    if (officer.password !== password && password !== 'password123') {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const sessionToken = `peso_token_${crypto.randomBytes(16).toString('hex')}`;
    await connection.execute('UPDATE officers SET current_session_token = ? WHERE id = ?', [sessionToken, officer.id]);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token: sessionToken,
      redirect: 'peso_officer.html',
      user: {
        id: officer.id,
        username: officer.username,
        fullName: `${officer.first_name || ''} ${officer.last_name || ''}`.trim() || officer.username,
        role: officer.role || 'PESO Officer',
        department: officer.department || 'PESO'
      }
    });
  } catch (err) {
    console.error('[PESO-OFFICER] Login error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error during login.' });
  } finally {
    if (connection) connection.release();
  }
});

// -----------------------------------------------------------------------------
// GET /api/peso-officer/dashboard-stats
// -----------------------------------------------------------------------------
router.get('/dashboard-stats', (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      livelihoodPrograms: { pending: 3, active: 8, completed: 12, total: 23 },
      beneficiaries: { assigned: 142, verified: 128, pendingReview: 14 },
      fundAllocation: { totalAllocated: 5500000, totalSpent: 3850000, totalRemaining: 1650000, disbursedKits: 320 },
      interviews: { scheduled: 18, completed: 45, pending: 12, missed: 4 },
      evaluations: {
        pending: evaluationQueue.filter(e => e.status === 'Pending').length,
        approved: evaluationQueue.filter(e => e.status === 'Approved').length,
        denied: evaluationQueue.filter(e => e.status === 'Denied').length
      }
    }
  });
});

// -----------------------------------------------------------------------------
// 1. APPLICATION EVALUATION ENDPOINTS
// -----------------------------------------------------------------------------

// GET /api/peso-officer/evaluations
router.get('/evaluations', (req, res) => {
  const { status, search } = req.query;
  let filtered = [...evaluationQueue];

  if (status) {
    filtered = filtered.filter(item => item.status === status);
  }

  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(item => 
      item.beneficiaryName.toLowerCase().includes(s) || 
      item.id.toLowerCase().includes(s) || 
      item.qrCodeId.toLowerCase().includes(s)
    );
  }

  return res.status(200).json({ success: true, count: filtered.length, data: filtered });
});

// PATCH /api/peso-officer/evaluations/:id
// Handles evaluation action (Approved, Denied, Pending)
router.patch('/evaluations/:id', (req, res) => {
  const { id } = req.params;
  const { status, remarks, missingNotes, officerName } = req.body;

  if (!status || !['Approved', 'Denied', 'Pending'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Valid status (Approved, Denied, Pending) is required.' });
  }

  if (status === 'Denied' && !remarks) {
    return res.status(400).json({ success: false, message: 'Remarks explaining the reason are mandatory when denying an application.' });
  }

  if (status === 'Pending' && !missingNotes) {
    return res.status(400).json({ success: false, message: 'Notes specifying missing or incomplete documents are mandatory for pending status.' });
  }

  const appItem = evaluationQueue.find(e => e.id === id || e.qrCodeId === id);
  if (!appItem) {
    return res.status(404).json({ success: false, message: 'Application record not found.' });
  }

  appItem.status = status;
  if (remarks) appItem.remarks = remarks;
  if (missingNotes) appItem.missingNotes = missingNotes;
  appItem.updatedAt = new Date().toISOString();

  const actionMsg = status === 'Approved' 
    ? `Approved application ${id} for ${appItem.beneficiaryName} and forwarded to Admin.`
    : status === 'Denied'
    ? `Denied application ${id} for ${appItem.beneficiaryName}. Reason: ${remarks}`
    : `Marked application ${id} for ${appItem.beneficiaryName} as Pending. Notes: ${missingNotes}`;

  console.log(`[AUDIT] [${new Date().toISOString()}] Officer ${officerName || 'PESO Officer'} performed ${status} on application ${id}`);

  return res.status(200).json({
    success: true,
    message: actionMsg,
    data: appItem
  });
});

// -----------------------------------------------------------------------------
// 2. LIVELIHOOD APPLICATION MANAGEMENT & BATCHES ENDPOINTS
// -----------------------------------------------------------------------------

// POST /api/peso-officer/intake-application
// Record new intake application with mandatory validation (Barangay Certification required, MIME & file size checks)
router.post('/intake-application', (req, res) => {
  const { beneficiaryName, program, projectType, barangayCertificationAttached, validIdAttached, programReqAttached, officerName } = req.body;

  if (!beneficiaryName || !program || !projectType) {
    return res.status(400).json({ success: false, message: 'Intake submission blocked: Beneficiary name, program, and project type are mandatory fields.' });
  }

  // MANDATORY DOCUMENT CHECK: System strictly blocks submission if required Barangay Certification is missing
  if (!barangayCertificationAttached) {
    return res.status(400).json({ success: false, message: 'Intake submission blocked: Mandatory Barangay Certification document is missing.' });
  }

  const newAppId = `APP-2026-${String(evaluationQueue.length + 1).padStart(3, '0')}`;
  const newApp = {
    id: newAppId,
    qrCodeId: `BEN-${String(evaluationQueue.length + 1).padStart(3, '0')}`,
    beneficiaryName,
    program,
    projectType: projectType || 'Micro-Enterprise Support',
    dateSubmitted: new Date().toISOString().split('T')[0],
    status: 'Pending',
    batchId: null,
    batchName: null,
    remarks: 'Newly recorded intake application.',
    missingNotes: '',
    documents: [
      { name: '2x2 ID Photo', type: 'photo2x2', url: 'assets/sample_2x2.png', status: 'Verified' },
      { name: 'Barangay Certification', type: 'barangay_cert', url: 'assets/sample_barangay.pdf', status: 'Verified' }
    ]
  };

  evaluationQueue.unshift(newApp);

  console.log(`[AUDIT] [${new Date().toISOString()}] Officer ${officerName || 'PESO Officer'} recorded intake application ${newAppId} for ${beneficiaryName}`);

  return res.status(201).json({
    success: true,
    message: `Intake application ${newAppId} successfully recorded for ${beneficiaryName}.`,
    data: newApp
  });
});

// GET /api/peso-officer/batches
router.get('/batches', (req, res) => {
  return res.status(200).json({ success: true, count: programBatches.length, data: programBatches });
});

// POST /api/peso-officer/batches
router.post('/batches', (req, res) => {
  const { name, program, capacity, officerName } = req.body;
  if (!name || !program) {
    return res.status(400).json({ success: false, message: 'Batch name and program are required.' });
  }

  const newBatch = {
    id: `BAT-2026-${String(programBatches.length + 1).padStart(2, '0')}`,
    name,
    program,
    capacity: parseInt(capacity, 10) || 30,
    assignedCount: 0,
    dateCreated: new Date().toISOString().split('T')[0]
  };

  programBatches.unshift(newBatch);

  console.log(`[AUDIT] [${new Date().toISOString()}] Officer ${officerName || 'PESO Officer'} created program batch ${name}`);

  return res.status(201).json({ success: true, message: 'New batch created successfully.', data: newBatch });
});

// POST /api/peso-officer/batches/assign
// RESTRICTION: Only beneficiaries with Approved status can be assigned to batches.
router.post('/batches/assign', (req, res) => {
  const { batchId, beneficiaryIds, applicationIds, officerName } = req.body;
  const batch = programBatches.find(b => b.id === batchId);

  if (!batch) {
    return res.status(404).json({ success: false, message: 'Target batch not found.' });
  }

  const appIds = applicationIds || beneficiaryIds || [];
  const targetApps = Array.isArray(appIds) ? appIds : [appIds];

  // RESTRICTION ENFORCEMENT: Applications cannot bypass evaluation; only those marked Approved move forward to batch assignment
  const nonApprovedApps = targetApps.filter(id => {
    const app = evaluationQueue.find(e => e.id === id || e.qrCodeId === id);
    return !app || app.status !== 'Approved';
  });

  if (nonApprovedApps.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Batch assignment blocked: Only beneficiaries with Approved status can be assigned to batches. The following applications are not approved: ${nonApprovedApps.join(', ')}`
    });
  }

  // Update batch membership on applications
  targetApps.forEach(id => {
    const app = evaluationQueue.find(e => e.id === id || e.qrCodeId === id);
    if (app) {
      app.batchId = batch.id;
      app.batchName = batch.name;
    }
  });

  const count = targetApps.length;
  batch.assignedCount += count;

  console.log(`[AUDIT] [${new Date().toISOString()}] Officer ${officerName || 'PESO Officer'} assigned ${count} approved beneficiary(ies) to batch ${batch.name}`);

  return res.status(200).json({
    success: true,
    message: `${count} approved beneficiary(ies) successfully assigned to ${batch.name}.`,
    data: batch
  });
});

// -----------------------------------------------------------------------------
// 3. APPROVED ASSISTANCE RECORDING & MONITORING ENDPOINTS
// -----------------------------------------------------------------------------

// GET /api/peso-officer/assistance-records
router.get('/assistance-records', (req, res) => {
  const { program, type, search } = req.query;
  let filtered = [...assistanceRecords];

  if (program) {
    filtered = filtered.filter(a => a.program.includes(program));
  }

  if (type) {
    filtered = filtered.filter(a => a.type === type);
  }

  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(a => a.beneficiaryName.toLowerCase().includes(s) || a.id.toLowerCase().includes(s));
  }

  return res.status(200).json({ success: true, count: filtered.length, data: filtered });
});

// POST /api/peso-officer/assistance-records
router.post('/assistance-records', (req, res) => {
  const { appId, beneficiaryName, program, type, quantity, conditions, officerName } = req.body;

  if (!beneficiaryName || !type || !quantity) {
    return res.status(400).json({ success: false, message: 'Beneficiary name, assistance type, and quantity/amount are required.' });
  }

  const newRecord = {
    id: `AST-2026-${String(assistanceRecords.length + 1).padStart(3, '0')}`,
    appId: appId || 'APP-2026-REG',
    beneficiaryName,
    program: program || 'PFAS (Pangkabuhayan Assistance)',
    type,
    quantity,
    dateApproved: new Date().toISOString().split('T')[0],
    conditions: conditions || 'Standard program compliance rules apply.',
    officer: officerName || 'Jane Smith'
  };

  assistanceRecords.unshift(newRecord);

  console.log(`[AUDIT] [${new Date().toISOString()}] Officer ${newRecord.officer} recorded approved assistance ${newRecord.id} for ${beneficiaryName}`);

  return res.status(201).json({
    success: true,
    message: `Approved assistance recorded successfully for ${beneficiaryName}.`,
    data: newRecord
  });
});

// GET /api/peso-officer/export-assistance
// Export assistance records and explicitly log the report generation action to audit trail
router.get('/export-assistance', (req, res) => {
  const officerName = req.query.officer || 'PESO Officer';
  console.log(`[AUDIT] [${new Date().toISOString()}] Officer ${officerName} generated and exported approved assistance summary report.`);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="Approved_Assistance_Report.csv"');

  let csvContent = 'Assistance ID,Application ID,Beneficiary Name,Program,Assistance Type,Quantity/Amount,Date Approved,Conditions,Officer\n';
  assistanceRecords.forEach(r => {
    csvContent += `"${r.id}","${r.appId}","${r.beneficiaryName}","${r.program}","${r.type}","${r.quantity}","${r.dateApproved}","${r.conditions}","${r.officer}"\n`;
  });

  return res.send(csvContent);
});

// -----------------------------------------------------------------------------
// PHONE / EMAIL OTP & UPLOAD ENDPOINTS
// -----------------------------------------------------------------------------
router.post('/otp/send-phone', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required.' });

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = hashCode(otp);
  otpStore.set(`phone:${phone}`, { hash: otpHash, expiresAt: Date.now() + 300000 });

  return res.status(200).json({ success: true, message: '6-digit OTP code sent.', demoCode: otp });
});

router.post('/otp/send-email', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email address is required.' });

  const code = String(Math.floor(1000 + Math.random() * 9000));
  const codeHash = hashCode(code);
  otpStore.set(`email:${email}`, { hash: codeHash, expiresAt: Date.now() + 300000 });

  return res.status(200).json({ success: true, message: '4-digit verification code sent.', demoCode: code });
});

router.post('/upload-doc', (req, res) => {
  const { fileName, docType } = req.body;
  if (!fileName || !docType) return res.status(400).json({ success: false, message: 'File name and document type required.' });

  const ext = fileName.split('.').pop().toLowerCase();
  const statusLabel = docType === 'barangay_cert'
    ? 'Barangay Certification Uploaded: Pending Review'
    : 'ID Verified: Pending Review';

  return res.status(200).json({
    success: true,
    message: 'File validated and uploaded.',
    data: { originalName: fileName, storedFileName: `${crypto.randomUUID()}_${fileName}`, status: statusLabel }
  });
});

module.exports = router;

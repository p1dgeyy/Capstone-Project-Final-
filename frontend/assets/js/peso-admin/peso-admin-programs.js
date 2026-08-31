// Canonical 14 PESO Programs Roster (Appropriation Ordinance No. 6, Series of 2025 Approved Budget)
const CANONICAL_PESO_PROGRAM_CATALOG = [
    {
        id: 1,
        code: 'AICS',
        name: 'Assistance to Individuals in Crisis Situation (AICS)',
        category: 'Special Programs',
        budget: 1377882.00,
        slots_target: 0,
        slots_filled: 0,
        min_age: 18,
        max_age: 65,
        target_beneficiaries: 'Individuals & families in crisis, low-income heads of households, marginalized citizens',
        assistance_type: 'Financial / Material Emergency Grant (₱2,000 - ₱5,000)',
        description: 'Financial or material emergency assistance to individuals and families in crisis. Provides emergency financial aid for livelihood continuity, transportation, and immediate subsistence needs to vulnerable residents facing acute hardship.',
        eligibility_criteria: [
            'Bona fide resident of the City of Koronadal with verified barangay indigency.',
            'Currently experiencing sudden crisis (loss of livelihood breadwinner, disaster displacement, emergency hardship).',
            'Classified under low-income or marginalized bracket based on social intake assessment.',
            'No duplicate financial grant received for the same emergency incident within the cycle.'
        ],
        required_documents: [
            'Valid Government-Issued Identification Card (with 3 specimen signatures)',
            'Barangay Certificate of Indigency / Certificate of Residency',
            'Incident / Livelihood Disruption Verification Document',
            'Social Case Intake Assessment Endorsement from PESO Desk'
        ],
        timeline: {
            intake: 'Year-Round Daily Intake (Mon-Fri 8:00 AM - 5:00 PM)',
            cycle: '1 - 3 Working Days Evaluation & Scheduled Disbursement'
        },
        ordinance: 'Appropriation Ordinance No. 6, Series of 2025 (MOOE Allocation)',
        status: 'Active'
    },
    {
        id: 2,
        code: 'CKGIP',
        name: 'City of Koronadal Government Internship Program (CKGIP)',
        category: 'Employment Facilitation',
        budget: 500000.00,
        slots_target: 0,
        slots_filled: 0,
        min_age: 18,
        max_age: 30,
        target_beneficiaries: 'Fresh college & vocational graduates, tech-voc completers, and unemployed youth',
        assistance_type: '6-Month Paid Local Government Internship Grant (Monthly Allowance)',
        description: 'Internship placements in city government offices for youth skill development. Equips fresh graduates and out-of-school youth with practical public sector work experience, workplace mentorship, and monthly allowance.',
        eligibility_criteria: [
            'Bona fide resident of Koronadal City aged 18 to 30 years old.',
            'College graduate, senior high graduate, or accredited Tech-Voc completer.',
            'Currently unemployed with no prior government internship completion record.',
            'Committed to completing the 6-month continuous public service placement.'
        ],
        required_documents: [
            'Valid Government / Student Identification Card',
            'Barangay Clearance / Certificate of Residency',
            'College Diploma or Official Transcript of Records (TOR)',
            'Updated Resume / Curriculum Vitae with 2x2 Photo',
            'Certificate of Indigency or Low Family Income Verification'
        ],
        timeline: {
            intake: 'January 15 - February 20, 2026 (Intake Batch 1)',
            cycle: '6 Months Continuous Placement (March 1 - August 31, 2026)'
        },
        ordinance: 'Appropriation Ordinance No. 6, Series of 2025 (Regular Services Item II-A)',
        status: 'Active'
    },
    {
        id: 3,
        code: 'KEEP',
        name: 'Koronadal Emergency Employment Program (KEEP)',
        category: 'Employment Facilitation',
        budget: 1500000.00,
        slots_target: 0,
        slots_filled: 0,
        min_age: 18,
        max_age: 65,
        target_beneficiaries: 'Displaced local workers, underemployed informal laborers, calamity-affected breadwinners',
        assistance_type: '15 to 30-Day Emergency Wage Employment + GSIS/Accident Micro-Insurance',
        description: 'Short‑term employment for displaced or disadvantaged workers. Provides immediate temporary wage employment in community infrastructure maintenance, environmental cleanup, and local government support services.',
        eligibility_criteria: [
            'Bona fide resident of Koronadal City aged 18 to 65 years old.',
            'Displaced worker due to enterprise closure, retrenchment, or severe weather disruption.',
            'Informal sector worker with irregular or zero seasonal income.',
            'Physically fit for community civil works and sanitation activities.'
        ],
        required_documents: [
            'Valid Government-issued ID',
            'Barangay Certificate of Indigency & Residency',
            'Certificate of Displacement / Company Layoff Notice or Affidavit of Unemployment',
            '1x1 ID Pictures on white background (2 copies)'
        ],
        timeline: {
            intake: 'Quarterly Intake Windows (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec)',
            cycle: '15 to 30 Working Days per Deployed Batch'
        },
        ordinance: 'Appropriation Ordinance No. 6, Series of 2025 (Regular Services Item II-B)',
        status: 'Active'
    },
    {
        id: 4,
        code: 'TUPAD',
        name: 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers',
        category: 'Employment Facilitation',
        budget: 40000.00,
        slots_target: 0,
        slots_filled: 0,
        min_age: 18,
        max_age: 65,
        target_beneficiaries: 'Displaced, underemployed, and seasonal informal sector workers',
        assistance_type: 'Emergency Employment Stipend (10-15 Days) + Personal Protective Equipment (PPE)',
        description: 'Emergency employment program for displaced, underemployed, and seasonal workers. Community-based livelihood safety net delivered in partnership with DOLE for disadvantaged informal sector workers.',
        eligibility_criteria: [
            'Displaced or seasonal informal economy worker residing in Koronadal City aged 18-65.',
            'Not currently an active beneficiary of another cash-for-work government subsidy.',
            'Only one qualified worker per vulnerable household allowed per cycle.'
        ],
        required_documents: [
            'Photocopy of Valid Government-Issued ID',
            'Barangay Certificate of Indigency',
            'Duly Accomplished DOLE TUPAD Profile Form',
            '1x1 Photo on White Background'
        ],
        timeline: {
            intake: 'BY 2026 Scheduled Community Batch Windows',
            cycle: '10 to 15 Calendar Days Community Deployment'
        },
        ordinance: 'Appropriation Ordinance No. 6, Series of 2025 (Regular Services Item II-C)',
        status: 'Active'
    },
    {
        id: 5,
        code: 'PFAS',
        name: 'Pangkabuhayan Financial Assistance (PFAS)',
        category: 'Livelihood Programs',
        budget: 7000000.00,
        slots_target: 0,
        slots_filled: 0,
        min_age: 18,
        max_age: 65,
        target_beneficiaries: 'Individual micro-entrepreneurs, street vendors, home-based producers, skilled tradespersons',
        assistance_type: 'Seed Capital Grant (₱5,000 - ₱20,000) & Entrepreneurial Coaching',
        description: 'Financial support to start or expand livelihood projects. Provides micro-enterprise seed capital, toolkits, and financial literacy coaching to empower low-income entrepreneurs to build sustainable businesses.',
        eligibility_criteria: [
            'Resident of the City of Koronadal for at least 6 consecutive months.',
            'Operating an existing micro-enterprise or possessing a feasible business project proposal.',
            'Household income falling below regional poverty threshold.',
            'Completion of mandatory Entrepreneurial Mindset & Financial Literacy Seminar.'
        ],
        required_documents: [
            'Valid Government-Issued ID',
            'Barangay Business Clearance / Certificate of Indigency',
            'Simple Business Proposal / Costing & Expenditure Plan',
            'Photos of existing livelihood or trading stall (if applicable)',
            'DTI or Mayor’s Business Permit (if registered)'
        ],
        timeline: {
            intake: 'Rolling Monthly Intake (January - October 2026)',
            cycle: 'Monthly Batch Evaluation, 25th Day Grant Releasing, 12-Month Monitoring'
        },
        ordinance: 'Appropriation Ordinance No. 6, Series of 2025 (PPAs Item III-A)',
        status: 'Active'
    },
    {
        id: 6,
        code: 'DILP',
        name: 'Support to DOLE Integrated Livelihood Program (DILP)',
        category: 'Livelihood Programs',
        budget: 500000.00,
        slots_target: 0,
        slots_filled: 0,
        min_age: 18,
        max_age: 65,
        target_beneficiaries: 'Organized community livelihood associations, worker cooperatives, vulnerable groups',
        assistance_type: 'Group Livelihood Equipment, Shared Facilities & Raw Materials Package',
        description: 'Micro‑enterprise support through tools, equipment, and training. Group and individual livelihood assistance providing production machinery, raw materials, and enterprise capacity building.',
        eligibility_criteria: [
            'DOLE-registered Workers Association, CDA Cooperative, or SEC Non-Profit in Koronadal.',
            'Minimum of 15 active participating members in good standing.',
            'Established bookkeeping system and active bank / cooperative account.',
            'Viable enterprise proposal aligned with priority local commodity sectors.'
        ],
        required_documents: [
            'Certificate of Registration (DOLE, CDA, or SEC)',
            'Association Constitution and By-Laws',
            'Certified Masterlist of Officers & Members with Valid IDs',
            'Detailed Group Project Proposal with Board Resolution',
            'Financial Statements for preceding operating year (if existing)'
        ],
        timeline: {
            intake: 'Call for Proposals: January - March 2026',
            cycle: 'Technical Review (Apr-May), Equipment Handover (Jun-Aug 2026)'
        },
        ordinance: 'Appropriation Ordinance No. 6, Series of 2025 (PPAs Item III-B)',
        status: 'Active'
    },
    {
        id: 7,
        code: 'ASSOC-FACIL',
        name: 'Association Facilitation & Registration',
        category: 'Livelihood Programs',
        budget: 50000.00,
        slots_target: 0,
        slots_filled: 0,
        min_age: 18,
        max_age: 65,
        target_beneficiaries: 'Informal workers, community craftspeople, market vendor groups, transport operators',
        assistance_type: 'Legal Registration Assistance, Governance Training & Technical Facilitation',
        description: 'Assistance in forming and registering community livelihood associations. Provides free legal structuring, drafting of by-laws, DOLE registration assistance, and governance workshops for informal sector groups.',
        eligibility_criteria: [
            'Group of at least 10 individuals residing in the same barangay of Koronadal City.',
            'Common trade, livelihood project, or community economic endeavor.',
            'Commitment of all elected officers to attend mandatory capacity-building modules.'
        ],
        required_documents: [
            'Minutes of the Organizational Meeting',
            'Attendance Sheet and Roster of Founding Members',
            'Draft Constitution & By-Laws (PESO template available)',
            'Barangay Endorsement Letter'
        ],
        timeline: {
            intake: 'Year-Round Facilitation (Clinics every 2nd & 4th Wednesday)',
            cycle: '10 Working Days Document Verification & DOLE Endorsement'
        },
        ordinance: 'Appropriation Ordinance No. 6, Series of 2025 (PPAs Item III-C)',
        status: 'Active'
    },
    {
        id: 8,
        code: 'JOB-FAIRS',
        name: 'Conduct of Job Fairs & Career Expos',
        category: 'Employment Facilitation',
        budget: 100000.00,
        slots_target: 0,
        slots_filled: 0,
        min_age: 18,
        max_age: 65,
        target_beneficiaries: 'Fresh graduates, displaced workers, licensed professionals, skilled tradespersons, jobseekers',
        assistance_type: 'Free On-Site Interview Matchmaking, Direct Hiring, Career Guidance Booths',
        description: 'Organized events connecting job seekers with employers. Citywide employment matchmaking summits hosting top local companies, overseas recruitment agencies, and government licensing desks.',
        eligibility_criteria: [
            'Open to all jobseekers residing in Koronadal City and Region XII.',
            'At least 18 years of age with legal capacity for employment.',
            'Registered in the National Skills Registration Program (NSRP) / PESO Database.'
        ],
        required_documents: [
            'Multiple hard copies of updated Resume / Bio-Data',
            'Valid Government-Issued ID',
            '2x2 ID Photos (formal business attire)',
            'Photocopies of Diploma, Transcript, or NC II Certificate (if applicable)',
            'NBI or Police Clearance (recommended for on-the-spot hiring)'
        ],
        timeline: {
            intake: 'Mega Job Fair (January), Labor Day Fair (May 1), PESO Week (September)',
            cycle: 'One-Day Intensive Matchmaking per Fair + 30-Day Hiring Follow-up'
        },
        ordinance: 'Appropriation Ordinance No. 6, Series of 2025 (PPAs Item III-D)',
        status: 'Active'
    },
    {
        id: 9,
        code: 'JOB-PORTAL',
        name: 'Development of Localized Job Portal',
        category: 'Employment Facilitation',
        budget: 150000.00,
        slots_target: 0,
        slots_filled: 0,
        min_age: 18,
        max_age: 65,
        target_beneficiaries: 'Active jobseekers, tech-voc completers, accredited Koronadal employers and enterprises',
        assistance_type: '24/7 Digital Job Board, Resume Generator, Automated Skill Matching',
        description: 'Online platform for job postings and applications. High-speed digital labor exchange platform connecting Koronadal employers and jobseekers with instant QR verification and SMS interview alerts.',
        eligibility_criteria: [
            'Jobseekers: Resident of Koronadal City, aged 18+.',
            'Employers: Registered enterprise with valid Koronadal Mayor’s Business Permit.'
        ],
        required_documents: [
            'Digital User Profile & Valid ID verification',
            'Digital Resume / CV upload (PDF/Word)',
            'Business Permit & SEC/DTI certificate (for employer accounts)'
        ],
        timeline: {
            intake: '24/7 Online Registration & Automated Resume Screening',
            cycle: 'Continuous Real-Time Matching & Employer Applicant Routing'
        },
        ordinance: 'Appropriation Ordinance No. 6, Series of 2025 (PPAs Item III-E)',
        status: 'Active'
    },
    {
        id: 10,
        code: 'SKILLS-TRAIN',
        name: 'Livelihood/Skills Training Program',
        category: 'Special Programs',
        budget: 150000.00,
        slots_target: 0,
        slots_filled: 0,
        min_age: 18,
        max_age: 60,
        target_beneficiaries: 'Out-of-school youth, unemployed adults, solo parents, PWDs, displaced workers',
        assistance_type: 'Free Modular Skills Training, Consumable Toolkits, and Certificate of Completion',
        description: 'Training sessions to enhance employability and entrepreneurship. Hands-on vocational courses (culinary, welding, electrical, dressmaking, digital skills) delivered with TESDA-accredited trainers.',
        eligibility_criteria: [
            'Resident of the City of Koronadal aged 18 to 60 years old.',
            'Able to read, write, and comprehend basic technical instruction.',
            'Committed to attend minimum 90% of scheduled training hours.',
            'Willingness to undertake TESDA National Competency (NC) assessment.'
        ],
        required_documents: [
            'Valid Government ID or Barangay ID',
            'Barangay Certificate of Residency & Indigency',
            '2x2 ID Photos on white background (3 copies)',
            'Form 137 / High School Diploma (for technical courses)'
        ],
        timeline: {
            intake: 'Cohort 1 (Mar-Apr 2026), Cohort 2 (Jun-Jul 2026), Cohort 3 (Aug-Sep 2026)',
            cycle: '80 - 120 Hours Intensive Vocational Modules + NC II Assessment'
        },
        ordinance: 'Appropriation Ordinance No. 6, Series of 2025 (PPAs Item III-F)',
        status: 'Active'
    },
    {
        id: 11,
        code: 'OFW-FCD',
        name: 'OFW Family Circle Day & Welfare Summit',
        category: 'Special Programs',
        budget: 200000.00,
        slots_target: 0,
        slots_filled: 0,
        min_age: 18,
        max_age: 70,
        target_beneficiaries: 'Active OFWs, vacationing OFWs, returning OFWs, and direct dependents (spouse, parents, children)',
        assistance_type: 'Financial Wellness Seminars, Family Wellness Counseling, Reintegration Grants Matching',
        description: 'Community event supporting OFWs and their families. Annual fellowship and empowerment conference providing financial education, reintegration opportunities, and psychosocial support to migrant families.',
        eligibility_criteria: [
            'Active or former OFW with valid OWWA/POEA registration or immediate family member.',
            'Resident of Koronadal City.',
            'Registered in the PESO OFW Help Desk Registry.'
        ],
        required_documents: [
            'Passport copy / OFW Info Sheet or OEC certificate',
            'Proof of Kinship (PSA Marriage Certificate or Birth Certificate for dependents)',
            'Barangay Certificate of Residency'
        ],
        timeline: {
            intake: 'Pre-Registration Window: May 1 - May 31, 2026',
            cycle: 'Annual Summit in June (Migrant Workers Month) + Follow-up Clinics'
        },
        ordinance: 'Appropriation Ordinance No. 6, Series of 2025 (PPAs Item III-G)',
        status: 'Active'
    },
    {
        id: 12,
        code: 'SPES',
        name: 'Special Program for Employment of Students (SPES)',
        category: 'Special Programs',
        budget: 2000000.00,
        slots_target: 0,
        slots_filled: 0,
        min_age: 15,
        max_age: 30,
        target_beneficiaries: 'Poor but deserving high school, senior high, and college students, and Out-of-School Youth (OSY)',
        assistance_type: 'Salary Stipend (60% LGU, 40% DOLE) for 20-30 Days + GSIS Insurance',
        description: 'Short‑term employment for poor but deserving students during school breaks. Provides youth with temporary summer/holiday employment in government and partner institutions to earn income for schooling.',
        eligibility_criteria: [
            'Students or Out-of-School Youth aged 15 to 30 years old.',
            'Enrolled in high school, tech-voc, or college, or intending to re-enroll in the next term.',
            'Passing grades in all subjects with no failing marks in the preceding academic year.',
            'Combined parent/guardian annual net income must not exceed poverty threshold (₱150,000/year).'
        ],
        required_documents: [
            'Birth Certificate (PSA or Local Civil Registrar certified)',
            'School Registration Form / Assessment Slip / Certificate of Enrollment',
            'Certified True Copy of Grades / Form 138 / Official Transcript',
            'Parents’ Income Tax Return (ITR), BIR Tax Exemption, or Barangay Certificate of Low Income',
            'SPES Application Form (DOLE Form 01)'
        ],
        timeline: {
            intake: 'Application Window: February 1 - March 15, 2026',
            cycle: 'Screening (Mar 20-25), Deployment Period: April 15 - May 25, 2026 (Summer Break)'
        },
        ordinance: 'Appropriation Ordinance No. 6, Series of 2025 (PPAs Item III-H)',
        status: 'Active'
    },
    {
        id: 13,
        code: 'PAROKYA-OWWA',
        name: 'Support to Parokya ni OWWA Program',
        category: 'Special Programs',
        budget: 40000.00,
        slots_target: 0,
        slots_filled: 0,
        min_age: 18,
        max_age: 65,
        target_beneficiaries: 'Distressed OFWs, migrant returnees, families of OFWs in crisis',
        assistance_type: 'Grassroots Welfare Outreach, Legal Consultation, Emergency Family Counseling',
        description: 'Outreach and support activities for OFWs and their families. Grassroots outreach initiative bringing OWWA welfare services, legal advisories, and emergency assistance directly to parish and barangay communities.',
        eligibility_criteria: [
            'OFWs or OFW family members residing in Koronadal City.',
            'Experiencing welfare, contract, repatriation, or emergency medical concerns overseas.'
        ],
        required_documents: [
            'OFW Passport Copy / OWWA Membership ID',
            'Overseas Employment Contract or Travel Document',
            'Barangay Certificate of Indigency / Endorsement'
        ],
        timeline: {
            intake: 'Bi-Monthly Grassroots Community Clinics across Clustered Barangays',
            cycle: 'Continuous Help Desk Support at PESO Main Center'
        },
        ordinance: 'Appropriation Ordinance No. 6, Series of 2025 (PPAs Item III-I)',
        status: 'Active'
    },
    {
        id: 14,
        code: 'ROFWS',
        name: 'Support to Returning OFWs Program (ROFW’S)',
        category: 'Special Programs',
        budget: 100000.00,
        slots_target: 0,
        slots_filled: 0,
        min_age: 18,
        max_age: 65,
        target_beneficiaries: 'Permanently returned, repatriated, or distressed Overseas Filipino Workers',
        assistance_type: 'Reintegration Seed Grants, Business Mentoring, Local Job Placement Referrals',
        description: 'Reintegration support for returning OFWs through livelihood and employment facilitation. Empowers displaced and repatriated migrant workers to successfully transition back into local economic enterprise.',
        eligibility_criteria: [
            'Repatriated or permanently returned OFW residing in Koronadal City within the past 3 years.',
            'Committed to establish local livelihood enterprise or seek domestic employment.',
            'Completion of PESO Reintegration Orientation Workshop.'
        ],
        required_documents: [
            'Valid Philippine Passport with arrival stamp or Travel Document',
            'Repatriation Certificate or OWWA Case Referral',
            'Barangay Certificate of Residency',
            'Proposed Livelihood Project Plan'
        ],
        timeline: {
            intake: 'Continuous Rolling Intake throughout 2026',
            cycle: 'Monthly Reintegration Clinics (Last Friday) & Fast-Track Referral'
        },
        ordinance: 'Appropriation Ordinance No. 6, Series of 2025 (PPAs Item III-J)',
        status: 'Active'
    }
];

let programsList = JSON.parse(JSON.stringify(CANONICAL_PESO_PROGRAM_CATALOG));
let archiveList = [];
const PROGRAM_BATCHES = {};
const BATCH_BENEFICIARIES = {};

async function initProgramsData() {
    if (typeof DataService !== 'undefined' && DataService.programs) {
        try {
            const [progRes, appRes] = await Promise.all([
                DataService.programs.getAll({ agency: 'PESO' }),
                DataService.applications.getAll({ agency: 'PESO' })
            ]);

            const appCountByProg = {};
            if (appRes && appRes.data && Array.isArray(appRes.data)) {
                appRes.data.forEach(a => {
                    const pid = a.program_id;
                    const pcode = a.program_code;
                    if (pid) appCountByProg[pid] = (appCountByProg[pid] || 0) + 1;
                    if (pcode) appCountByProg[pcode] = (appCountByProg[pcode] || 0) + 1;
                });
            }

            if (progRes && progRes.data && Array.isArray(progRes.data) && progRes.data.length > 0) {
                // Merge Supabase programs with canonical metadata
                programsList = progRes.data.map(p => {
                    const canonical = CANONICAL_PESO_PROGRAM_CATALOG.find(c => c.code === p.code || c.name === p.name) || {};
                    const totalSlots = Number(p.slots_target || p.total_slots || canonical.slots_target || 100);
                    const filledSlots = appCountByProg[p.id] || appCountByProg[p.code] || Number(p.slots_filled || canonical.slots_filled || 0);

                    return {
                        id: p.id,
                        code: p.code || canonical.code || 'PROG',
                        name: p.name || canonical.name || 'Program Title',
                        category: p.category || canonical.category || 'Livelihood Programs',
                        budget: Number(p.budget || canonical.budget || 0),
                        beneficiaries_count: filledSlots,
                        slots_target: totalSlots,
                        slots_filled: filledSlots,
                        min_age: p.min_age || canonical.min_age || 18,
                        max_age: p.max_age || canonical.max_age || 65,
                        target_beneficiaries: p.target_beneficiaries || canonical.target_beneficiaries || 'Beneficiaries & Jobseekers',
                        assistance_type: p.assistance_type || canonical.assistance_type || 'Assistance Grant',
                        description: p.description || canonical.description || '',
                        eligibility_criteria: p.eligibility_criteria || canonical.eligibility_criteria || ['Resident of Koronadal City'],
                        required_documents: p.required_documents || canonical.required_documents || ['Valid Government ID', 'Barangay Indigency'],
                        timeline: p.timeline || canonical.timeline || { intake: 'Budget Year 2026 Active Intake', cycle: 'Quarterly Scheduled Batches' },
                        ordinance: p.ordinance || canonical.ordinance || 'Appropriation Ordinance No. 6, Series of 2025',
                        status: p.status || 'Active'
                    };
                });
                renderDashboardTables();
                return;
            }
        } catch (e) {
            console.warn('[PROGRAMS] Supabase fetch notice:', e);
        }
    }
    programsList = JSON.parse(JSON.stringify(CANONICAL_PESO_PROGRAM_CATALOG));
    renderDashboardTables();
}

function filterPrograms() {
    const searchInput = document.getElementById('searchInput');
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    const catSelect = document.getElementById('categoryFilter');
    const cat = catSelect ? catSelect.value : 'ALL';
    const statusSelect = document.getElementById('statusFilter');
    const status = statusSelect ? statusSelect.value : 'ALL';
    const tbody = document.getElementById('programsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = programsList.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search) || p.code.toLowerCase().includes(search);
        const matchesCat = (cat === 'ALL') || (p.category === cat);
        const matchesStatus = (status === 'ALL') || (status === 'Active' && p.status === 'Active') || (status === 'Inactive' && p.status !== 'Active');
        return matchesSearch && matchesCat && matchesStatus;
    });

    filtered.forEach(prog => {
        const tr = document.createElement('tr');
        const isDeactivated = prog.status !== 'Active';
        tr.innerHTML = `
            <td><div class="fw-bold text-dark">${escapeHtml(prog.name)}</div><span class="badge bg-dark-subtle text-dark font-monospace">${escapeHtml(prog.code)}</span></td>
            <td><span class="badge badge-category badge-emp">${escapeHtml(prog.category)}</span><div class="small text-muted mt-1">${escapeHtml(prog.assistance_type || '')}</div></td>
            <td><div class="fw-bold text-success">₱${Number(prog.budget).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></td>
            <td><span class="badge bg-light text-dark border"><i class="bi bi-people-fill text-primary me-1"></i>${prog.beneficiaries_count || 0} enrolled</span></td>
            <td><div class="text-truncate" style="max-width: 200px;">${escapeHtml(prog.limitations || 'None')}</div></td>
            <td><small class="fw-semibold text-secondary">${escapeHtml(prog.ordinance || 'Ordinance No. 6')}</small></td>
            <td class="text-center">
                <div class="form-check form-switch d-inline-block">
                    <input class="form-check-input" type="checkbox" role="switch" ${!isDeactivated ? 'checked' : ''} onchange="handleProgramToggle(event, ${prog.id})" aria-label="Toggle Status">
                </div>
            </td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-info me-1" onclick="openProgramDetailsViewModal(${prog.id})">
                    <i class="bi bi-eye-fill"></i> Details
                </button>
                <button class="btn btn-sm btn-outline-warning" onclick="openProgramEditModal(${prog.id})">
                    <i class="bi bi-pencil-square"></i> Edit
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No programs found matching filters.</td></tr>';
    }
}

// Helper to format system date & time
function formatSystemDateTime(date = new Date()) {
    const d = (date instanceof Date && !isNaN(date)) ? date : new Date(date);
    if (isNaN(d.getTime())) {
        return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
    }
    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

/**
 * Currency Formatting & Auto-masking Engine (en-PH Standard, Intl.NumberFormat)
 * Enforces thousands separator (comma every 3 digits), 2 fixed decimal places, and min ₱0.01
 */
function formatPHP(amount) {
    const num = typeof amount === 'number' ? amount : parseCurrencyToNumber(amount);
    return '₱' + new Intl.NumberFormat('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

function parseCurrencyToNumber(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const clean = String(val).replace(/[^\d.]/g, '').trim();
    if (!clean) return 0;
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

function formatRawCurrencyString(rawStr, enforceTwoDecimals = false) {
    if (rawStr === null || rawStr === undefined || rawStr === '') return '';
    let str = String(rawStr).replace(/[^\d.]/g, '');
    if (!str) return '';

    // Handle multiple decimal points (keep only first)
    const parts = str.split('.');
    let integerPart = parts[0] || '0';
    if (integerPart.length > 1 && integerPart.startsWith('0')) {
        integerPart = integerPart.replace(/^0+/, '') || '0';
    }

    // Format integer part with Philippine comma thousand separators
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    if (parts.length > 1) {
        let decimalPart = parts[1].substring(0, 2);
        if (enforceTwoDecimals) {
            while (decimalPart.length < 2) {
                decimalPart += '0';
            }
        }
        return `${formattedInteger}.${decimalPart}`;
    } else if (enforceTwoDecimals) {
        return `${formattedInteger}.00`;
    }

    return formattedInteger;
}

function attachCurrencyInputAutoFormat(inputEl) {
    if (!inputEl || inputEl.dataset.currencyAttached === 'true') return;
    inputEl.dataset.currencyAttached = 'true';

    inputEl.setAttribute('type', 'text');
    inputEl.setAttribute('inputmode', 'decimal');
    inputEl.setAttribute('autocomplete', 'off');

    // Keydown: block non-numeric characters (allow navigation, backspace, delete, tab, and single period)
    inputEl.addEventListener('keydown', function(e) {
        const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
        if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
            return;
        }

        // Allow single decimal point
        if (e.key === '.' || e.key === 'Decimal') {
            if (this.value.includes('.')) {
                e.preventDefault();
            }
            return;
        }

        // Only allow 0-9
        if (!/^[0-9]$/.test(e.key)) {
            e.preventDefault();
        }
    });

    // Input: format digits with thousands separators dynamically while typing
    inputEl.addEventListener('input', function() {
        const cursorPos = this.selectionStart;
        const originalLen = this.value.length;
        const raw = this.value;

        const endsWithDot = raw.endsWith('.');
        let formatted = formatRawCurrencyString(raw, false);
        if (endsWithDot && !formatted.includes('.')) {
            formatted += '.';
        }

        this.value = formatted;

        // Maintain cursor position smartly
        const diff = this.value.length - originalLen;
        const newCursorPos = Math.max(0, cursorPos + diff);
        this.setSelectionRange(newCursorPos, newCursorPos);

        const num = parseCurrencyToNumber(this.value);
        if (num >= 0.01) {
            this.classList.remove('is-invalid');
        }
    });

    // Blur: Enforce fixed 2 decimal precision (.00 auto-add)
    inputEl.addEventListener('blur', function() {
        const val = this.value.trim();
        if (val) {
            const num = parseCurrencyToNumber(val);
            if (num > 0) {
                this.value = formatRawCurrencyString(val, true);
                this.classList.remove('is-invalid');
            } else {
                this.value = '0.00';
            }
        }
    });

    // Paste: strip invalid characters and format cleanly
    inputEl.addEventListener('paste', function(e) {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const num = parseCurrencyToNumber(text);
        if (num > 0) {
            this.value = formatRawCurrencyString(num.toFixed(2), true);
            this.dispatchEvent(new Event('input'));
        }
    });
}

function initAllCurrencyInputs() {
    document.querySelectorAll('.currency-input').forEach(attachCurrencyInputAutoFormat);
    const newBudget = document.getElementById('newProgBudget');
    if (newBudget) attachCurrencyInputAutoFormat(newBudget);
    const editBudget = document.getElementById('editProgBudget');
    if (editBudget) attachCurrencyInputAutoFormat(editBudget);
    const fundBudget = document.getElementById('fundAllocNewBudget');
    if (fundBudget) attachCurrencyInputAutoFormat(fundBudget);
}

// Attach on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllCurrencyInputs);
} else {
    initAllCurrencyInputs();
}

// --- CREATE NEW PROGRAM MODAL & HANDLER (RBAC: ADMIN ONLY) ---
function openCreateProgramModal() {
    const form = document.getElementById('createProgramForm');
    if (form) {
        form.reset();
        form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    }

    const budgetEl = document.getElementById('newProgBudget');
    if (budgetEl) {
        attachCurrencyInputAutoFormat(budgetEl);
        budgetEl.value = '';
    }

    const dtInput = document.getElementById('newProgCreatedDateTime') || document.getElementById('newProgDateTime');
    if (dtInput) {
        dtInput.value = formatSystemDateTime(new Date());
    }

    const categorySelect = document.getElementById('newProgCategory');
    if (categorySelect) {
        categorySelect.value = '';
    }

    const slotsInput = document.getElementById('newProgSlots');
    if (slotsInput) slotsInput.value = '100';

    const minAgeInput = document.getElementById('newProgMinAge');
    if (minAgeInput) minAgeInput.value = '18';

    const maxAgeInput = document.getElementById('newProgMaxAge');
    if (maxAgeInput) maxAgeInput.value = '65';

    const intakeInput = document.getElementById('newProgIntake');
    if (intakeInput) intakeInput.value = 'Budget Year 2026 Active Intake (Rolling Admissions)';

    const cycleInput = document.getElementById('newProgCycle');
    if (cycleInput) cycleInput.value = 'Quarterly Cohorts & Continuous Placement';

    logAuditEvent('OPEN_CREATE_PROGRAM_FORM', 'Admin opened Create New Livelihood Program form');
    safeOpenModal('createProgramModal');
}

async function handleCreateProgramSubmit(e) {
    e.preventDefault();
    const form = document.getElementById('createProgramForm') || e.target;
    if (form) {
        form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    }

    const nameEl = document.getElementById('newProgName');
    const codeEl = document.getElementById('newProgCode');
    const categoryEl = document.getElementById('newProgCategory');
    const targetEl = document.getElementById('newProgTarget');
    const assistanceEl = document.getElementById('newProgAssistance');
    const descEl = document.getElementById('newProgDesc');
    const slotsEl = document.getElementById('newProgSlots');
    const minAgeEl = document.getElementById('newProgMinAge');
    const maxAgeEl = document.getElementById('newProgMaxAge');
    const budgetEl = document.getElementById('newProgBudget');
    const intakeEl = document.getElementById('newProgIntake');
    const cycleEl = document.getElementById('newProgCycle');
    const eligEl = document.getElementById('newProgEligibility');
    const reqDocsEl = document.getElementById('newProgRequiredDocs');

    let isValid = true;
    function setInvalid(element, msg) {
        if (!element) return;
        element.classList.add('is-invalid');
        const feedback = element.parentElement ? element.parentElement.querySelector('.invalid-feedback') : null;
        if (feedback && msg) feedback.textContent = msg;
        if (isValid) element.focus();
        isValid = false;
    }

    // 1. Program Name & Code
    const name = (nameEl?.value || '').trim();
    if (!name) {
        setInvalid(nameEl, 'Program Name is required.');
    }

    const code = (codeEl?.value || '').trim().toUpperCase();
    if (!code) {
        setInvalid(codeEl, 'Program Code is required.');
    } else if (programsList.some(p => p.code && p.code.toUpperCase() === code)) {
        setInvalid(codeEl, `Program Code "${code}" is already in use.`);
    }

    const category = (categoryEl?.value || '').trim();
    if (!category) {
        setInvalid(categoryEl, 'Category selection is required.');
    }

    // 1. Descriptions breakdown (Requirement 1: purpose, target beneficiaries, support offered)
    const target = (targetEl?.value || '').trim();
    if (!target) {
        setInvalid(targetEl, 'Target beneficiaries specification is required.');
    }

    const assistance = (assistanceEl?.value || '').trim();
    if (!assistance) {
        setInvalid(assistanceEl, 'Support offered / assistance scope description is required.');
    }

    const desc = (descEl?.value || '').trim();
    if (!desc) {
        setInvalid(descEl, 'Program Purpose & Objectives description is required.');
    }

    // 2. Program Slots (Requirement 2: capacity quota)
    const slots = parseInt(slotsEl?.value || '0', 10);
    if (isNaN(slots) || slots < 1) {
        setInvalid(slotsEl, 'Total slot capacity must be at least 1.');
    }

    // 3. Age Requirements (Requirement 3: min < max enforced)
    const minAge = parseInt(minAgeEl?.value || '0', 10);
    const maxAge = parseInt(maxAgeEl?.value || '0', 10);
    if (isNaN(minAge) || minAge < 15 || minAge > 99) {
        setInvalid(minAgeEl, 'Minimum age must be between 15 and 99.');
    }
    if (isNaN(maxAge) || maxAge < 16 || maxAge > 100) {
        setInvalid(maxAgeEl, 'Maximum age must be between 16 and 100.');
    }
    if (!isNaN(minAge) && !isNaN(maxAge) && minAge >= maxAge) {
        setInvalid(minAgeEl, 'Minimum age must be strictly less than maximum age.');
    }

    // 4. Budget Transparency (Requirement 4: en-PH currency >= 0.01)
    const budgetVal = parseCurrencyToNumber(budgetEl?.value);
    if (!budgetEl?.value.trim() || isNaN(budgetVal) || budgetVal < 0.01) {
        setInvalid(budgetEl, 'Budget must be a valid positive amount (minimum ₱0.01).');
    } else if (budgetEl) {
        budgetEl.value = formatRawCurrencyString(budgetVal, true);
    }

    // 5. Timeline, Eligibility & Required Documents (Requirements 5, 6, 7)
    const intake = (intakeEl?.value || '').trim();
    if (!intake) {
        setInvalid(intakeEl, 'Intake and application window schedule is required.');
    }

    const cycle = (cycleEl?.value || '').trim();
    if (!cycle) {
        setInvalid(cycleEl, 'Implementation cycle duration is required.');
    }

    const eligRaw = (eligEl?.value || '').trim();
    if (!eligRaw) {
        setInvalid(eligEl, 'Eligibility criteria qualification rules are required.');
    }

    const reqDocsRaw = (reqDocsEl?.value || '').trim();
    if (!reqDocsRaw) {
        setInvalid(reqDocsEl, 'Required application documents list is required.');
    }

    if (!isValid) {
        return;
    }

    const budget = budgetVal;
    const now = new Date();
    const formattedDt = formatSystemDateTime(now);
    let createdId = Date.now();

    const eligArray = eligRaw.split(/\r?\n|;/).map(s => s.trim()).filter(Boolean);
    const reqDocsArray = reqDocsRaw.split(/\r?\n|;/).map(s => s.trim()).filter(Boolean);

    const newProg = {
        id: createdId,
        code: code,
        name: name,
        category: category,
        budget: budget,
        beneficiaries_count: 0,
        slots_target: slots,
        slots_filled: 0,
        total_slots: slots,
        min_age: minAge,
        max_age: maxAge,
        target_beneficiaries: target,
        assistance_type: assistance,
        description: desc,
        eligibility_criteria: eligArray.length > 0 ? eligArray : [eligRaw],
        required_documents: reqDocsArray.length > 0 ? reqDocsArray : [reqDocsRaw],
        timeline: {
            intake: intake,
            cycle: cycle
        },
        ordinance: 'Appropriation Ordinance No. 6, Series of 2025',
        status: 'Active',
        created_at: now.toISOString()
    };

    if (typeof DataService !== 'undefined' && DataService.programs) {
        try {
            const res = await DataService.programs.create({
                code: code,
                name: name,
                category: category,
                agency: 'PESO',
                budget: budget,
                description: desc
            });
            if (res && res.data && res.data.id) {
                newProg.id = res.data.id;
            }
        } catch (err) {
            console.warn('[PROGRAMS] Supabase insert warning:', err);
        }
    }

    programsList.unshift(newProg);
    // Requirement 8: Audit trail with timestamp + admin identity
    logAuditEvent('CREATE_PROGRAM', `Created new program "${code}" (${name}) with budget ${formatPHP(budget)}, capacity: ${slots} slots, age req: ${minAge}-${maxAge} yrs on ${formattedDt}`);

    safeHideModal('createProgramModal');
    renderDashboardTables();

    window.showSystemNotification({
        title: 'Program Added',
        message: `Program "${code}" successfully created with ${slots} slots and ${formatPHP(budget)} budget on ${formattedDt}.`,
        type: 'success'
    });
}

// Safe Application and Batch matchers for Program Catalog
function matchesApplicationToProgram(a, p) {
    if (!a || !p) return false;
    if (a.program_id && (a.program_id === p.id || String(a.program_id) === String(p.id))) return true;
    if (a.program && typeof a.program === 'object') {
        if (a.program.id && (a.program.id === p.id || String(a.program.id) === String(p.id))) return true;
        if (a.program.code && p.code && String(a.program.code).trim().toUpperCase() === String(p.code).trim().toUpperCase()) return true;
        if (a.program.name && p.name && String(a.program.name).trim().toLowerCase() === String(p.name).trim().toLowerCase()) return true;
    }
    if (typeof a.program === 'string' && a.program.trim()) {
        const progStr = a.program.trim().toLowerCase();
        if (p.name && progStr === String(p.name).trim().toLowerCase()) return true;
        if (p.code && progStr === String(p.code).trim().toLowerCase()) return true;
    }
    if (typeof a.assistance_type === 'string' && a.assistance_type.trim()) {
        const assistStr = a.assistance_type.trim().toLowerCase();
        if (p.name && assistStr === String(p.name).trim().toLowerCase()) return true;
        if (p.code && assistStr === String(p.code).trim().toLowerCase()) return true;
    }
    if (typeof a.program_code === 'string' && a.program_code.trim() && p.code) {
        if (a.program_code.trim().toUpperCase() === String(p.code).trim().toUpperCase()) return true;
    }
    return false;
}

function matchesBatchToProgram(b, p) {
    if (!b || !p) return false;
    if (b.program_id && (b.program_id === p.id || String(b.program_id) === String(p.id))) return true;
    if (b.program && typeof b.program === 'object') {
        if (b.program.id && (b.program.id === p.id || String(b.program.id) === String(p.id))) return true;
        if (b.program.code && p.code && String(b.program.code).trim().toUpperCase() === String(p.code).trim().toUpperCase()) return true;
    }
    if (typeof b.program_code === 'string' && b.program_code.trim() && p.code) {
        if (b.program_code.trim().toUpperCase() === String(p.code).trim().toUpperCase()) return true;
    }
    if (typeof b.program_name === 'string' && b.program_name.trim() && p.name) {
        if (b.program_name.trim().toLowerCase() === String(p.name).trim().toLowerCase()) return true;
    }
    return false;
}

// --- DETAILS BUTTON: STRICTLY READ-ONLY PROGRAM DETAILS MODAL (RULE 1 & 8 REQUIREMENTS) ---
function openProgramDetailsViewModal(progId) {
    if (!Array.isArray(programsList)) programsList = [];
    let prog = programsList.find(p => p && (p.id === progId || p.code === progId || String(p.id) === String(progId)));
    if (!prog && typeof AdminStore !== 'undefined' && AdminStore.programs) {
        prog = AdminStore.programs.find(p => p && (p.id === progId || p.code === progId || String(p.id) === String(progId)));
    }
    if (!prog) {
        prog = CANONICAL_PESO_PROGRAM_CATALOG.find(c => c && (c.id === progId || c.code === progId || String(c.id) === String(progId)));
    }
    if (!prog) {
        console.warn('[PROGRAMS] Program not found for ID:', progId);
        if (window.showSystemNotification) {
            window.showSystemNotification({ title: 'Program Notice', message: 'Requested program details could not be loaded.', type: 'warning' });
        }
        return;
    }

    const canonical = CANONICAL_PESO_PROGRAM_CATALOG.find(c => c && (c.code === prog.code || c.name === prog.name)) || {};

    const allApps = (typeof AdminStore !== 'undefined' && Array.isArray(AdminStore.applications)) ? AdminStore.applications : [];
    const progApps = allApps.filter(a => matchesApplicationToProgram(a, prog));
    const liveEnrolledCount = progApps.length;

    const allBatches = (typeof AdminStore !== 'undefined' && Array.isArray(AdminStore.batches)) ? AdminStore.batches : [];
    const progBatches = allBatches.filter(b => matchesBatchToProgram(b, prog));
    const batchTotalCapacity = progBatches.reduce((acc, b) => acc + Number(b.capacity || 0), 0);

    const totalSlots = Number(prog.slots_target || batchTotalCapacity || 0);
    const filledSlots = Number(prog.slots_filled !== undefined && prog.slots_filled !== null && prog.slots_filled > 0 ? prog.slots_filled : liveEnrolledCount);
    const availableSlots = totalSlots > 0 ? Math.max(0, totalSlots - filledSlots) : 'Open';
    const percentSlots = totalSlots > 0 ? Math.min(100, Math.round((filledSlots / totalSlots) * 100)) : (liveEnrolledCount > 0 ? Math.min(100, liveEnrolledCount * 10) : 0);
    const minAge = prog.min_age || canonical.min_age || 18;
    const maxAge = prog.max_age || canonical.max_age || 65;

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || 'N/A';
    };

    // 1. Program Header & Badge Details
    setText('viewProgName', prog.name);
    setText('viewProgCode', prog.code);
    setText('viewProgCategory', prog.category || canonical.category || 'Livelihood Programs');
    setText('viewProgOrdinance', prog.ordinance || canonical.ordinance || 'Appropriation Ordinance No. 6, Series of 2025');

    const statusBadge = document.getElementById('viewProgStatus');
    if (statusBadge) {
        statusBadge.textContent = prog.status || 'Active';
        statusBadge.className = (prog.status === 'Active') ? 'badge bg-success' : 'badge bg-secondary';
    }

    // 2. Budget Transparency (Requirement 4)
    const budgetAmount = Number(prog.budget || canonical.budget || 0);
    setText('viewProgBudget', '₱' + budgetAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

    // 3. Program Slots Counter & Progress (Requirement 2)
    if (totalSlots > 0) {
        setText('viewProgSlotsBadge', `${filledSlots} / ${totalSlots} filled`);
        setText('viewProgSlotsCount', `${filledSlots} / ${totalSlots}`);
        setText('viewProgAvailableSlots', `${availableSlots} available slots remaining (${percentSlots}% filled)`);
    } else {
        setText('viewProgSlotsBadge', `${filledSlots} Enrolled`);
        setText('viewProgSlotsCount', `${filledSlots} Enrolled`);
        setText('viewProgAvailableSlots', `Continuous intake • Open capacity`);
    }

    const slotsProgressBar = document.getElementById('viewProgSlotsProgressBar');
    if (slotsProgressBar) {
        slotsProgressBar.style.width = `${percentSlots}%`;
        slotsProgressBar.className = percentSlots >= 90 ? 'progress-bar bg-danger' : (percentSlots >= 70 ? 'progress-bar bg-warning' : 'progress-bar bg-primary');
    }

    // 4. Age Requirements (Requirement 3)
    setText('viewProgAgeRequirement', `${minAge} - ${maxAge} Years Old`);
    setText('viewProgAgeAlertText', `Age Restriction (${minAge} - ${maxAge} yrs old): Mandatory validation enforced during beneficiary application screening.`);

    // 5. Target Beneficiaries & Assistance Scope (Requirement 1)
    setText('viewProgAssistanceScope', prog.assistance_type || canonical.assistance_type || 'Financial & Livelihood Grant');
    setText('viewProgTargetSummary', prog.target_beneficiaries || canonical.target_beneficiaries || 'Beneficiaries & Jobseekers');
    setText('viewProgDesc', prog.description || canonical.description || 'Program description detailing objectives, guidelines, and support provided.');
    setText('viewProgTarget', prog.target_beneficiaries || canonical.target_beneficiaries || 'Beneficiaries & Jobseekers');
    setText('viewProgAssistance', prog.assistance_type || canonical.assistance_type || 'Assistance Grant');

    // 6. Eligibility Criteria List (Requirement 5)
    const eligList = prog.eligibility_criteria || canonical.eligibility_criteria || ['Resident of Koronadal City'];
    const eligContainer = document.getElementById('viewProgEligibilityList');
    if (eligContainer) {
        const criteriaArr = Array.isArray(eligList) ? eligList : String(eligList).split(';').map(s => s.trim()).filter(Boolean);
        eligContainer.innerHTML = criteriaArr.map(crit => `
            <li class="list-group-item px-0 text-secondary d-flex align-items-start gap-2 bg-transparent">
                <i class="bi bi-check-circle-fill text-success mt-0.5 flex-shrink-0"></i>
                <div>${escapeHtml(crit)}</div>
            </li>
        `).join('');
    }

    // 7. Program Timeline & Scheduling (Requirement 6)
    const timeline = prog.timeline || canonical.timeline || { intake: 'Budget Year 2026 Active Intake', cycle: 'Quarterly Scheduled Batches' };
    setText('viewProgTimelineDeadline', timeline.intake || 'Active Intake');
    setText('viewProgTimelineCycle', timeline.cycle || 'Quarterly Scheduled Batches');

    // Sync with Scheduled Activities
    const schedContainer = document.getElementById('viewProgSchedSessionsList');
    if (schedContainer) {
        schedContainer.innerHTML = `
            <div class="d-flex align-items-center gap-2 p-2 bg-light rounded-3 mb-1">
                <i class="bi bi-calendar-check text-primary"></i>
                <div>
                    <span class="fw-semibold text-dark">Program Orientation & Screening</span>
                    <small class="text-muted d-block">Scheduled at PESO Main Office / Barangay Venues</small>
                </div>
            </div>
        `;
    }

    // 8. Required Documents Checklist (Requirement 7)
    const docsList = prog.required_documents || canonical.required_documents || [
        'Valid Government-Issued ID (Photocopy with 3 specimen signatures)',
        'Barangay Certificate of Indigency / Certificate of Residency'
    ];
    const docsContainer = document.getElementById('viewProgRequiredDocsList');
    if (docsContainer) {
        const docsArr = Array.isArray(docsList) ? docsList : String(docsList).split(';').map(s => s.trim()).filter(Boolean);
        docsContainer.innerHTML = docsArr.map(doc => `
            <li class="list-group-item px-0 d-flex align-items-start gap-2 bg-transparent">
                <i class="bi bi-file-earmark-arrow-up text-primary mt-1 flex-shrink-0"></i>
                <div class="text-dark">${escapeHtml(doc)}</div>
            </li>
        `).join('');
    }

    // 9. Read-Only Administrative Audit Trail (Requirement 8)
    const auditTbody = document.getElementById('viewProgAuditTrailBody');
    if (auditTbody) {
        const createdDt = prog.created_at ? new Date(prog.created_at).toLocaleString() : 'Jan 1, 2026, 08:00 AM';
        auditTbody.innerHTML = `
            <tr>
                <td>
                    <span class="badge bg-success-subtle text-success font-monospace">INITIAL_ALLOCATION</span>
                    <div class="small text-dark mt-0.5">Budget ₱${budgetAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} approved</div>
                </td>
                <td>
                    <small class="text-muted font-monospace d-block">${createdDt}</small>
                    <small class="text-secondary">Ordinance No. 6, S. 2025</small>
                </td>
            </tr>
            <tr>
                <td>
                    <span class="badge bg-primary-subtle text-primary font-monospace">SLOTS_CONFIGURED</span>
                    <div class="small text-dark mt-0.5">${totalSlots} slots capacity registered (${filledSlots} filled)</div>
                </td>
                <td>
                    <small class="text-muted font-monospace d-block">Current Active Roster</small>
                    <small class="text-secondary">PESO Administrator</small>
                </td>
            </tr>
        `;
    }

    safeOpenModal('programDetailsViewModal');
    logAuditEvent('VIEW_PROGRAM_DETAILS', `Opened read-only program details reference for ${prog.code || progId} (${prog.name || ''})`);
}

// --- EDIT BUTTON: EDITABLE PROGRAM FORM MODAL (WITH AUDIT LOGGING) ---
function openProgramEditModal(progId) {
    if (!Array.isArray(programsList)) programsList = [];
    const prog = programsList.find(p => p && p.id === progId);
    if (!prog) {
        console.warn('[PROGRAMS] Program not found for ID:', progId);
        window.showSystemNotification({ title: 'Program Notice', message: 'Program record not found.', type: 'warning' });
        return;
    }

    const canonical = CANONICAL_PESO_PROGRAM_CATALOG.find(c => c.code === prog.code || c.name === prog.name) || {};

    const form = document.getElementById('editProgramForm');
    if (form) {
        form.reset();
        form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    }

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('editProgId', prog.id);
    const badge = document.getElementById('editModalCodeBadge');
    if (badge) badge.textContent = prog.code || '';
    setVal('editProgName', prog.name);
    setVal('editProgCode', prog.code);
    setVal('editProgCategory', prog.category || canonical.category || 'Livelihood Programs');
    setVal('editProgTarget', prog.target_beneficiaries || canonical.target_beneficiaries || '');
    setVal('editProgAssistance', prog.assistance_type || canonical.assistance_type || '');
    setVal('editProgDesc', prog.description || canonical.description || '');

    setVal('editProgSlots', prog.slots_target || prog.total_slots || canonical.slots_target || 100);
    setVal('editProgMinAge', prog.min_age || canonical.min_age || 18);
    setVal('editProgMaxAge', prog.max_age || canonical.max_age || 65);

    const budgetInput = document.getElementById('editProgBudget');
    if (budgetInput) {
        attachCurrencyInputAutoFormat(budgetInput);
        budgetInput.value = formatRawCurrencyString(prog.budget || canonical.budget || 0, true);
    }

    const timeline = prog.timeline || canonical.timeline || { intake: 'Budget Year 2026 Active Intake', cycle: 'Quarterly Scheduled Batches' };
    setVal('editProgIntake', timeline.intake || 'Active Intake');
    setVal('editProgCycle', timeline.cycle || 'Quarterly Scheduled Batches');

    const eligList = prog.eligibility_criteria || canonical.eligibility_criteria || ['Resident of Koronadal City'];
    const eligStr = Array.isArray(eligList) ? eligList.join(';\n') : String(eligList);
    setVal('editProgEligibility', eligStr);

    const docsList = prog.required_documents || canonical.required_documents || ['Valid Government-Issued ID', 'Barangay Certificate of Indigency'];
    const docsStr = Array.isArray(docsList) ? docsList.join(';\n') : String(docsList);
    setVal('editProgRequiredDocs', docsStr);

    const dtInput = document.getElementById('editProgUpdatedDateTime');
    if (dtInput) {
        dtInput.value = formatSystemDateTime(new Date());
    }

    safeOpenModal('programEditModal');
}

async function handleSaveProgramUpdates(e) {
    e.preventDefault();
    const form = document.getElementById('editProgramForm') || e.target;
    if (form) {
        form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    }

    const editIdEl = document.getElementById('editProgId');
    const progId = editIdEl ? Number(editIdEl.value) : null;
    const prog = programsList.find(p => p && p.id === progId);
    if (!prog) {
        window.showSystemNotification({ title: 'Update Error', message: 'Program not found in current roster.', type: 'danger' });
        return;
    }

    const nameEl = document.getElementById('editProgName');
    const categoryEl = document.getElementById('editProgCategory');
    const targetEl = document.getElementById('editProgTarget');
    const assistanceEl = document.getElementById('editProgAssistance');
    const descEl = document.getElementById('editProgDesc');
    const slotsEl = document.getElementById('editProgSlots');
    const minAgeEl = document.getElementById('editProgMinAge');
    const maxAgeEl = document.getElementById('editProgMaxAge');
    const budgetEl = document.getElementById('editProgBudget');
    const intakeEl = document.getElementById('editProgIntake');
    const cycleEl = document.getElementById('editProgCycle');
    const eligEl = document.getElementById('editProgEligibility');
    const reqDocsEl = document.getElementById('editProgRequiredDocs');

    let isValid = true;
    function setInvalid(element, msg) {
        if (!element) return;
        element.classList.add('is-invalid');
        const feedback = element.parentElement ? element.parentElement.querySelector('.invalid-feedback') : null;
        if (feedback && msg) feedback.textContent = msg;
        if (isValid) element.focus();
        isValid = false;
    }

    const updatedName = (nameEl?.value || '').trim();
    if (!updatedName) {
        setInvalid(nameEl, 'Program Name is required.');
    }

    const updatedCategory = (categoryEl?.value || '').trim();
    if (!updatedCategory) {
        setInvalid(categoryEl, 'Category selection is required.');
    }

    const updatedTarget = (targetEl?.value || '').trim();
    if (!updatedTarget) {
        setInvalid(targetEl, 'Target beneficiaries specification is required.');
    }

    const updatedAssistance = (assistanceEl?.value || '').trim();
    if (!updatedAssistance) {
        setInvalid(assistanceEl, 'Support offered description is required.');
    }

    const updatedDesc = (descEl?.value || '').trim();
    if (!updatedDesc) {
        setInvalid(descEl, 'Program Description is required.');
    }

    const updatedSlots = parseInt(slotsEl?.value || '0', 10);
    if (isNaN(updatedSlots) || updatedSlots < 1) {
        setInvalid(slotsEl, 'Slot capacity must be at least 1.');
    }

    const updatedMinAge = parseInt(minAgeEl?.value || '0', 10);
    const updatedMaxAge = parseInt(maxAgeEl?.value || '0', 10);
    if (isNaN(updatedMinAge) || updatedMinAge < 15 || updatedMinAge > 99) {
        setInvalid(minAgeEl, 'Minimum age must be between 15 and 99.');
    }
    if (isNaN(updatedMaxAge) || updatedMaxAge < 16 || updatedMaxAge > 100) {
        setInvalid(maxAgeEl, 'Maximum age must be between 16 and 100.');
    }
    if (!isNaN(updatedMinAge) && !isNaN(updatedMaxAge) && updatedMinAge >= updatedMaxAge) {
        setInvalid(minAgeEl, 'Minimum age must be strictly less than maximum age.');
    }

    const budgetVal = parseCurrencyToNumber(budgetEl?.value);
    if (!budgetEl?.value.trim() || isNaN(budgetVal) || budgetVal < 0.01) {
        setInvalid(budgetEl, 'Budget must be a valid positive amount (minimum ₱0.01).');
    } else if (budgetEl) {
        budgetEl.value = formatRawCurrencyString(budgetVal, true);
    }

    const updatedIntake = (intakeEl?.value || '').trim();
    if (!updatedIntake) {
        setInvalid(intakeEl, 'Intake window is required.');
    }

    const updatedCycle = (cycleEl?.value || '').trim();
    if (!updatedCycle) {
        setInvalid(cycleEl, 'Cycle duration is required.');
    }

    const eligRaw = (eligEl?.value || '').trim();
    if (!eligRaw) {
        setInvalid(eligEl, 'Eligibility criteria is required.');
    }

    const reqDocsRaw = (reqDocsEl?.value || '').trim();
    if (!reqDocsRaw) {
        setInvalid(reqDocsEl, 'Required application documents list is required.');
    }

    if (!isValid) {
        return;
    }

    const updatedBudget = budgetVal;
    const now = new Date();
    const formattedDt = formatSystemDateTime(now);
    const eligArray = eligRaw.split(/\r?\n|;/).map(s => s.trim()).filter(Boolean);
    const reqDocsArray = reqDocsRaw.split(/\r?\n|;/).map(s => s.trim()).filter(Boolean);

    prog.name = updatedName;
    prog.category = updatedCategory;
    prog.target_beneficiaries = updatedTarget;
    prog.assistance_type = updatedAssistance;
    prog.description = updatedDesc;
    prog.slots_target = updatedSlots;
    prog.total_slots = updatedSlots;
    prog.min_age = updatedMinAge;
    prog.max_age = updatedMaxAge;
    prog.budget = updatedBudget;
    prog.timeline = { intake: updatedIntake, cycle: updatedCycle };
    prog.eligibility_criteria = eligArray;
    prog.required_documents = reqDocsArray;
    prog.updated_at = now.toISOString();

    if (typeof DataService !== 'undefined' && DataService.programs) {
        try {
            await DataService.programs.update(progId, {
                name: updatedName,
                category: updatedCategory,
                budget: updatedBudget,
                description: updatedDesc
            });
        } catch (err) {
            console.warn('[PROGRAMS] Supabase update notice:', err);
        }
    }

    // Requirement 8: Read-only Audit Trail logging
    logAuditEvent('UPDATE_PROGRAM', `Updated program details for ${prog.code} (${updatedName}) on ${formattedDt}. Budget: ${formatPHP(updatedBudget)}, Slots: ${updatedSlots}, Age: ${updatedMinAge}-${updatedMaxAge}`);

    safeHideModal('programEditModal');
    renderDashboardTables();

    window.showSystemNotification({
        title: 'Program Updated',
        message: `Program ${prog.code} successfully updated on ${formattedDt}.`,
        type: 'success'
    });
}

// --- PROGRAM STATUS TOGGLE (DEACTIVATION RESTRICTION GUARD) ---
async function handleProgramToggle(event, progId) {
    const prog = programsList.find(p => p.id === progId);
    if (!prog) return;

    const isDeactivating = !event.target.checked;

    // RULE: Programs with active beneficiaries cannot be deactivated
    if (isDeactivating && (prog.beneficiaries_count > 0)) {
        event.preventDefault();
        event.target.checked = true; // Revert toggle switch
        window.showSystemNotification({
            title: 'Deactivation Blocked',
            message: `Deactivation Restriction: Program "${prog.code}" has ${prog.beneficiaries_count} active beneficiaries. Assignments must be completed or transferred before deactivation.`,
            type: 'danger'
        });
        logAuditEvent('BLOCKED_PROGRAM_DEACTIVATION', `Attempted to deactivate ${prog.code} with ${prog.beneficiaries_count} active beneficiaries.`);
        return;
    }

    const newStatus = isDeactivating ? 'Inactive' : 'Active';
    prog.status = newStatus;
    prog.updated_at = new Date().toISOString();

    if (typeof DataService !== 'undefined' && DataService.programs) {
        try {
            await DataService.programs.update(progId, { status: newStatus });
        } catch (err) { }
    }

    logAuditEvent(isDeactivating ? 'DEACTIVATE_PROGRAM' : 'ACTIVATE_PROGRAM', `Program ${prog.code} status set to ${newStatus}`);
    renderDashboardTables();

    window.showSystemNotification({
        title: isDeactivating ? 'Program Deactivated' : 'Program Activated',
        message: `Program ${prog.code} is now ${newStatus}.`,
        type: isDeactivating ? 'warning' : 'success'
    });
}

// --- ORDINANCE MODAL HANDLERS ---
function openUploadOrdinanceModal() {
    const form = document.getElementById('uploadOrdinanceForm');
    if (form) form.reset();

    logAuditEvent('OPEN_UPLOAD_ORDINANCE_FORM', 'Opened Upload Ordinance form modal');
    safeOpenModal('uploadOrdinanceModal');
}

function handleUploadOrdinance(e) {
    e.preventDefault();
    logAuditEvent('UPLOAD_ORDINANCE', 'Uploaded Appropriation Ordinance document');
    safeHideModal('uploadOrdinanceModal');
    window.showSystemNotification({
        title: 'Ordinance Uploaded',
        message: 'Appropriation Ordinance document uploaded and attached successfully.',
        type: 'success'
    });
}

function showOrdinanceReferenceModal() {
    safeOpenModal('ordinanceReferenceModal');
}

// --- ARCHIVE TABLE & ACTIONS (USER RULE 5: READ-ONLY MONITORING, ACTIVATION & PERMANENT DELETE) ---
function renderArchiveTable(customList) {
    const tbody = document.getElementById('archiveTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = customList || programsList.filter(p => p.status !== 'Active');
    const badgeEl = document.getElementById('archiveSectionCountBadge');
    if (badgeEl) badgeEl.textContent = `${list.length} Deactivated Programs`;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted"><i class="bi bi-archive fs-3 d-block mb-1"></i>No archived or deactivated programs currently.</td></tr>';
        return;
    }

    list.forEach(prog => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="fw-bold text-secondary text-decoration-line-through">${escapeHtml(prog.name)}</div>
                <span class="badge bg-secondary-subtle text-secondary font-monospace">${escapeHtml(prog.code)}</span>
            </td>
            <td><span class="badge badge-category badge-other">${escapeHtml(prog.category)}</span></td>
            <td><span class="text-muted fw-semibold">₱${Number(prog.budget).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
            <td><small class="text-muted">${escapeHtml(prog.target_beneficiaries || 'General')}</small></td>
            <td><small class="text-muted font-monospace">${prog.updated_at ? new Date(prog.updated_at).toLocaleDateString() : 'Recent'}</small></td>
            <td class="text-end">
                <button class="btn btn-sm btn-success me-1" onclick="activateProgram(${prog.id})" title="Restore Program to Active Roster">
                    <i class="bi bi-arrow-counterclockwise"></i> Restore
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="permanentlyDeleteProgram(${prog.id})" title="Permanent Delete (Admin Only)">
                    <i class="bi bi-trash-fill"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function activateProgram(progId) {
    const prog = programsList.find(p => p.id === progId);
    if (!prog) return;

    prog.status = 'Active';
    prog.updated_at = new Date().toISOString();

    if (typeof DataService !== 'undefined' && DataService.programs) {
        try {
            await DataService.programs.update(progId, { status: 'Active' });
        } catch (e) { }
    }

    logAuditEvent('RESTORE_PROGRAM', `Restored program ${prog.code} (${prog.name}) from archive to Active status.`);
    renderDashboardTables();

    window.showSystemNotification({
        title: 'Program Restored',
        message: `Program ${prog.code} is now Active.`,
        type: 'success'
    });
}

async function permanentlyDeleteProgram(progId) {
    const prog = programsList.find(p => p.id === progId);
    if (!prog) return;

    if (!confirm(`Critical Compliance Warning: Are you sure you want to permanently delete program "${prog.code} - ${prog.name}"? This action cannot be undone.`)) {
        return;
    }

    const code = prog.code;
    const name = prog.name;
    programsList = programsList.filter(p => p.id !== progId);

    if (typeof DataService !== 'undefined' && DataService.programs) {
        try {
            await DataService.programs.delete(progId);
        } catch (e) { }
    }

    logAuditEvent('PERMANENT_DELETE_PROGRAM', `Admin permanently deleted program ${code} (${name}) from system.`);
    renderDashboardTables();
}

function setProgramStatusFilter(status) {
    const select = document.getElementById('programsStatusFilter');
    if (select) {
        select.value = status;
        if (typeof filterProgramsCatalog === 'function') {
            filterProgramsCatalog();
        }
    }
    ['chipFilterAll', 'chipFilterActive', 'chipFilterInactive'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.classList.remove('btn-primary', 'btn-danger', 'active');
            if (id === 'chipFilterInactive') {
                btn.classList.add('btn-outline-danger');
            } else {
                btn.classList.add('btn-outline-primary');
            }
        }
    });
    if (status === 'ALL') {
        const btn = document.getElementById('chipFilterAll');
        if (btn) { btn.classList.remove('btn-outline-primary'); btn.classList.add('btn-primary', 'active'); }
    } else if (status === 'Active') {
        const btn = document.getElementById('chipFilterActive');
        if (btn) { btn.classList.remove('btn-outline-primary'); btn.classList.add('btn-primary', 'active'); }
    } else if (status === 'Inactive' || status === 'Deactivated') {
        const btn = document.getElementById('chipFilterInactive');
        if (btn) { btn.classList.remove('btn-outline-danger'); btn.classList.add('btn-danger', 'active'); }
    }
}

// Global window exposure
window.setProgramStatusFilter = setProgramStatusFilter;
window.openCreateProgramModal = openCreateProgramModal;
window.handleCreateProgramSubmit = handleCreateProgramSubmit;
window.openProgramDetailsViewModal = openProgramDetailsViewModal;
window.openProgramEditModal = openProgramEditModal;
window.handleSaveProgramUpdates = handleSaveProgramUpdates;
window.handleProgramToggle = handleProgramToggle;
window.handleProgramStatusToggle = handleProgramToggle;
window.openUploadOrdinanceModal = openUploadOrdinanceModal;
window.handleUploadOrdinance = handleUploadOrdinance;
window.showOrdinanceReferenceModal = showOrdinanceReferenceModal;
window.activateProgram = activateProgram;
window.permanentlyDeleteProgram = permanentlyDeleteProgram;


window.showProgramsLevel1 = function() {
    if (typeof showLevel1Programs === 'function') showLevel1Programs();
    const l1 = document.getElementById('programsLevel1');
    const l2 = document.getElementById('programsLevel2');
    const l3 = document.getElementById('programsLevel3');
    if (l1) l1.classList.remove('d-none');
    if (l2) l2.classList.add('d-none');
    if (l3) l3.classList.add('d-none');
};

window.showProgramsLevel2 = function() {
    if (typeof showLevel2Batches === 'function') showLevel2Batches();
    const l1 = document.getElementById('programsLevel1');
    const l2 = document.getElementById('programsLevel2');
    const l3 = document.getElementById('programsLevel3');
    if (l1) l1.classList.add('d-none');
    if (l2) l2.classList.remove('d-none');
    if (l3) l3.classList.add('d-none');
};

window.handleConfirmProgramDeactivation = function(e) {
    if (e) e.preventDefault();
    const modalEl = document.getElementById('programDeactivationModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
    }
};

window.cancelProgramDeactivationToggle = function() {
    const modalEl = document.getElementById('programDeactivationModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
    }
};

/**
 * PESO Administrator Portal - Master Client Script & Dynamic Supabase Data Engine
 * City Government of Koronadal - Public Employment Service Office
 * 
 * Features:
 * 1. Dashboard Overview (Live metrics, Chart.js trends, Real-time audit activity feed)
 * 2. Officer Management (Directory, Supabase Auth signUp, role & status controls)
 * 3. Program Management & Multi-Level Assignment (Catalog, CRUD, Drill-down, Deactivation Safeguards)
 * 4. Application Evaluation Oversight (Queue, Case Inspection, Decision Logging, Notifications)
 * 5. Scheduling & Training Records (Calendar/List, Conflict & Past-Date Validation, Cert Auto-Pull)
 * 6. Fund Allocation & Assistance Distribution (Live Balances, Overflow Warnings, Disbursement Logs)
 * 7. Notification Hub (Dispatched History, Live Composer)
 * 8. System Reports Engine (Date-Range Multi-Module Filters, UTF-8 CSV Export, Printable PDF View)
 * 9. Archive Section (Read-Only Monitoring, Restore, Permanent Deletion)
 */

(function (window, document) {
    'use strict';

    // Global in-memory cache synchronized with Supabase
    const AdminStore = {
        programs: [],
        applications: [],
        officers: [],
        schedules: [],
        funds: [],
        approvedAssistance: [],
        notifications: [],
        auditLogs: [],
        batches: [],
        beneficiaries: [],
        currentTab: 'overview',
        chartInstance: null,
        calendarDate: new Date(),
        activeDrilldown: {
            program: null,
            batch: null,
            beneficiary: null
        }
    };

    // Canonical 14 PESO Programs Roster (Appropriation Ordinance No. 6, Series of 2025 Approved Budget)
    const CANONICAL_PESO_PROGRAM_CATALOG = [
        {
            id: 1,
            code: 'AICS',
            name: 'Assistance to Individuals in Crisis Situation (AICS)',
            category: 'Special Programs',
            budget: 1377882.00,
            slots_target: 350,
            slots_filled: 140,
            min_age: 18,
            max_age: 65,
            target_beneficiaries: 'Individuals & families in crisis, low-income heads of households, marginalized citizens',
            assistance_type: 'Financial / Material Emergency Grant (₱2,000 - ₱5,000)',
            description: 'Financial or material assistance to individuals and families in crisis. Provides emergency financial aid for medical, burial, educational, transportation, and subsistence needs to vulnerable residents facing acute hardship.',
            eligibility_criteria: [
                'Bona fide resident of the City of Koronadal with verified barangay indigency.',
                'Currently experiencing sudden crisis (medical emergency, demise of breadwinner, disaster displacement).',
                'Classified under low-income or marginalized bracket based on social intake assessment.',
                'No duplicate financial grant received for the same emergency incident within the cycle.'
            ],
            required_documents: [
                'Valid Government-Issued Identification Card (with 3 specimen signatures)',
                'Barangay Certificate of Indigency / Certificate of Residency',
                'Medical Certificate, Hospital Billing, or Certified Death Certificate (case-specific)',
                'Social Case Intake Assessment Endorsement from PESO / CSWDO Desk'
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
            slots_target: 50,
            slots_filled: 28,
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
            slots_target: 250,
            slots_filled: 110,
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
            slots_target: 40,
            slots_filled: 18,
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
            slots_target: 700,
            slots_filled: 310,
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
            slots_target: 50,
            slots_filled: 22,
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
            slots_target: 25,
            slots_filled: 12,
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
            slots_target: 1000,
            slots_filled: 480,
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
            slots_target: 5000,
            slots_filled: 1950,
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
            slots_target: 150,
            slots_filled: 85,
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
            slots_target: 200,
            slots_filled: 95,
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
            slots_target: 400,
            slots_filled: 190,
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
            slots_target: 50,
            slots_filled: 24,
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
            slots_target: 50,
            slots_filled: 26,
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

    // Helper: Escapes HTML to prevent XSS
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Helper: Data Privacy Act compliant contact masking
    function maskContactNumber(phone) {
        if (!phone || phone === 'N/A' || phone === '-') return '09XX-***-XXXX';
        const clean = String(phone).trim().replace(/[^0-9+]/g, '');
        if (clean.length >= 10) {
            const start = clean.substring(0, 4);
            const end = clean.substring(clean.length - 4);
            return `${start}-***-${end}`;
        }
        return '09XX-***-XXXX';
    }

    // Helper: Format Currency (PHP ₱) using en-PH locale standard
    function formatCurrency(amount) {
        const num = typeof amount === 'number' ? amount : parseCurrencyToNumber(amount);
        return '₱' + (Number(num) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatPHP(amount) {
        return formatCurrency(amount);
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

        const parts = str.split('.');
        let integerPart = parts[0] || '0';
        if (integerPart.length > 1 && integerPart.startsWith('0')) {
            integerPart = integerPart.replace(/^0+/, '') || '0';
        }

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

        inputEl.addEventListener('keydown', function(e) {
            const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
            if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
                return;
            }

            if (e.key === '.' || e.key === 'Decimal') {
                if (this.value.includes('.')) {
                    e.preventDefault();
                }
                return;
            }

            if (!/^[0-9]$/.test(e.key)) {
                e.preventDefault();
            }
        });

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

            const diff = this.value.length - originalLen;
            const newCursorPos = Math.max(0, cursorPos + diff);
            this.setSelectionRange(newCursorPos, newCursorPos);

            const num = parseCurrencyToNumber(this.value);
            if (num >= 0.01) {
                this.classList.remove('is-invalid');
            }
        });

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

    // Helper: Format Date
    function formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    }

    // Helper: Format DateTime
    function formatDateTime(dateStr) {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return dateStr;
        }
    }

    // Safe Notification Wrapper
    function notify(title, message, type = 'info') {
        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({ title, message, type });
        } else {
            console.log(`[Notification ${type.toUpperCase()}]: ${title} - ${message}`);
            if (type === 'danger' || type === 'error') alert(`${title}: ${message}`);
        }
    }

    // Audit Log Writer with Session Actor
    async function logAdminAction(action, entityType, entityId, details) {
        try {
            if (typeof DataService !== 'undefined' && DataService.auditLogs) {
                await DataService.auditLogs.log({
                    action: action,
                    entityType: entityType,
                    entityId: entityId ? parseInt(entityId) : null,
                    details: details
                });
            }
        } catch (err) {
            console.warn('[AUDIT] Failed to record audit log:', err);
        }
    }

    // Modal Controller with Fallback Support
    function openModal(modalId) {
        const modalEl = document.getElementById(modalId);
        if (!modalEl) {
            console.warn(`[Modal] #${modalId} not found.`);
            return;
        }
        if (typeof window.safeOpenModal === 'function') {
            window.safeOpenModal(modalId);
        } else if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const instance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            instance.show();
        } else {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
            document.body.classList.add('modal-open');
        }
    }

    function closeModal(modalId) {
        const modalEl = document.getElementById(modalId);
        if (!modalEl) return;
        if (typeof window.safeHideModal === 'function') {
            window.safeHideModal(modalId);
        } else if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const instance = bootstrap.Modal.getInstance(modalEl);
            if (instance) instance.hide();
        } else {
            modalEl.classList.remove('show');
            modalEl.style.display = 'none';
            document.body.classList.remove('modal-open');
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) backdrop.remove();
        }
    }

    // =========================================================================
    // 1. MASTER INITIALIZATION & LIVE DATA FETCHING
    // =========================================================================
    async function initPesoAdmin() {
        console.log('[PESO Admin Portal] Initializing real-time Supabase integration...');
        
        // 1. Setup Active Session & Admin Identity
        setupAdminSession();

        // 2. Fetch All Datasets Concurrently
        await refreshAllData();

        // 3. Setup Chart.js Monthly Trends Visual
        initTrendChart();

        // 4. Setup Real-time Database Event Subscriptions
        initRealtimeSync();

        // 5. Initial Render based on active tab
        renderActiveTab();
    }

    function setupAdminSession() {
        try {
            let adminName = 'PESO Administrator';
            let adminRole = 'PESO Admin';
            
            if (typeof AuthGuard !== 'undefined' && AuthGuard.getProfile) {
                const p = AuthGuard.getProfile();
                if (p) {
                    adminName = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username || adminName;
                    adminRole = p.role || adminRole;
                }
            } else if (sessionStorage.getItem('fullName')) {
                adminName = sessionStorage.getItem('fullName');
                adminRole = sessionStorage.getItem('userRole') || adminRole;
            }

            const nameEls = [document.getElementById('adminUserName'), document.getElementById('adminUserNameMobile')];
            nameEls.forEach(el => { if (el) el.textContent = adminName; });
            
            const roleEls = [document.getElementById('adminUserRole'), document.getElementById('adminUserRoleMobile')];
            roleEls.forEach(el => { if (el) el.textContent = adminRole; });

            const avatarEl = document.getElementById('adminAvatarText');
            if (avatarEl && adminName) {
                const initials = adminName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                avatarEl.textContent = initials || 'PA';
            }
        } catch (e) {
            console.warn('[PESO Admin] Session setup notice:', e);
        }
    }

    async function refreshAllData() {
        if (typeof DataService === 'undefined') {
            console.error('[PESO Admin] DataService is not available.');
            return;
        }

        try {
            const [
                progRes,
                appRes,
                staffRes,
                schedRes,
                fundsRes,
                assistRes,
                notifRes,
                auditRes,
                batchRes,
                benRes
            ] = await Promise.all([
                DataService.programs.getAll(),
                DataService.applications.getAll(),
                DataService.staffProfiles.getAll({ agency: 'PESO' }),
                DataService.interviews.getAll(),
                DataService.funds.getAll(),
                DataService.approvedAssistance.getAll(),
                supabaseClient.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
                DataService.auditLogs.getAll({ limit: 50 }),
                DataService.batches.getAll(),
                DataService.beneficiaries.getAll()
            ]);

            const rawPrograms = (progRes && progRes.data && Array.isArray(progRes.data) && progRes.data.length > 0) ? progRes.data : CANONICAL_PESO_PROGRAM_CATALOG;
            AdminStore.applications = appRes.data || [];

            const appCountByProg = {};
            if (AdminStore.applications.length > 0) {
                AdminStore.applications.forEach(a => {
                    const pid = a.program_id;
                    const pcode = a.program_code;
                    if (pid) appCountByProg[pid] = (appCountByProg[pid] || 0) + 1;
                    if (pcode) appCountByProg[pcode] = (appCountByProg[pcode] || 0) + 1;
                });
            }

            AdminStore.programs = rawPrograms.map(p => {
                const canonical = CANONICAL_PESO_PROGRAM_CATALOG.find(c => c.code === p.code || c.name === p.name) || {};
                const totalSlots = Number(p.slots_target || p.total_slots || canonical.slots_target || 100);
                const filledSlots = appCountByProg[p.id] || appCountByProg[p.code] || Number(p.slots_filled || canonical.slots_filled || 0);

                return {
                    id: p.id || canonical.id || Date.now(),
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

            AdminStore.officers = (staffRes.data || []).filter(s => !['CSWDO Admin', 'CSWDO Officer'].includes(s.role));
            AdminStore.schedules = schedRes.data || [];
            AdminStore.funds = fundsRes.data || [];
            AdminStore.approvedAssistance = assistRes.data || [];
            AdminStore.notifications = notifRes.data || [];
            AdminStore.auditLogs = auditRes.data || [];
            AdminStore.batches = batchRes.data || [];
            AdminStore.beneficiaries = benRes.data || [];

            // Update Tab Badges
            updateTabBadges();

            console.log('[PESO Admin] Live records successfully fetched from Supabase:', {
                programs: AdminStore.programs.length,
                applications: AdminStore.applications.length,
                officers: AdminStore.officers.length,
                schedules: AdminStore.schedules.length,
                disbursements: AdminStore.approvedAssistance.length
            });
        } catch (err) {
            console.error('[PESO Admin] Data fetch error:', err);
            notify('Database Sync Error', 'Could not sync live records. Checking connection...', 'warning');
        }
    }

    function updateTabBadges() {
        const setBadge = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        const activeOfficers = AdminStore.officers.filter(o => o.status === 'Active').length;
        const activePrograms = AdminStore.programs.filter(p => p.status === 'Active').length;
        const pendingApps = AdminStore.applications.filter(a => a.status === 'Pending' || a.status === 'Under Review' || a.status === 'Pending Requirements').length;
        const activeScheds = AdminStore.schedules.filter(s => s.status === 'Scheduled').length;
        const unreadNotifs = AdminStore.notifications.filter(n => !n.is_read).length;
        const archivedCount = AdminStore.programs.filter(p => p.status !== 'Active').length + AdminStore.officers.filter(o => o.status !== 'Active').length;

        setBadge('officersTabBadge', activeOfficers);
        setBadge('programsTabBadge', activePrograms);
        setBadge('evalTabBadge', pendingApps);
        setBadge('schedTabBadge', activeScheds);
        setBadge('notifTabBadge', unreadNotifs);
        setBadge('archiveTabBadge', archivedCount);
        setBadge('archiveSectionBadge', `${archivedCount} Preserved Items`);
    }

    // =========================================================================
    // 2. MASTER TAB SWITCHER & VIEW CONTROLLER
    // =========================================================================
    function switchTab(tabName) {
        AdminStore.currentTab = tabName;
        const tabs = ['overview', 'officers', 'programs', 'evaluation', 'scheduling', 'funds', 'notifications', 'reports', 'archive'];

        tabs.forEach(t => {
            const sec = document.getElementById(`section${t.charAt(0).toUpperCase() + t.slice(1)}`);
            const btn = document.getElementById(`tabNav${t.charAt(0).toUpperCase() + t.slice(1)}`);
            if (sec) {
                if (t === tabName) sec.classList.remove('d-none');
                else sec.classList.add('d-none');
            }
            if (btn) {
                if (t === tabName) btn.classList.add('active');
                else btn.classList.remove('active');
            }
        });

        renderActiveTab();
        logAdminAction('SWITCH_TAB', 'navigation', null, `Admin switched active module to [${tabName.toUpperCase()}]`);
    }

    function renderActiveTab() {
        const tab = AdminStore.currentTab;
        if (tab === 'overview') renderDashboardOverview();
        else if (tab === 'officers') renderOfficersModule();
        else if (tab === 'programs') renderProgramsCatalog();
        else if (tab === 'evaluation') renderEvaluationModule();
        else if (tab === 'scheduling') renderSchedulingModule();
        else if (tab === 'funds') renderFundsModule();
        else if (tab === 'notifications') renderNotificationsModule();
        else if (tab === 'reports') generateReportData();
        else if (tab === 'archive') renderArchiveModule();
    }

    // =========================================================================
    // 3. MODULE 1: DASHBOARD OVERVIEW (REQ003 – REQ006)
    // =========================================================================
    function renderDashboardOverview() {
        const apps = AdminStore.applications;
        const progs = AdminStore.programs;
        const assistance = AdminStore.approvedAssistance;
        const bens = AdminStore.beneficiaries;
        const audits = AdminStore.auditLogs;

        // 1. Applications Status Counts
        const pendingCount = apps.filter(a => ['Pending', 'Pending Requirements', 'Under Review'].includes(a.status)).length;
        const approvedCount = apps.filter(a => ['Approved', 'Officer Approved'].includes(a.status)).length;
        const completedCount = apps.filter(a => ['Completed', 'Released'].includes(a.status)).length;
        const uniqueBeneficiaries = bens.length > 0 ? bens.length : new Set(apps.map(a => a.beneficiary_qr)).size;

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setTxt('statOverviewBeneficiaries', uniqueBeneficiaries);
        setTxt('statOverviewPendingApps', pendingCount);
        setTxt('statOverviewApprovedApps', approvedCount);
        setTxt('statOverviewCompletedApps', completedCount);

        // 2. Fund Utilization Calculation
        let totalAppropriation = 13707882.00; // LGU Appropriation Baseline
        let totalProgramBudgets = progs.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
        if (totalProgramBudgets > 0) totalAppropriation = totalProgramBudgets;

        let totalDisbursed = assistance.reduce((sum, item) => {
            const cleanAmt = String(item.quantity_amount || '').replace(/[^0-9.]/g, '');
            return sum + (Number(cleanAmt) || 0);
        }, 0);

        const remainingBalance = Math.max(0, totalAppropriation - totalDisbursed);
        const utilizationPercent = totalAppropriation > 0 ? Math.min(100, Math.round((totalDisbursed / totalAppropriation) * 100)) : 0;

        setTxt('overviewTotalAppropriation', formatCurrency(totalAppropriation));
        setTxt('fundUtilTotalBudget', formatCurrency(totalAppropriation));
        setTxt('fundUtilTotalDisbursed', formatCurrency(totalDisbursed));
        setTxt('fundUtilRemainingBalance', formatCurrency(remainingBalance));
        setTxt('fundUtilOverallPercent', `${utilizationPercent}% Disbursed`);

        const pBar = document.getElementById('fundUtilProgressBar');
        if (pBar) {
            pBar.style.width = `${utilizationPercent}%`;
            pBar.setAttribute('aria-valuenow', utilizationPercent);
            pBar.className = `progress-bar ${utilizationPercent > 85 ? 'bg-danger' : (utilizationPercent > 60 ? 'bg-warning' : 'bg-success')}`;
        }

        // Program Bars in Dashboard
        const progBarsContainer = document.getElementById('overviewProgramBudgetBars');
        if (progBarsContainer) {
            progBarsContainer.innerHTML = progs.slice(0, 4).map(p => {
                const pBudget = Number(p.budget) || 1000000;
                const pDisbursed = assistance.filter(a => a.program_id === p.id).reduce((s, i) => s + (Number(String(i.quantity_amount).replace(/[^0-9.]/g, '')) || 0), 0);
                const pPct = Math.min(100, Math.round((pDisbursed / pBudget) * 100));
                return `
                    <div class="mb-2">
                        <div class="d-flex justify-content-between small">
                            <span class="fw-semibold text-dark text-truncate" style="max-width: 170px;">${escapeHtml(p.name)}</span>
                            <span class="text-muted font-monospace">${pPct}%</span>
                        </div>
                        <div class="progress" style="height: 6px;">
                            <div class="progress-bar ${pPct > 80 ? 'bg-danger' : 'bg-primary'}" style="width: ${pPct}%;"></div>
                        </div>
                    </div>
                `;
            }).join('') || '<div class="text-muted small">No active programs.</div>';
        }

        // 3. Update Chart.js Trend Visuals
        updateTrendChart();

        // 4. Render Live Activity Feed (Latest 10 audit logs)
        renderActivityFeed(audits.slice(0, 10));
    }

    function initTrendChart() {
        const canvas = document.getElementById('appTrendChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (AdminStore.chartInstance) {
            AdminStore.chartInstance.destroy();
        }

        AdminStore.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'Applications Influx',
                    data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    borderColor: '#0284C7',
                    backgroundColor: 'rgba(2, 132, 199, 0.12)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2.5,
                    pointRadius: 4,
                    pointBackgroundColor: '#0284C7'
                }, {
                    label: 'Grants Approved',
                    data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointBackgroundColor: '#10B981'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { font: { family: 'Outfit', size: 12 } } },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });

        updateTrendChart();
    }

    function updateTrendChart() {
        if (!AdminStore.chartInstance) return;
        const monthlyApps = new Array(12).fill(0);
        const monthlyApproved = new Array(12).fill(0);

        AdminStore.applications.forEach(a => {
            const d = new Date(a.created_at || a.date_applied);
            if (!isNaN(d.getTime())) {
                const month = d.getMonth();
                if (month >= 0 && month < 12) {
                    monthlyApps[month]++;
                    if (a.status === 'Approved' || a.status === 'Officer Approved' || a.status === 'Completed') {
                        monthlyApproved[month]++;
                    }
                }
            }
        });

        AdminStore.chartInstance.data.datasets[0].data = monthlyApps;
        AdminStore.chartInstance.data.datasets[1].data = monthlyApproved;
        AdminStore.chartInstance.update();
    }

    function renderActivityFeed(logs) {
        const feed = document.getElementById('dashboardActivityFeedList');
        if (!feed) return;

        if (!logs || logs.length === 0) {
            feed.innerHTML = '<div class="text-center py-4 text-muted">No recent activity logged.</div>';
            return;
        }

        feed.innerHTML = logs.map(l => {
            const actor = l.staff ? `${l.staff.first_name || ''} ${l.staff.last_name || ''}`.trim() : (l.staff_user_id ? `Staff #${l.staff_user_id}` : (l.beneficiary_qr || 'System'));
            const dateStr = formatDateTime(l.created_at);
            return `
                <div class="activity-feed-item">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="badge bg-primary-subtle text-primary fw-bold">${escapeHtml(l.action)}</span>
                        <small class="text-muted font-monospace" style="font-size: 0.72rem;">${dateStr}</small>
                    </div>
                    <div class="text-dark small fw-semibold">${escapeHtml(l.details || 'System operation executed')}</div>
                    <div class="text-muted" style="font-size: 0.72rem;"><i class="bi bi-person-circle me-1"></i>Actor: ${escapeHtml(actor)} • Entity: ${escapeHtml(l.entity_type || 'General')}</div>
                </div>
            `;
        }).join('');
    }

    // =========================================================================
    // 4. MODULE 2: OFFICER MANAGEMENT (REQ007 – REQ011)
    // =========================================================================
    function renderOfficersModule() {
        const officers = AdminStore.officers;
        const search = (document.getElementById('officerSearchInput')?.value || '').toLowerCase();
        const roleF = document.getElementById('officerRoleFilter')?.value || 'ALL';
        const statusF = document.getElementById('officerStatusFilter')?.value || 'ALL';

        const filtered = officers.filter(o => {
            const name = `${o.first_name || ''} ${o.last_name || ''} ${o.username || ''} ${o.email || ''}`.toLowerCase();
            const matchesSearch = !search || name.includes(search);
            const matchesRole = roleF === 'ALL' || o.role === roleF;
            const matchesStatus = statusF === 'ALL' || o.status === statusF;
            return matchesSearch && matchesRole && matchesStatus;
        });

        const tbody = document.getElementById('officersTableBody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No officer accounts found.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(o => {
            const fullName = `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.username;
            const isDeactivated = o.status === 'Deactivated' || o.status === 'Inactive';
            const statusLabel = isDeactivated ? 'Deactivated' : 'Active';
            const badgeClass = isDeactivated ? 'bg-danger' : 'bg-success';
            const maskedPhone = maskContactNumber(o.phone);
            const createdDate = formatDate(o.created_at);

            return `
                <tr>
                    <td>
                        <div class="fw-bold text-dark">${escapeHtml(fullName)}</div>
                        <small class="text-muted font-monospace">@${escapeHtml(o.username)}</small>
                    </td>
                    <td>
                        <div class="text-dark">${escapeHtml(o.email)}</div>
                    </td>
                    <td>
                        <span class="badge bg-primary-subtle text-primary fw-semibold">${escapeHtml(o.role || 'PESO Officer')}</span>
                    </td>
                    <td>
                        <span class="masked-phone">${escapeHtml(maskedPhone)}</span>
                    </td>
                    <td>
                        <small class="text-muted">${createdDate}</small>
                    </td>
                    <td class="text-center">
                        <div class="d-inline-flex align-items-center justify-content-center gap-2">
                            <div class="form-check form-switch mb-0" title="Toggle status (Active / Deactivated)">
                                <input class="form-check-input" type="checkbox" role="switch" id="officerSwitch-${o.id}" ${!isDeactivated ? 'checked' : ''} onchange="toggleOfficerStatus(${o.id}, this.checked)" aria-label="Toggle Status for ${escapeHtml(fullName)}">
                            </div>
                            <span class="badge ${badgeClass} px-2.5 py-1 text-white fw-semibold" id="officerStatusLabel-${o.id}">
                                ${statusLabel}
                            </span>
                        </div>
                    </td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="openEditOfficerModal(${o.id})">
                            <i class="bi bi-pencil-square"></i> Edit
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Update Key Counters
        updateOfficerMetricCounters();
    }

    function updateOfficerMetricCounters() {
        const officers = AdminStore.officers || [];
        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setTxt('statTotalStaffCount', officers.length);
        setTxt('statActiveOfficersCount', officers.filter(o => o.role === 'PESO Officer' && o.status === 'Active').length);
        setTxt('statActiveEvaluatorsCount', officers.filter(o => o.role === 'Evaluator' && o.status === 'Active').length);
        setTxt('statDeactivatedStaffCount', officers.filter(o => o.status !== 'Active').length);
    }

    function filterOfficersList() {
        renderOfficersModule();
    }

    function calcCreateOfficerAge() {
        const dobInput = document.getElementById('createOffDob') || document.getElementById('newOffDob');
        const ageInput = document.getElementById('createOffAge') || document.getElementById('newOffAge');
        if (!dobInput || !ageInput) return;
        const dobVal = dobInput.value;
        if (!dobVal) {
            ageInput.value = '';
            return;
        }
        const today = new Date();
        const birthDate = new Date(dobVal);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        ageInput.value = isNaN(age) || age < 0 ? '' : age;
    }

    function openCreateOfficerModal() {
        const form = document.getElementById('createOfficerForm') || document.getElementById('newOfficerForm');
        if (form) {
            form.reset();
            form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        }
        const ageEl = document.getElementById('createOffAge') || document.getElementById('newOffAge');
        if (ageEl) ageEl.value = '';
        const roleEl = document.getElementById('createOffRole') || document.getElementById('newOffRole');
        if (roleEl) roleEl.value = '';

        if (document.getElementById('createOfficerModal')) {
            openModal('createOfficerModal');
        } else {
            openModal('newOfficerModal');
        }
    }
    const openNewOfficerModal = openCreateOfficerModal;

    async function handleCreateOfficerSubmit(e) {
        e.preventDefault();
        const form = document.getElementById('createOfficerForm') || e.target;
        if (form) {
            form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        }

        const roleEl = document.getElementById('createOffRole') || document.getElementById('newOffRole');
        const firstNameEl = document.getElementById('createOffFirstName') || document.getElementById('newOffFirstName');
        const middleNameEl = document.getElementById('createOffMiddleName') || document.getElementById('newOffMiddleName');
        const lastNameEl = document.getElementById('createOffLastName') || document.getElementById('newOffLastName');
        const suffixEl = document.getElementById('createOffSuffix') || document.getElementById('newOffSuffix');
        const dobEl = document.getElementById('createOffDob') || document.getElementById('newOffDob');
        const ageEl = document.getElementById('createOffAge') || document.getElementById('newOffAge');
        const usernameEl = document.getElementById('createOffUsername') || document.getElementById('newOffUsername');
        const emailEl = document.getElementById('createOffEmail') || document.getElementById('newOffEmail');
        const passwordEl = document.getElementById('createOffPassword') || document.getElementById('newOffPassword');
        const confirmPasswordEl = document.getElementById('createOffConfirmPassword') || document.getElementById('newOffConfirmPassword');
        const phoneEl = document.getElementById('createOffPhone') || document.getElementById('newOffPhone');
        const addressEl = document.getElementById('createOffAddress') || document.getElementById('newOffAddress');

        let isValid = true;
        function setInvalid(element, msg) {
            if (!element) return;
            element.classList.add('is-invalid');
            const feedback = element.parentElement ? element.parentElement.querySelector('.invalid-feedback') : null;
            if (feedback && msg) feedback.textContent = msg;
            if (isValid) element.focus();
            isValid = false;
        }

        // 1. Mandatory Role check (PESO Admin or PESO Officer)
        const role = (roleEl?.value || '').trim();
        if (!role || !['PESO Admin', 'PESO Officer'].includes(role)) {
            setInvalid(roleEl, 'User role selection is mandatory (PESO Admin or PESO Officer).');
        }

        // 2. Personal Information validations
        const firstName = (firstNameEl?.value || '').trim();
        if (!firstName) {
            setInvalid(firstNameEl, 'First Name is required.');
        }

        const middleName = (middleNameEl?.value || '').trim();
        const lastName = (lastNameEl?.value || '').trim();
        if (!lastName) {
            setInvalid(lastNameEl, 'Last Name is required.');
        }

        const suffix = (suffixEl?.value || '').trim();
        const dob = dobEl?.value || '';
        if (!dob) {
            setInvalid(dobEl, 'Valid birthdate is required.');
        }

        const age = ageEl?.value || '';
        const address = (addressEl?.value || '').trim();
        if (!address) {
            setInvalid(addressEl, 'Address is required.');
        }

        // 3. Contact Number validation (PH based)
        const phone = (phoneEl?.value || '').trim();
        const phoneDigits = phone.replace(/[-\s]/g, '');
        const phoneRegex = /^(09|\+639)\d{9}$/;
        if (!phone) {
            setInvalid(phoneEl, 'Contact Number is required.');
        } else if (!phoneRegex.test(phoneDigits)) {
            setInvalid(phoneEl, 'Please enter a valid PH mobile number (e.g. 09123456789 or +639123456789).');
        }

        // 4. Email validation
        const email = (emailEl?.value || '').trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            setInvalid(emailEl, 'Email Address is required.');
        } else if (!emailRegex.test(email)) {
            setInvalid(emailEl, 'Please provide a valid email address (e.g. officer@gmail.com).');
        }

        // 5. Account Information validations
        const username = (usernameEl?.value || '').trim();
        if (!username) {
            setInvalid(usernameEl, 'Username is required.');
        } else if (username.length < 3) {
            setInvalid(usernameEl, 'Username must be at least 3 characters.');
        } else if (AdminStore.officers && AdminStore.officers.some(o => o.username && o.username.toLowerCase() === username.toLowerCase())) {
            setInvalid(usernameEl, `Username "${username}" is already assigned to another account.`);
        }

        const password = passwordEl?.value || '';
        const confirmPassword = confirmPasswordEl?.value || '';

        if (!password) {
            setInvalid(passwordEl, 'Password is required.');
        } else if (password.length < 8) {
            setInvalid(passwordEl, 'Password must be a minimum of 8 characters in length.');
        }

        if (!confirmPassword) {
            setInvalid(confirmPasswordEl, 'Confirm Password is required.');
        } else if (password !== confirmPassword) {
            setInvalid(confirmPasswordEl, 'Passwords do not match.');
        }

        if (!isValid) {
            return;
        }

        try {
            // Provision Supabase Auth User with metadata
            let authId = null;
            if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.auth) {
                try {
                    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                        email: email,
                        password: password,
                        options: {
                            data: {
                                first_name: firstName,
                                middle_name: middleName,
                                last_name: lastName,
                                suffix: suffix,
                                username: username,
                                role: role
                            }
                        }
                    });
                    if (!authError && authData?.user) {
                        authId = authData.user.id;
                    }
                } catch (e) {
                    console.warn('[SUPABASE AUTH WARN]', e);
                }
            }

            const newOffRecord = {
                id: Date.now(),
                auth_id: authId,
                username: username,
                email: email,
                first_name: firstName,
                middle_name: middleName || null,
                last_name: lastName,
                suffix: (suffix && suffix !== 'N/A') ? suffix : null,
                birth_date: dob || null,
                age: age ? parseInt(age, 10) : null,
                role: role,
                phone: phone,
                address: address,
                agency: 'PESO',
                department: 'PESO',
                status: 'Active',
                created_at: new Date().toISOString()
            };

            // Direct insert in staff_profiles
            if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
                try {
                    const res = await DataService.staffProfiles.create(newOffRecord);
                    if (res?.data?.id) newOffRecord.id = res.data.id;
                } catch (dbErr) {
                    console.warn('[STAFF DB INSERT]', dbErr);
                }
            }

            AdminStore.officers.unshift(newOffRecord);

            await logAdminAction('CREATE_OFFICER_ACCOUNT', 'staff_profile', newOffRecord.id, `Created new officer account: ${username} (${email}), Role: ${role}`);
            notify('Officer Created', `Officer account for ${firstName} ${lastName} created successfully as ${role}.`, 'success');
            
            if (document.getElementById('createOfficerModal')) {
                closeModal('createOfficerModal');
            } else {
                closeModal('newOfficerModal');
            }

            renderOfficersModule();
        } catch (err) {
            console.error('[OFFICER CREATE ERROR]', err);
            notify('Creation Failed', err.message || 'Could not create officer.', 'danger');
        }
    }

    function calcEditOfficerAge() {
        const dobInput = document.getElementById('editOffDob');
        const ageInput = document.getElementById('editOffAge');
        if (!dobInput || !ageInput) return;
        const dobVal = dobInput.value;
        if (!dobVal) {
            ageInput.value = '';
            return;
        }
        const today = new Date();
        const birthDate = new Date(dobVal);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        ageInput.value = isNaN(age) || age < 0 ? '' : age;
    }

    function openEditOfficerModal(id) {
        let officer = AdminStore.officers ? AdminStore.officers.find(o => o.id === id) : null;
        if (!officer && typeof officersList !== 'undefined' && Array.isArray(officersList)) {
            officer = officersList.find(o => o.id === id);
        }
        if (!officer) return;

        const form = document.getElementById('editOfficerForm');
        if (form) {
            form.reset();
            form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        }

        const setVal = (fieldId, val) => {
            const el = document.getElementById(fieldId);
            if (el) el.value = val || '';
        };

        setVal('editOffId', officer.id);
        setVal('editOffFirstName', officer.first_name || '');
        setVal('editOffMiddleName', officer.middle_name || '');
        setVal('editOffLastName', officer.last_name || '');
        setVal('editOffSuffix', officer.suffix || '');
        setVal('editOffDob', officer.birth_date || '');
        setVal('editOffAge', officer.age || '');
        setVal('editOffAddress', officer.address || '');
        setVal('editOffPhone', officer.phone || '');
        setVal('editOffEmail', officer.email || '');
        setVal('editOffUsername', officer.username || '');
        setVal('editOffRole', officer.role || 'PESO Officer');
        setVal('editOffPassword', '');
        setVal('editOffConfirmPassword', '');

        if (officer.birth_date && !officer.age) {
            calcEditOfficerAge();
        }

        openModal('editOfficerModal');
    }

    async function handleSaveOfficerUpdates(e) {
        e.preventDefault();
        const form = document.getElementById('editOfficerForm') || e.target;
        if (form) {
            form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        }

        const id = parseInt(document.getElementById('editOffId')?.value);
        const roleEl = document.getElementById('editOffRole');
        const firstNameEl = document.getElementById('editOffFirstName');
        const middleNameEl = document.getElementById('editOffMiddleName');
        const lastNameEl = document.getElementById('editOffLastName');
        const suffixEl = document.getElementById('editOffSuffix');
        const dobEl = document.getElementById('editOffDob');
        const ageEl = document.getElementById('editOffAge');
        const addressEl = document.getElementById('editOffAddress');
        const phoneEl = document.getElementById('editOffPhone');
        const emailEl = document.getElementById('editOffEmail');
        const usernameEl = document.getElementById('editOffUsername');
        const passwordEl = document.getElementById('editOffPassword');
        const confirmPasswordEl = document.getElementById('editOffConfirmPassword');

        let isValid = true;
        function setInvalid(element, msg) {
            if (!element) return;
            element.classList.add('is-invalid');
            const feedback = element.parentElement ? element.parentElement.querySelector('.invalid-feedback') : null;
            if (feedback && msg) feedback.textContent = msg;
            if (isValid) element.focus();
            isValid = false;
        }

        // 1. Mandatory Role check (PESO Admin or PESO Officer)
        const role = (roleEl?.value || '').trim();
        if (!role || !['PESO Admin', 'PESO Officer'].includes(role)) {
            setInvalid(roleEl, 'User role selection is mandatory (PESO Admin or PESO Officer).');
        }

        // 2. Personal Information validations
        const firstName = (firstNameEl?.value || '').trim();
        if (!firstName) {
            setInvalid(firstNameEl, 'First Name is required.');
        }

        const middleName = (middleNameEl?.value || '').trim();
        const lastName = (lastNameEl?.value || '').trim();
        if (!lastName) {
            setInvalid(lastNameEl, 'Last Name is required.');
        }

        const suffix = (suffixEl?.value || '').trim();
        const dob = dobEl?.value || '';
        if (!dob) {
            setInvalid(dobEl, 'Valid birthdate is required.');
        }

        const age = ageEl?.value || '';
        const address = (addressEl?.value || '').trim();
        if (!address) {
            setInvalid(addressEl, 'Address is required.');
        }

        // 3. Contact Number validation (PH based)
        const phone = (phoneEl?.value || '').trim();
        const phoneDigits = phone.replace(/[-\s]/g, '');
        const phoneRegex = /^(09|\+639)\d{9}$/;
        if (!phone) {
            setInvalid(phoneEl, 'Contact Number is required.');
        } else if (!phoneRegex.test(phoneDigits)) {
            setInvalid(phoneEl, 'Please enter a valid PH mobile number (e.g. 09123456789 or +639123456789).');
        }

        // 4. Email validation
        const email = (emailEl?.value || '').trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            setInvalid(emailEl, 'Email Address is required.');
        } else if (!emailRegex.test(email)) {
            setInvalid(emailEl, 'Please provide a valid email address (e.g. officer@gmail.com).');
        }

        // 5. Account Information validations
        const username = (usernameEl?.value || '').trim();
        if (!username) {
            setInvalid(usernameEl, 'Username is required.');
        } else if (username.length < 3) {
            setInvalid(usernameEl, 'Username must be at least 3 characters.');
        } else if (AdminStore.officers && AdminStore.officers.some(o => o.id !== id && o.username && o.username.toLowerCase() === username.toLowerCase())) {
            setInvalid(usernameEl, `Username "${username}" is already assigned to another account.`);
        }

        // 6. Optional Password Update validation
        const password = passwordEl?.value || '';
        const confirmPassword = confirmPasswordEl?.value || '';

        if (password) {
            if (password.length < 8) {
                setInvalid(passwordEl, 'Password must be a minimum of 8 characters in length.');
            }
            if (!confirmPassword) {
                setInvalid(confirmPasswordEl, 'Confirm Password is required when updating password.');
            } else if (password !== confirmPassword) {
                setInvalid(confirmPasswordEl, 'Passwords do not match.');
            }
        }

        if (!isValid) {
            return;
        }

        const updatePayload = {
            first_name: firstName,
            middle_name: middleName || null,
            last_name: lastName,
            suffix: (suffix && suffix !== 'N/A') ? suffix : null,
            birth_date: dob || null,
            age: age ? parseInt(age, 10) : null,
            address: address,
            phone: phone,
            email: email,
            username: username,
            role: role
        };

        try {
            if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
                await DataService.staffProfiles.update(id, updatePayload);
            }

            const offObj = AdminStore.officers.find(o => o.id === id);
            if (offObj) {
                Object.assign(offObj, updatePayload);
            }
            if (typeof officersList !== 'undefined' && Array.isArray(officersList)) {
                const offObj2 = officersList.find(o => o.id === id);
                if (offObj2) Object.assign(offObj2, updatePayload);
            }

            await logAdminAction('UPDATE_OFFICER_ACCOUNT', 'staff_profile', id, `Updated officer ${username} profile & role to [${role}]`);
            notify('Profile Updated', `Officer profile for "${firstName} ${lastName}" updated successfully.`, 'success');
            closeModal('editOfficerModal');
            await refreshAllData();
            renderOfficersModule();
        } catch (err) {
            notify('Update Failed', err.message || 'Could not update officer.', 'danger');
        }
    }

    async function toggleOfficerStatus(id, isActive) {
        // Restriction: Only two states allowed — Active and Deactivated
        const newStatus = isActive ? 'Active' : 'Deactivated';

        // Instant visual feedback on UI elements
        const labelEl = document.getElementById(`officerStatusLabel-${id}`);
        const switchEl = document.getElementById(`officerSwitch-${id}`);
        if (labelEl) {
            labelEl.textContent = newStatus;
            labelEl.className = `badge ${newStatus === 'Active' ? 'bg-success' : 'bg-danger'} px-2.5 py-1 text-white fw-semibold`;
        }
        if (switchEl) {
            switchEl.checked = (newStatus === 'Active');
        }

        // Update local memory models
        const officer = AdminStore.officers ? AdminStore.officers.find(o => o.id === id) : null;
        if (officer) {
            officer.status = newStatus;
        }
        if (typeof officersList !== 'undefined' && Array.isArray(officersList)) {
            const off2 = officersList.find(o => o.id === id);
            if (off2) off2.status = newStatus;
        }

        // Update counter cards immediately
        updateOfficerMetricCounters();

        try {
            if (typeof DataService !== 'undefined' && DataService.staffProfiles) {
                await DataService.staffProfiles.update(id, { status: newStatus });
            }
            await logAdminAction(isActive ? 'ACTIVATE_OFFICER' : 'DEACTIVATE_OFFICER', 'staff_profile', id, `Changed officer #${id} status to ${newStatus}`);
            notify('Status Updated', `Officer account set to ${newStatus}.`, isActive ? 'success' : 'warning');
        } catch (err) {
            console.warn('[OFFICER STATUS UPDATE FAILED]', err);
            // Rollback visual state on error
            const rollbackStatus = !isActive ? 'Active' : 'Deactivated';
            if (labelEl) {
                labelEl.textContent = rollbackStatus;
                labelEl.className = `badge ${rollbackStatus === 'Active' ? 'bg-success' : 'bg-danger'} px-2.5 py-1 text-white fw-semibold`;
            }
            if (switchEl) switchEl.checked = !isActive;
            if (officer) officer.status = rollbackStatus;
            updateOfficerMetricCounters();
            notify('Status Update Failed', err.message || 'Error changing status.', 'danger');
        }
    }

    // =========================================================================
    // 5. MODULE 3: PROGRAM MANAGEMENT & MULTI-LEVEL ASSIGNMENT (REQ012-023)
    // =========================================================================
    function renderProgramsCatalog() {
        const progs = AdminStore.programs;
        const search = (document.getElementById('programsSearchInput')?.value || '').toLowerCase();
        const statusF = document.getElementById('programsStatusFilter')?.value || 'ALL';

        const filtered = progs.filter(p => {
            const name = `${p.name || ''} ${p.code || ''} ${p.category || ''}`.toLowerCase();
            const matchesSearch = !search || name.includes(search);
            const matchesStatus = statusF === 'ALL' || (statusF === 'Active' && p.status === 'Active') || (statusF === 'Inactive' && p.status !== 'Active');
            return matchesSearch && matchesStatus;
        });

        const tbody = document.getElementById('programsCatalogTableBody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No programs found matching filters.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(p => {
            const isDeactivated = p.status !== 'Active';
            const enrCount = AdminStore.applications.filter(a => a.program_id === p.id).length;
            const pBudget = Number(p.budget) || 0;

            return `
                <tr>
                    <td>
                        <div class="fw-bold text-dark">${escapeHtml(p.name)}</div>
                        <span class="badge bg-dark-subtle text-dark font-monospace">${escapeHtml(p.code)}</span>
                    </td>
                    <td>
                        <span class="badge badge-category badge-livelihood">${escapeHtml(p.category || 'Livelihood')}</span>
                    </td>
                    <td>
                        <div class="fw-bold text-success">${formatCurrency(pBudget)}</div>
                    </td>
                    <td>
                        <span class="badge bg-light text-dark border"><i class="bi bi-people text-primary me-1"></i>${enrCount} enrolled</span>
                    </td>
                    <td>
                        <div class="text-truncate" style="max-width: 220px;" title="${escapeHtml(p.description || '')}">${escapeHtml(p.description || 'No description')}</div>
                    </td>
                    <td class="text-center">
                        <div class="form-check form-switch d-inline-block">
                            <input class="form-check-input" type="checkbox" role="switch" ${!isDeactivated ? 'checked' : ''} onchange="handleProgramStatusToggle(event, ${p.id})" aria-label="Toggle Status">
                        </div>
                    </td>
                    <td class="text-end">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-info" onclick="openProgramDetailsViewModal(${p.id})" title="View Details">
                                <i class="bi bi-eye"></i> Details
                            </button>
                            <button class="btn btn-outline-primary" onclick="drilldownToBatches(${p.id})" title="View Batches">
                                <i class="bi bi-layers"></i> Batches
                            </button>
                            <button class="btn btn-outline-warning" onclick="openProgramEditModal(${p.id})" title="Edit">
                                <i class="bi bi-pencil"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function filterProgramsCatalog() {
        renderProgramsCatalog();
    }

    function showProgramsLevel1() {
        document.getElementById('programsLevel1View')?.classList.remove('d-none');
        document.getElementById('programsLevel2BatchesView')?.classList.add('d-none');
        document.getElementById('programsLevel3BeneficiariesView')?.classList.add('d-none');
        document.getElementById('bcDrilldownBatchItem')?.classList.add('d-none');
        document.getElementById('bcDrilldownBenItem')?.classList.add('d-none');
    }

    function showProgramsLevel2() {
        document.getElementById('programsLevel1View')?.classList.add('d-none');
        document.getElementById('programsLevel2BatchesView')?.classList.remove('d-none');
        document.getElementById('programsLevel3BeneficiariesView')?.classList.add('d-none');
        document.getElementById('bcDrilldownBatchItem')?.classList.remove('d-none');
        document.getElementById('bcDrilldownBenItem')?.classList.add('d-none');
    }

    function drilldownToBatches(progId) {
        const prog = AdminStore.programs.find(p => p.id === progId);
        if (!prog) return;
        AdminStore.activeDrilldown.program = prog;

        document.getElementById('drilldownProgCodeBadge').textContent = prog.code;
        document.getElementById('drilldownProgTitle').textContent = `Batches for: ${prog.name}`;
        document.getElementById('bcDrilldownBatchName').textContent = `${prog.code} Batches`;

        const progBatches = AdminStore.batches.filter(b => b.program_id === prog.id || b.program_code === prog.code);
        const tbody = document.getElementById('drilldownBatchesTableBody');
        if (tbody) {
            if (progBatches.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No batches created for this program yet.</td></tr>`;
            } else {
                tbody.innerHTML = progBatches.map(b => {
                    const count = AdminStore.applications.filter(a => a.batch_id === b.id).length;
                    return `
                        <tr>
                            <td class="fw-bold text-dark">${escapeHtml(b.name || `Batch #${b.id}`)}</td>
                            <td><span class="badge bg-light text-dark border">${b.capacity || 50} Slots</span></td>
                            <td><span class="badge bg-primary-subtle text-primary">${count} Applicants</span></td>
                            <td>${formatDate(b.created_at)}</td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-primary" onclick="drilldownToBeneficiaries(${b.id}, '${escapeHtml(b.name || 'Batch')}')">
                                    Inspect Beneficiaries <i class="bi bi-chevron-right ms-1"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        showProgramsLevel2();
    }

    function drilldownToBeneficiaries(batchId, batchName) {
        AdminStore.activeDrilldown.batch = batchId;
        document.getElementById('drilldownBatchBadge').textContent = `BATCH #${batchId}`;
        document.getElementById('drilldownBatchTitle').textContent = `Enrolled Applicants in ${batchName}`;
        document.getElementById('bcDrilldownBenName').textContent = batchName;

        const batchApps = AdminStore.applications.filter(a => a.batch_id === batchId);
        const tbody = document.getElementById('drilldownBeneficiariesTableBody');
        if (tbody) {
            if (batchApps.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No applicants assigned to this batch yet.</td></tr>`;
            } else {
                tbody.innerHTML = batchApps.map(a => {
                    const ben = a.beneficiary || {};
                    const fullName = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || 'Applicant';
                    return `
                        <tr>
                            <td class="fw-bold text-dark">${escapeHtml(fullName)}</td>
                            <td><span class="font-monospace badge bg-light text-dark border">${escapeHtml(a.beneficiary_qr)}</span></td>
                            <td><span class="masked-phone">${escapeHtml(maskContactNumber(ben.phone))}</span></td>
                            <td>${formatDate(a.date_applied || a.created_at)}</td>
                            <td class="text-center"><span class="badge bg-info text-white">${escapeHtml(a.status)}</span></td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-outline-info" onclick="inspectBeneficiaryProfile('${a.beneficiary_qr}')">
                                    <i class="bi bi-person-vcard"></i> Full Profile
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        document.getElementById('programsLevel1View')?.classList.add('d-none');
        document.getElementById('programsLevel2BatchesView')?.classList.add('d-none');
        document.getElementById('programsLevel3BeneficiariesView')?.classList.remove('d-none');
        document.getElementById('bcDrilldownBatchItem')?.classList.remove('d-none');
        document.getElementById('bcDrilldownBenItem')?.classList.remove('d-none');
    }

    function inspectBeneficiaryProfile(qrCode) {
        const ben = AdminStore.beneficiaries.find(b => b.qr_code === qrCode) || AdminStore.applications.find(a => a.beneficiary_qr === qrCode)?.beneficiary;
        if (!ben) {
            notify('Profile Notice', 'Beneficiary record not found in active dataset.', 'warning');
            return;
        }

        const fullName = `${ben.first_name || ''} ${ben.middle_name || ''} ${ben.last_name || ''} ${ben.suffix || ''}`.trim();
        document.getElementById('bpFullName').textContent = fullName || 'Beneficiary';
        document.getElementById('bpQrCode').textContent = ben.qr_code || qrCode;
        document.getElementById('bpContact').textContent = maskContactNumber(ben.phone);
        document.getElementById('bpEmail').textContent = ben.email || 'N/A';
        document.getElementById('bpAddress').textContent = ben.address || 'City of Koronadal';
        document.getElementById('bpAgeSex').textContent = `${ben.age || 'N/A'} yrs / ${ben.sex || 'N/A'}`;
        document.getElementById('bpCivilStatus').textContent = ben.marital_status || 'Single';
        document.getElementById('bpIdType').textContent = ben.id_type || 'Government Valid ID';

        openModal('beneficiaryProfileModal');
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

    // Program CRUD Form Handlers
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

        const dtInput = document.getElementById('newProgCreatedDateTime');
        if (dtInput) {
            dtInput.value = formatSystemDateTime(new Date());
        }

        const categorySelect = document.getElementById('newProgCategory');
        if (categorySelect) {
            categorySelect.value = '';
        }

        logAdminAction('OPEN_CREATE_PROGRAM_FORM', 'program', null, 'Admin opened Create New Livelihood Program form');
        openModal('createProgramModal');
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
        const budgetEl = document.getElementById('newProgBudget');
        const descEl = document.getElementById('newProgDesc');

        let isValid = true;
        function setInvalid(element, msg) {
            if (!element) return;
            element.classList.add('is-invalid');
            const feedback = element.parentElement ? element.parentElement.querySelector('.invalid-feedback') : null;
            if (feedback && msg) feedback.textContent = msg;
            if (isValid) element.focus();
            isValid = false;
        }

        const name = (nameEl?.value || '').trim();
        if (!name) {
            setInvalid(nameEl, 'Program Name is required.');
        }

        const code = (codeEl?.value || '').trim().toUpperCase();
        if (!code) {
            setInvalid(codeEl, 'Program Code is required.');
        } else if (AdminStore.programs && AdminStore.programs.some(p => p.code && p.code.toUpperCase() === code)) {
            setInvalid(codeEl, `Program Code "${code}" is already in use.`);
        }

        const category = (categoryEl?.value || '').trim();
        if (!category) {
            setInvalid(categoryEl, 'Category selection is required.');
        }

        const desc = (descEl?.value || '').trim();
        if (!desc) {
            setInvalid(descEl, 'Program Description is required.');
        }

        const budgetVal = parseCurrencyToNumber(budgetEl?.value);
        if (!budgetEl?.value.trim() || isNaN(budgetVal) || budgetVal < 0.01) {
            setInvalid(budgetEl, 'Budget must be a valid positive amount (minimum ₱0.01).');
        } else if (budgetEl) {
            budgetEl.value = formatRawCurrencyString(budgetVal, true);
        }

        if (!isValid) {
            return;
        }

        const budget = budgetVal;
        const now = new Date();
        const formattedDt = formatSystemDateTime(now);

        const newProgramPayload = {
            code: code,
            name: name,
            category: category,
            budget: budget,
            description: desc,
            agency: 'PESO',
            status: 'Active',
            created_at: now.toISOString()
        };

        try {
            if (typeof DataService !== 'undefined' && DataService.programs) {
                const res = await DataService.programs.create(newProgramPayload);
                if (res && res.data) {
                    newProgramPayload.id = res.data.id;
                }
            }

            await logAdminAction('CREATE_PROGRAM', 'program', null, `Created program ${code} (${name}) with budget ${formatCurrency(budget)} on ${formattedDt}`);
            notify('Program Added', `Program successfully added on ${formattedDt}.`, 'success');
            if (window.showSystemNotification) {
                window.showSystemNotification({
                    title: 'Program Added',
                    message: `Program successfully added on ${formattedDt}.`,
                    type: 'success'
                });
            }

            closeModal('createProgramModal');
            await refreshAllData();
            renderProgramsCatalog();
        } catch (err) {
            notify('Program Creation Failed', err.message || 'Error creating program.', 'danger');
        }
    }

    function openProgramDetailsViewModal(progId) {
        let prog = AdminStore.programs.find(p => p && (p.id === progId || p.code === progId));
        if (!prog) {
            prog = CANONICAL_PESO_PROGRAM_CATALOG.find(c => c.id === progId || c.code === progId);
        }
        if (!prog) return;

        const canonical = CANONICAL_PESO_PROGRAM_CATALOG.find(c => c.code === prog.code || c.name === prog.name) || {};
        const totalSlots = Number(prog.slots_target || prog.total_slots || canonical.slots_target || 100);
        const filledSlots = Number(prog.slots_filled || prog.beneficiaries_count || canonical.slots_filled || 0);
        const availableSlots = Math.max(0, totalSlots - filledSlots);
        const percentSlots = totalSlots > 0 ? Math.min(100, Math.round((filledSlots / totalSlots) * 100)) : 0;
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
        setText('viewProgBudget', formatCurrency(budgetAmount));

        // 3. Program Slots Counter & Progress (Requirement 2)
        setText('viewProgSlotsBadge', `${filledSlots} / ${totalSlots} Filled`);
        setText('viewProgSlotsCount', `${filledSlots} / ${totalSlots}`);
        setText('viewProgAvailableSlots', `${availableSlots} available slots remaining (${percentSlots}% filled)`);
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

        // Sync with Scheduled Activities from AdminStore.schedules
        const matchingSchedules = (AdminStore.schedules || []).filter(s => s.program_id === prog.id || s.program_code === prog.code || s.program_title === prog.name || (s.title && s.title.includes(prog.code)));
        const schedContainer = document.getElementById('viewProgSchedSessionsList');
        if (schedContainer) {
            if (matchingSchedules.length > 0) {
                schedContainer.innerHTML = matchingSchedules.map(sch => `
                    <div class="d-flex align-items-center justify-content-between p-2 bg-light rounded-3 mb-1.5 border">
                        <div class="d-flex align-items-center gap-2">
                            <i class="bi bi-calendar3 text-primary"></i>
                            <div>
                                <strong class="text-dark d-block">${escapeHtml(sch.title || sch.activity_name || 'Program Activity')}</strong>
                                <small class="text-muted">${formatDate(sch.scheduled_date || sch.date)} • ${sch.scheduled_time || sch.time || '09:00 AM'}</small>
                            </div>
                        </div>
                        <span class="badge bg-primary-subtle text-primary">${escapeHtml(sch.status || 'Scheduled')}</span>
                    </div>
                `).join('');
            } else {
                schedContainer.innerHTML = `
                    <div class="d-flex align-items-center gap-2 p-2 bg-light rounded-3">
                        <i class="bi bi-calendar-check text-primary"></i>
                        <div>
                            <span class="fw-semibold text-dark">Program Orientation & Intake Screening</span>
                            <small class="text-muted d-block">Coordinated via PESO Scheduling & Training Desk</small>
                        </div>
                    </div>
                `;
            }
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
            const matchingLogs = (AdminStore.auditLogs || []).filter(l => l.entity_id === String(prog.id) || (l.details && (l.details.includes(prog.code) || l.details.includes(prog.name))));
            const createdDt = prog.created_at ? formatDateTime(prog.created_at) : 'Jan 1, 2026, 08:00 AM';

            let rows = `
                <tr>
                    <td>
                        <span class="badge bg-success-subtle text-success font-monospace">INITIAL_ALLOCATION</span>
                        <div class="small text-dark mt-0.5">Budget ${formatCurrency(budgetAmount)} recorded</div>
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

            if (matchingLogs.length > 0) {
                rows += matchingLogs.slice(0, 3).map(log => `
                    <tr>
                        <td>
                            <span class="badge bg-secondary-subtle text-dark font-monospace">${escapeHtml(log.action || 'UPDATE')}</span>
                            <div class="small text-dark mt-0.5 text-truncate" style="max-width: 180px;" title="${escapeHtml(log.details || '')}">${escapeHtml(log.details || 'Program record accessed')}</div>
                        </td>
                        <td>
                            <small class="text-muted font-monospace d-block">${formatDateTime(log.created_at)}</small>
                            <small class="text-secondary">${escapeHtml(log.user_email || log.admin_name || 'Admin')}</small>
                        </td>
                    </tr>
                `).join('');
            }

            auditTbody.innerHTML = rows;
        }

        logAdminAction('VIEW_PROGRAM_DETAILS', 'program', prog.id, `Opened read-only program details reference for ${prog.code} (${prog.name})`);
        openModal('programDetailsViewModal');
    }

    function openProgramEditModal(progId) {
        const prog = AdminStore.programs ? AdminStore.programs.find(p => p.id === progId) : null;
        if (!prog) return;

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
        setVal('editProgName', prog.name || '');
        setVal('editProgCode', prog.code || '');
        const budgetInput = document.getElementById('editProgBudget');
        if (budgetInput) {
            attachCurrencyInputAutoFormat(budgetInput);
            budgetInput.value = formatRawCurrencyString(prog.budget || 0, true);
        }
        setVal('editProgCategory', prog.category || 'Livelihood Programs');
        setVal('editProgDesc', prog.description || '');

        const dtInput = document.getElementById('editProgUpdatedDateTime');
        if (dtInput) {
            dtInput.value = formatSystemDateTime(new Date());
        }

        openModal('programEditModal');
    }

    async function handleSaveProgramUpdates(e) {
        e.preventDefault();
        const form = document.getElementById('editProgramForm') || e.target;
        if (form) {
            form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        }

        const id = parseInt(document.getElementById('editProgId')?.value);
        const nameEl = document.getElementById('editProgName');
        const categoryEl = document.getElementById('editProgCategory');
        const budgetEl = document.getElementById('editProgBudget');
        const descEl = document.getElementById('editProgDesc');

        let isValid = true;
        function setInvalid(element, msg) {
            if (!element) return;
            element.classList.add('is-invalid');
            const feedback = element.parentElement ? element.parentElement.querySelector('.invalid-feedback') : null;
            if (feedback && msg) feedback.textContent = msg;
            if (isValid) element.focus();
            isValid = false;
        }

        const name = (nameEl?.value || '').trim();
        if (!name) {
            setInvalid(nameEl, 'Program Name is required.');
        }

        const category = (categoryEl?.value || '').trim();
        if (!category) {
            setInvalid(categoryEl, 'Category selection is required.');
        }

        const desc = (descEl?.value || '').trim();
        if (!desc) {
            setInvalid(descEl, 'Program Description is required.');
        }

        const budgetVal = parseCurrencyToNumber(budgetEl?.value);
        if (!budgetEl?.value.trim() || isNaN(budgetVal) || budgetVal < 0.01) {
            setInvalid(budgetEl, 'Budget must be a valid positive amount (minimum ₱0.01).');
        } else if (budgetEl) {
            budgetEl.value = formatRawCurrencyString(budgetVal, true);
        }

        if (!isValid) {
            return;
        }

        const budget = budgetVal;
        const now = new Date();
        const formattedDt = formatSystemDateTime(now);

        const updatePayload = {
            name: name,
            budget: budget,
            category: category,
            description: desc,
            updated_at: now.toISOString()
        };

        try {
            if (typeof DataService !== 'undefined' && DataService.programs) {
                await DataService.programs.update(id, updatePayload);
            }

            const progObj = AdminStore.programs.find(p => p.id === id);
            if (progObj) {
                Object.assign(progObj, updatePayload);
            }

            await logAdminAction('UPDATE_PROGRAM', 'program', id, `Updated program details for #${id} (${name}) on ${formattedDt}`);
            notify('Program Updated', `Program successfully updated on ${formattedDt}.`, 'success');
            if (window.showSystemNotification) {
                window.showSystemNotification({
                    title: 'Program Updated',
                    message: `Program successfully updated on ${formattedDt}.`,
                    type: 'success'
                });
            }

            closeModal('programEditModal');
            await refreshAllData();
            renderProgramsCatalog();
        } catch (err) {
            notify('Update Failed', err.message || 'Error updating program.', 'danger');
        }
    }

    // Program Deactivation Safeguard Restriction (Rule Check)
    async function handleProgramStatusToggle(event, progId) {
        const checkbox = event.target;
        const isTurningActive = checkbox.checked;
        const prog = AdminStore.programs.find(p => p.id === progId);

        if (!isTurningActive) {
            // Check if active beneficiaries exist in this program
            const activeApps = AdminStore.applications.filter(a => a.program_id === progId && ['Pending', 'Under Review', 'Officer Approved', 'Approved'].includes(a.status));
            if (activeApps.length > 0) {
                event.preventDefault();
                checkbox.checked = true; // revert switch
                document.getElementById('restrictionWarningText').textContent = `Cannot deactivate program "${prog?.name || progId}". This program currently has ${activeApps.length} active applicant(s) undergoing verification. All assignments must be resolved first.`;
                openModal('restrictionWarningModal');
                return;
            }
        }

        const newStatus = isTurningActive ? 'Active' : 'Inactive';
        try {
            if (typeof DataService !== 'undefined' && DataService.programs) {
                await DataService.programs.toggleStatus(progId, newStatus);
            }
            await logAdminAction(isTurningActive ? 'ACTIVATE_PROGRAM' : 'DEACTIVATE_PROGRAM', 'program', progId, `Set program #${progId} status to ${newStatus}`);
            notify('Status Changed', `Program set to ${newStatus}.`, 'success');
            await refreshAllData();
            renderProgramsCatalog();
        } catch (err) {
            checkbox.checked = !isTurningActive;
            notify('Status Update Failed', err.message || 'Could not change program status.', 'danger');
        }
    }

    // =========================================================================
    // 6. MODULE 4: APPLICATION EVALUATION OVERSIGHT (REQ024 – REQ029)
    // =========================================================================
    function renderEvaluationModule() {
        const apps = AdminStore.applications;
        const progs = AdminStore.programs;
        const search = (document.getElementById('evalSearchInput')?.value || '').toLowerCase();
        const progFilter = document.getElementById('evalProgramFilter')?.value || 'ALL';
        const statusFilter = document.getElementById('evalStatusFilter')?.value || 'ALL';

        // Populate Program Dropdown Filter
        const progSelect = document.getElementById('evalProgramFilter');
        if (progSelect && progSelect.options.length <= 1) {
            progs.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                progSelect.appendChild(opt);
            });
        }

        const filtered = apps.filter(a => {
            const ben = a.beneficiary || {};
            const searchStr = `${a.application_number || ''} ${ben.first_name || ''} ${ben.last_name || ''} ${ben.address || ''}`.toLowerCase();
            const matchesSearch = !search || searchStr.includes(search);
            const matchesProg = progFilter === 'ALL' || String(a.program_id) === String(progFilter);
            let matchesStatus = true;
            if (statusFilter === 'Pending') matchesStatus = ['Pending', 'Pending Requirements', 'Under Review'].includes(a.status);
            else if (statusFilter === 'Officer Approved') matchesStatus = a.status === 'Officer Approved';
            else if (statusFilter === 'Approved') matchesStatus = a.status === 'Approved';
            else if (statusFilter === 'Denied') matchesStatus = ['Denied', 'Rejected'].includes(a.status);

            return matchesSearch && matchesProg && matchesStatus;
        });

        const tbody = document.getElementById('evaluationQueueTableBody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No applications found matching evaluation criteria.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(a => {
            const ben = a.beneficiary || {};
            const fullName = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || 'Applicant';
            const progName = a.program?.name || `Program #${a.program_id}`;
            const dateStr = formatDate(a.date_applied || a.created_at);
            
            let statusBadge = `<span class="badge bg-warning text-dark">${escapeHtml(a.status)}</span>`;
            if (a.status === 'Approved' || a.status === 'Completed') statusBadge = `<span class="badge bg-success">${escapeHtml(a.status)}</span>`;
            else if (a.status === 'Officer Approved') statusBadge = `<span class="badge bg-info text-white">Officer Approved</span>`;
            else if (a.status === 'Denied' || a.status === 'Rejected') statusBadge = `<span class="badge bg-danger">${escapeHtml(a.status)}</span>`;

            return `
                <tr>
                    <td>
                        <div class="fw-bold text-dark">${escapeHtml(fullName)}</div>
                        <span class="font-monospace text-muted small">${escapeHtml(a.application_number)}</span>
                    </td>
                    <td>
                        <div class="text-primary fw-semibold">${escapeHtml(progName)}</div>
                    </td>
                    <td>
                        <small class="text-muted">${dateStr}</small>
                    </td>
                    <td>
                        <div class="small text-secondary">${escapeHtml(a.officer_notes || 'Pending initial assessment')}</div>
                    </td>
                    <td class="text-center">${statusBadge}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-primary fw-semibold" onclick="inspectApplicationForEvaluation(${a.id})">
                            <i class="bi bi-search"></i> Inspect
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Update Evaluation Metrics
        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setTxt('statEvalTotalApps', apps.length);
        setTxt('statEvalPendingApps', apps.filter(a => ['Pending', 'Pending Requirements', 'Under Review'].includes(a.status)).length);
        setTxt('statEvalApprovedApps', apps.filter(a => a.status === 'Approved').length);
        setTxt('statEvalDeniedApps', apps.filter(a => a.status === 'Denied' || a.status === 'Rejected').length);
    }

    function filterEvaluationQueue() {
        renderEvaluationModule();
    }

    function inspectApplicationForEvaluation(appId) {
        const app = AdminStore.applications.find(a => a.id === appId);
        if (!app) return;

        const ben = app.beneficiary || {};
        const fullName = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || 'Applicant';

        document.getElementById('evalTargetAppId').value = app.id;
        document.getElementById('evalTargetBeneficiaryQr').value = app.beneficiary_qr || '';
        document.getElementById('evalModalAppNumber').textContent = app.application_number || `APP-${app.id}`;
        document.getElementById('evalApplicantName').textContent = fullName;
        document.getElementById('evalProgramName').textContent = app.program?.name || `Program #${app.program_id}`;
        document.getElementById('evalApplicantPhone').textContent = maskContactNumber(ben.phone);
        document.getElementById('evalDateApplied').textContent = formatDate(app.date_applied || app.created_at);
        document.getElementById('evalOfficerNotesDisplay').textContent = app.officer_notes || 'No notes left by assigned officer.';
        document.getElementById('evalApprovedAmount').value = app.amount_approved || app.amount_requested || 5000.00;

        // Render submitted docs preview links
        const docsContainer = document.getElementById('evalDocsContainer');
        if (docsContainer) {
            let docs = app.documents_json;
            if (!Array.isArray(docs) || docs.length === 0) {
                docs = [
                    { name: 'Barangay Certificate of Indigency', status: 'Verified' },
                    { name: 'Valid Government Photo ID', status: 'Verified' },
                    { name: 'Livelihood Assistance Application Form', status: 'Submitted' }
                ];
            }
            docsContainer.innerHTML = docs.map(d => `
                <div class="d-flex justify-content-between align-items-center py-1 border-bottom small">
                    <span><i class="bi bi-file-earmark-pdf text-danger me-1"></i> ${escapeHtml(d.name || d.type || 'Submitted Document')}</span>
                    <span class="badge bg-success-subtle text-success">${escapeHtml(d.status || 'Verified')}</span>
                </div>
            `).join('');
        }

        openModal('inspectEvaluationModal');
    }

    async function handleEvaluationDecisionSubmit(e) {
        e.preventDefault();
        const appId = parseInt(document.getElementById('evalTargetAppId').value);
        const decision = document.getElementById('evalAdminDecision').value;
        const approvedAmount = parseFloat(document.getElementById('evalApprovedAmount').value) || 0;
        const notes = document.getElementById('evalAdminNotes').value.trim();
        const benQr = document.getElementById('evalTargetBeneficiaryQr').value;

        try {
            if (typeof DataService !== 'undefined' && DataService.applications) {
                if (decision === 'Approved') {
                    await DataService.applications.adminApprove(appId, {
                        amount_approved: approvedAmount,
                        notes: notes,
                        admin_username: 'PESO Admin'
                    });
                } else if (decision === 'Denied') {
                    await DataService.applications.adminDeny(appId, {
                        reason: notes,
                        admin_username: 'PESO Admin'
                    });
                } else {
                    await DataService.applications.update(appId, {
                        status: 'Under Review',
                        admin_notes: notes
                    });
                }
            }

            await logAdminAction(`ADMIN_DECISION_${decision.toUpperCase()}`, 'application', appId, `Admin set application #${appId} to [${decision}]. Notes: ${notes}`);
            notify('Decision Submitted', `Application evaluated as [${decision}].`, 'success');
            closeModal('inspectEvaluationModal');
            await refreshAllData();
            renderEvaluationModule();
        } catch (err) {
            notify('Evaluation Failed', err.message || 'Error processing evaluation.', 'danger');
        }
    }

    // =========================================================================
    // 7. MODULE 5: SCHEDULING & TRAINING RECORDS (REQ030 – REQ041)
    // =========================================================================
    function renderSchedulingModule() {
        renderCalendarGrid();
        renderUpcomingAgenda();
        renderSchedulesRosterTable();
        renderTrainingRecords();

        const scheds = AdminStore.schedules;
        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setTxt('schedStatTotalSlots', scheds.length);
        setTxt('schedStatActiveSlots', scheds.filter(s => s.status === 'Scheduled').length);
        setTxt('schedStatCompletedSlots', scheds.filter(s => s.status === 'Completed').length);
        setTxt('schedStatCancelledSlots', scheds.filter(s => s.status === 'Cancelled').length);
        setTxt('activitiesCountBadge', `${scheds.filter(s => s.status === 'Scheduled').length} Upcoming`);
    }

    function setSchedViewMode(mode) {
        const cal = document.getElementById('schedCalendarViewContainer');
        const list = document.getElementById('schedListViewContainer');
        const btnCal = document.getElementById('schedBtnViewCalendar');
        const btnList = document.getElementById('schedBtnViewList');

        if (mode === 'calendar') {
            cal?.classList.remove('d-none');
            list?.classList.add('d-none');
            btnCal?.classList.add('active');
            btnList?.classList.remove('active');
        } else {
            cal?.classList.add('d-none');
            list?.classList.remove('d-none');
            btnCal?.classList.remove('active');
            btnList?.classList.add('active');
        }
    }

    function navigateCalendarMonth(delta) {
        AdminStore.calendarDate.setMonth(AdminStore.calendarDate.getMonth() + delta);
        renderCalendarGrid();
    }

    function jumpToCalendarToday() {
        AdminStore.calendarDate = new Date();
        renderCalendarGrid();
    }

    function renderCalendarGrid() {
        const grid = document.getElementById('calendarGridBody');
        const monthDisplay = document.getElementById('calendarMonthYearDisplay');
        if (!grid) return;

        const year = AdminStore.calendarDate.getFullYear();
        const month = AdminStore.calendarDate.getMonth();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        
        if (monthDisplay) monthDisplay.textContent = `${monthNames[month]} ${year}`;

        const firstDayIndex = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();
        const prevMonthTotalDays = new Date(year, month, 0).getDate();

        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

        let cellsHtml = '';

        // Previous Month Padding
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const dayNum = prevMonthTotalDays - i;
            cellsHtml += `<div class="calendar-day-cell other-month"><div class="calendar-day-number">${dayNum}</div></div>`;
        }

        // Current Month Days
        for (let day = 1; day <= totalDays; day++) {
            const isToday = isCurrentMonth && today.getDate() === day;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const daySchedules = AdminStore.schedules.filter(s => s.interview_date === dateStr);

            let chipsHtml = daySchedules.map(s => {
                let statusClass = 'status-chip-blue';
                if (s.status === 'Completed') statusClass = 'status-chip-gray';
                else if (s.status === 'Cancelled') statusClass = 'status-chip-red';
                return `<div class="event-chip ${statusClass}" title="${escapeHtml(s.venue_location)}">${escapeHtml(s.interview_time)}: ${escapeHtml(s.program?.code || 'Slot')}</div>`;
            }).join('');

            cellsHtml += `
                <div class="calendar-day-cell ${isToday ? 'today' : ''}" onclick="selectCalendarDate('${dateStr}')">
                    <div class="calendar-day-top">
                        <span class="calendar-day-number">${day}</span>
                        <button class="day-add-btn" onclick="event.stopPropagation(); quickAddScheduleOnDate('${dateStr}')" title="Add Slot"><i class="bi bi-plus"></i></button>
                    </div>
                    <div>${chipsHtml}</div>
                </div>
            `;
        }

        grid.innerHTML = cellsHtml;
    }

    function selectCalendarDate(dateStr) {
        const agenda = document.getElementById('scheduledAgendaList');
        const dayScheds = AdminStore.schedules.filter(s => s.interview_date === dateStr);
        if (agenda && dayScheds.length > 0) {
            agenda.innerHTML = `<div class="fw-bold mb-2 text-primary">Schedules on ${formatDate(dateStr)}:</div>` + dayScheds.map(s => renderAgendaItemHtml(s)).join('');
        }
    }

    function renderUpcomingAgenda() {
        const agenda = document.getElementById('scheduledAgendaList');
        if (!agenda) return;
        const upcoming = AdminStore.schedules.filter(s => s.status === 'Scheduled').slice(0, 8);

        if (upcoming.length === 0) {
            agenda.innerHTML = '<div class="text-center py-4 text-muted small">No upcoming scheduled activities.</div>';
            return;
        }

        agenda.innerHTML = upcoming.map(s => renderAgendaItemHtml(s)).join('');
    }

    function renderAgendaItemHtml(s) {
        const officerName = s.officer ? `${s.officer.first_name || ''} ${s.officer.last_name || ''}`.trim() : 'Officer';
        const isCancelled = s.status === 'Cancelled';
        return `
            <div class="activity-card-item ${isCancelled ? 'status-border-red' : 'status-border-blue'}">
                <div class="d-flex justify-content-between align-items-start mb-1">
                    <span class="fw-bold text-dark small">${escapeHtml(s.program?.name || 'Program Session')}</span>
                    <span class="badge ${isCancelled ? 'bg-danger' : 'bg-primary'}">${escapeHtml(s.status)}</span>
                </div>
                <div class="text-muted small mb-1"><i class="bi bi-calendar-event me-1"></i>${formatDate(s.interview_date)} • <span class="time-badge">${escapeHtml(s.interview_time)}</span></div>
                <div class="text-muted small mb-2"><i class="bi bi-geo-alt me-1"></i>${escapeHtml(s.venue_location)}</div>
                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-secondary"><i class="bi bi-person me-1"></i>${escapeHtml(officerName)}</small>
                    ${!isCancelled ? `<button class="btn btn-sm btn-outline-danger py-0 px-2" style="font-size:0.75rem;" onclick="cancelScheduleSlot(${s.id})">Cancel</button>` : '<span class="text-danger small font-monospace">Cancelled</span>'}
                </div>
            </div>
        `;
    }

    function renderSchedulesRosterTable() {
        const tbody = document.getElementById('schedulesRosterTableBody');
        if (!tbody) return;
        const scheds = AdminStore.schedules;

        if (scheds.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No schedule records found.</td></tr>';
            return;
        }

        tbody.innerHTML = scheds.map(s => {
            const officerName = s.officer ? `${s.officer.first_name || ''} ${s.officer.last_name || ''}`.trim() : 'Officer';
            return `
                <tr>
                    <td>
                        <div class="fw-bold text-dark">${formatDate(s.interview_date)}</div>
                        <span class="time-badge">${escapeHtml(s.interview_time)}</span>
                    </td>
                    <td><span class="badge bg-light text-dark border">${escapeHtml(s.program?.code || 'PROG')}</span></td>
                    <td>${escapeHtml(s.beneficiary_qr || 'General Session')}</td>
                    <td>${escapeHtml(officerName)}</td>
                    <td><small class="text-muted">${escapeHtml(s.venue_location)}</small></td>
                    <td class="text-center"><span class="badge ${s.status === 'Cancelled' ? 'bg-danger' : 'bg-success'}">${escapeHtml(s.status)}</span></td>
                    <td class="text-end">
                        ${s.status !== 'Cancelled' ? `<button class="btn btn-sm btn-outline-danger" onclick="cancelScheduleSlot(${s.id})">Cancel</button>` : '<span class="text-muted small">N/A</span>'}
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderTrainingRecords() {
        const tbody = document.getElementById('trainingRecordsTableBody');
        if (!tbody) return;
        const apps = AdminStore.applications.filter(a => a.status === 'Approved' || a.status === 'Completed');

        if (apps.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No eligible training records.</td></tr>';
            return;
        }

        tbody.innerHTML = apps.slice(0, 10).map(a => {
            const ben = a.beneficiary || {};
            const fullName = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || 'Beneficiary';
            const progName = a.program?.name || 'Training Program';
            return `
                <tr>
                    <td class="fw-bold text-dark">${escapeHtml(progName)}</td>
                    <td>${escapeHtml(fullName)}</td>
                    <td><span class="masked-phone">${escapeHtml(maskContactNumber(ben.phone))}</span></td>
                    <td><span class="badge bg-success-subtle text-success">Completed (Present)</span></td>
                    <td>${formatDate(a.date_applied || a.created_at)}</td>
                    <td class="text-center"><span class="badge bg-warning text-dark">Certificate Eligible</span></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-success" onclick="issueCertificate('${a.beneficiary_qr}', '${escapeHtml(fullName)}')">
                            <i class="bi bi-award"></i> Issue
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function autoPullCertificateRecipients() {
        const eligible = AdminStore.applications.filter(a => a.status === 'Approved' || a.status === 'Completed');
        notify('Auto-Pull Successful', `Auto-pulled ${eligible.length} qualified recipients from completed training records for certificate distribution.`, 'success');
        renderTrainingRecords();
    }

    function issueCertificate(qrCode, name) {
        notify('Certificate Issued', `Issued Certificate of Completion for ${name} (${qrCode}).`, 'success');
        logAdminAction('ISSUE_CERTIFICATE', 'beneficiary', null, `Issued training certificate to ${name} (${qrCode})`);
    }

    function quickAddScheduleOnDate(dateStr) {
        openCreateScheduleSlotModal();
        const dateInput = document.getElementById('schedSlotDate');
        if (dateInput) dateInput.value = dateStr;
    }

    function openCreateScheduleSlotModal() {
        document.getElementById('createSchedSlotForm')?.reset();
        
        // Block past dates (Past Date Restriction)
        const todayStr = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('schedSlotDate');
        if (dateInput) {
            dateInput.min = todayStr;
            dateInput.value = todayStr;
        }

        // Populate Programs
        const progSelect = document.getElementById('schedProgSelect');
        if (progSelect) {
            progSelect.innerHTML = AdminStore.programs.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${p.code})</option>`).join('');
        }

        // Populate Officers
        const offSelect = document.getElementById('schedOfficerSelect');
        if (offSelect) {
            offSelect.innerHTML = AdminStore.officers.map(o => `<option value="${o.id}">${escapeHtml(o.first_name || '')} ${escapeHtml(o.last_name || '')} (@${escapeHtml(o.username)})</option>`).join('');
        }

        openModal('createActivityModal');
    }

    async function handleCreateScheduleSlotSubmit(e) {
        e.preventDefault();
        const progId = parseInt(document.getElementById('schedProgSelect').value);
        const officerId = parseInt(document.getElementById('schedOfficerSelect').value);
        const date = document.getElementById('schedSlotDate').value;
        const timeSlot = document.getElementById('schedTimeSlot').value;
        const venue = document.getElementById('schedVenueLocation').value.trim();
        const remarks = document.getElementById('schedRemarks').value.trim();

        // 1. Past Date Validation Check
        const todayStr = new Date().toISOString().split('T')[0];
        if (date < todayStr) {
            document.getElementById('schedSafeguardAlert').classList.remove('d-none');
            document.getElementById('schedSafeguardAlertMsg').textContent = 'Past Date Restriction: System blocks scheduling activities on past dates.';
            return;
        }

        // 2. Conflict Validation Check (prevent overlapping officer or venue)
        const conflict = AdminStore.schedules.find(s => s.interview_date === date && s.interview_time === timeSlot && (s.officer_id === officerId || s.venue_location.toLowerCase() === venue.toLowerCase()) && s.status !== 'Cancelled');
        if (conflict) {
            document.getElementById('schedSafeguardAlert').classList.remove('d-none');
            document.getElementById('schedSafeguardAlertMsg').textContent = `Conflict Validation Warning: Slot overlaps with existing schedule on ${date} at ${timeSlot}. Choose another time or venue.`;
            return;
        }

        try {
            if (typeof DataService !== 'undefined' && DataService.interviews) {
                await DataService.interviews.create({
                    program_id: progId,
                    officer_id: officerId,
                    interview_date: date,
                    interview_time: timeSlot,
                    venue_location: venue,
                    remarks: remarks,
                    status: 'Scheduled',
                    beneficiary_qr: 'QR-BEN-GENERAL'
                });
            }

            await logAdminAction('CREATE_SCHEDULE_SLOT', 'interview_schedule', null, `Created schedule on ${date} ${timeSlot} at ${venue}`);
            notify('Schedule Created', 'Program slot recorded successfully.', 'success');
            closeModal('createActivityModal');
            await refreshAllData();
            renderSchedulingModule();
        } catch (err) {
            notify('Creation Failed', err.message || 'Error creating schedule.', 'danger');
        }
    }

    async function cancelScheduleSlot(schedId) {
        if (!confirm('Are you sure you want to cancel this scheduled activity? Cancelled slots remain recorded with red badge.')) return;

        try {
            if (typeof DataService !== 'undefined' && DataService.interviews) {
                await DataService.interviews.cancel(schedId, { reason: 'Cancelled by PESO Admin' });
            }

            await logAdminAction('CANCEL_SCHEDULE_SLOT', 'interview_schedule', schedId, `Cancelled schedule #${schedId}`);
            notify('Slot Cancelled', 'Activity slot marked as Cancelled.', 'warning');
            await refreshAllData();
            renderSchedulingModule();
        } catch (err) {
            notify('Cancellation Failed', err.message || 'Error cancelling schedule.', 'danger');
        }
    }

    // =========================================================================
    // 8. MODULE 6: FUND ALLOCATION & DISTRIBUTION (REQ034-036, REQ042-046)
    // =========================================================================
    function renderFundsModule() {
        const progs = AdminStore.programs;
        const assist = AdminStore.approvedAssistance;
        let hasOverflow = false;

        const tbody = document.getElementById('programFundsTableBody');
        if (tbody) {
            tbody.innerHTML = progs.map(p => {
                const budget = Number(p.budget) || 0;
                const disbursed = assist.filter(a => a.program_id === p.id).reduce((s, i) => s + (Number(String(i.quantity_amount).replace(/[^0-9.]/g, '')) || 0), 0);
                const remaining = Math.max(0, budget - disbursed);
                const pct = budget > 0 ? Math.round((disbursed / budget) * 100) : 0;
                if (pct >= 90) hasOverflow = true;

                return `
                    <tr>
                        <td>
                            <div class="fw-bold text-dark">${escapeHtml(p.name)}</div>
                            <span class="badge bg-light text-dark border font-monospace">${escapeHtml(p.code)}</span>
                        </td>
                        <td class="fw-bold text-dark">${formatCurrency(budget)}</td>
                        <td class="fw-bold text-success">${formatCurrency(disbursed)}</td>
                        <td class="fw-bold text-primary">${formatCurrency(remaining)}</td>
                        <td class="text-center">
                            <div class="d-flex align-items-center gap-2 justify-content-center">
                                <div class="progress flex-grow-1" style="height: 8px; width: 80px;">
                                    <div class="progress-bar ${pct > 90 ? 'bg-danger' : (pct > 70 ? 'bg-warning' : 'bg-success')}" style="width: ${pct}%;"></div>
                                </div>
                                <span class="small font-monospace">${pct}%</span>
                            </div>
                        </td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-primary" onclick="quickAdjustFund(${p.id}, ${budget})">
                                Adjust
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Show Overflow Alert Box if any program is >90%
        const alertBox = document.getElementById('fundOverflowAlertBox');
        if (alertBox) {
            if (hasOverflow) alertBox.classList.remove('d-none');
            else alertBox.classList.add('d-none');
        }

        // Render Distribution Logs
        const distTbody = document.getElementById('distributionLogsTableBody');
        if (distTbody) {
            if (assist.length === 0) {
                distTbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No distribution records recorded yet.</td></tr>';
            } else {
                distTbody.innerHTML = assist.map(a => {
                    const ben = a.beneficiary || {};
                    const fullName = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || a.beneficiary_qr;
                    const officerName = a.officer ? `${a.officer.first_name || ''} ${a.officer.last_name || ''}`.trim() : 'Officer';
                    return `
                        <tr>
                            <td class="fw-bold text-dark">${escapeHtml(fullName)}</td>
                            <td><span class="badge bg-light text-dark font-monospace border">${escapeHtml(a.program?.code || 'PROG')}</span></td>
                            <td><span class="badge badge-category badge-livelihood">${escapeHtml(a.assistance_type)}</span></td>
                            <td class="fw-bold text-success">${escapeHtml(a.quantity_amount)}</td>
                            <td>${formatDate(a.approval_date || a.created_at)}</td>
                            <td>${escapeHtml(officerName)}</td>
                            <td><small class="text-muted">${escapeHtml(a.conditions || 'Approved by PESO')}</small></td>
                        </tr>
                    `;
                }).join('');
            }
        }
    }

    function openFundAllocationModal() {
        const progSelect = document.getElementById('fundAllocProgSelect');
        if (progSelect) {
            progSelect.innerHTML = AdminStore.programs.map(p => `<option value="${p.id}" data-budget="${p.budget}">${escapeHtml(p.name)} (${p.code}) - Current: ${formatCurrency(p.budget)}</option>`).join('');
            handleFundProgSelectionChange();
        }
        const fundInput = document.getElementById('fundAllocNewBudget');
        if (fundInput) {
            attachCurrencyInputAutoFormat(fundInput);
        }
        document.getElementById('fundAllocForm')?.reset();
        if (fundInput) fundInput.classList.remove('is-invalid');
        openModal('fundAllocationModal');
    }

    function handleFundProgSelectionChange() {
        const progSelect = document.getElementById('fundAllocProgSelect');
        const selOpt = progSelect?.selectedOptions[0];
        if (selOpt) {
            const currentBudget = selOpt.getAttribute('data-budget') || 0;
            const input = document.getElementById('fundAllocNewBudget');
            if (input) {
                attachCurrencyInputAutoFormat(input);
                input.value = formatRawCurrencyString(currentBudget, true);
                input.classList.remove('is-invalid');
            }
        }
    }

    function quickAdjustFund(progId, currentBudget) {
        openFundAllocationModal();
        const progSelect = document.getElementById('fundAllocProgSelect');
        if (progSelect) {
            progSelect.value = progId;
            handleFundProgSelectionChange();
        }
    }

    async function handleFundAllocationSubmit(e) {
        e.preventDefault();
        const progId = parseInt(document.getElementById('fundAllocProgSelect').value);
        const budgetInput = document.getElementById('fundAllocNewBudget');
        const newBudget = parseCurrencyToNumber(budgetInput?.value);
        const justification = document.getElementById('fundAllocJustification').value.trim();

        if (!budgetInput?.value.trim() || isNaN(newBudget) || newBudget < 0.01) {
            if (budgetInput) {
                budgetInput.classList.add('is-invalid');
                budgetInput.focus();
            }
            return;
        }

        if (budgetInput) {
            budgetInput.value = formatRawCurrencyString(newBudget, true);
            budgetInput.classList.remove('is-invalid');
        }

        try {
            if (typeof DataService !== 'undefined' && DataService.programs) {
                await DataService.programs.update(progId, { budget: newBudget });
            }

            await logAdminAction('ADJUST_PROGRAM_BUDGET', 'program', progId, `Adjusted budget for program #${progId} to ${formatCurrency(newBudget)}. Reason: ${justification}`);
            notify('Fund Allocation Saved', 'Program budget adjusted and logged to audit trail.', 'success');
            closeModal('fundAllocationModal');
            await refreshAllData();
            renderFundsModule();
        } catch (err) {
            notify('Adjustment Failed', err.message || 'Error updating budget.', 'danger');
        }
    }

    function exportDistributionLogsCsv() {
        const rows = [
            ['Beneficiary QR', 'Beneficiary Name', 'Program Code', 'Assistance Type', 'Amount/Quantity', 'Release Date', 'Conditions']
        ];
        AdminStore.approvedAssistance.forEach(a => {
            const ben = a.beneficiary || {};
            const name = `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || a.beneficiary_qr;
            rows.push([
                a.beneficiary_qr,
                name,
                a.program?.code || '',
                a.assistance_type,
                a.quantity_amount,
                a.approval_date || '',
                a.conditions || ''
            ]);
        });
        downloadCsvFile(rows, `PESO_Assistance_Distribution_Logs_${new Date().toISOString().substring(0, 10)}.csv`);
    }

    // =========================================================================
    // 9. MODULE 7: NOTIFICATION HUB (REQ047 – REQ048)
    // =========================================================================
    function renderNotificationsModule() {
        const notifs = AdminStore.notifications;
        const search = (document.getElementById('notifSearchInput')?.value || '').toLowerCase();

        const filtered = notifs.filter(n => {
            const str = `${n.title || ''} ${n.message || ''} ${n.beneficiary_qr || ''} ${n.staff_user_id || ''}`.toLowerCase();
            return !search || str.includes(search);
        });

        const tbody = document.getElementById('notificationsHistoryTableBody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No dispatched notification logs found.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(n => {
            const target = n.beneficiary_qr ? `<span class="badge bg-light text-dark font-monospace border">${escapeHtml(n.beneficiary_qr)}</span>` : `<span class="badge bg-primary-subtle text-primary">Staff #${n.staff_user_id}</span>`;
            return `
                <tr>
                    <td>${target}</td>
                    <td class="fw-bold text-dark">${escapeHtml(n.title)}</td>
                    <td><div class="text-secondary small" style="max-width: 320px;">${escapeHtml(n.message)}</div></td>
                    <td><small class="text-muted">${formatDateTime(n.created_at)}</small></td>
                    <td class="text-center"><span class="badge ${n.is_read ? 'bg-secondary' : 'bg-success'}">${n.is_read ? 'Read' : 'Delivered'}</span></td>
                </tr>
            `;
        }).join('');
    }

    function filterNotificationLogs() {
        renderNotificationsModule();
    }

    function openComposeNotificationModal() {
        document.getElementById('composeNotifForm')?.reset();
        handleNotifRecipientChange();
        openModal('composeNotificationModal');
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

    async function handleComposeNotificationSubmit(e) {
        e.preventDefault();
        const type = document.getElementById('notifRecipientType').value;
        const specificTarget = document.getElementById('notifSpecificRecipient').value.trim();
        const title = document.getElementById('notifTitleInput').value.trim();
        const msg = document.getElementById('notifMessageInput').value.trim();

        try {
            if (type === 'all_beneficiaries') {
                // Broadcast to all unique beneficiaries
                const bens = AdminStore.beneficiaries;
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
                await supabaseClient.from('notifications').insert({
                    beneficiary_qr: specificTarget || 'QR-BEN-GENERAL',
                    title: title,
                    message: msg,
                    is_read: false
                });
            } else {
                await supabaseClient.from('notifications').insert({
                    staff_user_id: parseInt(specificTarget) || 1,
                    title: title,
                    message: msg,
                    is_read: false
                });
            }

            await logAdminAction('DISPATCH_NOTIFICATION', 'notification', null, `Dispatched [${title}] to [${type}]`);
            notify('Notification Dispatched', 'Message sent and logged to Supabase.', 'success');
            closeModal('composeNotificationModal');
            await refreshAllData();
            renderNotificationsModule();
        } catch (err) {
            notify('Dispatch Failed', err.message || 'Error sending notification.', 'danger');
        }
    }

    // =========================================================================
    // 10. MODULE 8: SYSTEM REPORTS ENGINE (REQ049 – REQ059)
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
            titleHeader.textContent = '1. Application Management & Barangay Geographic Breakdown';
            thead.innerHTML = `
                <tr>
                    <th>App Number</th>
                    <th>Beneficiary Name</th>
                    <th>Barangay / Address</th>
                    <th>Program Code</th>
                    <th>Date Applied</th>
                    <th>Status</th>
                </tr>
            `;
            const filtered = AdminStore.applications.filter(a => {
                const d = a.created_at || a.date_applied || '';
                return d >= start && d <= (end + 'T23:59:59');
            });
            currentReportDataset = filtered.map(a => {
                const ben = a.beneficiary || {};
                return {
                    appNumber: a.application_number,
                    name: `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || 'Applicant',
                    address: ben.address || 'Barangay Poblacion',
                    prog: a.program?.code || 'PESO',
                    date: a.date_applied || a.created_at,
                    status: a.status
                };
            });
            tbody.innerHTML = currentReportDataset.map(r => `
                <tr>
                    <td class="font-monospace">${escapeHtml(r.appNumber)}</td>
                    <td class="fw-bold text-dark">${escapeHtml(r.name)}</td>
                    <td>${escapeHtml(r.address)}</td>
                    <td><span class="badge bg-light text-dark border">${escapeHtml(r.prog)}</span></td>
                    <td>${formatDate(r.date)}</td>
                    <td><span class="badge bg-primary-subtle text-primary">${escapeHtml(r.status)}</span></td>
                </tr>
            `).join('') || '<tr><td colspan="6" class="text-center py-4 text-muted">No records found for specified date range.</td></tr>';
            if (countBadge) countBadge.textContent = `${currentReportDataset.length} Records`;

        } else if (type === 'scheduling') {
            titleHeader.textContent = '2. Attendance & Scheduling Participation Report';
            thead.innerHTML = `
                <tr>
                    <th>Date & Time</th>
                    <th>Program</th>
                    <th>Assigned Officer</th>
                    <th>Venue</th>
                    <th>Attendance Status</th>
                </tr>
            `;
            const filtered = AdminStore.schedules.filter(s => s.interview_date >= start && s.interview_date <= end);
            currentReportDataset = filtered.map(s => ({
                datetime: `${s.interview_date} ${s.interview_time}`,
                prog: s.program?.name || 'Program',
                officer: s.officer ? `${s.officer.first_name || ''} ${s.officer.last_name || ''}`.trim() : 'Officer',
                venue: s.venue_location,
                attendance: s.attendance_status || s.status
            }));
            tbody.innerHTML = currentReportDataset.map(r => `
                <tr>
                    <td class="fw-bold text-dark">${escapeHtml(r.datetime)}</td>
                    <td>${escapeHtml(r.prog)}</td>
                    <td>${escapeHtml(r.officer)}</td>
                    <td>${escapeHtml(r.venue)}</td>
                    <td><span class="badge bg-success-subtle text-success">${escapeHtml(r.attendance)}</span></td>
                </tr>
            `).join('') || '<tr><td colspan="5" class="text-center py-4 text-muted">No records found.</td></tr>';
            if (countBadge) countBadge.textContent = `${currentReportDataset.length} Records`;

        } else if (type === 'distribution') {
            titleHeader.textContent = '3. Assistance & Livelihood Distribution Report';
            thead.innerHTML = `
                <tr>
                    <th>Beneficiary QR</th>
                    <th>Program</th>
                    <th>Assistance Type</th>
                    <th>Amount / Items</th>
                    <th>Release Date</th>
                </tr>
            `;
            const filtered = AdminStore.approvedAssistance.filter(a => {
                const d = a.approval_date || a.created_at || '';
                return d >= start && d <= (end + 'T23:59:59');
            });
            currentReportDataset = filtered.map(a => ({
                qr: a.beneficiary_qr,
                prog: a.program?.code || 'PESO',
                type: a.assistance_type,
                amount: a.quantity_amount,
                date: a.approval_date || a.created_at
            }));
            tbody.innerHTML = currentReportDataset.map(r => `
                <tr>
                    <td class="font-monospace">${escapeHtml(r.qr)}</td>
                    <td><span class="badge bg-light text-dark border">${escapeHtml(r.prog)}</span></td>
                    <td>${escapeHtml(r.type)}</td>
                    <td class="fw-bold text-success">${escapeHtml(r.amount)}</td>
                    <td>${formatDate(r.date)}</td>
                </tr>
            `).join('') || '<tr><td colspan="5" class="text-center py-4 text-muted">No records found.</td></tr>';
            if (countBadge) countBadge.textContent = `${currentReportDataset.length} Records`;

        } else {
            titleHeader.textContent = '4. Fund Utilization & Resource Usage Report';
            thead.innerHTML = `
                <tr>
                    <th>Program Name</th>
                    <th>Allocated Budget</th>
                    <th>Total Disbursed</th>
                    <th>Remaining Balance</th>
                    <th>Status</th>
                </tr>
            `;
            currentReportDataset = AdminStore.programs.map(p => {
                const b = Number(p.budget) || 0;
                const d = AdminStore.approvedAssistance.filter(a => a.program_id === p.id).reduce((s, i) => s + (Number(String(i.quantity_amount).replace(/[^0-9.]/g, '')) || 0), 0);
                return {
                    name: p.name,
                    budget: formatCurrency(b),
                    disbursed: formatCurrency(d),
                    remaining: formatCurrency(Math.max(0, b - d)),
                    status: p.status
                };
            });
            tbody.innerHTML = currentReportDataset.map(r => `
                <tr>
                    <td class="fw-bold text-dark">${escapeHtml(r.name)}</td>
                    <td>${r.budget}</td>
                    <td class="text-success fw-bold">${r.disbursed}</td>
                    <td class="text-primary fw-bold">${r.remaining}</td>
                    <td><span class="badge bg-success">${escapeHtml(r.status)}</span></td>
                </tr>
            `).join('');
            if (countBadge) countBadge.textContent = `${currentReportDataset.length} Programs`;
        }
    }

    function exportActiveReportCSV() {
        if (!currentReportDataset || currentReportDataset.length === 0) {
            notify('Export Notice', 'No data available to export.', 'warning');
            return;
        }

        const headers = Object.keys(currentReportDataset[0]);
        const rows = [headers];
        currentReportDataset.forEach(obj => {
            rows.push(headers.map(h => String(obj[h] || '').replace(/,/g, ' ')));
        });

        const type = document.getElementById('reportTypeSelect')?.value || 'report';
        downloadCsvFile(rows, `PESO_${type.toUpperCase()}_REPORT_${new Date().toISOString().substring(0, 10)}.csv`);
    }

    function printActiveReportPDF() {
        window.print();
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
        const archProgs = AdminStore.programs.filter(p => p.status !== 'Active');
        const archOfficers = AdminStore.officers.filter(o => o.status !== 'Active');

        const tbody = document.getElementById('archiveTableBody');
        if (!tbody) return;

        if (archProgs.length === 0 && archOfficers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Archive box is clean — no deactivated items.</td></tr>';
            return;
        }

        let html = '';
        archProgs.forEach(p => {
            html += `
                <tr>
                    <td>
                        <div class="fw-bold text-secondary text-decoration-line-through">${escapeHtml(p.name)}</div>
                        <span class="badge bg-light text-dark font-monospace border">${escapeHtml(p.code)}</span>
                    </td>
                    <td><span class="badge bg-warning-subtle text-dark">Deactivated Program</span></td>
                    <td>Budget: ${formatCurrency(p.budget)}</td>
                    <td>${formatDate(p.updated_at || p.created_at)}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-success me-1" onclick="restoreArchivedProgram(${p.id})">
                            <i class="bi bi-arrow-counterclockwise"></i> Restore Active
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="permanentlyDeleteProgram(${p.id})">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });

        archOfficers.forEach(o => {
            const name = `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.username;
            html += `
                <tr>
                    <td>
                        <div class="fw-bold text-secondary text-decoration-line-through">${escapeHtml(name)}</div>
                        <small class="text-muted font-monospace">@${escapeHtml(o.username)}</small>
                    </td>
                    <td><span class="badge bg-danger-subtle text-danger">Deactivated Officer</span></td>
                    <td>Role: ${escapeHtml(o.role)}</td>
                    <td>${formatDate(o.updated_at || o.created_at)}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-success me-1" onclick="toggleOfficerStatus(${o.id}, true)">
                            <i class="bi bi-arrow-counterclockwise"></i> Restore Active
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

    // =========================================================================
    // 12. AUDIT TRAIL MODAL VIEWER
    // =========================================================================
    function showAuditLogsModal() {
        const tbody = document.getElementById('auditLogsModalTableBody');
        if (!tbody) return;

        const audits = AdminStore.auditLogs;
        if (audits.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No audit logs recorded yet.</td></tr>';
        } else {
            tbody.innerHTML = audits.map(l => {
                const actor = l.staff ? `${l.staff.first_name || ''} ${l.staff.last_name || ''}`.trim() : (l.staff_user_id ? `Staff #${l.staff_user_id}` : (l.beneficiary_qr || 'System'));
                return `
                    <tr>
                        <td class="font-monospace">${formatDateTime(l.created_at)}</td>
                        <td class="fw-bold">${escapeHtml(actor)}</td>
                        <td><span class="badge bg-primary-subtle text-primary">${escapeHtml(l.action)}</span></td>
                        <td>${escapeHtml(l.entity_type || 'General')}</td>
                        <td><small class="text-secondary">${escapeHtml(l.details || '')}</small></td>
                    </tr>
                `;
            }).join('');
        }

        openModal('auditLogsModal');
    }

    // Ordinance Reference Modal
    function showOrdinanceReferenceModal() {
        const tbody = document.getElementById('ordinanceBreakdownTableBody');
        if (tbody) {
            tbody.innerHTML = AdminStore.programs.map(p => `
                <tr>
                    <td class="font-monospace">${escapeHtml(p.code)}</td>
                    <td class="fw-semibold text-dark">${escapeHtml(p.name)}</td>
                    <td>${escapeHtml(p.category || 'Livelihood')}</td>
                    <td class="text-end fw-bold text-success">${formatCurrency(p.budget)}</td>
                </tr>
            `).join('');
        }
        openModal('ordinanceReferenceModal');
    }

    function openUploadOrdinanceModal() {
        document.getElementById('uploadOrdinanceForm')?.reset();
        openModal('uploadOrdinanceModal');
    }

    async function handleUploadOrdinance(e) {
        e.preventDefault();
        const title = document.getElementById('ordTitle').value.trim();
        const year = document.getElementById('ordYear').value.trim();
        const total = parseFloat(document.getElementById('ordTotal').value) || 0;
        const fileInput = document.getElementById('ordFile');

        if (!fileInput.files || fileInput.files.length === 0) {
            notify('Validation Error', 'Please select an ordinance document file.', 'warning');
            return;
        }

        const file = fileInput.files[0];
        const validExts = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
        const hasValidExt = validExts.some(ext => file.name.toLowerCase().endsWith(ext));
        if (!hasValidExt) {
            notify('Invalid File Type', 'Only official PDF, Word, or Image ordinance documents are allowed.', 'warning');
            return;
        }

        await logAdminAction('UPLOAD_ORDINANCE', 'ordinance', null, `Uploaded official ordinance [${title}] for BY ${year} (Total: ${formatCurrency(total)}) - File: ${file.name}`);
        notify('Ordinance Uploaded', `Ordinance "${title}" recorded successfully.`, 'success');
        closeModal('uploadOrdinanceModal');
    }

    // Realtime Synchronization Listener
    function initRealtimeSync() {
        try {
            if (typeof DataService !== 'undefined' && DataService.realtime) {
                DataService.realtime.subscribeMulti(['programs', 'applications', 'staff_profiles', 'interview_schedules', 'approved_assistance', 'notifications'], (payload) => {
                    console.log('[PESO Admin Realtime Event Received]:', payload.table, payload.eventType);
                    refreshAllData().then(() => renderActiveTab());
                });
            }
        } catch (e) {
            console.warn('[PESO Admin] Realtime listener note:', e);
        }
    }

    // Dark Mode Toggle
    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('peso_admin_dark_mode', isDark ? 'true' : 'false');
    }

    // Apply Saved Theme
    if (localStorage.getItem('peso_admin_dark_mode') === 'true') {
        document.body.classList.add('dark-mode');
    }

    async function logoutAdmin() {
        if (confirm('Are you sure you want to sign out from the PESO Administrator Portal?')) {
            try {
                if (typeof SessionManager !== 'undefined' && SessionManager.logout) {
                    await SessionManager.logout('admin_login.html');
                    return;
                }
                if (typeof AuthGuard !== 'undefined' && AuthGuard.logout) {
                    await AuthGuard.logout('admin_login.html');
                    return;
                }
                if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.auth) {
                    await supabaseClient.auth.signOut();
                }
            } catch (e) {
                console.warn('[PESO_ADMIN] Logout note:', e);
            }
            try { sessionStorage.clear(); } catch (e) {}
            window.location.href = 'admin_login.html';
        }
    }

    // Export functions to window namespace for inline event handlers
    window.switchTab = switchTab;
    window.toggleDarkMode = toggleDarkMode;
    window.logoutAdmin = logoutAdmin;
    window.showAuditLogsModal = showAuditLogsModal;
    window.showOrdinanceReferenceModal = showOrdinanceReferenceModal;
    window.openUploadOrdinanceModal = openUploadOrdinanceModal;
    window.handleUploadOrdinance = handleUploadOrdinance;
    window.refreshDashboardMetrics = () => refreshAllData().then(() => renderDashboardOverview());

    // Module 2
    window.openCreateOfficerModal = openCreateOfficerModal;
    window.openNewOfficerModal = openCreateOfficerModal;
    window.calcCreateOfficerAge = calcCreateOfficerAge;
    window.calcNewOfficerAge = calcCreateOfficerAge;
    window.calcEditOfficerAge = calcEditOfficerAge;
    window.handleCreateOfficerSubmit = handleCreateOfficerSubmit;
    window.openEditOfficerModal = openEditOfficerModal;
    window.handleSaveOfficerUpdates = handleSaveOfficerUpdates;
    window.toggleOfficerStatus = toggleOfficerStatus;
    window.filterOfficersList = filterOfficersList;
    window.exportOfficersCsv = () => {
        const rows = [['Username', 'Name', 'Email', 'Role', 'Phone', 'Status', 'Created']];
        AdminStore.officers.forEach(o => rows.push([o.username, `${o.first_name || ''} ${o.last_name || ''}`, o.email, o.role, maskContactNumber(o.phone), o.status, o.created_at || '']));
        downloadCsvFile(rows, `PESO_Officers_Roster_${new Date().toISOString().substring(0, 10)}.csv`);
    };

    // Module 3
    window.openCreateProgramModal = openCreateProgramModal;
    window.handleCreateProgramSubmit = handleCreateProgramSubmit;
    window.openProgramDetailsViewModal = openProgramDetailsViewModal;
    window.openProgramEditModal = openProgramEditModal;
    window.handleSaveProgramUpdates = handleSaveProgramUpdates;
    window.handleProgramStatusToggle = handleProgramStatusToggle;
    window.filterProgramsCatalog = filterProgramsCatalog;
    window.showProgramsLevel1 = showProgramsLevel1;
    window.showProgramsLevel2 = showProgramsLevel2;
    window.drilldownToBatches = drilldownToBatches;
    window.drilldownToBeneficiaries = drilldownToBeneficiaries;
    window.inspectBeneficiaryProfile = inspectBeneficiaryProfile;

    // Module 4
    window.filterEvaluationQueue = filterEvaluationQueue;
    window.inspectApplicationForEvaluation = inspectApplicationForEvaluation;
    window.handleEvaluationDecisionSubmit = handleEvaluationDecisionSubmit;

    // Module 5
    window.setSchedViewMode = setSchedViewMode;
    window.navigateCalendarMonth = navigateCalendarMonth;
    window.jumpToCalendarToday = jumpToCalendarToday;
    window.selectCalendarDate = selectCalendarDate;
    window.quickAddScheduleOnDate = quickAddScheduleOnDate;
    window.openCreateScheduleSlotModal = openCreateScheduleSlotModal;
    window.handleCreateScheduleSlotSubmit = handleCreateScheduleSlotSubmit;
    window.cancelScheduleSlot = cancelScheduleSlot;
    window.autoPullCertificateRecipients = autoPullCertificateRecipients;
    window.issueCertificate = issueCertificate;

    // Module 6
    window.openFundAllocationModal = openFundAllocationModal;
    window.handleFundProgSelectionChange = handleFundProgSelectionChange;
    window.quickAdjustFund = quickAdjustFund;
    window.handleFundAllocationSubmit = handleFundAllocationSubmit;
    window.exportDistributionLogsCsv = exportDistributionLogsCsv;

    // Module 7
    window.filterNotificationLogs = filterNotificationLogs;
    window.openComposeNotificationModal = openComposeNotificationModal;
    window.handleNotifRecipientChange = handleNotifRecipientChange;
    window.handleComposeNotificationSubmit = handleComposeNotificationSubmit;

    // Module 8
    window.generateReportData = generateReportData;
    window.exportActiveReportCSV = exportActiveReportCSV;
    window.printActiveReportPDF = printActiveReportPDF;

    // Module 9
    window.restoreArchivedProgram = restoreArchivedProgram;
    window.permanentlyDeleteProgram = permanentlyDeleteProgram;
    window.permanentlyDeleteOfficer = permanentlyDeleteOfficer;

    // Diagnostics tool
    window.PesoAdmin = {
        version: '3.0.0',
        portal: 'PESO Administrator Portal',
        getStore: () => AdminStore,
        refresh: refreshAllData,
        diagnose: function () {
            console.group('[PESO Admin Diagnostics]');
            console.log('%c PESO Admin Live Suite v3.0.0 ', 'background: #0284C7; color: white; font-weight: bold;');
            console.log('Programs in cache:', AdminStore.programs.length);
            console.log('Applications in cache:', AdminStore.applications.length);
            console.log('Officers in cache:', AdminStore.officers.length);
            console.log('Schedules in cache:', AdminStore.schedules.length);
            console.log('Disbursements in cache:', AdminStore.approvedAssistance.length);
            console.groupEnd();
            return { healthy: true, store: AdminStore };
        }
    };

    // Auto-boot on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', async () => {
        initAllCurrencyInputs();
        try {
            await refreshAllData();
            renderDashboardOverview();
        } catch (e) {
            console.warn('[PESO Admin] Initial boot notice:', e);
        }
    });

})(window, document);

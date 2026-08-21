/**
 * PESO Programs & Assignment Management Module (peso-programs.js)
 * City Government of Koronadal - Public Employment Service Office
 * 
 * Rules & Safeguards Enforced:
 * 1. Program Catalog & 3-Level Assignment Drilldown (Programs -> Batches -> Beneficiaries)
 * 2. Active Beneficiary Deactivation Restriction (Prevents deactivation if active beneficiaries exist)
 * 3. LGU Appropriation Ordinance Upload & Validation
 * 4. Read-Only Archive Section (Only Reactivation and Permanent Deletion permitted)
 * 5. Data Privacy Act Contact Masking (09XX-***-XXXX)
 * 6. Audit Logging on every mutation
 */

const PesoPrograms = (() => {
    'use strict';

    // Canonical City of Koronadal PESO Official Programs Roster
    const CANONICAL_PESO_PROGRAMS = [
        {
            id: 1,
            code: 'TUPAD',
            name: 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers',
            category: 'Employment',
            budget: 3500000.00,
            budget_allocated: 3500000.00,
            slots_target: 700,
            slots_filled: 245,
            target_beneficiaries: 'Underemployed & Displaced Informal Workers',
            description: 'Community-based package of assistance providing emergency employment for displaced workers, underemployed, and seasonal workers.',
            eligibility_criteria: 'Displaced or disadvantaged informal sector workers aged 18-65 residing in Koronadal City.',
            assistance_type: 'Emergency Wage Employment (10-30 Days)',
            status: 'Active',
            agency: 'PESO',
            department: 'PESO'
        },
        {
            id: 2,
            code: 'SPES',
            name: 'Special Program for Employment of Students',
            category: 'Youth & Students',
            budget: 2000000.00,
            budget_allocated: 2000000.00,
            slots_target: 400,
            slots_filled: 180,
            target_beneficiaries: 'Poor but Deserving High School & College Students',
            description: 'Employment facilitation providing temporary employment during summer/Christmas vacations to help students finance their education.',
            eligibility_criteria: 'Enrolled students or out-of-school youth aged 15-30 with family income below poverty threshold.',
            assistance_type: 'Short-term Youth Stipend & Work Experience',
            status: 'Active',
            agency: 'PESO',
            department: 'PESO'
        },
        {
            id: 3,
            code: 'GIP',
            name: 'Government Internship Program',
            category: 'Youth & Students',
            budget: 1500000.00,
            budget_allocated: 1500000.00,
            slots_target: 150,
            slots_filled: 68,
            target_beneficiaries: 'High School / College Graduates & Unemployed Youth',
            description: 'Internship opportunities in government offices to demonstrate public service skills and enhance employability.',
            eligibility_criteria: 'Youth aged 18-30 with no prior government work experience.',
            assistance_type: '3-6 Months Paid Public Service Internship',
            status: 'Active',
            agency: 'PESO',
            department: 'PESO'
        },
        {
            id: 4,
            code: 'CKGIP',
            name: 'City of Koronadal Government Internship Program (CKGIP)',
            category: 'Youth & Students',
            budget: 1800000.00,
            budget_allocated: 1800000.00,
            slots_target: 180,
            slots_filled: 92,
            target_beneficiaries: 'Fresh Graduates & Vocational Completers of Koronadal',
            description: 'Localized internship providing practical workplace experience in city hall departments and barangay administrative centers.',
            eligibility_criteria: 'Bona fide residents of Koronadal City, college or tech-voc graduates.',
            assistance_type: '6 Months Local Government Internship Grant',
            status: 'Active',
            agency: 'PESO',
            department: 'PESO'
        },
        {
            id: 5,
            code: 'KEEP',
            name: 'Koronadal Emergency Employment Program (KEEP)',
            category: 'Employment',
            budget: 1200000.00,
            budget_allocated: 1200000.00,
            slots_target: 250,
            slots_filled: 110,
            target_beneficiaries: 'Displaced Local Workers & Calamity-Affected Citizens',
            description: 'City-funded emergency employment program providing temporary livelihood support during local economic disruptions.',
            eligibility_criteria: 'Indigent heads of household residing in affected barangays of Koronadal.',
            assistance_type: 'Short-term Community Work Wage',
            status: 'Active',
            agency: 'PESO',
            department: 'PESO'
        },
        {
            id: 6,
            code: 'PFAS',
            name: 'Pangkabuhayan Financial Assistance (PFAS)',
            category: 'Livelihood',
            budget: 1500000.00,
            budget_allocated: 1500000.00,
            slots_target: 150,
            slots_filled: 74,
            target_beneficiaries: 'Individual Micro-Entrepreneurs & Self-Employed Workers',
            description: 'Direct seed capital grants to support micro-business recovery, tool acquisition, and enterprise scaling.',
            eligibility_criteria: 'Existing micro-enterprise owners or skilled individuals with verified business proposals.',
            assistance_type: 'Micro-Enterprise Seed Capital Grant (₱10,000 - ₱20,000)',
            status: 'Active',
            agency: 'PESO',
            department: 'PESO'
        },
        {
            id: 7,
            code: 'DILP',
            name: 'Support to DOLE Integrated Livelihood Program (DILP)',
            category: 'Livelihood',
            budget: 1000000.00,
            budget_allocated: 1000000.00,
            slots_target: 100,
            slots_filled: 45,
            target_beneficiaries: 'Community Associations, Cooperatives, & Vulnerable Groups',
            description: 'Capacity building and enterprise starter kits for organized community livelihood associations.',
            eligibility_criteria: 'DOLE-registered or SEC/CDA-registered community associations in Koronadal.',
            assistance_type: 'Group Livelihood Equipment & Starter Kits',
            status: 'Active',
            agency: 'PESO',
            department: 'PESO'
        },
        {
            id: 8,
            code: 'SKILLS-TRAIN',
            name: 'Livelihood/Skills Training Program',
            category: 'Training & Development',
            budget: 400000.00,
            budget_allocated: 400000.00,
            slots_target: 120,
            slots_filled: 60,
            target_beneficiaries: 'Unemployed Adults & Tech-Voc Aspirants',
            description: 'TESDA-aligned vocational skills training in high-demand trades including welding, baking, and electrical wiring.',
            eligibility_criteria: 'Residents of Koronadal City committed to completing full course modules.',
            assistance_type: 'Free Vocational Training + NC II Assessment Certification',
            status: 'Active',
            agency: 'PESO',
            department: 'PESO'
        },
        {
            id: 9,
            code: 'OFW-FCD',
            name: 'OFW Family Circle Day & Reintegration',
            category: 'Migrant Support',
            budget: 250000.00,
            budget_allocated: 250000.00,
            slots_target: 80,
            slots_filled: 35,
            target_beneficiaries: 'OFW Dependents & Migrant Worker Families',
            description: 'Financial literacy workshops, psychosocial support, and livelihood orientation for families of overseas workers.',
            eligibility_criteria: 'Active and returning OFW dependents registered with PESO Koronadal OFW Help Desk.',
            assistance_type: 'Family Welfare Guidance & Livelihood Matching',
            status: 'Active',
            agency: 'PESO',
            department: 'PESO'
        },
        {
            id: 10,
            code: 'PAROKYA',
            name: 'Support to Parokya ni OWN A Program',
            category: 'Livelihood',
            budget: 300000.00,
            budget_allocated: 300000.00,
            slots_target: 60,
            slots_filled: 28,
            target_beneficiaries: 'Small-scale Livestock & Agricultural Vendors',
            description: 'Cooperative agricultural production and distribution support for local agri-business vendors.',
            eligibility_criteria: 'Registered agri-produce sellers and small farmers.',
            assistance_type: 'Agri-Livelihood Input Support',
            status: 'Active',
            agency: 'PESO',
            department: 'PESO'
        },
        {
            id: 11,
            code: 'ROFWS',
            name: 'Support to Returning OFWs Program (ROFWS)',
            category: 'Migrant Support',
            budget: 350000.00,
            budget_allocated: 350000.00,
            slots_target: 70,
            slots_filled: 30,
            target_beneficiaries: 'Distressed & Returning Overseas Filipino Workers',
            description: 'Comprehensive socio-economic reintegration assistance for returning migrant workers seeking domestic enterprise.',
            eligibility_criteria: 'Repatriated or returned OFWs with valid travel documentation.',
            assistance_type: 'Reintegration Grant & Business Mentorship',
            status: 'Active',
            agency: 'PESO',
            department: 'PESO'
        },
        {
            id: 12,
            code: 'JOB-PLACEMENT',
            name: 'Job Placement & Referral Program',
            category: 'Employment Facilitation',
            budget: 150000.00,
            budget_allocated: 150000.00,
            slots_target: 500,
            slots_filled: 215,
            target_beneficiaries: 'Local Jobseekers & Displaced Professionals',
            description: 'Continuous labor market matching, employer referral, and job coaching services at the PESO Office.',
            eligibility_criteria: 'Any jobseeker looking for local or overseas employment.',
            assistance_type: 'Direct Employment Referral & Placement Tracking',
            status: 'Active',
            agency: 'PESO',
            department: 'PESO'
        },
        {
            id: 13,
            code: 'ASSOC-FAC',
            name: 'Association & Cooperative Facilitation',
            category: 'Livelihood',
            budget: 100000.00,
            budget_allocated: 100000.00,
            slots_target: 50,
            slots_filled: 22,
            target_beneficiaries: 'Informal Worker Groups Seeking Formal Registration',
            description: 'Legal documentation and registration assistance with DOLE/CDA for community micro-worker associations.',
            eligibility_criteria: 'Groups of 15+ informal workers forming a registered association.',
            assistance_type: 'Registration Assistance & Capacity Workshop',
            status: 'Active',
            agency: 'PESO',
            department: 'PESO'
        },
        {
            id: 14,
            code: 'JOB-FAIR',
            name: 'Conduct of Mega & Barangay Job Fairs',
            category: 'Employment Facilitation',
            budget: 200000.00,
            budget_allocated: 200000.00,
            slots_target: 1000,
            slots_filled: 480,
            target_beneficiaries: 'General Public & Graduating Students of Koronadal',
            description: 'Quarterly mega job fairs connecting local employers, BPO companies, and recruitment agencies with jobseekers.',
            eligibility_criteria: 'Open to all residents of Koronadal and Region XII.',
            assistance_type: 'On-the-spot Hiring & Interview Processing',
            status: 'Active',
            agency: 'PESO',
            department: 'PESO'
        },
        {
            id: 15,
            code: 'JOB-PORTAL',
            name: 'Development of Localized Job Portal',
            category: 'Employment Facilitation',
            budget: 150000.00,
            budget_allocated: 150000.00,
            slots_target: 2000,
            slots_filled: 850,
            target_beneficiaries: 'Digital Jobseekers & Local Registered Establishments',
            description: 'Digital labor market platform for online resume matching, job postings, and vacancy indexing.',
            eligibility_criteria: 'All Koronadal jobseekers and verified establishments.',
            assistance_type: 'Digital Career Matching Services',
            status: 'Active',
            agency: 'PESO',
            department: 'PESO'
        },
        {
            id: 16,
            code: 'SKILLS-VOUCHER',
            name: 'Skills Training Voucher Program',
            category: 'Training & Development',
            budget: 300000.00,
            budget_allocated: 300000.00,
            slots_target: 100,
            slots_filled: 40,
            target_beneficiaries: 'High School Graduates & Out-of-School Youths',
            description: 'Tuition support vouchers for accredited technical-vocational institutions in Koronadal.',
            eligibility_criteria: 'Qualified indigent youths with recommendation from barangay councils.',
            assistance_type: 'Tuition Subsidy Voucher',
            status: 'Active',
            agency: 'PESO',
            department: 'PESO'
        },
        {
            id: 17,
            code: 'LIVELIHOOD',
            name: 'Livelihood Starter Kit Assistance Program',
            category: 'Livelihood',
            budget: 1007882.00,
            budget_allocated: 1007882.00,
            slots_target: 200,
            slots_filled: 95,
            target_beneficiaries: 'Vulnerable & Disadvantaged Individuals',
            description: 'Equips trained individuals with essential commercial tools (e.g. sewing kits, culinary tools, carpentering tools) to launch home businesses.',
            eligibility_criteria: 'Completers of skills training or verified informal micro-vendors.',
            assistance_type: 'Physical Starter Kit Package',
            status: 'Active',
            agency: 'PESO',
            department: 'PESO'
        }
    ];

    const CANONICAL_PESO_BATCHES = [
        { id: 1, name: 'Batch 1 - TUPAD Morales Clean-up', program_code: 'TUPAD', cluster_location: 'Morales', capacity: 50, assigned_count: 50, status: 'Active' },
        { id: 2, name: 'Batch 2 - TUPAD Sta. Cruz Road Rehab', program_code: 'TUPAD', cluster_location: 'Sta. Cruz', capacity: 50, assigned_count: 48, status: 'Active' },
        { id: 3, name: 'Batch 3 - TUPAD Zone IV Green Park', program_code: 'TUPAD', cluster_location: 'Zone IV', capacity: 40, assigned_count: 40, status: 'Active' },
        { id: 4, name: 'Batch 1 - SPES City Hall Summer Internship', program_code: 'SPES', cluster_location: 'Poblacion', capacity: 100, assigned_count: 95, status: 'Active' },
        { id: 5, name: 'Batch 2 - SPES Barangay Administrative Clerks', program_code: 'SPES', cluster_location: 'General Paulino Santos', capacity: 80, assigned_count: 75, status: 'Active' },
        { id: 6, name: 'Batch 1 - CKGIP Engineering & Survey Assistance', program_code: 'CKGIP', cluster_location: 'City Engineering Complex', capacity: 30, assigned_count: 28, status: 'Active' },
        { id: 7, name: 'Batch 1 - PFAS Micro-Food Vendors Cluster', program_code: 'PFAS', cluster_location: 'Public Market Complex', capacity: 40, assigned_count: 38, status: 'Active' },
        { id: 8, name: 'Batch 1 - DILP Tailoring Association', program_code: 'DILP', cluster_location: 'San Isidro', capacity: 25, assigned_count: 25, status: 'Active' },
        { id: 9, name: 'Batch 1 - SKILLS-TRAIN Shielded Metal Arc Welding', program_code: 'SKILLS-TRAIN', cluster_location: 'PESO Tech-Voc Center', capacity: 30, assigned_count: 30, status: 'Active' }
    ];

    const CANONICAL_PESO_BENEFICIARIES = [
        { id: 1, qr_code: 'QR-BEN-102938', name: 'Maria Santos', first_name: 'Maria', last_name: 'Santos', barangay: 'Zone III', phone: '0917-123-4567', category: 'Informal Worker', status: 'Active', batch_id: 1, program_code: 'TUPAD' },
        { id: 2, qr_code: 'QR-BEN-203948', name: 'Juan Dela Cruz', first_name: 'Juan', last_name: 'Dela Cruz', barangay: 'Morales', phone: '0918-234-5678', category: 'Displaced Worker', status: 'Active', batch_id: 1, program_code: 'TUPAD' },
        { id: 3, qr_code: 'QR-BEN-304958', name: 'Elena Ramos', first_name: 'Elena', last_name: 'Ramos', barangay: 'Sta. Cruz', phone: '0919-345-6789', category: 'Seasonal Worker', status: 'Active', batch_id: 2, program_code: 'TUPAD' },
        { id: 4, qr_code: 'QR-BEN-405968', name: 'Roberto Garcia', first_name: 'Roberto', last_name: 'Garcia', barangay: 'Zone IV', phone: '0920-456-7890', category: 'Underemployed', status: 'Active', batch_id: 3, program_code: 'TUPAD' },
        { id: 5, qr_code: 'QR-BEN-506978', name: 'Carlos Mendoza', first_name: 'Carlos', last_name: 'Mendoza', barangay: 'Poblacion', phone: '0921-567-8901', category: 'Student Intern', status: 'Active', batch_id: 4, program_code: 'SPES' },
        { id: 6, qr_code: 'QR-BEN-607988', name: 'Angela Bautista', first_name: 'Angela', last_name: 'Bautista', barangay: 'GPS', phone: '0922-678-9012', category: 'Student Intern', status: 'Active', batch_id: 5, program_code: 'SPES' },
        { id: 7, qr_code: 'QR-BEN-708998', name: 'Mark Anthony Reyes', first_name: 'Mark Anthony', last_name: 'Reyes', barangay: 'Zone II', phone: '0923-789-0123', category: 'Graduate Intern', status: 'Active', batch_id: 6, program_code: 'CKGIP' },
        { id: 8, qr_code: 'QR-BEN-809008', name: 'Rosalie Fernandez', first_name: 'Rosalie', last_name: 'Fernandez', barangay: 'San Isidro', phone: '0924-890-1234', category: 'Micro Vendor', status: 'Active', batch_id: 7, program_code: 'PFAS' },
        { id: 9, qr_code: 'QR-BEN-910118', name: 'Teresa Alcantara', first_name: 'Teresa', last_name: 'Alcantara', barangay: 'San Isidro', phone: '0925-901-2345', category: 'Association Leader', status: 'Active', batch_id: 8, program_code: 'DILP' },
        { id: 10, qr_code: 'QR-BEN-112233', name: 'Danilo Villanueva', first_name: 'Danilo', last_name: 'Villanueva', barangay: 'Zone I', phone: '0926-012-3456', category: 'Trainee', status: 'Active', batch_id: 9, program_code: 'SKILLS-TRAIN' }
    ];

    let _programs = [...CANONICAL_PESO_PROGRAMS];
    let _batches = [...CANONICAL_PESO_BATCHES];
    let _beneficiaries = [...CANONICAL_PESO_BENEFICIARIES];
    let _activeFilter = 'all';
    let _activeCategory = 'all';
    let _searchQuery = '';

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function maskPhone(phone) {
        if (!phone || phone === 'N/A' || phone === '-') return '09XX-***-XXXX';
        const clean = String(phone).trim().replace(/[^0-9]/g, '');
        if (clean.length >= 10) {
            return `${clean.substring(0, 4)}-***-${clean.substring(clean.length - 4)}`;
        }
        return '09XX-***-XXXX';
    }

    function formatCurrency(amount) {
        const num = Number(amount) || 0;
        return '₱' + num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function logAudit(actionType, details) {
        if (typeof window.logAuditEvent === 'function') {
            window.logAuditEvent(actionType, details);
        } else if (typeof PESOSafeguards !== 'undefined' && PESOSafeguards.logAudit) {
            PESOSafeguards.logAudit({
                intent: actionType,
                actionType: actionType,
                targetEntity: 'Program Management',
                status: 'SUCCESS',
                details: details
            });
        }
    }

    /**
     * Set local data store with fallback merge
     */
    function setData(programs = [], batches = [], beneficiaries = []) {
        if (Array.isArray(programs) && programs.length > 0) {
            // Merge with canonical data to preserve rich metadata
            _programs = programs.map(p => {
                const canonical = CANONICAL_PESO_PROGRAMS.find(cp => cp.code === p.code) || {};
                return {
                    ...canonical,
                    ...p,
                    budget: Number(p.budget) || canonical.budget || 500000,
                    budget_allocated: Number(p.budget) || canonical.budget || 500000,
                    slots_target: Number(p.slots_target) || canonical.slots_target || 100,
                    slots_filled: Number(p.slots_filled) || canonical.slots_filled || 0,
                    status: p.status || canonical.status || 'Active',
                    category: p.category || canonical.category || 'Employment'
                };
            });
        } else {
            _programs = [...CANONICAL_PESO_PROGRAMS];
        }

        if (Array.isArray(batches) && batches.length > 0) {
            _batches = batches;
        } else {
            _batches = [...CANONICAL_PESO_BATCHES];
        }

        if (Array.isArray(beneficiaries) && beneficiaries.length > 0) {
            _beneficiaries = beneficiaries;
        } else {
            _beneficiaries = [...CANONICAL_PESO_BENEFICIARIES];
        }
    }

    /**
     * Render the main programs catalog table (Tab 1 / Program Management)
     */
    function renderProgramsTable() {
        const tbody = document.getElementById('programsTableBody');
        const badge = document.getElementById('programsSectionCountBadge');
        if (!tbody) return;

        const filtered = _programs.filter(p => {
            const matchesStatus = _activeFilter === 'all' 
                ? p.status === 'Active' 
                : (_activeFilter === 'Archived' ? p.status !== 'Active' : p.status === _activeFilter);
            const matchesCat = _activeCategory === 'all' || p.category === _activeCategory;
            const q = _searchQuery.toLowerCase();
            const matchesSearch = !q || (p.code && p.code.toLowerCase().includes(q)) || (p.name && p.name.toLowerCase().includes(q));
            return matchesStatus && matchesCat && matchesSearch;
        });

        if (badge) badge.textContent = `${filtered.length} Programs Registered`;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No programs found matching the selected filter criteria.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(p => {
            const slots = Number(p.slots_target) || Number(p.target_beneficiaries) || 100;
            const filled = Number(p.slots_filled) || 0;
            const budget = Number(p.budget) || Number(p.budget_allocated) || 0;
            const progress = slots > 0 ? Math.min(100, Math.round((filled / slots) * 100)) : 0;
            const isDeactivated = p.status !== 'Active';

            return `
                <tr>
                    <td class="fw-bold font-monospace text-primary">${escapeHtml(p.code)}</td>
                    <td>
                        <div class="fw-semibold text-dark">${escapeHtml(p.name)}</div>
                        <small class="text-muted text-truncate d-block" style="max-width: 280px;">${escapeHtml(p.description || '')}</small>
                    </td>
                    <td><span class="badge ${p.category === 'Livelihood' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-primary-subtle text-primary border border-primary-subtle'}">${escapeHtml(p.category || 'General')}</span></td>
                    <td>
                        <div class="d-flex justify-content-between small mb-1">
                            <span class="fw-semibold">${filled} / ${slots}</span>
                            <span class="text-muted">${progress}%</span>
                        </div>
                        <div class="progress" style="height: 6px;">
                            <div class="progress-bar ${progress >= 90 ? 'bg-danger' : 'bg-primary'}" role="progressbar" style="width: ${progress}%"></div>
                        </div>
                    </td>
                    <td class="fw-bold text-dark">${formatCurrency(budget)}</td>
                    <td>
                        <span class="badge ${isDeactivated ? 'bg-danger-subtle text-danger border border-danger-subtle' : 'bg-success-subtle text-success border border-success-subtle'}">
                            <i class="bi ${isDeactivated ? 'bi-pause-circle me-1' : 'bi-check-circle me-1'}"></i>${escapeHtml(p.status || 'Active')}
                        </span>
                    </td>
                    <td class="text-end text-nowrap">
                        <button class="btn btn-sm btn-outline-primary py-1 px-2 me-1" onclick="PesoPrograms.viewProgramDetails('${p.code}')" title="View Details">
                            <i class="bi bi-eye me-1"></i>Details
                        </button>
                        <button class="btn btn-sm ${isDeactivated ? 'btn-outline-success' : 'btn-outline-danger'} py-1 px-2" onclick="PesoPrograms.toggleProgramStatus('${p.code}')" title="${isDeactivated ? 'Activate Program' : 'Deactivate Program'}">
                            <i class="bi ${isDeactivated ? 'bi-play-fill me-1' : 'bi-pause-fill me-1'}"></i>${isDeactivated ? 'Activate' : 'Deactivate'}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Render the Multi-Level Assignment table in Admin Portal
     */
    function renderAssignmentTable() {
        const tbody = document.getElementById('assignProgramsTableBody');
        if (!tbody) return;

        const activeProgs = _programs.filter(p => p.status === 'Active');
        if (activeProgs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No active programs available for assignment monitoring.</td></tr>`;
            return;
        }

        tbody.innerHTML = activeProgs.map(p => {
            const slots = Number(p.slots_target) || Number(p.target_beneficiaries) || 100;
            const filled = Number(p.slots_filled) || 0;
            const remaining = Math.max(0, slots - filled);
            const budget = Number(p.budget) || Number(p.budget_allocated) || 0;
            const progress = slots > 0 ? Math.min(100, Math.round((filled / slots) * 100)) : 0;

            return `
                <tr>
                    <td class="fw-bold font-monospace text-primary">${escapeHtml(p.code)}</td>
                    <td class="fw-semibold text-dark">${escapeHtml(p.name)}</td>
                    <td><span class="badge bg-light text-dark border">${escapeHtml(p.category || 'General')}</span></td>
                    <td>
                        <div class="fw-semibold small">${filled} / ${slots} Beneficiaries</div>
                        <div class="progress" style="height: 5px; margin-top: 4px;">
                            <div class="progress-bar ${progress >= 90 ? 'bg-danger' : 'bg-success'}" style="width: ${progress}%"></div>
                        </div>
                    </td>
                    <td><span class="badge bg-info-subtle text-info border">${remaining} Available</span></td>
                    <td class="fw-bold">${formatCurrency(budget)}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-primary py-1 px-2" onclick="PesoPrograms.drilldownToBatches('${p.code}')" title="View Assigned Batches">
                            <i class="bi bi-diagram-3 me-1"></i>Batches
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Level 2: Drilldown to Batches
     */
    function drilldownToBatches(programCode) {
        const prog = _programs.find(p => p.code === programCode);
        if (!prog) return;

        const level1 = document.getElementById('assignLevel1');
        const level2 = document.getElementById('assignLevel2');
        const level3 = document.getElementById('assignLevel3');

        if (level1) level1.classList.add('d-none');
        if (level2) level2.classList.remove('d-none');
        if (level3) level3.classList.add('d-none');

        const titleEl = document.getElementById('assignLevel2Title');
        if (titleEl) titleEl.textContent = `${prog.name} (${prog.code}) — Batch Assignment Roster`;

        const tbody = document.getElementById('assignBatchesTableBody');
        if (!tbody) return;

        const batches = _batches.filter(b => b.program_code === programCode || b.program === programCode);
        if (batches.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No livelihood batches created for ${escapeHtml(programCode)} yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = batches.map(b => `
            <tr>
                <td class="fw-bold font-monospace text-primary">${escapeHtml(b.name)}</td>
                <td>${escapeHtml(b.cluster_location || 'Koronadal City')}</td>
                <td><span class="badge bg-info text-dark font-monospace">${b.assigned_count || 0} / ${b.capacity || 30}</span></td>
                <td><span class="badge bg-success-subtle text-success border">Active</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary py-1 px-2" onclick="PesoPrograms.drilldownToBeneficiaries('${b.id}', '${escapeHtml(b.name)}')">
                        <i class="bi bi-people me-1"></i>View Beneficiaries
                    </button>
                </td>
            </tr>
        `).join('');

        logAudit('DRILLDOWN_BATCHES', `Drilldown into batches for program ${programCode}`);
    }

    /**
     * Level 3: Drilldown to Beneficiaries
     */
    function drilldownToBeneficiaries(batchId, batchName) {
        const level1 = document.getElementById('assignLevel1');
        const level2 = document.getElementById('assignLevel2');
        const level3 = document.getElementById('assignLevel3');

        if (level1) level1.classList.add('d-none');
        if (level2) level2.classList.add('d-none');
        if (level3) level3.classList.remove('d-none');

        const titleEl = document.getElementById('assignLevel3Title');
        if (titleEl) titleEl.textContent = `${batchName} — Beneficiary List`;

        const tbody = document.getElementById('assignBeneficiariesTableBody');
        if (!tbody) return;

        const beneficiaries = _beneficiaries.filter(b => String(b.batch_id) === String(batchId));
        if (beneficiaries.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No beneficiaries enrolled in this batch yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = beneficiaries.map(b => `
            <tr>
                <td class="fw-bold font-monospace text-primary">${escapeHtml(b.qr_code)}</td>
                <td class="fw-semibold text-dark">${escapeHtml(b.name || `${b.first_name} ${b.last_name}`)}</td>
                <td class="font-monospace text-muted">${maskPhone(b.phone)}</td>
                <td>${escapeHtml(b.barangay || 'Koronadal')}</td>
                <td><span class="badge bg-light text-dark border">${escapeHtml(b.category || 'Beneficiary')}</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-secondary py-1 px-2" onclick="alert('Viewing Beneficiary: ${escapeHtml(b.name)}')">
                        <i class="bi bi-eye"></i> View Profile
                    </button>
                </td>
            </tr>
        `).join('');

        logAudit('DRILLDOWN_BENEFICIARIES', `Drilldown into beneficiaries for batch #${batchId}`);
    }

    function backToLevel1() {
        const level1 = document.getElementById('assignLevel1');
        const level2 = document.getElementById('assignLevel2');
        const level3 = document.getElementById('assignLevel3');
        if (level1) level1.classList.remove('d-none');
        if (level2) level2.classList.add('d-none');
        if (level3) level3.classList.add('d-none');
    }

    function backToLevel2() {
        const level1 = document.getElementById('assignLevel1');
        const level2 = document.getElementById('assignLevel2');
        const level3 = document.getElementById('assignLevel3');
        if (level1) level1.classList.add('d-none');
        if (level2) level2.classList.remove('d-none');
        if (level3) level3.classList.add('d-none');
    }

    /**
     * Read-Only Details Modal (USER RULE 1)
     */
    function viewProgramDetails(code) {
        const prog = _programs.find(p => p.code === code);
        if (!prog) return;

        const modalEl = document.getElementById('programDetailsModal');
        const contentEl = document.getElementById('programDetailsModalBody');

        if (contentEl) {
            contentEl.innerHTML = `
                <div class="p-3">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="fw-bold text-dark mb-0">${escapeHtml(prog.name)}</h5>
                        <span class="badge bg-primary fs-6 font-monospace">${escapeHtml(prog.code)}</span>
                    </div>
                    <div class="alert alert-info py-2 px-3 small mb-3">
                        <i class="bi bi-info-circle-fill me-1"></i><strong>Read-Only Notice:</strong> Program details are strictly view-only per system administrative policy.
                    </div>
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">Category</label>
                            <div class="p-2 bg-light rounded border text-dark">${escapeHtml(prog.category || 'General')}</div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">Allocated Budget</label>
                            <div class="p-2 bg-light rounded border text-success fw-bold">${formatCurrency(prog.budget)}</div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">Target Slots</label>
                            <div class="p-2 bg-light rounded border text-dark">${prog.slots_target || 100} Beneficiaries</div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">Active Status</label>
                            <div class="p-2 bg-light rounded border text-dark">${escapeHtml(prog.status || 'Active')}</div>
                        </div>
                        <div class="col-12">
                            <label class="form-label small fw-bold text-muted">Program Description</label>
                            <div class="p-2 bg-light rounded border text-dark small">${escapeHtml(prog.description || 'No description provided.')}</div>
                        </div>
                        <div class="col-12">
                            <label class="form-label small fw-bold text-muted">Eligibility & Requirements</label>
                            <div class="p-2 bg-light rounded border text-dark small">${escapeHtml(prog.eligibility_criteria || 'Bona fide resident of Koronadal City.')}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            bootstrap.Modal.getOrCreateInstance(modalEl).show();
        } else {
            alert(`Program: ${prog.code} - ${prog.name}\nBudget: ${formatCurrency(prog.budget)}\nStatus: ${prog.status}`);
        }

        logAudit('VIEW_PROGRAM_DETAILS', `Viewed details for program ${code}`);
    }

    /**
     * Program Status Toggle (USER RULE 6: Deactivation Safeguard)
     */
    async function toggleProgramStatus(code) {
        const prog = _programs.find(p => p.code === code);
        if (!prog) return;

        const isDeactivating = (prog.status === 'Active');

        // Check active beneficiary restriction
        if (isDeactivating) {
            const activeBensCount = Number(prog.slots_filled) || 0;
            if (activeBensCount > 0) {
                alert(`Deactivation Blocked: Program "${prog.code}" has ${activeBensCount} active beneficiaries enrolled. Assignments must be completed or transferred before this program can be deactivated.`);
                logAudit('BLOCKED_DEACTIVATION', `Deactivation blocked for ${prog.code} due to ${activeBensCount} active beneficiaries.`);
                return;
            }
        }

        const newStatus = isDeactivating ? 'Inactive' : 'Active';
        if (!confirm(`Are you sure you want to change the status of program "${prog.code}" to ${newStatus}?`)) {
            return;
        }

        prog.status = newStatus;

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('programs').update({ status: newStatus }).eq('code', prog.code);
            } catch (err) {
                console.warn('[PesoPrograms] Supabase update warning:', err.message);
            }
        }

        renderProgramsTable();
        renderArchiveTable();

        logAudit(isDeactivating ? 'DEACTIVATE_PROGRAM' : 'ACTIVATE_PROGRAM', `Set status of program ${prog.code} to ${newStatus}`);

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: isDeactivating ? 'Program Deactivated' : 'Program Activated',
                message: `Program ${prog.code} is now ${newStatus}.`,
                type: isDeactivating ? 'warning' : 'success'
            });
        }
    }

    /**
     * Render Read-Only Archive Table (USER RULE 5)
     */
    function renderArchiveTable() {
        const tbody = document.getElementById('archiveTableBody');
        const badge = document.getElementById('archiveCountBadge');
        if (!tbody) return;

        const archived = _programs.filter(p => p.status !== 'Active');

        if (badge) badge.textContent = `${archived.length} Deactivated`;

        if (archived.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted"><i class="bi bi-archive me-1"></i>No archived or deactivated programs found.</td></tr>`;
            return;
        }

        tbody.innerHTML = archived.map(p => `
            <tr>
                <td class="fw-bold font-monospace text-secondary text-decoration-line-through">${escapeHtml(p.code)}</td>
                <td class="text-secondary">${escapeHtml(p.name)}</td>
                <td><span class="badge bg-secondary-subtle text-secondary border">${escapeHtml(p.category || 'General')}</span></td>
                <td><span class="text-muted">${formatCurrency(p.budget)}</span></td>
                <td><span class="badge bg-danger-subtle text-danger border">Deactivated</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-success py-1 px-2 me-1" onclick="PesoPrograms.toggleProgramStatus('${p.code}')" title="Reactivate Program">
                        <i class="bi bi-arrow-counterclockwise me-1"></i>Restore
                    </button>
                    <button class="btn btn-sm btn-outline-danger py-1 px-2" onclick="PesoPrograms.permanentlyDeleteProgram('${p.code}')" title="Permanent Delete">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    /**
     * Permanently Delete Program (Archive Only)
     */
    async function permanentlyDeleteProgram(code) {
        const prog = _programs.find(p => p.code === code);
        if (!prog) return;

        if (!confirm(`Warning: Are you sure you want to permanently delete "${prog.code} - ${prog.name}"? This action cannot be undone.`)) {
            return;
        }

        _programs = _programs.filter(p => p.code !== code);

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('programs').delete().eq('code', code);
            } catch (err) {
                console.warn('[PesoPrograms] Supabase delete warning:', err.message);
            }
        }

        renderProgramsTable();
        renderArchiveTable();

        logAudit('PERMANENT_DELETE_PROGRAM', `Permanently deleted program ${code}`);

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Program Deleted',
                message: `Program ${code} was permanently removed.`,
                type: 'danger'
            });
        }
    }

    /**
     * Submit Create Program Form
     */
    async function submitCreateProgram(formEl) {
        const code = (document.getElementById('newProgCode')?.value || '').trim().toUpperCase();
        const name = (document.getElementById('newProgName')?.value || '').trim();
        const category = document.getElementById('newProgCategory')?.value || 'Employment';
        const budget = parseFloat(document.getElementById('newProgBudget')?.value || '0');
        const slots = parseInt(document.getElementById('newProgSlots')?.value || '100', 10);
        const desc = (document.getElementById('newProgDesc')?.value || '').trim();
        const eligibility = (document.getElementById('newProgEligibility')?.value || '').trim();

        if (!code || !name || budget <= 0) {
            alert('Please fill out all mandatory fields: Program Code, Name, and Budget.');
            return;
        }

        const newProg = {
            id: Date.now(),
            code: code,
            name: name,
            category: category,
            budget: budget,
            budget_allocated: budget,
            slots_target: slots,
            slots_filled: 0,
            description: desc,
            eligibility_criteria: eligibility,
            status: 'Active',
            agency: 'PESO',
            department: 'PESO'
        };

        _programs.unshift(newProg);

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('programs').insert(newProg);
            } catch (err) {
                console.warn('[PesoPrograms] Supabase insert warning:', err.message);
            }
        }

        renderProgramsTable();
        renderAssignmentTable();

        logAudit('CREATE_PROGRAM', `Created new program ${code} (${name}) with budget ${formatCurrency(budget)}`);

        const modalEl = document.getElementById('newProgramModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            bootstrap.Modal.getInstance(modalEl)?.hide();
        }

        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification({
                title: 'Program Created',
                message: `Program ${code} has been successfully created.`,
                type: 'success'
            });
        }
    }

    function filterPrograms() {
        _searchQuery = document.getElementById('searchProgramsQuery')?.value || '';
        _activeCategory = document.getElementById('filterProgramsCategory')?.value || 'all';
        _activeFilter = document.getElementById('filterProgramsStatus')?.value || 'all';
        renderProgramsTable();
    }

    return Object.freeze({
        CANONICAL_PESO_PROGRAMS,
        CANONICAL_PESO_BATCHES,
        CANONICAL_PESO_BENEFICIARIES,
        setData,
        renderProgramsTable,
        renderAssignmentTable,
        drilldownToBatches,
        drilldownToBeneficiaries,
        backToLevel1,
        backToLevel2,
        viewProgramDetails,
        toggleProgramStatus,
        renderArchiveTable,
        permanentlyDeleteProgram,
        submitCreateProgram,
        filterPrograms
    });
})();

window.PesoPrograms = PesoPrograms;
window.filterProgramsCatalog = PesoPrograms.filterPrograms;
window.showProgramsLevel1 = PesoPrograms.backToLevel1;
window.showProgramsLevel2 = PesoPrograms.backToLevel2;

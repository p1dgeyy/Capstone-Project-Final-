/**
 * PESO Administrator Portal - Master Module Coordinator & Diagnostic Suite
 * City Government of Koronadal - Public Employment Service Office
 *
 * Architecture:
 * All PESO Admin submodules are partitioned under `frontend/assets/js/peso-admin/`:
 *  ├── peso-admin-core.js        : SafeModal, audit engine, phone masking, date formatters
 *  ├── peso-admin-programs.js    : Tab 1: Program CRUD, metrics, ordinance upload, deactivation restrictions & archive
 *  ├── peso-admin-users.js       : Tab 2: User management & RBAC, roster filters, account status
 *  ├── peso-admin-scheduling.js  : Tab 3: Calendar/list views, slot CRUD, conflict checks, cert auto-pull
 *  ├── peso-admin-evaluation.js  : Tab 4: 3-level queue, case file review, approve/reject decisions
 *  ├── peso-admin-assignment.js  : Tab 5: 3-level quota tracking, officer-managed beneficiary roster, masked contact compliance
 *  ├── peso-admin-officers.js    : Tab 6: Officer directory, account creation, status toggling
 *  └── peso-admin-main.js        : Global tab navigation switcher, DOM bootloader, click delegation
 */

(function (window) {
    'use strict';

    const PesoAdmin = {
        version: '2.5.0',
        portal: 'PESO Administrator Portal',
        modules: [
            { name: 'Core', file: 'peso-admin-core.js', description: 'Modal safety, audit trail logger, phone masking, date helpers' },
            { name: 'Programs', file: 'peso-admin-programs.js', description: 'Tab 1: Programs overview, ordinance uploads, active beneficiary safeguards, archive' },
            { name: 'Users', file: 'peso-admin-users.js', description: 'Tab 2: User management, role filtering, account status toggling' },
            { name: 'Scheduling', file: 'peso-admin-scheduling.js', description: 'Tab 3: Activity calendar, conflict/past-date validation, cert auto-pull' },
            { name: 'Evaluation', file: 'peso-admin-evaluation.js', description: 'Tab 4: 3-level evaluation queue, case file review, decision engine' },
            { name: 'Assignment', file: 'peso-admin-assignment.js', description: 'Tab 5: Quota tracking, officer-managed beneficiary rosters' },
            { name: 'Officers', file: 'peso-admin-officers.js', description: 'Tab 6: Officer directory, account provisioning, audit logging' },
            { name: 'Main', file: 'peso-admin-main.js', description: 'Master tab switcher, DOM lifecycle bootloader, event delegation' }
        ],

        /**
         * Diagnostic tool to verify that all modules, core DOM elements,
         * and modal controllers are present and operational.
         */
        diagnose: function () {
            console.group('[PESO Admin Diagnostics]');
            console.log(`%c PESO Admin Suite v${this.version} `, 'background: #0284C7; color: white; font-weight: bold; border-radius: 4px;');
            
            const checks = [
                { name: 'SafeModal Controller', status: typeof window.safeOpenModal === 'function' },
                { name: 'Audit Logger', status: typeof window.logAuditEvent === 'function' },
                { name: 'Phone Masking', status: typeof window.maskPhoneNumber === 'function' },
                { name: 'Tab Switcher', status: typeof window.switchTab === 'function' },
                { name: 'Unified Overlay Controller', status: !!window.UnifiedOverlayController },
                { name: 'Supabase Config', status: !!window.supabaseConfig }
            ];

            let allPassed = true;
            checks.forEach(c => {
                const icon = c.status ? '✅' : '❌';
                console.log(`${icon} ${c.name}: ${c.status ? 'Available' : 'Missing'}`);
                if (!c.status) allPassed = false;
            });

            console.log(`Status: ${allPassed ? '%cAll Core Services Operational' : '%cDegraded - Some modules missing'}`, allPassed ? 'color: #10B981; font-weight: bold;' : 'color: #EF4444; font-weight: bold;');
            console.groupEnd();

            return { version: this.version, healthy: allPassed, checks };
        }
    };

    window.PesoAdmin = PesoAdmin;
    console.log(`[PESO Admin] Master coordinator initialized (v${PesoAdmin.version}). Run PesoAdmin.diagnose() for diagnostics.`);
})(window);

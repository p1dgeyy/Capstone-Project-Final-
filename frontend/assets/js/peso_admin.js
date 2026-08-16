/**
 * PESO Administrator Portal - Master JavaScript Module Coordinator
 * City Government of Koronadal
 *
 * This file serves as the master entrypoint for the PESO Admin portal.
 * Sub-modules are organized modularly under `frontend/assets/js/peso-admin/`:
 *  - peso-admin-core.js       : Architecture, safe modal controllers, batch tester, audit engine, phone masking
 *  - peso-admin-programs.js   : Program Management (Tab 1), metrics, ordinance uploads, deactivation restriction & archive
 *  - peso-admin-users.js      : User Management & RBAC (Tab 2), roster, account actions, department scope
 *  - peso-admin-scheduling.js : Scheduling Management (Tab 3), calendar/list views, slot CRUD, conflict & past date checks
 *  - peso-admin-evaluation.js : Application Evaluation (Tab 4), 3-level queue, case file review, decisions
 *  - peso-admin-assignment.js : Program Assignment (Tab 5), 3-level quota tracking, masked contact rosters
 *  - peso-admin-officers.js   : PESO Officers Management (Tab 6), officer directory, account creation & status
 *  - peso-admin-main.js       : Global navigation controller, tab switcher, and DOM bootloader
 */

console.log('[PESO Admin] Master module coordinator loaded.');

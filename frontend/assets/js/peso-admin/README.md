# PESO Administrator Portal - JavaScript Module Architecture

This directory contains the modular JavaScript controllers powering the **PESO Administrator Portal** (`frontend/peso_admin.html`).

---

## 📁 Directory Structure & Responsibilities

| File | Module / Tab | Responsibilities & Rule Enforcement |
| :--- | :--- | :--- |
| **`peso-admin-core.js`** | Core Safety & Utilities | • Safe modal controller (`SafeModal`) with back-drop cleanup and duplicate prevention.<br>• Global audit trail logger (`logAuditEvent`) recording timestamps and user role.<br>• Phone number masking (`maskPhoneNumber`) in compliance with Data Privacy.<br>• Date formatting and batch test runner. |
| **`peso-admin-programs.js`** | Tab 1: Program Management | • Overview metrics (Active programs, Archived count, Total budget).<br>• Program search and status filter (`filterPrograms`).<br>• New program creation and LGU Appropriation Ordinance upload validation.<br>• Active beneficiary deactivation restriction (blocks deactivation if active beneficiaries exist).<br>• Program archive management with read-only restriction and activation/deletion controls. |
| **`peso-admin-users.js`** | Tab 2: User Management | • User directory and RBAC roster display.<br>• Role filtering (PESO Admin, PESO Officer, Evaluator, Beneficiary, CSWDO Admin, CSWDO Officer).<br>• Departmental scoping (PESO department isolation).<br>• Account status toggling (Active / Inactive) with audit logging. |
| **`peso-admin-scheduling.js`** | Tab 3: Scheduling Management | • Activity calendar and list view toggles.<br>• Activity scheduling with past-date blocking and conflict time-slot validation.<br>• Certificate distribution auto-pull from training records.<br>• Activity cancellation with red-badge visualization and cancellation logging.<br>• Masked beneficiary roster display. |
| **`peso-admin-evaluation.js`** | Tab 4: Application Evaluation | • 3-Level evaluation queue (Level 1: Verification, Level 2: Assessment, Level 3: Approval).<br>• Case file inspection modal (strictly read-only details).<br>• Approve/Reject decision processing with audit trail recording. |
| **`peso-admin-assignment.js`** | Tab 5: Program Assignment | • 3-Level quota tracking and progress overview.<br>• Officer-managed beneficiary roster viewing.<br>• Strict officer-managed beneficiary assignment restrictions (Admin view-only).<br>• Masked contact numbers in compliance with privacy laws. |
| **`peso-admin-officers.js`** | Tab 6: PESO Officers Management | • Officer directory table with real-time status badges.<br>• Create new officer account modal and form validation.<br>• Officer account status toggling with audit trail logging. |
| **`peso-admin-main.js`** | Master Navigation & Bootloader | • Global tab navigation switcher (`switchTab`).<br>• DOM lifecycle initialization (`DOMContentLoaded`).<br>• Document-level event delegation for dynamic action buttons.<br>• Bootstrap modal lifecycle listener attachment. |

---

## 🔒 User Rules & Safeguards Enforced
1. **Read-only Details Modal**: All detail modals are strictly view-only without edit capabilities.
2. **Role-Based Access Control**: PESO Admins perform system configuration and program CRUD; beneficiary assignment is strictly Officer-managed.
3. **Data Privacy Compliance**: Sensitive contact numbers remain masked (`0917-***-1122`) in all table views and modal rosters.
4. **Audit Logging**: Every action (Create, Update, Activate, Deactivate, Cancel, Archive, Delete) is logged with timestamp and admin credentials.
5. **Archive Read-only Restriction**: Archived programs are read-only for monitoring and reporting, with only activation or permanent deletion permitted.

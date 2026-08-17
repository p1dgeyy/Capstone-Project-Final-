# PESO Administrator Portal - JavaScript Module Architecture
City Government of Koronadal — Public Employment Service Office

This directory contains the modular JavaScript controllers powering the **PESO Administrator Portal** (`frontend/peso_admin.html`).

---

## 📁 Directory Structure & Responsibilities

| File | Module / Tab | Responsibilities & Rule Enforcement |
| :--- | :--- | :--- |
| **`peso-admin-core.js`** | Core Safety & Utilities | • Safe modal controller (`SafeModal`) with backdrop cleanup and duplicate prevention.<br>• Global audit trail logger (`logAuditEvent`) recording timestamps, Admin ID, and user role.<br>• Phone number masking (`maskContactNumber` / `maskPhoneNumber`) for Data Privacy Act 2012 compliance.<br>• Date formatting and test runner utilities. |
| **`peso-admin-programs.js`** | Tab 1: Program Management & Tab 6: Archive | • Overview metrics (Active programs, Archived count, Total budget).<br>• Program search and status filter (`filterPrograms`).<br>• New program creation and LGU Appropriation Ordinance upload with live inline document preview.<br>• Active beneficiary deactivation restriction (blocks deactivation if active beneficiaries exist).<br>• Program action confirmation modal (`#programActionConfirmModal`) for Deactivate/Archive/Restore/Delete.<br>• Summary CSV export (`exportProgramsCsv`). |
| **`peso-admin-users.js`** | Tab 2: User & Officer Management | • User directory and RBAC roster display with pagination, search, and role filters.<br>• Departmental scoping (PESO department isolation; CSWDO segregated).<br>• Account action confirmation modal (`#userActionConfirmModal`) for Unlock, Deactivate, Activate, Archive, and Permanent Delete.<br>• Data exports (`exportUsersCsv`, `exportCompliancePdf`). |
| **`peso-admin-scheduling.js`** | Tab 3: Scheduling Management | • Activity calendar and list view toggles with month navigation.<br>• Activity scheduling with past-date blocking and conflict time-slot validation.<br>• Certificate distribution auto-pull from training records (`#eligibleRecipientsModal`).<br>• Activity cancellation with red-badge visualization, reason tracking, and audit logging.<br>• Comprehensive report exports (`exportCombinedLguReport`, `exportSchedulingCSV`, `exportSchedulingPDF`, `exportArchiveCSV`). |
| **`peso-admin-evaluation.js`** | Tab 4: Application Evaluation | • 3-Level evaluation queue (Level 1: Programs, Level 2: Batches, Level 3: Applications).<br>• Case file inspection modal (strictly read-only details).<br>• Interactive document preview modal (`#docPreviewModal`) with zoom controls (50%–180%), official LGU verification badge, and print/download export.<br>• Approve/Reject decision processing with audit trail recording. |
| **`peso-admin-assignment.js`** | Tab 5: Program Assignment | • 3-Level quota tracking and progress overview (Programs -> Batches -> Beneficiary Roster).<br>• Officer-managed beneficiary roster viewing (Admin view-only; assignments strictly Officer-managed).<br>• Masked contact numbers in compliance with privacy laws.<br>• Clickable document inspection launching `#docPreviewModal`.<br>• Beneficiary roster CSV export (`exportBeneficiariesCSV`). |
| **`peso-admin-officers.js`** | Officer Directory Aliases | • Officer directory table with real-time status badges.<br>• Backward-compatible aliases routing to `peso-admin-users.js` and `supabase-data.js`. |
| **`peso-admin-main.js`** | Master Navigation & Bootloader | • Global tab navigation switcher (`switchTab`).<br>• DOM lifecycle initialization (`DOMContentLoaded`).<br>• Document-level event delegation for dynamic action buttons.<br>• Bootstrap modal lifecycle listener attachment. |

---

## 🔒 User Rules & Safeguards Enforced
1. **Read-only Details Modal**: All detail modals (`programDetailsViewModal`, `userDetailsModal`, `viewActivityDetailsModal`, `beneficiaryProfileModal`, `reviewCaseFileModal`) are strictly view-only without edit capabilities.
2. **Role-Based Access Control**: PESO Admins perform system configuration and program CRUD; beneficiary assignment is strictly Officer-managed.
3. **Data Privacy Compliance**: Sensitive contact numbers remain masked (`0917-***-1122`) in all table views and modal rosters.
4. **Audit Logging**: Every action (Create, Update, Activate, Deactivate, Cancel, Archive, Delete) is logged with timestamp, Admin ID, and user credentials.
5. **Archive Read-only Restriction**: Archived programs are read-only for monitoring and reporting, with only activation or permanent deletion permitted.
6. **Program Deactivation Guard**: Programs with active enrolled beneficiaries (`beneficiaries_count > 0`) cannot be deactivated until assignments are completed or transferred.
7. **Scheduling Conflict & Past-Date Safeguards**: Past-date scheduling is blocked, overlapping time slots for the same officer are validated, and cancelled slots retain prominent red badge indicators.

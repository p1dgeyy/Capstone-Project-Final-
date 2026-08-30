/**
 * PESO Officer Portal API Contract & UI Layout Specification v1.0 (Frozen)
 * City Government of Koronadal — Public Employment Service Office (PESO)
 * 
 * Version: 1.0.0-FROZEN
 * Specification Status: LOCKED / IMMUTABLE
 * Compliance: Data Privacy Act of 2012, LGU Koronadal City Executive Policy, WCAG 2.1 AA
 * 
 * This file serves as the definitive runtime validation and immutable contract
 * for all PESO Officer Portal transactions, schemas, role-based boundaries,
 * and layout specifications.
 */

(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.PESO_OFFICER_API_CONTRACT_V1 = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /**
     * @typedef {Object} ContractMetadata
     */
    const METADATA = Object.freeze({
        CONTRACT_NAME: 'PESO_OFFICER_PORTAL_CONTRACT',
        CONTRACT_VERSION: '1.0.0-FROZEN',
        STATUS: 'LOCKED',
        EFFECTIVE_DATE: '2026-08-30',
        LOCKED_AT: '2026-08-30T12:00:00.000Z',
        AUTHOR: 'PESO Systems Development Unit & Capstone Team',
        GOVERNANCE: {
            ROLE: 'PESO Officer',
            ADMIN_ROLE: 'PESO Admin',
            BENEFICIARY_ROLE: 'Beneficiary Applicant',
            RESTRICTIONS: [
                'Rule 1: All Details modals are strictly view-only (no edits allowed).',
                'Rule 2: Role-based Access Control: PESO Officers manage intake, assignments, attendance, evaluations, and distributions. Admins manage system-level CRUD & program authorizations.',
                'Rule 3: Audit Logging: Every officer mutation must be immutably recorded with timestamp, officer identity, and intent.',
                'Rule 4: Data Privacy: Beneficiary contact numbers must remain masked (09XX-***-XXXX) in all tabular & details views.',
                'Rule 5: Scheduling Constraints: Past dates are blocked; overlapping slots are rejected; 3-day resubmission window is auto-calculated.'
            ]
        }
    });

    /**
     * Standard Allowed Entity Enums & Validation RegEx
     */
    const ENUMS = Object.freeze({
        CIVIL_STATUS: ['Single', 'Married', 'Widowed', 'Separated', 'Divorced'],
        SEX: ['Male', 'Female', 'Other'],
        BENEFICIARY_STATUS: ['Active', 'Inactive', 'Under Review', 'Deactivated', 'Archived'],
        APPLICATION_STATUS: [
            'Pending Requirements',
            'Under Review',
            'Officer Approved',
            'Admin Approved',
            'Officer Denied',
            'Admin Denied',
            'Eligible for Scheduling',
            'Interview Scheduled',
            'Training Enrolled',
            'Distribution Ready',
            'Released',
            'Completed'
        ],
        RESUBMISSION_WINDOW_HOURS: 72,
        PHONE_MASK_REGEX: /^09\d{2}-\*{3}-\d{4}$/,
        RAW_PHONE_REGEX: /^09\d{9}$/
    });

    /**
     * Data Privacy Masking & Formatters
     */
    function maskContactNumber(phone) {
        if (!phone || phone === 'N/A' || phone === '-' || phone === '09XX-***-XXXX') {
            return '09XX-***-XXXX';
        }
        const digits = String(phone).replace(/\D/g, '');
        if (digits.length >= 10) {
            const prefix = digits.substring(0, 4);
            const suffix = digits.substring(digits.length - 4);
            return `${prefix}-***-${suffix}`;
        }
        return '09XX-***-XXXX';
    }

    function formatCurrencyPHP(amount) {
        const num = Number(amount) || 0;
        return '₱' + num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    /**
     * Core Schema Validation Functions
     */
    const VALIDATORS = Object.freeze({
        /**
         * Validates beneficiary update payload
         */
        validateBeneficiaryUpdate: function (data) {
            const errors = [];
            if (!data || typeof data !== 'object') {
                return { isValid: false, errors: ['Invalid beneficiary payload object'] };
            }
            if (!data.first_name || String(data.first_name).trim().length < 2) {
                errors.push('First name is required (min 2 characters).');
            }
            if (!data.last_name || String(data.last_name).trim().length < 2) {
                errors.push('Last name is required (min 2 characters).');
            }
            if (!data.barangay || String(data.barangay).trim().length < 2) {
                errors.push('Barangay is required.');
            }
            if (data.civil_status && !ENUMS.CIVIL_STATUS.includes(data.civil_status)) {
                errors.push(`Invalid civil status. Allowed: ${ENUMS.CIVIL_STATUS.join(', ')}`);
            }
            if (data.sex && !ENUMS.SEX.includes(data.sex)) {
                errors.push(`Invalid sex. Allowed: ${ENUMS.SEX.join(', ')}`);
            }
            return {
                isValid: errors.length === 0,
                errors: errors
            };
        },

        /**
         * Validates application evaluation submission
         */
        validateApplicationEvaluation: function (action, remarks, deadlineHours) {
            const errors = [];
            if (!['approve', 'deny', 'flag'].includes(action)) {
                errors.push('Action must be one of: approve, deny, flag.');
            }
            if (action === 'deny' || action === 'flag') {
                if (!remarks || String(remarks).trim().length < 10) {
                    errors.push('Mandatory evaluation remarks required (min 10 characters) when flagging or denying.');
                }
            }
            return {
                isValid: errors.length === 0,
                errors: errors,
                resubmissionWindowHours: action === 'flag' ? (deadlineHours || ENUMS.RESUBMISSION_WINDOW_HOURS) : null
            };
        },

        /**
         * Validates scheduling constraints (no past dates, no conflict)
         */
        validateScheduleSlot: function (dateStr, startTimeStr, endTimeStr, existingSlots) {
            const errors = [];
            const selectedDate = new Date(dateStr + 'T00:00:00');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (isNaN(selectedDate.getTime())) {
                errors.push('Invalid schedule date format.');
            } else if (selectedDate < today) {
                errors.push('Past Date Restriction: Scheduling on past dates is strictly prohibited.');
            }

            if (startTimeStr && endTimeStr && startTimeStr >= endTimeStr) {
                errors.push('Start time must be before end time.');
            }

            // Conflict detection
            if (existingSlots && existingSlots.length > 0 && startTimeStr && endTimeStr) {
                const hasOverlap = existingSlots.some(slot => {
                    if (slot.date !== dateStr) return false;
                    return (startTimeStr < slot.end_time && endTimeStr > slot.start_time);
                });
                if (hasOverlap) {
                    errors.push('Conflict Validation: Time slot overlaps with an existing scheduled activity.');
                }
            }

            return {
                isValid: errors.length === 0,
                errors: errors
            };
        },

        /**
         * Validates audit log record integrity
         */
        validateAuditLog: function (entry) {
            const errors = [];
            if (!entry || typeof entry !== 'object') {
                return { isValid: false, errors: ['Invalid audit entry'] };
            }
            if (!entry.action || typeof entry.action !== 'string') {
                errors.push('Audit action type is mandatory.');
            }
            if (!entry.details) {
                errors.push('Audit action details are mandatory.');
            }
            return {
                isValid: errors.length === 0,
                errors: errors
            };
        }
    });

    /**
     * UI Layout Breakpoint & Architecture Constants
     */
    const UI_LAYOUT_SPECS = Object.freeze({
        BREAKPOINTS: {
            MOBILE_MAX: '768px',
            TABLET_MAX: '991.98px',
            DESKTOP_MIN: '992px'
        },
        SIDEBAR_WIDTH_PX: 270,
        HEADER_HEIGHT_PX: 70,
        PRIMARY_ACCENT_HEX: '#F19FB9',
        ANTIQUE_ROSE_HEX: '#C87D87',
        SURFACE_LIGHT_HEX: '#FFFFFF',
        SURFACE_DARK_HEX: '#131B2A',
        BG_APP_DARK_HEX: '#0B0F17',
        MODULE_TABS: [
            'dashboard',
            'beneficiaries',
            'applications',
            'batches',
            'schedules',
            'trainings',
            'funds',
            'distribution',
            'notifications',
            'reports'
        ]
    });

    /**
     * Export Frozen Contract Interface
     */
    const contract = {
        METADATA: METADATA,
        ENUMS: ENUMS,
        UI_LAYOUT_SPECS: UI_LAYOUT_SPECS,
        VALIDATORS: VALIDATORS,
        maskContactNumber: maskContactNumber,
        formatCurrencyPHP: formatCurrencyPHP,
        isFrozen: () => true
    };

    return Object.freeze(contract);
});

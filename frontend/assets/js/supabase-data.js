/**
 * Centralized Supabase Data Service Module
 * City Government of Koronadal — PESO & CSWDO Portals
 * 
 * Provides unified, schema-aligned CRUD methods for:
 * - Programs
 * - Beneficiaries
 * - Staff Profiles & Officers
 * - Applications & Evaluations
 * - Interview Schedules & Attendance
 * - Notifications
 * - Distributions & Approved Assistance
 * - Funds Tracking & Utilization
 * - Batches
 * - Immutable Audit Logs & Activity Logs
 * 
 * Includes retry logic, privacy-compliant contact masking, and error boundary handling.
 */

const DataService = (() => {
  'use strict';

  // Helper to obtain the active Supabase client instance
  function getClient() {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      return supabaseClient;
    }
    if (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.client) {
      return SUPABASE_CONFIG.client;
    }
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient && typeof SUPABASE_CONFIG !== 'undefined') {
      return window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
    }
    console.error('[DATA_SERVICE] Supabase client is not available.');
    return null;
  }

  // Generic retry wrapper for database calls
  async function withRetry(operationFn, maxRetries = 2, delayMs = 300) {
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const client = getClient();
        if (!client) throw new Error('Database client not initialized');
        const result = await operationFn(client);
        if (result && result.error) {
          // If RLS or constraint error, don't retry uselessly
          if (result.error.code === '42501' || result.error.code === '23505') {
            return result;
          }
          throw result.error;
        }
        return result;
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          await new Promise(res => setTimeout(res, delayMs * (attempt + 1)));
        }
      }
    }
    console.warn('[DATA_SERVICE] Operation failed after retries:', lastError?.message || lastError);
    return { data: null, error: lastError };
  }

  // Data Privacy Act compliant contact masking utility
  function maskContactNumber(phone) {
    if (!phone) return '09XX-***-XXXX';
    const str = String(phone).trim();
    const clean = str.replace(/[^0-9+]/g, '');
    if (clean.length >= 10) {
      const start = clean.substring(0, 4);
      const end = clean.substring(clean.length - 4);
      return `${start}-***-${end}`;
    }
    return '09XX-***-XXXX';
  }

  // Unique QR generator for beneficiaries
  function generateQrCode() {
    const chars = '0123456789ABCDEF';
    let hex = '';
    for (let i = 0; i < 8; i++) {
      hex += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `QR-BEN-${hex}`;
  }

  // Unique application number generator
  function generateApplicationNumber(agency = 'PESO') {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${agency}-${year}-${rand}`;
  }

  // =========================================================================
  // 1. PROGRAMS DOMAIN
  // =========================================================================
  const programs = {
    async getAll(filters = {}) {
      return withRetry(async (client) => {
        let query = client.from('programs').select('*').order('name', { ascending: true });
        if (filters.agency) {
          query = query.eq('agency', filters.agency);
        }
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        return await query;
      });
    },

    async getById(id) {
      return withRetry(async (client) => {
        return await client.from('programs').select('*').eq('id', id).maybeSingle();
      });
    },

    async getByCode(code) {
      return withRetry(async (client) => {
        return await client.from('programs').select('*').eq('code', code).maybeSingle();
      });
    },

    async create(data) {
      return withRetry(async (client) => {
        const payload = {
          code: (data.code || '').trim().toUpperCase(),
          name: data.name,
          description: data.description || '',
          agency: data.agency || 'PESO',
          status: data.status || 'Active'
        };
        const res = await client.from('programs').insert(payload).select().single();
        if (!res.error && res.data) {
          auditLogs.log({
            action: 'CREATE_PROGRAM',
            entityType: 'program',
            entityId: res.data.id,
            details: `Created program ${res.data.code}: "${res.data.name}" (${res.data.agency})`
          });
        }
        return res;
      });
    },

    async update(id, data) {
      return withRetry(async (client) => {
        const updateData = { ...data };
        delete updateData.id;
        delete updateData.created_at;
        const res = await client.from('programs').update(updateData).eq('id', id).select().single();
        if (!res.error && res.data) {
          auditLogs.log({
            action: 'UPDATE_PROGRAM',
            entityType: 'program',
            entityId: id,
            details: `Updated program details for ${res.data.code} (${res.data.name})`
          });
        }
        return res;
      });
    },

    async toggleStatus(id, newStatus) {
      return withRetry(async (client) => {
        const res = await client.from('programs').update({ status: newStatus }).eq('id', id).select().single();
        if (!res.error && res.data) {
          auditLogs.log({
            action: newStatus === 'Active' ? 'ACTIVATE_PROGRAM' : 'DEACTIVATE_PROGRAM',
            entityType: 'program',
            entityId: id,
            details: `Set program ${res.data.code} status to ${newStatus}`
          });
        }
        return res;
      });
    },

    async delete(id) {
      return withRetry(async (client) => {
        const prog = await client.from('programs').select('code, name').eq('id', id).maybeSingle();
        const res = await client.from('programs').delete().eq('id', id);
        if (!res.error) {
          auditLogs.log({
            action: 'DELETE_PROGRAM',
            entityType: 'program',
            entityId: id,
            details: `Permanently deleted program ${prog.data?.code || id} (${prog.data?.name || ''})`
          });
        }
        return res;
      });
    }
  };

  // =========================================================================
  // 2. BENEFICIARIES DOMAIN
  // =========================================================================
  const beneficiaries = {
    async getAll(filters = {}) {
      return withRetry(async (client) => {
        let query = client.from('beneficiaries').select('*').order('created_at', { ascending: false });
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.search) {
          const s = `%${filters.search}%`;
          query = query.or(`first_name.ilike.${s},last_name.ilike.${s},username.ilike.${s},qr_code.ilike.${s}`);
        }
        return await query;
      });
    },

    async getByQr(qrCode) {
      return withRetry(async (client) => {
        return await client.from('beneficiaries').select('*').eq('qr_code', qrCode).maybeSingle();
      });
    },

    async getByAuthId(authId) {
      return withRetry(async (client) => {
        return await client.from('beneficiaries').select('*').eq('auth_id', authId).maybeSingle();
      });
    },

    async getByUsername(username) {
      return withRetry(async (client) => {
        return await client.from('beneficiaries').select('*').eq('username', username).maybeSingle();
      });
    },

    async create(data) {
      return withRetry(async (client) => {
        const qrCode = data.qr_code || generateQrCode();
        const payload = {
          qr_code: qrCode,
          auth_id: data.auth_id,
          username: data.username,
          first_name: data.first_name,
          middle_name: data.middle_name || null,
          last_name: data.last_name,
          suffix: data.suffix || null,
          age: parseInt(data.age) || 0,
          date_of_birth: data.date_of_birth || null,
          sex: data.sex || null,
          nationality: data.nationality || 'Filipino',
          marital_status: data.marital_status || null,
          email: data.email,
          phone: data.phone || null,
          address: data.address || null,
          id_type: data.id_type || null,
          id_file_path: data.id_file_path || null,
          terms_agreed: data.terms_agreed !== undefined ? data.terms_agreed : true,
          data_consent: data.data_consent !== undefined ? data.data_consent : true,
          status: data.status || 'Active'
        };
        const res = await client.from('beneficiaries').insert(payload).select().single();
        if (!res.error && res.data) {
          auditLogs.log({
            beneficiaryQr: qrCode,
            action: 'CREATE_BENEFICIARY',
            entityType: 'beneficiary',
            details: `Registered beneficiary ${payload.first_name} ${payload.last_name} (${qrCode})`
          });
        }
        return res;
      });
    },

    async update(qrCode, data) {
      return withRetry(async (client) => {
        const updateData = { ...data };
        delete updateData.qr_code;
        delete updateData.created_at;
        const res = await client.from('beneficiaries').update(updateData).eq('qr_code', qrCode).select().single();
        if (!res.error && res.data) {
          auditLogs.log({
            beneficiaryQr: qrCode,
            action: 'UPDATE_BENEFICIARY',
            entityType: 'beneficiary',
            details: `Updated beneficiary profile for ${res.data.first_name} ${res.data.last_name} (${qrCode})`
          });
        }
        return res;
      });
    },

    async toggleStatus(qrCode, newStatus) {
      return withRetry(async (client) => {
        const res = await client.from('beneficiaries').update({ status: newStatus }).eq('qr_code', qrCode).select().single();
        if (!res.error && res.data) {
          auditLogs.log({
            beneficiaryQr: qrCode,
            action: newStatus === 'Active' ? 'ACTIVATE_BENEFICIARY' : 'DEACTIVATE_BENEFICIARY',
            entityType: 'beneficiary',
            details: `Changed beneficiary ${qrCode} status to ${newStatus}`
          });
        }
        return res;
      });
    }
  };

  // =========================================================================
  // 3. STAFF PROFILES & OFFICERS DOMAIN
  // =========================================================================
  const staffProfiles = {
    async getAll(filters = {}) {
      return withRetry(async (client) => {
        let query = client.from('staff_profiles').select('*').order('created_at', { ascending: false });
        
        // Strict Agency/Department Record Segregation
        if (filters.agency === 'PESO' || filters.department === 'PESO') {
          query = query.in('role', ['PESO Admin', 'PESO Officer', 'Evaluator']);
        } else if (filters.agency === 'CSWDO' || filters.department === 'CSWDO') {
          query = query.in('role', ['CSWDO Admin', 'CSWDO Officer']);
        }

        if (filters.role) {
          if (Array.isArray(filters.role)) {
            query = query.in('role', filters.role);
          } else {
            query = query.eq('role', filters.role);
          }
        }
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.search) {
          const s = `%${filters.search}%`;
          query = query.or(`first_name.ilike.${s},last_name.ilike.${s},username.ilike.${s},email.ilike.${s}`);
        }
        return await query;
      });
    },

    async getById(id) {
      return withRetry(async (client) => {
        return await client.from('staff_profiles').select('*').eq('id', id).maybeSingle();
      });
    },

    async getByAuthId(authId) {
      return withRetry(async (client) => {
        return await client.from('staff_profiles').select('*').eq('auth_id', authId).maybeSingle();
      });
    },

    async getByUsername(username) {
      return withRetry(async (client) => {
        return await client.from('staff_profiles').select('*').eq('username', username).maybeSingle();
      });
    },

    async create(data) {
      return withRetry(async (client) => {
        // Enforce strict agency role validation
        const pesoRoles = ['PESO Admin', 'PESO Officer', 'Evaluator', 'Staff'];
        const cswdoRoles = ['CSWDO Admin', 'CSWDO Officer'];
        if (data.agency === 'PESO' && cswdoRoles.includes(data.role)) {
          return { error: { message: 'Cross-department violation: Cannot assign CSWDO role in PESO portal.' } };
        }
        if (data.agency === 'CSWDO' && pesoRoles.includes(data.role)) {
          return { error: { message: 'Cross-department violation: Cannot assign PESO role in CSWDO portal.' } };
        }

        const payload = {
          auth_id: data.auth_id,
          username: data.username,
          role: data.role,
          first_name: data.first_name,
          middle_name: data.middle_name || null,
          last_name: data.last_name,
          suffix: data.suffix || null,
          age: parseInt(data.age) || 0,
          date_of_birth: data.date_of_birth || null,
          sex: data.sex || null,
          nationality: data.nationality || 'Filipino',
          marital_status: data.marital_status || null,
          email: data.email,
          phone: data.phone || null,
          address: data.address || null,
          status: data.status || 'Active'
        };
        const res = await client.from('staff_profiles').insert(payload).select().single();
        if (!res.error && res.data) {
          auditLogs.log({
            staffUserId: res.data.id,
            action: 'CREATE_STAFF_ACCOUNT',
            entityType: 'staff_profile',
            entityId: res.data.id,
            details: `Created staff account "${res.data.username}" with role ${res.data.role}`
          });
        }
        return res;
      });
    },

    async update(id, data) {
      return withRetry(async (client) => {
        const updateData = { ...data };
        delete updateData.id;
        delete updateData.created_at;
        const res = await client.from('staff_profiles').update(updateData).eq('id', id).select().single();
        if (!res.error && res.data) {
          auditLogs.log({
            staffUserId: id,
            action: 'UPDATE_STAFF_ACCOUNT',
            entityType: 'staff_profile',
            entityId: id,
            details: `Updated staff profile for "${res.data.username}" (${res.data.role})`
          });
        }
        return res;
      });
    },

    async toggleStatus(id, newStatus) {
      return withRetry(async (client) => {
        const res = await client.from('staff_profiles').update({ status: newStatus }).eq('id', id).select().single();
        if (!res.error && res.data) {
          auditLogs.log({
            staffUserId: id,
            action: newStatus === 'Active' ? 'ACTIVATE_STAFF_ACCOUNT' : 'DEACTIVATE_STAFF_ACCOUNT',
            entityType: 'staff_profile',
            entityId: id,
            details: `Set staff account "${res.data.username}" status to ${newStatus}`
          });
        }
        return res;
      });
    },

    async delete(id) {
      return withRetry(async (client) => {
        const staff = await client.from('staff_profiles').select('username, role').eq('id', id).maybeSingle();
        const res = await client.from('staff_profiles').delete().eq('id', id);
        if (!res.error) {
          auditLogs.log({
            action: 'DELETE_STAFF_ACCOUNT',
            entityType: 'staff_profile',
            entityId: id,
            details: `Permanently deleted staff account "${staff.data?.username || id}" (${staff.data?.role || ''})`
          });
        }
        return res;
      });
    }
  };

  // =========================================================================
  // 4. APPLICATIONS DOMAIN
  // =========================================================================
  const applications = {
    async getAll(filters = {}) {
      return withRetry(async (client) => {
        let query = client.from('applications').select(`
          *,
          beneficiary:beneficiaries!beneficiary_qr(*),
          program:programs!program_id(*),
          officer:staff_profiles!officer_id(id, username, first_name, last_name),
          admin:staff_profiles!admin_id(id, username, first_name, last_name)
        `).order('created_at', { ascending: false });

        if (filters.agency) {
          query = query.eq('program.agency', filters.agency);
        }
        if (filters.program_id) {
          query = query.eq('program_id', filters.program_id);
        }
        if (filters.status) {
          if (Array.isArray(filters.status)) {
            query = query.in('status', filters.status);
          } else {
            query = query.eq('status', filters.status);
          }
        }
        if (filters.beneficiary_qr) {
          query = query.eq('beneficiary_qr', filters.beneficiary_qr);
        }
        if (filters.batch_id) {
          query = query.eq('batch_id', filters.batch_id);
        }
        return await query;
      });
    },

    async getById(id) {
      return withRetry(async (client) => {
        let query = client.from('applications').select(`
          *,
          beneficiary:beneficiaries!beneficiary_qr(*),
          program:programs!program_id(*),
          officer:staff_profiles!officer_id(id, username, first_name, last_name),
          admin:staff_profiles!admin_id(id, username, first_name, last_name)
        `);

        if (typeof id === 'number' || /^\d+$/.test(id)) {
          query = query.eq('id', id);
        } else {
          query = query.eq('application_number', id);
        }
        return await query.maybeSingle();
      });
    },

    async getByBeneficiary(beneficiaryQr) {
      return withRetry(async (client) => {
        return await client.from('applications').select(`
          *,
          program:programs!program_id(*)
        `).eq('beneficiary_qr', beneficiaryQr).order('created_at', { ascending: false });
      });
    },

    async create(data) {
      return withRetry(async (client) => {
        const appNumber = data.application_number || generateApplicationNumber(data.agency || 'PESO');
        const payload = {
          application_number: appNumber,
          beneficiary_qr: data.beneficiary_qr,
          program_id: data.program_id,
          date_applied: data.date_applied || new Date().toISOString().split('T')[0],
          status: data.status || 'Pending',
          progress_percent: data.progress_percent || 0,
          remarks: data.remarks || 'Application submitted',
          amount_requested: data.amount_requested || 0,
          amount_approved: data.amount_approved || null,
          documents_json: data.documents_json || null
        };
        const res = await client.from('applications').insert(payload).select().single();
        if (!res.error && res.data) {
          auditLogs.log({
            beneficiaryQr: data.beneficiary_qr,
            action: 'SUBMIT_APPLICATION',
            entityType: 'application',
            entityId: res.data.id,
            details: `Submitted application ${appNumber} for program #${data.program_id}`
          });
          activityLog.log({
            action: 'APPLICATION_SUBMITTED',
            action_title: 'New Assistance Application',
            application_id: appNumber,
            beneficiary_name: data.beneficiary_name || data.beneficiary_qr,
            program: data.program_name || 'Assistance Program',
            details: `New application (${appNumber}) submitted.`
          });
        }
        return res;
      });
    },

    async update(id, data) {
      return withRetry(async (client) => {
        const updateData = { ...data };
        delete updateData.id;
        delete updateData.created_at;
        return await client.from('applications').update(updateData).eq('id', id).select().single();
      });
    },

    async evaluate(id, evaluationData) {
      return withRetry(async (client) => {
        const decision = evaluationData.decision; // 'Approved', 'Denied', 'Pending Requirements'
        let newStatus = 'Under Review';
        if (decision === 'Approved') newStatus = 'Officer Approved';
        else if (decision === 'Denied') newStatus = 'Officer Denied';
        else if (decision === 'Pending Requirements') newStatus = 'Pending Requirements';

        const payload = {
          officer_decision: decision,
          officer_id: evaluationData.officer_id || null,
          officer_notes: evaluationData.notes || '',
          officer_action_at: new Date().toISOString(),
          status: evaluationData.status || newStatus
        };

        const res = await client.from('applications').update(payload).eq('id', id).select(`*, beneficiary:beneficiaries!beneficiary_qr(*), program:programs!program_id(*)`).single();
        if (!res.error && res.data) {
          auditLogs.log({
            staffUserId: evaluationData.officer_id || null,
            action: `OFFICER_EVALUATION_${decision.toUpperCase().replace(/\s+/g, '_')}`,
            entityType: 'application',
            entityId: id,
            details: `Officer evaluated application ${res.data.application_number} as ${decision}. Notes: ${evaluationData.notes || 'None'}`
          });

          // Also notify beneficiary
          notifications.create({
            beneficiary_qr: res.data.beneficiary_qr,
            title: `Application Update: ${res.data.program?.name || 'Assistance'}`,
            message: `Your application (${res.data.application_number}) has been evaluated as ${decision}. ${evaluationData.notes ? 'Remarks: ' + evaluationData.notes : ''}`
          });
        }
        return res;
      });
    },

    async adminApprove(id, approveData) {
      return withRetry(async (client) => {
        const payload = {
          status: 'Approved',
          amount_approved: approveData.amount_approved || null,
          admin_id: approveData.admin_id || null,
          admin_notes: approveData.notes || 'Approved by Administrator',
          progress_percent: 100
        };

        const res = await client.from('applications').update(payload).eq('id', id).select(`*, beneficiary:beneficiaries!beneficiary_qr(*), program:programs!program_id(*)`).single();
        if (!res.error && res.data) {
          auditLogs.log({
            staffUserId: approveData.admin_id || null,
            action: 'ADMIN_APPROVE_APPLICATION',
            entityType: 'application',
            entityId: id,
            details: `Admin approved application ${res.data.application_number}. Amount: ₱${Number(approveData.amount_approved || 0).toLocaleString()}`
          });

          activityLog.log({
            action: 'APPLICATION_APPROVED',
            action_title: 'Application Approved',
            application_id: res.data.application_number,
            beneficiary_name: `${res.data.beneficiary?.first_name || ''} ${res.data.beneficiary?.last_name || ''}`.trim(),
            program: res.data.program?.name || 'Assistance',
            admin_id: approveData.admin_username || 'Admin',
            details: `Approved grant for ₱${Number(approveData.amount_approved || 0).toLocaleString()}.`
          });

          notifications.create({
            beneficiary_qr: res.data.beneficiary_qr,
            title: 'Application Approved!',
            message: `Your application (${res.data.application_number}) for ${res.data.program?.name || 'Assistance'} has been approved.`
          });
        }
        return res;
      });
    },

    async adminDeny(id, denyData) {
      return withRetry(async (client) => {
        const payload = {
          status: 'Denied',
          admin_id: denyData.admin_id || null,
          admin_notes: denyData.reason || 'Disapproved by Administrator'
        };

        const res = await client.from('applications').update(payload).eq('id', id).select(`*, beneficiary:beneficiaries!beneficiary_qr(*), program:programs!program_id(*)`).single();
        if (!res.error && res.data) {
          auditLogs.log({
            staffUserId: denyData.admin_id || null,
            action: 'ADMIN_DENY_APPLICATION',
            entityType: 'application',
            entityId: id,
            details: `Admin denied application ${res.data.application_number}. Reason: ${denyData.reason || 'None'}`
          });

          activityLog.log({
            action: 'APPLICATION_DENIED',
            action_title: 'Application Denied',
            application_id: res.data.application_number,
            beneficiary_name: `${res.data.beneficiary?.first_name || ''} ${res.data.beneficiary?.last_name || ''}`.trim(),
            program: res.data.program?.name || 'Assistance',
            admin_id: denyData.admin_username || 'Admin',
            details: `Disapproved application. Reason: ${denyData.reason || 'N/A'}`
          });

          notifications.create({
            beneficiary_qr: res.data.beneficiary_qr,
            title: 'Application Update: Disapproved',
            message: `Your application (${res.data.application_number}) was not approved. Reason: ${denyData.reason || 'Contact office for details.'}`
          });
        }
        return res;
      });
    },

    async adminRelease(id, releaseData) {
      return withRetry(async (client) => {
        const payload = {
          status: 'Released',
          admin_notes: releaseData.notes || 'Funds released at disbursement desk'
        };

        const res = await client.from('applications').update(payload).eq('id', id).select(`*, beneficiary:beneficiaries!beneficiary_qr(*), program:programs!program_id(*)`).single();
        if (!res.error && res.data) {
          const amount = Number(res.data.amount_approved || res.data.amount_requested || 0);
          const progCode = res.data.program?.code;

          if (progCode) {
            funds.releaseAmount(progCode, amount);
          }

          auditLogs.log({
            staffUserId: releaseData.admin_id || null,
            action: 'RELEASE_FUNDS',
            entityType: 'application',
            entityId: id,
            details: `Disbursed funds for application ${res.data.application_number}. Amount: ₱${amount.toLocaleString()}`
          });

          activityLog.log({
            action: 'FUNDS_RELEASED',
            action_title: 'Funds Disbursed',
            application_id: res.data.application_number,
            beneficiary_name: `${res.data.beneficiary?.first_name || ''} ${res.data.beneficiary?.last_name || ''}`.trim(),
            program: res.data.program?.name || 'Assistance',
            details: `Released grant voucher of ₱${amount.toLocaleString()}.`
          });

          notifications.create({
            beneficiary_qr: res.data.beneficiary_qr,
            title: 'Assistance Grant Released',
            message: `Your assistance grant voucher (${res.data.application_number}) for ₱${amount.toLocaleString()} is released.`
          });
        }
        return res;
      });
    }
  };

  // =========================================================================
  // 5. INTERVIEWS & SCHEDULES DOMAIN
  // =========================================================================
  const interviews = {
    async getAll(filters = {}) {
      return withRetry(async (client) => {
        let query = client.from('interview_schedules').select(`
          *,
          beneficiary:beneficiaries!beneficiary_qr(*),
          program:programs!program_id(*),
          officer:staff_profiles!officer_id(id, username, first_name, last_name)
        `).order('interview_date', { ascending: true });

        if (filters.agency) {
          query = query.eq('program.agency', filters.agency);
        }
        if (filters.officer_id) {
          query = query.eq('officer_id', filters.officer_id);
        }
        if (filters.beneficiary_qr) {
          query = query.eq('beneficiary_qr', filters.beneficiary_qr);
        }
        if (filters.status) {
          if (Array.isArray(filters.status)) {
            query = query.in('status', filters.status);
          } else {
            query = query.eq('status', filters.status);
          }
        }
        if (filters.date) {
          query = query.eq('interview_date', filters.date);
        }
        return await query;
      });
    },

    async getById(id) {
      return withRetry(async (client) => {
        return await client.from('interview_schedules').select(`
          *,
          beneficiary:beneficiaries!beneficiary_qr(*),
          program:programs!program_id(*),
          officer:staff_profiles!officer_id(id, username, first_name, last_name)
        `).eq('id', id).maybeSingle();
      });
    },

    async getByBeneficiary(beneficiaryQr) {
      return withRetry(async (client) => {
        return await client.from('interview_schedules').select(`
          *,
          program:programs!program_id(*),
          officer:staff_profiles!officer_id(id, username, first_name, last_name)
        `).eq('beneficiary_qr', beneficiaryQr).order('interview_date', { ascending: true });
      });
    },

    async create(data) {
      return withRetry(async (client) => {
        const payload = {
          application_id: data.application_id || null,
          beneficiary_qr: data.beneficiary_qr,
          program_id: data.program_id,
          officer_id: data.officer_id,
          interview_date: data.interview_date,
          interview_time: data.interview_time,
          venue_location: data.venue_location || 'PESO Main Office',
          status: data.status || 'Scheduled',
          attendance_status: data.attendance_status || 'Unmarked',
          remarks: data.remarks || null
        };
        const res = await client.from('interview_schedules').insert(payload).select().single();
        if (!res.error && res.data) {
          auditLogs.log({
            staffUserId: data.officer_id,
            action: 'SCHEDULE_INTERVIEW',
            entityType: 'interview_schedule',
            entityId: res.data.id,
            details: `Scheduled interview on ${data.interview_date} ${data.interview_time} at ${payload.venue_location}`
          });
          notifications.create({
            beneficiary_qr: data.beneficiary_qr,
            title: 'New Interview / Activity Schedule',
            message: `You have an activity scheduled on ${data.interview_date} at ${data.interview_time}. Venue: ${payload.venue_location}.`
          });
        }
        return res;
      });
    },

    async update(id, data) {
      return withRetry(async (client) => {
        const updateData = { ...data };
        delete updateData.id;
        delete updateData.created_at;
        return await client.from('interview_schedules').update(updateData).eq('id', id).select().single();
      });
    },

    async markAttendance(id, attendanceData) {
      return withRetry(async (client) => {
        const status = attendanceData.attendance_status === 'Present' ? 'Completed' : (attendanceData.attendance_status === 'Absent' ? 'Missed' : 'Scheduled');
        const payload = {
          attendance_status: attendanceData.attendance_status,
          status: attendanceData.status || status,
          remarks: attendanceData.remarks || null
        };
        const res = await client.from('interview_schedules').update(payload).eq('id', id).select().single();
        if (!res.error && res.data) {
          auditLogs.log({
            action: 'MARK_ATTENDANCE',
            entityType: 'interview_schedule',
            entityId: id,
            details: `Marked attendance for interview #${id} as ${attendanceData.attendance_status}`
          });
        }
        return res;
      });
    },

    async reschedule(id, rescheduleData) {
      return withRetry(async (client) => {
        const payload = {
          interview_date: rescheduleData.interview_date,
          interview_time: rescheduleData.interview_time,
          venue_location: rescheduleData.venue_location || undefined,
          status: 'Scheduled',
          remarks: rescheduleData.remarks || 'Rescheduled'
        };
        const res = await client.from('interview_schedules').update(payload).eq('id', id).select(`*, beneficiary:beneficiaries!beneficiary_qr(*)`).single();
        if (!res.error && res.data) {
          auditLogs.log({
            action: 'RESCHEDULE_INTERVIEW',
            entityType: 'interview_schedule',
            entityId: id,
            details: `Rescheduled interview #${id} to ${rescheduleData.interview_date} (${rescheduleData.interview_time})`
          });
          notifications.create({
            beneficiary_qr: res.data.beneficiary_qr,
            title: 'Schedule Updated',
            message: `Your interview schedule was updated to ${rescheduleData.interview_date} at ${rescheduleData.interview_time}.`
          });
        }
        return res;
      });
    },

    async cancel(id, cancelData) {
      return withRetry(async (client) => {
        const payload = {
          status: 'Cancelled',
          remarks: cancelData.reason || 'Cancelled by Admin'
        };
        const res = await client.from('interview_schedules').update(payload).eq('id', id).select(`*, beneficiary:beneficiaries!beneficiary_qr(*)`).single();
        if (!res.error && res.data) {
          auditLogs.log({
            action: 'CANCEL_INTERVIEW',
            entityType: 'interview_schedule',
            entityId: id,
            details: `Cancelled interview #${id}. Reason: ${cancelData.reason || 'None'}`
          });
        }
        return res;
      });
    }
  };

  // =========================================================================
  // 6. NOTIFICATIONS DOMAIN
  // =========================================================================
  const notifications = {
    async getByBeneficiary(beneficiaryQr) {
      return withRetry(async (client) => {
        return await client.from('notifications').select('*').eq('beneficiary_qr', beneficiaryQr).order('created_at', { ascending: false });
      });
    },

    async getByStaff(staffUserId) {
      return withRetry(async (client) => {
        return await client.from('notifications').select('*').eq('staff_user_id', staffUserId).order('created_at', { ascending: false });
      });
    },

    async create(data) {
      return withRetry(async (client) => {
        const payload = {
          title: data.title,
          message: data.message,
          is_read: false
        };
        if (data.beneficiary_qr) {
          payload.beneficiary_qr = data.beneficiary_qr;
        } else if (data.staff_user_id) {
          payload.staff_user_id = data.staff_user_id;
        }
        return await client.from('notifications').insert(payload).select().single();
      });
    },

    async markAsRead(id) {
      return withRetry(async (client) => {
        return await client.from('notifications').update({ is_read: true }).eq('id', id);
      });
    },

    async markAllAsRead(recipient = {}) {
      return withRetry(async (client) => {
        let query = client.from('notifications').update({ is_read: true });
        if (recipient.beneficiary_qr) {
          query = query.eq('beneficiary_qr', recipient.beneficiary_qr);
        } else if (recipient.staff_user_id) {
          query = query.eq('staff_user_id', recipient.staff_user_id);
        }
        return await query;
      });
    }
  };

  // =========================================================================
  // 7. DISTRIBUTIONS & APPROVED ASSISTANCE DOMAIN
  // =========================================================================
  const distributions = {
    async getAll(filters = {}) {
      return withRetry(async (client) => {
        let query = client.from('distributions').select(`
          *,
          application:applications!application_id(
            id, application_number,
            beneficiary:beneficiaries!beneficiary_qr(*),
            program:programs!program_id(*)
          )
        `).order('distribution_date', { ascending: true });

        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        return await query;
      });
    },

    async getByBeneficiary(beneficiaryQr) {
      return withRetry(async (client) => {
        // Query through applications
        return await client.from('distributions').select(`
          *,
          application:applications!application_id(
            id, application_number, beneficiary_qr,
            program:programs!program_id(*)
          )
        `).order('distribution_date', { ascending: true });
      });
    },

    async create(data) {
      return withRetry(async (client) => {
        const payload = {
          application_id: data.application_id,
          distribution_date: data.distribution_date,
          distribution_time: data.distribution_time || '09:00 AM',
          location: data.location || 'City Hall Distribution Center',
          amount: data.amount || 0,
          status: data.status || 'Pending'
        };
        return await client.from('distributions').insert(payload).select().single();
      });
    },

    async update(id, data) {
      return withRetry(async (client) => {
        return await client.from('distributions').update(data).eq('id', id).select().single();
      });
    }
  };

  const approvedAssistance = {
    async getAll(filters = {}) {
      return withRetry(async (client) => {
        let query = client.from('approved_assistance').select(`
          *,
          beneficiary:beneficiaries!beneficiary_qr(*),
          program:programs!program_id(*),
          officer:staff_profiles!officer_id(id, username, first_name, last_name)
        `).order('approval_date', { ascending: false });

        if (filters.beneficiary_qr) {
          query = query.eq('beneficiary_qr', filters.beneficiary_qr);
        }
        if (filters.program_id) {
          query = query.eq('program_id', filters.program_id);
        }
        return await query;
      });
    },

    async getByBeneficiary(beneficiaryQr) {
      return withRetry(async (client) => {
        return await client.from('approved_assistance').select(`
          *,
          program:programs!program_id(*),
          officer:staff_profiles!officer_id(id, username, first_name, last_name)
        `).eq('beneficiary_qr', beneficiaryQr).order('approval_date', { ascending: false });
      });
    },

    async create(data) {
      return withRetry(async (client) => {
        const payload = {
          application_id: data.application_id || null,
          beneficiary_qr: data.beneficiary_qr,
          program_id: data.program_id,
          assistance_type: data.assistance_type,
          quantity_amount: data.quantity_amount,
          conditions: data.conditions || null,
          approval_date: data.approval_date || new Date().toISOString().split('T')[0],
          officer_id: data.officer_id
        };
        const res = await client.from('approved_assistance').insert(payload).select().single();
        if (!res.error && res.data) {
          auditLogs.log({
            staffUserId: data.officer_id,
            action: 'RECORD_APPROVED_ASSISTANCE',
            entityType: 'approved_assistance',
            entityId: res.data.id,
            details: `Recorded approved assistance (${payload.assistance_type}: ${payload.quantity_amount}) for beneficiary ${payload.beneficiary_qr}`
          });
        }
        return res;
      });
    }
  };

  // =========================================================================
  // 8. FUNDS TRACKING DOMAIN (CSWDO & General)
  // =========================================================================
  const funds = {
    async getAll() {
      return withRetry(async (client) => {
        return await client.from('funds').select('*').order('id', { ascending: true });
      });
    },

    async getByCode(programCode) {
      return withRetry(async (client) => {
        return await client.from('funds').select('*').eq('program_code', programCode).maybeSingle();
      });
    },

    async releaseAmount(programCode, amount) {
      return withRetry(async (client) => {
        const fundRes = await client.from('funds').select('*').eq('program_code', programCode).maybeSingle();
        if (fundRes.data) {
          const newReleased = Number(fundRes.data.released_amount || 0) + Number(amount || 0);
          return await client.from('funds').update({
            released_amount: newReleased,
            updated_at: new Date().toISOString()
          }).eq('id', fundRes.data.id).select().single();
        }
        return fundRes;
      });
    },

    async update(id, data) {
      return withRetry(async (client) => {
        return await client.from('funds').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      });
    }
  };

  // =========================================================================
  // 9. AUDIT LOGS & ACTIVITY LOGS DOMAIN
  // =========================================================================
  const auditLogs = {
    async getAll(filters = {}) {
      return withRetry(async (client) => {
        let query = client.from('audit_logs').select(`
          *,
          staff:staff_profiles!staff_user_id(id, username, first_name, last_name, role)
        `).order('created_at', { ascending: false });

        if (filters.limit) {
          query = query.limit(filters.limit);
        }
        if (filters.action) {
          query = query.eq('action', filters.action);
        }
        if (filters.entityType) {
          query = query.eq('entity_type', filters.entityType);
        }
        return await query;
      });
    },

    async log(data) {
      try {
        const client = getClient();
        if (!client) return;

        let staffUserId = data.staffUserId;
        let beneficiaryQr = data.beneficiaryQr;

        // Auto-resolve user identity if not provided
        if (!staffUserId && !beneficiaryQr && typeof AuthGuard !== 'undefined') {
          const profile = AuthGuard.getProfile();
          if (profile) {
            if (profile.role === 'Beneficiary' || profile.qr_code) {
              beneficiaryQr = profile.qr_code || profile.id;
            } else if (profile.id && typeof profile.id === 'number') {
              staffUserId = profile.id;
            }
          }
        }

        // Schema requires exactly one recipient/actor to be set
        if (!staffUserId && !beneficiaryQr) {
          // Default fallback to admin profile if available
          staffUserId = parseInt(sessionStorage.getItem('userId')) || null;
        }

        // If still neither is set, create a harmless log entry without violating constraint
        const payload = {
          action: data.action || 'SYSTEM_ACTION',
          entity_type: data.entityType || 'general',
          entity_id: data.entityId ? parseInt(data.entityId) : null,
          details: data.details || ''
        };

        if (staffUserId && !beneficiaryQr) {
          payload.staff_user_id = staffUserId;
        } else if (beneficiaryQr) {
          payload.beneficiary_qr = beneficiaryQr;
        }

        if (payload.staff_user_id || payload.beneficiary_qr) {
          await client.from('audit_logs').insert(payload);
        }
      } catch (err) {
        console.warn('[DATA_SERVICE] Audit log insert note:', err.message);
      }
    }
  };

  const activityLog = {
    async getAll(filters = {}) {
      return withRetry(async (client) => {
        let query = client.from('activity_log').select('*').order('timestamp', { ascending: false });
        if (filters.limit) {
          query = query.limit(filters.limit);
        }
        return await query;
      });
    },

    async log(data) {
      try {
        const client = getClient();
        if (!client) return;
        const payload = {
          action: data.action || 'ACTION',
          action_title: data.action_title || data.action,
          application_id: data.application_id || null,
          beneficiary_name: data.beneficiary_name || null,
          program: data.program || null,
          admin_id: data.admin_id || sessionStorage.getItem('username') || 'System',
          details: data.details || '',
          status: data.status || 'SUCCESS',
          timestamp: new Date().toISOString()
        };
        await client.from('activity_log').insert(payload);
      } catch (err) {
        console.warn('[DATA_SERVICE] Activity log insert note:', err.message);
      }
    }
  };

  // =========================================================================
  // 10. BATCHES DOMAIN
  // =========================================================================
  const batches = {
    async getAll(filters = {}) {
      return withRetry(async (client) => {
        let query = client.from('batches').select(`
          *,
          program:programs!program_id(*),
          applications:applications(id, beneficiary_qr, status, amount_approved)
        `).order('created_at', { ascending: false });
        if (filters.program_code) {
          query = query.eq('program_code', filters.program_code);
        }
        if (filters.program_id) {
          query = query.eq('program_id', filters.program_id);
        }
        return await query;
      });
    },

    async getById(id) {
      return withRetry(async (client) => {
        return await client.from('batches').select(`
          *,
          program:programs!program_id(*),
          applications:applications(
            id,
            application_number,
            status,
            date_applied,
            amount_approved,
            beneficiary:beneficiaries!beneficiary_qr(*)
          )
        `).eq('id', id).maybeSingle();
      });
    },

    async create(data) {
      return withRetry(async (client) => {
        const payload = {
          name: data.name || data.batch_num,
          program_id: data.program_id || null,
          program_code: data.program_code || null,
          capacity: data.capacity || data.total || 50,
          created_by: data.created_by || null
        };
        return await client.from('batches').insert(payload).select().single();
      });
    },

    async assignApplication(applicationId, batchId) {
      return withRetry(async (client) => {
        return await client.from('applications').update({ batch_id: batchId }).eq('id', applicationId);
      });
    }
  };

  // =========================================================================
  // 11. REALTIME SUBSCRIPTIONS
  // =========================================================================
  const realtime = {
    subscribe(table, onEvent, filter) {
      try {
        const client = getClient();
        if (!client || typeof client.channel !== 'function') return null;
        const channelName = `rt_${table}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const opts = { event: '*', schema: 'public', table: table };
        if (filter) opts.filter = filter;
        const channel = client
          .channel(channelName)
          .on('postgres_changes', opts, (payload) => {
            if (typeof onEvent === 'function') onEvent(payload);
          })
          .subscribe();
        return channel;
      } catch (err) {
        console.warn(`[REALTIME] Failed to subscribe to ${table}:`, err);
        return null;
      }
    },

    subscribeMulti(tables, onEvent) {
      try {
        const client = getClient();
        if (!client || typeof client.channel !== 'function') return null;
        const channelName = `rt_multi_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        let channel = client.channel(channelName);
        tables.forEach((tbl) => {
          channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: tbl }, (payload) => {
            if (typeof onEvent === 'function') onEvent({ table: tbl, ...payload });
          });
        });
        return channel.subscribe();
      } catch (err) {
        console.warn('[REALTIME] Failed to subscribe to multiple tables:', err);
        return null;
      }
    },

    unsubscribe(channel) {
      try {
        const client = getClient();
        if (client && channel) {
          client.removeChannel(channel);
        }
      } catch (err) {
        console.warn('[REALTIME] Unsubscribe error:', err);
      }
    }
  };

  // =========================================================================
  // 14. TRACKING & QR SCAN MILESTONES DOMAIN (100% Real-Time Supabase)
  // =========================================================================
  const tracking = {
    // Record a scan milestone checkpoint at any office station directly into Supabase
    async recordScanMilestone(qrCode, { stage, title, notes, officerId, officerName, agency = 'PESO', newStatus = null }) {
      return withRetry(async (client) => {
        // 1. Verify beneficiary exists in Supabase
        const benRes = await client.from('beneficiaries').select('*').eq('qr_code', qrCode).maybeSingle();
        if (!benRes.data) {
          return { data: null, error: new Error(`Beneficiary not found for QR code: ${qrCode}`) };
        }
        const beneficiary = benRes.data;

        // 2. Find active or latest application for this beneficiary
        const appRes = await client
          .from('applications')
          .select(`*, program:programs!program_id(*)`)
          .eq('beneficiary_qr', qrCode)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let updatedApp = null;
        if (appRes.data && newStatus) {
          let progressPercent = 20;
          if (newStatus === 'Under Review' || newStatus === 'Pending Requirements') progressPercent = 40;
          if (newStatus === 'Interview Scheduled' || newStatus === 'Training Scheduled') progressPercent = 60;
          if (newStatus === 'Officer Approved' || newStatus === 'Approved') progressPercent = 80;
          if (newStatus === 'Completed' || newStatus === 'Released') progressPercent = 100;

          const updatePayload = {
            status: newStatus,
            progress_percent: progressPercent,
            officer_notes: notes || `Checkpoint reached: ${stage}`,
            updated_at: new Date().toISOString()
          };
          if (officerId) updatePayload.officer_id = officerId;

          const patchRes = await client.from('applications').update(updatePayload).eq('id', appRes.data.id).select(`*, program:programs!program_id(*)`).single();
          if (patchRes.data) updatedApp = patchRes.data;
        }

        // 3. Insert real-time notification for beneficiary into Supabase
        const notifTitle = title || `Transaction Update: ${stage}`;
        const notifMessage = notes || `Your assistance transaction was scanned at the ${agency} ${stage} checkpoint by ${officerName || 'an officer'}.`;
        
        await client.from('notifications').insert({
          beneficiary_qr: qrCode,
          title: notifTitle,
          message: notifMessage,
          is_read: false,
          created_at: new Date().toISOString()
        });

        // 4. Record Immutable Audit Log in Supabase
        await client.from('audit_logs').insert({
          staff_user_id: officerId || null,
          beneficiary_qr: qrCode,
          action: 'QR_SCAN_CHECKPOINT',
          entity_type: 'application',
          entity_id: appRes.data ? appRes.data.id : null,
          details: `QR Code ${qrCode} scanned at checkpoint [${stage}] by ${officerName || 'Officer'}. Notes: ${notes || 'None'}`
        });

        return {
          data: {
            success: true,
            beneficiary,
            application: updatedApp || appRes.data,
            checkpoint: stage,
            scannedAt: new Date().toISOString()
          },
          error: null
        };
      });
    },

    // Get live chronological tracking history directly from Supabase
    async getTimelineHistory(qrCode) {
      return withRetry(async (client) => {
        const [appRes, notifRes, auditRes, interviewRes, assistRes] = await Promise.all([
          client.from('applications').select(`*, program:programs!program_id(*)`).eq('beneficiary_qr', qrCode).order('created_at', { ascending: false }),
          client.from('notifications').select('*').eq('beneficiary_qr', qrCode).order('created_at', { ascending: false }),
          client.from('audit_logs').select('*').eq('beneficiary_qr', qrCode).order('created_at', { ascending: false }),
          client.from('interview_schedules').select(`*, program:programs!program_id(*)`).eq('beneficiary_qr', qrCode).order('interview_date', { ascending: false }),
          client.from('approved_assistance').select(`*, program:programs!program_id(*)`).eq('beneficiary_qr', qrCode).order('approval_date', { ascending: false })
        ]);

        return {
          data: {
            applications: appRes.data || [],
            notifications: notifRes.data || [],
            auditLogs: auditRes.data || [],
            interviews: interviewRes.data || [],
            assistance: assistRes.data || []
          },
          error: null
        };
      });
    }
  };

  return Object.freeze({
    getClient,
    withRetry,
    maskContactNumber,
    generateQrCode,
    generateApplicationNumber,
    programs,
    beneficiaries,
    staffProfiles,
    applications,
    interviews,
    notifications,
    distributions,
    approvedAssistance,
    funds,
    auditLogs,
    activityLog,
    batches,
    realtime,
    tracking
  });
})();

// Global shortcut
window.DataService = DataService;

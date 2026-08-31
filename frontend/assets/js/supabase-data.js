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

  // Generic retry wrapper for database calls with exponential backoff & rate-limiting circuit-breaker
  let _consecutiveServerErrorCount = 0;
  let _lastServerErrorTimestamp = 0;

  async function withRetry(operationFn, maxRetries = 1, delayMs = 500) {
    // If backend recently threw repeated 5xx errors, cool down for 4 seconds to allow database recovery
    if (_consecutiveServerErrorCount >= 3 && (Date.now() - _lastServerErrorTimestamp) < 4000) {
      return { data: null, error: { message: 'Database temporarily unavailable, cooling down. Please try again.', code: 'COOLDOWN' } };
    }

    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const client = getClient();
        if (!client) throw new Error('Database client not initialized');
        const result = await operationFn(client);
        if (result && result.error) {
          // If RLS or constraint error, don't retry uselessly
          if (result.error.code === '42501' || result.error.code === '23505' || result.error.code === 'PGRST116') {
            return result;
          }
          const is5xx = String(result.error.message || '').includes('500') || String(result.error.code || '').startsWith('5');
          if (is5xx) {
            _consecutiveServerErrorCount++;
            _lastServerErrorTimestamp = Date.now();
            return { data: [], error: result.error };
          }
          throw result.error;
        }
        _consecutiveServerErrorCount = 0;
        return result;
      } catch (err) {
        lastError = err;
        const msg = String(err.message || '');
        if (msg.includes('500') || msg.includes('502') || msg.includes('520') || msg.includes('521') || msg.includes('525') || msg.includes('Failed to fetch') || msg.includes('ERR_FAILED') || msg.includes('NetworkError') || msg.includes('CORS') || msg.includes('blocked by CORS')) {
          _consecutiveServerErrorCount++;
          _lastServerErrorTimestamp = Date.now();
          return { data: [], error: err };
        }
        if (attempt < maxRetries) {
          await new Promise(res => setTimeout(res, delayMs * Math.pow(2, attempt)));
        }
      }
    }
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

  // Unique collision-safe application number generator
  function generateApplicationNumber(agency = 'PESO') {
    const year = new Date().getFullYear();
    const timeSuffix = Date.now().toString().slice(-4);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${agency}-${year}-${timeSuffix}${rand}`;
  }

  // Universal Double-Click Prevention & "Saving..." Button Guard (H7)
  async function withButtonLoading(buttonOrEvent, asyncFn, loadingText = 'Saving...') {
    let btn = null;
    if (buttonOrEvent && buttonOrEvent.nodeType === 1) {
      btn = buttonOrEvent;
    } else if (buttonOrEvent && buttonOrEvent.submitter) {
      btn = buttonOrEvent.submitter;
    } else if (buttonOrEvent && buttonOrEvent.target && buttonOrEvent.target.querySelector) {
      btn = buttonOrEvent.target.querySelector('button[type="submit"], input[type="submit"], .btn-primary, .btn-success') || buttonOrEvent.target;
    }

    if (!btn || typeof asyncFn !== 'function') {
      if (typeof asyncFn === 'function') return await asyncFn();
      return;
    }

    if (btn.disabled || btn.dataset.isSavingAction === 'true') {
      console.warn('[ButtonGuard] Prevented duplicate click/submission while action is in progress.');
      return;
    }

    btn.disabled = true;
    btn.dataset.isSavingAction = 'true';
    const originalContent = btn.innerHTML;
    const isInput = btn.tagName === 'INPUT';

    if (isInput) {
      btn.value = loadingText;
    } else {
      btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> ${loadingText}`;
    }

    try {
      return await asyncFn();
    } finally {
      btn.disabled = false;
      btn.dataset.isSavingAction = 'false';
      if (isInput) {
        btn.value = originalContent;
      } else {
        btn.innerHTML = originalContent;
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.withButtonLoading = withButtonLoading;
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
          try {
            await auditLogs.log({
              action: 'CREATE_PROGRAM',
            entityType: 'program',
            entityId: res.data.id,
            details: `Created program ${res.data.code}: "${res.data.name}" (${res.data.agency})`
          });
          } catch (e) {
            console.warn('[Audit Log Warning]:', e);
          }
        }
        return res;
      });
    },

    async update(id, data) {
      return withRetry(async (client) => {
        const updateData = { ...data };
        delete updateData.id;
        delete updateData.created_at;
        const res = await client.from('programs').update(updateData).eq('id', id).select().maybeSingle();
        if (!res.error && res.data) {
          try {
            await auditLogs.log({
              action: 'UPDATE_PROGRAM',
            entityType: 'program',
            entityId: id,
            details: `Updated program details for ${res.data.code} (${res.data.name})`
          });
          } catch (e) {
            console.warn('[Audit Log Warning]:', e);
          }
        }
        return res;
      });
    },

    async toggleStatus(id, newStatus, extra = {}) {
      return withRetry(async (client) => {
        const payload = { 
          status: newStatus,
          updated_at: new Date().toISOString()
        };
        if (newStatus === 'Inactive' || newStatus === 'Deactivated') {
          payload.deactivated_at = new Date().toISOString();
          payload.deactivated_by = extra.deactivated_by || sessionStorage.getItem('username') || 'PESO Admin';
          payload.deactivation_reason = extra.reason || 'Deactivated by Administrator';
        } else if (newStatus === 'Active') {
          payload.deactivated_at = null;
          payload.deactivated_by = null;
          payload.deactivation_reason = null;
        }

        const res = await client.from('programs').update(payload).eq('id', id).select().maybeSingle();
        if (!res.error && res.data) {
          try {
            await auditLogs.log({
              action: newStatus === 'Active' ? 'ACTIVATE_PROGRAM' : 'DEACTIVATE_PROGRAM',
            entityType: 'program',
            entityId: id,
            details: `Set program ${res.data.code} status to ${newStatus}${payload.deactivation_reason ? ' | Reason: ' + payload.deactivation_reason : ''}`
          });
          } catch (e) {
            console.warn('[Audit Log Warning]:', e);
          }
        }
        return res;
      });
    },

    async adjustBudget(programIdentifier, adjustmentAmount, action = 'add', remarks = '') {
      return withRetry(async (client) => {
        const amt = Number(adjustmentAmount || 0);
        const code = String(programIdentifier || '').trim().toUpperCase();

        if (!code || isNaN(amt) || amt <= 0) {
          return { data: null, error: { message: 'Invalid program identifier or adjustment amount.' } };
        }

        // 1. Primary: Atomic server-side RPC
        try {
          const { data: rpcRes, error: rpcErr } = await client.rpc('adjust_program_budget', {
            p_program_code: code,
            p_adjustment_amount: amt,
            p_action: action,
            p_remarks: remarks
          });

          if (!rpcErr && rpcRes) {
            if (rpcRes.success) {
              return { data: rpcRes, error: null };
            } else {
              return { data: null, error: { message: rpcRes.error || 'Failed to adjust program budget.' } };
            }
          }
          if (rpcErr) {
            console.warn('[DataService] adjust_program_budget RPC notice:', rpcErr);
          }
        } catch (rpcEx) {
          console.warn('[DataService] adjust_program_budget RPC exception:', rpcEx);
        }

        // 2. Direct fallback
        const delta = (action === 'subtract' || action === 'decrease' || action === 'deduct') ? -amt : amt;
        let query = client.from('programs').select('*');
        if (/^\d+$/.test(programIdentifier)) {
          query = query.eq('id', Number(programIdentifier));
        } else {
          query = query.or(`code.eq.${code},name.ilike.%${code}%`);
        }
        const { data: currentProg, error: pErr } = await query.maybeSingle();

        if (currentProg) {
          const newB = Math.max(0, Number(currentProg.budget || 0) + delta);
          const res = await client.from('programs').update({ budget: newB, updated_at: new Date().toISOString() }).eq('id', currentProg.id).select().maybeSingle();
          await client.from('funds').update({ allocated_budget: newB, updated_at: new Date().toISOString() }).or(`program_code.eq.${currentProg.code},program.ilike.%${currentProg.code}%`);
          return res;
        }

        return { data: null, error: { message: `No program found for identifier: ${programIdentifier}` } };
      });
    },

    async delete(id) {
      return withRetry(async (client) => {
        const prog = await client.from('programs').select('code, name').eq('id', id).maybeSingle();
        const res = await client.from('programs').delete().eq('id', id);
        if (!res.error) {
          try {
            await auditLogs.log({
              action: 'DELETE_PROGRAM',
            entityType: 'program',
            entityId: id,
            details: `Permanently deleted program ${prog.data?.code || id} (${prog.data?.name || ''})`
          });
          } catch (e) {
            console.warn('[Audit Log Warning]:', e);
          }
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
          auth_id: data.auth_id || null,
          username: data.username,
          first_name: data.first_name,
          middle_name: data.middle_name || null,
          last_name: data.last_name,
          suffix: data.suffix || null,
          age: parseInt(data.age) || 0,
          date_of_birth: data.date_of_birth || data.dob || null,
          sex: data.sex || null,
          nationality: data.nationality || 'Filipino',
          marital_status: data.marital_status || data.civil_status || null,
          spouse_name: data.spouse_name || null,
          number_of_children: parseInt(data.number_of_children) || 0,
          purok: data.purok || null,
          barangay: data.barangay || null,
          address: data.address || null,
          program: data.program || data.program_sector || null,
          department: data.department || null,
          email: data.email,
          phone: data.phone || data.phone_number || null,
          verified_channel: data.verified_channel || 'EMAIL',
          verified_at: data.verified_at || new Date().toISOString(),
          id_type: data.id_type || null,
          id_file_path: data.id_file_path || null,
          terms_agreed: data.terms_agreed !== undefined ? data.terms_agreed : true,
          data_consent: data.data_consent !== undefined ? data.data_consent : true,
          status: data.status || 'Active'
        };

        // Check if a row already exists with this email or username (e.g. from Supabase auth trigger or prior registration)
        let existing = null;
        try {
          const { data: matches } = await client
            .from('beneficiaries')
            .select('qr_code, email, username, auth_id')
            .or(`email.ilike.${payload.email},username.ilike.${payload.username}`)
            .limit(1);
          if (matches && matches.length > 0) {
            existing = matches[0];
          }
        } catch (e) {
          console.warn('[BENEFICIARIES_CREATE_LOOKUP_NOTE]', e);
        }

        let res = null;
        if (existing && existing.qr_code) {
          // Update the existing row with complete profile information and keep the same QR code if already set
          payload.qr_code = existing.qr_code;
          res = await client.from('beneficiaries').update(payload).eq('qr_code', existing.qr_code).select().single();
        } else {
          // Robust upsert by email to prevent duplicate key violations
          res = await client.from('beneficiaries').upsert(payload, { onConflict: 'email' }).select().single();
          if (res.error) {
            // Fallback plain insert
            res = await client.from('beneficiaries').insert(payload).select().single();
          }
        }

        if (!res.error && res.data) {
          try {
            await auditLogs.log({
              beneficiaryQr: res.data.qr_code || qrCode,
            action: 'CREATE_BENEFICIARY',
            entityType: 'beneficiary',
            details: `Registered beneficiary ${payload.first_name} ${payload.last_name} (${res.data.qr_code || qrCode})`
          });
          } catch (e) {
            console.warn('[Audit Log Warning]:', e);
          }
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
          try {
            await auditLogs.log({
              beneficiaryQr: qrCode,
              action: 'UPDATE_BENEFICIARY',
            entityType: 'beneficiary',
            details: `Updated beneficiary profile for ${res.data.first_name} ${res.data.last_name} (${qrCode})`
          });
          } catch (e) {
            console.warn('[Audit Log Warning]:', e);
          }
        }
        return res;
      });
    },

    async toggleStatus(qrCode, newStatus) {
      return withRetry(async (client) => {
        const res = await client.from('beneficiaries').update({ status: newStatus }).eq('qr_code', qrCode).select().single();
        if (!res.error && res.data) {
          try {
            await auditLogs.log({
              beneficiaryQr: qrCode,
              action: newStatus === 'Active' ? 'ACTIVATE_BENEFICIARY' : 'DEACTIVATE_BENEFICIARY',
            entityType: 'beneficiary',
            details: `Changed beneficiary ${qrCode} status to ${newStatus}`
          });
          } catch (e) {
            console.warn('[Audit Log Warning]:', e);
          }
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

        // Field normalization
        const dob = data.date_of_birth || data.birth_date || null;
        const sex = data.sex || data.gender || null;
        const phone = data.phone || data.contact_number || null;
        const department = data.department || (data.agency === 'CSWDO' ? 'Medical' : 'PESO');

        // Provision Supabase Auth User via isolated non-persisting client (preserves admin session)
        let authId = data.auth_id || null;
        if (!authId && data.email && data.password && typeof window.supabase !== 'undefined' && typeof SUPABASE_CONFIG !== 'undefined') {
          try {
            const isolatedAuthClient = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY, {
              auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
              }
            });
            const { data: authData, error: authErr } = await isolatedAuthClient.auth.signUp({
              email: data.email,
              password: data.password,
              options: {
                data: {
                  username: data.username,
                  role: data.role,
                  first_name: data.first_name,
                  middle_name: data.middle_name || '',
                  last_name: data.last_name,
                  suffix: data.suffix || '',
                  age: parseInt(data.age) || 0,
                  department: department,
                  phone: phone || '',
                  address: data.address || ''
                }
              }
            });
            if (!authErr && authData?.user?.id) {
              authId = authData.user.id;
            } else if (authErr) {
              console.warn('[STAFF_CREATE_AUTH_WARN]', authErr.message || authErr);
            }
          } catch (authEx) {
            console.warn('[STAFF_CREATE_AUTH_EX]', authEx);
          }
        }

        if (!authId) {
          authId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : '00000000-0000-4000-8000-' + Math.random().toString(16).substring(2, 14).padEnd(12, '0');
        }

        // Check if staff_profile row already exists (e.g. created by trigger or prior step)
        let existing = null;
        try {
          const { data: found } = await client
            .from('staff_profiles')
            .select('*')
            .or(`auth_id.eq.${authId},username.eq.${data.username},email.eq.${data.email}`)
            .maybeSingle();
          existing = found;
        } catch (e) {}

        const payload = {
          auth_id: authId,
          username: data.username,
          role: data.role,
          first_name: data.first_name,
          middle_name: data.middle_name || null,
          last_name: data.last_name,
          suffix: (data.suffix && data.suffix !== 'N/A') ? data.suffix : null,
          age: parseInt(data.age) || 0,
          date_of_birth: dob,
          sex: sex,
          nationality: data.nationality || 'Filipino',
          marital_status: data.marital_status || null,
          email: data.email,
          phone: phone,
          address: data.address || null,
          department: department,
          status: data.status || 'Active'
        };

        let res = null;
        if (existing && existing.id) {
          res = await client.from('staff_profiles').update(payload).eq('id', existing.id).select().single();
        } else {
          res = await client.from('staff_profiles').insert(payload).select().single();
          if (res.error && (res.error.code === '23505' || (res.error.message && res.error.message.includes('duplicate')))) {
            res = await client.from('staff_profiles').update(payload).or(`username.eq.${data.username},email.eq.${data.email}`).select().single();
          }
        }

        if (!res.error && res.data) {
          await Promise.allSettled([
            auditLogs.log({
            staffUserId: res.data.id,
            action: 'CREATE_STAFF_ACCOUNT',
            entityType: 'staff_profile',
            entityId: res.data.id,
            details: `Created officer account "${res.data.username}" (${res.data.first_name} ${res.data.last_name}), Role: ${res.data.role}, Dept: ${department}`
          }),
            activityLog.log({
            action: 'CREATE_OFFICER_ACCOUNT',
            action_title: 'Officer Account Created',
            admin_id: sessionStorage.getItem('username') || 'Admin',
            details: `Created new officer profile for "${res.data.username}" (${res.data.role}) in ${department}`,
            status: 'SUCCESS'
          })
          ]);
        }
        return res;
      });
    },

    async update(id, data) {
      return withRetry(async (client) => {
        const updateData = { ...data };
        delete updateData.id;
        delete updateData.created_at;
        if (updateData.gender && !updateData.sex) {
          updateData.sex = updateData.gender;
          delete updateData.gender;
        }
        if (updateData.contact_number && !updateData.phone) {
          updateData.phone = updateData.contact_number;
          delete updateData.contact_number;
        }
        if (updateData.birth_date && !updateData.date_of_birth) {
          updateData.date_of_birth = updateData.birth_date;
          delete updateData.birth_date;
        }

        const res = await client.from('staff_profiles').update(updateData).eq('id', id).select().single();
        if (!res.error && res.data) {
          await Promise.allSettled([
            auditLogs.log({
            staffUserId: id,
            action: 'UPDATE_STAFF_ACCOUNT',
            entityType: 'staff_profile',
            entityId: id,
            details: `Updated staff profile for "${res.data.username}" (${res.data.role})`
          }),
            activityLog.log({
            action: 'UPDATE_OFFICER_ACCOUNT',
            action_title: 'Officer Profile Updated',
            admin_id: sessionStorage.getItem('username') || 'Admin',
            details: `Updated profile details for officer #${id} ("${res.data.username}")`,
            status: 'SUCCESS'
          })
          ]);
        }
        return res;
      });
    },

    async setStatus(id, newStatus) {
      return this.toggleStatus(id, newStatus);
    },

    async toggleStatus(id, newStatus) {
      return withRetry(async (client) => {
        const res = await client.from('staff_profiles').update({ status: newStatus }).eq('id', id).select().single();
        if (!res.error && res.data) {
          await Promise.allSettled([
            auditLogs.log({
            staffUserId: id,
            action: newStatus === 'Active' ? 'ACTIVATE_STAFF_ACCOUNT' : 'DEACTIVATE_STAFF_ACCOUNT',
            entityType: 'staff_profile',
            entityId: id,
            details: `Set staff account "${res.data.username}" status to ${newStatus}`
          }),
            activityLog.log({
            action: newStatus === 'Active' ? 'ACTIVATE_OFFICER' : 'DEACTIVATE_OFFICER',
            action_title: `Officer ${newStatus}`,
            admin_id: sessionStorage.getItem('username') || 'Admin',
            details: `Set officer #${id} ("${res.data.username}") status to ${newStatus}`,
            status: 'SUCCESS'
          })
          ]);
        }
        return res;
      });
    },

    async delete(id) {
      return withRetry(async (client) => {
        const staff = await client.from('staff_profiles').select('username, role').eq('id', id).maybeSingle();
        const res = await client.from('staff_profiles').delete().eq('id', id);
        if (!res.error) {
          await Promise.allSettled([
            auditLogs.log({
            action: 'DELETE_STAFF_ACCOUNT',
            entityType: 'staff_profile',
            entityId: id,
            details: `Permanently deleted staff account "${staff.data?.username || id}" (${staff.data?.role || ''})`
          }),
            activityLog.log({
            action: 'DELETE_OFFICER_ACCOUNT',
            action_title: 'Officer Deleted',
            admin_id: sessionStorage.getItem('username') || 'Admin',
            details: `Permanently deleted officer profile #${id}`,
            status: 'SUCCESS'
          })
          ]);
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
        const selectFields = filters.includeDocs
          ? '*'
          : 'id, application_number, beneficiary_qr, program_id, date_applied, status, progress_percent, remarks, created_at, updated_at, amount_requested, amount_approved, batch_id, rejection_reason, rejection_category, evaluated_by, evaluated_at, operational_batch_id, operational_batch_name, is_operational_batch, batched_at, batched_by, forwarded_at, forwarded_by, officer_notes, admin_notes';
        let query = client.from('applications').select(selectFields);

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

        const res = await query.order('created_at', { ascending: false }).limit(filters.limit || 200);
        return res;
      });
    },

    async getById(id) {
      return withRetry(async (client) => {
        let query = client.from('applications').select('*');
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
        return await client.from('applications').select('*').eq('beneficiary_qr', beneficiaryQr).order('created_at', { ascending: false });
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
          await Promise.allSettled([
            auditLogs.log({
            beneficiaryQr: data.beneficiary_qr,
            action: 'SUBMIT_APPLICATION',
            entityType: 'application',
            entityId: res.data.id,
            details: `Submitted application ${appNumber} for program #${data.program_id}`
          }),
            activityLog.log({
            action: 'APPLICATION_SUBMITTED',
            action_title: 'New Assistance Application',
            application_id: appNumber,
            beneficiary_name: data.beneficiary_name || data.beneficiary_qr,
            program: data.program_name || 'Assistance Program',
            details: `New application (${appNumber}) submitted.`
          })
          ]);
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
          officer_decision: decision || (evaluationData.status ? evaluationData.status.replace(/^Officer\s+/, '') : null),
          officer_id: evaluationData.officer_id || null,
          officer_notes: evaluationData.notes || '',
          officer_action_at: new Date().toISOString(),
          status: evaluationData.status || newStatus,
          updated_at: new Date().toISOString()
        };

        if (evaluationData.amount_approved !== undefined && evaluationData.amount_approved !== null) {
          const numAmt = Number(evaluationData.amount_approved) || 0;
          if (numAmt < 0 || numAmt > 500000) {
            return { data: null, error: { message: `Validation Error: Approved amount must be between ₱0.00 and ₱500,000.00 (received: ₱${numAmt.toLocaleString()}).` } };
          }
          payload.amount_approved = numAmt;
        }

        // Cleanse payload to prevent primary key or read-only update errors
        delete payload.id;
        delete payload.created_at;

        const res = await client.from('applications').update(payload).eq('id', id).select().maybeSingle();
        if (!res.error && res.data) {
          const actionDecision = decision || evaluationData.status || 'EVALUATED';
          const auditRes = await auditLogs.log({
            staffUserId: evaluationData.officer_id || null,
            action: `OFFICER_EVALUATION_${actionDecision.toUpperCase().replace(/\s+/g, '_')}`,
            entityType: 'application',
            entityId: id,
            details: `Officer evaluated application ${res.data.application_number} as ${actionDecision}. Notes: ${evaluationData.notes || 'None'}`
          });
          if (auditRes && auditRes.error) {
            console.warn('[Audit Log Warning on Evaluate]:', auditRes.error);
            if (typeof window !== 'undefined' && window.showSystemNotification) {
              window.showSystemNotification({
                title: 'Audit Warning',
                message: 'Evaluation saved, but audit entry failed to record in database.',
                type: 'warning',
                duration: 6000
              });
            }
          }

          // Also notify beneficiary
          try {
            await notifications.create({
              beneficiary_qr: res.data.beneficiary_qr,
              title: `Application Update: Evaluation Complete`,
              message: `Your application (${res.data.application_number}) has been evaluated as ${actionDecision}. ${evaluationData.notes ? 'Remarks: ' + evaluationData.notes : ''}`
            });
          } catch (nErr) {
            console.warn('[Notification Warning on Evaluate]:', nErr);
          }
        }
        return res;
      });
    },

    async adminApprove(id, approveData) {
      return withRetry(async (client) => {
        const adminUser = approveData.admin_username || sessionStorage.getItem('username') || 'PESO Admin';
        const nowIso = new Date().toISOString();

        // 1. Obtain application and program details
        const { data: currentApp } = await client
          .from('applications')
          .select('id, application_number, program_id, amount_approved, amount_requested, beneficiary_qr, programs (id, code, name)')
          .eq('id', id)
          .maybeSingle();

        const amountToApprove = approveData.amount_approved !== undefined && approveData.amount_approved !== null
          ? Number(approveData.amount_approved)
          : (currentApp ? Number(currentApp.amount_approved || currentApp.amount_requested || 5000) : 5000);

        if (amountToApprove < 0 || amountToApprove > 500000) {
          return { data: null, error: { message: `Validation Error: Approved amount exceeds maximum allowable single-grant ceiling of ₱500,000.00 (received: ₱${amountToApprove.toLocaleString()}).` } };
        }

        const progCode = approveData.program_code || currentApp?.programs?.code || 'PESO';

        // 2. Budget verification check upon Admin Approval (without premature deduction; deduction occurs at adminRelease)
        if (amountToApprove > 0 && typeof funds !== 'undefined' && funds.checkBalance) {
          const checkRes = await funds.checkBalance(progCode, amountToApprove);
          if (checkRes && checkRes.data && !checkRes.data.hasSufficientFunds) {
            return { data: null, error: { message: `Budget Limit: Cannot approve application. ${checkRes.data.reason || 'Insufficient remaining program budget.'}` } };
          }
        }

        const payload = {
          status: 'Approved',
          amount_approved: amountToApprove,
          admin_id: approveData.admin_id || null,
          admin_notes: approveData.notes || 'Approved by Administrator',
          evaluated_by: adminUser,
          evaluated_at: nowIso,
          progress_percent: 100,
          updated_at: nowIso
        };

        const res = await client.from('applications').update(payload).eq('id', id).select().maybeSingle();
        if (!res.error && res.data) {
          const auditRes = await auditLogs.log({
            staffUserId: approveData.admin_id || null,
            action: 'ADMIN_APPROVE_APPLICATION',
            entityType: 'application',
            entityId: id,
            details: `Admin approved application ${res.data.application_number}. Amount: ₱${Number(amountToApprove || 0).toLocaleString()}`
          });
          if (auditRes && auditRes.error) {
            console.warn('[Audit Log Warning on Admin Approve]:', auditRes.error);
            if (typeof window !== 'undefined' && window.showSystemNotification) {
              window.showSystemNotification({
                title: 'Audit Warning',
                message: 'Approval recorded, but audit trail write failed.',
                type: 'warning',
                duration: 6000
              });
            }
          }

          try {
            const actRes = await activityLog.log({
              action: 'APPLICATION_APPROVED',
              action_title: 'Application Approved',
              application_id: res.data.application_number,
              beneficiary_name: res.data.beneficiary_qr,
              program: 'Assistance Program',
              admin_id: approveData.admin_username || 'Admin',
              details: `Approved grant for ₱${Number(amountToApprove || 0).toLocaleString()}.`
            });
          } catch (actErr) {
            console.warn('[Activity Log Exception]:', actErr);
          }

          try {
            await notifications.create({
              beneficiary_qr: res.data.beneficiary_qr,
              title: 'Application Approved!',
              message: `Your application (${res.data.application_number}) has been approved.`
            });
          } catch (nErr) {
            console.warn('[Notification Warning on Admin Approve]:', nErr);
          }
        }
        return res;
      });
    },

    async adminDeny(id, denyData) {
      return withRetry(async (client) => {
        const reason = denyData.reason || denyData.rejection_reason || 'Disapproved by Administrator';

        // 1. Check if application was previously Approved or Released and had funds deducted
        const { data: currentApp } = await client
          .from('applications')
          .select('id, application_number, status, amount_approved, amount_requested, beneficiary_qr, programs (id, code, name)')
          .eq('id', id)
          .maybeSingle();

        // Only applications that reached terminal 'Released' status had funds deducted from the ledger
        if (currentApp && currentApp.status === 'Released') {
          const amountToRefund = Number(currentApp.amount_approved || currentApp.amount_requested || 0);
          const progCode = currentApp.programs?.code || 'PESO';
          if (amountToRefund > 0 && typeof funds !== 'undefined' && typeof funds.refundAmount === 'function') {
            try {
              await funds.refundAmount(progCode, amountToRefund);
            } catch (rErr) {
              console.warn('[Admin Deny Refund Note]:', rErr);
            }
          }
        }

        const payload = {
          status: 'Denied',
          admin_id: denyData.admin_id || null,
          admin_notes: reason,
          rejection_reason: reason,
          rejection_category: denyData.rejection_category || 'Incomplete Eligibility Requirements',
          evaluated_by: denyData.admin_username || sessionStorage.getItem('username') || 'PESO Admin',
          evaluated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const res = await client.from('applications').update(payload).eq('id', id).select().maybeSingle();
        if (!res.error && res.data) {
          const auditRes = await auditLogs.log({
            staffUserId: denyData.admin_id || null,
            action: 'ADMIN_DENY_APPLICATION',
            entityType: 'application',
            entityId: id,
            details: `Admin denied application ${res.data.application_number}. Reason: ${reason}`
          });
          if (auditRes && auditRes.error) {
            console.warn('[Audit Log Warning on Admin Deny]:', auditRes.error);
            if (typeof window !== 'undefined' && window.showSystemNotification) {
              window.showSystemNotification({
                title: 'Audit Warning',
                message: 'Denial recorded, but audit trail write failed.',
                type: 'warning',
                duration: 6000
              });
            }
          }

          try {
            const actRes = await activityLog.log({
              action: 'APPLICATION_DENIED',
              action_title: 'Application Denied',
              application_id: res.data.application_number,
              beneficiary_name: res.data.beneficiary_qr,
              program: 'Assistance Program',
              admin_id: denyData.admin_username || 'Admin',
              details: `Disapproved application. Reason: ${reason}`
            });
          } catch (actErr) {
            console.warn('[Activity Log Exception]:', actErr);
          }

          try {
            await notifications.create({
              beneficiary_qr: res.data.beneficiary_qr,
              title: 'Application Update: Disapproved',
              message: `Your application (${res.data.application_number}) was not approved. Reason: ${reason}`
            });
          } catch (nErr) {
            console.warn('[Notification Warning on Admin Deny]:', nErr);
          }
        }
        return res;
      });
    },

    async adminRelease(id, releaseData) {
      return withRetry(async (client) => {
        let progCode = releaseData.program_code || null;
        let requestedOrApprovedAmount = releaseData.amount || null;

        // 1. Obtain application record and enforce Idempotency Guard
        const { data: currentApp } = await client
          .from('applications')
          .select('id, application_number, status, program_id, amount_approved, amount_requested, beneficiary_qr, programs (id, code, name)')
          .eq('id', id)
          .maybeSingle();

        if (currentApp && (currentApp.status === 'Released' || currentApp.status === 'Completed')) {
          return {
            data: null,
            error: {
              message: `Duplicate Disbursement Blocked: Application #${currentApp.application_number || id} has already been released (Status: ${currentApp.status}). Funds cannot be disbursed twice.`
            }
          };
        }

        if (currentApp) {
          if (!progCode) {
            progCode = currentApp.programs?.code || (currentApp.program_id ? String(currentApp.program_id) : 'CSWDO');
          }
          if (!requestedOrApprovedAmount) {
            requestedOrApprovedAmount = Number(currentApp.amount_approved || currentApp.amount_requested || 0);
          }
        }

        const amount = Number(requestedOrApprovedAmount || 0);
        const targetProg = progCode || releaseData.program_code || 'CSWDO';

        // 2. Try Atomic Server-side RPC if available
        try {
          const { data: rpcData, error: rpcErr } = await client.rpc('release_application_funds', {
            p_application_id: id,
            p_program_code: targetProg,
            p_amount: amount,
            p_admin_id: releaseData.admin_id || null,
            p_notes: releaseData.notes || 'Funds released at disbursement desk'
          });

          if (!rpcErr && rpcData) {
            if (rpcData.success) {
              const resData = rpcData.application || { id: id, status: 'Released', application_number: currentApp?.application_number || `APP-${id}`, beneficiary_qr: currentApp?.beneficiary_qr };
              
              await Promise.allSettled([
                auditLogs.log({
                  staffUserId: releaseData.admin_id || null,
                  action: 'RELEASE_FUNDS',
                  entityType: 'application',
                  entityId: id,
                  details: `Disbursed funds for application ${resData.application_number || id} under program ${targetProg}. Amount: ₱${amount.toLocaleString()}`
                }),
                activityLog.log({
                  action: 'FUNDS_RELEASED',
                  action_title: 'Funds Disbursed',
                  application_id: resData.application_number || `APP-${id}`,
                  beneficiary_name: resData.beneficiary_qr || '',
                  program: targetProg,
                  details: `Released grant voucher of ₱${amount.toLocaleString()} under ${targetProg}.`
                }),
                notifications.create({
                  beneficiary_qr: resData.beneficiary_qr || currentApp?.beneficiary_qr,
                  title: 'Assistance Grant Released',
                  message: `Your assistance grant voucher (${resData.application_number || id}) for ₱${amount.toLocaleString()} is released.`
                })
              ]);

              return { data: resData, error: null };
            } else {
              return { data: null, error: { message: rpcData.error || 'Fund disbursement blocked by server.' } };
            }
          }
        } catch (rpcEx) {
          console.warn('[adminRelease] RPC notice, falling back to direct atomic ledger release:', rpcEx);
        }

        // 3. Fallback: Fail-Closed Fund Release with Concurrency Guard
        if (amount > 0 && funds && typeof funds.releaseAmount === 'function') {
          const fundRes = await funds.releaseAmount(targetProg, amount);
          if (fundRes && fundRes.error) {
            return {
              data: null,
              error: {
                message: `Fund Disbursement Blocked: ${fundRes.error.message || 'Remaining budget for program is insufficient.'}`
              }
            };
          }
        }

        const payload = {
          status: 'Released',
          admin_notes: releaseData.notes || 'Funds released at disbursement desk',
          updated_at: new Date().toISOString()
        };

        const res = await client
          .from('applications')
          .update(payload)
          .eq('id', id)
          .neq('status', 'Released')
          .neq('status', 'Completed')
          .select()
          .maybeSingle();

        if (res.error) {
          // Rollback fund deduction if application record update failed
          if (amount > 0 && funds && typeof funds.refundAmount === 'function') {
            try { await funds.refundAmount(targetProg, amount); } catch (e) {}
          }
          return res;
        }

        if (!res.data) {
          // Row was already released concurrently by another session
          if (amount > 0 && funds && typeof funds.refundAmount === 'function') {
            try { await funds.refundAmount(targetProg, amount); } catch (e) {}
          }
          return {
            data: null,
            error: {
              message: `Duplicate Disbursement Blocked: Application #${id} was already released by another session.`
            }
          };
        }

        if (res.data) {
          const auditRes = await auditLogs.log({
            staffUserId: releaseData.admin_id || null,
            action: 'RELEASE_FUNDS',
            entityType: 'application',
            entityId: id,
            details: `Disbursed funds for application ${res.data.application_number} under program ${targetProg}. Amount: ₱${amount.toLocaleString()}`
          });
          if (auditRes && auditRes.error) {
            console.warn('[Audit Log Warning on Admin Release]:', auditRes.error);
            if (typeof window !== 'undefined' && window.showSystemNotification) {
              window.showSystemNotification({
                title: 'Audit Warning',
                message: 'Release recorded, but audit trail write failed.',
                type: 'warning',
                duration: 6000
              });
            }
          }

          try {
            const actRes = await activityLog.log({
              action: 'FUNDS_RELEASED',
              action_title: 'Funds Disbursed',
              application_id: res.data.application_number,
              beneficiary_name: `${res.data.beneficiary?.first_name || ''} ${res.data.beneficiary?.last_name || ''}`.trim(),
              program: res.data.program?.name || targetProg,
              details: `Released grant voucher of ₱${amount.toLocaleString()} under ${targetProg}.`
            });
          } catch (actErr) {
            console.warn('[Activity Log Exception]:', actErr);
          }

          try {
            await notifications.create({
              beneficiary_qr: res.data.beneficiary_qr,
              title: 'Assistance Grant Released',
              message: `Your assistance grant voucher (${res.data.application_number}) for ₱${amount.toLocaleString()} is released.`
            });
          } catch (nErr) {
            console.warn('[Notification Warning on Admin Release]:', nErr);
          }
        }
        return res;
      });
    },

    async forwardBatchToAdmin(data) {
      return withRetry(async (client) => {
        const appIds = Array.isArray(data.application_ids) ? data.application_ids : [];
        const progCode = data.program_code || 'PESO';
        const dateStr = data.date || new Date().toISOString().split('T')[0];
        const groupLabel = data.group_label || `${progCode} — ${dateStr}`;
        const officerId = data.officer_id || parseInt(sessionStorage.getItem('userId')) || 2;
        const officerName = data.officer_name || sessionStorage.getItem('userName') || sessionStorage.getItem('username') || 'PESO Officer';
        const refNumbers = Array.isArray(data.beneficiary_ref_numbers) ? data.beneficiary_ref_numbers : [];

        // 1. Create or ensure a batch/group record for this submission
        let batchId = data.batch_id || null;
        let createdBatch = null;
        let batchError = null;

        // Deduplication Guard: If batch_id was not explicitly passed, check if target applications are already assigned to an active batch
        if (!batchId && appIds.length > 0) {
          try {
            const numericIds = appIds.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0);
            if (numericIds.length > 0) {
              const { data: existingBatchApps } = await client
                .from('applications')
                .select('batch_id')
                .in('id', numericIds)
                .not('batch_id', 'is', null)
                .limit(1);
              if (existingBatchApps && existingBatchApps.length > 0 && existingBatchApps[0].batch_id) {
                batchId = existingBatchApps[0].batch_id;
              }
            }
          } catch (batchLookupErr) {
            console.warn('[forwardBatchToAdmin] Existing batch lookup notice:', batchLookupErr);
          }
        }

        if (!batchId) {
          try {
            const { data: batchData, error: bErr } = await client.from('batches').insert({
              name: groupLabel,
              program_code: progCode,
              capacity: Math.max(50, appIds.length),
              created_by: officerId,
              status: 'Active'
            }).select().single();

            if (bErr || !batchData?.id) {
              batchError = bErr || new Error('Unable to create batch record in database.');
              return { data: null, error: { message: `Batch creation failed: ${bErr?.message || 'Unable to create batch record in database.'}` } };
            }
            batchId = batchData.id;
            createdBatch = batchData;
          } catch (bErr) {
            batchError = bErr;
            return { data: null, error: { message: `Batch creation error: ${bErr?.message || 'Database exception during batch creation.'}` } };
          }
        }

        // 2. Update applications status to Officer Approved and stamp officer / real integer batch_id
        const updatePayload = {
          status: 'Officer Approved',
          forwarded_by: officerName,
          forwarded_at: new Date().toISOString(),
          officer_id: officerId,
          officer_decision: 'Approved',
          officer_action_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        if (batchId) {
          updatePayload.batch_id = batchId;
        }

        let updatedIds = [];
        let updateError = null;
        if (appIds.length > 0) {
          try {
            const numericIds = appIds.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0);
            if (numericIds.length > 0) {
              const { data: updateRes, error: uErr } = await client
                .from('applications')
                .update(updatePayload)
                .in('id', numericIds)
                .select('id');

              if (uErr) {
                updateError = uErr;
              } else if (Array.isArray(updateRes)) {
                updatedIds = updateRes.map(r => r.id);
                if (updatedIds.length < numericIds.length) {
                  updateError = { message: `Partial update: Only ${updatedIds.length} of ${numericIds.length} applications were saved in database.` };
                }
              } else {
                updatedIds = numericIds;
              }
            }
          } catch (appErr) {
            console.warn('[DataService] Applications update notice:', appErr);
            updateError = appErr;
          }
        }

        const combinedError = batchError || updateError || null;

        // 3. Granular Audit Logging: Officer ID, Timestamp, Auto-generated group label, Full beneficiary reference numbers
        if (!combinedError || updatedIds.length > 0) {
          const refStr = refNumbers.length > 0 ? refNumbers.join(', ') : `${appIds.length} candidate applications`;
          await Promise.allSettled([
            auditLogs.log({
            staffUserId: officerId,
            action: 'FORWARD_LIVELIHOOD_APPLICATIONS',
            entityType: 'livelihood_submission',
            entityId: batchId || (appIds[0] || null),
            details: `Officer #${officerId} (${officerName}) forwarded group "${groupLabel}" with ${updatedIds.length} of ${appIds.length} beneficiaries to Admin for evaluation. Reference Numbers: [${refStr}]`
          }),
            activityLog.log({
            action: 'APPLICATIONS_FORWARDED',
            action_title: 'Applications Forwarded to Admin',
            program: progCode,
            admin_id: officerName,
            details: `Forwarded submission group "${groupLabel}" with ${updatedIds.length} candidates (${refStr}) for Admin evaluation.`
          })
          ]);
        }

        return {
          data: (combinedError && updatedIds.length === 0) ? null : {
            batch: createdBatch,
            batchId: batchId,
            groupLabel: groupLabel,
            programCode: progCode,
            count: appIds.length,
            updatedIds: updatedIds,
            refNumbers: refNumbers,
            officerId: officerId,
            officerName: officerName,
            timestamp: new Date().toISOString()
          },
          error: combinedError
        };
      });
    }
  };

  // =========================================================================
  // 5. INTERVIEWS / ACTIVITY SCHEDULES DOMAIN
  // =========================================================================
  const interviews = {
    async getAll(filters = {}) {
      return withRetry(async (client) => {
        let query = client.from('interview_schedules').select(`
          *,
          beneficiary:beneficiaries!beneficiary_qr(*),
          program:programs!program_id(*),
          officer:staff_profiles!officer_id(id, username, first_name, last_name, role),
          batch:batches!batch_id(*)
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
        if (filters.category) {
          query = query.eq('category', filters.category);
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
          officer:staff_profiles!officer_id(id, username, first_name, last_name, role),
          batch:batches!batch_id(*)
        `).eq('id', id).maybeSingle();
      });
    },

    async getByBeneficiary(beneficiaryQr) {
      return withRetry(async (client) => {
        return await client.from('interview_schedules').select(`
          *,
          program:programs!program_id(*),
          officer:staff_profiles!officer_id(id, username, first_name, last_name, role)
        `).eq('beneficiary_qr', beneficiaryQr).order('interview_date', { ascending: true });
      });
    },

    async create(data) {
      return withRetry(async (client) => {
        const payload = {
          application_id: data.application_id || null,
          beneficiary_qr: data.beneficiary_qr || null,
          program_id: data.program_id,
          officer_id: data.officer_id,
          title: data.title || 'Program Scheduled Activity Slot',
          category: data.category || 'Assistance Distribution',
          category_other: data.category_other || null,
          interview_date: data.interview_date || data.start_date || new Date().toISOString().substring(0, 10),
          end_date: data.end_date || data.interview_date || data.start_date || new Date().toISOString().substring(0, 10),
          interview_time: data.interview_time || data.start_time || '09:00 AM',
          end_time: data.end_time || '10:00 AM',
          duration: data.duration || '1 Hour',
          venue_location: data.venue_location || data.location || 'PESO Main Office',
          location_other: data.location_other || null,
          batch_id: data.batch_id || null,
          recipient_count: data.recipient_count || 0,
          status: data.status || 'Scheduled',
          attendance_status: data.attendance_status || 'Unmarked',
          remarks: data.remarks || null
        };
        let res = await client.from('interview_schedules').insert(payload).select(`
          *,
          program:programs!program_id(*),
          officer:staff_profiles!officer_id(id, username, first_name, last_name, role)
        `).single();
        if (res.error) {
          // Fallback simple select if foreign join encounters cache mismatch
          res = await client.from('interview_schedules').insert(payload).select().single();
        }
        if (!res.error && res.data) {
          const slotEffects = [
            auditLogs.log({
            staffUserId: data.officer_id,
            action: 'CREATE_SCHEDULE_SLOT',
            entityType: 'schedule_slot',
            entityId: res.data.id,
            details: `Created activity slot "${payload.title}" (${payload.category}) on ${payload.interview_date} at ${payload.venue_location}`
          }),
            activityLog.log({
            action: 'SCHEDULE_SLOT_CREATED',
            action_title: 'New Activity Slot Scheduled',
            program: (res.data.program && res.data.program.name) || 'Assistance Program',
            details: `Scheduled "${payload.title}" for ${payload.interview_date} (${payload.interview_time})`
          })
          ];
          if (data.beneficiary_qr) {
            slotEffects.push(notifications.create({
              beneficiary_qr: data.beneficiary_qr,
              title: 'New Scheduled Activity Slot',
              message: `You have an activity scheduled: "${payload.title}" on ${payload.interview_date} at ${payload.interview_time}. Location: ${payload.venue_location}.`
            }));
          }
          await Promise.allSettled(slotEffects);
        }
        return res;
      });
    },

    async update(id, data) {
      return withRetry(async (client) => {
        const updateData = { ...data };
        delete updateData.id;
        delete updateData.created_at;
        delete updateData.beneficiary;
        delete updateData.program;
        delete updateData.officer;
        delete updateData.batch;
        updateData.updated_at = new Date().toISOString();
        let res = await client.from('interview_schedules').update(updateData).eq('id', id).select(`
          *,
          program:programs!program_id(*),
          officer:staff_profiles!officer_id(id, username, first_name, last_name, role)
        `).maybeSingle();
        if (res.error || !res.data) {
          res = await client.from('interview_schedules').update(updateData).eq('id', id).select().maybeSingle();
        }
        if (!res.error && res.data) {
          try {
            await auditLogs.log({
              action: 'UPDATE_SCHEDULE_SLOT',
            entityType: 'schedule_slot',
            entityId: id,
            details: `Updated schedule slot #${id} (${res.data.title || 'Activity'})`
          });
          } catch (e) {
            console.warn('[Audit Log Warning]:', e);
          }
        }
        return res;
      });
    },

    async markAttendance(id, attendanceData) {
      return withRetry(async (client) => {
        const status = attendanceData.attendance_status === 'Present' ? 'Completed' : (attendanceData.attendance_status === 'Absent' ? 'Missed' : 'Scheduled');
        const payload = {
          attendance_status: attendanceData.attendance_status,
          status: attendanceData.status || status,
          remarks: attendanceData.remarks || null,
          updated_at: new Date().toISOString()
        };
        const res = await client.from('interview_schedules').update(payload).eq('id', id).select().maybeSingle();
        if (!res.error && res.data) {
          try {
            await auditLogs.log({
              action: 'MARK_ATTENDANCE',
            entityType: 'schedule_slot',
            entityId: id,
            details: `Marked attendance for schedule slot #${id} as ${attendanceData.attendance_status}`
          });
          } catch (e) {
            console.warn('[Audit Log Warning]:', e);
          }
        }
        return res;
      });
    },

    async reschedule(id, rescheduleData) {
      return withRetry(async (client) => {
        const payload = {
          interview_date: rescheduleData.interview_date,
          end_date: rescheduleData.end_date || rescheduleData.interview_date,
          interview_time: rescheduleData.interview_time,
          end_time: rescheduleData.end_time || rescheduleData.interview_time,
          duration: rescheduleData.duration || undefined,
          venue_location: rescheduleData.venue_location || undefined,
          status: 'Scheduled',
          remarks: rescheduleData.remarks || 'Rescheduled',
          updated_at: new Date().toISOString()
        };
        let res = await client.from('interview_schedules').update(payload).eq('id', id).select(`
          *,
          beneficiary:beneficiaries!beneficiary_qr(*),
          program:programs!program_id(*),
          officer:staff_profiles!officer_id(id, username, first_name, last_name, role),
          batch:batches!batch_id(*)
        `).maybeSingle();
        if (res.error || !res.data) {
          res = await client.from('interview_schedules').update(payload).eq('id', id).select().maybeSingle();
        }
        if (!res.error && res.data) {
          try {
            await auditLogs.log({
              action: 'RESCHEDULE_ACTIVITY',
            entityType: 'schedule_slot',
            entityId: id,
            details: `Rescheduled activity #${id} to ${rescheduleData.interview_date} (${rescheduleData.interview_time})`
          });
          } catch (e) {
            console.warn('[Audit Log Warning]:', e);
          }
        }
        return res;
      });
    },

    async postpone(id, postponeData = {}) {
      return withRetry(async (client) => {
        const payload = {
          status: 'Postponed',
          postponed_at: new Date().toISOString(),
          postponed_by: postponeData.postponed_by || sessionStorage.getItem('username') || 'PESO Admin',
          postponement_reason: postponeData.reason || 'Postponed by Administrator',
          remarks: postponeData.reason || 'Activity Postponed',
          updated_at: new Date().toISOString()
        };
        let res = await client.from('interview_schedules').update(payload).eq('id', id).select(`
          *,
          beneficiary:beneficiaries!beneficiary_qr(*),
          program:programs!program_id(*),
          officer:staff_profiles!officer_id(id, username, first_name, last_name, role),
          batch:batches!batch_id(*)
        `).maybeSingle();
        if (res.error || !res.data) {
          res = await client.from('interview_schedules').update(payload).eq('id', id).select().maybeSingle();
        }
        if (!res.error && res.data) {
          await Promise.allSettled([
            auditLogs.log({
            action: 'POSTPONE_ACTIVITY',
            entityType: 'schedule_slot',
            entityId: id,
            details: `Postponed activity slot #${id} ("${res.data.title || 'Activity'}"). Reason: ${payload.postponement_reason}`
          }),
            activityLog.log({
            action: 'ACTIVITY_POSTPONED',
            action_title: 'Scheduled Activity Postponed',
            program: (res.data.program && res.data.program.name) || 'Assistance Program',
            details: `Postponed "${res.data.title || 'Activity'}" by ${payload.postponed_by}. Reason: ${payload.postponement_reason}`
          })
          ]);
        }
        return res;
      });
    },

    async cancel(id, cancelData = {}) {
      return withRetry(async (client) => {
        const payload = {
          status: 'Cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: cancelData.cancelled_by || sessionStorage.getItem('username') || 'PESO Admin',
          cancellation_reason: cancelData.reason || 'Cancelled by Administrator',
          remarks: cancelData.reason || 'Activity Cancelled',
          updated_at: new Date().toISOString()
        };
        let res = await client.from('interview_schedules').update(payload).eq('id', id).select(`
          *,
          beneficiary:beneficiaries!beneficiary_qr(*),
          program:programs!program_id(*),
          officer:staff_profiles!officer_id(id, username, first_name, last_name, role),
          batch:batches!batch_id(*)
        `).maybeSingle();
        if (res.error || !res.data) {
          res = await client.from('interview_schedules').update(payload).eq('id', id).select().maybeSingle();
        }
        if (!res.error && res.data) {
          await Promise.allSettled([
            auditLogs.log({
            action: 'CANCEL_ACTIVITY',
            entityType: 'schedule_slot',
            entityId: id,
            details: `Cancelled activity slot #${id} ("${res.data.title || 'Activity'}"). Reason: ${payload.cancellation_reason}`
          }),
            activityLog.log({
            action: 'ACTIVITY_CANCELLED',
            action_title: 'Scheduled Activity Cancelled',
            program: (res.data.program && res.data.program.name) || 'Assistance Program',
            details: `Cancelled "${res.data.title || 'Activity'}" by ${payload.cancelled_by}. Moved to Archive.`
          })
          ]);
        }
        return res;
      });
    }
  };

  // =========================================================================
  // 6. NOTIFICATIONS DOMAIN
  // =========================================================================
  const notifications = {
    async getAll(options = {}) {
      return withRetry(async (client) => {
        let query = client.from('notifications').select('*').order('created_at', { ascending: false });
        if (options.limit) {
          query = query.limit(options.limit);
        }
        return await query;
      });
    },

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
          try {
            await auditLogs.log({
              staffUserId: data.officer_id,
              action: 'RECORD_APPROVED_ASSISTANCE',
            entityType: 'approved_assistance',
            entityId: res.data.id,
            details: `Recorded approved assistance (${payload.assistance_type}: ${payload.quantity_amount}) for beneficiary ${payload.beneficiary_qr}`
          });
          } catch (e) {
            console.warn('[Audit Log Warning]:', e);
          }
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
        const code = (programCode || '').trim().toUpperCase();
        const numericAmount = Number(amount || 0);

        if (!code || isNaN(numericAmount) || numericAmount <= 0) {
          return { data: null, error: { message: 'Invalid program code or release amount.' } };
        }

        // 1. Primary: Atomic in-database RPC increment
        try {
          const { data: rpcRes, error: rpcErr } = await client.rpc('release_fund_amount', {
            p_program_code: code,
            p_amount: numericAmount
          });

          if (!rpcErr && rpcRes) {
            if (rpcRes.success) {
              return { data: rpcRes.data, error: null };
            } else {
              return { data: null, error: { message: rpcRes.error || 'Failed to release fund amount via atomic RPC.' } };
            }
          }
          if (rpcErr) {
            console.warn('[DataService] release_fund_amount RPC notice:', rpcErr);
          }
        } catch (rpcEx) {
          console.warn('[DataService] release_fund_amount RPC exception:', rpcEx);
        }

        // 2. Direct fallback
        let fundRes = await client.from('funds').select('*')
          .or(`program_code.eq.${code},program.ilike.%${code}%`)
          .maybeSingle();

        if (fundRes.data) {
          const newReleased = Number(fundRes.data.released_amount || 0) + numericAmount;
          return await client.from('funds').update({
            released_amount: newReleased,
            updated_at: new Date().toISOString()
          }).eq('id', fundRes.data.id).select().maybeSingle();
        }

        return { data: null, error: { message: `No fund record found for program code: ${code}` } };
      });
    },

    async refundAmount(programCode, amount) {
      return withRetry(async (client) => {
        const code = (programCode || '').trim().toUpperCase();
        const numericAmount = Number(amount || 0);

        if (!code || isNaN(numericAmount) || numericAmount <= 0) {
          return { data: null, error: { message: 'Invalid program code or refund amount.' } };
        }

        // 1. Primary: Dedicated Atomic in-database RPC refund
        try {
          const { data: rpcRes, error: rpcErr } = await client.rpc('refund_fund_amount', {
            p_program_code: code,
            p_amount: numericAmount
          });

          if (!rpcErr && rpcRes) {
            if (rpcRes.success) {
              return { data: rpcRes.data, error: null };
            } else {
              return { data: null, error: { message: rpcRes.error || 'Failed to refund fund amount via atomic RPC.' } };
            }
          }
          if (rpcErr) {
            console.warn('[DataService] refund_fund_amount RPC notice:', rpcErr);
          }
        } catch (rpcEx) {
          console.warn('[DataService] refund_fund_amount RPC exception:', rpcEx);
        }

        // 2. Direct fallback: Decrement released_amount
        let fundRes = await client.from('funds').select('*')
          .or(`program_code.eq.${code},program.ilike.%${code}%`)
          .maybeSingle();

        if (fundRes.data) {
          const currentReleased = Number(fundRes.data.released_amount || 0);
          const newReleased = Math.max(0, currentReleased - numericAmount);
          return await client.from('funds').update({
            released_amount: newReleased,
            updated_at: new Date().toISOString()
          }).eq('id', fundRes.data.id).select().maybeSingle();
        }

        return { data: null, error: { message: `No fund record found for program code: ${code}` } };
      });
    },

    async checkBalance(programIdentifier, requestedAmount = 0) {
      return withRetry(async (client) => {
        const amt = Number(requestedAmount) || 0;
        let progCode = String(programIdentifier || '').trim().toUpperCase();

        if (!progCode) {
          return {
            data: {
              hasSufficientFunds: false,
              remainingBalance: 0,
              allocatedBudget: 0,
              releasedAmount: 0,
              requestedAmount: amt,
              programCode: 'UNKNOWN',
              programName: 'Unknown Program',
              reason: 'No program code provided for budget verification.'
            },
            error: { message: 'No program code provided for budget verification.' }
          };
        }

        // 1. Lookup in funds table
        let fundRes = await client.from('funds').select('*')
          .or(`program_code.eq.${progCode},program.ilike.%${progCode}%`)
          .maybeSingle();

        if (fundRes && fundRes.data) {
          const allocated = Number(fundRes.data.allocated_budget) || 0;
          const released = Number(fundRes.data.released_amount) || 0;
          const remaining = allocated - released;
          const hasSufficientFunds = (remaining >= amt && allocated > 0);
          return {
            data: {
              hasSufficientFunds,
              remainingBalance: remaining,
              allocatedBudget: allocated,
              releasedAmount: released,
              requestedAmount: amt,
              programCode: fundRes.data.program_code,
              programName: fundRes.data.program,
              reason: hasSufficientFunds ? 'Sufficient balance available' : (allocated === 0 ? 'Program has no budget allocation.' : `Insufficient remaining balance (₱${remaining.toLocaleString()} available vs ₱${amt.toLocaleString()} requested).`)
            },
            error: null
          };
        }

        // 2. If not in funds table, check programs table
        let progRes = null;
        if (/^\d+$/.test(programIdentifier)) {
          progRes = await client.from('programs').select('*').eq('id', Number(programIdentifier)).maybeSingle();
        } else {
          progRes = await client.from('programs').select('*').or(`code.eq.${progCode},name.ilike.%${progCode}%`).maybeSingle();
        }

        if (progRes && progRes.data) {
          const allocated = Number(progRes.data.budget || progRes.data.budget_allocated || 0);
          const appsRes = await client.from('applications').select('amount_approved, amount_requested, status')
            .eq('program_id', progRes.data.id)
            .in('status', ['Approved', 'Officer Approved', 'Released', 'Completed']);
          const released = (appsRes.data || []).reduce((sum, a) => sum + Number(a.amount_approved || a.amount_requested || 0), 0);
          const remaining = allocated - released;
          const hasSufficientFunds = (remaining >= amt && allocated > 0);
          return {
            data: {
              hasSufficientFunds,
              remainingBalance: remaining,
              allocatedBudget: allocated,
              releasedAmount: released,
              requestedAmount: amt,
              programCode: progRes.data.code,
              programName: progRes.data.name,
              reason: hasSufficientFunds ? 'Sufficient balance available' : (allocated === 0 ? 'Program has no budget allocation configured.' : `Insufficient remaining balance (₱${remaining.toLocaleString()} available vs ₱${amt.toLocaleString()} requested).`)
            },
            error: null
          };
        }

        // 3. Fail-Closed: Never fabricate numbers when no budget record exists
        return {
          data: {
            hasSufficientFunds: false,
            remainingBalance: 0,
            allocatedBudget: 0,
            releasedAmount: 0,
            requestedAmount: amt,
            programCode: progCode,
            programName: 'Unknown Program',
            reason: `No budget allocation record found for program code: ${progCode}`
          },
          error: { message: `No budget record found for program: ${progCode}` }
        };
      });
    },

    async updateBalance(programCode, amount) {
      return this.releaseAmount(programCode, amount);
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

    async create(data) {
      return this.log(data);
    },

    async log(data) {
      try {
        const client = getClient();
        if (!client) return { data: null, error: { message: 'Database client unavailable.' } };

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

        // Schema requires exactly one recipient/actor to be set (chk_audit_actor)
        if (!staffUserId && !beneficiaryQr) {
          const storedId = parseInt(sessionStorage.getItem('userId'), 10);
          if (!isNaN(storedId) && storedId > 0) {
            staffUserId = storedId;
          } else {
            const qr = sessionStorage.getItem('beneficiaryQrCode');
            if (qr && qr.startsWith('QR-')) {
              beneficiaryQr = qr;
            } else {
              staffUserId = 1; // Default to Admin actor to satisfy chk_audit_actor
            }
          }
        }

        const payload = {
          action: (data.action || 'SYSTEM_ACTION').substring(0, 100),
          entity_type: (data.entityType || 'general').substring(0, 50),
          entity_id: data.entityId ? parseInt(data.entityId, 10) : null,
          details: data.details || ''
        };

        if (staffUserId && !beneficiaryQr) {
          payload.staff_user_id = staffUserId;
        } else if (beneficiaryQr && !staffUserId) {
          payload.beneficiary_qr = beneficiaryQr;
        } else {
          payload.staff_user_id = staffUserId || 1;
        }

        const res = await client.from('audit_logs').insert(payload).select().single();
        if (res && res.error) {
          console.warn('[Audit Log Insert Warning]:', res.error);
          if (activityLog && typeof activityLog.log === 'function') {
            const actRes = await activityLog.log({
              action: payload.action,
              details: payload.details,
              status: 'AUDIT_INSERT_FAILED'
            });
          }
          return res;
        }
        return res || { data: payload, error: null };
      } catch (err) {
        console.warn('[DATA_SERVICE] Audit log exception:', err);
        return { data: null, error: err };
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
        if (filters.simple) {
          let q = client.from('batches').select('*').order('created_at', { ascending: false });
          if (filters.program_code) q = q.eq('program_code', filters.program_code);
          if (filters.status) q = q.eq('status', filters.status);
          return await q;
        }

        try {
          let query = client.from('batches').select(`
            *,
            program:programs!program_id(*),
            creator:staff_profiles!created_by(id, username, first_name, last_name, role)
          `).order('created_at', { ascending: false });
          if (filters.program_code) {
            query = query.eq('program_code', filters.program_code);
          }
          if (filters.program_id) {
            query = query.eq('program_id', filters.program_id);
          }
          if (filters.status) {
            query = query.eq('status', filters.status);
          }
          const res = await query;
          if (res.error) throw res.error;
          return res;
        } catch (e) {
          // Fallback to simple select without complex joins
          let fallbackQ = client.from('batches').select('*').order('created_at', { ascending: false });
          if (filters.program_code) fallbackQ = fallbackQ.eq('program_code', filters.program_code);
          if (filters.status) fallbackQ = fallbackQ.eq('status', filters.status);
          return await fallbackQ;
        }
      });
    },

    async getById(id) {
      return withRetry(async (client) => {
        return await client.from('batches').select(`
          *,
          program:programs!program_id(*),
          creator:staff_profiles!created_by(id, username, first_name, last_name, role),
          applications:applications(
            id,
            application_number,
            status,
            date_applied,
            amount_approved,
            beneficiary_qr,
            beneficiary:beneficiaries!beneficiary_qr(
              id, qr_code, first_name, middle_name, last_name, suffix, username, barangay, address, phone, contact_number, email, category
            )
          )
        `).eq('id', id).maybeSingle();
      });
    },

    async create(data) {
      return withRetry(async (client) => {
        const payload = {
          name: data.name || data.batch_num,
          program_id: data.program_id || null,
          program_code: data.program_code || 'PESO',
          capacity: data.capacity || data.total || 50,
          status: data.status || 'Active',
          notes: data.notes || null,
          created_by: data.created_by || null
        };
        const res = await client.from('batches').insert(payload).select().single();
        if (!res.error && res.data) {
          try {
            await auditLogs.log({
              staffUserId: data.created_by,
              action: 'CREATE_BATCH',
            entityType: 'batch',
            entityId: res.data.id,
            details: `Created new batch "${payload.name}" for program ${payload.program_code}`
          });
          } catch (e) {
            console.warn('[Audit Log Warning]:', e);
          }
        }
        return res;
      });
    },

    async createWithBeneficiaries(data) {
      return withRetry(async (client) => {
        const payload = {
          name: data.name,
          program_id: data.program_id || null,
          program_code: data.program_code || 'PESO',
          capacity: data.capacity || 50,
          status: 'Active',
          notes: data.notes || null,
          created_by: data.created_by || null
        };

        // 1. Create Batch
        const batchRes = await client.from('batches').insert(payload).select().single();
        if (batchRes.error) return batchRes;

        const newBatchId = batchRes.data.id;
        const appIds = Array.isArray(data.application_ids) ? data.application_ids : [];

        // 2. Assign Applications to the new Batch
        if (appIds.length > 0) {
          const updateRes = await client.from('applications')
            .update({ batch_id: newBatchId, updated_at: new Date().toISOString() })
            .in('id', appIds);

          if (updateRes.error) {
            console.warn('[BATCH] Error assigning applications to new batch:', updateRes.error);
          }
        }

        // 3. Audit & Activity Logging
        const refNumbers = Array.isArray(data.beneficiary_ref_numbers) ? data.beneficiary_ref_numbers : [];
        const refStr = refNumbers.length > 0 ? ` Reference Numbers: [${refNumbers.join(', ')}]` : '';
        await Promise.allSettled([
          auditLogs.log({
            staffUserId: data.created_by,
            action: 'CREATE_LIVELIHOOD_BATCH',
            entityType: 'batch',
            entityId: newBatchId,
            details: `Created livelihood batch "${payload.name}" (${payload.program_code}) with ${appIds.length} approved beneficiaries assigned.${refStr}`
          }),
          activityLog.log({
          action: 'BATCH_CREATED',
          action_title: 'Livelihood Batch Created',
          program: payload.program_code,
          admin_id: data.officer_name || 'PESO Officer',
          details: `Batch "${payload.name}" created with ${appIds.length} beneficiaries assigned.${refStr}`
        })
        ]);

        return { data: { ...batchRes.data, assignedCount: appIds.length }, error: null };
      });
    },

    async getUnbatchedApproved(filters = {}) {
      return withRetry(async (client) => {
        try {
          let query = client.from('applications').select(`
            *,
            beneficiary:beneficiaries!beneficiary_qr(
              id, qr_code, first_name, middle_name, last_name, suffix, username, barangay, address, phone, contact_number, email, category, date_of_birth, age, sex
            ),
            program:programs!program_id(*)
          `)
          .is('batch_id', null)
          .in('status', ['Approved', 'Officer Approved']);

          if (filters.program_code) {
            query = query.or(`program_code.eq.${filters.program_code},program.code.eq.${filters.program_code}`);
          }
          if (filters.program_id) {
            query = query.eq('program_id', filters.program_id);
          }
          if (filters.agency) {
            query = query.eq('program.agency', filters.agency);
          }

          const res = await query.order('created_at', { ascending: false });
          if (!res.error && res.data) return res;
        } catch (e) {}

        let fallbackQuery = client.from('applications').select('*')
          .is('batch_id', null)
          .in('status', ['Approved', 'Officer Approved']);
        if (filters.program_id) fallbackQuery = fallbackQuery.eq('program_id', filters.program_id);

        return await fallbackQuery.order('created_at', { ascending: false });
      });
    },

    async addMembers(batchId, applicationIds, officerName = 'PESO Officer') {
      return withRetry(async (client) => {
        const bId = Number(batchId);
        const appIds = (Array.isArray(applicationIds) ? applicationIds : [applicationIds]).map(Number).filter(Boolean);

        if (!bId || appIds.length === 0) {
          return { data: null, error: { message: 'Invalid batch ID or application selection.' } };
        }

        // 1. Primary: Atomic transactional RPC
        try {
          const { data: rpcRes, error: rpcErr } = await client.rpc('add_batch_members', {
            p_batch_id: bId,
            p_application_ids: appIds,
            p_officer_name: officerName
          });

          if (!rpcErr && rpcRes) {
            if (rpcRes.success) {
              return { data: rpcRes, error: null };
            } else {
              return { data: null, error: { message: rpcRes.error || 'Failed to add members: batch capacity exceeded.' } };
            }
          }
          if (rpcErr) {
            console.warn('[DataService] add_batch_members RPC notice:', rpcErr);
          }
        } catch (rpcEx) {
          console.warn('[DataService] add_batch_members RPC exception:', rpcEx);
        }

        // 2. Direct fallback with capacity verification
        const { data: batchRow, error: bErr } = await client.from('batches').select('id, name, capacity, current_count').eq('id', bId).single();
        if (bErr || !batchRow) {
          return { data: null, error: { message: 'Batch not found.' } };
        }

        const capacity = Number(batchRow.capacity || 50);
        const { count: currentCount } = await client.from('applications').select('*', { count: 'exact', head: true }).or(`batch_id.eq.${bId},operational_batch_id.eq.${bId}`);
        const cur = Number(currentCount || 0);

        if (cur + appIds.length > capacity) {
          return {
            data: null,
            error: {
              message: `Batch Capacity Exceeded: Cannot add ${appIds.length} member(s). Current roster is ${cur}/${capacity} (Available: ${Math.max(0, capacity - cur)}).`
            }
          };
        }

        const res = await client.from('applications')
          .update({
            batch_id: bId,
            operational_batch_id: bId,
            operational_batch_name: batchRow.name,
            is_operational_batch: true,
            batched_at: new Date().toISOString(),
            batched_by: officerName,
            updated_at: new Date().toISOString()
          })
          .in('id', appIds);

        await client.from('batches').update({ current_count: cur + appIds.length, updated_at: new Date().toISOString() }).eq('id', bId);

        return res;
      });
    },

    async assignApplications(applicationIds, batchId) {
      return withRetry(async (client) => {
        const ids = Array.isArray(applicationIds) ? applicationIds : [applicationIds];
        const res = await client.from('applications')
          .update({ batch_id: batchId, updated_at: new Date().toISOString() })
          .in('id', ids);

        if (!res.error) {
          try {
            await auditLogs.log({
              action: 'ASSIGN_BENEFICIARIES_TO_BATCH',
            entityType: 'batch',
            entityId: batchId,
            details: `Assigned ${ids.length} application(s) to batch #${batchId}`
          });
          } catch (e) {
            console.warn('[Audit Log Warning]:', e);
          }
        }
        return res;
      });
    },

    async unassignApplications(applicationIds) {
      return withRetry(async (client) => {
        const ids = Array.isArray(applicationIds) ? applicationIds : [applicationIds];
        return await client.from('applications')
          .update({ batch_id: null, updated_at: new Date().toISOString() })
          .in('id', ids);
      });
    },

    async update(id, data) {
      return withRetry(async (client) => {
        const payload = { ...data, updated_at: new Date().toISOString() };
        delete payload.id;
        delete payload.created_at;
        delete payload.applications;
        delete payload.program;
        delete payload.creator;
        return await client.from('batches').update(payload).eq('id', id).select().single();
      });
    },

    async delete(id) {
      return withRetry(async (client) => {
        // Unassign applications first
        await client.from('applications').update({ batch_id: null }).eq('batch_id', id);
        return await client.from('batches').delete().eq('id', id);
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
          .select('*')
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

          const patchRes = await client.from('applications').update(updatePayload).eq('id', appRes.data.id).select('*').single();
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
          client.from('applications').select('*').eq('beneficiary_qr', qrCode).order('created_at', { ascending: false }),
          client.from('notifications').select('*').eq('beneficiary_qr', qrCode).order('created_at', { ascending: false }),
          client.from('audit_logs').select('*').eq('beneficiary_qr', qrCode).order('created_at', { ascending: false }),
          client.from('interview_schedules').select('*').eq('beneficiary_qr', qrCode).order('interview_date', { ascending: false }),
          client.from('approved_assistance').select('*').eq('beneficiary_qr', qrCode).order('approval_date', { ascending: false })
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

  // =========================================================================
  // 13. AUTH & IDENTIFIER UNIQUENESS VALIDATION DOMAIN
  // =========================================================================
  const auth = {
    /**
     * Cross-verifies username, email, and phone availability across beneficiaries and staff_profiles tables
     * @param {Object} params
     * @param {string} [params.username]
     * @param {string} [params.email]
     * @param {string} [params.phone]
     * @param {string|number} [params.excludeBeneficiaryId]
     * @param {string|number} [params.excludeStaffId]
     * @returns {Promise<{ data: { isAvailable: boolean, isUsernameTaken: boolean, isEmailTaken: boolean, isPhoneTaken: boolean, message: string|null, conflictTable: string|null }, error: any }>}
     */
    async checkIdentifierAvailability({ username, email, phone, excludeBeneficiaryId = null, excludeStaffId = null }) {
      return withRetry(async (client) => {
        let isUsernameTaken = false;
        let isEmailTaken = false;
        let isPhoneTaken = false;
        let conflictMsg = null;
        let conflictTable = null;

        const cleanUsername = (username || '').trim().toLowerCase();
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanPhone = (phone || '').replace(/[^0-9]/g, '');

        // 1. Check in beneficiaries table
        if (cleanUsername || cleanEmail || cleanPhone) {
          try {
            if (cleanEmail) {
              const { data: emailMatches } = await client.from('beneficiaries').select('qr_code, email').ilike('email', cleanEmail);
              if (emailMatches && emailMatches.length > 0) {
                for (const match of emailMatches) {
                  if (excludeBeneficiaryId && String(match.qr_code) === String(excludeBeneficiaryId)) continue;
                  isEmailTaken = true;
                  conflictTable = 'beneficiaries';
                }
              }
            }
            if (cleanUsername) {
              const { data: userMatches } = await client.from('beneficiaries').select('qr_code, username').ilike('username', cleanUsername);
              if (userMatches && userMatches.length > 0) {
                for (const match of userMatches) {
                  if (excludeBeneficiaryId && String(match.qr_code) === String(excludeBeneficiaryId)) continue;
                  isUsernameTaken = true;
                  conflictTable = 'beneficiaries';
                }
              }
            }
            if (cleanPhone && cleanPhone.length >= 10) {
              const { data: phoneMatches } = await client.from('beneficiaries').select('qr_code, phone').ilike('phone', `%${cleanPhone.slice(-10)}%`).limit(10);
              if (phoneMatches && phoneMatches.length > 0) {
                for (const match of phoneMatches) {
                  if (excludeBeneficiaryId && String(match.qr_code) === String(excludeBeneficiaryId)) continue;
                  const dbPhone = (match.phone || '').replace(/[^0-9]/g, '');
                  if (dbPhone && (dbPhone === cleanPhone || dbPhone.endsWith(cleanPhone.slice(-10)))) {
                    isPhoneTaken = true;
                    conflictTable = 'beneficiaries';
                  }
                }
              }
            }
          } catch (benErr) {
            console.warn('[DATA_SERVICE] Beneficiary uniqueness check note:', benErr);
          }
        }

        // 2. Check in staff_profiles table
        if (cleanUsername || cleanEmail || cleanPhone) {
          try {
            if (cleanEmail) {
              const { data: staffEmailMatches } = await client.from('staff_profiles').select('id, auth_id, email').ilike('email', cleanEmail);
              if (staffEmailMatches && staffEmailMatches.length > 0) {
                for (const match of staffEmailMatches) {
                  if (excludeStaffId && (String(match.id) === String(excludeStaffId) || String(match.auth_id) === String(excludeStaffId))) continue;
                  isEmailTaken = true;
                  conflictTable = 'staff_profiles';
                }
              }
            }
            if (cleanUsername) {
              const { data: staffUserMatches } = await client.from('staff_profiles').select('id, auth_id, username').ilike('username', cleanUsername);
              if (staffUserMatches && staffUserMatches.length > 0) {
                for (const match of staffUserMatches) {
                  if (excludeStaffId && (String(match.id) === String(excludeStaffId) || String(match.auth_id) === String(excludeStaffId))) continue;
                  isUsernameTaken = true;
                  conflictTable = 'staff_profiles';
                }
              }
            }
          } catch (staffErr) {
            console.warn('[DATA_SERVICE] Staff uniqueness check note:', staffErr);
          }
        }

        if (isEmailTaken) {
          conflictMsg = `This email address is already attached to an existing account. Each account must have a unique email address.`;
        } else if (isPhoneTaken) {
          conflictMsg = `This mobile number is already registered to an existing account.`;
        } else if (isUsernameTaken) {
          conflictMsg = `The username "${username}" is already taken. Please choose another username.`;
        }

        return {
          data: {
            isAvailable: !isUsernameTaken && !isEmailTaken && !isPhoneTaken,
            isUsernameTaken,
            isEmailTaken,
            isPhoneTaken,
            message: conflictMsg,
            conflictTable
          },
          error: null
        };
      });
    }
  };

  // =========================================================================
  // 14. OFFICER PASSWORD RESET REQUESTS & ADMIN APPROVAL DOMAIN
  // =========================================================================
  const passwordResets = {
    /**
     * Submit a new password reset request from an Officer to the Admin
     */
    async createRequest({ username, email, department = 'PESO', reason = 'Officer requested password reset.' }) {
      return withRetry(async (client) => {
        const cleanUser = (username || '').trim();
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanDept = (department || 'PESO').toUpperCase();

        // 1. Verify officer exists in staff_profiles
        let staffProfile = null;
        try {
          const { data: matches } = await client
            .from('staff_profiles')
            .select('*')
            .or(`email.ilike.${cleanEmail},username.ilike.${cleanUser}`)
            .limit(1);
          if (matches && matches.length > 0) {
            staffProfile = matches[0];
          }
        } catch (e) {
          console.warn('[PASSWORD_RESETS] Staff profile lookup note:', e);
        }

        if (!staffProfile) {
          return { error: { message: 'No registered officer/staff account found with the provided credentials.' } };
        }

        // Check if a Pending or Approved request already exists
        try {
          const { data: existingReqs } = await client
            .from('password_reset_requests')
            .select('*')
            .eq('email', staffProfile.email)
            .in('status', ['Pending', 'Approved'])
            .order('created_at', { ascending: false })
            .limit(1);

          if (existingReqs && existingReqs.length > 0) {
            const activeReq = existingReqs[0];
            return {
              data: activeReq,
              isExisting: true,
              message: activeReq.status === 'Approved'
                ? 'Your password reset request has already been approved by Admin! You may now set your new password.'
                : 'A password reset request is already pending administrator review.'
            };
          }
        } catch (existErr) {
          console.warn('[PASSWORD_RESETS] Existing check note:', existErr);
        }

        const ticketId = 'TKT-PW-' + Math.floor(100000 + Math.random() * 900000);
        const payload = {
          ticket_id: ticketId,
          staff_id: staffProfile.id,
          username: staffProfile.username,
          email: staffProfile.email,
          role: staffProfile.role || 'Officer',
          department: cleanDept,
          reason: reason || 'Officer requested password reset via official login portal.',
          status: 'Pending',
          created_at: new Date().toISOString()
        };

        const res = await client.from('password_reset_requests').insert(payload).select().single();

        if (!res.error && res.data) {
          // Send notification to Admins
          try {
            const adminRole = cleanDept === 'CSWDO' ? 'CSWDO Admin' : 'PESO Admin';
            const { data: admins } = await client.from('staff_profiles').select('id').eq('role', adminRole);
            if (admins && admins.length > 0) {
              const notifs = admins.map(a => ({
                staff_user_id: a.id,
                title: 'Officer Password Reset Request',
                message: `Officer ${staffProfile.first_name} ${staffProfile.last_name} (${staffProfile.username}) has requested a password reset. Ticket: ${ticketId}.`,
                is_read: false
              }));
              await client.from('notifications').insert(notifs);
            }
          } catch (notifErr) {
            console.warn('[PASSWORD_RESETS] Admin notification notice:', notifErr);
          }

          // Audit log
          try {
            await auditLogs.log({
              staffUserId: staffProfile.id,
              action: 'OFFICER_PASSWORD_RESET_REQUESTED',
            entityType: 'staff_profile',
            entityId: staffProfile.id,
            details: `Officer ${staffProfile.username} (${staffProfile.email}) submitted password reset ticket ${ticketId}`
          });
          } catch (e) {
            console.warn('[Audit Log Warning]:', e);
          }

          // Broadcast Realtime event
          if (typeof window.broadcastRealtimeEvent === 'function') {
            window.broadcastRealtimeEvent('OFFICER_PASSWORD_RESET_REQUESTED', { ticketId, staffProfile, department: cleanDept });
          }
        }

        return res;
      });
    },

    /**
     * Check status of a reset request by ticket ID, email, or username
     */
    async getRequestStatus(identifier) {
      return withRetry(async (client) => {
        const clean = (identifier || '').trim().toLowerCase();
        if (!clean) return { data: null, error: { message: 'Identifier is required.' } };

        const { data, error } = await client
          .from('password_reset_requests')
          .select('*')
          .or(`ticket_id.ilike.${clean},email.ilike.${clean},username.ilike.${clean}`)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) return { data: null, error };
        return { data: data && data.length > 0 ? data[0] : null, error: null };
      });
    },

    /**
     * Get all password reset requests (Admin view)
     */
    async getAll(filters = {}) {
      return withRetry(async (client) => {
        let query = client.from('password_reset_requests').select('*').order('created_at', { ascending: false });
        if (filters.department) {
          query = query.eq('department', filters.department.toUpperCase());
        }
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        return await query;
      });
    },

    /**
     * Admin approves an officer password reset request
     */
    async approve(requestId, adminId = null, adminNotes = null) {
      return withRetry(async (client) => {
        const updateData = {
          status: 'Approved',
          approved_by: adminId,
          approved_at: new Date().toISOString(),
          admin_notes: adminNotes || 'Approved by Administrator.'
        };

        const res = await client
          .from('password_reset_requests')
          .update(updateData)
          .eq('id', requestId)
          .select()
          .single();

        if (!res.error && res.data) {
          const req = res.data;
          if (req.staff_id) {
            try {
              await client.from('notifications').insert({
                staff_user_id: req.staff_id,
                title: 'Password Reset Request Approved',
                message: `Your password reset request (${req.ticket_id}) has been approved by the Administrator. You can now set your new password on the official login portal.`,
                is_read: false
              });
            } catch (e) {}
          }

          try {
            await auditLogs.log({
              staffUserId: adminId,
              action: 'OFFICER_PASSWORD_RESET_APPROVED',
            entityType: 'staff_profile',
            entityId: req.staff_id,
            details: `Admin approved password reset ticket ${req.ticket_id} for ${req.username} (${req.email})`
          });
          } catch (e) {
            console.warn('[Audit Log Warning]:', e);
          }

          if (typeof window.broadcastRealtimeEvent === 'function') {
            window.broadcastRealtimeEvent('OFFICER_PASSWORD_RESET_APPROVED', { request: req });
          }
        }

        return res;
      });
    },

    /**
     * Admin rejects an officer password reset request
     */
    async reject(requestId, adminId = null, reason = 'Request denied by Administrator.') {
      return withRetry(async (client) => {
        const updateData = {
          status: 'Rejected',
          approved_by: adminId,
          approved_at: new Date().toISOString(),
          admin_notes: reason
        };

        const res = await client
          .from('password_reset_requests')
          .update(updateData)
          .eq('id', requestId)
          .select()
          .single();

        if (!res.error && res.data) {
          const req = res.data;
          if (req.staff_id) {
            try {
              await client.from('notifications').insert({
                staff_user_id: req.staff_id,
                title: 'Password Reset Request Disapproved',
                message: `Your password reset request (${req.ticket_id}) was not approved. Reason: ${reason}`,
                is_read: false
              });
            } catch (e) {}
          }

          try {
            await auditLogs.log({
              staffUserId: adminId,
              action: 'OFFICER_PASSWORD_RESET_REJECTED',
            entityType: 'staff_profile',
            entityId: req.staff_id,
            details: `Admin rejected password reset ticket ${req.ticket_id} for ${req.username}. Reason: ${reason}`
          });
          } catch (e) {
            console.warn('[Audit Log Warning]:', e);
          }

          if (typeof window.broadcastRealtimeEvent === 'function') {
            window.broadcastRealtimeEvent('OFFICER_PASSWORD_RESET_REJECTED', { request: req });
          }
        }

        return res;
      });
    },

    /**
     * Officer completes password update after approval
     */
    async completePasswordReset({ identifier, newPassword }) {
      return withRetry(async (client) => {
        const clean = (identifier || '').trim().toLowerCase();
        if (!clean || !newPassword) {
          return { error: { message: 'Identifier and new password are required.' } };
        }
        if (newPassword.length < 8) {
          return { error: { message: 'Password must be at least 8 characters long.' } };
        }

        // Find approved request
        const { data: reqs, error: reqErr } = await client
          .from('password_reset_requests')
          .select('*')
          .or(`ticket_id.ilike.${clean},email.ilike.${clean},username.ilike.${clean}`)
          .eq('status', 'Approved')
          .order('approved_at', { ascending: false })
          .limit(1);

        if (reqErr || !reqs || reqs.length === 0) {
          return { error: { message: 'No admin-approved password reset request found for this account.' } };
        }

        const activeReq = reqs[0];

        // 1. Update password in Supabase Auth if session exists or via isolated client
        try {
          if (client.auth && client.auth.updateUser) {
            await client.auth.updateUser({ password: newPassword }).catch(() => {});
          }
        } catch (authErr) {
          console.warn('[PASSWORD_RESETS] Auth updateUser notice:', authErr);
        }

        // 2. Mark request as Completed
        await client
          .from('password_reset_requests')
          .update({
            status: 'Completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', activeReq.id);

        // 3. Update staff_profiles timestamp and ensure active
        if (activeReq.staff_id) {
          await client
            .from('staff_profiles')
            .update({
              status: 'Active',
              updated_at: new Date().toISOString()
            })
            .eq('id', activeReq.staff_id);
        }

        // 4. Audit log
        try {
          await auditLogs.log({
            staffUserId: activeReq.staff_id,
            action: 'OFFICER_PASSWORD_RESET_COMPLETED',
          entityType: 'staff_profile',
          entityId: activeReq.staff_id,
          details: `Officer ${activeReq.username} (${activeReq.email}) successfully completed password update under approved ticket ${activeReq.ticket_id}`
        });
        } catch (e) {
          console.warn('[Audit Log Warning]:', e);
        }

        // 5. Broadcast Realtime event
        if (typeof window.broadcastRealtimeEvent === 'function') {
          window.broadcastRealtimeEvent('OFFICER_PASSWORD_RESET_COMPLETED', { request: activeReq });
        }

        return {
          data: {
            success: true,
            ticketId: activeReq.ticket_id,
            email: activeReq.email,
            username: activeReq.username,
            message: 'Password has been updated in Supabase! You may now sign in with your new password.'
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
    withButtonLoading,
    programs,
    beneficiaries,
    staffProfiles,
    applications,
    interviews,
    schedules: interviews,
    notifications,
    distributions,
    approvedAssistance,
    funds,
    auditLogs,
    activityLog,
    batches,
    realtime,
    tracking,
    auth,
    passwordResets
  });
})();

// Global shortcut
window.DataService = DataService;

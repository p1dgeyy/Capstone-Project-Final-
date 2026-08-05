/**
 * Supabase Client Configuration
 * 
 * Initializes the Supabase JS client for the entire frontend application.
 * This replaces the old api-config.js that pointed to the Railway Express backend.
 *
 * IMPORTANT: Replace the placeholder values below with your actual Supabase
 * project URL and anon key. These are safe to expose client-side — security
 * is enforced by Row Level Security (RLS) policies on the database.
 *
 * You can find these values in:
 *   Supabase Dashboard → Settings → API → Project URL & anon/public key
 */

const SUPABASE_CONFIG = (() => {
  'use strict';

  // ========================================================================
  // REPLACE THESE WITH YOUR ACTUAL SUPABASE CREDENTIALS
  // ========================================================================
  const SUPABASE_URL = 'https://oqnbckqfwmpcmouyptvj.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xbmJja3Fmd21wY21vdXlwdHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NzMwOTgsImV4cCI6MjEwMTI0OTA5OH0._SzwQalNutaIIyZiERwa9tSYdcJeMS85Chk_iQw1CCI';
  // ========================================================================

  // Validate that credentials have been set
  if (SUPABASE_URL.includes('YOUR_PROJECT_ID') || SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY')) {
    console.error(
      '[SUPABASE] ⚠️ Supabase credentials not configured!\n' +
      'Open frontend/assets/js/supabase-config.js and replace:\n' +
      '  - SUPABASE_URL with your project URL\n' +
      '  - SUPABASE_ANON_KEY with your anon/public key\n' +
      'Find these in: Supabase Dashboard → Settings → API'
    );
  }

  // Initialize the Supabase client (supabase-js loaded via CDN)
  let client = null;

  try {
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      });
      console.log('[SUPABASE] Client initialized successfully.');
    } else {
      console.error('[SUPABASE] supabase-js library not loaded. Add the CDN script tag before this file.');
    }
  } catch (error) {
    console.error('[SUPABASE] Client initialization failed:', error.message);
  }

  return Object.freeze({
    URL: SUPABASE_URL,
    ANON_KEY: SUPABASE_ANON_KEY,
    client: client
  });
})();

// Global shortcut for the Supabase client (used throughout the app)
const supabaseClient = SUPABASE_CONFIG.client;

/**
 * API Configuration
 * 
 * Centralises the backend API base URL so every frontend page
 * resolves it from one place instead of hard-coding paths.
 */

if (typeof window.API_CONFIG === 'undefined') {
  window.API_CONFIG = (() => {
    'use strict';

    // 1. Runtime override (highest priority)
    if (typeof window.__API_BASE_URL__ === 'string' && window.__API_BASE_URL__) {
      return Object.freeze({ BASE_URL: window.__API_BASE_URL__.replace(/\/+$/, '') });
    }

    // 2. <meta name="api-base-url" content="...">
    const meta = document.querySelector('meta[name="api-base-url"]');
    if (meta && meta.content) {
      return Object.freeze({ BASE_URL: meta.content.replace(/\/+$/, '') });
    }

    // 3. Fallback — same-origin (relative paths, works behind Nginx/Vercel rewrites)
    return Object.freeze({ BASE_URL: '' });
  })();
}

var API_CONFIG = window.API_CONFIG;

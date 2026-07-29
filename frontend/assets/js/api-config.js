/**
 * API Configuration
 * 
 * Centralises the backend API base URL so every frontend page
 * resolves it from one place instead of hard-coding paths.
 *
 * How it works (in priority order):
 *   1. window.__API_BASE_URL__  – set at runtime (e.g. by a CI/CD injected <script>)
 *   2. <meta name="api-base-url"> – set in the HTML <head>
 *   3. ''  (empty string)        – falls back to relative paths (works when
 *                                   frontend and backend share the same origin,
 *                                   e.g. behind the Nginx reverse-proxy in Docker)
 *
 * For Vercel (or any separate deployment), set the <meta> tag or the global
 * variable to your backend's public URL, for example:
 *
 *   <meta name="api-base-url" content="https://your-backend.up.railway.app">
 *
 * The value must NOT end with a trailing slash.
 */

const API_CONFIG = (() => {
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

  // 3. Fallback — same-origin (relative paths, works behind Nginx/Docker)
  return Object.freeze({ BASE_URL: '' });
})();

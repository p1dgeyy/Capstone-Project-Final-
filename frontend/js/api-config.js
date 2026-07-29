/**
 * Central API Configuration Alias
 */

if (typeof window.API_CONFIG === 'undefined') {
  const isVercel = typeof window !== 'undefined' && window.location && window.location.hostname.includes('vercel.app');
  
  let baseUrl = '';
  if (typeof window.__API_BASE_URL__ === 'string' && window.__API_BASE_URL__) {
    baseUrl = window.__API_BASE_URL__.replace(/\/+$/, '');
  } else {
    const meta = document.querySelector('meta[name="api-base-url"]');
    if (meta && meta.content) {
      baseUrl = meta.content.replace(/\/+$/, '');
    } else if (isVercel) {
      baseUrl = 'https://capstone-project-final-production.up.railway.app';
    }
  }

  window.API_CONFIG = Object.freeze({
    BASE_URL: baseUrl
  });
}

var API_CONFIG = window.API_CONFIG;

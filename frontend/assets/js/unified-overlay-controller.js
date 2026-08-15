/**
 * Unified Overlay Controller & Accessibility Layer
 * City Government of Koronadal — PESO & CSWDO Portals
 * 
 * Features:
 * 1. Global ESC-key modal & overlay dismissal.
 * 2. Backdrop click-to-dismiss for all custom modal dialogs.
 * 3. ARIA accessibility decoration (role="dialog", aria-modal="true", focus management).
 * 4. Smooth overflow scroll locking during active modal overlays.
 */

(function () {
  'use strict';

  // Helper: Close whichever modal is currently active
  function closeTopmostModal() {
    // 1. Close system notification overlay if active
    const snOverlay = document.querySelector('.sn-overlay');
    if (snOverlay && typeof window.hideSystemNotification === 'function') {
      window.hideSystemNotification();
      return true;
    }

    // 2. Close active custom modal backdrops (.custom-modal-backdrop.show or .custom-modal.show)
    const customModals = Array.from(document.querySelectorAll('.custom-modal-backdrop.show, .custom-modal.show'));
    if (customModals.length > 0) {
      const topModal = customModals[customModals.length - 1];
      
      // Look for a close button or standard close function
      const closeBtn = topModal.querySelector('.btn-close, .custom-modal-close, button[data-bs-dismiss="modal"], button[onclick*="close"], button[onclick*="Close"]');
      if (closeBtn) {
        closeBtn.click();
      } else {
        topModal.classList.remove('show');
        topModal.style.display = 'none';
        document.body.classList.remove('modal-open');
      }
      return true;
    }

    // 3. Close active Bootstrap modals
    const bsModals = Array.from(document.querySelectorAll('.modal.show'));
    if (bsModals.length > 0) {
      const topBsModal = bsModals[bsModals.length - 1];
      if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const inst = bootstrap.Modal.getInstance(topBsModal);
        if (inst) {
          inst.hide();
          return true;
        }
      }
      const closeBtn = topBsModal.querySelector('.btn-close, [data-bs-dismiss="modal"]');
      if (closeBtn) {
        closeBtn.click();
        return true;
      }
    }

    return false;
  }

  // Initialize accessibility attributes & backdrop click handlers
  function initOverlayListeners() {
    // A. Global Keydown (Escape key)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        closeTopmostModal();
      }
    });

    // B. Global Backdrop Click Handler for Custom Modals
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;

      // If clicked directly on the custom modal backdrop (outside dialog)
      if (target.classList && (target.classList.contains('custom-modal-backdrop') || target.classList.contains('custom-modal'))) {
        if (target.classList.contains('show')) {
          const closeBtn = target.querySelector('.btn-close, .custom-modal-close, button[data-bs-dismiss="modal"], button[onclick*="close"], button[onclick*="Close"]');
          if (closeBtn) {
            closeBtn.click();
          } else {
            target.classList.remove('show');
            target.style.display = 'none';
            document.body.classList.remove('modal-open');
          }
        }
      }
    });

    // C. Enhance all modal containers with Accessibility Roles
    function decorateModals() {
      const allModals = document.querySelectorAll('.modal, .custom-modal-backdrop, .custom-modal');
      allModals.forEach((modal) => {
        if (!modal.getAttribute('role')) {
          modal.setAttribute('role', 'dialog');
        }
        if (!modal.getAttribute('aria-modal')) {
          modal.setAttribute('aria-modal', 'true');
        }
        if (!modal.getAttribute('tabindex')) {
          modal.setAttribute('tabindex', '-1');
        }
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', decorateModals);
    } else {
      decorateModals();
    }

    // Observe dynamic DOM insertions of modals
    if (window.MutationObserver) {
      const observer = new MutationObserver((mutations) => {
        for (const mut of mutations) {
          if (mut.addedNodes && mut.addedNodes.length > 0) {
            decorateModals();
            break;
          }
        }
      });
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    }
  }

  // Auto-run
  initOverlayListeners();

  // Export API
  window.UnifiedOverlayController = Object.freeze({
    closeTopmostModal,
    initOverlayListeners
  });
})();

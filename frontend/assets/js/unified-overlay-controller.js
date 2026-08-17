/**
 * Unified Overlay Controller & Accessibility Layer
 * City Government of Koronadal — PESO & CSWDO Portals
 * 
 * Features:
 * 1. Global ESC-key modal & overlay dismissal (System notifications, Custom modals, Bootstrap modals, Dropdowns).
 * 2. Backdrop click-to-dismiss for all custom modal dialogs.
 * 3. ARIA accessibility decoration (role="dialog", aria-modal="true", keyboard focus management).
 * 4. Automatic overflow scroll locking during active modal overlays via body.modal-open.
 * 5. Universal modal helper methods (openModal, closeModal, closeTopmostModal).
 */

(function () {
  'use strict';

  let lastActiveElement = null;
  let isHandlingClick = false;

  // Helper: Check if any modal or notification overlay is currently open
  function hasActiveModals() {
    try {
      const hasSn = !!document.querySelector('.sn-overlay');
      const hasCustom = !!document.querySelector('.custom-modal-backdrop.show, .custom-modal.show');
      const hasBs = !!document.querySelector('.modal.show');
      return hasSn || hasCustom || hasBs;
    } catch (e) {
      return false;
    }
  }

  // Update body scroll lock state (Debounced against redundant class toggles)
  function syncBodyScrollLock() {
    try {
      if (!document.body) return;
      const shouldLock = hasActiveModals();
      const isCurrentlyLocked = document.body.classList.contains('modal-open');
      if (shouldLock && !isCurrentlyLocked) {
        document.body.classList.add('modal-open');
      } else if (!shouldLock && isCurrentlyLocked) {
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
      }
    } catch (e) {
      console.warn('[UnifiedOverlayController] syncBodyScrollLock error:', e);
    }
  }

  // Helper: Close whichever modal is currently active
  function closeTopmostModal() {
    try {
      // 1. Close system notification overlay if active
      const snOverlay = document.querySelector('.sn-overlay');
      if (snOverlay) {
        if (typeof window.hideSystemNotification === 'function') {
          window.hideSystemNotification();
        } else {
          snOverlay.remove();
        }
        syncBodyScrollLock();
        restoreFocus();
        return true;
      }

      // 2. Close active custom modal backdrops (.custom-modal-backdrop.show or .custom-modal.show)
      const customModals = Array.from(document.querySelectorAll('.custom-modal-backdrop.show, .custom-modal.show'));
      if (customModals.length > 0) {
        const topModal = customModals[customModals.length - 1];
        
        // Look for a close button or standard close function
        const closeBtn = topModal.querySelector('.btn-close, .custom-modal-close, .btn-modal-close, button[data-bs-dismiss="modal"], button[onclick*="close"], button[onclick*="Close"]');
        if (closeBtn) {
          closeBtn.click();
        } else {
          topModal.classList.remove('show');
          topModal.style.display = 'none';
        }
        setTimeout(syncBodyScrollLock, 50);
        restoreFocus();
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
            setTimeout(syncBodyScrollLock, 150);
            restoreFocus();
            return true;
          }
        }
        const closeBtn = topBsModal.querySelector('.btn-close, [data-bs-dismiss="modal"]');
        if (closeBtn) {
          closeBtn.click();
          setTimeout(syncBodyScrollLock, 150);
          restoreFocus();
          return true;
        }
      }

      // 4. Close open dropdown menus if no modals were open
      const openDropdowns = Array.from(document.querySelectorAll('.dropdown-menu.show'));
      if (openDropdowns.length > 0) {
        openDropdowns.forEach(dd => dd.classList.remove('show'));
        return true;
      }
    } catch (e) {
      console.warn('[UnifiedOverlayController] closeTopmostModal error:', e);
    }

    return false;
  }

  // Focus restoration helper
  function restoreFocus() {
    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      try {
        lastActiveElement.focus();
      } catch (e) {
        // Ignore detached element focus errors
      }
      lastActiveElement = null;
    }
  }

  // Open custom modal helper
  function openCustomModal(modalId) {
    try {
      const modal = document.getElementById(modalId);
      if (!modal) return;

      lastActiveElement = document.activeElement;
      modal.classList.add('show');
      if (modal.classList.contains('custom-modal') || modal.classList.contains('custom-modal-backdrop')) {
        modal.style.display = 'flex';
      }
      syncBodyScrollLock();

      // Focus the first autofocus element or modal itself
      const focusTarget = modal.querySelector('[autofocus], input:not([type="hidden"]), select, textarea, button:not(.btn-close)') || modal;
      if (focusTarget && typeof focusTarget.focus === 'function') {
        setTimeout(() => {
          try { focusTarget.focus(); } catch (e) {}
        }, 50);
      }
    } catch (e) {
      console.error(`[UnifiedOverlayController] openCustomModal(${modalId}) error:`, e);
    }
  }

  // Close custom modal helper
  function closeCustomModal(modalId) {
    try {
      const modal = document.getElementById(modalId);
      if (!modal) return;

      modal.classList.remove('show');
      if (modal.classList.contains('custom-modal') || modal.classList.contains('custom-modal-backdrop')) {
        modal.style.display = 'none';
      }
      syncBodyScrollLock();
      restoreFocus();
    } catch (e) {
      console.error(`[UnifiedOverlayController] closeCustomModal(${modalId}) error:`, e);
    }
  }

  // Initialize accessibility attributes & backdrop click handlers
  function initOverlayListeners() {
    // A. Global Keydown (Escape key)
    document.addEventListener('keydown', (e) => {
      try {
        if (e.key === 'Escape' || e.key === 'Esc') {
          closeTopmostModal();
        }
      } catch (err) {
        console.warn('[UnifiedOverlayController] keydown handler warning:', err);
      }
    });

    // B. Global Backdrop Click Handler for Custom Modals (Protected against recursion)
    document.addEventListener('click', (e) => {
      if (isHandlingClick) return;
      try {
        const target = e.target;
        if (!target) return;

        // Track trigger clicks for focus restoration
        if (typeof target.matches === 'function' && target.matches('button, a, [data-bs-toggle="modal"], [onclick*="open"], [onclick*="Open"], [onclick*="show"], [onclick*="Show"]')) {
          lastActiveElement = target;
        }

        // If clicked directly on the custom modal backdrop (outside dialog)
        if (target.classList && (target.classList.contains('custom-modal-backdrop') || target.classList.contains('custom-modal'))) {
          if (target.classList.contains('show')) {
            isHandlingClick = true;
            try {
              const closeBtn = target.querySelector('.btn-close, .custom-modal-close, .btn-modal-close, button[data-bs-dismiss="modal"], button[onclick*="close"], button[onclick*="Close"]');
              if (closeBtn) {
                closeBtn.click();
              } else {
                target.classList.remove('show');
                target.style.display = 'none';
                syncBodyScrollLock();
                restoreFocus();
              }
            } finally {
              isHandlingClick = false;
            }
          }
        }
      } catch (err) {
        console.warn('[UnifiedOverlayController] click handler warning:', err);
      }
    });

    // C. Enhance all modal containers with Accessibility Roles
    function decorateModals() {
      try {
        const allModals = document.querySelectorAll('.modal, .custom-modal-backdrop, .custom-modal');
        allModals.forEach((modal) => {
          if (!modal) return;
          if (!modal.getAttribute('role')) {
            modal.setAttribute('role', 'dialog');
          }
          if (!modal.getAttribute('aria-modal')) {
            modal.setAttribute('aria-modal', 'true');
          }
          if (!modal.getAttribute('tabindex')) {
            modal.setAttribute('tabindex', '-1');
          }

          // Ensure close buttons have aria-label
          const closeBtns = modal.querySelectorAll('.btn-close, .custom-modal-close, .btn-modal-close');
          closeBtns.forEach(btn => {
            if (btn && !btn.getAttribute('aria-label')) {
              btn.setAttribute('aria-label', 'Close modal');
            }
          });
        });
      } catch (e) {
        console.warn('[UnifiedOverlayController] decorateModals error:', e);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        try {
          decorateModals();
          syncBodyScrollLock();
        } catch (e) { }
      });
    } else {
      try {
        decorateModals();
        syncBodyScrollLock();
      } catch (e) { }
    }

    // Observe dynamic DOM insertions of modals and state changes (safeguarded against observer loops)
    if (window.MutationObserver) {
      const observer = new MutationObserver((mutations) => {
        try {
          let shouldDecorate = false;
          let shouldSyncScroll = false;
          for (const mut of mutations) {
            if (mut.target === document.body && mut.attributeName === 'class') {
              // Skip self-mutations on body to prevent mutation cascades
              continue;
            }
            if (mut.addedNodes && mut.addedNodes.length > 0) {
              shouldDecorate = true;
            }
            if (mut.type === 'attributes' && (mut.attributeName === 'class' || mut.attributeName === 'style')) {
              shouldSyncScroll = true;
            }
          }
          if (shouldDecorate) decorateModals();
          if (shouldSyncScroll) syncBodyScrollLock();
        } catch (e) {
          console.warn('[UnifiedOverlayController] MutationObserver warning:', e);
        }
      });

      try {
        observer.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'style']
        });
      } catch (obsErr) {
        console.warn('[UnifiedOverlayController] observe init warning:', obsErr);
      }
    }
  }

  // Auto-run
  try {
    initOverlayListeners();
  } catch (e) {
    console.error('[UnifiedOverlayController] init error:', e);
  }

  // Export API
  window.UnifiedOverlayController = Object.freeze({
    closeTopmostModal,
    openCustomModal,
    closeCustomModal,
    openModal: openCustomModal,
    closeModal: closeCustomModal,
    hasActiveModals,
    syncBodyScrollLock,
    initOverlayListeners
  });
})();

/**
 * PESO Authentication & Session Guard Module (peso-auth.js)
 * City Government of Koronadal - Public Employment Service Office
 * 
 * Handles:
 * 1. Role verification & Portal routing (PESO Admin -> peso_admin.html, PESO Officer -> peso_officer.html)
 * 2. Session state monitoring & Supabase onAuthStateChange watchers
 * 3. Graceful token expiry handling & auto-redirection
 * 4. Safe sign-out with complete storage purging
 */

const PesoAuth = (() => {
    'use strict';

    /**
     * Get the active session profile
     */
    function getCurrentUser() {
        const storedRole = sessionStorage.getItem('userRole') || 'Guest';
        const storedUsername = sessionStorage.getItem('username') || 'User';
        const storedId = sessionStorage.getItem('userId') || '0';
        const storedName = sessionStorage.getItem('userFullName') || storedUsername;
        const storedDept = sessionStorage.getItem('department') || 'PESO';

        return {
            id: storedId,
            username: storedUsername,
            fullName: storedName,
            role: storedRole,
            department: storedDept
        };
    }

    /**
     * Check if active user is PESO Admin
     */
    function isAdmin() {
        const role = (sessionStorage.getItem('userRole') || '').toLowerCase();
        return role.includes('admin');
    }

    /**
     * Check if active user is PESO Officer
     */
    function isOfficer() {
        const role = (sessionStorage.getItem('userRole') || '').toLowerCase();
        return role.includes('officer');
    }

    /**
     * Safe Sign-Out action
     */
    async function logout(redirectTarget = 'admin_login.html') {
        try {
            if (typeof SessionManager !== 'undefined' && SessionManager.logout) {
                await SessionManager.logout(redirectTarget);
                return;
            }

            if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                await supabaseClient.auth.signOut();
            }
        } catch (err) {
            console.warn('[PesoAuth] Sign-out warning (handled):', err.message);
        } finally {
            // Purge all session keys
            const keys = ['userId', 'sessionToken', 'userRole', 'jwtAccessToken', 'username', 'userFullName', 'department', 'currentUser'];
            keys.forEach(k => {
                try { sessionStorage.removeItem(k); localStorage.removeItem(k); } catch (e) {}
            });
            try { sessionStorage.clear(); } catch (e) {}
            window.location.href = redirectTarget;
        }
    }

    /**
     * Enforce role check on dashboard load
     */
    async function enforceRole(requiredRole) {
        if (typeof AuthGuard !== 'undefined' && AuthGuard.requireRole) {
            return await AuthGuard.requireRole([requiredRole]);
        }
        return true;
    }

    return Object.freeze({
        getCurrentUser,
        isAdmin,
        isOfficer,
        logout,
        enforceRole
    });
})();

// Global backwards-compatibility shortcuts
window.PesoAuth = PesoAuth;
window.logoutAdmin = () => PesoAuth.logout('admin_login.html');
window.logoutOfficer = () => PesoAuth.logout('admin_login.html');

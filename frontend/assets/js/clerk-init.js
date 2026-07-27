/**
 * Clerk Authentication Integration for Static HTML Frontend
 * Capstone Project Final
 */

(function () {
    // Primary Clerk Publishable Key
    const CLERK_PUBLISHABLE_KEY = window.CLERK_PUBLISHABLE_KEY || 'pk_test_dmVyaWZpZWQtYXJhY2huaWQtOTcuY2xlcmsuYWNjb3VudHMuZGV2JA';

    const ClerkAuth = {
        clerk: null,
        isLoaded: false,

        /**
         * Dynamically load the Clerk JS SDK from CDN
         */
        loadSDK: function () {
            return new Promise((resolve, reject) => {
                if (window.Clerk) {
                    this.clerk = window.Clerk;
                    return resolve(this.clerk);
                }

                const script = document.createElement('script');
                script.setAttribute('data-clerk-publishable-key', CLERK_PUBLISHABLE_KEY);
                script.async = true;
                script.crossOrigin = 'anonymous';
                script.src = 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js';

                script.addEventListener('load', async () => {
                    try {
                        await window.Clerk.load();
                        this.clerk = window.Clerk;
                        this.isLoaded = true;
                        console.log('[Clerk SDK] Loaded and initialized successfully.');
                        resolve(this.clerk);
                    } catch (err) {
                        console.error('[Clerk SDK] Initialization failed:', err);
                        reject(err);
                    }
                });

                script.addEventListener('error', (err) => {
                    console.error('[Clerk SDK] Script load error:', err);
                    reject(err);
                });

                document.head.appendChild(script);
            });
        },

        /**
         * Initialize Clerk UI components and listeners for static HTML pages
         */
        init: async function (options = {}) {
            try {
                const clerk = await this.loadSDK();

                // 1. Mount Sign-In component if container present
                const signInContainer = document.getElementById(options.signInId || 'clerk-sign-in');
                if (signInContainer && clerk) {
                    clerk.mountSignIn(signInContainer, {
                        afterSignInUrl: options.afterSignInUrl || 'beneficiary.html',
                        signUpUrl: options.signUpUrl || 'beneficiary_register.html'
                    });
                }

                // 2. Mount Sign-Up component if container present
                const signUpContainer = document.getElementById(options.signUpId || 'clerk-sign-up');
                if (signUpContainer && clerk) {
                    clerk.mountSignUp(signUpContainer, {
                        afterSignUpUrl: options.afterSignUpUrl || 'beneficiary.html',
                        signInUrl: options.signInUrl || 'official_login.html'
                    });
                }

                // 3. Mount User Button component if container present
                const userButtonContainer = document.getElementById(options.userButtonId || 'clerk-user-button');
                if (userButtonContainer && clerk && clerk.user) {
                    clerk.mountUserButton(userButtonContainer, {
                        afterSignOutUrl: options.afterSignOutUrl || 'official_login.html'
                    });
                }

                // 4. Session State Listener
                clerk.addListener(async ({ user, session }) => {
                    if (user && session) {
                        console.log('[Clerk Auth] User logged in:', user.primaryEmailAddress?.emailAddress);
                        sessionStorage.setItem('clerk_user_id', user.id);
                        sessionStorage.setItem('clerk_user_email', user.primaryEmailAddress?.emailAddress || '');

                        try {
                            const token = await session.getToken();
                            sessionStorage.setItem('clerk_jwt', token);
                        } catch (tErr) {
                            console.warn('[Clerk Auth] Unable to get JWT:', tErr);
                        }
                    } else {
                        console.log('[Clerk Auth] User logged out.');
                        sessionStorage.removeItem('clerk_user_id');
                        sessionStorage.removeItem('clerk_user_email');
                        sessionStorage.removeItem('clerk_jwt');
                    }
                });

                return clerk;
            } catch (error) {
                console.warn('[Clerk Auth] UI Initialization warning:', error.message);
            }
        },

        /**
         * Get authorization header object for API calls (Fetch API)
         */
        getAuthHeader: async function () {
            if (this.clerk && this.clerk.session) {
                try {
                    const token = await this.clerk.session.getToken();
                    return { 'Authorization': `Bearer ${token}` };
                } catch (e) {
                    console.warn('[Clerk Auth] Failed to get session token:', e);
                }
            }
            const storedJwt = sessionStorage.getItem('clerk_jwt');
            if (storedJwt) {
                return { 'Authorization': `Bearer ${storedJwt}` };
            }
            return {};
        },

        /**
         * Sign out current user
         */
        signOut: async function (redirectUrl = 'official_login.html') {
            if (this.clerk) {
                await this.clerk.signOut();
            }
            sessionStorage.clear();
            window.location.href = redirectUrl;
        }
    };

    // Expose globally
    window.ClerkAuth = ClerkAuth;

    // Auto-initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        ClerkAuth.init();
    });
})();

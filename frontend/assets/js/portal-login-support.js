/**
 * =========================================================================
 * CITY OF KORONADAL - PORTAL LOGIN SUPPORT CONTROLLER (portal-login-support.js)
 * Handles Theme Toggling, Bilingual Translations, Privacy Compliance Scroll,
 * FAQ Accordion, Knowledgebase & Forgot Password Workflows.
 * =========================================================================
 */

(function () {
    'use strict';

    // 1. BILINGUAL TRANSLATIONS DICTIONARY
    const translations = {
        'en': {
            'left_title': 'Livelihood & Social Welfare Assistance Management',
            'left_desc': 'Welcome to the official administration portal. Connect, coordinate, and deliver social welfare services and livelihood programs to the citizens of Koronadal.',
            'badge_secure': 'Secure Access',
            'badge_case': 'Case Management',
            'badge_tracking': 'Program Tracking',
            'peso_cswdo_portal': 'PESO & CSWDO Portal',
            'sub_title': 'City Livelihood & Social Welfare Assistance System',
            'faq': 'FAQ',
            'kb': 'Knowledgebase',
            'data_privacy': 'Data Privacy',
            'staff_login': 'Staff Log In',
            'enter_credentials': 'Enter your official credentials to access the admin panel',
            'beneficiary_login_title': 'Beneficiary Log In',
            'beneficiary_login_subtitle': 'Enter your registered username/email and password to log in',
            'username_email': 'Username or Email',
            'username_placeholder': 'Enter username or email',
            'username_label': 'Username or Email',
            'username_placeholder_beneficiary': 'Enter username or email',
            'password': 'Password',
            'password_label': 'Password',
            'password_placeholder': 'Enter password',
            'forgot_password': 'Forgot Password?',
            'login_as_admin': 'Login as Admin / Staff',
            'back_to_beneficiary': 'Back to Beneficiary Portal',
            'login_button': 'Log In',
            'register_new_account': 'Register New Beneficiary Account',
            'privacy_modal_title': 'Data Privacy & Compliance',
            'agree_label': 'I have read and agreed to the Privacy Statement and Terms and Conditions.',
            'proceed_btn': 'Proceed',
            'scroll_notice_pending': '<i class="bi bi-arrow-down-circle-fill me-1"></i> Please scroll through the Privacy Statement and Terms to the bottom to enable the checkbox.',
            'scroll_notice_done': '<i class="bi bi-check-circle-fill me-1"></i> Terms read. You may now check the agreement box and click Proceed.',
            'sr_announcement_done': 'Privacy Statement and Terms and Conditions have been read completely. You can now check the agreement box to proceed.',
            'error_invalid': 'Invalid username/email or password.',
            'success_redirect': 'Login successful! Redirecting...'
        },
        'tg': {
            'left_title': 'Pamamahala ng Tulong sa Kabuhayan at Kalingang Panlipunan',
            'left_desc': 'Maligayang pagdating sa opisyal na portal ng administrasyon. Kumonekta, makipag-ugnayan, at maghatid ng mga serbisyong panlipunan at mga programa sa kabuhayan sa mga mamamayan ng Koronadal.',
            'badge_secure': 'Ligtas na Akses',
            'badge_case': 'Pamamahala ng Kaso',
            'badge_tracking': 'Pagsubaybay sa Programa',
            'peso_cswdo_portal': 'Portal ng PESO at CSWDO',
            'sub_title': 'Sistema ng Tulong sa Kabuhayan at Kalingang Panlipunan ng Lungsod',
            'faq': 'FAQ',
            'kb': 'Basehan ng Kaalaman',
            'data_privacy': 'Pagkapribado ng Datos',
            'staff_login': 'Pag-log In ng Kawani',
            'enter_credentials': 'Ilagay ang iyong opisyal na impormasyon upang ma-access ang admin panel',
            'beneficiary_login_title': 'Pag-log In ng Benepisyaryo',
            'beneficiary_login_subtitle': 'Ilagay ang iyong rehistradong username/email at password upang mag-log in',
            'username_email': 'Username o Email',
            'username_placeholder': 'Ilagay ang username o email',
            'username_label': 'Username o Email',
            'username_placeholder_beneficiary': 'Ilagay ang iyong username o email',
            'password': 'Password',
            'password_label': 'Password',
            'password_placeholder': 'Ilagay ang password',
            'forgot_password': 'Nakalimutan ang Password?',
            'login_as_admin': 'Mag-log in bilang Admin / Kawani',
            'back_to_beneficiary': 'Bumalik sa Portal ng Benepisyaryo',
            'login_button': 'Mag-log In',
            'register_new_account': 'Magparehistro ng Bagong Account',
            'privacy_modal_title': 'Pagkapribado ng Datos at Pagsunod',
            'agree_label': 'Nabasa ko at sumasang-ayon ako sa Pahayag ng Pagkapribado at mga Tuntunin at Kundisyon.',
            'proceed_btn': 'Magpatuloy',
            'scroll_notice_pending': '<i class="bi bi-arrow-down-circle-fill me-1"></i> Mangyaring i-scroll ang Pahayag ng Pagkapribado at mga Tuntunin hanggang sa ibaba upang paganahin ang checkbox.',
            'scroll_notice_done': '<i class="bi bi-check-circle-fill me-1"></i> Nabasa na ang mga tuntunin. Maaari mo nang lagyan ng tsek ang kasunduan at i-click ang Magpatuloy.',
            'sr_announcement_done': 'Ang Pahayag ng Pagkapribado at mga Tuntunin at Kundisyon ay ganap nang nabasa. Maaari mo nang lagyan ng tsek ang kahon ng kasunduan upang magpatuloy.',
            'error_invalid': 'Maling username/email o password.',
            'success_redirect': 'Matagumpay na pag-log in! Nagdidirekta...'
        }
    };

    // 2. THEME CONTROLLER
    function applyTheme(theme) {
        const isDark = theme === 'dark';
        const darkModeIcon = document.getElementById('darkModeIcon');
        const darkModeText = document.getElementById('darkModeText');

        if (isDark) {
            document.body.classList.add('dark-mode');
            if (darkModeIcon) darkModeIcon.className = 'bi bi-sun-fill';
            if (darkModeText) darkModeText.textContent = 'Light Mode';
        } else {
            document.body.classList.remove('dark-mode');
            if (darkModeIcon) darkModeIcon.className = 'bi bi-moon-fill';
            if (darkModeText) darkModeText.textContent = 'Dark Mode';
        }
    }

    function toggleDarkMode() {
        const currentTheme = localStorage.getItem('theme') === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', currentTheme);
        applyTheme(currentTheme);
    }

    // 3. LANGUAGE CONTROLLER
    function applyLanguage(lang) {
        const currentLang = translations[lang] ? lang : 'en';
        const dict = translations[currentLang];

        document.querySelectorAll('[data-translate]').forEach(el => {
            const key = el.getAttribute('data-translate');
            if (dict[key]) {
                const icon = el.querySelector('i');
                if (icon) {
                    el.innerHTML = '';
                    el.appendChild(icon);
                    el.appendChild(document.createTextNode(' ' + dict[key]));
                } else {
                    el.textContent = dict[key];
                }
            }
        });

        document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
            const key = el.getAttribute('data-translate-placeholder');
            if (dict[key]) {
                el.placeholder = dict[key];
            }
        });

        const langToggle = document.getElementById('languageToggle');
        if (langToggle) {
            langToggle.textContent = currentLang === 'en' ? 'English' : 'Tagalog';
        }

        const scrollNoticeEl = document.getElementById('scrollNotice');
        if (scrollNoticeEl) {
            scrollNoticeEl.innerHTML = hasReadTerms ? dict['scroll_notice_done'] : dict['scroll_notice_pending'];
        }
    }

    function toggleLanguage() {
        const currentLang = localStorage.getItem('lang') === 'tg' ? 'en' : 'tg';
        localStorage.setItem('lang', currentLang);
        applyLanguage(currentLang);
    }

    // 4. MODAL CONTROLLERS
    function showModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add('active');
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';

        if (id === 'privacyModal') {
            initPrivacyScrollCheck();
        }
    }

    function hideModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('active');
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }

    // 5. PRIVACY AGREEMENT SCROLL TRACKER
    let hasReadTerms = false;

    function checkPrivacyScroll() {
        if (hasReadTerms) return;
        const privacyModalBody = document.querySelector('#privacyModal .custom-modal-body');
        const privacyAgreeCheck = document.getElementById('privacyAgreeCheck');
        const scrollNotice = document.getElementById('scrollNotice');
        const srAnnouncement = document.getElementById('srAnnouncement');

        if (!privacyModalBody) return;

        const threshold = 25;
        const scrolledToBottom = (privacyModalBody.scrollHeight - privacyModalBody.scrollTop - privacyModalBody.clientHeight) <= threshold;

        if (scrolledToBottom) {
            hasReadTerms = true;
            if (privacyAgreeCheck) privacyAgreeCheck.disabled = false;

            if (scrollNotice) {
                scrollNotice.classList.add('completed');
                const lang = localStorage.getItem('lang') || 'en';
                scrollNotice.innerHTML = translations[lang]['scroll_notice_done'];
            }

            if (srAnnouncement) {
                const lang = localStorage.getItem('lang') || 'en';
                srAnnouncement.textContent = translations[lang]['sr_announcement_done'];
            }

            privacyModalBody.removeEventListener('scroll', checkPrivacyScroll);
        }
    }

    function initPrivacyScrollCheck() {
        const privacyModalBody = document.querySelector('#privacyModal .custom-modal-body');
        const privacyAgreeCheck = document.getElementById('privacyAgreeCheck');
        const privacyProceedBtn = document.getElementById('privacyProceedBtn');
        const scrollNotice = document.getElementById('scrollNotice');
        const lang = localStorage.getItem('lang') || 'en';

        if (!privacyModalBody) return;

        if (hasReadTerms) {
            if (privacyAgreeCheck) privacyAgreeCheck.disabled = false;
            if (scrollNotice) {
                scrollNotice.classList.add('completed');
                scrollNotice.innerHTML = translations[lang]['scroll_notice_done'];
            }
            return;
        }

        if (privacyModalBody.scrollHeight <= privacyModalBody.clientHeight + 15) {
            hasReadTerms = true;
            if (privacyAgreeCheck) privacyAgreeCheck.disabled = false;
            if (scrollNotice) {
                scrollNotice.classList.add('completed');
                scrollNotice.innerHTML = translations[lang]['scroll_notice_done'];
            }
        } else {
            if (privacyAgreeCheck) {
                privacyAgreeCheck.disabled = true;
                privacyAgreeCheck.checked = false;
            }
            if (privacyProceedBtn) privacyProceedBtn.disabled = true;
            if (scrollNotice) {
                scrollNotice.classList.remove('completed');
                scrollNotice.innerHTML = translations[lang]['scroll_notice_pending'];
            }

            privacyModalBody.removeEventListener('scroll', checkPrivacyScroll);
            privacyModalBody.addEventListener('scroll', checkPrivacyScroll);
            checkPrivacyScroll();
        }
    }

    // 6. INITIALIZATION ON DOM LOAD
    document.addEventListener('DOMContentLoaded', function () {
        // Theme & Lang
        const savedTheme = localStorage.getItem('theme') || 'light';
        applyTheme(savedTheme);

        const savedLang = localStorage.getItem('lang') || 'en';
        applyLanguage(savedLang);

        // Auto-show Privacy & Terms Modal on page open if not yet accepted in this session
        const hasAgreedPrivacy = sessionStorage.getItem('privacyAgreed') === 'true';
        const privacyModalEl = document.getElementById('privacyModal');
        const closePrivacyBtn = document.getElementById('closePrivacyBtn');

        if (!hasAgreedPrivacy && privacyModalEl) {
            setTimeout(() => {
                showModal('privacyModal');
            }, 350);
        } else if (hasAgreedPrivacy && closePrivacyBtn) {
            closePrivacyBtn.classList.remove('d-none');
        }

        // Privacy Modal Triggers
        const privacyLink = document.getElementById('privacyLink');
        if (privacyLink) privacyLink.addEventListener('click', (e) => { e.preventDefault(); showModal('privacyModal'); });

        if (closePrivacyBtn) closePrivacyBtn.addEventListener('click', () => hideModal('privacyModal'));

        const privacyBackdrop = document.getElementById('privacyBackdrop');
        if (privacyBackdrop) privacyBackdrop.addEventListener('click', () => {
            const privacyAgreeCheck = document.getElementById('privacyAgreeCheck');
            if (privacyAgreeCheck && privacyAgreeCheck.checked) hideModal('privacyModal');
        });

        const privacyAgreeCheck = document.getElementById('privacyAgreeCheck');
        const privacyProceedBtn = document.getElementById('privacyProceedBtn');
        if (privacyAgreeCheck && privacyProceedBtn) {
            privacyAgreeCheck.addEventListener('change', function () {
                privacyProceedBtn.disabled = !this.checked;
            });

            privacyProceedBtn.addEventListener('click', function () {
                if (privacyAgreeCheck.checked && hasReadTerms) {
                    sessionStorage.setItem('privacyAgreed', 'true');
                    if (closePrivacyBtn) closePrivacyBtn.classList.remove('d-none');
                    hideModal('privacyModal');
                }
            });
        }

        // FAQ Modal Triggers
        const faqLink = document.getElementById('faqLink');
        if (faqLink) faqLink.addEventListener('click', (e) => { e.preventDefault(); showModal('faqModal'); });

        const closeFaqBtn = document.getElementById('closeFaqBtn');
        if (closeFaqBtn) closeFaqBtn.addEventListener('click', () => hideModal('faqModal'));

        const faqBackdrop = document.getElementById('faqBackdrop');
        if (faqBackdrop) faqBackdrop.addEventListener('click', () => hideModal('faqModal'));

        // FAQ Accordion Toggles
        document.querySelectorAll('.faq-question').forEach(question => {
            question.addEventListener('click', function () {
                const item = this.parentElement;
                const wasActive = item.classList.contains('active');
                document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
                if (!wasActive) item.classList.add('active');
            });
        });

        // Knowledgebase Modal Triggers
        const kbLink = document.getElementById('kbLink');
        if (kbLink) kbLink.addEventListener('click', (e) => { e.preventDefault(); showModal('kbModal'); });

        const closeKbBtn = document.getElementById('closeKbBtn');
        if (closeKbBtn) closeKbBtn.addEventListener('click', () => hideModal('kbModal'));

        const kbBackdrop = document.getElementById('kbBackdrop');
        if (kbBackdrop) kbBackdrop.addEventListener('click', () => hideModal('kbModal'));

        // Password Visibility Toggle
        const togglePassword = document.getElementById('togglePassword');
        const passwordInput = document.getElementById('password');
        if (togglePassword && passwordInput) {
            togglePassword.addEventListener('click', function () {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                const icon = this.querySelector('i');
                if (icon) {
                    icon.classList.toggle('bi-eye');
                    icon.classList.toggle('bi-eye-slash');
                }
            });
        }
    });

    // Expose Global Helper API
    window.translations = translations;
    window.LoginSupport = {
        translations,
        applyTheme,
        toggleDarkMode,
        applyLanguage,
        toggleLanguage,
        showModal,
        hideModal,
        initPrivacyScrollCheck
    };

    window.toggleDarkMode = toggleDarkMode;
    window.toggleLanguage = toggleLanguage;
    window.showModal = showModal;
    window.hideModal = hideModal;

})();

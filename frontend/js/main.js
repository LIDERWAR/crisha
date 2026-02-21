
document.addEventListener('DOMContentLoaded', () => {
    // --- Logger Helper ---
    function log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const fullMsg = `[${timestamp}] ${msg}`;
        if (type === 'error') console.error(fullMsg);
        else console.log(fullMsg);
    }

    log('>>> Main Script Loaded');

    // --- Configuration ---
    const CONFIG = {
        API_URL: 'http://127.0.0.1:8000/api',
        ENDPOINTS: {
            HEALTH: '/health/',
            ANALYZE: '/analyze/',
            LOGOUT: '/auth/logout/'
        },
        SELECTORS: {
            NAV_LOGIN_BTN: 'nav a[href="login.html"]',
            NAV_CONTAINER: 'nav',
            DROP_ZONE: '#drop-zone',
            FILE_INPUT: '#file-input',
            LOADING_STATE: '#loading-state',
            LOADING_TEXT: '#loading-text',
            RESULTS_SECTION: '#results-section',
            CLOSE_RESULTS_BTN: '#close-results',
            DOWNLOAD_BTN: '#download-pdf-btn', // Will need to add ID to HTML
            CONSULT_BTN: '#consult-btn',       // Will need to add ID to HTML
            CONTACTS_LINK: 'a[href="#"]',     // Need to be specific if possible
            SCORE_VALUE: '#score-value',
            SUMMARY_TEXT: '#summary-text',
            RISKS_CONTAINER: '#risks-container'
        }
    };

    // --- State ---
    let state = {
        token: null,
        user: null,
        currentDocument: null
    };

    // --- Initialization ---
    init();

    function init() {
        checkHealth();
        initAuth();
        initNavigation();
        initFileUpload();
        initResultsModal();
        initAnimations();
    }

    // --- Health Check ---
    function checkHealth() {
        fetch(`${CONFIG.API_URL}${CONFIG.ENDPOINTS.HEALTH}`)
            .then(r => r.json())
            .then(d => log(`Backend Health: ${d.status}`))
            .catch(e => log(`Backend Health Check Failed: ${e.message}`, 'error'));
    }

    // --- Auth Logic ---
    function initAuth() {
        try {
            if (typeof auth !== 'undefined') {
                state.token = auth.getToken();
                const userStr = localStorage.getItem('cc_user');
                if (userStr) state.user = JSON.parse(userStr);

                log(`Auth Status: ${state.token ? 'Logged In' : 'Guest'}`);
                updateAuthUI();
            } else {
                log('Auth module not found!', 'error');
            }
        } catch (e) {
            log(`Auth init error: ${e.message}`, 'error');
        }
    }

    function updateAuthUI() {
        const loginBtn = document.querySelector(CONFIG.SELECTORS.NAV_LOGIN_BTN);

        if (state.token && loginBtn) {
            // Transform "Login" button to "Dashboard"
            loginBtn.textContent = 'Кабинет';
            loginBtn.href = 'dashboard.html';

            // Add Logout Button
            const navContainer = document.querySelector(CONFIG.SELECTORS.NAV_CONTAINER);
            // We want to append it to the right side, maybe next to the login button?
            // The structure is: [Logo] [Links] [Btn]
            // We'll insert it after the login button if not already present

            if (!document.getElementById('logout-btn')) {
                const logoutBtn = document.createElement('button');
                logoutBtn.id = 'logout-btn';
                logoutBtn.textContent = 'Выйти';
                logoutBtn.className = 'ml-4 bg-transparent hover:bg-white/10 text-white px-5 py-2 rounded-full text-sm font-medium transition border border-white/20 hover:border-brand-orange/30';
                logoutBtn.onclick = handleLogout;

                // Construct a container if needed, or just append to nav
                // Current nav: flex justify-between. 
                // [Logo] [Links] [Btn]
                // We want [Logo] [Links] [Btn Group]

                // Let's create a wrapper for buttons if it doesn't exist
                const parent = loginBtn.parentElement;
                if (parent.tagName === 'NAV') {
                    // Start wrapping
                    const wrapper = document.createElement('div');
                    wrapper.className = 'flex items-center gap-4';
                    loginBtn.replaceWith(wrapper);
                    wrapper.appendChild(loginBtn);
                    wrapper.appendChild(logoutBtn);
                } else {
                    // Already wrapped?
                    parent.appendChild(logoutBtn);
                }
            }
        }
    }

    async function handleLogout() {
        if (confirm('Вы уверены, что хотите выйти?')) {
            if (typeof auth !== 'undefined') {
                await auth.logout();
                updateAuthUI(); // Should redirect anyway
            }
        }
    }

    // --- Navigation & Inactive Buttons ---
    function initNavigation() {
        // Fix "Contacts" link - find links with href="#" and text "Контакты"
        const links = document.querySelectorAll('a');
        links.forEach(link => {
            if (link.textContent.trim() === 'Контакты' && link.getAttribute('href') === '#') {
                link.href = 'mailto:support@contractcheck.ru';
                link.title = 'Написать в поддержку';
            }
        });

        // Smooth scroll for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;

                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    e.preventDefault();
                    targetElement.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    // --- File Upload Logic ---
    function initFileUpload() {
        const dropZone = document.querySelector(CONFIG.SELECTORS.DROP_ZONE);
        const fileInput = document.querySelector(CONFIG.SELECTORS.FILE_INPUT);

        if (!dropZone || !fileInput) return;

        // Ensure input covers the zone
        fileInput.style.display = 'block';
        fileInput.style.opacity = '0';
        fileInput.style.position = 'absolute';
        fileInput.style.inset = '0';
        fileInput.style.zIndex = '100';

        fileInput.addEventListener('click', e => e.stopPropagation());

        fileInput.addEventListener('change', (e) => {
            e.stopPropagation();
            e.preventDefault();

            const file = e.target.files[0];
            const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

            // Simple extension check as fallback
            const name = file.name.toLowerCase();
            const isValidExt = name.endsWith('.pdf') || name.endsWith('.docx') || name.endsWith('.doc') || name.endsWith('.txt');

            if (file && (validTypes.includes(file.type) || isValidExt)) {
                uploadFile(file);
            } else {
                alert('Пожалуйста, выберите файл PDF, Word (DOC/DOCX) или TXT.');
            }
        });
    }

    async function uploadFile(file) {
        const loadingState = document.querySelector(CONFIG.SELECTORS.LOADING_STATE);
        const loadingText = document.querySelector(CONFIG.SELECTORS.LOADING_TEXT);

        log(`Starting upload: ${file.name} (${file.size} bytes)`);

        if (loadingState) loadingState.classList.remove('hidden');

        // Animation
        const messages = [
            "Загрузка файла...",
            "Извлечение текста...",
            "Поиск рисков (это может занять 1-2 минуты)...",
            "Анализ условий...",
            "Формирование отчета..."
        ];
        let msgIndex = 0;
        let intervalId = null;

        if (loadingText) {
            loadingText.textContent = messages[0];
            intervalId = setInterval(() => {
                msgIndex = (msgIndex + 1) % messages.length;
                loadingText.textContent = messages[msgIndex];
            }, 1500);
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const headers = { 'Accept': 'application/json' };
            if (state.token) headers['Authorization'] = `Token ${state.token}`;

            const response = await fetch(`${CONFIG.API_URL}${CONFIG.ENDPOINTS.ANALYZE}`, {
                method: 'POST',
                body: formData,
                headers: headers
            });

            if (response.ok) {
                const data = await response.json();
                state.currentDocument = data; // Store data for interactions
                log('Upload success');

                if (intervalId) clearInterval(intervalId);

                // Show success animation
                if (loadingState) {
                    loadingState.innerHTML = `
                        <div class="flex flex-col items-center animate-fade-in-up">
                            <div class="w-16 h-16 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center mb-4">
                                <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                            </div>
                            <div class="text-green-500 font-bold text-lg mb-1">Готово!</div>
                            <div class="text-gray-400 text-xs">Перенаправление...</div>
                        </div>
                    `;
                }

                // Redirect logic
                setTimeout(() => {
                    if (state.token) {
                        window.location.href = 'dashboard.html';
                    } else {
                        // Show modal for guests
                        if (loadingState) loadingState.classList.add('hidden'); // Hide loading overlay
                        showResults(data);
                    }
                }, 1500);

            } else if (response.status === 401 || response.status === 403) {
                // Перенаправление неавторизованных пользователей или тех у кого нет доступов (лимиты) на логин/доп.страницу (сейчас только логин как запрошено для 401)
                log('Unauthorized or forbidden access - Redirecting to login page', 'error');
                if (intervalId) clearInterval(intervalId);
                if (loadingState) loadingState.classList.add('hidden');
                window.location.href = 'login.html';
            } else {
                throw new Error(`Server error: ${response.status}`);
            }
        } catch (error) {
            log(`Upload error: ${error.message}`, 'error');
            alert(`Ошибка: ${error.message}`);
            if (intervalId) clearInterval(intervalId);
            if (loadingState) loadingState.classList.add('hidden');
        }
    }

    // --- Results Modal Logic ---
    function initResultsModal() {
        const closeBtn = document.querySelector(CONFIG.SELECTORS.CLOSE_RESULTS_BTN);
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.querySelector(CONFIG.SELECTORS.RESULTS_SECTION).classList.add('hidden');
            });
        }

        // Wire up buttons - these need to be found DYNAMICALLY or ensure IDs exist
        // We will add IDs in the next step (updating index.html)
        // But we can delegate or search by class/text for now if needed.
        // Better to wait for updated HTML. But let's add listeners assuming IDs will be there.

        const downloadBtn = document.getElementById('download-pdf-btn'); // Will add this ID
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                if (state.currentDocument && state.currentDocument.file) {
                    const link = document.createElement('a');
                    link.href = state.currentDocument.file;
                    link.download = state.currentDocument.name || 'document.pdf';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else {
                    alert('Документ не найден или ссылка недоступна.');
                }
            });
        }
        // Note: I will use event delegation for these in case they are dynamic or IDs missing
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('#download-pdf-btn')) {
                handleDownload();
            }
            if (e.target.closest('#consult-btn')) {
                window.location.href = 'mailto:support@contractcheck.ru?subject=Юридическая консультация';
            }
        });
    }

    function handleDownload() {
        if (state.currentDocument && state.currentDocument.file) {
            const link = document.createElement('a');
            link.href = state.currentDocument.file;
            link.download = state.currentDocument.name || 'document.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            alert('Документ не найден.');
        }
    }

    function showResults(data) {
        const modal = document.querySelector(CONFIG.SELECTORS.RESULTS_SECTION);
        if (!modal) return;

        // Populate Data
        const score = data.score || 0;
        const scoreValueEl = document.querySelector(CONFIG.SELECTORS.SCORE_VALUE);
        const iconContainer = document.getElementById('score-icon-container');

        // Determine Color & Icon
        let colorClass = 'text-red-500';
        let borderColorClass = 'border-red-500';
        let iconSvg = `
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>`; // Red X

        if (score >= 80) {
            colorClass = 'text-green-500';
            borderColorClass = 'border-green-500';
            iconSvg = `
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>`; // Green Check
        } else if (score >= 50) {
            colorClass = 'text-yellow-500';
            borderColorClass = 'border-yellow-500';
            iconSvg = `
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>`; // Yellow Warning
        }

        // Apply Styles
        scoreValueEl.className = `text-4xl font-bold ${colorClass}`;
        scoreValueEl.textContent = `${score}/100`;

        if (iconContainer) {
            iconContainer.className = `w-16 h-16 rounded-full border-4 ${borderColorClass} flex items-center justify-center ${colorClass}`;
            iconContainer.innerHTML = iconSvg;
        }

        document.querySelector(CONFIG.SELECTORS.SUMMARY_TEXT).textContent = data.summary || 'Нет описания';

        const risksContainer = document.querySelector(CONFIG.SELECTORS.RISKS_CONTAINER);
        risksContainer.innerHTML = '';

        if (data.risks && data.risks.length > 0) {
            data.risks.forEach(risk => {
                const riskEl = document.createElement('div');
                riskEl.className = 'bg-white/5 rounded-xl p-4 border border-white/5';
                riskEl.innerHTML = `
                    <div class="flex items-start gap-3">
                        <div class="mt-1 w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></div>
                        <div>
                            <h4 class="font-bold text-white text-sm mb-1">${risk.risk || 'Риск'}</h4>
                            <p class="text-gray-400 text-xs">${risk.recommendation || ''}</p>
                        </div>
                    </div>
                `;
                risksContainer.appendChild(riskEl);
            });
        } else {
            risksContainer.innerHTML = '<p class="text-gray-500 italic">Рисков не обнаружено.</p>';
        }

        modal.classList.remove('hidden');
    }

    // --- Animations ---
    function initAnimations() {
        const reveals = document.querySelectorAll('.reveal');
        function checkScroll() {
            reveals.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.top < window.innerHeight - 50) {
                    el.classList.add('visible');
                }
            });
        }
        window.addEventListener('scroll', checkScroll);
        setTimeout(checkScroll, 100);
        checkScroll();
    }

    // --- PAYMENT INTEGRATION ---
    window.startPayment = async function (plan_id) {
        const token = localStorage.getItem('cc_token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        try {
            // Show loading state if needed
            const btn = event?.target;
            const originalText = btn ? btn.innerText : '';
            if (btn) {
                btn.disabled = true;
                btn.innerText = 'Загрузка...';
            }

            const response = await fetch('http://127.0.0.1:8000/api/payment/create/', {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ plan_id })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.payment_url) {
                    window.location.href = data.payment_url;
                }
            } else {
                const errorData = await response.json();
                alert(errorData.error || 'Ошибка при создании платежа');
            }

            if (btn) {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        } catch (error) {
            console.error('Payment error:', error);
            alert('Ошибка сети. Попробуйте позже.');
        }
    };

    initAnimations();
});

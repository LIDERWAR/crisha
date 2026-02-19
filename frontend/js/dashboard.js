document.addEventListener('DOMContentLoaded', async () => {
    // БЕЗ auth.checkAuth - работаем без авторизации

    // Пользователь
    const userStr = localStorage.getItem('crisha_user');
    if (userStr) {
        const user = JSON.parse(userStr);
        const nameElements = document.querySelectorAll('.user-name-display');
        nameElements.forEach(el => el.textContent = user.username || 'User');

        const emailElements = document.querySelectorAll('.user-email-display');
        emailElements.forEach(el => el.textContent = user.email || 'Free Plan');
    }

    // Logout
    const logoutBtns = document.querySelectorAll('.logout-btn');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            auth.logout();
        });
    });

    // Загрузка документов
    await loadDocuments();

    // Mobile Menu Logic
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    function toggleMenu() {
        const isHidden = sidebar.classList.contains('hidden');

        if (isHidden) {
            // Open
            sidebar.classList.remove('hidden');
            overlay.classList.remove('hidden');
            // Small delay to allow display:block to apply before transition
            setTimeout(() => {
                sidebar.classList.remove('-translate-x-full');
                overlay.classList.remove('opacity-0');
            }, 10);
        } else {
            // Close
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('opacity-0');

            // Wait for transition to finish before hiding
            setTimeout(() => {
                sidebar.classList.add('hidden');
                overlay.classList.add('hidden');
            }, 300);
        }
    }

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMenu);
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', toggleMenu);
    if (overlay) overlay.addEventListener('click', toggleMenu);

    // Active Menu Logic
    const sidebarLinks = document.querySelectorAll('.sidebar-link');

    function updateActiveMenu() {
        const hash = window.location.hash || '#'; // Default to empty/overview

        sidebarLinks.forEach(link => {
            const linkHref = link.getAttribute('href');
            // Check if link matches hash, OR if it's the default (#) and hash is empty
            const isActive = linkHref === hash || (hash === '' && linkHref === '#');

            if (isActive) {
                // Active Styles
                link.classList.add('bg-white/10', 'text-white');
                link.classList.remove('text-gray-400', 'hover:bg-white/5');
            } else {
                // Inactive Styles
                link.classList.remove('bg-white/10', 'text-white');
                link.classList.add('text-gray-400', 'hover:bg-white/5', 'hover:text-white');
            }
        });
    }

    // Initialize on load
    updateActiveMenu();

    // Update on hash change
    window.addEventListener('hashchange', updateActiveMenu);

    // Update on click (instant feedback)
    sidebarLinks.forEach(link => {
        link.addEventListener('click', () => {
            // Allow default behavior (navigation) then update
            setTimeout(updateActiveMenu, 10);

            // Also close mobile menu if open
            if (window.innerWidth < 768) {
                toggleMenu();
            }
        });
    });

    async function loadDocuments() {
        const tableBody = document.querySelector('#documents-table tbody');
        if (!tableBody) return;

        const token = localStorage.getItem('crisha_token');

        if (!token) {
            tableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Пожалуйста, <a href="login.html" class="text-brand-orange hover:underline">войдите</a>, чтобы видеть ваши документы.</td></tr>';
            return;
        }

        try {
            const response = await fetch('http://127.0.0.1:8000/api/documents/', {
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                tableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">Сессия истекла. <a href="login.html" class="text-brand-orange hover:underline">Войти снова</a></td></tr>';
                // Опционально: auth.logout();
                return;
            }

            if (!response.ok) throw new Error('Failed');

            const documents = await response.json();
            renderTable(documents);
            updateStats(documents);

        } catch (error) {
            console.error(error);
            tableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">Ошибка загрузки документов</td></tr>';
        }
    }

    function renderTable(documents) {
        const tableBody = document.querySelector('#documents-table tbody');
        tableBody.innerHTML = '';

        if (documents.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Нет документов</td></tr>';
            return;
        }

        documents.forEach(doc => {
            const row = `
            <tr class="border-b border-white/5 table-row-static hover:bg-white/[0.07] hover:bg-opacity-100 hover:shadow-lg hover:border-transparent transition-all duration-200 cursor-pointer relative z-0 hover:z-10" onclick="viewDocument(${doc.id})">
                <td class="px-6 py-4 text-sm" data-label="Документ">${doc.name || 'Без названия'}</td>
                <td class="px-6 py-4 text-sm text-gray-400" data-label="Дата">${new Date(doc.uploaded_at).toLocaleDateString('ru-RU')}</td>
                <td class="px-6 py-4" data-label="Статус">
                    <span class="px-3 py-1 text-xs rounded-full ${doc.status === 'processed' ? 'bg-green-500/20 text-green-400' : doc.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}">
                        ${doc.status === 'processed' ? 'Готов' : doc.status === 'failed' ? 'Ошибка' : 'Обработка'}
                    </span>
                </td>
                <td class="px-6 py-4" data-label="Оценка">
                    <div class="flex items-center gap-2">
                        <div class="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-brand-orange to-brand-red" style="width: ${doc.score || 0}%"></div>
                        </div>
                        <span class="text-sm font-bold ${doc.score >= 70 ? 'text-green-400' : doc.score >= 40 ? 'text-yellow-400' : 'text-red-400'}">
                            ${doc.score || 0}/100
                        </span>
                    </div>
                </td>
                <td class="px-6 py-4 text-right" data-label="Действие">
                    <button onclick="event.stopPropagation(); deleteDocument(${doc.id})" class="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition" title="Удалить">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
            tableBody.innerHTML += row;
        });
    }

    function updateStats(documents) {
        const total = documents.length;
        const processed = documents.filter(d => d.status === 'processed').length;
        const avgScore = processed > 0 ? Math.round(documents.reduce((sum, d) => sum + (d.score || 0), 0) / processed) : 0;

        // Safely update elements if they exist
        const elTotal = document.querySelector('.stat-total') || document.getElementById('docs-count');
        if (elTotal) elTotal.textContent = total;

        const elProcessed = document.querySelector('.stat-processed');
        if (elProcessed) elProcessed.textContent = processed;

        const elScore = document.querySelector('.stat-score');
        if (elScore) elScore.textContent = avgScore;
    }

    function viewDocument(id) {
        window.location.href = `document.html?id=${id}`;
    }

    async function deleteDocument(id) {
        if (!confirm('Вы уверены, что хотите удалить этот документ?')) return;

        const token = localStorage.getItem('crisha_token');
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/documents/${id}/`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Token ${token}`
                }
            });

            if (response.ok) {
                loadDocuments(); // Refresh table
            } else {
                alert('Ошибка при удалении');
            }
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('Ошибка сети');
        }
    }

    window.viewDocument = viewDocument;
    window.deleteDocument = deleteDocument;
});

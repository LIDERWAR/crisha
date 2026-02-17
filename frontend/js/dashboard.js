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
            <tr class="border-b border-white/5 table-row-static">
                <td class="px-6 py-4 text-sm">${doc.name || 'Без названия'}</td>
                <td class="px-6 py-4 text-sm text-gray-400">${new Date(doc.uploaded_at).toLocaleDateString('ru-RU')}</td>
                <td class="px-6 py-4">
                    <span class="px-3 py-1 text-xs rounded-full ${doc.status === 'processed' ? 'bg-green-500/20 text-green-400' : doc.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}">
                        ${doc.status === 'processed' ? 'Готов' : doc.status === 'failed' ? 'Ошибка' : 'Обработка'}
                    </span>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                        <div class="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-brand-orange to-brand-red" style="width: ${doc.score || 0}%"></div>
                        </div>
                        <span class="text-sm font-bold ${doc.score >= 70 ? 'text-green-400' : doc.score >= 40 ? 'text-yellow-400' : 'text-red-400'}">
                            ${doc.score || 0}/100
                        </span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <button onclick="viewDocument(${doc.id})" class="text-brand-orange hover:text-brand-red transition mr-2">Открыть</button>
                    <button onclick="deleteDocument(${doc.id})" class="text-gray-500 hover:text-red-500 transition">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

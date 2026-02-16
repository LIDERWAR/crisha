document.addEventListener('DOMContentLoaded', async () => {
    // Check Auth
    auth.checkAuth();

    // Display User Info
    const userStr = localStorage.getItem('crisha_user');
    if (userStr) {
        const user = JSON.parse(userStr);
        const nameElements = document.querySelectorAll('.user-name-display');
        nameElements.forEach(el => el.textContent = user.username || 'User');

        const emailElements = document.querySelectorAll('.user-email-display');
        emailElements.forEach(el => el.textContent = user.email || 'Free Plan');
    }

    // Logout Handler
    const logoutBtns = document.querySelectorAll('.logout-btn');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            auth.logout();
        });
    });

    // Fetch and Display Documents
    await loadDocuments();
});

async function loadDocuments() {
    const tableBody = document.querySelector('#documents-table tbody');
    if (!tableBody) return;

    try {
        const response = await auth.fetchWithAuth('/documents/');
        if (!response.ok) throw new Error('Failed to fetch documents');

        const documents = await response.json();
        renderTable(documents);
        updateStats(documents);

    } catch (error) {
        console.error('Error loading documents:', error);
        tableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">Ошибка загрузки данных</td></tr>';
    }
}

function renderTable(documents) {
    const tableBody = document.querySelector('#documents-table tbody');
    tableBody.innerHTML = '';

    if (documents.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Нет проверенных документов</td></tr>';
        return;
    }

    documents.forEach(doc => {
        const date = new Date(doc.uploaded_at).toLocaleDateString('ru-RU');
        const score = doc.score !== null ? doc.score : '?';
        let scoreClass = 'text-gray-400';
        if (score > 80) scoreClass = 'text-green-400';
        else if (score > 50) scoreClass = 'text-yellow-400';
        else if (score !== '?') scoreClass = 'text-red-400';

        const row = document.createElement('tr');
        row.className = 'table-row-static border-b border-white/5';
        row.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded bg-red-500/20 text-red-500 flex items-center justify-center font-bold text-xs">PDF</div>
                    <span class="font-medium text-white break-all">${doc.name || 'Document'}</span>
                </div>
            </td>
            <td class="px-6 py-4">${date}</td>
            <td class="px-6 py-4">
                <span class="${scoreClass} font-bold">${score}/100</span>
            </td>
            <td class="px-6 py-4">
                <span class="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs font-bold">Готово</span>
            </td>
            <td class="px-6 py-4 text-right">
                <button class="text-gray-400 hover:text-white transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function updateStats(documents) {
    const countEl = document.getElementById('docs-count');
    if (countEl) countEl.textContent = documents.length;
}

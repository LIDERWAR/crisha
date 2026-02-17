document.addEventListener('DOMContentLoaded', async () => {

    // Auth Check
    const token = localStorage.getItem('crisha_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // User Info
    const userStr = localStorage.getItem('crisha_user');
    if (userStr) {
        const user = JSON.parse(userStr);
        document.querySelectorAll('.user-name-display').forEach(el => el.textContent = user.username);
        document.querySelectorAll('.user-email-display').forEach(el => el.textContent = user.email);
    }

    // Get ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const docId = urlParams.get('id');

    if (!docId) {
        alert('ID документа не указан');
        window.location.href = 'dashboard.html';
        return;
    }

    await loadDocumentDetails(docId, token);
});

async function loadDocumentDetails(id, token) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/documents/${id}/`, {
            headers: {
                'Authorization': `Token ${token}`
            }
        });

        if (response.status === 404) {
            alert('Документ не найден или у вас нет прав доступа');
            window.location.href = 'dashboard.html';
            return;
        }

        if (!response.ok) throw new Error('Failed to fetch');

        const doc = await response.json();
        renderDocument(doc);
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('doc-name').textContent = 'Ошибка загрузки';
    }
}

function renderDocument(doc) {
    // Basic Info
    document.getElementById('doc-name').textContent = doc.name || 'Без названия';
    document.getElementById('doc-date').textContent = new Date(doc.uploaded_at).toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Status
    const statusEl = document.getElementById('doc-status');
    statusEl.textContent = doc.status === 'processed' ? 'Готов' : doc.status === 'failed' ? 'Ошибка' : 'Обработка';
    statusEl.className = `px-3 py-1 rounded-lg text-white inline-block text-sm ${doc.status === 'processed' ? 'bg-green-500/20 text-green-400' :
            doc.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                'bg-yellow-500/20 text-yellow-400'
        }`;

    // Score
    const score = doc.score || 0;
    document.getElementById('doc-score').textContent = `${score}/100`;
    document.getElementById('doc-score-mini').textContent = score;

    // Circle progress
    const circle = document.getElementById('score-circle');
    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = offset;

    // Color based on score
    let colorClass = 'text-red-500';
    if (score >= 70) colorClass = 'text-green-500';
    else if (score >= 40) colorClass = 'text-yellow-500';

    circle.classList.remove('text-brand-orange'); // Remove default
    // Tailwind doesn't support dynamic class construction well without safelist, so we use inline style or standard classes if possible. 
    // Ideally we'd replace the class. For now let's just keep brand-orange or switch.
    if (score >= 70) circle.style.color = '#22c55e'; // green-500
    else if (score >= 40) circle.style.color = '#eab308'; // yellow-500
    else circle.style.color = '#ef4444'; // red-500


    // Summary
    document.getElementById('doc-summary').textContent = doc.summary || 'Нет описания.';

    // Risks
    const risksList = document.getElementById('risks-list');
    risksList.innerHTML = '';

    if (doc.risks && doc.risks.length > 0) {
        // Assuming risks is a string (JSON) or array. The serializer usually returns JSON field as dict/list.
        // If it's a text field in Django, it might need parsing.
        // Let's assume it attempts to be an array.

        let risks = doc.risks;
        if (typeof risks === 'string') {
            try { risks = JSON.parse(risks); } catch (e) { }
        }

        if (Array.isArray(risks)) {
            risks.forEach(risk => {
                const div = document.createElement('div');
                div.className = 'p-4 rounded-xl bg-white/5 border border-white/5 flex gap-4 items-start';
                div.innerHTML = `
                    <div class="mt-1 w-6 h-6 flex-shrink-0 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 text-xs font-bold">!</div>
                    <div>
                        <h4 class="font-bold text-white text-sm mb-1">${risk.title || 'Риск'}</h4>
                        <p class="text-xs text-gray-400">${risk.description || risk}</p>
                    </div>
                `;
                risksList.appendChild(div);
            });
        } else {
            risksList.innerHTML = `<div class="text-gray-400 text-sm">${doc.risks}</div>`;
        }
    } else {
        risksList.innerHTML = '<div class="p-4 rounded-xl bg-white/5 border border-white/5 text-center text-gray-500">Риски не найдены</div>';
    }
}

async function deleteCurrentDocument() {
    if (!confirm('Удалить этот документ?')) return;

    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const token = localStorage.getItem('crisha_token');

    try {
        const response = await fetch(`http://127.0.0.1:8000/api/documents/${id}/`, {
            method: 'DELETE',
            headers: { 'Authorization': `Token ${token}` }
        });

        if (response.ok) {
            window.location.href = 'dashboard.html';
        } else {
            alert('Ошибка при удалении');
        }
    } catch (e) {
        console.error(e);
        alert('Ошибка сети');
    }
}

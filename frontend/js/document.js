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

    // Score & Icon Logic
    const score = doc.score || 0;
    document.getElementById('doc-score').textContent = `${score}/100`;

    // Icon Logic (Same as main.js)
    const iconContainer = document.getElementById('score-icon-container');
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

    if (iconContainer) {
        iconContainer.className = `w-16 h-16 rounded-full border-4 ${borderColorClass} flex items-center justify-center ${colorClass}`;
        iconContainer.innerHTML = iconSvg;
    }

    // Download Button (Original)
    const downloadBtn = document.getElementById('download-pdf-btn');
    if (downloadBtn) {
        downloadBtn.onclick = () => {
            if (doc.file) {
                const link = document.createElement('a');
                link.href = doc.file;
                link.download = doc.name || 'document';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                alert('Файл недоступен');
            }
        };
    }

    // Download Improved
    const downloadImprovedBtn = document.getElementById('download-improved-btn');
    if (downloadImprovedBtn) {
        if (doc.improved_file) {
            downloadImprovedBtn.classList.remove('hidden');
            downloadImprovedBtn.onclick = () => {
                const link = document.createElement('a');
                link.href = doc.improved_file;
                link.download = `improved_${doc.name || 'document'}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };
        } else {
            downloadImprovedBtn.classList.add('hidden');
        }
    }

    // Summary
    document.getElementById('doc-summary').textContent = doc.summary || 'Нет описания.';

    // Risks
    const risksList = document.getElementById('risks-list');
    risksList.innerHTML = '';

    if (doc.risks && doc.risks.length > 0) {
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
                        <h4 class="font-bold text-white text-sm mb-1">${risk.title || risk.risk || 'Риск'}</h4>
                        <p class="text-xs text-gray-400">${risk.description || risk.recommendation || ''}</p>
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

    // Recommendations
    const recommendationsList = document.getElementById('recommendations-list');
    recommendationsList.innerHTML = '';

    if (doc.recommendations && doc.recommendations.length > 0) {
        let recs = doc.recommendations;
        if (typeof recs === 'string') {
            try { recs = JSON.parse(recs); } catch (e) { }
        }

        if (Array.isArray(recs)) {
            recs.forEach(rec => {
                const div = document.createElement('div');
                div.className = 'p-5 rounded-xl bg-brand-orange/5 border border-brand-orange/10';

                let clauseHtml = '';
                if (rec.clause_example) {
                    clauseHtml = `
                        <div class="mt-3 bg-black/30 p-3 rounded-lg border border-white/5 font-mono text-sm text-gray-300">
                            <div class="text-xs text-brand-orange mb-1 font-bold uppercase">Пример формулировки:</div>
                            "${rec.clause_example}"
                        </div>
                    `;
                }

                div.innerHTML = `
                    <h4 class="font-bold text-brand-orange text-md mb-2 flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        ${rec.title || 'Рекомендация'}
                    </h4>
                    <p class="text-sm text-gray-300 leading-relaxed">${rec.description || ''}</p>
                    ${clauseHtml}
                `;
                recommendationsList.appendChild(div);
            });
        }
    } else {
        recommendationsList.innerHTML = '<div class="p-4 rounded-xl bg-white/5 border border-white/5 text-center text-gray-500">Рекомендации отсутствуют</div>';
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

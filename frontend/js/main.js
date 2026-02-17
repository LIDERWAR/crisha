// VERSION: 2026-02-17-FINAL
console.log('>>> MAIN.JS VERSION 2026-02-17-FINAL LOADED <<<');

document.addEventListener('DOMContentLoaded', () => {
    console.log('>>> DOMContentLoaded fired');

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const loadingState = document.getElementById('loading-state');

    console.log('>>> Elements:', { dropZone: !!dropZone, fileInput: !!fileInput, loadingState: !!loadingState });

    if (!dropZone || !fileInput || !loadingState) {
        console.error('>>> КРИТИЧЕСКАЯ ОШИБКА: Элементы не найдены!');
        return;
    }

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-brand-orange');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-brand-orange');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-brand-orange');
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            uploadFile(file);
        }
    });

    // File input
    fileInput.addEventListener('change', (e) => {
        console.log('>>> FILE INPUT CHANGE');
        const file = e.target.files[0];
        console.log('>>> File:', file ? file.name : 'null');
        if (file && file.type === 'application/pdf') {
            uploadFile(file);
        } else {
            console.log('>>> File type invalid or missing');
        }
    });

    async function uploadFile(file) {
        console.log('>>> uploadFile() called with:', file.name);
        loadingState.classList.remove('hidden');

        const formData = new FormData();
        formData.append('file', file);

        try {
            console.log('>>> Отправка на сервер...');
            const response = await fetch('http://127.0.0.1:8000/api/analyze/', {
                method: 'POST',
                body: formData
            });

            console.log('>>> Ответ получен, status:', response.status);

            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status}`);
            }

            const data = await response.json();
            console.log('>>> Данные:', data);

            // Успех
            loadingState.innerHTML = `
                <div class="text-green-500 font-bold text-xl">✓ Файл загружен!</div>
            `;

            console.log('>>> Запуск таймера редиректа (1 сек)...');
            setTimeout(() => {
                console.log('>>> ВЫПОЛНЯЮ РЕДИРЕКТ НА DASHBOARD');
                window.location.href = '/frontend/dashboard.html';
            }, 1000);

        } catch (error) {
            console.error('>>> ОШИБКА ЗАГРУЗКИ:', error);
            loadingState.innerHTML = `
                <div class="text-red-500 font-bold mb-2">Ошибка</div>
                <div class="text-xs text-red-400 mb-3">${error.message}</div>
                <button onclick="location.reload()" class="px-4 py-2 bg-white/10 rounded-lg">Повторить</button>
            `;
        }
    }

    console.log('>>> main.js инициализация завершена');

    // Scroll animations
    const reveals = document.querySelectorAll('.reveal');
    function checkScroll() {
        reveals.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight - 100) {
                el.classList.add('visible');
            }
        });
    }
    window.addEventListener('scroll', checkScroll);
    checkScroll();
});

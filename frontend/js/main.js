const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const loadingState = document.getElementById('loading-state');
const resultsSection = document.getElementById('results-section');
const closeResultsBtn = document.getElementById('close-results');

// Event Listeners for Drag & Drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('border-brand-orange', 'bg-white/10'));
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('border-brand-orange', 'bg-white/10'));
});

dropZone.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFiles);

// Close Results
closeResultsBtn.addEventListener('click', () => {
    resultsSection.classList.add('hidden');
});

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles({ target: { files: files } });
}

function handleFiles(e) {
    console.log('handleFiles triggered', e);
    const file = e.target.files ? e.target.files[0] : (e.dataTransfer ? e.dataTransfer.files[0] : null);

    console.log('Selected file:', file);

    if (file) {
        // Simple check for PDF based on extension OR mime type
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            uploadFile(file);
        } else {
            alert('Пожалуйста, загрузите PDF файл. (Тип файла: ' + file.type + ')');
        }
    } else {
        console.error('No file found in event');
    }
}

async function uploadFile(file) {
    // Show Loading
    loadingState.classList.remove('hidden');

    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('crisha_token');
    const headers = {};
    if (token) {
        headers['Authorization'] = `Token ${token}`;
    }

    console.log('Upload details:', {
        url: 'http://127.0.0.1:8000/api/analyze/',
        headers: headers,
        tokenExists: !!token,
        fileSize: file.size
    });

    try {
        const response = await fetch('http://127.0.0.1:8000/api/analyze/', {
            method: 'POST',
            headers: headers,
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Raw Server Error Response:', errorText);
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Show success and redirect
        const loadingDiv = document.getElementById('loading-state');
        loadingDiv.innerHTML = `
            <div class="text-green-500 font-bold mb-2">Готово!</div>
            <div class="text-xs text-green-400 text-center px-4">Переходим в кабинет...</div>
        `;

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);

        // displayResults(data);

    } catch (error) {
        console.error('Frontend Error:', error);

        // Show error in the loading state area (non-blocking)
        const loadingDiv = document.getElementById('loading-state');
        loadingDiv.classList.remove('hidden');
        loadingDiv.innerHTML = `
            <div class="text-red-500 font-bold mb-2">Ошибка!</div>
            <div class="text-xs text-red-400 text-center px-4">${error.message}</div>
            <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-white/10 rounded-lg text-xs hover:bg-white/20">Попробовать снова</button>
        `;

        // alert('Ошибка при анализе файла: ' + error.message);
    } finally {
        // We don't hide loading state on error so user can see the message
        // loadingState.classList.add('hidden'); 
        if (!document.getElementById('loading-state').innerHTML.includes('Ошибка!')) {
            loadingState.classList.add('hidden');
        }
    }
}

// Scroll Reveal Animation
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
            observer.unobserve(entry.target); // Animate once
        }
    });
}, observerOptions);

document.addEventListener('DOMContentLoaded', () => {
    const hiddenElements = document.querySelectorAll('.reveal');
    hiddenElements.forEach((el) => observer.observe(el));
});

function displayResults(data) {
    // Show Results Section
    resultsSection.classList.remove('hidden');

    // Update Score
    const scoreElement = document.getElementById('score-value');
    scoreElement.textContent = `${data.score || '?'}/100`;

    if (data.score < 50) scoreElement.className = "text-4xl font-bold text-red-500";
    else if (data.score < 80) scoreElement.className = "text-4xl font-bold text-yellow-500";
    else scoreElement.className = "text-4xl font-bold text-green-500";

    // Update Summary
    document.getElementById('summary-text').textContent = data.summary || "Анализ завершен.";

    // Update Risks
    const risksContainer = document.getElementById('risks-container');
    risksContainer.innerHTML = ''; // Clear previous

    if (data.risks && data.risks.length > 0) {
        data.risks.forEach(risk => {
            const riskItem = document.createElement('div');
            riskItem.className = 'bg-white/5 rounded-xl p-4 border border-white/5 hover:bg-white/10 transition';

            let severityColor = 'bg-yellow-500/20 text-yellow-400';
            if (risk.severity === 'high') severityColor = 'bg-red-500/20 text-red-400';
            if (risk.severity === 'low') severityColor = 'bg-green-500/20 text-green-400';

            riskItem.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-bold text-white text-md">${risk.title}</h4>
                    <span class="${severityColor} text-xs px-2 py-1 rounded-full uppercase font-bold tracking-wider">${risk.severity}</span>
                </div>
                <p class="text-sm text-gray-400">${risk.description}</p>
            `;
            risksContainer.appendChild(riskItem);
        });
    } else {
        risksContainer.innerHTML = '<p class="text-gray-500 italic">Рисков не обнаружено.</p>';
    }
}

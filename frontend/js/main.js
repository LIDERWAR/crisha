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
    dropZone.addEventListener(eventName, () => dropZone.classList.add('border-primary'));
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('border-primary'));
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
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        uploadFile(file);
    } else {
        alert('Пожалуйста, загрузите PDF файл.');
    }
}

async function uploadFile(file) {
    // Show Loading
    loadingState.classList.remove('hidden');

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('http://localhost:8000/api/analyze/', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        displayResults(data);

    } catch (error) {
        console.error('Error:', error);
        alert('Ошибка при анализе файла: ' + error.message);
    } finally {
        loadingState.classList.add('hidden');
    }
}

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
